// Circuit de validation (N1 → N2 → RH), validation forcée RH, annulation
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, createUser, getSolde, insertLeave, getLeave, call, asUser, setCurrentUser } from '../setup/fixtures.mjs';
import { PUT as statusPUT } from '../../src/app/api/leaves/[id]/status/route.js';
import { PUT as cancelPUT } from '../../src/app/api/leaves/[id]/cancel/route.js';
import { POST as rhCreate } from '../../src/app/api/leaves/rh-create/route.js';
import { getValidationCircuit } from '../../src/lib/hierarchy.js';

beforeEach(resetDb);

const decide = (validator, leaveId, statut, extra = {}) => {
  asUser(validator);
  return call(statusPUT, { statut, ...extra }, { id: String(leaveId) });
};
const cancel = (rh, leaveId, motif) => {
  asUser(rh);
  return call(cancelPUT, { motif }, { id: String(leaveId) });
};

/** Organisation type : RH, directeur (N2) → chef (N1) → agent */
async function orga({ solde = {} } = {}) {
  const rh = await createUser({ type: 'RH' });
  const dir = await createUser({ type: 'Directeur Vie Locale', niveau_validation: 2, responsable_id: rh.id });
  const chef = await createUser({ type: 'Responsable Anim.', niveau_validation: 1, responsable_id: dir.id });
  const agent = await createUser({ responsable_id: chef.id, solde });
  return { rh, dir, chef, agent };
}

describe('getValidationCircuit', () => {
  test('agent sans responsable : RH seule', async () => {
    const a = await createUser();
    assert.deepEqual((await getValidationCircuit(a.id)).niveaux.map(n => n.type), ['rh']);
  });
  test('responsable RH : RH seule (pas de niveau intermédiaire)', async () => {
    const rh = await createUser({ type: 'RH' });
    const a = await createUser({ responsable_id: rh.id });
    assert.deepEqual((await getValidationCircuit(a.id)).niveaux.map(n => n.type), ['rh']);
  });
  test('chef + directeur : N1, N2, RH', async () => {
    const { agent } = await orga();
    assert.deepEqual((await getValidationCircuit(agent.id)).niveaux.map(n => n.type), ['responsable_direct', 'responsable_hierarchique', 'rh']);
  });
  test('chef dont le responsable est la Direction : N1, RH', async () => {
    const dg = await createUser({ type: 'DG' });
    const chef = await createUser({ type: 'Responsable Anim.', niveau_validation: 1, responsable_id: dg.id });
    const a = await createUser({ responsable_id: chef.id });
    assert.deepEqual((await getValidationCircuit(a.id)).niveaux.map(n => n.type), ['responsable_direct', 'rh']);
  });
  test('responsable supprimé (id orphelin) : ne plante pas', async () => {
    const a = await createUser({ responsable_id: 99999 });
    const c = await getValidationCircuit(a.id);
    assert.equal(c.niveaux.at(-1).type, 'rh');
  });
  test('utilisateur inexistant : erreur explicite', async () => {
    await assert.rejects(getValidationCircuit(424242), /non trouvé/);
  });
});

