import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRH } from '@/lib/auth';

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
        SELECT d.id, d.type, d.jours, d.motif, d.statut,
               strftime('%d/%m/%Y', d.date_demande) as date_demande,
               strftime('%d/%m/%Y', d.date_validation) as date_validation,
               d.commentaire_rh,
               u.nom, u.prenom, u.service, u.poste,
               c.solde as solde_cet
        FROM demandes_cet d
        JOIN users u ON d.user_id = u.id
        LEFT JOIN cet c ON d.user_id = c.user_id
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
    console.error('Error fetching CET requests:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la récupération des demandes CET' },
      { status: 500 }
    );
  }
}
