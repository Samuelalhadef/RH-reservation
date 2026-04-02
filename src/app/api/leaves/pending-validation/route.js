import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { canUserValidateLeave } from '@/lib/hierarchy';

/**
 * GET /api/leaves/pending-validation
 * Récupère les demandes en attente de validation pour un responsable
 */
export async function GET(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Non authentifié' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { success: false, message: 'Token invalide' },
        { status: 401 }
      );
    }

    const userId = decoded.userId;

    // Récupérer les infos du validateur
    const validatorResult = await db.execute({
      sql: 'SELECT type_utilisateur, niveau_validation FROM users WHERE id = ?',
      args: [userId]
    });

    if (validatorResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    const validator = validatorResult.rows[0];
    const isRH = validator.type_utilisateur === 'RH' || validator.type_utilisateur === 'Direction' || validator.type_utilisateur === 'DG';
    const validatorLevel = validator.niveau_validation || 0;

    // Vérifier si ce validateur est responsable direct de certains agents (seulement si pas RH/DGS)
    const hasSubordinates = (!isRH && validatorLevel >= 1) ? (await db.execute({
      sql: 'SELECT COUNT(*) as cnt FROM users WHERE responsable_id = ? AND actif = 1',
      args: [userId]
    })).rows[0].cnt > 0 : false;

    // Vérifier si ce validateur est responsable niveau 2 (seulement si pas RH/DGS)
    const hasLevel2Subordinates = (!isRH && validatorLevel >= 2) ? (await db.execute({
      sql: `SELECT COUNT(*) as cnt FROM users u
            INNER JOIN users r ON u.responsable_id = r.id
            WHERE r.responsable_id = ?`,
      args: [userId]
    })).rows[0].cnt > 0 : false;

    let queries = [];

    // Priorité 1 : responsable direct (niveau 1) - PAS pour RH/DGS qui valident en final
    if (hasSubordinates) {
      queries.push({
        sql: `
          SELECT
            d.*,
            u.nom,
            u.prenom,
            u.email,
            u.type_utilisateur,
            u.responsable_id
          FROM demandes_conges d
          INNER JOIN users u ON d.user_id = u.id
          WHERE d.statut = 'en_attente'
          AND u.responsable_id = ?
          AND (d.statut_niveau_1 IS NULL OR d.statut_niveau_1 != 'validee')
          ORDER BY d.date_demande ASC
        `,
        args: [userId]
      });
    }

    // Priorité 2 : responsable hiérarchique (niveau 2)
    if (hasLevel2Subordinates) {
      queries.push({
        sql: `
          SELECT
            d.*,
            u.nom,
            u.prenom,
            u.email,
            u.type_utilisateur,
            u.responsable_id,
            v1.nom as validateur_n1_nom,
            v1.prenom as validateur_n1_prenom
          FROM demandes_conges d
          INNER JOIN users u ON d.user_id = u.id
          INNER JOIN users r1 ON u.responsable_id = r1.id
          LEFT JOIN users v1 ON d.validateur_niveau_1_id = v1.id
          WHERE d.statut = 'en_attente'
          AND r1.responsable_id = ?
          AND d.statut_niveau_1 = 'validee'
          AND (d.statut_niveau_2 IS NULL OR d.statut_niveau_2 != 'validee')
          ORDER BY d.date_demande ASC
        `,
        args: [userId]
      });
    }

    // Priorité 3 : RH voit les demandes prêtes pour validation finale
    if (isRH) {
      queries.push({
        sql: `
          SELECT
            d.*,
            u.nom,
            u.prenom,
            u.email,
            u.type_utilisateur,
            u.responsable_id,
            v1.nom as validateur_n1_nom,
            v1.prenom as validateur_n1_prenom,
            v2.nom as validateur_n2_nom,
            v2.prenom as validateur_n2_prenom
          FROM demandes_conges d
          INNER JOIN users u ON d.user_id = u.id
          LEFT JOIN users v1 ON d.validateur_niveau_1_id = v1.id
          LEFT JOIN users v2 ON d.validateur_niveau_2_id = v2.id
          WHERE d.statut = 'en_attente'
          AND (
            u.responsable_id IS NULL
            OR (u.responsable_id IS NOT NULL AND d.statut_niveau_1 = 'validee')
          )
          ORDER BY d.date_demande ASC
        `,
        args: []
      });
    }

    if (queries.length === 0) {
      // Utilisateur sans droits de validation
      return NextResponse.json({
        success: true,
        leaves: []
      });
    }

    // Exécuter toutes les requêtes et fusionner les résultats (dédoublonnage par id)
    const seenIds = new Set();
    const allRows = [];
    for (const q of queries) {
      const result = await db.execute(q);
      for (const row of result.rows) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id);
          allRows.push(row);
        }
      }
    }

    // Filtrer les demandes que l'utilisateur peut réellement valider
    const validatableLeaves = [];

    for (const leave of allRows) {
      const validation = await canUserValidateLeave(userId, leave);
      if (validation.canValidate) {
        validatableLeaves.push({
          ...leave,
          validation_info: {
            level: validation.level,
            reason: validation.reason,
            isFinal: validation.isFinal
          }
        });
      }
    }

    return NextResponse.json({
      success: true,
      leaves: validatableLeaves,
      validator_info: {
        isRH,
        level: validatorLevel
      }
    });
  } catch (error) {
    console.error('Error fetching pending validations:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