describe('circuit complet N1 → N2 → RH', () => {
  test('ordre respecté : le solde n\'est débité qu\'à la validation RH', async () => {
    const { rh, dir, chef, agent } = await orga();
    const id = await insertLeave(agent.id, { debut: '2026-06-08', fin: '2026-06-12', jours: 5 });

    let r = await decide(chef, id, 'validee');
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.nextLevel, 2);
    assert.equal((await getSolde(agent.id)).jours_restants, 25);

    r = await decide(dir, id, 'validee');
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.nextLevel, 'rh');

    r = await decide(rh, id, 'validee');
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.isFinal, true);
    const leave = await getLeave(id);
    assert.equal(leave.statut, 'validee');
    assert.equal((await getSolde(agent.id)).jours_restants, 20);
    assert.ok(globalThis.__sentEmails.some(e => e.kind === 'approved'));
  });

  test('la RH ne peut pas valider avant N1', async () => {
    const { rh, agent } = await orga();
    const id = await insertLeave(agent.id, { debut: '2026-03-09', jours: 1 });
    const r = await decide(rh, id, 'validee');
    assert.equal(r.status, 403);
    assert.equal((await getLeave(id)).statut, 'en_attente');
  });
  test('le N2 ne peut pas valider avant le N1', async () => {
    const { dir, agent } = await orga();
    const id = await insertLeave(agent.id, { debut: '2026-03-09', jours: 1 });
    assert.equal((await decide(dir, id, 'validee')).status, 403);
  });
  test('un agent quelconque ne peut pas valider', async () => {
    const { agent } = await orga();
    const intrus = await createUser();
    const id = await insertLeave(agent.id, { debut: '2026-03-09', jours: 1 });
    assert.equal((await decide(intrus, id, 'validee')).status, 403);
  });
  test("l'agent ne peut pas valider sa propre demande", async () => {
    const { agent } = await orga();
    const id = await insertLeave(agent.id, { debut: '2026-03-09', jours: 1 });
    assert.equal((await decide(agent, id, 'validee')).status, 403);
  });
  test('le N1 ne peut pas valider deux fois', async () => {
    const { chef, agent } = await orga();
    const id = await insertLeave(agent.id, { debut: '2026-03-09', jours: 1 });
    await decide(chef, id, 'validee');
    assert.equal((await decide(chef, id, 'validee')).status, 403);
  });
  test('refus au niveau N1 : définitif, solde intact', async () => {
    const { rh, chef, agent } = await orga();
    const id = await insertLeave(agent.id, { debut: '2026-03-09', jours: 1 });
    const r = await decide(chef, id, 'refusee', { commentaire_rh: 'Service chargé' });
    assert.equal(r.status, 200);
    assert.equal((await getLeave(id)).statut, 'refusee');
    assert.equal((await decide(rh, id, 'validee')).status, 400, 'une demande refusée ne peut plus être validée');
    assert.equal((await getSolde(agent.id)).jours_restants, 25);
  });
  test('statut invalide → 400', async () => {
    const { rh, agent } = await orga();
    const id = await insertLeave(agent.id, { debut: '2026-03-09', jours: 1 });
    assert.equal((await decide(rh, id, 'annulee')).status, 400);
    assert.equal((await decide(rh, id, 'n_importe_quoi')).status, 400);
  });
  test('demande inexistante → 404', async () => {
    const { rh } = await orga();
    assert.equal((await decide(rh, 999999, 'validee')).status, 404);
  });
  test('non connecté → 401', async () => {
    setCurrentUser(null);
    assert.equal((await call(statusPUT, { statut: 'validee' }, { id: '1' })).status, 401);
  });
});

