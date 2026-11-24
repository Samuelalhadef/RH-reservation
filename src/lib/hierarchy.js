import { db } from './db.js';
import { recalculateSoldeComplet } from './fractionnement.js';
import { getSoldeDisponible } from './soldes.js';
import {
  isRHType,
  buildHierarchyContext,
  computeCircuit,
  computeIntermediateSteps,
} from './circuit.js';

export { isRHType, computeCircuit } from './circuit.js';

const VALIDATION_TABLES = ['demandes_conges', 'demandes_recuperation', 'demandes_utilisation_recup'];

/**
 * Empêche la validation définitive d'un congé si le solde ne le couvre pas
 * (sinon jours_restants passe en négatif). Seuls les congés déjà validés
 * sont déduits : la première demande validée est prioritaire.
 */
async function assertSoldeSuffisant(leave) {
  // Un congé déjà validé sur la même période (ex. saisi directement par la RH
  // pendant que cette demande attendait) : valider décompterait les jours deux fois
  const overlap = await db.execute({
    sql: `SELECT date_debut, date_fin FROM demandes_conges
          WHERE user_id = ? AND id != ? AND statut = 'validee'
            AND date_debut <= ? AND date_fin >= ?
          LIMIT 1`,
    args: [leave.user_id, leave.id, leave.date_fin, leave.date_debut]
  });
  if (overlap.rows.length > 0) {
    const o = overlap.rows[0];
    throw new Error(
      `Un congé est déjà validé sur cette période (du ${o.date_debut} au ${o.date_fin}). Refusez cette demande.`
    );
  }

  const currentYear = new Date().getFullYear();
  // Le solde recalculé est celui de l'année en cours : un congé d'une autre année n'y est pas imputé
  if (String(leave.date_debut).slice(0, 4) !== String(currentYear)) return;

  const solde = await getSoldeDisponible(leave.user_id, currentYear, [leave.id]);
  if (!solde) return;

  const demandes = Number(leave.nombre_jours_ouvres) || 0;
  if (demandes > solde.restants + 1e-9) {
    throw new Error(
      `Solde insuffisant : l'agent n'a plus que ${solde.restants} jour(s) restant(s) pour ${demandes} jour(s) demandé(s). Refusez la demande ou ajustez le solde avant de valider.`
    );
  }
}

// ============================================================
// Contexte hiérarchique (2 requêtes, puis tout se calcule en mémoire)
// ============================================================

/**
 * Charge utilisateurs + échelons une seule fois. À passer aux fonctions
 * ci-dessous quand on traite plusieurs demandes (évite N requêtes par demande).
 */
export async function loadHierarchyContext() {
  const [usersRes, echelonsRes] = await Promise.all([
    db.execute(
      'SELECT id, nom, prenom, type_utilisateur, responsable_id, niveau_validation, actif, echelon_id FROM users'
    ),
    db.execute('SELECT id, nom, ordre, valide FROM echelons ORDER BY ordre'),
  ]);
  return buildHierarchyContext(usersRes.rows, echelonsRes.rows);
}

/**
 * Détermine le circuit de validation pour un utilisateur
 * @param {number} userId - ID de l'utilisateur qui fait la demande
 * @param {Object} [ctx] - contexte déjà chargé (optionnel)
 * @returns {Promise<Object>} { niveaux: [{ niveau, validateur_id, validateur_nom, validateur_prenom, echelon_nom, type }, ..., { type: 'rh', isFinal }] }
 */
export async function getValidationCircuit(userId, ctx = null) {
  return computeCircuit(userId, ctx || (await loadHierarchyContext()));
}

/**
 * Nombre d'étapes intermédiaires déjà validées, quel que soit le statut.
 * Lit la colonne générique niveau_valide, et les anciennes colonnes
 * statut_niveau_1/2 pour les demandes antérieures au parcours à N étapes.
 */
export function getValidatedStepsCount(demande) {
  const generic = Number(demande.niveau_valide) || 0;
  const legacy = demande.statut_niveau_2 === 'validee' ? 2 : demande.statut_niveau_1 === 'validee' ? 1 : 0;
  return Math.max(generic, legacy);
}

