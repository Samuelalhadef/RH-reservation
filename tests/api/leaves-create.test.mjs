// POST /api/leaves : création d'une demande par l'agent ("aujourd'hui" = lundi 02/03/2026)
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, createUser, getSolde, insertLeave, getLeave, call, asUser, setCurrentUser, db } from '../setup/fixtures.mjs';
import { POST } from '../../src/app/api/leaves/route.js';

beforeEach(resetDb);

const poser = (body) => call(POST, body);
const demandes = async (userId) =>
  (await db.execute({ sql: 'SELECT * FROM demandes_conges WHERE user_id = ? ORDER BY id', args: [userId] })).rows;

describe('validation des entrées', () => {
  test('non connecté → 401', async () => {
    setCurrentUser(null);
    assert.equal((await poser({ date_debut: '2026-03-09', date_fin: '2026-03-09' })).status, 401);
  });
  for (const [nom, body] of [
    ['dates manquantes', {}],
    ['date de fin manquante', { date_debut: '2026-03-09' }],
    ['date invalide', { date_debut: 'pas-une-date', date_fin: '2026-03-09' }],
    ['fin avant début', { date_debut: '2026-03-13', date_fin: '2026-03-09' }],
    ['moins de 7 jours à l\'avance (J+6)', { date_debut: '2026-03-08', date_fin: '2026-03-10' }],
    ['date passée', { date_debut: '2026-02-02', date_fin: '2026-02-03' }],
    ['uniquement un week-end', { date_debut: '2026-03-14', date_fin: '2026-03-15' }],
    ['uniquement un jour férié (lundi de Pâques)', { date_debut: '2026-04-06', date_fin: '2026-04-06' }],
  ]) {
    test(`${nom} → 400, rien n'est créé`, async () => {
      const u = await createUser();
      asUser(u);
      const r = await poser(body);
      assert.equal(r.status, 400, JSON.stringify(r.body));
      assert.equal(r.body.success, false);
      assert.equal((await demandes(u.id)).length, 0);
    });
  }
});

describe('calcul du nombre de jours', () => {
  const cas = [
    ['une semaine', { date_debut: '2026-03-09', date_fin: '2026-03-13' }, 5],
    ['J+7 pile', { date_debut: '2026-03-09', date_fin: '2026-03-09' }, 1],
    ['semaine avec lundi de Pâques', { date_debut: '2026-04-06', date_fin: '2026-04-10' }, 4],
    ['matin seul', { date_debut: '2026-03-10', date_fin: '2026-03-10', type_debut: 'matin', type_fin: 'matin' }, 0.5],
    ['après-midi seul', { date_debut: '2026-03-10', date_fin: '2026-03-10', type_debut: 'apres_midi', type_fin: 'apres_midi' }, 0.5],
    ['début l\'après-midi', { date_debut: '2026-03-09', date_fin: '2026-03-13', type_debut: 'apres_midi' }, 4.5],
    ['fin le matin', { date_debut: '2026-03-09', date_fin: '2026-03-13', type_fin: 'matin' }, 4.5],
    ['début après-midi et fin matin', { date_debut: '2026-03-09', date_fin: '2026-03-13', type_debut: 'apres_midi', type_fin: 'matin' }, 4],
    ['deux demi-journées consécutives', { date_debut: '2026-03-09', date_fin: '2026-03-10', type_debut: 'apres_midi', type_fin: 'matin' }, 1],
    ['traverse le passage à l\'heure d\'hiver', { date_debut: '2026-10-23', date_fin: '2026-10-30' }, 6],
  ];
  for (const [nom, body, attendu] of cas) {
    test(`${nom} = ${attendu} j`, async () => {
      const u = await createUser();
      asUser(u);
      const r = await poser(body);
      assert.equal(r.status < 300, true, JSON.stringify(r.body));
      const [d] = await demandes(u.id);
      assert.equal(d.nombre_jours_ouvres, attendu);
      assert.equal(d.statut, 'en_attente');
    });
  }

  test('demi-journée sur un samedi → refusée (0 jour)', async () => {
    const u = await createUser();
    asUser(u);
    const r = await poser({ date_debut: '2026-03-14', date_fin: '2026-03-14', type_debut: 'matin', type_fin: 'matin' });
    assert.equal(r.status, 400);
  });
  test('début après-midi un vendredi, fin le lundi matin (week-end au milieu) = 1 j', async () => {
    const u = await createUser();
    asUser(u);
    await poser({ date_debut: '2026-03-13', date_fin: '2026-03-16', type_debut: 'apres_midi', type_fin: 'matin' });
    const [d] = await demandes(u.id);
    assert.equal(d.nombre_jours_ouvres, 1);
  });
  test('début l\'après-midi un samedi : pas de demi-journée retirée en trop', async () => {
    const u = await createUser();
    asUser(u);
    await poser({ date_debut: '2026-03-14', date_fin: '2026-03-20', type_debut: 'apres_midi' });
    const [d] = await demandes(u.id);
    assert.equal(d.nombre_jours_ouvres, 5, 'le samedi ne compte pas, on ne doit pas retirer 0,5 sur le lundi');
  });
});

