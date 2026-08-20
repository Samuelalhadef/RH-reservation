/**
 * Reprise de données : renseigne soldes_conges.jours_cet à partir des demandes CET
 * validées, puis recalcule jours_restants.
 *
 * Avant le correctif, les mouvements CET modifiaient directement jours_restants,
 * qui est recalculé (jours_acquis - jours_pris + ...) à chaque validation ou
 * annulation de congé : le mouvement CET était donc effacé au recalcul suivant.
 *
 * Usage : node src/utils/backfill-cet-solde.js [--apply]
 *         (sans --apply : simulation, aucune écriture)
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { db } from '../lib/db.js';
import { totalDroits, recalculateBalance } from '../lib/soldes.js';

const APPLY = process.argv.includes('--apply');

// Impact net des mouvements CET sur le solde congés, par agent et par année :
// un retrait (debit) crédite les congés, un versement (credit) les débite.
const mouvements = await db.execute(`
  SELECT user_id,
         CAST(strftime('%Y', COALESCE(date_validation, date_demande)) AS INTEGER) as annee,
         SUM(CASE WHEN type = 'debit' THEN jours ELSE -jours END) as net
  FROM demandes_cet
  WHERE statut = 'validee'
  GROUP BY user_id, annee
`);

const attendu = new Map();
for (const m of mouvements.rows) attendu.set(`${m.user_id}|${m.annee}`, m.net || 0);

const soldes = await db.execute(`
  SELECT s.user_id, s.annee, u.prenom, u.nom,
         s.jours_acquis, s.jours_reportes, s.jours_fractionnement,
         s.jours_compensateurs, s.jours_cet, s.jours_pris, s.jours_restants
  FROM soldes_conges s JOIN users u ON u.id = s.user_id
`);

let modifies = 0;
const ecartsHorsCet = [];

for (const s of soldes.rows) {
  const cible = attendu.get(`${s.user_id}|${s.annee}`) || 0;
  const restantsCible = totalDroits({ ...s, jours_cet: cible }) - (s.jours_pris || 0);

  if ((s.jours_cet || 0) === cible) {
    // Pas de mouvement CET à reprendre : on ne touche pas au solde, mais on
    // signale les écarts déjà présents (à traiter via le recalcul RH).
    if (Math.abs((s.jours_restants || 0) - restantsCible) > 0.001) {
      ecartsHorsCet.push(`${s.prenom} ${s.nom} (${s.annee}) : restants ${s.jours_restants} vs ${restantsCible} attendus`);
    }
    continue;
  }

  modifies++;
  console.log(
    `${s.prenom} ${s.nom} (${s.annee}) : jours_cet ${s.jours_cet || 0} -> ${cible}, ` +
    `restants ${s.jours_restants} -> ${restantsCible}`
  );

  if (APPLY) {
    await db.execute({
      sql: 'UPDATE soldes_conges SET jours_cet = ? WHERE user_id = ? AND annee = ?',
      args: [cible, s.user_id, s.annee]
    });
    await recalculateBalance(s.user_id, s.annee);
  }
}

console.log(
  modifies === 0
    ? 'Aucun mouvement CET à reprendre.'
    : `${modifies} solde(s) ${APPLY ? 'corrigé(s)' : 'à corriger (simulation, relancer avec --apply)'}.`
);

if (ecartsHorsCet.length > 0) {
  console.log(`
Écarts sans rapport avec le CET (non modifiés, utiliser le recalcul des soldes côté RH) :`);
  for (const e of ecartsHorsCet) console.log(`  ${e}`);
}
