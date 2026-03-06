import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRH } from '@/lib/auth';
import { notifyRecuperationDecision } from '@/lib/pushNotifications';

// GET - Récupérer une demande spécifique (avec document)
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const result = await db.execute({
      sql: `
        SELECT d.*,
               u.nom, u.prenom, u.service, u.poste,
               strftime('%d/%m/%Y', d.date_travail) as date_travail_fr,
               strftime('%d/%m/%Y', d.date_demande) as date_demande_fr
        FROM demandes_recuperation d
        JOIN users u ON d.user_id = u.id
        WHERE d.id = ?
      `,
      args: [id]
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Demande non trouvée' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      demande: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching recuperation request:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// PUT - Valider/Refuser une demande (DGS/RH uniquement)
export async function PUT(request, { params }) {
  try {
    const { authorized, user } = await requireRH();
    if (!authorized) {
      return NextResponse.json(
        { success: false, message: 'Accès refusé' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { action, commentaire } = await request.json();

    if (!['valider', 'refuser'].includes(action)) {
      return NextResponse.json(
        { success: false, message: 'Action invalide' },
        { status: 400 }
      );
    }

    // Récupérer la demande
    const demandeResult = await db.execute({
      sql: 'SELECT * FROM demandes_recuperation WHERE id = ? AND statut = ?',
      args: [id, 'en_attente']
    });

    if (demandeResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Demande non trouvée ou déjà traitée' },
        { status: 404 }
      );
    }

    const demande = demandeResult.rows[0];
    const newStatut = action === 'valider' ? 'validee' : 'refusee';

    // Mettre à jour le statut
    await db.execute({
      sql: `
        UPDATE demandes_recuperation
        SET statut = ?, date_validation = CURRENT_TIMESTAMP, validateur_id = ?, commentaire = ?
        WHERE id = ?
      `,
      args: [newStatut, user.userId, commentaire || null, id]
    });

    // Si validée et type = récupération, ajouter les heures au solde
    if (action === 'valider' && demande.type_compensation === 'recuperation') {
      // Recalculer le solde total depuis toutes les demandes validées
      const totalResult = await db.execute({
        sql: `
          SELECT COALESCE(SUM(nombre_heures), 0) as total
          FROM demandes_recuperation
          WHERE user_id = ? AND statut = 'validee' AND type_compensation = 'recuperation'
        `,
        args: [demande.user_id]
      });

      const totalHeures = totalResult.rows[0]?.total || 0;

      await db.execute({
        sql: 'INSERT OR IGNORE INTO soldes_recuperation (user_id, heures_acquises) VALUES (?, 0)',
        args: [demande.user_id]
      });

      await db.execute({
        sql: 'UPDATE soldes_recuperation SET heures_acquises = ?, date_maj = CURRENT_TIMESTAMP WHERE user_id = ?',
        args: [totalHeures, demande.user_id]
      });
    }

    // Notifier l'agent
    try {
      await notifyRecuperationDecision(demande.user_id, action, demande.type_compensation);
    } catch (e) { /* ignore push errors */ }

    return NextResponse.json({
      success: true,
      message: `Demande ${action === 'valider' ? 'validée' : 'refusée'} avec succès`
    });
  } catch (error) {
    console.error('Error processing recuperation request:', error);
    return NextResponse.json(
      { success: false, message: `Erreur: ${error.message}` },
      { status: 500 }
    );
  }
}
