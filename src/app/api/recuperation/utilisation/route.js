import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET - Récupérer mes demandes d'utilisation de récupération
export async function GET() {
  try {
    const { authenticated, user } = await requireAuth();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Non authentifié' }, { status: 401 });
    }

    const result = await db.execute({
      sql: `
        SELECT d.*,
               v.nom as validateur_nom, v.prenom as validateur_prenom
        FROM demandes_utilisation_recup d
        LEFT JOIN users v ON d.validateur_id = v.id
        WHERE d.user_id = ?
        ORDER BY d.date_demande DESC
      `,
      args: [user.userId]
    });

    // Calculer les heures déjà utilisées (validées)
    const usedResult = await db.execute({
      sql: `SELECT COALESCE(SUM(nombre_heures), 0) as heures_utilisees
            FROM demandes_utilisation_recup
            WHERE user_id = ? AND statut = 'validee'`,
      args: [user.userId]
    });

    return NextResponse.json({
      success: true,
      demandes: result.rows || [],
      heures_utilisees: usedResult.rows[0]?.heures_utilisees || 0
    });
  } catch (error) {
    console.error('Error fetching utilisation recup:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

// POST - Créer une demande d'utilisation de récupération
export async function POST(request) {
  try {
    const { authenticated, user } = await requireAuth();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Non authentifié' }, { status: 401 });
    }

    const { date_debut, date_fin, nombre_heures, raison } = await request.json();

    if (!date_debut || !date_fin || !nombre_heures) {
      return NextResponse.json({ success: false, message: 'Date de début, date de fin et nombre d\'heures sont requis' }, { status: 400 });
    }

    const heures = parseFloat(nombre_heures);
    if (isNaN(heures) || heures <= 0) {
      return NextResponse.json({ success: false, message: 'Le nombre d\'heures doit être positif' }, { status: 400 });
    }

    // Vérifier le solde disponible
    const soldeResult = await db.execute({
      sql: 'SELECT COALESCE(heures_acquises, 0) as heures_acquises FROM soldes_recuperation WHERE user_id = ?',
      args: [user.userId]
    });
    const heuresAcquises = soldeResult.rows[0]?.heures_acquises || 0;

    // Calculer les heures déjà utilisées + en attente
    const usedResult = await db.execute({
      sql: `SELECT COALESCE(SUM(nombre_heures), 0) as total
            FROM demandes_utilisation_recup
            WHERE user_id = ? AND statut IN ('validee', 'en_attente')`,
      args: [user.userId]
    });
    const heuresUtilisees = usedResult.rows[0]?.total || 0;

    const soldeDisponible = heuresAcquises - heuresUtilisees;
    if (heures > soldeDisponible) {
      return NextResponse.json({
        success: false,
        message: `Solde insuffisant. Disponible : ${soldeDisponible}h (acquis : ${heuresAcquises}h, utilisé/en attente : ${heuresUtilisees}h)`
      }, { status: 400 });
    }

    // Vérifier que la date est au minimum 7 jours dans le futur
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() + 7);
    const dateDebut = new Date(date_debut);
    if (dateDebut < minDate) {
      return NextResponse.json({ success: false, message: 'La récupération doit être posée au minimum 7 jours à l\'avance' }, { status: 400 });
    }

    await db.execute({
      sql: `INSERT INTO demandes_utilisation_recup (user_id, date_debut, date_fin, nombre_heures, raison)
            VALUES (?, ?, ?, ?, ?)`,
      args: [user.userId, date_debut, date_fin, heures, raison || '']
    });

    return NextResponse.json({ success: true, message: 'Demande d\'utilisation envoyée' });
  } catch (error) {
    console.error('Error creating utilisation recup:', error);
    return NextResponse.json({ success: false, message: `Erreur: ${error.message}` }, { status: 500 });
  }
}
