import { NextResponse } from 'next/server';
import { getLoginUsers } from '@/lib/loginUsers';

export async function GET() {
  try {
    const users = await getLoginUsers();

    return NextResponse.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la récupération des utilisateurs' },
      { status: 500 }
    );
  }
}