/**
 * Obtient le niveau de validation actuel d'une demande
 * @returns {number} -1 = refusée, 999 = validée, sinon nombre d'étapes intermédiaires validées
 */
export function getCurrentValidationLevel(leave) {
  if (leave.statut === 'refusee') return -1;
  if (leave.statut === 'validee') return 999;
  return getValidatedStepsCount(leave);
}

/**
 * Vérifie si un utilisateur peut valider une demande
 * @param {number} validatorId - ID du validateur
 * @param {Object} leave - Demande (congé ou récupération)
 * @param {Object} [ctx] - contexte hiérarchique déjà chargé (optionnel)
 * @returns {Promise<Object>} { canValidate, level, isFinal, reason }
 */
export async function canUserValidateLeave(validatorId, leave, ctx = null) {
  ctx = ctx || (await loadHierarchyContext());

  const validator = ctx.users.get(Number(validatorId));
  if (!validator) return { canValidate: false, reason: 'Validateur non trouvé' };
  if (!ctx.users.has(Number(leave.user_id))) return { canValidate: false, reason: 'Agent non trouvé' };

  if (leave.statut && leave.statut !== 'en_attente') {
    return { canValidate: false, reason: 'Demande déjà traitée' };
  }

  const currentLevel = getValidatedStepsCount(leave);
  const etapes = computeIntermediateSteps(leave.user_id, ctx);
  const isRH = isRHType(validator.type_utilisateur);

  if (!isRH && currentLevel < etapes.length) {
    const next = etapes[currentLevel];
    if (next.validateur_id === validator.id) {
      return {
        canValidate: true,
        level: next.niveau,
        reason: next.niveau === 1 ? 'Validation responsable direct' : `Validation niveau ${next.niveau}`,
      };
    }
    // Co-responsables : un validateur de même fonction que le responsable direct
    // peut valider la 1re étape à sa place (comportement historique conservé).
    if (currentLevel === 0 && (Number(validator.niveau_validation) || 0) >= 1) {
      const assigned = ctx.users.get(next.validateur_id);
      if (assigned && assigned.type_utilisateur === validator.type_utilisateur) {
        return { canValidate: true, level: 1, reason: 'Validation responsable direct' };
      }
    }
  }

  // La RH valide uniquement en dernier, une fois toutes les étapes passées
  if (isRH) {
    if (currentLevel < etapes.length) {
      const next = etapes[currentLevel];
      return {
        canValidate: false,
        reason: `En attente de validation niveau ${next.niveau} (${next.validateur_prenom} ${next.validateur_nom})`,
      };
    }
    return { canValidate: true, level: 'rh', isFinal: true, reason: 'Validation finale RH' };
  }

  const ownStep = etapes.find((e) => e.validateur_id === validator.id);
  if (ownStep) {
    return {
      canValidate: false,
      reason: ownStep.niveau <= currentLevel ? 'Étape déjà validée' : `En attente de validation niveau ${currentLevel + 1}`,
    };
  }

  return { canValidate: false, reason: 'Vous n\'êtes pas le validateur pour cette demande' };
}

// ============================================================
// Enregistrement des étapes
// ============================================================

/**
 * Marque l'étape intermédiaire `level` comme validée. Alimente la colonne
 * générique niveau_valide + l'historique, et les anciennes colonnes
 * statut_niveau_1/2 (toujours lues par certains écrans).
 */
async function recordIntermediateStep(table, demandeId, level, validatorId, now) {
  if (!VALIDATION_TABLES.includes(table)) throw new Error('Table non supportée');

  let legacySql = '';
  const args = [level];
  if (level === 1 || level === 2) {
    legacySql = `, statut_niveau_${level} = 'validee', validateur_niveau_${level}_id = ?, date_validation_niveau_${level} = ?`;
    args.push(validatorId, now);
  }
  args.push(demandeId);

  await db.execute({
    sql: `UPDATE ${table} SET niveau_valide = ?${legacySql} WHERE id = ?`,
    args,
  });
  await db.execute({
    sql: `INSERT INTO validations_etapes (demande_table, demande_id, niveau, validateur_id, date_validation)
          VALUES (?, ?, ?, ?, ?)`,
    args: [table, demandeId, level, validatorId, now],
  });
}

