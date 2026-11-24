// Parcours de validation à N étapes + administration de la pyramide (/api/hierarchie)
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db, resetDb, createUser, getSolde, insertLeave, getLeave, call, asUser, setCurrentUser } from '../setup/fixtures.mjs';
import { PUT as statusPUT } from '../../src/app/api/leaves/[id]/status/route.js';
import { GET as pendingGET } from '../../src/app/api/leaves/pending-validation/route.js';
import { GET as hierarchieGET, PUT as hierarchiePUT } from '../../src/app/api/hierarchie/route.js';
import { getValidationCircuit } from '../../src/lib/hierarchy.js';

beforeEach(resetDb);

const decide = (validator, leaveId, statut, extra = {}) => {
  asUser(validator);
  return call(statusPUT, { statut, ...extra }, { id: String(leaveId) });
};
const pendingFor = async (u) => {
  asUser(u);
  const r = await call(pendingGET);
  return r.body.leaves.map((l) => l.id);
};
const saveHierarchy = (rh, payload) => {
  asUser(rh);
  return call(hierarchiePUT, payload);
};
const niveau = async (id) =>
  Number((await db.execute({ sql: 'SELECT niveau_validation FROM users WHERE id = ?', args: [id] })).rows[0].niveau_validation);

/** RH ← directeur ← chef de service ← chef d'équipe ← agent : 3 étapes avant la RH */
async function orga3() {
  const rh = await createUser({ type: 'RH' });
  const dir = await createUser({ type: 'Directeur Vie Locale', niveau_validation: 2, responsable_id: rh.id });
  const chefService = await createUser({ type: 'Responsable', niveau_validation: 1, responsable_id: dir.id });
  const chefEquipe = await createUser({ type: 'Responsable Anim.', niveau_validation: 1, responsable_id: chefService.id });
  const agent = await createUser({ responsable_id: chefEquipe.id });
  return { rh, dir, chefService, chefEquipe, agent };
}

describe('parcours à plus de 2 étapes', () => {
  test('le circuit remonte toute la chaîne jusqu\'à la RH', async () => {
    const { agent, chefEquipe, chefService, dir } = await orga3();
    const c = await getValidationCircuit(agent.id);
    assert.deepEqual(c.niveaux.map((n) => n.validateur_id ?? 'rh'), [chefEquipe.id, chefService.id, dir.id, 'rh']);
  });

  test('N1 → N2 → N3 → RH, dans l\'ordre, avec historique', async () => {
    const { rh, dir, chefService, chefEquipe, agent } = await orga3();
    const id = await insertLeave(agent.id, { debut: '2026-06-08', fin: '2026-06-12', jours: 5 });

    // Le N3 ne peut pas sauter les étapes
    assert.equal((await decide(dir, id, 'validee')).status, 403);

    let r = await decide(chefEquipe, id, 'validee');
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.nextLevel, 2);

    r = await decide(chefService, id, 'validee');
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.nextLevel, 3);

    assert.equal((await decide(rh, id, 'validee')).status, 403, 'la RH attend le N3');

    r = await decide(dir, id, 'validee');
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.nextLevel, 'rh');

    r = await decide(rh, id, 'validee');
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.isFinal, true);

    const leave = await getLeave(id);
    assert.equal(leave.statut, 'validee');
    assert.equal(Number(leave.niveau_valide), 3);
    assert.equal(leave.statut_niveau_1, 'validee', 'colonnes historiques toujours alimentées');
    assert.equal(leave.statut_niveau_2, 'validee');
    assert.equal((await getSolde(agent.id)).jours_restants, 20);

    const hist = await db.execute({ sql: 'SELECT niveau, validateur_id FROM validations_etapes WHERE demande_id = ? ORDER BY niveau', args: [id] });
    assert.deepEqual(hist.rows.map((h) => [Number(h.niveau), Number(h.validateur_id)]), [[1, chefEquipe.id], [2, chefService.id], [3, dir.id]]);
  });

  test('le validateur suivant est notifié', async () => {
    const { chefEquipe, chefService, agent } = await orga3();
    const id = await insertLeave(agent.id, { debut: '2026-06-08', jours: 1 });
    globalThis.__sentPushes?.splice(0);
    await decide(chefEquipe, id, 'validee');
    assert.ok(
      (globalThis.__sentPushes || []).some((p) => p.kind === 'user' && Number(p.args[0]) === chefService.id),
      `push au N2 attendu, reçu : ${JSON.stringify(globalThis.__sentPushes)}`
    );
  });

  test('chaque validateur ne voit la demande qu\'à son tour', async () => {
    const { rh, dir, chefService, chefEquipe, agent } = await orga3();
    const id = await insertLeave(agent.id, { debut: '2026-06-08', jours: 1 });

    assert.deepEqual(await pendingFor(chefEquipe), [id]);
    assert.deepEqual(await pendingFor(chefService), []);
    assert.deepEqual(await pendingFor(dir), []);
    assert.deepEqual(await pendingFor(rh), []);

    await decide(chefEquipe, id, 'validee');
    await decide(chefService, id, 'validee');
    assert.deepEqual(await pendingFor(chefService), []);
    assert.deepEqual(await pendingFor(dir), [id]);

    asUser(dir);
    const r = await call(pendingGET);
    const etapes = r.body.leaves[0].circuit_etapes;
    assert.deepEqual(etapes.map((e) => e.statut), ['validee', 'validee', 'en_cours']);
  });

  test('validation forcée RH : toutes les étapes restantes sont marquées', async () => {
    const { rh, chefEquipe, agent } = await orga3();
    const id = await insertLeave(agent.id, { debut: '2026-06-08', jours: 1 });
    await decide(chefEquipe, id, 'validee');
    const r = await decide(rh, id, 'validee', { force_rh: true });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const leave = await getLeave(id);
    assert.equal(leave.statut, 'validee');
    assert.equal(Number(leave.niveau_valide), 3);
  });
});

