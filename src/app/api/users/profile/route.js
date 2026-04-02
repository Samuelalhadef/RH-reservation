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
        SELECT u.id, u.nom, u.prenom, u.email, u.type_utilisateur, u.service, u.poste, u.photo_profil, u.date_entree_mairie,
               sc.jours_acquis, sc.jours_pris, sc.jours_restants, sc.jours_reportes, sc.jours_fractionnement, sc.jours_compensateurs,
               COALESCE(sr.heures_acquises, 0) as heures_recuperation
        FROM users u
        LEFT JOIN soldes_conges sc ON u.id = sc.user_id AND sc.annee = ?
        LEFT JOIN soldes_recuperation sr ON u.id = sr.user_id
        WHERE u.id = ?
      `,
      args: [new Date().getFullYear(), user.userId]
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    const profile = result.rows[0];
    // Ajouter 'type' pour cohérence avec le format du login (user.type)
    profile.type = profile.type_utilisateur;

    const response = NextResponse.json({
      success: true,
      user: profile
    });
    response.headers.set('Cache-Control', 'private, max-age=60');
    return response;
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la récupération du profil' },
      { status: 500 }
    );
  }
}