/** Valide toutes les étapes intermédiaires restantes au nom de la RH (validation forcée). */
async function recordRemainingStepsAsRH(table, demande, validatorId, now, ctx) {
  const etapes = computeIntermediateSteps(demande.user_id, ctx);
  const done = getValidatedStepsCount(demande);
  for (let level = done + 1; level <= etapes.length; level++) {
    await recordIntermediateStep(table, demande.id, level, validatorId, now);
  }
}

/** Ce qui suit l'étape `level` dans le circuit de l'agent. */
function describeNextStep(userId, level, ctx) {
  const etapes = computeIntermediateSteps(userId, ctx);
  const next = etapes[level]; // index 0-based = étape level+1
  if (next) {
    return {
      message: `Demande validée - En attente validation niveau ${next.niveau} (${next.validateur_prenom} ${next.validateur_nom})`,
      nextLevel: next.niveau,
      nextValidatorId: next.validateur_id,
    };
  }
  return { message: 'Demande validée - En attente validation RH', nextLevel: 'rh', nextValidatorId: null };
}

// ============================================================
// Congés
// ============================================================

/**
 * Valide une demande à un niveau donné
 * @param {number} leaveId - ID de la demande
 * @param {number} validatorId - ID du validateur
 * @param {string} decision - 'validee' ou 'refusee'
 * @param {string} commentaire - Commentaire optionnel
 * @returns {Promise<Object>} Résultat de la validation
 */
export async function validateLeaveAtLevel(leaveId, validatorId, decision, commentaire = '') {
  const leaveResult = await db.execute({
    sql: 'SELECT * FROM demandes_conges WHERE id = ?',
    args: [leaveId]
  });

  if (leaveResult.rows.length === 0) {
    throw new Error('Demande non trouvée');
  }

  const leave = leaveResult.rows[0];
  const ctx = await loadHierarchyContext();

  const validation = await canUserValidateLeave(validatorId, leave, ctx);
  if (!validation.canValidate) {
    throw new Error(validation.reason);
  }

  const now = new Date().toISOString();

  // Si refusée, tout s'arrête
  if (decision === 'refusee') {
    await db.execute({
      sql: `
        UPDATE demandes_conges
        SET statut = 'refusee',
            date_validation = ?,
            validateur_id = ?,
            commentaire_rh = ?
        WHERE id = ?
      `,
      args: [now, validatorId, commentaire, leaveId]
    });

    return { success: true, message: 'Demande refusée', newStatus: 'refusee', isFinal: true };
  }

  // Validation finale RH
  if (validation.isFinal) {
    // Protection double-décompte
    if (leave.statut === 'validee') {
      return { success: true, message: 'Demande déjà validée', newStatus: 'validee', isFinal: true };
    }

    await assertSoldeSuffisant(leave);

    const currentYear = new Date().getFullYear();

    await db.execute({
      sql: `
        UPDATE demandes_conges
        SET statut = 'validee',
            date_validation = ?,
            validateur_id = ?,
            commentaire_rh = ?
        WHERE id = ?
      `,
      args: [now, validatorId, commentaire, leaveId]
    });

    // Recalculer le solde (jours pris + jours restants, mouvements CET inclus)
    await recalculateSoldeComplet(leave.user_id, currentYear);

    return { success: true, message: 'Demande validée définitivement', newStatus: 'validee', isFinal: true };
  }

  // Validation intermédiaire (niveau 1, 2, 3, …)
  if (typeof validation.level === 'number') {
    await recordIntermediateStep('demandes_conges', leaveId, validation.level, validatorId, now);
    const next = describeNextStep(leave.user_id, validation.level, ctx);
    return { success: true, newStatus: 'en_attente', ...next };
  }

  throw new Error('Niveau de validation invalide');
}

/**
 * Validation/refus en force par la RH (bypass de la hiérarchie).
 * À utiliser uniquement quand un responsable est absent/malade et ne peut pas valider.
 */
