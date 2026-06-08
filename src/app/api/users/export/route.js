import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * Export RGPD des données personnelles de l'utilisateur connecté.
 * Couvre le droit d'accès (art. 15) et le droit à la portabilité (art. 20)
 * en fournissant l'ensemble des données dans un format structuré (JSON).
 *
 * Le champ mot_de_passe est volontairement exclu (donnée d'authentification,
 * non communicable). Les documents joints (document_data) sont inclus car ils
 * appartiennent à la personne concernée.
 */
export async function GET() {
  try {
    const { authenticated, user } = await requireAuth();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Non authentifié' },
        { status: 401 }
      );
    }

    const userId = user.userId;

    // Profil (sans le mot de passe)
    const profil = await db.execute({
      sql: `SELECT id, nom, prenom, email, type_utilisateur, date_creation, actif,
                   type_contrat, date_debut_contrat, date_fin_contrat, service, poste,
                   quotite_travail, responsable_id, niveau_validation, photo_profil, date_entree_mairie
            FROM users WHERE id = ?`,
      args: [userId],
    });

    if (profil.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    // Toutes les données liées à la personne concernée
    const [
      soldesConges,
      demandesConges,
      cet,
      cetHistorique,
      demandesCet,
      demandesRecuperation,
      soldesRecuperation,
      demandesParentalite,
    ] = await Promise.all([
      db.execute({ sql: 'SELECT * FROM soldes_conges WHERE user_id = ?', args: [userId] }),
      db.execute({ sql: 'SELECT * FROM demandes_conges WHERE user_id = ?', args: [userId] }),
      db.execute({ sql: 'SELECT * FROM cet WHERE user_id = ?', args: [userId] }),
      db.execute({ sql: 'SELECT * FROM cet_historique WHERE user_id = ?', args: [userId] }),
      db.execute({ sql: 'SELECT * FROM demandes_cet WHERE user_id = ?', args: [userId] }),
      db.execute({ sql: 'SELECT * FROM demandes_recuperation WHERE user_id = ?', args: [userId] }),
      db.execute({ sql: 'SELECT * FROM soldes_recuperation WHERE user_id = ?', args: [userId] }),
      db.execute({ sql: 'SELECT * FROM demandes_parentalite WHERE user_id = ?', args: [userId] }),
    ]);

    const exportData = {
      meta: {
        description: 'Export de vos données personnelles - Portail Agent, Mairie de Chartrettes',
        base_legale: 'RGPD art. 15 (droit d\'accès) et art. 20 (droit à la portabilité)',
        date_export: new Date().toISOString(),
        format: 'JSON',
      },
      profil: profil.rows[0],
      soldes_conges: soldesConges.rows,
      demandes_conges: demandesConges.rows,
      compte_epargne_temps: cet.rows,
      cet_historique: cetHistorique.rows,
      demandes_cet: demandesCet.rows,
      demandes_recuperation: demandesRecuperation.rows,
      soldes_recuperation: soldesRecuperation.rows,
      demandes_parentalite: demandesParentalite.rows,
    };

    const filename = `export-rgpd-${userId}-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error during RGPD export:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de l\'export des données' },
      { status: 500 }
    );
  }
}
