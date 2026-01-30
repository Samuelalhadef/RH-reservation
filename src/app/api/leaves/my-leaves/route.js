import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getValidationCircuit, getCurrentValidationLevel } from '@/lib/hierarchy';

export async function GET() {
  try {
    const { authenticated, user } = await requireAuth();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Non authentifié' },
        { status: 401 }
      );
    }

    const result = await db.execute({
      sql: `
        SELECT dc.*,
          v.nom as validateur_nom, v.prenom as validateur_prenom,
          v1.nom as validateur_n1_nom, v1.prenom as validateur_n1_prenom,
          v2.nom as validateur_n2_nom, v2.prenom as validateur_n2_prenom
        FROM demandes_conges dc
        LEFT JOIN users v ON dc.validateur_id = v.id
        LEFT JOIN users v1 ON dc.validateur_niveau_1_id = v1.id
        LEFT JOIN users v2 ON dc.validateur_niveau_2_id = v2.id
        WHERE dc.user_id = ?
        ORDER BY dc.date_demande DESC
      `,
      args: [user.userId]
    });

    // Récupérer le circuit de validation pour l'utilisateur
    let circuit = null;
    try {
      circuit = await getValidationCircuit(user.userId);
    } catch (e) {
      console.error('Error getting validation circuit:', e);
    }

    // Enrichir chaque demande avec les infos de validation
    const enrichedLeaves = result.rows.map(leave => {
      const currentLevel = getCurrentValidationLevel(leave);

      let pendingValidation = null;

      if (leave.statut === 'en_attente' && circuit) {
        // Trouver qui doit valider
        if (currentLevel === 0 && circuit.niveaux.length > 0) {
          const level1 = circuit.niveaux.find(n => n.niveau === 1);
          if (level1) {
            pendingValidation = {
              niveau: 1,
              type: 'Responsable direct',
              validateur: level1.validateur_prenom ? `${level1.validateur_prenom} ${level1.validateur_nom}` : null
            };
          } else {
            // Pas de responsable, direct RH
            pendingValidation = {
              niveau: 'rh',
              type: 'Service RH',
              validateur: null
            };
          }
        } else if (currentLevel === 1) {
          const level2 = circuit.niveaux.find(n => n.niveau === 2);
          if (level2) {
            pendingValidation = {
              niveau: 2,
              type: 'Responsable hiérarchique',
              validateur: level2.validateur_prenom ? `${level2.validateur_prenom} ${level2.validateur_nom}` : null
            };
          } else {
            pendingValidation = {
              niveau: 'rh',
              type: 'Service RH',
              validateur: null
            };
          }
        } else if (currentLevel === 2 || (currentLevel === 1 && !circuit.niveaux.find(n => n.niveau === 2))) {
          pendingValidation = {
            niveau: 'rh',
            type: 'Service RH',
            validateur: null
          };
        }
      }

      return {
        ...leave,
        validation_info: {
          current_level: currentLevel,
          pending_validation: pendingValidation,
          validated_n1: leave.statut_niveau_1 === 'validee',
          validated_n2: leave.statut_niveau_2 === 'validee',
          validateur_n1: leave.validateur_n1_nom ? `${leave.validateur_n1_prenom} ${leave.validateur_n1_nom}` : null,
          validateur_n2: leave.validateur_n2_nom ? `${leave.validateur_n2_prenom} ${leave.validateur_n2_nom}` : null,
          circuit: circuit
        }
      };
    });

    return NextResponse.json({
      success: true,
      leaves: enrichedLeaves
    });
  } catch (error) {
    console.error('Error fetching my leaves:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la récupération de vos demandes' },
      { status: 500 }
    );
  }
}