export async function forceValidateLeaveByRH(leaveId, validatorId, decision, commentaire = '') {
  const validator = await db.execute({
    sql: 'SELECT id, type_utilisateur FROM users WHERE id = ?',
    args: [validatorId]
  });
  if (validator.rows.length === 0) {
    throw new Error('Validateur non trouvé');
  }
  if (!isRHType(validator.rows[0].type_utilisateur)) {
    throw new Error('Seuls les utilisateurs RH/Direction/DG peuvent forcer une validation');
  }

  const leaveResult = await db.execute({
    sql: 'SELECT * FROM demandes_conges WHERE id = ?',
    args: [leaveId]
  });
  if (leaveResult.rows.length === 0) {
    throw new Error('Demande non trouvée');
  }
  const leave = leaveResult.rows[0];

  if (leave.statut !== 'en_attente') {
    throw new Error('Cette demande a déjà été traitée');
  }

  const now = new Date().toISOString();
  const noteForce = '[RH - Validation directe (responsable absent)]';
  const fullComment = commentaire ? `${noteForce} ${commentaire}` : noteForce;

  if (decision === 'refusee') {
    await db.execute({
      sql: `
        UPDATE demandes_conges
        SET statut = 'refusee',
            date_validation = ?,
            validateur_id = ?,
            commentaire_rh = ?
        WHERE id = ?
      `,
      args: [now, validatorId, fullComment, leaveId]
    });
    return { success: true, message: 'Demande refusée directement par la RH', newStatus: 'refusee', isFinal: true };
  }

  await assertSoldeSuffisant(leave);

  // Marquer les étapes intermédiaires restantes comme validées par la RH
  const ctx = await loadHierarchyContext();
  await recordRemainingStepsAsRH('demandes_conges', leave, validatorId, now, ctx);

  await db.execute({
    sql: `
      UPDATE demandes_conges
      SET statut = 'validee',
          date_validation = ?,
          validateur_id = ?,
          commentaire_rh = ?
      WHERE id = ?
    `,
    args: [now, validatorId, fullComment, leaveId]
  });

  const currentYear = new Date().getFullYear();
  await recalculateSoldeComplet(leave.user_id, currentYear);

  return { success: true, message: 'Demande validée directement par la RH', newStatus: 'validee', isFinal: true };
}

// ============================================================
// Récupération (déclarations d'heures sup / utilisations)
// ============================================================

export async function canUserValidateRecuperation(validatorId, demande, ctx = null) {
  return canUserValidateLeave(validatorId, demande, ctx);
}

async function recalculateSoldeRecuperation(userId) {
  const totalResult = await db.execute({
    sql: `SELECT COALESCE(SUM(nombre_heures), 0) as total
          FROM demandes_recuperation
          WHERE user_id = ? AND statut = 'validee' AND type_compensation = 'recuperation'`,
    args: [userId]
  });
  const totalHeures = totalResult.rows[0]?.total || 0;

  await db.execute({
    sql: 'INSERT OR IGNORE INTO soldes_recuperation (user_id, heures_acquises) VALUES (?, 0)',
    args: [userId]
  });
  await db.execute({
    sql: 'UPDATE soldes_recuperation SET heures_acquises = ?, date_maj = CURRENT_TIMESTAMP WHERE user_id = ?',
    args: [totalHeures, userId]
  });
}

/**
 * Valide une demande de récupération (déclaration d'heures sup OU utilisation) à un niveau donné.
 * @param {string} table - 'demandes_recuperation' ou 'demandes_utilisation_recup'
 */
