import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request) {
  try {
    const { authenticated, user } = await requireAuth();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Non authentifié' },
        { status: 401 }
      );
    }

    const userId = user.userId || user.id;
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    let sql = `
      SELECT dc.id, dc.date_debut, dc.date_fin, dc.nombre_jours_ouvres, dc.statut,
             dc.type_debut, dc.type_fin,
             u.id as user_id, u.nom, u.prenom, u.type_utilisateur
      FROM demandes_conges dc
      JOIN users u ON dc.user_id = u.id
      WHERE dc.statut IN ('validee', 'en_attente')
      AND dc.user_id = ?
    `;
    const args = [userId];

    if (year) {
      sql += ' AND strftime("%Y", dc.date_debut) = ?';
      args.push(year.toString());
    }

    if (month) {
      sql += ' AND strftime("%m", dc.date_debut) = ?';
      args.push(month.toString().padStart(2, '0'));
    }

    sql += ' ORDER BY dc.date_debut';

    const result = await db.execute({ sql, args });

    // Récupérations posées (validées ou en attente) — pour affichage dans le calendrier
    let recupSql = `
      SELECT id, date_debut, date_fin, nombre_heures, statut, raison
      FROM demandes_utilisation_recup
      WHERE statut IN ('validee', 'en_attente')
      AND user_id = ?
    `;
    const recupArgs = [userId];

    if (year) {
      recupSql += ' AND strftime("%Y", date_debut) = ?';
      recupArgs.push(year.toString());
    }
    if (month) {
      recupSql += ' AND strftime("%m", date_debut) = ?';
      recupArgs.push(month.toString().padStart(2, '0'));
    }

    recupSql += ' ORDER BY date_debut';

    const recupResult = await db.execute({ sql: recupSql, args: recupArgs });

    return NextResponse.json({
      success: true,
      events: result.rows,
      recups: recupResult.rows
    });
  } catch (error) {
    console.error('Error fetching calendar:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la récupération du calendrier' },
      { status: 500 }
    );
  }
}
