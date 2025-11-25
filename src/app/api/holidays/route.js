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

    const result = await db.execute({
      sql: 'SELECT * FROM jours_feries WHERE annee = ? ORDER BY date',
      args: [year]
    });

    return NextResponse.json({
      success: true,
      holidays: result.rows
    });
  } catch (error) {
    console.error('Error fetching holidays:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la récupération des jours fériés' },
      { status: 500 }
    );
  }
}