export async function validateRecuperationAtLevel(demandeId, validatorId, decision, commentaire = '', table = 'demandes_recuperation') {
  if (!['demandes_recuperation', 'demandes_utilisation_recup'].includes(table)) {
    throw new Error('Table non supportée');
  }

  const demandeResult = await db.execute({
    sql: `SELECT * FROM ${table} WHERE id = ?`,
    args: [demandeId]
  });
  if (demandeResult.rows.length === 0) {
    throw new Error('Demande non trouvée');
  }

  const demande = demandeResult.rows[0];
  const ctx = await loadHierarchyContext();
  const validation = await canUserValidateLeave(validatorId, demande, ctx);
  if (!validation.canValidate) {
    throw new Error(validation.reason);
  }

  const now = new Date().toISOString();

  if (decision === 'refusee') {
    await db.execute({
      sql: `UPDATE ${table}
            SET statut = 'refusee', date_validation = ?, validateur_id = ?, commentaire = ?
            WHERE id = ?`,
      args: [now, validatorId, commentaire, demandeId]
    });
    return { success: true, message: 'Demande refusée', newStatus: 'refusee', isFinal: true };
  }

  if (validation.isFinal) {
    if (demande.statut === 'validee') {
      return { success: true, message: 'Demande déjà validée', newStatus: 'validee', isFinal: true };
    }

    await db.execute({
      sql: `UPDATE ${table}
            SET statut = 'validee', date_validation = ?, validateur_id = ?, commentaire = ?
            WHERE id = ?`,
      args: [now, validatorId, commentaire, demandeId]
    });

    if (table === 'demandes_recuperation' && demande.type_compensation === 'recuperation') {
      await recalculateSoldeRecuperation(demande.user_id);
    }

    return { success: true, message: 'Demande validée définitivement', newStatus: 'validee', isFinal: true };
  }

  if (typeof validation.level === 'number') {
    await recordIntermediateStep(table, demandeId, validation.level, validatorId, now);
    const next = describeNextStep(demande.user_id, validation.level, ctx);
    return { success: true, newStatus: 'en_attente', ...next };
  }

  throw new Error('Niveau de validation invalide');
}

/**
 * Validation/refus en force par la RH d'une demande de récupération.
 * À utiliser quand un responsable est absent.
 */
export async function forceValidateRecuperationByRH(demandeId, validatorId, decision, commentaire = '', table = 'demandes_recuperation') {
  if (!['demandes_recuperation', 'demandes_utilisation_recup'].includes(table)) {
    throw new Error('Table non supportée');
  }

  const validator = await db.execute({
    sql: 'SELECT id, type_utilisateur FROM users WHERE id = ?',
    args: [validatorId]
  });
  if (validator.rows.length === 0) {
    throw new Error('Validateur non trouvé');
  }
  if (!isRHType(validator.rows[0].type_utilisateur)) {
    throw new Error('Seuls les utilisateurs RH/Direction/DG peuvent forcer une validation');
  }

  const demandeResult = await db.execute({
    sql: `SELECT * FROM ${table} WHERE id = ?`,
    args: [demandeId]
  });
  if (demandeResult.rows.length === 0) {
    throw new Error('Demande non trouvée');
  }
  const demande = demandeResult.rows[0];

  if (demande.statut !== 'en_attente') {
    throw new Error('Cette demande a déjà été traitée');
  }

  const now = new Date().toISOString();
  const noteForce = '[RH - Validation directe (responsable absent)]';
  const fullComment = commentaire ? `${noteForce} ${commentaire}` : noteForce;

  if (decision === 'refusee') {
    await db.execute({
      sql: `UPDATE ${table}
            SET statut = 'refusee', date_validation = ?, validateur_id = ?, commentaire = ?
            WHERE id = ?`,
      args: [now, validatorId, fullComment, demandeId]
    });
    return { success: true, message: 'Demande refusée directement par la RH', newStatus: 'refusee', isFinal: true };
  }

  const ctx = await loadHierarchyContext();
  await recordRemainingStepsAsRH(table, demande, validatorId, now, ctx);

  await db.execute({
    sql: `UPDATE ${table}
          SET statut = 'validee', date_validation = ?, validateur_id = ?, commentaire = ?
          WHERE id = ?`,
    args: [now, validatorId, fullComment, demandeId]
  });

  if (table === 'demandes_recuperation' && demande.type_compensation === 'recuperation') {
    await recalculateSoldeRecuperation(demande.user_id);
  }

  return { success: true, message: 'Demande validée directement par la RH', newStatus: 'validee', isFinal: true };
}

// ============================================================
// Affichage : état de chaque étape d'une demande
// ============================================================

/**
 * Charge l'historique des étapes d'une table : Map(demande_id → [{ niveau, validateur_id, date_validation }])
 */
export async function loadValidationHistory(table) {
  const res = await db.execute({
    sql: 'SELECT demande_id, niveau, validateur_id, date_validation FROM validations_etapes WHERE demande_table = ? ORDER BY id',
    args: [table],
  });
  const map = new Map();
  for (const row of res.rows) {
    const id = Number(row.demande_id);
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(row);
  }
  return map;
}

