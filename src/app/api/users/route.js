import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { db } from '@/lib/db';
import { requireRH } from '@/lib/auth';

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

    const { nom, prenom, email, type_utilisateur, service, poste, type_contrat, date_debut_contrat, date_fin_contrat, date_entree_mairie, quotite_travail, responsable_id } = body;

    if (!nom || !prenom || !type_utilisateur) {
      return NextResponse.json(
        { success: false, message: 'Nom, prénom et type sont requis' },
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

    if (email) {
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
    }

    console.log('Generating password and hashing...');
    const tempPassword = 'Chartrettes';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    console.log('Creating user in database...');
    const result = await db.execute({
      sql: `
        INSERT INTO users (nom, prenom, email, mot_de_passe, type_utilisateur, service, poste, mot_de_passe_temporaire, type_contrat, date_debut_contrat, date_fin_contrat, date_entree_mairie, quotite_travail, responsable_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
      `,
      args: [nom, prenom, email || `${prenom.toLowerCase()}.${nom.toLowerCase()}@mairie-chartrettes.fr`, hashedPassword, type_utilisateur, service || null, poste || null, type_contrat || 'CDI', date_debut_contrat || null, date_fin_contrat || null, date_entree_mairie || null, quotite_travail || 100, responsable_id || null]
    });

    const userId = Number(result.lastInsertRowid);
    console.log('User created with ID:', userId);

    const currentYear = new Date().getFullYear();
    console.log('Creating balance for year:', currentYear);

    // Calculer les jours acquis selon le type de contrat
    const joursAcquis = calculateLeaveBalance(type_contrat || 'CDI', date_debut_contrat, date_fin_contrat, currentYear, quotite_travail || 100);
    console.log(`Calculated leave balance: ${joursAcquis} days for ${type_contrat || 'CDI'}`);

    await db.execute({
      sql: `
        INSERT INTO soldes_conges (user_id, annee, jours_acquis, jours_pris, jours_restants, jours_reportes, jours_fractionnement)
        VALUES (?, ?, ?, 0, ?, 0, 0)
      `,
      args: [userId, currentYear, joursAcquis, joursAcquis]
    });

    console.log('Balance created successfully');

    // Auto-configurer niveau_validation selon le type de l'utilisateur créé
    const NIVEAU_PAR_TYPE = {
      'Directeur Vie Locale': 2,
      'Responsable Anim.': 1,
      'Responsable Serv. Tech.': 1,
      'Responsable': 1,
      'Responsable Vie Locale': 1,
    };
    if (NIVEAU_PAR_TYPE[type_utilisateur]) {
      await db.execute({
        sql: 'UPDATE users SET niveau_validation = ? WHERE id = ?',
        args: [NIVEAU_PAR_TYPE[type_utilisateur], userId]
      });
    }

    // Auto-configurer niveau_validation du responsable assigné et de son supérieur
    if (responsable_id) {
      await db.execute({
        sql: 'UPDATE users SET niveau_validation = MAX(COALESCE(niveau_validation, 0), 1) WHERE id = ?',
        args: [responsable_id]
      });
      // Si le responsable a lui-même un responsable, celui-ci devient niveau 2
      const parentResp = await db.execute({
        sql: 'SELECT responsable_id FROM users WHERE id = ?',
        args: [responsable_id]
      });
      if (parentResp.rows.length > 0 && parentResp.rows[0].responsable_id) {
        await db.execute({
          sql: 'UPDATE users SET niveau_validation = MAX(COALESCE(niveau_validation, 0), 2) WHERE id = ?',
          args: [parentResp.rows[0].responsable_id]
        });
      }
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
