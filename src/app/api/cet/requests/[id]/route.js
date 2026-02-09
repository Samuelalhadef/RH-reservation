import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRH } from '@/lib/auth';
import { notifyCetDecision } from '@/lib/pushNotifications';

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
      sql: 'SELECT * FROM demandes_cet WHERE id = ? AND statut = ?',
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

    // Mettre à jour le statut de la demande
    await db.execute({
      sql: `
        UPDATE demandes_cet
        SET statut = ?, date_validation = CURRENT_TIMESTAMP, validateur_id = ?, commentaire_rh = ?
        WHERE id = ?
      `,
      args: [newStatut, user.userId, commentaire || null, id]
    });

    // Si validée, effectuer le transfert réel
    if (action === 'valider') {
      const currentYear = new Date().getFullYear();

      if (demande.type === 'credit') {
        // Congés -> CET : déduire du solde congés, ajouter au CET
        await db.execute({
          sql: 'UPDATE soldes_conges SET jours_restants = jours_restants - ? WHERE user_id = ? AND annee = ?',
          args: [demande.jours, demande.user_id, currentYear]
        });

        await db.execute({
          sql: 'INSERT OR IGNORE INTO cet (user_id, solde) VALUES (?, 0)',
          args: [demande.user_id]
        });

        await db.execute({
          sql: 'UPDATE cet SET solde = solde + ? WHERE user_id = ?',
          args: [demande.jours, demande.user_id]
        });

        await db.execute({
          sql: "INSERT INTO cet_historique (user_id, type, jours, motif) VALUES (?, 'credit', ?, ?)",
          args: [demande.user_id, demande.jours, demande.motif || 'Versement congés vers CET']
        });

      } else {
        // CET -> Congés : déduire du CET, ajouter au solde congés
        await db.execute({
          sql: 'UPDATE cet SET solde = solde - ? WHERE user_id = ?',
          args: [demande.jours, demande.user_id]
        });

        await db.execute({
          sql: 'UPDATE soldes_conges SET jours_restants = jours_restants + ? WHERE user_id = ? AND annee = ?',
          args: [demande.jours, demande.user_id, currentYear]
        });

        await db.execute({
          sql: "INSERT INTO cet_historique (user_id, type, jours, motif) VALUES (?, 'debit', ?, ?)",
          args: [demande.user_id, demande.jours, demande.motif || 'Retrait CET vers solde congés']
        });
      }
    }

    // Notifier l'agent par push
    try {
      await notifyCetDecision(demande.user_id, action, demande.jours);
    } catch (e) { /* ignore push errors */ }

    const label = demande.type === 'credit' ? 'versement CET' : 'retrait CET';
    return NextResponse.json({
      success: true,
      message: `Demande de ${label} ${action === 'valider' ? 'validée' : 'refusée'} avec succès`
    });
  } catch (error) {
    console.error('Error processing CET request:', error);
    return NextResponse.json(
      { success: false, message: `Erreur: ${error.message}` },
      { status: 500 }
    );
  }
}