describe('échelons', () => {
  test('un échelon « hors parcours » est sauté', async () => {
    const { agent, chefEquipe, chefService, dir } = await orga3();
    const e = await db.execute({ sql: "INSERT INTO echelons (nom, ordre, valide) VALUES ('Chefs de service', 1, 0)", args: [] });
    await db.execute({ sql: 'UPDATE users SET echelon_id = ? WHERE id = ?', args: [Number(e.lastInsertRowid), chefService.id] });
    const c = await getValidationCircuit(agent.id);
    assert.deepEqual(c.niveaux.map((n) => n.validateur_id ?? 'rh'), [chefEquipe.id, dir.id, 'rh']);
  });

  test('un responsable inactif est sauté', async () => {
    const { agent, chefEquipe, chefService, dir } = await orga3();
    await db.execute({ sql: 'UPDATE users SET actif = 0 WHERE id = ?', args: [chefService.id] });
    const c = await getValidationCircuit(agent.id);
    assert.deepEqual(c.niveaux.map((n) => n.validateur_id ?? 'rh'), [chefEquipe.id, dir.id, 'rh']);
  });
});

describe('API /api/hierarchie', () => {
  test('réservée à la RH', async () => {
    const { agent } = await orga3();
    asUser(agent);
    assert.equal((await call(hierarchieGET)).status, 403);
    assert.equal((await call(hierarchiePUT, { echelons: [], assignments: [] })).status, 403);
    setCurrentUser(null);
    assert.equal((await call(hierarchieGET)).status, 403);
  });

  test('crée des échelons, range les agents et synchronise l\'onglet Validation', async () => {
    const { rh, dir, chefService, chefEquipe, agent } = await orga3();
    const r = await saveHierarchy(rh, {
      echelons: [
        { id: 'new-a', nom: 'Direction', valide: true },
        { id: 'new-b', nom: 'Chefs de service', valide: true },
        { id: 'new-c', nom: "Chefs d'équipe", valide: true },
      ],
      assignments: [
        { id: dir.id, responsable_id: rh.id, echelon_id: 'new-a' },
        { id: chefService.id, responsable_id: dir.id, echelon_id: 'new-b' },
        { id: chefEquipe.id, responsable_id: chefService.id, echelon_id: 'new-c' },
        { id: agent.id, responsable_id: chefEquipe.id, echelon_id: null },
      ],
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));

    asUser(rh);
    const g = await call(hierarchieGET);
    assert.deepEqual(g.body.echelons.map((e) => e.nom), ['Direction', 'Chefs de service', "Chefs d'équipe"]);
    const byId = Object.fromEntries(g.body.users.map((u) => [u.id, u]));
    const ids = g.body.echelons.map((e) => e.id);
    assert.equal(byId[dir.id].echelon_id, ids[0]);
    assert.equal(byId[chefEquipe.id].echelon_id, ids[2]);

    // Le directeur est N3 pour l'agent : il doit avoir accès à l'onglet Validation
    assert.equal(await niveau(dir.id), 3);
    assert.equal(await niveau(agent.id), 0);
  });

  test('retirer un échelon du parcours retire l\'étape et l\'accès Validation', async () => {
    const { rh, dir, chefService, chefEquipe, agent } = await orga3();
    await saveHierarchy(rh, {
      echelons: [{ id: 'new-a', nom: 'Chefs de service', valide: false }],
      assignments: [{ id: chefService.id, responsable_id: dir.id, echelon_id: 'new-a' }],
    });
    const c = await getValidationCircuit(agent.id);
    assert.deepEqual(c.niveaux.map((n) => n.validateur_id ?? 'rh'), [chefEquipe.id, dir.id, 'rh']);
    assert.equal(await niveau(chefService.id), 0);
    assert.equal(await niveau(dir.id), 2);
  });

  test('supprimer un échelon libère ses membres', async () => {
    const { rh, chefService, dir } = await orga3();
    await saveHierarchy(rh, {
      echelons: [{ id: 'new-a', nom: 'Temporaire', valide: true }],
      assignments: [{ id: chefService.id, responsable_id: dir.id, echelon_id: 'new-a' }],
    });
    const r = await saveHierarchy(rh, { echelons: [], assignments: [] });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal((await db.execute('SELECT COUNT(*) AS n FROM echelons')).rows[0].n, 0);
    const u = await db.execute({ sql: 'SELECT echelon_id FROM users WHERE id = ?', args: [chefService.id] });
    assert.equal(u.rows[0].echelon_id, null);
  });

  test('refuse une boucle hiérarchique', async () => {
    const { rh, dir, agent } = await orga3();
    const r = await saveHierarchy(rh, {
      echelons: [],
      assignments: [{ id: dir.id, responsable_id: agent.id, echelon_id: null }],
    });
    assert.equal(r.status, 400);
    assert.match(r.body.message, /Boucle/);
    // Rien n'a été écrit
    const u = await db.execute({ sql: 'SELECT responsable_id FROM users WHERE id = ?', args: [dir.id] });
    assert.equal(Number(u.rows[0].responsable_id), rh.id);
  });

  test('refuse d\'être son propre responsable, un échelon inconnu ou un nom vide', async () => {
    const { rh, agent } = await orga3();
    assert.equal((await saveHierarchy(rh, { echelons: [], assignments: [{ id: agent.id, responsable_id: agent.id }] })).status, 400);
    assert.equal((await saveHierarchy(rh, { echelons: [], assignments: [{ id: agent.id, responsable_id: null, echelon_id: 'new-x' }] })).status, 400);
    assert.equal((await saveHierarchy(rh, { echelons: [{ id: 'new-a', nom: '   ' }], assignments: [] })).status, 400);
  });

  test('signale les demandes en cours dont le parcours change, sans perdre les étapes validées', async () => {
    const { rh, dir, chefService, chefEquipe, agent } = await orga3();
    const id = await insertLeave(agent.id, { debut: '2026-06-08', jours: 1 });
    await decide(chefEquipe, id, 'validee');

    // Le chef de service quitte le parcours : la demande passe directement au directeur
    const r = await saveHierarchy(rh, {
      echelons: [],
      assignments: [{ id: chefEquipe.id, responsable_id: dir.id, echelon_id: null }],
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.impactedAgents, 1);

    assert.deepEqual(await pendingFor(chefService), []);
    assert.deepEqual(await pendingFor(dir), [id]);
    assert.equal((await decide(dir, id, 'validee')).body.nextLevel, 'rh');
  });
});
