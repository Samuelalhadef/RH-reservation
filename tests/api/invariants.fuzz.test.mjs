// Test aléatoire (fuzz) : enchaîne des opérations au hasard via les vraies routes API
// et vérifie après CHAQUE opération les invariants métier.
// Reproductible : chaque scénario a une graine. Pour rejouer : FUZZ_SEED=1234 FUZZ_STEPS=400
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, createUser, db, call, asUser } from '../setup/fixtures.mjs';
import { POST as createLeave } from '../../src/app/api/leaves/route.js';
import { POST as rhCreate } from '../../src/app/api/leaves/rh-create/route.js';
import { PUT as statusPUT } from '../../src/app/api/leaves/[id]/status/route.js';
import { PUT as cancelPUT } from '../../src/app/api/leaves/[id]/cancel/route.js';
import { POST as cetTransfer } from '../../src/app/api/cet/transfer/route.js';
import { PUT as cetDecide } from '../../src/app/api/cet/requests/[id]/route.js';
import { POST as adjust } from '../../src/app/api/users/[id]/adjust-balance/route.js';
import { totalDroits } from '../../src/lib/soldes.js';

const SEEDS = process.env.FUZZ_SEED ? [Number(process.env.FUZZ_SEED)] : [1, 2, 3, 4, 5, 6, 7, 8];
const STEPS = Number(process.env.FUZZ_STEPS || 120);
const EPS = 1e-9;

function rng(seed) {
  let s = seed >>> 0;
  const next = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (a, b) => a + Math.floor(next() * (b - a + 1)), pick: (arr) => arr[Math.floor(next() * arr.length)] };
}

const iso = (t) => new Date(t).toISOString().slice(0, 10);
const HALF = ['journee_complete', 'journee_complete', 'journee_complete', 'matin', 'apres_midi'];

function randomPeriod(r) {
  // Entre le 09/03/2026 et le 31/12/2026 (+ parfois janvier 2027)
  const start = Date.UTC(2026, 2, 9) + r.int(0, r.next() < 0.08 ? 310 : 290) * 86400000;
  const len = r.pick([0, 0, 0, 1, 2, 4, 4, 7, 11, 14]);
  return { date_debut: iso(start), date_fin: iso(start + len * 86400000), type_debut: r.pick(HALF), type_fin: r.pick(HALF) };
}

async function checkInvariants(ctx, label) {
  const rows = (await db.execute(`
    SELECT s.*, (SELECT COALESCE(SUM(nombre_jours_ouvres), 0) FROM demandes_conges d
                 WHERE d.user_id = s.user_id AND d.statut = 'validee' AND strftime('%Y', d.date_debut) = '2026') AS vrai_pris
    FROM soldes_conges s WHERE s.annee = 2026`)).rows;
  for (const s of rows) {
    const who = `${label} — agent ${s.user_id}`;
    assert.ok(Math.abs(s.jours_pris - s.vrai_pris) < EPS, `${who} : jours_pris ${s.jours_pris} ≠ congés validés ${s.vrai_pris}`);
    const attendu = totalDroits(s) - s.vrai_pris;
    assert.ok(Math.abs(s.jours_restants - attendu) < EPS, `${who} : jours_restants ${s.jours_restants} ≠ attendu ${attendu}`);
    assert.ok(s.jours_restants >= -EPS, `${who} : solde négatif (${s.jours_restants})`);
    assert.ok((s.jours_acquis ?? 0) >= -EPS, `${who} : jours_acquis négatif`);
  }

  // Pas deux congés validés qui se chevauchent pour un même agent
  const overlaps = (await db.execute(`
    SELECT a.id a_id, b.id b_id, a.user_id FROM demandes_conges a JOIN demandes_conges b
      ON a.user_id = b.user_id AND a.id < b.id AND a.statut = 'validee' AND b.statut = 'validee'
     AND a.date_debut <= b.date_fin AND b.date_debut <= a.date_fin`)).rows;
  assert.equal(overlaps.length, 0, `${label} : congés validés qui se chevauchent ${JSON.stringify(overlaps)}`);

  // Pas de demande à 0 jour, ni de nombre de jours non multiple de 0,5
  const bad = (await db.execute(`SELECT id, nombre_jours_ouvres n FROM demandes_conges WHERE nombre_jours_ouvres <= 0 OR (nombre_jours_ouvres * 2) != CAST(nombre_jours_ouvres * 2 AS INTEGER)`)).rows;
  assert.equal(bad.length, 0, `${label} : demandes avec un nombre de jours invalide ${JSON.stringify(bad)}`);

  // CET : solde dans [0, 60] et cohérent avec l'historique et jours_cet
  for (const c of (await db.execute(`
    SELECT c.user_id, c.solde,
      COALESCE((SELECT SUM(CASE type WHEN 'credit' THEN jours ELSE -jours END) FROM cet_historique h WHERE h.user_id = c.user_id), 0) AS histo,
      COALESCE((SELECT jours_cet FROM soldes_conges s WHERE s.user_id = c.user_id AND s.annee = 2026), 0) AS jours_cet
    FROM cet c`)).rows) {
    assert.ok(c.solde >= -EPS && c.solde <= 60 + EPS, `${label} : CET hors bornes (${c.solde})`);
    assert.ok(Math.abs(c.solde - (ctx.cetInitial[c.user_id] || 0) - c.histo) < EPS, `${label} : CET ${c.solde} incohérent avec l'historique`);
    assert.ok(Math.abs(c.jours_cet + c.histo) < EPS, `${label} : jours_cet ${c.jours_cet} ≠ -mouvements ${c.histo}`);
  }
}

