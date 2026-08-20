// Enrichit la base locale de démo (file:local-guide.db) avec des données fictives
// réalistes pour les captures du guide administrateur. Usage : node scripts/enrich-guide-demo.mjs
import { createClient } from '@libsql/client';

const db = createClient({ url: 'file:local-guide.db' });

const ex = (sql, args = []) => db.execute({ sql, args });
const getUser = async (email) => {
  const r = await ex('SELECT id FROM users WHERE email = ?', [email]);
  return r.rows[0]?.id;
};

const marie = await getUser('marie.dupont@chartrettes.fr'); // RH
const jean = await getUser('jean.martin@chartrettes.fr');   // Employé
const sophie = await getUser('sophie.durand@chartrettes.fr'); // Employé

// --- Profils : service, poste, contrat, ancienneté, hiérarchie ---
await ex(`UPDATE users SET service=?, poste=?, type_contrat=?, date_entree_mairie=?, niveau_validation=1 WHERE id=?`,
  ['Ressources Humaines', 'Responsable RH', 'CDI', '2015-03-01', marie]);

await ex(`UPDATE users SET service=?, poste=?, type_contrat=?, date_entree_mairie=?, responsable_id=? WHERE id=?`,
  ['Services Techniques', 'Agent technique', 'CDI', '2019-09-02', marie, jean]);

// Sophie : temps partiel 60% — ne travaille pas le mercredi, vendredi après-midi off
const horairesSophie = JSON.stringify({
  lundi: { m_debut: '09:00', m_fin: '12:30', a_debut: '13:30', a_fin: '17:00' },
  mardi: { m_debut: '09:00', m_fin: '12:30', a_debut: '13:30', a_fin: '17:00' },
  mercredi: { m_debut: '', m_fin: '', a_debut: '', a_fin: '' },
  jeudi: { m_debut: '09:00', m_fin: '12:30', a_debut: '13:30', a_fin: '17:00' },
  vendredi: { m_debut: '09:00', m_fin: '12:30', a_debut: '', a_fin: '' },
});
await ex(`UPDATE users SET service=?, poste=?, type_contrat=?, date_entree_mairie=?, responsable_id=?, quotite_travail=60, horaires_travail=? WHERE id=?`,
  ['Affaires Scolaires', 'ATSEM', 'CDI', '2021-01-11', marie, horairesSophie, sophie]);

// --- Congés : demandes en attente + validée ---
const leaves = [
  // Jean : validée (passée)
  [jean, '2026-07-13', '2026-07-17', 5, 'journee_complete', 'journee_complete', 'Vacances d\'été', 'validee', marie],
  // Jean : en attente (future)
  [jean, '2026-08-24', '2026-08-28', 5, 'journee_complete', 'journee_complete', 'Congés annuels', 'en_attente', null],
  // Sophie : en attente demi-journée
  [sophie, '2026-09-07', '2026-09-07', 0.5, 'matin', 'matin', 'Rendez-vous médical', 'en_attente', null],
];
for (const [uid, dd, df, n, td, tf, motif, statut, valid] of leaves) {
  const dv = statut === 'validee' ? "datetime('now')" : 'NULL';
  await ex(
    `INSERT INTO demandes_conges (user_id, date_debut, date_fin, nombre_jours_ouvres, type_debut, type_fin, motif, statut, validateur_id, date_validation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${dv})`,
    [uid, dd, df, n, td, tf, motif, statut, valid]
  );
}
// Refléter le solde de Jean (5 jours pris validés)
await ex(`UPDATE soldes_conges SET jours_pris=5, jours_restants=20 WHERE user_id=? AND annee=2026`, [jean]);

// --- Récupération : solde + déclaration + utilisation posée ---
await ex(`INSERT INTO soldes_recuperation (user_id, heures_acquises) VALUES (?, 14)
          ON CONFLICT(user_id) DO UPDATE SET heures_acquises=14`, [jean]);
// Déclaration d'heures sup en attente
await ex(`INSERT INTO demandes_recuperation (user_id, date_travail, nombre_heures, raison, type_compensation, statut)
          VALUES (?, '2026-08-01', 3.5, 'Réunion publique exceptionnelle en soirée', 'recuperation', 'en_attente')`, [jean]);
// Déclaration validée
await ex(`INSERT INTO demandes_recuperation (user_id, date_travail, nombre_heures, raison, type_compensation, statut, validateur_id, date_validation)
          VALUES (?, '2026-07-05', 4, 'Élections - tenue du bureau de vote', 'recuperation', 'validee', ?, datetime('now'))`, [jean, marie]);
// Utilisation de récup posée (validée) — matin, s'affiche en cyan sur le calendrier
await ex(`INSERT INTO demandes_utilisation_recup (user_id, date_debut, date_fin, nombre_heures, raison, statut, validateur_id, date_validation, commentaire)
          VALUES (?, '2026-08-21', '2026-08-21', 4, 'Récupération matinée (08:00 - 12:00)', 'validee', ?, datetime('now'), 'Récupération posée par la RH')`, [jean, marie]);

// --- CET ---
await ex(`INSERT INTO cet (user_id, solde) VALUES (?, 12) ON CONFLICT(user_id) DO UPDATE SET solde=12`, [jean]);
await ex(`INSERT INTO cet (user_id, solde) VALUES (?, 5) ON CONFLICT(user_id) DO UPDATE SET solde=5`, [sophie]);
await ex(`INSERT INTO demandes_cet (user_id, type, jours, motif, statut) VALUES (?, 'credit', 3, 'Épargne de jours non pris', 'en_attente')`, [jean]);

// --- Parentalité ---
await ex(`INSERT INTO demandes_parentalite (user_id, type, date_debut, date_fin, nombre_jours, motif, statut)
          VALUES (?, 'maternite', '2026-10-01', '2027-01-21', 112, 'Congé maternité', 'en_attente')`, [sophie]);

console.log('✅ Base de démo enrichie (congés, récup, CET, parentalité, temps partiel).');
process.exit(0);
