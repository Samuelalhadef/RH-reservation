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

    const currentYear = new Date().getFullYear();

    const result = await db.execute({
      sql: `
        SELECT u.id, u.nom, u.prenom, u.email, u.type_utilisateur, u.actif,
               sc.jours_acquis, sc.jours_pris, sc.jours_restants, sc.jours_reportes
        FROM users u
        LEFT JOIN soldes_conges sc ON u.id = sc.user_id AND sc.annee = ?
        ORDER BY u.nom, u.prenom
      `,
      args: [currentYear]
    });

    return NextResponse.json({
      success: true,
      users: result.rows
    });
  } catch (error) {
    console.error('Error fetching users with balances:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la récupération des utilisateurs' },
      { status: 500 }
    );
  }
}
