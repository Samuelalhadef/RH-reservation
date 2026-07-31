import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { canUserValidateLeave } from '@/lib/hierarchy';

/**
 * GET /api/recuperation/pending-validation
 * Récupère les demandes d'heures sup et d'utilisation en attente de validation pour le validateur courant
 */
export async function GET(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: 'Non authentifié' }, { status: 401 });
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Token invalide' }, { status: 401 });
    }
    const userId = decoded.userId;

    const validatorResult = await db.execute({
      sql: 'SELECT type_utilisateur, niveau_validation FROM users WHERE id = ?',
      args: [userId]
    });
    if (validatorResult.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Utilisateur non trouvé' }, { status: 404 });
    }
    const validator = validatorResult.rows[0];
    const isRH = validator.type_utilisateur === 'RH' || validator.type_utilisateur === 'Direction' || validator.type_utilisateur === 'DG';
    const validatorLevel = validator.niveau_validation || 0;
    const validatorType = validator.type_utilisateur;

    const hasSubordinates = (!isRH && validatorLevel >= 1) ? (await db.execute({
      sql: `SELECT COUNT(*) as cnt FROM users u
            LEFT JOIN users r ON u.responsable_id = r.id
            WHERE u.actif = 1 AND (u.responsable_id = ? OR r.type_utilisateur = ?)`,
      args: [userId, validatorType]
    })).rows[0].cnt > 0 : false;

    const hasLevel2Subordinates = (!isRH && validatorLevel >= 2) ? (await db.execute({
      sql: `SELECT COUNT(*) as cnt FROM users u
            INNER JOIN users r ON u.responsable_id = r.id
            WHERE r.responsable_id = ? OR r.type_utilisateur = (SELECT type_utilisateur FROM users WHERE id = ?)`,
      args: [userId, userId]
    })).rows[0].cnt > 0 : false;

    const buildQueries = (table) => {
      const queries = [];
      if (hasSubordinates) {
        queries.push({
          sql: `
            SELECT d.*, u.nom, u.prenom, u.email, u.type_utilisateur, u.responsable_id,
                   strftime('%d/%m/%Y', d.date_demande) as date_demande_fr
            FROM ${table} d
            INNER JOIN users u ON d.user_id = u.id
            LEFT JOIN users r ON u.responsable_id = r.id
            WHERE d.statut = 'en_attente'
            AND (u.responsable_id = ? OR r.type_utilisateur = ?)
            AND (d.statut_niveau_1 IS NULL OR d.statut_niveau_1 != 'validee')
            ORDER BY d.date_demande ASC
          `,
          args: [userId, validatorType]
        });
      }
      if (hasLevel2Subordinates) {
        queries.push({
          sql: `
            SELECT d.*, u.nom, u.prenom, u.email, u.type_utilisateur, u.responsable_id,
                   v1.nom as validateur_n1_nom, v1.prenom as validateur_n1_prenom,
                   strftime('%d/%m/%Y', d.date_demande) as date_demande_fr
            FROM ${table} d
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
      if (isRH) {
        queries.push({
          sql: `
            SELECT d.*, u.nom, u.prenom, u.email, u.type_utilisateur, u.responsable_id,
                   v1.nom as validateur_n1_nom, v1.prenom as validateur_n1_prenom,
                   v2.nom as validateur_n2_nom, v2.prenom as validateur_n2_prenom,
                   strftime('%d/%m/%Y', d.date_demande) as date_demande_fr
            FROM ${table} d
            INNER JOIN users u ON d.user_id = u.id
            LEFT JOIN users v1 ON d.validateur_niveau_1_id = v1.id
            LEFT JOIN users v2 ON d.validateur_niveau_2_id = v2.id
            WHERE d.statut = 'en_attente'
            ORDER BY d.date_demande ASC
          `,
          args: []
        });
      }
      return queries;
    };

    const collect = async (table, type) => {
      const queries = buildQueries(table);
      const seen = new Set();
      const rows = [];
      for (const q of queries) {
        const r = await db.execute(q);
        for (const row of r.rows) {
          if (!seen.has(row.id)) {
            seen.add(row.id);
            rows.push(row);
          }
        }
      }
      const result = [];
      for (const row of rows) {
        const v = await canUserValidateLeave(userId, row);
        if (v.canValidate) {
          result.push({
            ...row,
            type_demande: type,
            validation_info: { level: v.level, reason: v.reason, isFinal: v.isFinal }
          });
        }
      }
      return result;
    };

    const [declarations, utilisations] = await Promise.all([
      collect('demandes_recuperation', 'declaration'),
      collect('demandes_utilisation_recup', 'utilisation')
    ]);

    return NextResponse.json({
      success: true,
      declarations,
      utilisations,
      validator_info: { isRH, level: validatorLevel }
    });
  } catch (error) {
    console.error('Error fetching pending recuperation validations:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
