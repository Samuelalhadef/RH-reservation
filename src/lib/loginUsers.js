import { db } from '@/lib/db';

/**
 * Liste des comptes affichée sur l'écran de connexion, gardée en mémoire serveur.
 *
 * Elle change rarement (création / modification / suppression d'agent) : on la
 * sert depuis la mémoire et on l'invalide explicitement à chaque modification
 * d'un utilisateur. Le TTL n'est qu'un filet de sécurité.
 */
const TTL_MS = 10 * 60 * 1000;

let cached = null; // { users, ts }
let inflight = null;

export async function getLoginUsers() {
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.users;
  if (inflight) return inflight;

  inflight = db
    .execute('SELECT id, nom, prenom FROM users WHERE actif = 1 ORDER BY nom, prenom')
    .then((result) => {
      // Objets simples (sérialisables vers le composant client)
      const users = result.rows.map((r) => ({ id: r.id, nom: r.nom, prenom: r.prenom }));
      cached = { users, ts: Date.now() };
      return users;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** À appeler après toute création / modification / suppression d'utilisateur. */
export function invalidateLoginUsers() {
  cached = null;
}
