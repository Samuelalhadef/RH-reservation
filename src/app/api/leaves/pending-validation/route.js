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

    let query;
    let args;

    if (isRH) {
      // RH voit toutes les demandes en attente qui ont passé tous les niveaux intermédiaires
      query = `
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
      `;
      args = [];
    } else if (validatorLevel === 1) {
      // Responsable niveau 1 voit les demandes de ses subordonnés directs non encore validées niveau 1
      query = `
        SELECT
          d.*,
          u.nom,
          u.prenom,
          u.email,
          u.type_utilisateur
        FROM demandes_conges d
        INNER JOIN users u ON d.user_id = u.id
        WHERE d.statut = 'en_attente'
        AND u.responsable_id = ?
        AND (d.statut_niveau_1 IS NULL OR d.statut_niveau_1 != 'validee')
        ORDER BY d.date_demande ASC
      `;
      args = [userId];
    } else if (validatorLevel === 2) {
      // Responsable niveau 2 voit les demandes validées niveau 1 de ses équipes
      query = `
        SELECT
          d.*,
          u.nom,
          u.prenom,
          u.email,
          u.type_utilisateur,
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
      `;
      args = [userId];
    } else {
      // Utilisateur sans droits de validation
      return NextResponse.json({
        success: true,
        leaves: []
      });
    }

    const result = await db.execute({
      sql: query,
      args: args
    });

    // Filtrer les demandes que l'utilisateur peut réellement valider
    const validatableLeaves = [];

    for (const leave of result.rows) {
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
