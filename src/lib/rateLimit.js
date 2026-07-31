/**
 * Limiteur de débit simple en mémoire (par clé : IP / identifiant).
 *
 * Conçu pour un déploiement mono-serveur (on-premise mairie). Sur un
 * déploiement multi-instances ou serverless, remplacer par un store partagé
 * (Redis/Turso) car la mémoire n'est pas partagée entre les instances.
 */

const buckets = new Map();

// Nettoyage périodique pour éviter une fuite mémoire sur les clés expirées.
let lastCleanup = 0;
function cleanup(now) {
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}

/**
 * @param {string} key - identifiant de la source (ex: `login:<ip>`)
 * @param {object} opts
 * @param {number} opts.limit - nombre de tentatives autorisées dans la fenêtre
 * @param {number} opts.windowMs - durée de la fenêtre en millisecondes
 * @returns {{allowed: boolean, remaining: number, retryAfter: number}}
 */
export function rateLimit(key, { limit = 5, windowMs = 15 * 60 * 1000 } = {}) {
  const now = Date.now();
  cleanup(now);

  let entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    buckets.set(key, entry);
  }

  entry.count += 1;

  if (entry.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  return {
    allowed: true,
    remaining: limit - entry.count,
    retryAfter: 0,
  };
}

/**
 * Réinitialise le compteur d'une clé (ex: après une connexion réussie).
 */
export function resetRateLimit(key) {
  buckets.delete(key);
}