/**
 * Décrit les étapes intermédiaires d'une demande pour l'affichage.
 * @returns {Array<{ niveau, echelon_nom, prevu_prenom, prevu_nom, statut: 'validee'|'en_cours'|'refusee'|'a_venir', valide_par_prenom, valide_par_nom, date_validation }>}
 * La validation finale RH n'est pas incluse (déductible du statut de la demande).
 */
export function describeEtapes(demande, ctx, history = []) {
  const done = getValidatedStepsCount(demande);

  // Dernière validation connue par niveau (l'historique peut contenir un ancien passage)
  const byLevel = new Map();
  for (const h of history) byLevel.set(Number(h.niveau), h);
  for (const lvl of [1, 2]) {
    if (demande[`statut_niveau_${lvl}`] === 'validee' && !byLevel.has(lvl)) {
      byLevel.set(lvl, {
        validateur_id: demande[`validateur_niveau_${lvl}_id`],
        date_validation: demande[`date_validation_niveau_${lvl}`],
      });
    }
  }

  let planned = [];
  try {
    planned = computeIntermediateSteps(demande.user_id, ctx);
  } catch (e) { /* agent supprimé */ }

  // Une demande terminée montre ce qui a réellement eu lieu, pas le parcours actuel
  const total = demande.statut === 'en_attente' || demande.statut === 'refusee'
    ? Math.max(done, planned.length)
    : done;

  const etapes = [];
  for (let n = 1; n <= total; n++) {
    const h = byLevel.get(n);
    const p = planned[n - 1];
    const who = h?.validateur_id != null ? ctx.users.get(Number(h.validateur_id)) : null;

    let statut = 'a_venir';
    if (n <= done) statut = 'validee';
    else if (n === done + 1 && demande.statut === 'refusee') statut = 'refusee';
    else if (n === done + 1 && demande.statut === 'en_attente') statut = 'en_cours';

    etapes.push({
      niveau: n,
      echelon_nom: p?.echelon_nom || null,
      prevu_prenom: p?.validateur_prenom || null,
      prevu_nom: p?.validateur_nom || null,
      statut,
      valide_par_prenom: who?.prenom || null,
      valide_par_nom: who?.nom || null,
      date_validation: h?.date_validation || null,
    });
  }
  return etapes;
}

// ============================================================
// Droits d'accès à l'onglet « Validation »
// ============================================================

/**
 * Recalcule users.niveau_validation (= étape la plus haute qu'occupe la personne
 * dans un parcours) — c'est ce qui affiche l'onglet « Validation » dans le menu.
 * @param {boolean} allowDecrease - false : ne fait que relever les niveaux (création/édition d'un agent) ;
 *                                  true : aligne exactement sur la hiérarchie (enregistrement de la pyramide).
 */
export async function syncNiveauxValidation({ allowDecrease = false } = {}) {
  const ctx = await loadHierarchyContext();
  const computed = new Map();
  const step1Types = new Set();

  for (const u of ctx.users.values()) {
    if (u.actif === 0) continue;
    const etapes = computeIntermediateSteps(u.id, ctx);
    etapes.forEach((e, i) => {
      computed.set(e.validateur_id, Math.max(computed.get(e.validateur_id) || 0, e.niveau));
      if (i === 0) step1Types.add(ctx.users.get(e.validateur_id)?.type_utilisateur);
    });
  }

  const updates = [];
  for (const u of ctx.users.values()) {
    const current = Number(u.niveau_validation) || 0;
    let target = computed.get(u.id) || 0;
    if (allowDecrease) {
      // Garder l'accès des co-responsables (même fonction qu'un responsable direct)
      if (target === 0 && current >= 1 && !isRHType(u.type_utilisateur) && step1Types.has(u.type_utilisateur)) {
        target = 1;
      }
    } else {
      target = Math.max(current, target);
    }
    if (target !== current) {
      updates.push({ sql: 'UPDATE users SET niveau_validation = ? WHERE id = ?', args: [target, u.id] });
    }
  }

  if (updates.length > 0) await db.batch(updates, 'write');
  return updates.length;
}
