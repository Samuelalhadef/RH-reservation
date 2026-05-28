import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { sendPushToRH } from '@/lib/pushNotifications';

// GET - Récupérer mes demandes de parentalité
export async function GET() {
  try {
    const { authenticated, user } = await requireAuth();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Non authentifié' }, { status: 401 });
    }

    const result = await db.execute({
      sql: `
        SELECT d.*,
               strftime('%d/%m/%Y', d.date_debut) as date_debut_fr,
               strftime('%d/%m/%Y', d.date_fin) as date_fin_fr,
               strftime('%d/%m/%Y', d.date_demande) as date_demande_fr,
               strftime('%d/%m/%Y', d.date_validation) as date_validation_fr,
               v.nom as validateur_nom, v.prenom as validateur_prenom
        FROM demandes_parentalite d
        LEFT JOIN users v ON d.validateur_id = v.id
        WHERE d.user_id = ?
        ORDER BY d.date_demande DESC
      `,
      args: [user.userId]
    });

    return NextResponse.json({
      success: true,
      demandes: result.rows || []
    });
  } catch (error) {
    console.error('Error fetching parentalite requests:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la récupération des données' },
      { status: 500 }
    );
  }
}

// POST - Créer une demande de parentalité
export async function POST(request) {
  try {
    const { authenticated, user } = await requireAuth();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Non authentifié' }, { status: 401 });
    }

    const { type, date_debut, date_fin, motif, document_data } = await request.json();

    if (!type || !date_debut || !date_fin) {
      return NextResponse.json(
        { success: false, message: 'Type, date de début et date de fin sont requis' },
        { status: 400 }
      );
    }

    if (!['maternite', 'paternite', 'adoption'].includes(type)) {
      return NextResponse.json(
        { success: false, message: 'Type de congé invalide' },
        { status: 400 }
      );
    }

    const debut = new Date(date_debut);
    const fin = new Date(date_fin);
    if (fin < debut) {
      return NextResponse.json(
        { success: false, message: 'La date de fin doit être après la date de début' },
        { status: 400 }
      );
    }

    // Nombre de jours calendaires (inclusif)
    const nombreJours = Math.round((fin - debut) / (1000 * 60 * 60 * 24)) + 1;

    // Récupérer le nom de l'utilisateur pour la notification
    const userResult = await db.execute({
      sql: 'SELECT nom, prenom FROM users WHERE id = ?',
      args: [user.userId]
    });
    const userName = userResult.rows[0]
      ? `${userResult.rows[0].prenom} ${userResult.rows[0].nom}`
      : 'Un agent';

    // Créer la demande
    const result = await db.execute({
      sql: `
        INSERT INTO demandes_parentalite (user_id, type, date_debut, date_fin, nombre_jours, motif, document_data)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      args: [user.userId, type, date_debut, date_fin, nombreJours, motif || null, document_data || null]
    });

    // Notifier la RH directement (pas de circuit hiérarchique pour ces congés légaux)
    const typeLabel = type === 'maternite' ? 'maternité' : type === 'paternite' ? 'paternité' : 'adoption';
    try {
      await sendPushToRH({
        title: `Nouvelle demande de congé ${typeLabel}`,
        body: `${userName} a fait une demande de congé ${typeLabel}`,
        url: '/rh',
        tag: 'parentalite-request'
      });
    } catch (e) { /* ignore push errors */ }

    return NextResponse.json({
      success: true,
      message: 'Demande de congé envoyée avec succès',
      id: Number(result.lastInsertRowid)
    });
  } catch (error) {
    console.error('Error creating parentalite request:', error);
    return NextResponse.json(
      { success: false, message: `Erreur: ${error.message}` },
      { status: 500 }
    );
  }
}
