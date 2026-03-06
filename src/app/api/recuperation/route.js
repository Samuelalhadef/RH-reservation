import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { notifyRecuperationRequest } from '@/lib/pushNotifications';

// GET - Récupérer mes demandes de récupération + solde
export async function GET(request) {
  try {
    const { authenticated, user } = await requireAuth();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Non authentifié' }, { status: 401 });
    }

    const [demandesResult, soldeResult] = await Promise.all([
      db.execute({
        sql: `
          SELECT d.*,
                 strftime('%d/%m/%Y', d.date_travail) as date_travail_fr,
                 strftime('%d/%m/%Y', d.date_demande) as date_demande_fr,
                 strftime('%d/%m/%Y', d.date_validation) as date_validation_fr,
                 v.nom as validateur_nom, v.prenom as validateur_prenom
          FROM demandes_recuperation d
          LEFT JOIN users v ON d.validateur_id = v.id
          WHERE d.user_id = ?
          ORDER BY d.date_demande DESC
        `,
        args: [user.userId]
      }),
      db.execute({
        sql: 'SELECT heures_acquises FROM soldes_recuperation WHERE user_id = ?',
        args: [user.userId]
      })
    ]);

    return NextResponse.json({
      success: true,
      demandes: demandesResult.rows || [],
      heures_acquises: soldeResult.rows[0]?.heures_acquises || 0
    });
  } catch (error) {
    console.error('Error fetching recuperation:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la récupération des données' },
      { status: 500 }
    );
  }
}

// POST - Créer une demande de récupération
export async function POST(request) {
  try {
    const { authenticated, user } = await requireAuth();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Non authentifié' }, { status: 401 });
    }

    const { date_travail, nombre_heures, raison, type_compensation, signature, document_data } = await request.json();

    // Validations
    if (!date_travail || !nombre_heures || !raison || !type_compensation || !signature) {
      return NextResponse.json(
        { success: false, message: 'Tous les champs sont requis, y compris la signature' },
        { status: 400 }
      );
    }

    if (!['remuneration', 'recuperation'].includes(type_compensation)) {
      return NextResponse.json(
        { success: false, message: 'Type de compensation invalide' },
        { status: 400 }
      );
    }

    const heures = parseFloat(nombre_heures);
    if (isNaN(heures) || heures <= 0 || heures > 24) {
      return NextResponse.json(
        { success: false, message: 'Le nombre d\'heures doit être entre 0 et 24' },
        { status: 400 }
      );
    }

    // Vérifier que la date de travail est dans le passé ou aujourd'hui
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateTravail = new Date(date_travail);
    if (dateTravail > today) {
      return NextResponse.json(
        { success: false, message: 'La date de travail ne peut pas être dans le futur' },
        { status: 400 }
      );
    }

    // Récupérer le nom de l'utilisateur pour la notification
    const userResult = await db.execute({
      sql: 'SELECT nom, prenom FROM users WHERE id = ?',
      args: [user.userId]
    });
    const userName = userResult.rows[0] ? `${userResult.rows[0].prenom} ${userResult.rows[0].nom}` : 'Un agent';

    // Créer la demande
    const result = await db.execute({
      sql: `
        INSERT INTO demandes_recuperation (user_id, date_travail, nombre_heures, raison, type_compensation, signature, document_data)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      args: [user.userId, date_travail, heures, raison, type_compensation, signature, document_data || null]
    });

    // Notifier la DGS/RH
    try {
      await notifyRecuperationRequest(userName);
    } catch (e) { /* ignore push errors */ }

    return NextResponse.json({
      success: true,
      message: 'Demande de récupération envoyée avec succès',
      id: Number(result.lastInsertRowid)
    });
  } catch (error) {
    console.error('Error creating recuperation request:', error);
    return NextResponse.json(
      { success: false, message: `Erreur: ${error.message}` },
      { status: 500 }
    );
  }
}
