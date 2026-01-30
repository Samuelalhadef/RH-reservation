import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRH } from '@/lib/auth';
import { calculateBusinessDays } from '@/lib/dateUtils';

export async function POST(request) {
  try {
    const { authorized, user } = await requireRH();
    if (!authorized) {
      return NextResponse.json(
        { success: false, message: 'Accès refusé - Réservé aux RH' },
        { status: 403 }
      );
    }

    const { user_id, date_debut, date_fin, motif } = await request.json();

    if (!user_id || !date_debut || !date_fin) {
      return NextResponse.json(
        { success: false, message: 'Tous les champs obligatoires doivent être remplis' },
        { status: 400 }
      );
    }

    if (new Date(date_debut) > new Date(date_fin)) {
      return NextResponse.json(
        { success: false, message: 'La date de début doit être avant la date de fin' },
        { status: 400 }
      );
    }

    // Récupérer les jours fériés
    const holidaysResult = await db.execute({
      sql: `SELECT date FROM jours_feries WHERE date >= ? AND date <= ?`,
      args: [date_debut, date_fin]
    });
    const holidays = holidaysResult.rows.map(row => row.date);

    // Calculer les jours ouvrés
    let businessDays = calculateBusinessDays(date_debut, date_fin, holidays);

    if (businessDays === 0) {
      return NextResponse.json(
        { success: false, message: 'La période sélectionnée ne contient aucun jour ouvré' },
        { status: 400 }
      );
    }

    // Vérifier le solde de l'utilisateur
    const currentYear = new Date().getFullYear();
    const balanceResult = await db.execute({
      sql: 'SELECT jours_restants FROM soldes_conges WHERE user_id = ? AND annee = ?',
      args: [user_id, currentYear]
    });

    let joursRestants = 25;
    if (!balanceResult.rows || balanceResult.rows.length === 0) {
      // Créer le solde s'il n'existe pas
      await db.execute({
        sql: `INSERT INTO soldes_conges (user_id, annee, jours_acquis, jours_pris, jours_restants)
              VALUES (?, ?, 25, 0, 25)`,
        args: [user_id, currentYear]
      });
    } else {
      joursRestants = balanceResult.rows[0].jours_restants;
    }

    if (businessDays > joursRestants) {
      return NextResponse.json(
        { success: false, message: `Solde insuffisant. L'employé a ${joursRestants} jour(s) disponible(s)` },
        { status: 400 }
      );
    }

    // Vérifier les chevauchements avec des congés validés existants
    const overlapResult = await db.execute({
      sql: `
        SELECT COUNT(*) as count FROM demandes_conges
        WHERE user_id = ? AND statut = 'validee'
        AND ((date_debut <= ? AND date_fin >= ?)
             OR (date_debut <= ? AND date_fin >= ?)
             OR (date_debut >= ? AND date_fin <= ?))
      `,
      args: [user_id, date_fin, date_debut, date_debut, date_debut, date_debut, date_fin]
    });

    if (overlapResult.rows[0].count > 0) {
      return NextResponse.json(
        { success: false, message: 'Un congé validé existe déjà sur cette période' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const rhUserId = user.userId || user.id;

    // Créer la demande directement validée
    await db.execute({
      sql: `
        INSERT INTO demandes_conges (
          user_id, date_debut, date_fin, nombre_jours_ouvres, motif,
          statut, date_demande, date_validation, validateur_id,
          statut_niveau_1, statut_niveau_2
        )
        VALUES (?, ?, ?, ?, ?, 'validee', ?, ?, ?, 'validee', 'validee')
      `,
      args: [user_id, date_debut, date_fin, businessDays, motif || null, now, now, rhUserId]
    });

    // Mettre à jour le solde
    await db.execute({
      sql: `
        UPDATE soldes_conges
        SET jours_pris = jours_pris + ?,
            jours_restants = jours_restants - ?
        WHERE user_id = ? AND annee = ?
      `,
      args: [businessDays, businessDays, user_id, currentYear]
    });

    return NextResponse.json({
      success: true,
      message: 'Congé créé et validé avec succès',
      businessDays
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating RH leave:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la création du congé: ' + error.message },
      { status: 500 }
    );
  }
}
