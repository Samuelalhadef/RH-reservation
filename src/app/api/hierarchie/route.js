import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRH } from '@/lib/auth';
import { invalidateLoginUsers } from '@/lib/loginUsers';
import { loadHierarchyContext, syncNiveauxValidation } from '@/lib/hierarchy';
import { buildHierarchyContext, computeIntermediateSteps, isAncestor } from '@/lib/circuit';

const PENDING_TABLES = ['demandes_conges', 'demandes_recuperation', 'demandes_utilisation_recup'];

/**
 * GET /api/hierarchie
 * Échelons + agents actifs, pour la pyramide de l'interface RH.
 */
export async function GET() {
  const { authorized } = await requireRH();
  if (!authorized) {
    return NextResponse.json({ success: false, message: 'Accès refusé' }, { status: 403 });
  }

  try {
    const [usersRes, echelonsRes] = await Promise.all([
      db.execute(`
        SELECT id, nom, prenom, poste, service, type_utilisateur, responsable_id, echelon_id
        FROM users
        WHERE actif = 1
        ORDER BY nom, prenom
      `),
      db.execute('SELECT id, nom, ordre, valide FROM echelons ORDER BY ordre, id'),
    ]);

    return NextResponse.json({
      success: true,
      users: usersRes.rows,
      echelons: echelonsRes.rows.map((e) => ({ ...e, valide: Boolean(Number(e.valide)) })),
    });
  } catch (error) {
    console.error('Error fetching hierarchy:', error);
    return NextResponse.json({ success: false, message: 'Erreur lors du chargement de la hiérarchie' }, { status: 500 });
  }
}

/**
 * PUT /api/hierarchie
 * Enregistre toute la pyramide en une fois.
 * Body : {
 *   echelons: [{ id: number | 'new-…', nom, valide }]   // du haut (sous la RH) vers le bas
 *   assignments: [{ id, responsable_id, echelon_id }]  // echelon_id peut référencer un 'new-…'
 * }
 */
