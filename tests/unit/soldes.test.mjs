import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, createUser, setSolde, getSolde, insertLeave } from '../setup/fixtures.mjs';
import { totalDroits, recalculateBalance, getSoldeDisponible } from '../../src/lib/soldes.js';
import { recalculateFractionnement } from '../../src/lib/fractionnement.js';

beforeEach(resetDb);

describe('totalDroits', () => {
  test('somme de toutes les composantes', () =>
    assert.equal(totalDroits({ jours_acquis: 25, jours_reportes: 3, jours_fractionnement: 2, jours_compensateurs: 1, jours_cet: -2 }), 29));
  test('valeurs NULL traitées comme 0', () =>
    assert.equal(totalDroits({ jours_acquis: 25, jours_reportes: null, jours_fractionnement: null, jours_compensateurs: null, jours_cet: null }), 25));
});

describe('recalculateBalance', () => {
  test("ne compte que les congés validés de l'année", async () => {
    const u = await createUser();
    await insertLeave(u.id, { debut: '2026-03-09', fin: '2026-03-13', jours: 5, statut: 'validee' });
    await insertLeave(u.id, { debut: '2026-04-13', jours: 1, statut: 'en_attente' });
    await insertLeave(u.id, { debut: '2026-04-14', jours: 1, statut: 'refusee' });
    await insertLeave(u.id, { debut: '2026-04-15', jours: 1, statut: 'annulee' });
    await insertLeave(u.id, { debut: '2027-01-11', jours: 3, statut: 'validee' });
    await insertLeave(u.id, { debut: '2025-12-15', jours: 2, statut: 'validee' });
    const r = await recalculateBalance(u.id, 2026);
    assert.deepEqual(r, { jours_pris: 5, jours_restants: 20 });
    const s = await getSolde(u.id);
    assert.equal(s.jours_pris, 5);
    assert.equal(s.jours_restants, 20);
  });

  test('corrige une valeur jours_restants périmée', async () => {
    const u = await createUser({ solde: { restants: 99 } });
    await recalculateBalance(u.id, 2026);
    assert.equal((await getSolde(u.id)).jours_restants, 25);
  });

  test('prend en compte reports, fractionnement, compensateurs et CET', async () => {
    const u = await createUser({ solde: { reportes: 4, fractionnement: 1, compensateurs: 2, cet: -3 } });
    await insertLeave(u.id, { debut: '2026-03-09', jours: 1, statut: 'validee' });
    const r = await recalculateBalance(u.id, 2026);
    assert.equal(r.jours_restants, 25 + 4 + 1 + 2 - 3 - 1);
  });

  test('demi-journées : 0,5 + 0,5 = 1', async () => {
    const u = await createUser();
    await insertLeave(u.id, { debut: '2026-03-09', jours: 0.5, statut: 'validee', type_debut: 'matin', type_fin: 'matin' });
    await insertLeave(u.id, { debut: '2026-03-10', jours: 0.5, statut: 'validee', type_debut: 'apres_midi', type_fin: 'apres_midi' });
    assert.equal((await recalculateBalance(u.id, 2026)).jours_restants, 24);
  });

  test("sans ligne de solde → null, rien n'est créé", async () => {
    const u = await createUser({ solde: false });
    assert.equal(await recalculateBalance(u.id, 2026), null);
    assert.equal(await getSolde(u.id), null);
  });

  test("n'affecte pas les autres agents ni les autres années", async () => {
    const a = await createUser();
    const b = await createUser();
    await setSolde(a.id, { annee: 2027, restants: 42 });
    await insertLeave(a.id, { debut: '2026-03-09', jours: 3, statut: 'validee' });
    await recalculateBalance(a.id, 2026);
    assert.equal((await getSolde(b.id)).jours_restants, 25);
    assert.equal((await getSolde(a.id, 2027)).jours_restants, 42);
  });
});

describe('getSoldeDisponible', () => {
  test('déduit validés et en attente', async () => {
    const u = await createUser();
    await insertLeave(u.id, { debut: '2026-03-09', jours: 5, statut: 'validee' });
    await insertLeave(u.id, { debut: '2026-04-13', jours: 3, statut: 'en_attente' });
    assert.deepEqual(await getSoldeDisponible(u.id, 2026), { pris: 5, restants: 20, enAttente: 3, disponible: 17 });
  });
  test('excludeIds ignore les demandes indiquées', async () => {
    const u = await createUser();
    const id = await insertLeave(u.id, { debut: '2026-04-13', jours: 3, statut: 'en_attente' });
    assert.equal((await getSoldeDisponible(u.id, 2026, [id])).disponible, 25);
  });
  test('excludeIds avec des valeurs invalides ne casse pas la requête', async () => {
    const u = await createUser();
    assert.equal((await getSoldeDisponible(u.id, 2026, ['abc', null, undefined])).disponible, 25);
  });
  test('ne lit pas jours_restants (valeur stockée potentiellement fausse)', async () => {
    const u = await createUser({ solde: { restants: -50 } });
    assert.equal((await getSoldeDisponible(u.id, 2026)).restants, 25);
  });
  test("lecture seule : n'écrit rien", async () => {
    const u = await createUser({ solde: { restants: 7 } });
    await getSoldeDisponible(u.id, 2026);
    assert.equal((await getSolde(u.id)).jours_restants, 7);
  });
  test('sans ligne de solde → null', async () => {
    const u = await createUser({ solde: false });
    assert.equal(await getSoldeDisponible(u.id, 2026), null);
  });
});

