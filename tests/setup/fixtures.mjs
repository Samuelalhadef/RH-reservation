import { db } from '../../src/lib/db.js';
import { setCurrentUser } from '../mocks/auth.mjs';

export { db, setCurrentUser };

let ready = null;
/** Crée le schéma complet (initDatabase + migrations automatiques) une seule fois par fichier de test */
export function setupDb() {
  ready ||= (async () => {
    // Instance séparée du module pour créer les tables : appelée sur l'instance
    // principale, initDatabase() déclencherait runMigrations() AVANT la création
    // des tables, et les colonnes ajoutées par migration manqueraient.
    const bootstrap = await import('../../src/lib/db.js?bootstrap');
    await bootstrap.initDatabase();
    await db.execute('SELECT 1'); // runMigrations() sur l'instance utilisée par l'app
  })();
  return ready;
}

/** Vide toutes les données (le schéma reste) */
export async function resetDb() {
  await setupDb();
  const t = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  for (const { name } of t.rows) await db.execute(`DELETE FROM "${name}"`);
  globalThis.__sentEmails?.splice(0);
  globalThis.__sentPushes?.splice(0);
  setCurrentUser(null);
}

let seq = 0;
/** Crée un utilisateur (+ son solde de l'année si `solde` n'est pas false) */
export async function createUser({
  nom = `Nom${++seq}`, prenom = `Prenom${seq}`, type = 'Agent', responsable_id = null,
  niveau_validation = 0, quotite = 100, date_entree_mairie = '2020-01-01', actif = 1,
  solde = {}, annee = 2026,
} = {}) {
  const r = await db.execute({
    sql: `INSERT INTO users (nom, prenom, email, mot_de_passe, type_utilisateur, responsable_id, niveau_validation, quotite_travail, date_entree_mairie, actif)
          VALUES (?, ?, ?, 'x', ?, ?, ?, ?, ?, ?)`,
    args: [nom, prenom, `${prenom}.${nom}.${seq}@test.local`.toLowerCase(), type, responsable_id, niveau_validation, quotite, date_entree_mairie, actif],
  });
  const id = Number(r.lastInsertRowid);
  if (solde !== false) await setSolde(id, { annee, ...solde });
  return { id, userId: id, type, nom, prenom };
}

export async function setSolde(userId, { annee = 2026, acquis = 25, reportes = 0, fractionnement = 0, compensateurs = 0, cet = 0, pris = 0, restants } = {}) {
  const r = restants ?? (acquis + reportes + fractionnement + compensateurs + cet - pris);
  await db.execute({
    sql: `INSERT OR REPLACE INTO soldes_conges (user_id, annee, jours_acquis, jours_reportes, jours_fractionnement, jours_compensateurs, jours_cet, jours_pris, jours_restants)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [userId, annee, acquis, reportes, fractionnement, compensateurs, cet, pris, r],
  });
}

export async function getSolde(userId, annee = 2026) {
  const r = await db.execute({ sql: 'SELECT * FROM soldes_conges WHERE user_id = ? AND annee = ?', args: [userId, annee] });
  return r.rows[0] || null;
}

/** Insère directement une demande de congé (sans passer par l'API) */
export async function insertLeave(userId, { debut, fin = debut, jours, statut = 'en_attente', type_debut = 'journee_complete', type_fin = 'journee_complete' }) {
  const r = await db.execute({
    sql: `INSERT INTO demandes_conges (user_id, date_debut, date_fin, nombre_jours_ouvres, type_debut, type_fin, statut)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [userId, debut, fin, jours, type_debut, type_fin, statut],
  });
  return Number(r.lastInsertRowid);
}

export async function getLeave(id) {
  const r = await db.execute({ sql: 'SELECT * FROM demandes_conges WHERE id = ?', args: [id] });
  return r.rows[0] || null;
}

/** Faux objet Request suffisant pour les handlers de route */
export function req(body = {}, { url = 'http://localhost/api/test' } = {}) {
  return {
    url,
    json: async () => body,
    cookies: { get: () => ({ value: 'test-token' }) },
    headers: new Headers(),
  };
}
export const params = (p) => ({ params: Promise.resolve(p) });

/** Appelle un handler et renvoie { status, body } */
export async function call(handler, body, p, opts) {
  const res = await handler(req(body, opts), p ? params(p) : undefined);
  return { status: res.status, body: await res.json() };
}

export const asUser = (u) => setCurrentUser({ userId: u.id, id: u.id, type: u.type });
