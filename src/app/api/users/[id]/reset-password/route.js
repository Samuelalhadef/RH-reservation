import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { db } from '@/lib/db';
import { requireRH } from '@/lib/auth';
import { sendTemporaryPasswordEmail } from '@/lib/email';

export async function POST(request, { params }) {
  try {
    const { authorized } = await requireRH();
    if (!authorized) {
      return NextResponse.json(
        { success: false, message: 'Accès refusé' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const result = await db.execute({
      sql: 'SELECT nom, prenom, email FROM users WHERE id = ?',
      args: [id]
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    const user = result.rows[0];

    const tempPassword = Math.random().toString(36).slice(-10);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    await db.execute({
      sql: 'UPDATE users SET mot_de_passe = ?, mot_de_passe_temporaire = 1 WHERE id = ?',
      args: [hashedPassword, id]
    });

    await sendTemporaryPasswordEmail(
      user.email,
      `${user.prenom} ${user.nom}`,
      tempPassword
    );

    return NextResponse.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès',
      tempPassword
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la réinitialisation du mot de passe' },
      { status: 500 }
    );
  }
}