describe('contrôle du solde à la validation finale', () => {
  test('validation bloquée si le solde ne couvre plus la demande', async () => {
    const rh = await createUser({ type: 'RH' });
    const a = await createUser({ solde: { acquis: 6 } });
    const d1 = await insertLeave(a.id, { debut: '2026-06-08', fin: '2026-06-12', jours: 5 });
    const d2 = await insertLeave(a.id, { debut: '2026-06-15', fin: '2026-06-16', jours: 2 });
    assert.equal((await decide(rh, d1, 'validee')).status, 200);
    const r = await decide(rh, d2, 'validee');
    assert.equal(r.status, 403);
    assert.match(r.body.message, /Solde insuffisant/);
    assert.equal((await getLeave(d2)).statut, 'en_attente');
    assert.equal((await getSolde(a.id)).jours_restants, 1);
  });
  test('la refuser reste possible', async () => {
    const rh = await createUser({ type: 'RH' });
    const a = await createUser({ solde: { acquis: 0 } });
    const d = await insertLeave(a.id, { debut: '2026-03-09', jours: 1 });
    assert.equal((await decide(rh, d, 'refusee')).status, 200);
  });
  test('solde exact : validation acceptée, solde à 0', async () => {
    const rh = await createUser({ type: 'RH' });
    const a = await createUser({ solde: { acquis: 5 } });
    const d = await insertLeave(a.id, { debut: '2026-06-08', fin: '2026-06-12', jours: 5 });
    assert.equal((await decide(rh, d, 'validee')).status, 200);
    assert.equal((await getSolde(a.id)).jours_restants, 0);
  });
  test('validation forcée RH : bloquée aussi, sans écrire les niveaux intermédiaires', async () => {
    const { rh, agent } = await orga({ solde: { acquis: 1 } });
    const id = await insertLeave(agent.id, { debut: '2026-03-09', fin: '2026-03-10', jours: 2 });
    const r = await decide(rh, id, 'validee', { force_rh: true });
    assert.equal(r.status, 403);
    const leave = await getLeave(id);
    assert.equal(leave.statut, 'en_attente');
    assert.notEqual(leave.statut_niveau_1, 'validee', 'aucune écriture partielle');
  });
  test('scénario du compte à -5 : 26 j de droits, 31 j demandés', async () => {
    const rh = await createUser({ type: 'RH' });
    const a = await createUser({ solde: { acquis: 25, fractionnement: 1 } });
    const ids = [
      await insertLeave(a.id, { debut: '2026-04-27', fin: '2026-04-30', jours: 4 }),
      await insertLeave(a.id, { debut: '2026-07-27', fin: '2026-08-14', jours: 15 }),
      await insertLeave(a.id, { debut: '2026-05-15', jours: 1 }),
      await insertLeave(a.id, { debut: '2026-07-06', fin: '2026-07-10', jours: 5 }),
      await insertLeave(a.id, { debut: '2026-07-13', jours: 1 }),
      await insertLeave(a.id, { debut: '2026-10-26', fin: '2026-10-30', jours: 5 }),
    ];
    for (const id of ids) await decide(rh, id, 'validee');
    const s = await getSolde(a.id);
    assert.ok(s.jours_restants >= 0, `solde final ${s.jours_restants}`);
  });
  test('congé de l\'année suivante : non imputé sur le solde de l\'année en cours', async () => {
    const rh = await createUser({ type: 'RH' });
    const a = await createUser({ solde: { acquis: 0 } });
    const d = await insertLeave(a.id, { debut: '2027-01-11', jours: 1 });
    assert.equal((await decide(rh, d, 'validee')).status, 200);
    assert.equal((await getSolde(a.id)).jours_restants, 0);
  });
});

describe('validation forcée par la RH (responsable absent)', () => {
  test('saute N1 et N2', async () => {
    const { rh, agent } = await orga();
    const id = await insertLeave(agent.id, { debut: '2026-03-09', jours: 1 });
    const r = await decide(rh, id, 'validee', { force_rh: true });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const leave = await getLeave(id);
    assert.equal(leave.statut, 'validee');
    assert.equal(leave.statut_niveau_1, 'validee');
    assert.equal(leave.statut_niveau_2, 'validee');
    assert.match(leave.commentaire_rh, /Validation directe/);
    assert.equal((await getSolde(agent.id)).jours_restants, 24);
  });
  test('interdite à un non-RH', async () => {
    const { chef, agent } = await orga();
    const id = await insertLeave(agent.id, { debut: '2026-03-09', jours: 1 });
    assert.equal((await decide(chef, id, 'validee', { force_rh: true })).status, 403);
  });
  test('refus forcé', async () => {
    const { rh, agent } = await orga();
    const id = await insertLeave(agent.id, { debut: '2026-03-09', jours: 1 });
    assert.equal((await decide(rh, id, 'refusee', { force_rh: true })).status, 200);
    assert.equal((await getLeave(id)).statut, 'refusee');
  });
});

