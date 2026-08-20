'use client';

/**
 * Cache mémoire partagé pour les appels API côté client.
 *
 * Objectif : l'interface (surtout l'espace RH) doit afficher immédiatement les
 * données déjà connues, puis les rafraîchir en arrière-plan — au lieu de vider
 * l'écran et de relancer tous les appels à chaque changement d'onglet ou de page.
 *
 * Volontairement en mémoire uniquement (pas de localStorage/sessionStorage) :
 * ces réponses contiennent des données personnelles d'agents, elles ne doivent
 * pas être persistées sur le poste.
 */

const cache = new Map(); // url -> { data, ts }
const inflight = new Map(); // url -> Promise
const DEFAULT_TTL = 30_000; // 30 s : au-delà, on revalide en arrière-plan

/** Renvoie la donnée en cache (quelle que soit son ancienneté) ou undefined. */
export function getCached(url) {
  return cache.get(url)?.data;
}

/** Indique si une donnée est déjà disponible pour un affichage immédiat. */
export function hasCached(url) {
  return cache.has(url);
}

/** Indique si la donnée en cache est encore considérée comme fraîche. */
export function isFresh(url, ttl = DEFAULT_TTL) {
  const entry = cache.get(url);
  return !!entry && Date.now() - entry.ts < ttl;
}

/**
 * Récupère une URL JSON en dédupliquant les appels simultanés.
 * @param {string} url
 * @param {{ force?: boolean, ttl?: number }} options
 */
export function fetchJson(url, { force = false, ttl = DEFAULT_TTL } = {}) {
  if (!force && isFresh(url, ttl)) {
    return Promise.resolve(cache.get(url).data);
  }

  // Un appel identique est déjà en vol : on s'y raccroche au lieu d'en lancer un second.
  const pending = inflight.get(url);
  if (pending) return pending;

  const promise = fetch(url, { credentials: 'same-origin' })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const error = new Error(data?.message || 'Erreur lors du chargement des données');
        error.status = res.status;
        throw error;
      }
      cache.set(url, { data, ts: Date.now() });
      return data;
    })
    .finally(() => {
      inflight.delete(url);
    });

  inflight.set(url, promise);
  return promise;
}

/**
 * Invalide le cache.
 * @param {string|RegExp|Array<string|RegExp>} [target] URL exacte, préfixe,
 *   expression régulière, ou liste. Sans argument : vide tout le cache.
 */
export function invalidate(target) {
  if (target === undefined) {
    cache.clear();
    return;
  }
  const targets = Array.isArray(target) ? target : [target];
  for (const key of [...cache.keys()]) {
    const match = targets.some((t) =>
      t instanceof RegExp ? t.test(key) : key === t || key.startsWith(t)
    );
    if (match) cache.delete(key);
  }
}

/** Écrase manuellement une entrée (après une mutation dont on connaît le résultat). */
export function setCached(url, data) {
  cache.set(url, { data, ts: Date.now() });
}

/**
 * Précharge des URLs en arrière-plan (erreurs ignorées) pour que les écrans
 * suivants s'ouvrent instantanément.
 */
export function prefetch(urls, options) {
  for (const url of urls) {
    if (!url) continue;
    fetchJson(url, options).catch(() => {});
  }
}