export async function PUT(request) {
  const { authorized } = await requireRH();
  if (!authorized) {
    return NextResponse.json({ success: false, message: 'Accès refusé' }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Requête invalide' }, { status: 400 });
  }

  const echelons = Array.isArray(body.echelons) ? body.echelons : [];
  const assignments = Array.isArray(body.assignments) ? body.assignments : [];

  try {
    // ---------- Validation ----------
    for (const e of echelons) {
      const nom = String(e.nom || '').trim();
      if (!nom) return badRequest('Chaque échelon doit avoir un nom');
      if (nom.length > 60) return badRequest(`Nom d'échelon trop long : « ${nom.slice(0, 20)}… »`);
    }
    const echelonKeys = new Set(echelons.map((e) => String(e.id)));

    const ctxBefore = await loadHierarchyContext();
    const existingEchelonIds = new Set([...ctxBefore.echelons.keys()].map(Number));

    for (const e of echelons) {
      if (typeof e.id === 'number' && !existingEchelonIds.has(e.id)) {
        return badRequest('Un échelon a été supprimé entre-temps, rechargez la page');
      }
    }

    // Hiérarchie cible = actuelle + modifications envoyées
    const targetUsers = [...ctxBefore.users.values()].map((u) => ({ ...u }));
    const byId = new Map(targetUsers.map((u) => [u.id, u]));
    for (const a of assignments) {
      const user = byId.get(Number(a.id));
      if (!user) return badRequest(`Agent introuvable (id ${a.id})`);
      const respId = a.responsable_id == null || a.responsable_id === '' ? null : Number(a.responsable_id);
      if (respId != null) {
        if (respId === user.id) return badRequest(`${user.prenom} ${user.nom} ne peut pas être son propre responsable`);
        if (!byId.has(respId)) return badRequest(`Responsable introuvable pour ${user.prenom} ${user.nom}`);
      }
      if (a.echelon_id != null && !echelonKeys.has(String(a.echelon_id))) {
        return badRequest(`Échelon inconnu pour ${user.prenom} ${user.nom}`);
      }
      user.responsable_id = respId;
      user.echelon_id = a.echelon_id ?? null;
    }

    const ctxTarget = buildHierarchyContext(targetUsers, []);
    for (const u of targetUsers) {
      if (u.responsable_id != null && isAncestor(u.id, u.responsable_id, ctxTarget)) {
        return badRequest(`Boucle hiérarchique détectée autour de ${u.prenom} ${u.nom}`);
      }
    }

    // Parcours actuels des agents ayant une demande en cours (pour signaler l'impact)
    const pendingUserIds = await loadPendingUserIds();
    const circuitKey = (ctx, id) => {
      try {
        return computeIntermediateSteps(id, ctx).map((s) => s.validateur_id).join('>');
      } catch {
        return '';
      }
    };
    const before = new Map([...pendingUserIds].map((id) => [id, circuitKey(ctxBefore, id)]));

    // ---------- Échelons ----------
    const idMap = new Map(); // clé reçue → id réel
    const statements = [];
    for (let i = 0; i < echelons.length; i++) {
      const e = echelons[i];
      const nom = String(e.nom).trim();
      const valide = e.valide === false ? 0 : 1;
      if (typeof e.id === 'number') {
        idMap.set(String(e.id), e.id);
        statements.push({ sql: 'UPDATE echelons SET nom = ?, ordre = ?, valide = ? WHERE id = ?', args: [nom, i + 1, valide, e.id] });
      } else {
        // Insertion immédiate : il faut l'id réel pour rattacher les agents
        const res = await db.execute({
          sql: 'INSERT INTO echelons (nom, ordre, valide) VALUES (?, ?, ?)',
          args: [nom, i + 1, valide],
        });
        idMap.set(String(e.id), Number(res.lastInsertRowid));
      }
    }
    const keptIds = new Set([...idMap.values()]);
    for (const oldId of existingEchelonIds) {
      if (!keptIds.has(oldId)) {
        statements.push({ sql: 'UPDATE users SET echelon_id = NULL WHERE echelon_id = ?', args: [oldId] });
        statements.push({ sql: 'DELETE FROM echelons WHERE id = ?', args: [oldId] });
      }
    }

    // ---------- Rattachements (seulement ce qui change) ----------
    let changedUsers = 0;
    for (const a of assignments) {
      const current = ctxBefore.users.get(Number(a.id));
      const respId = a.responsable_id == null || a.responsable_id === '' ? null : Number(a.responsable_id);
      const echelonId = a.echelon_id == null ? null : idMap.get(String(a.echelon_id)) ?? null;
      if (current.responsable_id === respId && (current.echelon_id ?? null) === echelonId) continue;
      changedUsers++;
      statements.push({
        sql: 'UPDATE users SET responsable_id = ?, echelon_id = ? WHERE id = ?',
        args: [respId, echelonId, current.id],
      });
    }

    if (statements.length > 0) {
      try {
        await db.batch(statements, 'write');
      } catch (batchError) {
        // Ne pas laisser d'échelons orphelins si la transaction échoue
        const inserted = [...idMap.entries()].filter(([key]) => !/^\d+$/.test(key)).map(([, id]) => id);
        for (const id of inserted) {
          await db.execute({ sql: 'DELETE FROM echelons WHERE id = ?', args: [id] }).catch(() => {});
        }
        throw batchError;
      }
    }

    // Onglet « Validation » : aligné sur la nouvelle hiérarchie
    await syncNiveauxValidation({ allowDecrease: true });
    invalidateLoginUsers();

    // Demandes en cours dont le parcours a changé
    const ctxAfter = await loadHierarchyContext();
    let impactedAgents = 0;
    for (const [id, key] of before) {
      if (circuitKey(ctxAfter, id) !== key) impactedAgents++;
    }

    return NextResponse.json({
      success: true,
      message: 'Hiérarchie enregistrée',
      changedUsers,
      impactedAgents,
    });
  } catch (error) {
    console.error('Error saving hierarchy:', error);
    return NextResponse.json({ success: false, message: 'Erreur lors de l\'enregistrement de la hiérarchie' }, { status: 500 });
  }
}

function badRequest(message) {
  return NextResponse.json({ success: false, message }, { status: 400 });
}

async function loadPendingUserIds() {
  const results = await Promise.all(
    PENDING_TABLES.map((t) => db.execute(`SELECT DISTINCT user_id FROM ${t} WHERE statut = 'en_attente'`))
  );
  const ids = new Set();
  for (const r of results) for (const row of r.rows) ids.add(Number(row.user_id));
  return ids;
}