describe('recalculateFractionnement', () => {
  const cas = [
    ['aucun congé hors période', [['2026-07-06', '2026-07-10']], 0],
    ['2 jours hors période → 0', [['2026-03-09', '2026-03-10']], 0],
    ['3 jours hors période → 1', [['2026-03-09', '2026-03-11']], 1],
    ['5 jours hors période → 1', [['2026-03-09', '2026-03-13']], 1],
    ['6 jours hors période → 2', [['2026-03-09', '2026-03-16']], 2],
    ['cumul de plusieurs congés (3 + 3) → 2', [['2026-03-09', '2026-03-11'], ['2026-11-16', '2026-11-18']], 2],
    ['week-ends non comptés', [['2026-03-13', '2026-03-16']], 0],
    ["congé à cheval avril/mai : seuls les jours d'avril comptent", [['2026-04-27', '2026-05-05']], 1],
    ["congé à cheval octobre/novembre (heure d'hiver)", [['2026-10-26', '2026-11-04']], 1],
  ];
  for (const [nom, conges, attendu] of cas) {
    test(nom, async () => {
      const u = await createUser();
      for (const [d, f] of conges) await insertLeave(u.id, { debut: d, fin: f, jours: 1, statut: 'validee' });
      assert.equal(await recalculateFractionnement(u.id, 2026), attendu);
      assert.equal((await getSolde(u.id)).jours_fractionnement, attendu);
    });
  }
  test('les demandes non validées ne génèrent pas de fractionnement', async () => {
    const u = await createUser();
    await insertLeave(u.id, { debut: '2026-03-09', fin: '2026-03-16', jours: 6, statut: 'en_attente' });
    assert.equal(await recalculateFractionnement(u.id, 2026), 0);
  });
  test('jours_restants reste cohérent après fractionnement', async () => {
    const u = await createUser();
    await insertLeave(u.id, { debut: '2026-03-09', fin: '2026-03-16', jours: 6, statut: 'validee' });
    await recalculateBalance(u.id, 2026);
    await recalculateFractionnement(u.id, 2026);
    assert.equal((await getSolde(u.id)).jours_restants, 25 + 2 - 6);
  });
  test('le fractionnement disparaît si le congé est annulé', async () => {
    const u = await createUser({ solde: { fractionnement: 2 } });
    await insertLeave(u.id, { debut: '2026-03-09', fin: '2026-03-16', jours: 6, statut: 'annulee' });
    await recalculateBalance(u.id, 2026);
    await recalculateFractionnement(u.id, 2026);
    const s = await getSolde(u.id);
    assert.equal(s.jours_fractionnement, 0);
    assert.equal(s.jours_restants, 25);
  });
});

import { recalculateSoldeComplet } from '../../src/lib/fractionnement.js';
describe('recalculateSoldeComplet (optimisation : 3 requêtes au lieu de 6)', () => {
  test('même résultat que recalculateBalance + recalculateFractionnement, sur 40 cas aléatoires', async () => {
    let seed = 42;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = 0; i < 40; i++) {
      const sol = { acquis: [25, 20, 6.05][i % 3], reportes: i % 4, compensateurs: i % 2, cet: -(i % 3) };
      const a = await createUser({ solde: sol });
      const b = await createUser({ solde: sol });
      const n = Math.floor(rnd() * 6);
      for (let k = 0; k < n; k++) {
        const start = Date.UTC(2026, 0, 5) + Math.floor(rnd() * 350) * 86400000;
        const fin = start + Math.floor(rnd() * 10) * 86400000;
        const l = { debut: new Date(start).toISOString().slice(0, 10), fin: new Date(fin).toISOString().slice(0, 10), jours: 0.5 + Math.floor(rnd() * 10) / 2, statut: ['validee', 'validee', 'en_attente', 'annulee'][k % 4] };
        await insertLeave(a.id, l);
        await insertLeave(b.id, l);
      }
      await recalculateBalance(a.id, 2026);
      await recalculateFractionnement(a.id, 2026);
      const r = await recalculateSoldeComplet(b.id, 2026);
      const sa = await getSolde(a.id);
      const sb = await getSolde(b.id);
      for (const k of ['jours_pris', 'jours_fractionnement', 'jours_restants']) {
        assert.ok(Math.abs(sa[k] - sb[k]) < 1e-9, `cas ${i} ${k}: ${sa[k]} vs ${sb[k]}`);
        assert.ok(Math.abs(r[k] - sb[k]) < 1e-9);
      }
    }
  });
  test('sans ligne de solde → null', async () => {
    const u = await createUser({ solde: false });
    assert.equal(await recalculateSoldeComplet(u.id, 2026), null);
  });
});
