import { db } from './db.js';
import { recalculateFractionnement } from './fractionnement.js';

/**
 * Détermine le circuit de validation pour un utilisateur
 * @param {number} userId - ID de l'utilisateur qui fait la demande
 * @returns {Promise<Object>} Circuit de validation avec les validateurs requis
 */
export async function getValidationCircuit(userId) {
  const user = await db.execute({
    sql: `
      SELECT u.id, u.nom, u.prenom, u.type_utilisateur, u.responsable_id, u.niveau_validation,
             r.id as resp_id, r.nom as resp_nom, r.prenom as resp_prenom, r.responsable_id as resp_responsable_id
      FROM users u
      LEFT JOIN users r ON u.responsable_id = r.id
      WHERE u.id = ?
    `,
    args: [userId]
  });

  if (user.rows.length === 0) {
    throw new Error('Utilisateur non trouvé');
  }

  const userData = user.rows[0];
  const circuit = {
    niveaux: [],
    requiresRH: true
  };

  // Vérifier le type du responsable direct
  const isRespRH = userData.responsable_id ? await (async () => {
    const resp = await db.execute({
      sql: 'SELECT type_utilisateur FROM users WHERE id = ?',
      args: [userData.responsable_id]
    });
    if (resp.rows.length === 0) return false;
    const t = resp.rows[0].type_utilisateur;
    return t === 'RH' || t === 'Direction' || t === 'DG';
  })() : false;

  // Si l'utilisateur a un responsable direct qui n'est PAS RH/DGS (niveau 1)
  // Les responsables RH/DGS valident directement en tant que RH (étape finale)
  if (userData.responsable_id && !isRespRH) {
    circuit.niveaux.push({
      niveau: 1,
      validateur_id: userData.responsable_id,
      validateur_nom: userData.resp_nom,
      validateur_prenom: userData.resp_prenom,
      type: 'responsable_direct'
    });

    // Si le responsable direct a lui-même un responsable non-RH (niveau 2)
    if (userData.resp_responsable_id) {
      const resp2 = await db.execute({
        sql: 'SELECT id, nom, prenom, type_utilisateur FROM users WHERE id = ?',
        args: [userData.resp_responsable_id]
      });

      if (resp2.rows.length > 0) {
        const t2 = resp2.rows[0].type_utilisateur;
        const isResp2RH = t2 === 'RH' || t2 === 'Direction' || t2 === 'DG';
        // Ne pas ajouter comme niveau intermédiaire si c'est RH/DGS
        if (!isResp2RH) {
          circuit.niveaux.push({
            niveau: 2,
            validateur_id: resp2.rows[0].id,
            validateur_nom: resp2.rows[0].nom,
            validateur_prenom: resp2.rows[0].prenom,
            type: 'responsable_hierarchique'
          });
        }
      }
    }
  }

  // Toujours finir par la RH/DGS
  circuit.niveaux.push({
    niveau: circuit.niveaux.length + 1,
    type: 'rh',
    isFinal: true
  });

  return circuit;
}

/**
 * Obtient le niveau de validation actuel d'une demande
 * @param {Object} leave - Demande de congés
 * @returns {number} Niveau actuel (0 = en attente, 1 = validé niveau 1, etc.)
 */
export function getCurrentValidationLevel(leave) {
  if (leave.statut === 'refusee') {
    return -1; // Refusée
  }
  if (leave.statut === 'validee') {
    return 999; // Complètement validée
  }

  // En attente - déterminer le niveau
  if (leave.statut_niveau_2 === 'validee') {
    return 2; // Niveau 2 validé, en attente RH
  }
  if (leave.statut_niveau_1 === 'validee') {
    return 1; // Niveau 1 validé, en attente niveau 2 ou RH
  }

  return 0; // En attente de validation niveau 1 ou direct RH
}

/**
 * Vérifie si un utilisateur peut valider une demande
 * @param {number} validatorId - ID du validateur
 * @param {Object} leave - Demande de congés
 * @returns {Promise<Object>} { canValidate: boolean, level: number, reason: string }
 */