describe('contrôle du solde', () => {
  test('solde exact : accepté', async () => {
    const u = await createUser({ solde: { acquis: 5 } });
    asUser(u);
    assert.equal((await poser({ date_debut: '2026-03-09', date_fin: '2026-03-13' })).status < 300, true);
  });
  test('dépasse le solde d\'une demi-journée : refusé', async () => {
    const u = await createUser({ solde: { acquis: 4.5 } });
    asUser(u);
    assert.equal((await poser({ date_debut: '2026-03-09', date_fin: '2026-03-13' })).status, 400);
  });
  test('les demandes en attente sont déduites (cause du compte à -5)', async () => {
    const u = await createUser({ solde: { acquis: 10 } });
    asUser(u);
    assert.ok((await poser({ date_debut: '2026-03-09', date_fin: '2026-03-13' })).status < 300); // 5 j
    assert.ok((await poser({ date_debut: '2026-03-16', date_fin: '2026-03-20' })).status < 300); // 5 j
    const r = await poser({ date_debut: '2026-03-23', date_fin: '2026-03-23' }); // 1 j de trop
    assert.equal(r.status, 400);
    assert.match(r.body.message, /en attente/);
  });
  test('les congés validés sont déduits même si jours_restants en base est faux', async () => {
    const u = await createUser({ solde: { acquis: 5, restants: 25 } });
    await insertLeave(u.id, { debut: '2026-03-30', fin: '2026-04-03', jours: 5, statut: 'validee' });
    asUser(u);
    assert.equal((await poser({ date_debut: '2026-03-09', date_fin: '2026-03-09' })).status, 400);
  });
  test('les demandes refusées / annulées ne sont pas déduites', async () => {
    const u = await createUser({ solde: { acquis: 5 } });
    await insertLeave(u.id, { debut: '2026-04-13', fin: '2026-04-17', jours: 5, statut: 'refusee' });
    await insertLeave(u.id, { debut: '2026-04-20', fin: '2026-04-24', jours: 5, statut: 'annulee' });
    asUser(u);
    assert.ok((await poser({ date_debut: '2026-03-09', date_fin: '2026-03-13' })).status < 300);
  });
  test('reports, compensateurs et CET augmentent le solde disponible', async () => {
    const u = await createUser({ solde: { acquis: 0, reportes: 2, compensateurs: 1, cet: 2 } });
    asUser(u);
    assert.ok((await poser({ date_debut: '2026-03-09', date_fin: '2026-03-13' })).status < 300);
  });
  test('solde négatif : toute demande est refusée', async () => {
    const u = await createUser({ solde: { acquis: 5 } });
    await insertLeave(u.id, { debut: '2026-03-30', fin: '2026-04-10', jours: 9, statut: 'validee' });
    asUser(u);
    const r = await poser({ date_debut: '2026-03-10', date_fin: '2026-03-10', type_debut: 'matin', type_fin: 'matin' });
    assert.equal(r.status, 400);
    assert.match(r.body.message, /0 jour/, 'le message ne doit pas afficher un nombre négatif');
  });
  test('pas de ligne de solde : créée automatiquement à 25 j', async () => {
    const u = await createUser({ solde: false });
    asUser(u);
    assert.ok((await poser({ date_debut: '2026-03-09', date_fin: '2026-03-13' })).status < 300);
    assert.equal((await getSolde(u.id)).jours_acquis, 25);
  });
});

