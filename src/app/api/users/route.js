import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { db } from '@/lib/db';
import { requireRH } from '@/lib/auth';
import { sendTemporaryPasswordEmail } from '@/lib/email';
import { calculateLeaveBalance } from '@/lib/contractUtils';

export async function POST(request) {
  try {
    console.log('=== POST /api/users - Creating new user ===');

    const { authorized } = await requireRH();
    console.log('Auth check:', { authorized });

    if (!authorized) {
      return NextResponse.json(
        { success: false, message: 'Accès refusé' },
        { status: 403 }
      );
    }

    const body = await request.json();
    console.log('Request body:', body);

    const { nom, prenom, email, type_utilisateur, type_contrat, date_debut_contrat, date_fin_contrat } = body;

    if (!nom || !prenom || !email || !type_utilisateur) {
      return NextResponse.json(
        { success: false, message: 'Tous les champs sont requis' },
        { status: 400 }
      );
    }

    // Validation: si CDD, les dates sont requises
    if (type_contrat === 'CDD' && (!date_debut_contrat || !date_fin_contrat)) {
      return NextResponse.json(
        { success: false, message: 'Les dates de début et fin sont requises pour un CDD' },
        { status: 400 }
      );
    }

    console.log('Checking existing user with email:', email);
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

    console.log('Generating password and hashing...');
    const tempPassword = Math.random().toString(36).slice(-10);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    console.log('Creating user in database...');
    const result = await db.execute({
      sql: `
        INSERT INTO users (nom, prenom, email, mot_de_passe, type_utilisateur, mot_de_passe_temporaire, type_contrat, date_debut_contrat, date_fin_contrat)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
      `,
      args: [nom, prenom, email, hashedPassword, type_utilisateur, type_contrat || 'CDI', date_debut_contrat || null, date_fin_contrat || null]
    });

    const userId = Number(result.lastInsertRowid);
    console.log('User created with ID:', userId);

    const currentYear = new Date().getFullYear();
    console.log('Creating balance for year:', currentYear);

    // Calculer les jours acquis selon le type de contrat
    const joursAcquis = calculateLeaveBalance(type_contrat || 'CDI', date_debut_contrat, date_fin_contrat, currentYear);
    console.log(`Calculated leave balance: ${joursAcquis} days for ${type_contrat || 'CDI'}`);

    await db.execute({
      sql: `
        INSERT INTO soldes_conges (user_id, annee, jours_acquis, jours_pris, jours_restants, jours_reportes, jours_fractionnement)
        VALUES (?, ?, ?, 0, ?, 0, 0)
      `,
      args: [userId, currentYear, joursAcquis, joursAcquis]
    });

    console.log('Balance created successfully');

    // Envoyer l'email (ne pas bloquer si l'envoi échoue)
    try {
      await sendTemporaryPasswordEmail(email, `${prenom} ${nom}`, tempPassword);
      console.log(`Email envoyé à ${email} avec le mot de passe temporaire`);
    } catch (emailError) {
      console.error('Erreur lors de l\'envoi de l\'email, mais l\'utilisateur est créé:', emailError);
    }

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
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { success: false, message: `Erreur lors de la création de l'utilisateur: ${error.message}` },
      { status: 500 }
    );
  }
}
