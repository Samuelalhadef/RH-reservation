import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import {
  canUserValidateLeave,
  loadHierarchyContext,
  loadValidationHistory,
  describeEtapes,
  isRHType,
} from '@/lib/hierarchy';

/**
 * GET /api/recuperation/pending-validation
 * Demandes d'heures sup et d'utilisation que l'utilisateur connecté peut valider maintenant.
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

    const userId = Number(decoded.userId);
    const ctx = await loadHierarchyContext();
    const validator = ctx.users.get(userId);
    if (!validator) {
      return NextResponse.json({ success: false, message: 'Utilisateur non trouvé' }, { status: 404 });
    }

    const isRH = isRHType(validator.type_utilisateur);
    const validatorLevel = Number(validator.niveau_validation) || 0;

    const collect = async (table, type) => {
      const [result, history] = await Promise.all([
        db.execute(`
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
        `),
        loadValidationHistory(table),
      ]);

      const rows = [];
      for (const row of result.rows) {
        const v = await canUserValidateLeave(userId, row, ctx);
        if (!v.canValidate) continue;
        rows.push({
          ...row,
          type_demande: type,
          circuit_etapes: describeEtapes(row, ctx, history.get(Number(row.id)) || []),
          validation_info: { level: v.level, reason: v.reason, isFinal: v.isFinal },
        });
      }
      return rows;
    };

    const [declarations, utilisations] = await Promise.all([
      collect('demandes_recuperation', 'declaration'),
      collect('demandes_utilisation_recup', 'utilisation'),
    ]);

    return NextResponse.json({
      success: true,
      declarations,
      utilisations,
      validator_info: { isRH, level: validatorLevel },
    });
  } catch (error) {
    console.error('Error fetching pending recuperation validations:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
