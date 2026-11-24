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
 * GET /api/leaves/pending-validation
 * Demandes de congés que l'utilisateur connecté peut valider maintenant
 * (étape 1, 2, 3, … du parcours, ou validation finale pour la RH).
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

    const [result, history] = await Promise.all([
      db.execute(`
        SELECT d.*, u.nom, u.prenom, u.email, u.type_utilisateur, u.responsable_id,
               v1.nom as validateur_n1_nom, v1.prenom as validateur_n1_prenom,
               v2.nom as validateur_n2_nom, v2.prenom as validateur_n2_prenom
        FROM demandes_conges d
        INNER JOIN users u ON d.user_id = u.id
        LEFT JOIN users v1 ON d.validateur_niveau_1_id = v1.id
        LEFT JOIN users v2 ON d.validateur_niveau_2_id = v2.id
        WHERE d.statut = 'en_attente'
        ORDER BY d.date_demande ASC
      `),
      loadValidationHistory('demandes_conges'),
    ]);

    const leaves = [];
    for (const leave of result.rows) {
      const validation = await canUserValidateLeave(userId, leave, ctx);
      if (!validation.canValidate) continue;
      leaves.push({
        ...leave,
        circuit_etapes: describeEtapes(leave, ctx, history.get(Number(leave.id)) || []),
        validation_info: {
          level: validation.level,
          reason: validation.reason,
          isFinal: validation.isFinal,
        },
      });
    }

    return NextResponse.json({
      success: true,
      leaves,
      validator_info: { isRH, level: validatorLevel },
    });
  } catch (error) {
    console.error('Error fetching pending validations:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