describe('annulation par la RH', () => {
  test('annuler un congé validé recrédite le solde et le fractionnement', async () => {
    const rh = await createUser({ type: 'RH' });
    const a = await createUser();
    const d = await insertLeave(a.id, { debut: '2026-03-09', fin: '2026-03-16', jours: 6 });
    await decide(rh, d, 'validee');
    let s = await getSolde(a.id);
    assert.equal(s.jours_fractionnement, 2);
    assert.equal(s.jours_restants, 25 + 2 - 6);

    assert.equal((await cancel(rh, d, 'Erreur de saisie')).status, 200);
    s = await getSolde(a.id);
    assert.equal(s.jours_fractionnement, 0);
    assert.equal(s.jours_restants, 25);
    assert.equal((await getLeave(d)).statut, 'annulee');
  });
  test('annuler deux fois → 400, solde inchangé', async () => {
    const rh = await createUser({ type: 'RH' });
    const a = await createUser();
    const d = await insertLeave(a.id, { debut: '2026-03-09', jours: 1 });
    await decide(rh, d, 'validee');
    await cancel(rh, d);
    assert.equal((await cancel(rh, d)).status, 400);
    assert.equal((await getSolde(a.id)).jours_restants, 25);
  });
  test('annuler une demande en attente ne touche pas le solde', async () => {
    const rh = await createUser({ type: 'RH' });
    const a = await createUser({ solde: { restants: 25 } });
    const d = await insertLeave(a.id, { debut: '2026-03-09', jours: 1 });
    assert.equal((await cancel(rh, d)).status, 200);
    assert.equal((await getSolde(a.id)).jours_restants, 25);
  });
  test('une demande annulée ne peut plus être validée', async () => {
    const rh = await createUser({ type: 'RH' });
    const a = await createUser();
    const d = await insertLeave(a.id, { debut: '2026-03-09', jours: 1 });
    await cancel(rh, d);
    assert.equal((await decide(rh, d, 'validee')).status, 400);
    assert.equal((await getSolde(a.id)).jours_restants, 25);
  });
  test('réservée à la RH', async () => {
    const a = await createUser();
    const d = await insertLeave(a.id, { debut: '2026-03-09', jours: 1, statut: 'validee' });
    assert.equal((await cancel(a, d)).status, 403);
  });
  test('demande inexistante → 404', async () => {
    const rh = await createUser({ type: 'RH' });
    assert.equal((await cancel(rh, 987654)).status, 404);
  });
});

