import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { getDb } from '../lib/db.js';

const client = getDb();

const before = await client.execute('SELECT u.prenom, u.nom, s.jours_fractionnement, s.jours_restants FROM soldes_conges s JOIN users u ON u.id = s.user_id WHERE s.jours_fractionnement != 0');
console.log(`Utilisateurs avec fractionnement != 0 : ${before.rows.length}`);
for (const r of before.rows) console.log(`  ${r.prenom} ${r.nom}: fractionnement=${r.jours_fractionnement}, restants=${r.jours_restants}`);

await client.execute('UPDATE soldes_conges SET jours_fractionnement = 0, jours_restants = jours_acquis + jours_reportes + jours_compensateurs');
console.log('\nJours de fractionnement remis à 0 et jours restants recalculés.');

const after = await client.execute('SELECT u.prenom, u.nom, s.jours_fractionnement, s.jours_restants FROM soldes_conges s JOIN users u ON u.id = s.user_id ORDER BY u.nom');
for (const r of after.rows) console.log(`  ${r.prenom} ${r.nom}: fractionnement=${r.jours_fractionnement}, restants=${r.jours_restants}`);

process.exit(0);
