import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRH } from '@/lib/auth';

// GET - Récupérer toutes les demandes de récupération (RH/DGS)
export async function GET() {
  try {
    const { authorized } = await requireRH();
    if (!authorized) {
      return NextResponse.json(
        { success: false, message: 'Accès refusé' },
        { status: 403 }
      );
    }

    const result = await db.execute({
      sql: `
        SELECT d.id, d.user_id, d.date_travail, d.nombre_heures, d.raison,
               d.type_compensation, d.statut, d.commentaire, d.signature,
               strftime('%d/%m/%Y', d.date_travail) as date_travail_fr,
               strftime('%d/%m/%Y', d.date_demande) as date_demande_fr,
               strftime('%d/%m/%Y', d.date_validation) as date_validation_fr,
               u.nom, u.prenom, u.service, u.poste,
               v.nom as validateur_nom, v.prenom as validateur_prenom
        FROM demandes_recuperation d
        JOIN users u ON d.user_id = u.id
        LEFT JOIN users v ON d.validateur_id = v.id
        ORDER BY
          CASE d.statut WHEN 'en_attente' THEN 0 ELSE 1 END,
          d.date_demande DESC
      `,
      args: []
    });

    return NextResponse.json({
      success: true,
      demandes: result.rows || []
    });
  } catch (error) {
    console.error('Error fetching all recuperation requests:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la récupération des données' },
      { status: 500 }
    );
  }
}