export async function canUserValidateLeave(validatorId, leave) {
  // Récupérer les infos du validateur
  const validator = await db.execute({
    sql: 'SELECT id, type_utilisateur, niveau_validation FROM users WHERE id = ?',
    args: [validatorId]
  });

  if (validator.rows.length === 0) {
    return { canValidate: false, reason: 'Validateur non trouvé' };
  }

  const validatorData = validator.rows[0];
  const isRH = validatorData.type_utilisateur === 'RH' || validatorData.type_utilisateur === 'Direction' || validatorData.type_utilisateur === 'DG';
  const validatorLevel = validatorData.niveau_validation || 0;

  // Récupérer les infos de l'agent qui a fait la demande
  const requester = await db.execute({
    sql: 'SELECT responsable_id FROM users WHERE id = ?',
    args: [leave.user_id]
  });

  if (requester.rows.length === 0) {
    return { canValidate: false, reason: 'Agent non trouvé' };
  }

  const requesterData = requester.rows[0];
  const currentLevel = getCurrentValidationLevel(leave);

  // Si la demande est déjà traitée
  if (currentLevel === -1 || currentLevel === 999) {
    return { canValidate: false, reason: 'Demande déjà traitée' };
  }

  // Vérifier d'abord si le validateur est responsable direct (niveau 1) — sauf si RH/DGS (valide en final)
  if (!isRH && validatorLevel >= 1 && requesterData.responsable_id === validatorId) {
    if (currentLevel === 0) {
      return {
        canValidate: true,
        level: 1,
        reason: 'Validation responsable direct'
      };
    }
    // Niveau 1 déjà validé — on continue pour vérifier les niveaux suivants
  }

  // Vérifier ensuite si le validateur est responsable niveau 2 (sauf si RH/DGS)
  if (!isRH && validatorLevel >= 2) {
    const agent = await db.execute({
      sql: `
        SELECT u.id, r.responsable_id as resp_resp_id
        FROM users u
        LEFT JOIN users r ON u.responsable_id = r.id
        WHERE u.id = ?
      `,
      args: [leave.user_id]
    });

    if (agent.rows.length > 0 && agent.rows[0].resp_resp_id === validatorId) {
      if (currentLevel === 1) {
        return {
          canValidate: true,
          level: 2,
          reason: 'Validation responsable hiérarchique'
        };
      }
      if (currentLevel === 0) {
        return {
          canValidate: false,
          reason: 'En attente validation niveau 1'
        };
      }
      // Niveau 2 déjà validé — si aussi RH, on continue pour vérifier la validation finale
    }
  }

  // RH peut valider uniquement en dernier (après tous les niveaux)
  if (isRH) {
    // Vérifier si tous les niveaux précédents sont validés
    if (requesterData.responsable_id) {
      const circuit = await getValidationCircuit(leave.user_id);
      const requiredLevels = circuit.niveaux.filter(n => n.type !== 'rh').length;

      if (currentLevel < requiredLevels) {
        return {
          canValidate: false,
          reason: `En attente de validation niveau ${currentLevel + 1}`
        };
      }
    }

    return {
      canValidate: true,
      level: 'rh',
      isFinal: true,
      reason: 'Validation finale RH'
    };
  }

  return {
    canValidate: false,
    reason: 'Vous n\'êtes pas le validateur pour cette demande'
  };
}

/**
 * Valide une demande à un niveau donné
 * @param {number} leaveId - ID de la demande
 * @param {number} validatorId - ID du validateur
 * @param {string} decision - 'validee' ou 'refusee'
 * @param {string} commentaire - Commentaire optionnel
 * @returns {Promise<Object>} Résultat de la validation
 */
