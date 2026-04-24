import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    const { authenticated } = await requireAuth();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Non authentifié' },
        { status: 401 }
      );
    }

    const result = await db.execute({
      sql: `
        SELECT u.id, u.nom, u.prenom, u.type_utilisateur, u.service, u.poste,
               u.responsable_id, u.photo_profil, u.actif
        FROM users u
        WHERE u.actif = 1
          AND LOWER(u.nom) NOT LIKE '%testtest%'
          AND LOWER(u.prenom) NOT LIKE '%testtest%'
          AND NOT (LOWER(u.prenom) = 'test' AND LOWER(u.nom) = 'test')
        ORDER BY u.nom, u.prenom
      `,
      args: []
    });

    return NextResponse.json({
      success: true,
      users: result.rows || []
    });
  } catch (error) {
    console.error('Error fetching organigramme:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