describe('création directe par la RH (rh-create)', () => {
  const create = (rh, body) => { asUser(rh); return call(rhCreate, body); };
  test('crée un congé validé et débite le solde', async () => {
    const rh = await createUser({ type: 'RH' });
    const a = await createUser();
    const r = await create(rh, { user_id: a.id, date_debut: '2026-06-08', date_fin: '2026-06-12' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal((await getSolde(a.id)).jours_restants, 20);
  });
  test('pas de règle des 7 jours pour la RH (saisie a posteriori)', async () => {
    const rh = await createUser({ type: 'RH' });
    const a = await createUser();
    assert.equal((await create(rh, { user_id: a.id, date_debut: '2026-02-23', date_fin: '2026-02-23' })).status, 201);
  });
  test('solde insuffisant → 400', async () => {
    const rh = await createUser({ type: 'RH' });
    const a = await createUser({ solde: { acquis: 2 } });
    assert.equal((await create(rh, { user_id: a.id, date_debut: '2026-03-09', date_fin: '2026-03-13' })).status, 400);
  });
  test('solde stocké périmé ne permet pas de dépasser', async () => {
    const rh = await createUser({ type: 'RH' });
    const a = await createUser({ solde: { acquis: 5, restants: 25 } });
    await insertLeave(a.id, { debut: '2026-03-30', fin: '2026-04-03', jours: 5, statut: 'validee' });
    assert.equal((await create(rh, { user_id: a.id, date_debut: '2026-03-09', date_fin: '2026-03-09' })).status, 400);
  });
  test('chevauche un congé validé → 400', async () => {
    const rh = await createUser({ type: 'RH' });
    const a = await createUser();
    await insertLeave(a.id, { debut: '2026-03-10', jours: 1, statut: 'validee' });
    assert.equal((await create(rh, { user_id: a.id, date_debut: '2026-03-09', date_fin: '2026-03-13' })).status, 400);
  });
  test('demi-journée', async () => {
    const rh = await createUser({ type: 'RH' });
    const a = await createUser();
    await create(rh, { user_id: a.id, date_debut: '2026-03-09', date_fin: '2026-03-09', type_debut: 'matin', type_fin: 'matin' });
    assert.equal((await getSolde(a.id)).jours_restants, 24.5);
  });
  test('réservé à la RH', async () => {
    const a = await createUser();
    assert.equal((await create(a, { user_id: a.id, date_debut: '2026-03-09', date_fin: '2026-03-09' })).status, 403);
  });
  test('champs manquants / dates inversées → 400', async () => {
    const rh = await createUser({ type: 'RH' });
    const a = await createUser();
    assert.equal((await create(rh, { user_id: a.id, date_debut: '2026-03-09' })).status, 400);
    assert.equal((await create(rh, { user_id: a.id, date_debut: '2026-03-13', date_fin: '2026-03-09' })).status, 400);
  });
  test('dates invalides → 400 (pas 500)', async () => {
    const rh = await createUser({ type: 'RH' });
    const a = await createUser();
    const r = await create(rh, { user_id: a.id, date_debut: 'xx', date_fin: 'yy' });
    assert.equal(r.status, 400, JSON.stringify(r.body));
  });
  test('agent inexistant → 404 (pas de solde fantôme créé)', async () => {
    const rh = await createUser({ type: 'RH' });
    const r = await create(rh, { user_id: 777777, date_debut: '2026-03-09', date_fin: '2026-03-09' });
    assert.equal(r.status, 404, JSON.stringify(r.body));
  });
});

describe('chevauchement détecté à la validation', () => {
  test('demande en attente + congé saisi par la RH sur la même période : la validation est bloquée', async () => {
    const rh = await createUser({ type: 'RH' });
    const a = await createUser();
    const pending = await insertLeave(a.id, { debut: '2026-06-08', fin: '2026-06-12', jours: 5 });
    asUser(rh);
    assert.equal((await call(rhCreate, { user_id: a.id, date_debut: '2026-06-10', date_fin: '2026-06-10' })).status, 201);
    const r = await decide(rh, pending, 'validee');
    assert.equal(r.status, 403);
    assert.match(r.body.message, /déjà validé/);
    assert.equal((await getSolde(a.id)).jours_restants, 24);
  });
  test('validation forcée : bloquée aussi', async () => {
    const { rh, agent } = await orga();
    const pending = await insertLeave(agent.id, { debut: '2026-06-08', fin: '2026-06-12', jours: 5 });
    await insertLeave(agent.id, { debut: '2026-06-12', jours: 1, statut: 'validee' });
    assert.equal((await decide(rh, pending, 'validee', { force_rh: true })).status, 403);
  });
});

import { POST as recalcAll } from '../../src/app/api/balance/recalculate/route.js';
describe('bouton « Recalculer les soldes » (RH)', () => {
  test('corrige tous les soldes incohérents', async () => {
    const rh = await createUser({ type: 'RH' });
    const a = await createUser({ solde: { restants: 99, pris: 7 } });
    const b = await createUser({ solde: { restants: -5 } });
    await insertLeave(a.id, { debut: '2026-03-09', fin: '2026-03-16', jours: 6, statut: 'validee' });
    asUser(rh);
    const r = await call(recalcAll, {});
    assert.equal(r.status, 200);
    assert.equal(r.body.corrected, 3);
    const sa = await getSolde(a.id);
    assert.equal(sa.jours_pris, 6);
    assert.equal(sa.jours_fractionnement, 2);
    assert.equal(sa.jours_restants, 21);
    assert.equal((await getSolde(b.id)).jours_restants, 25);
  });
  test('réservé à la RH', async () => {
    const a = await createUser();
    asUser(a);
    assert.equal((await call(recalcAll, {})).status, 403);
  });
});
