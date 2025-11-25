import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { db } from '@/lib/db';
import { requireRH } from '@/lib/auth';
import { sendTemporaryPasswordEmail } from '@/lib/email';

export async function POST(request) {
  try {
    const { authorized } = await requireRH();
    if (!authorized) {
      return NextResponse.json(
        { success: false, message: 'Accès refusé' },
        { status: 403 }
      );
    }

    const { nom, prenom, email, type_utilisateur } = await request.json();

    if (!nom || !prenom || !email || !type_utilisateur) {
      return NextResponse.json(
        { success: false, message: 'Tous les champs sont requis' },
        { status: 400 }
      );
    }

    const existingUser = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [email]
    });

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { success: false, message: 'Cet email est déjà utilisé' },
        { status: 400 }
      );
    }

    const tempPassword = Math.random().toString(36).slice(-10);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const result = await db.execute({
      sql: `
        INSERT INTO users (nom, prenom, email, mot_de_passe, type_utilisateur, mot_de_passe_temporaire)
        VALUES (?, ?, ?, ?, ?, 1)
      `,
      args: [nom, prenom, email, hashedPassword, type_utilisateur]
    });

    const userId = result.lastInsertRowid;

    const currentYear = new Date().getFullYear();
    await db.execute({
      sql: `
        INSERT INTO soldes_conges (user_id, annee, jours_acquis, jours_pris, jours_restants, jours_reportes)
        VALUES (?, ?, 25, 0, 25, 0)
      `,
      args: [userId, currentYear]
    });

    await sendTemporaryPasswordEmail(email, `${prenom} ${nom}`, tempPassword);

    return NextResponse.json({
      success: true,
      message: 'Utilisateur créé avec succès',
      user: {
        id: userId,
        nom,
        prenom,
        email,
        type_utilisateur
      },
      tempPassword
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la création de l\'utilisateur' },
      { status: 500 }
    );
  }
}
