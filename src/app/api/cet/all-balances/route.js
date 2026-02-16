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
        SELECT
          u.id,
          u.nom,
          u.prenom,
          u.service,
          u.poste,
          u.type_utilisateur,
          COALESCE(c.solde, 0) as solde_cet,
          c.date_creation as cet_date_creation,
          (SELECT COUNT(*) FROM demandes_cet WHERE user_id = u.id AND statut = 'en_attente') as demandes_en_attente,
          (SELECT SUM(jours) FROM demandes_cet WHERE user_id = u.id AND type = 'credit' AND statut = 'validee' AND strftime('%Y', date_validation) = ?) as jours_credites_annee,
          (SELECT SUM(jours) FROM demandes_cet WHERE user_id = u.id AND type = 'debit' AND statut = 'validee' AND strftime('%Y', date_validation) = ?) as jours_debites_annee
        FROM users u
        LEFT JOIN cet c ON u.id = c.user_id
        WHERE u.actif = 1
        ORDER BY u.service, u.nom, u.prenom
      `,
      args: [new Date().getFullYear().toString(), new Date().getFullYear().toString()]
    });

    return NextResponse.json({
      success: true,
      balances: result.rows
    });
  } catch (error) {
    console.error('Error fetching CET balances:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la récupération des soldes CET' },
      { status: 500 }
    );
  }
}
