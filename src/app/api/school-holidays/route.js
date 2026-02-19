import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAllSchoolHolidays } from '@/lib/schoolHolidays';

export async function GET() {
  try {
    const { authenticated } = await requireAuth();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Non authentifié' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      periods: getAllSchoolHolidays()
    });
    response.headers.set('Cache-Control', 'public, max-age=86400');
    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Erreur' },
      { status: 500 }
    );
  }
}
