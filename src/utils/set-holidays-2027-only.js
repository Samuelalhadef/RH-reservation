import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { getDb } from '../lib/db.js';

const client = getDb();

const holidays2027 = [
  { date: '2027-01-01', nom: "Jour de l'An" },
  { date: '2027-03-29', nom: 'Lundi de Pâques' },
  { date: '2027-05-01', nom: 'Fête du Travail' },
  { date: '2027-05-06', nom: 'Ascension' },
  { date: '2027-05-08', nom: 'Victoire 1945' },
  { date: '2027-05-17', nom: 'Lundi de Pentecôte' },
  { date: '2027-07-14', nom: 'Fête Nationale' },
  { date: '2027-08-15', nom: 'Assomption' },
  { date: '2027-11-01', nom: 'Toussaint' },
  { date: '2027-11-11', nom: 'Armistice 1918' },
  { date: '2027-12-25', nom: 'Noël' },
];

await client.execute('DELETE FROM jours_feries');
console.log('Tous les jours fériés existants ont été supprimés.');

for (const h of holidays2027) {
  await client.execute({
    sql: 'INSERT INTO jours_feries (date, nom, annee) VALUES (?, ?, 2027)',
    args: [h.date, h.nom]
  });
  console.log(`+ ${h.date} - ${h.nom}`);
}

const all = await client.execute('SELECT * FROM jours_feries ORDER BY date');
console.log(`\nTotal jours fériés en base: ${all.rows.length}`);
for (const r of all.rows) console.log(`  ${r.date} - ${r.nom}`);

process.exit(0);