describe('chevauchements', () => {
  test('chevauche un congé validé → refusé', async () => {
    const u = await createUser();
    await insertLeave(u.id, { debut: '2026-03-11', fin: '2026-03-11', jours: 1, statut: 'validee' });
    asUser(u);
    assert.equal((await poser({ date_debut: '2026-03-09', date_fin: '2026-03-13' })).status, 400);
  });
  test('chevauche une demande en attente → elle est remplacée', async () => {
    const u = await createUser();
    const old = await insertLeave(u.id, { debut: '2026-03-11', fin: '2026-03-12', jours: 2 });
    asUser(u);
    assert.ok((await poser({ date_debut: '2026-03-09', date_fin: '2026-03-13' })).status < 300);
    assert.equal(await getLeave(old), null);
    assert.equal((await demandes(u.id)).length, 1);
  });
  test('la demande remplacée ne bloque pas le solde', async () => {
    const u = await createUser({ solde: { acquis: 5 } });
    await insertLeave(u.id, { debut: '2026-03-09', fin: '2026-03-13', jours: 5 });
    asUser(u);
    // Modifie sa demande de 5 j en 5 j sur la même période : doit passer
    assert.ok((await poser({ date_debut: '2026-03-09', date_fin: '2026-03-13' })).status < 300);
  });
  test('si le solde est insuffisant, la demande en attente existante n\'est PAS supprimée', async () => {
    const u = await createUser({ solde: { acquis: 3 } });
    const old = await insertLeave(u.id, { debut: '2026-03-09', fin: '2026-03-11', jours: 3 });
    asUser(u);
    assert.equal((await poser({ date_debut: '2026-03-09', date_fin: '2026-03-13' })).status, 400);
    assert.ok(await getLeave(old), 'la demande initiale doit être conservée');
  });
  test('les demandes d\'un autre agent ne sont pas touchées', async () => {
    const a = await createUser();
    const b = await createUser();
    const other = await insertLeave(b.id, { debut: '2026-03-09', fin: '2026-03-13', jours: 5 });
    asUser(a);
    assert.ok((await poser({ date_debut: '2026-03-09', date_fin: '2026-03-13' })).status < 300);
    assert.ok(await getLeave(other));
  });
  test('jour adjacent (fin du précédent = veille) : pas de chevauchement', async () => {
    const u = await createUser();
    await insertLeave(u.id, { debut: '2026-03-09', fin: '2026-03-10', jours: 2, statut: 'validee' });
    asUser(u);
    assert.ok((await poser({ date_debut: '2026-03-11', date_fin: '2026-03-12' })).status < 300);
  });
});

describe('alternants', () => {
  test('ne peut pas poser sur un jour de cours', async () => {
    const u = await createUser({ type: 'Alternant' });
    await db.execute({ sql: 'INSERT INTO jours_cours (user_id, date) VALUES (?, ?)', args: [u.id, '2026-03-11'] });
    asUser(u);
    assert.equal((await poser({ date_debut: '2026-03-09', date_fin: '2026-03-13' })).status, 400);
  });
});

describe('notifications', () => {
  test('sans responsable : la RH est prévenue par email', async () => {
    const rh = await createUser({ type: 'RH' });
    const u = await createUser();
    asUser(u);
    await poser({ date_debut: '2026-03-09', date_fin: '2026-03-09' });
    assert.ok(globalThis.__sentEmails.some(e => e.kind === 'new'));
  });
  test('avec responsable : il reçoit une notification push', async () => {
    const chef = await createUser({ type: 'Responsable', niveau_validation: 1 });
    const u = await createUser({ responsable_id: chef.id });
    asUser(u);
    await poser({ date_debut: '2026-03-09', date_fin: '2026-03-09' });
    assert.ok(globalThis.__sentPushes.some(p => p.kind === 'leave-request' && p.args[1] === chef.id));
  });
});