for (const seed of SEEDS) {
  test(`fuzz graine ${seed} (${STEPS} opérations)`, async () => {
    await resetDb();
    const r = rng(seed);
    const rh = await createUser({ type: 'RH' });
    const dir = await createUser({ type: 'Directeur Vie Locale', niveau_validation: 2, responsable_id: rh.id });
    const chef = await createUser({ type: 'Responsable Anim.', niveau_validation: 1, responsable_id: dir.id });
    const agents = [];
    for (let i = 0; i < 5; i++) {
      agents.push(await createUser({
        responsable_id: r.pick([null, chef.id, chef.id, dir.id, rh.id]),
        solde: { acquis: r.pick([25, 25, 20, 12.5, 6.05, 3]), reportes: r.pick([0, 0, 2, 5]), compensateurs: r.pick([0, 0, 1]) },
      }));
    }
    const ctx = { cetInitial: {} };
    for (const a of agents) {
      if (r.next() < 0.5) {
        const v = r.pick([0, 3, 10, 58]);
        await db.execute({ sql: 'INSERT INTO cet (user_id, solde) VALUES (?, ?)', args: [a.id, v] });
        ctx.cetInitial[a.id] = v;
      }
    }
    const validators = [rh, dir, chef];
    const journal = [];

    for (let step = 1; step <= STEPS; step++) {
      const a = r.pick(agents);
      const pending = (await db.execute("SELECT id, user_id FROM demandes_conges WHERE statut = 'en_attente'")).rows;
      const any = (await db.execute("SELECT id FROM demandes_conges WHERE statut IN ('en_attente', 'validee')")).rows;
      const op = r.pick(['create', 'create', 'create', 'validate', 'validate', 'validate', 'force', 'refuse', 'cancel', 'rhcreate', 'cet', 'cetdecide', 'adjust']);
      let res;
      try {
        if (op === 'create') {
          asUser(a); res = await call(createLeave, randomPeriod(r));
        } else if (op === 'rhcreate') {
          asUser(rh); res = await call(rhCreate, { user_id: a.id, ...randomPeriod(r) });
        } else if ((op === 'validate' || op === 'refuse' || op === 'force') && pending.length) {
          const l = r.pick(pending);
          const v = op === 'force' ? rh : r.pick(validators);
          asUser(v);
          res = await call(statusPUT, { statut: op === 'refuse' ? 'refusee' : 'validee', force_rh: op === 'force' }, { id: String(l.id) });
        } else if (op === 'cancel' && any.length) {
          asUser(rh); res = await call(cancelPUT, { motif: 'fuzz' }, { id: String(r.pick(any).id) });
        } else if (op === 'cet') {
          asUser(a); res = await call(cetTransfer, { jours: r.pick([0.5, 1, 2, 3, 6]), type: r.pick(['credit', 'debit']) });
        } else if (op === 'cetdecide') {
          const p = (await db.execute("SELECT id FROM demandes_cet WHERE statut = 'en_attente'")).rows;
          if (p.length) { asUser(rh); res = await call(cetDecide, { action: r.pick(['valider', 'valider', 'refuser']) }, { id: String(r.pick(p).id) }); }
        } else if (op === 'adjust') {
          asUser(rh); res = await call(adjust, { adjustment: r.pick([-3, -1, -0.5, 0.5, 1, 2]), type: r.pick(['conges', 'compensateurs']) }, { id: String(a.id) });
        }
      } catch (e) {
        assert.fail(`graine ${seed}, étape ${step} (${op}) : exception non gérée ${e.stack}`);
      }
      journal.push(`${step}:${op}:${res?.status ?? '-'}`);
      if (res) assert.notEqual(res.status, 500, `graine ${seed}, étape ${step} (${op}) : erreur 500 ${JSON.stringify(res.body)}\n${journal.slice(-10).join(' ')}`);
      await checkInvariants(ctx, `graine ${seed}, étape ${step} (${op})`);
    }
  });
}
