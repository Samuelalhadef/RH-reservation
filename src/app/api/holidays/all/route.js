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

    const result = await db.execute('SELECT * FROM jours_feries ORDER BY date');

    const response = NextResponse.json({
      success: true,
      holidays: result.rows
    });
    response.headers.set('Cache-Control', 'public, max-age=3600');
    return response;
  } catch (error) {
    console.error('Error fetching all holidays:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la récupération des jours fériés' },
      { status: 500 }
    );
  }
}
