import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { getDb } from '../lib/db.js';

const client = getDb();

const holidays2026 = [
  { date: '2026-01-01', nom: "Jour de l'An" },
  { date: '2026-04-06', nom: 'Lundi de Pâques' },
  { date: '2026-05-01', nom: 'Fête du Travail' },
  { date: '2026-05-08', nom: 'Victoire 1945' },
  { date: '2026-05-14', nom: 'Ascension' },
  { date: '2026-05-25', nom: 'Lundi de Pentecôte' },
  { date: '2026-07-14', nom: 'Fête Nationale' },
  { date: '2026-08-15', nom: 'Assomption' },
  { date: '2026-11-01', nom: 'Toussaint' },
  { date: '2026-11-11', nom: 'Armistice 1918' },
  { date: '2026-12-25', nom: 'Noël' },
];

let added = 0;
for (const h of holidays2026) {
  const existing = await client.execute({ sql: 'SELECT id FROM jours_feries WHERE date = ?', args: [h.date] });
  if (existing.rows.length === 0) {
    await client.execute({ sql: 'INSERT INTO jours_feries (date, nom, annee) VALUES (?, ?, 2026)', args: [h.date, h.nom] });
    console.log(`+ ${h.date} - ${h.nom}`);
    added++;
  } else {
    console.log(`  déjà présent: ${h.date} - ${h.nom}`);
  }
}

console.log(`\n${added} jours fériés 2026 ajoutés.`);

const all = await client.execute('SELECT * FROM jours_feries ORDER BY date');
console.log(`\nTotal jours fériés en base: ${all.rows.length}`);
for (const r of all.rows) console.log(`  ${r.date} - ${r.nom}`);

process.exit(0);
