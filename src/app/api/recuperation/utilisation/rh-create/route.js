import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRH } from '@/lib/auth';

// POST - La RH pose une récupération pour un agent (validation directe, sans contrainte de date)
export async function POST(request) {
  try {
    const { authorized, user } = await requireRH();
    if (!authorized) {
      return NextResponse.json(
        { success: false, message: 'Accès refusé - Réservé aux RH' },
        { status: 403 }
      );
    }

    const { user_id, date_debut, date_fin, nombre_heures, raison } = await request.json();

    if (!user_id || !date_debut || !date_fin || !nombre_heures) {
      return NextResponse.json(
        { success: false, message: 'Agent, dates et nombre d\'heures sont requis' },
        { status: 400 }
      );
    }

    const heures = parseFloat(nombre_heures);
    if (isNaN(heures) || heures <= 0) {
      return NextResponse.json(
        { success: false, message: 'Le nombre d\'heures doit être positif' },
        { status: 400 }
      );
    }

    if (new Date(date_debut) > new Date(date_fin)) {
      return NextResponse.json(
        { success: false, message: 'La date de début doit être avant la date de fin' },
        { status: 400 }
      );
    }

    // Vérifier que l'agent existe
    const agentResult = await db.execute({
      sql: 'SELECT id FROM users WHERE id = ?',
      args: [user_id]
    });
    if (agentResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Agent introuvable' },
        { status: 404 }
      );
    }

    // Vérifier le solde disponible (acquis - utilisé/en_attente)
    const soldeResult = await db.execute({
      sql: 'SELECT COALESCE(heures_acquises, 0) as heures_acquises FROM soldes_recuperation WHERE user_id = ?',
      args: [user_id]
    });
    const heuresAcquises = soldeResult.rows[0]?.heures_acquises || 0;

    const usedResult = await db.execute({
      sql: `SELECT COALESCE(SUM(nombre_heures), 0) as total
            FROM demandes_utilisation_recup
            WHERE user_id = ? AND statut IN ('validee', 'en_attente')`,
      args: [user_id]
    });
    const heuresUtilisees = usedResult.rows[0]?.total || 0;

    const soldeDisponible = heuresAcquises - heuresUtilisees;
    if (heures > soldeDisponible) {
      return NextResponse.json({
        success: false,
        message: `Solde insuffisant pour cet agent. Disponible : ${soldeDisponible}h (acquis : ${heuresAcquises}h, déjà posé/validé : ${heuresUtilisees}h)`
      }, { status: 400 });
    }

    const rhUserId = user.userId || user.id;

    // Insertion directement validée
    await db.execute({
      sql: `INSERT INTO demandes_utilisation_recup
            (user_id, date_debut, date_fin, nombre_heures, raison, statut, date_validation, validateur_id, commentaire)
            VALUES (?, ?, ?, ?, ?, 'validee', CURRENT_TIMESTAMP, ?, ?)`,
      args: [
        user_id,
        date_debut,
        date_fin,
        heures,
        raison || '',
        rhUserId,
        'Récupération posée par la RH'
      ]
    });

    return NextResponse.json({
      success: true,
      message: 'Récupération placée et validée avec succès'
    }, { status: 201 });
  } catch (error) {
    console.error('Error placing recuperation (RH):', error);
    return NextResponse.json(
      { success: false, message: `Erreur: ${error.message}` },
      { status: 500 }
    );
  }
}