export async function validateLeaveAtLevel(leaveId, validatorId, decision, commentaire = '') {
  // Récupérer la demande
  const leaveResult = await db.execute({
    sql: 'SELECT * FROM demandes_conges WHERE id = ?',
    args: [leaveId]
  });

  if (leaveResult.rows.length === 0) {
    throw new Error('Demande non trouvée');
  }

  const leave = leaveResult.rows[0];

  // Vérifier les permissions
  const validation = await canUserValidateLeave(validatorId, leave);

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

    return {
      success: true,
      message: 'Demande refusée',
      newStatus: 'refusee',
      isFinal: true
    };
  }

  // Si validation finale RH
  if (validation.isFinal) {
    // Vérifier que la demande n'a pas déjà été validée (protection double-décompte)
    if (leave.statut === 'validee') {
      return {
        success: true,
        message: 'Demande déjà validée',
        newStatus: 'validee',
        isFinal: true
      };
    }

    // Recalculer le solde à partir des congés validés plutôt qu'incrémenter
    const currentYear = new Date().getFullYear();

    // D'abord marquer la demande comme validée
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

    // Recalculer jours_pris à partir de TOUS les congés validés de l'année
    const totalResult = await db.execute({
      sql: `
        SELECT COALESCE(SUM(nombre_jours_ouvres), 0) as total_pris
        FROM demandes_conges
        WHERE user_id = ? AND statut = 'validee'
          AND strftime('%Y', date_debut) = ?
      `,
      args: [leave.user_id, String(currentYear)]
    });
    const totalPris = totalResult.rows[0]?.total_pris || 0;

    // Récupérer les infos du solde pour recalculer jours_restants
    const soldeResult = await db.execute({
      sql: 'SELECT jours_acquis, jours_reportes, jours_fractionnement, jours_compensateurs FROM soldes_conges WHERE user_id = ? AND annee = ?',
      args: [leave.user_id, currentYear]
    });

    if (soldeResult.rows.length > 0) {
      const s = soldeResult.rows[0];
      const totalAcquis = (s.jours_acquis || 0) + (s.jours_reportes || 0) + (s.jours_fractionnement || 0) + (s.jours_compensateurs || 0);
      const restants = totalAcquis - totalPris;

      await db.execute({
        sql: `
          UPDATE soldes_conges
          SET jours_pris = ?,
              jours_restants = ?
          WHERE user_id = ? AND annee = ?
        `,
        args: [totalPris, restants, leave.user_id, currentYear]
      });
    }

    // Recalculer les jours de fractionnement
    await recalculateFractionnement(leave.user_id, currentYear);

    return {
      success: true,
      message: 'Demande validée définitivement',
      newStatus: 'validee',
      isFinal: true
    };
  }

  // Validation intermédiaire
  if (validation.level === 1) {
    await db.execute({
      sql: `
        UPDATE demandes_conges
        SET statut_niveau_1 = 'validee',
            validateur_niveau_1_id = ?,
            date_validation_niveau_1 = ?
        WHERE id = ?
      `,
      args: [validatorId, now, leaveId]
    });

    // Vérifier s'il y a un niveau 2
    const circuit = await getValidationCircuit(leave.user_id);
    const hasLevel2 = circuit.niveaux.some(n => n.niveau === 2);

    return {
      success: true,
      message: hasLevel2
        ? 'Demande validée - En attente validation niveau 2'
        : 'Demande validée - En attente validation RH',
      newStatus: 'en_attente',
      nextLevel: hasLevel2 ? 2 : 'rh'
    };
  }

  if (validation.level === 2) {
    await db.execute({
      sql: `
        UPDATE demandes_conges
        SET statut_niveau_2 = 'validee',
            validateur_niveau_2_id = ?,
            date_validation_niveau_2 = ?
        WHERE id = ?
      `,
      args: [validatorId, now, leaveId]
    });

    return {
      success: true,
      message: 'Demande validée - En attente validation RH',
      newStatus: 'en_attente',
      nextLevel: 'rh'
    };
  }

  throw new Error('Niveau de validation invalide');
}
