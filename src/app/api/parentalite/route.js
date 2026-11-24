import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { sendPushToRH } from '@/lib/pushNotifications';
import { getFrenchHolidaysRange } from '@/lib/holidays';
import { calculateBusinessDays } from '@/lib/dateUtils';

const TYPES = ['maternite', 'paternite', 'adoption', 'enfant_malade'];
const DEMI_JOURNEES = ['journee_complete', 'matin', 'apres_midi'];
const TYPE_LABELS = {
  maternite: 'maternité',
  paternite: 'paternité',
  adoption: 'adoption',
  enfant_malade: 'enfant malade',
};

// Autorisation d'absence pour garde d'enfant malade (FPT) : obligations
// hebdomadaires de service + 1 jour, soit 6 jours / an pour un temps plein,
// au prorata de la quotité. Doublable dans certains cas (parent seul, conjoint
// ne bénéficiant d'aucune autorisation) : le plafond reste donc indicatif,
// la RH tranche à la validation.
const ENFANT_MALADE_JOURS_TEMPS_PLEIN = 6;

/** Jours ouvrés (hors week-ends et fériés), demi-journées comprises. */
async function joursOuvres(date_debut, date_fin, typeDebut, typeFin) {
  const holidays = (await getFrenchHolidaysRange(
    new Date(date_debut).getFullYear(),
    new Date(date_fin).getFullYear()
  ))
    .map((h) => h.date)
    .filter((d) => d >= date_debut && d <= date_fin);

  let jours = calculateBusinessDays(date_debut, date_fin, holidays);
  if (jours === 0) return 0;

  if (date_debut === date_fin) {
    // Même jour : "matin" ou "après-midi" seul = une demi-journée
    return typeDebut === 'journee_complete' ? 1 : 0.5;
  }
  // Commence l'après-midi / finit le matin : une demi-journée de moins à chaque bout
  if (typeDebut === 'apres_midi') jours -= 0.5;
  if (typeFin === 'matin') jours -= 0.5;
  return Math.max(0.5, jours);
}

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

    // Compteur enfant malade de l'année civile en cours (demandes validées + en attente)
    const annee = new Date().getFullYear();
    const quotiteResult = await db.execute({
      sql: 'SELECT quotite_travail FROM users WHERE id = ?',
      args: [user.userId]
    });
    const quotite = Number(quotiteResult.rows[0]?.quotite_travail) || 100;
    const plafond = Math.round(ENFANT_MALADE_JOURS_TEMPS_PLEIN * quotite / 100 * 2) / 2;
    let pris = 0;
    let enAttente = 0;
    for (const d of result.rows || []) {
      if (d.type !== 'enfant_malade' || String(d.date_debut).slice(0, 4) !== String(annee)) continue;
      if (d.statut === 'validee') pris += Number(d.nombre_jours) || 0;
      else if (d.statut === 'en_attente') enAttente += Number(d.nombre_jours) || 0;
    }

    return NextResponse.json({
      success: true,
      demandes: result.rows || [],
      enfant_malade: { annee, plafond, pris, en_attente: enAttente }
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

    const body = await request.json();
    const { type, date_debut, date_fin, motif, document_data, enfant_prenom } = body;
    const type_debut = DEMI_JOURNEES.includes(body.type_debut) ? body.type_debut : 'journee_complete';
    const type_fin = DEMI_JOURNEES.includes(body.type_fin) ? body.type_fin : 'journee_complete';

    if (!type || !date_debut || !date_fin) {
      return NextResponse.json(
        { success: false, message: 'Type, date de début et date de fin sont requis' },
        { status: 400 }
      );
    }

    if (!TYPES.includes(type)) {
      return NextResponse.json(
        { success: false, message: 'Type de congé invalide' },
        { status: 400 }
      );
    }

    const debut = new Date(date_debut);
    const fin = new Date(date_fin);
    if (isNaN(debut.getTime()) || isNaN(fin.getTime())) {
      return NextResponse.json(
        { success: false, message: 'Dates invalides' },
        { status: 400 }
      );
    }
    if (fin < debut) {
      return NextResponse.json(
        { success: false, message: 'La date de fin doit être après la date de début' },
        { status: 400 }
      );
    }

    // Limite de taille du justificatif (~5 Mo en base64) contre la saturation de la base.
    if (document_data && (typeof document_data !== 'string' || document_data.length > 5 * 1024 * 1024)) {
      return NextResponse.json(
        { success: false, message: 'Document trop volumineux (5 Mo maximum)' },
        { status: 400 }
      );
    }

    let nombreJours;
    if (type === 'enfant_malade') {
      // Enfant malade : décompté en jours ouvrés, demi-journées possibles
      nombreJours = await joursOuvres(date_debut, date_fin, type_debut, type_fin);
      if (nombreJours <= 0) {
        return NextResponse.json(
          { success: false, message: 'La période choisie ne contient aucun jour ouvré' },
          { status: 400 }
        );
      }
    } else {
      // Maternité / paternité / adoption : jours calendaires (inclusif)
      nombreJours = Math.round((fin - debut) / (1000 * 60 * 60 * 24)) + 1;
    }

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
        INSERT INTO demandes_parentalite (user_id, type, date_debut, date_fin, nombre_jours, motif, document_data, type_debut, type_fin, enfant_prenom)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        user.userId, type, date_debut, date_fin, nombreJours, motif || null, document_data || null,
        type === 'enfant_malade' ? type_debut : 'journee_complete',
        type === 'enfant_malade' ? type_fin : 'journee_complete',
        type === 'enfant_malade' && enfant_prenom ? String(enfant_prenom).trim().slice(0, 100) : null
      ]
    });

    // Notifier la RH directement (pas de circuit hiérarchique pour ces congés légaux)
    const typeLabel = TYPE_LABELS[type];
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
      { success: false, message: `Erreur` },
      { status: 500 }
    );
  }
}
