import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getFrenchHolidays } from '@/lib/holidays';

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
    const year = parseInt(searchParams.get('year')) || new Date().getFullYear();

    const holidays = getFrenchHolidays(year);

    return NextResponse.json({
      success: true,
      holidays
    });
  } catch (error) {
    console.error('Error fetching holidays:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la récupération des jours fériés' },
      { status: 500 }
    );
  }
}
