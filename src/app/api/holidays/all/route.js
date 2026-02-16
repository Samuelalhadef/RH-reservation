import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getFrenchHolidaysRange } from '@/lib/holidays';

export async function GET() {
  try {
    const { authenticated } = await requireAuth();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Non authentifié' },
        { status: 401 }
      );
    }

    const currentYear = new Date().getFullYear();
    const holidays = getFrenchHolidaysRange(currentYear - 1, currentYear + 5);

    const response = NextResponse.json({
      success: true,
      holidays
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
