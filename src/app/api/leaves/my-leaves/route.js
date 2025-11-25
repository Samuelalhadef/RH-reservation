import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

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
        SELECT dc.*, v.nom as validateur_nom, v.prenom as validateur_prenom
        FROM demandes_conges dc
        LEFT JOIN users v ON dc.validateur_id = v.id
        WHERE dc.user_id = ?
        ORDER BY dc.date_demande DESC
      `,
      args: [user.userId]
    });

    return NextResponse.json({
      success: true,
      leaves: result.rows
    });
  } catch (error) {
    console.error('Error fetching my leaves:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la récupération de vos demandes' },
      { status: 500 }
    );
  }
}
