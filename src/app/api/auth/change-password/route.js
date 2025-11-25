import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(request) {
  try {
    const { authenticated, user } = await requireAuth();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Non authentifié' },
        { status: 401 }
      );
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, message: 'Mot de passe actuel et nouveau mot de passe requis' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, message: 'Le nouveau mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      );
    }

    const result = await db.execute({
      sql: 'SELECT mot_de_passe FROM users WHERE id = ?',
      args: [user.userId]
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    const isValidPassword = await bcrypt.compare(currentPassword, result.rows[0].mot_de_passe);

    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, message: 'Mot de passe actuel incorrect' },
        { status: 401 }
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.execute({
      sql: 'UPDATE users SET mot_de_passe = ?, mot_de_passe_temporaire = 0 WHERE id = ?',
      args: [hashedPassword, user.userId]
    });

    return NextResponse.json({
      success: true,
      message: 'Mot de passe modifié avec succès'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors du changement de mot de passe' },
      { status: 500 }
    );
  }
}
