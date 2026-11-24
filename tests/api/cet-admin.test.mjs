// CET (versement / retrait + validation RH), ajustement manuel de solde, modification d'agent
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, createUser, getSolde, setSolde, insertLeave, call, asUser, db } from '../setup/fixtures.mjs';
import { POST as cetTransfer } from '../../src/app/api/cet/transfer/route.js';
import { PUT as cetDecide } from '../../src/app/api/cet/requests/[id]/route.js';
import { POST as adjust } from '../../src/app/api/users/[id]/adjust-balance/route.js';
import { PUT as updateUser } from '../../src/app/api/users/[id]/route.js';
import { PUT as statusPUT } from '../../src/app/api/leaves/[id]/status/route.js';
import { recalculateBalance } from '../../src/lib/soldes.js';

beforeEach(resetDb);

const demander = (u, body) => { asUser(u); return call(cetTransfer, body); };
const lastCetId = async () => Number((await db.execute('SELECT MAX(id) id FROM demandes_cet')).rows[0].id);
const decider = async (rh, id, action) => { asUser(rh); return call(cetDecide, { action }, { id: String(id) }); };
const cetSolde = async (uid) => (await db.execute({ sql: 'SELECT solde FROM cet WHERE user_id = ?', args: [uid] })).rows[0]?.solde ?? 0;
/** Agent éligible au CET : 20 j pris, ancienneté OK */
async function eligible(solde = {}) {
  const u = await createUser({ solde });
  await insertLeave(u.id, { debut: '2026-06-01', fin: '2026-06-26', jours: 20, statut: 'validee' });
  await recalculateBalance(u.id, 2026);
  return u;
}

