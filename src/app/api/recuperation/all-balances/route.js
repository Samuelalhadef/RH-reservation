import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRH } from '@/lib/auth';

// GET - Soldes de récupération de tous les agents (RH)
export async function GET() {
  try {
    const { authorized } = await requireRH();
    if (!authorized) {
      return NextResponse.json({ success: false, message: 'Accès refusé' }, { status: 403 });
    }

    const result = await db.execute({
      sql: `
        SELECT
          u.id,
          u.nom,
          u.prenom,
          u.service,
          u.poste,
          u.type_utilisateur,
          COALESCE(sr.heures_acquises, 0) as heures_acquises,
          COALESCE(
            (SELECT SUM(nombre_heures) FROM demandes_utilisation_recup
             WHERE user_id = u.id AND statut IN ('validee', 'en_attente')), 0
          ) as heures_utilisees
        FROM users u
        LEFT JOIN soldes_recuperation sr ON u.id = sr.user_id
        WHERE u.actif = 1
        ORDER BY u.nom, u.prenom
      `
    });

    const balances = (result.rows || []).map(r => ({
      ...r,
      heures_disponibles: Math.max(0, (Number(r.heures_acquises) || 0) - (Number(r.heures_utilisees) || 0))
    }));

    return NextResponse.json({ success: true, balances });
  } catch (error) {
    console.error('Error fetching recup balances:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la récupération des soldes' },
      { status: 500 }
    );
  }
}
