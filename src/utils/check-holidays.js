import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { getDb } from '../lib/db.js';

const client = getDb();
const result = await client.execute('SELECT * FROM jours_feries ORDER BY date');
console.log(`Jours fériés en base: ${result.rows.length}`);
for (const r of result.rows) console.log(`  ${r.date} - ${r.nom} (${r.annee})`);
process.exit(0);
