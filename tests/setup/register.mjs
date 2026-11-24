// Point d'entrée des tests : node --import ./tests/setup/register.mjs --test tests/
// - résout les alias "@/..." comme Next.js
// - remplace auth / email / push / jours fériés par des doubles de test (aucun appel réseau)
// - fige l'horloge ("aujourd'hui" = 2 mars 2026, 9h, Paris)
// - pointe la base vers un fichier SQLite jetable (jamais Turso)
import { register } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

process.env.TZ = process.env.TZ || 'Europe/Paris';

const dir = mkdtempSync(path.join(tmpdir(), 'rh-tests-'));
process.env.TURSO_DATABASE_URL = pathToFileURL(path.join(dir, 'test.db')).href;
process.env.TURSO_AUTH_TOKEN = '';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
delete process.env.RESEND_API_KEY;
delete process.env.VAPID_PRIVATE_KEY;

// Horloge figée : new Date() sans argument et Date.now() renvoient TEST_NOW
const RealDate = Date;
const TEST_NOW = new RealDate('2026-03-02T09:00:00+01:00').getTime();
globalThis.__TEST_NOW = TEST_NOW;
class FakeDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(globalThis.__TEST_NOW);
    else super(...args);
  }
  static now() { return globalThis.__TEST_NOW; }
}
globalThis.Date = FakeDate;

// Silence les logs applicatifs (console.error reste visible si DEBUG_TESTS=1)
if (!process.env.DEBUG_TESTS) {
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
}

register('./loader.mjs', import.meta.url);
