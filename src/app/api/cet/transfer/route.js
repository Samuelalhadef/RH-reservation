import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { notifyCetRequest } from '@/lib/pushNotifications';

export async function POST(request) {
  try {
    const { authenticated, user } = await requireAuth();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Non authentifié' },
        { status: 401 }
      );
    }

    const { jours, type = 'credit', motif } = await request.json();

    if (!jours || jours <= 0) {
      return NextResponse.json(
        { success: false, message: 'Nombre de jours invalide' },
        { status: 400 }
      );
    }

    if (!['credit', 'debit'].includes(type)) {
      return NextResponse.json(
        { success: false, message: 'Type de demande invalide' },
        { status: 400 }
      );
    }

    // Vérifier qu'il n'y a pas déjà une demande en attente du même type
    const pendingResult = await db.execute({
      sql: 'SELECT id FROM demandes_cet WHERE user_id = ? AND type = ? AND statut = ?',
      args: [user.userId, type, 'en_attente']
    });

    if (pendingResult.rows.length > 0) {
      return NextResponse.json(
        { success: false, message: `Vous avez déjà une demande de ${type === 'credit' ? 'versement' : 'retrait'} CET en attente de validation.` },
        { status: 400 }
      );
    }

    // Vérifier l'ancienneté (minimum 1 an)
    const userResult = await db.execute({
      sql: 'SELECT date_entree_mairie FROM users WHERE id = ?',
      args: [user.userId]
    });

    const dateEntree = userResult.rows[0]?.date_entree_mairie;
    if (!dateEntree) {
      return NextResponse.json(
        { success: false, message: 'Date d\'entrée à la mairie non renseignée. Contactez les RH.' },
        { status: 403 }
      );
    }

    const entree = new Date(dateEntree);
    const now = new Date();
    const diffMs = now - entree;
    const oneYearMs = 365.25 * 24 * 60 * 60 * 1000;
    if (diffMs < oneYearMs) {
      return NextResponse.json(
        { success: false, message: 'Vous devez avoir au moins 1 an d\'ancienneté à la mairie pour utiliser le CET.' },
        { status: 403 }
      );
    }

    const currentYear = new Date().getFullYear();

    if (type === 'credit') {
      // === Versement congés -> CET ===

      const balanceResult = await db.execute({
        sql: 'SELECT jours_restants, jours_pris FROM soldes_conges WHERE user_id = ? AND annee = ?',
        args: [user.userId, currentYear]
      });

      if (balanceResult.rows.length === 0 || balanceResult.rows[0].jours_restants < jours) {
        return NextResponse.json(
          { success: false, message: 'Solde de congés insuffisant' },
          { status: 400 }
        );
      }

      const joursPris = balanceResult.rows[0].jours_pris || 0;
      if (joursPris < 20) {
        return NextResponse.json(
          { success: false, message: `Vous devez avoir pris au moins 20 jours de congé. Jours pris cette année : ${joursPris}.` },
          { status: 403 }
        );
      }

      // Limite 5 jours/an (inclure les demandes en attente)
      const transfersThisYear = await db.execute({
        sql: `
          SELECT COALESCE(SUM(jours), 0) as total
          FROM cet_historique
          WHERE user_id = ? AND type = 'credit' AND strftime('%Y', date_operation) = ?
        `,
        args: [user.userId, String(currentYear)]
      });
      const pendingCredits = await db.execute({
        sql: `
          SELECT COALESCE(SUM(jours), 0) as total
          FROM demandes_cet
          WHERE user_id = ? AND type = 'credit' AND statut = 'en_attente' AND strftime('%Y', date_demande) = ?
        `,
        args: [user.userId, String(currentYear)]
      });

      const dejaTransferes = (transfersThisYear.rows[0]?.total || 0) + (pendingCredits.rows[0]?.total || 0);
      const resteDisponible = 5 - dejaTransferes;

      if (resteDisponible <= 0) {
        return NextResponse.json(
          { success: false, message: 'Vous avez déjà atteint la limite de 5 jours vers le CET cette année.' },
          { status: 403 }
        );
      }

      if (jours > resteDisponible) {
        return NextResponse.json(
          { success: false, message: `Vous ne pouvez transférer que ${resteDisponible} jour(s) de plus cette année (limite 5 jours/an).` },
          { status: 403 }
        );
      }

      // Plafond 60 jours
      await db.execute({
        sql: 'INSERT OR IGNORE INTO cet (user_id, solde) VALUES (?, 0)',
        args: [user.userId]
      });
      const cetResult = await db.execute({
        sql: 'SELECT solde FROM cet WHERE user_id = ?',
        args: [user.userId]
      });
      const soldeCET = cetResult.rows[0]?.solde || 0;
      if (soldeCET + jours > 60) {
        const place = 60 - soldeCET;
        return NextResponse.json(
          { success: false, message: place <= 0 ? 'Votre CET a atteint le plafond de 60 jours.' : `Vous ne pouvez transférer que ${place} jour(s) (plafond 60 jours).` },
          { status: 403 }
        );
      }

    } else {
      // === Retrait CET -> congés ===

      await db.execute({
        sql: 'INSERT OR IGNORE INTO cet (user_id, solde) VALUES (?, 0)',
        args: [user.userId]
      });
      const cetResult = await db.execute({
        sql: 'SELECT solde FROM cet WHERE user_id = ?',
        args: [user.userId]
      });
      const soldeCET = cetResult.rows[0]?.solde || 0;

      if (jours > soldeCET) {
        return NextResponse.json(
          { success: false, message: `Solde CET insuffisant (${soldeCET} jour(s) disponible(s)).` },
          { status: 400 }
        );
      }
    }

    // Créer la demande CET (en attente de validation RH)
    await db.execute({
      sql: `
        INSERT INTO demandes_cet (user_id, type, jours, motif)
        VALUES (?, ?, ?, ?)
      `,
      args: [user.userId, type, jours, motif || (type === 'credit' ? 'Versement congés vers CET' : 'Retrait CET vers solde congés')]
    });

    // Notifier les RH par push
    try {
      const userNameResult = await db.execute({
        sql: 'SELECT nom, prenom FROM users WHERE id = ?',
        args: [user.userId]
      });
      const userName = userNameResult.rows[0]
        ? `${userNameResult.rows[0].prenom} ${userNameResult.rows[0].nom}`
        : 'Un agent';
      await notifyCetRequest(userName, type);
    } catch (e) { /* ignore push errors */ }

    const label = type === 'credit' ? 'versement vers le CET' : 'retrait du CET vers le solde congés';
    return NextResponse.json({
      success: true,
      message: `Demande de ${label} de ${jours} jour(s) envoyée aux RH pour validation.`
    });
  } catch (error) {
    console.error('Error creating CET request:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la demande: ' + error.message },
      { status: 500 }
    );
  }
}
