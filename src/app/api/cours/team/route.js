import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request) {
  try {
    const { authenticated } = await requireAuth();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Non authentifié' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || new Date().getFullYear();
    const month = searchParams.get('month');

    let sql = `
      SELECT jc.id, jc.date, jc.user_id,
             u.nom, u.prenom
      FROM jours_cours jc
      JOIN users u ON jc.user_id = u.id
      WHERE strftime('%Y', jc.date) = ?
    `;
    const args = [year.toString()];

    if (month) {
      sql += ' AND strftime("%m", jc.date) = ?';
      args.push(month.toString().padStart(2, '0'));
    }

    sql += ' ORDER BY jc.date';

    const result = await db.execute({ sql, args });

    return NextResponse.json({
      success: true,
      jours: result.rows
    });
  } catch (error) {
    console.error('Error fetching team cours days:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la récupération des jours en cours' },
      { status: 500 }
    );
  }
}