describe('demande de versement congés → CET', () => {
  test('éligible : demande créée en attente, solde inchangé', async () => {
    const u = await eligible();
    const r = await demander(u, { jours: 3, type: 'credit' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal((await getSolde(u.id)).jours_restants, 5);
  });
  for (const [nom, jours] of [['0 jour', 0], ['négatif', -2], ['texte', 'abc'], ['absent', undefined]]) {
    test(`nombre de jours ${nom} → 400`, async () => {
      const u = await eligible();
      const r = await demander(u, { jours, type: 'credit' });
      assert.equal(r.status, 400, JSON.stringify(r.body));
    });
  }
  test('nombre de jours envoyé en texte ("2") traité comme un nombre', async () => {
    const u = await eligible();
    await db.execute({ sql: 'INSERT INTO cet (user_id, solde) VALUES (?, 58)', args: [u.id] });
    const r = await demander(u, { jours: '2', type: 'credit' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  });
  test('type inconnu → 400', async () => {
    const u = await eligible();
    assert.equal((await demander(u, { jours: 1, type: 'vol' })).status, 400);
  });
  test('moins d\'un an d\'ancienneté → 403', async () => {
    const u = await createUser({ date_entree_mairie: '2025-06-01' });
    assert.equal((await demander(u, { jours: 1, type: 'credit' })).status, 403);
  });
  test('date d\'entrée inconnue → 403', async () => {
    const u = await createUser({ date_entree_mairie: null });
    assert.equal((await demander(u, { jours: 1, type: 'credit' })).status, 403);
  });
  test('moins de 20 jours pris → 403', async () => {
    const u = await createUser();
    assert.equal((await demander(u, { jours: 1, type: 'credit' })).status, 403);
  });
  test('plus que le solde restant → 400', async () => {
    const u = await eligible(); // 5 restants
    assert.equal((await demander(u, { jours: 6, type: 'credit' })).status, 400);
  });
  test('jours déjà engagés dans une demande de congé en attente : non versables', async () => {
    const u = await eligible(); // 5 restants
    await insertLeave(u.id, { debut: '2026-07-06', fin: '2026-07-10', jours: 5 });
    const r = await demander(u, { jours: 3, type: 'credit' });
    assert.equal(r.status, 400, 'ces jours sont déjà demandés en congé');
  });
  test('limite 5 jours/an', async () => {
    const u = await eligible({ acquis: 40 });
    await db.execute({ sql: "INSERT INTO cet_historique (user_id, type, jours) VALUES (?, 'credit', 4)", args: [u.id] });
    assert.equal((await demander(u, { jours: 2, type: 'credit' })).status, 403);
    assert.equal((await demander(u, { jours: 1, type: 'credit' })).status, 200);
  });
  test('plafond 60 jours', async () => {
    const u = await eligible();
    await db.execute({ sql: 'INSERT INTO cet (user_id, solde) VALUES (?, 59)', args: [u.id] });
    assert.equal((await demander(u, { jours: 2, type: 'credit' })).status, 403);
  });
  test('une seule demande en attente par type', async () => {
    const u = await eligible();
    await demander(u, { jours: 1, type: 'credit' });
    assert.equal((await demander(u, { jours: 1, type: 'credit' })).status, 400);
  });
});

describe('validation RH du CET', () => {
  test('versement validé : jours_cet négatif, CET crédité, solde cohérent', async () => {
    const rh = await createUser({ type: 'RH' });
    const u = await eligible();
    await demander(u, { jours: 3, type: 'credit' });
    const r = await decider(rh, await lastCetId(), 'valider');
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const s = await getSolde(u.id);
    assert.equal(s.jours_cet, -3);
    assert.equal(s.jours_restants, 2);
    assert.equal(await cetSolde(u.id), 3);
  });
  test('le mouvement CET survit à une validation de congé ultérieure (bug d\'août 2026)', async () => {
    const rh = await createUser({ type: 'RH' });
    const u = await eligible();
    await demander(u, { jours: 3, type: 'credit' });
    await decider(rh, await lastCetId(), 'valider');
    const l = await insertLeave(u.id, { debut: '2026-07-06', jours: 1 });
    asUser(rh);
    await call(statusPUT, { statut: 'validee' }, { id: String(l) });
    assert.equal((await getSolde(u.id)).jours_restants, 1);
  });
  test('retrait CET → congés', async () => {
    const rh = await createUser({ type: 'RH' });
    const u = await createUser();
    await db.execute({ sql: 'INSERT INTO cet (user_id, solde) VALUES (?, 10)', args: [u.id] });
    assert.equal((await demander(u, { jours: 4, type: 'debit' })).status, 200);
    assert.equal((await decider(rh, await lastCetId(), 'valider')).status, 200);
    assert.equal(await cetSolde(u.id), 6);
    assert.equal((await getSolde(u.id)).jours_restants, 29);
  });
  test('retrait supérieur au CET → 400', async () => {
    const u = await createUser();
    await db.execute({ sql: 'INSERT INTO cet (user_id, solde) VALUES (?, 2)', args: [u.id] });
    assert.equal((await demander(u, { jours: 3, type: 'debit' })).status, 400);
  });
  test('validation impossible si les jours ont été consommés entre-temps', async () => {
    const rh = await createUser({ type: 'RH' });
    const u = await eligible(); // 5 restants
    await demander(u, { jours: 3, type: 'credit' });
    await insertLeave(u.id, { debut: '2026-07-06', fin: '2026-07-09', jours: 4, statut: 'validee' });
    await recalculateBalance(u.id, 2026); // 1 restant
    assert.equal((await decider(rh, await lastCetId(), 'valider')).status, 400);
  });
  test('validation impossible si jours_restants stocké est périmé mais le vrai solde insuffisant', async () => {
    const rh = await createUser({ type: 'RH' });
    const u = await eligible(); // 5 restants
    await demander(u, { jours: 3, type: 'credit' });
    await insertLeave(u.id, { debut: '2026-07-06', fin: '2026-07-09', jours: 4, statut: 'validee' }); // pas de recalcul
    assert.equal((await decider(rh, await lastCetId(), 'valider')).status, 400);
  });
  test('double validation → 404 la seconde fois, pas de double crédit', async () => {
    const rh = await createUser({ type: 'RH' });
    const u = await eligible();
    await demander(u, { jours: 2, type: 'credit' });
    const id = await lastCetId();
    await decider(rh, id, 'valider');
    assert.equal((await decider(rh, id, 'valider')).status, 404);
    assert.equal(await cetSolde(u.id), 2);
  });
  test('refus : aucun mouvement', async () => {
    const rh = await createUser({ type: 'RH' });
    const u = await eligible();
    await demander(u, { jours: 2, type: 'credit' });
    assert.equal((await decider(rh, await lastCetId(), 'refuser')).status, 200);
    assert.equal(await cetSolde(u.id), 0);
    assert.equal((await getSolde(u.id)).jours_restants, 5);
  });
  test('réservé à la RH', async () => {
    const u = await eligible();
    await demander(u, { jours: 2, type: 'credit' });
    assert.equal((await decider(u, await lastCetId(), 'valider')).status, 403);
  });
});

describe('ajustement manuel du solde (RH)', () => {
  const ajuster = async (rh, u, body) => { asUser(rh); return call(adjust, body, { id: String(u.id) }); };

  test('+2 jours de congés', async () => {
    const rh = await createUser({ type: 'RH' });
    const u = await createUser();
    assert.equal((await ajuster(rh, u, { adjustment: 2, type: 'conges' })).status, 200);
    const s = await getSolde(u.id);
    assert.equal(s.jours_acquis, 27);
    assert.equal(s.jours_restants, 27);
  });
  test('+1 jour compensateur puis validation d\'un congé : l\'ajustement reste', async () => {
    const rh = await createUser({ type: 'RH' });
    const u = await createUser();
    await ajuster(rh, u, { adjustment: 1 });
    const l = await insertLeave(u.id, { debut: '2026-07-06', jours: 1 });
    asUser(rh);
    await call(statusPUT, { statut: 'validee' }, { id: String(l) });
    assert.equal((await getSolde(u.id)).jours_restants, 25);
  });
  test('ajustement sur un solde stocké périmé : le résultat est recalculé correctement', async () => {
    const rh = await createUser({ type: 'RH' });
    const u = await createUser({ solde: { restants: 3 } }); // devrait être 25
    await ajuster(rh, u, { adjustment: 1, type: 'conges' });
    assert.equal((await getSolde(u.id)).jours_restants, 26);
  });
  test('retrait qui rendrait le solde négatif → 400', async () => {
    const rh = await createUser({ type: 'RH' });
    const u = await createUser({ solde: { acquis: 2 } });
    assert.equal((await ajuster(rh, u, { adjustment: -3, type: 'conges' })).status, 400);
  });
  test('retrait refusé si le vrai solde est insuffisant même si jours_restants stocké est élevé', async () => {
    const rh = await createUser({ type: 'RH' });
    const u = await createUser({ solde: { acquis: 5, restants: 25 } });
    await insertLeave(u.id, { debut: '2026-07-06', fin: '2026-07-10', jours: 5, statut: 'validee' });
    assert.equal((await ajuster(rh, u, { adjustment: -2, type: 'conges' })).status, 400);
  });
  test('compensateurs négatifs : le surplus est pris sur les acquis', async () => {
    const rh = await createUser({ type: 'RH' });
    const u = await createUser({ solde: { compensateurs: 1 } });
    await ajuster(rh, u, { adjustment: -3 });
    const s = await getSolde(u.id);
    assert.equal(s.jours_compensateurs, 0);
    assert.equal(s.jours_acquis, 23);
    assert.equal(s.jours_restants, 23);
  });
  for (const [nom, adjustment] of [['0', 0], ['vide', null], ['texte', 'abc']]) {
    test(`ajustement ${nom} → 400`, async () => {
      const rh = await createUser({ type: 'RH' });
      const u = await createUser();
      assert.equal((await ajuster(rh, u, { adjustment, type: 'conges' })).status, 400);
    });
  }
  test('réservé à la RH', async () => {
    const u = await createUser();
    assert.equal((await ajuster(u, u, { adjustment: 5, type: 'conges' })).status, 403);
  });
});

describe('modification de la fiche agent', () => {
  const base = (u, extra = {}) => ({
    nom: u.nom, prenom: u.prenom, email: `${u.id}@test.local`, type_utilisateur: 'Agent', actif: true,
    type_contrat: 'CDI', date_debut_contrat: null, date_fin_contrat: null, quotite_travail: 100, ...extra,
  });
  const maj = async (rh, u, body) => { asUser(rh); return call(updateUser, body, { id: String(u.id) }); };

  test('passage à 80 % : acquis recalculés à 20', async () => {
    const rh = await createUser({ type: 'RH' });
    const u = await createUser();
    await db.execute({ sql: "UPDATE users SET type_contrat = 'CDI' WHERE id = ?", args: [u.id] });
    assert.equal((await maj(rh, u, base(u, { quotite_travail: 80 }))).status, 200);
    assert.equal((await getSolde(u.id)).jours_acquis, 20);
  });
  test('modifier seulement le service ne recalcule pas les acquis (ajustements manuels conservés)', async () => {
    const rh = await createUser({ type: 'RH' });
    const u = await createUser();
    await db.execute({ sql: "UPDATE users SET type_contrat = 'CDI' WHERE id = ?", args: [u.id] });
    await setSolde(u.id, { acquis: 27 }); // +2 accordés par la RH
    await maj(rh, u, base(u, { service: 'Technique' }));
    assert.equal((await getSolde(u.id)).jours_acquis, 27);
  });
  test('formulaire qui renvoie des dates vides ("") : pas de recalcul intempestif', async () => {
    const rh = await createUser({ type: 'RH' });
    const u = await createUser();
    await db.execute({ sql: "UPDATE users SET type_contrat = 'CDI' WHERE id = ?", args: [u.id] });
    await setSolde(u.id, { acquis: 27 });
    await maj(rh, u, base(u, { date_debut_contrat: '', date_fin_contrat: '' }));
    assert.equal((await getSolde(u.id)).jours_acquis, 27);
  });
  test('quotité envoyée en texte ("100") : pas de recalcul intempestif', async () => {
    const rh = await createUser({ type: 'RH' });
    const u = await createUser();
    await db.execute({ sql: "UPDATE users SET type_contrat = 'CDI' WHERE id = ?", args: [u.id] });
    await setSolde(u.id, { acquis: 27 });
    await maj(rh, u, base(u, { quotite_travail: '100' }));
    assert.equal((await getSolde(u.id)).jours_acquis, 27);
  });
  test('après recalcul, jours_restants reste cohérent avec les congés pris', async () => {
    const rh = await createUser({ type: 'RH' });
    const u = await createUser();
    await db.execute({ sql: "UPDATE users SET type_contrat = 'CDI' WHERE id = ?", args: [u.id] });
    await insertLeave(u.id, { debut: '2026-07-06', fin: '2026-07-10', jours: 5, statut: 'validee' });
    await maj(rh, u, base(u, { quotite_travail: 50 }));
    assert.equal((await getSolde(u.id)).jours_restants, 12.5 - 5);
  });
  test('champs obligatoires manquants → 400', async () => {
    const rh = await createUser({ type: 'RH' });
    const u = await createUser();
    assert.equal((await maj(rh, u, { nom: 'X' })).status, 400);
  });
  test('CDD sans dates → 400', async () => {
    const rh = await createUser({ type: 'RH' });
    const u = await createUser();
    assert.equal((await maj(rh, u, base(u, { type_contrat: 'CDD' }))).status, 400);
  });
  test('réservé à la RH', async () => {
    const u = await createUser();
    assert.equal((await maj(u, u, base(u))).status, 403);
  });
});
