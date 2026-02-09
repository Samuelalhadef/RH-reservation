import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { db } from '../lib/db.js';
import { calculateLeaveBalance } from '../lib/contractUtils.js';

const resetLeaves = async () => {
  try {
    console.log('\n🗑️  Suppression de toutes les demandes de congés...');
    const deletedLeaves = await db.execute('DELETE FROM demandes_conges');
    console.log(`✅ ${deletedLeaves.rowsAffected} demande(s) supprimée(s)`);

    console.log('\n🗑️  Suppression de tous les soldes de congés...');
    const deletedBalances = await db.execute('DELETE FROM soldes_conges');
    console.log(`✅ ${deletedBalances.rowsAffected} solde(s) supprimé(s)`);

    console.log('\n🗑️  Suppression de l\'historique CET...');
    try {
      await db.execute('DELETE FROM cet_historique');
      await db.execute('DELETE FROM cet');
      console.log('✅ CET réinitialisé');
    } catch {
      console.log('⏭️  Tables CET non trouvées, ignoré');
    }

    const currentYear = new Date().getFullYear();
    const users = await db.execute('SELECT id, nom, prenom, email, type_utilisateur, actif, service, poste, type_contrat, date_debut_contrat, date_fin_contrat, responsable_id FROM users ORDER BY nom, prenom');

    console.log(`\n📋 Recréation des soldes pour ${users.rows.length} utilisateur(s) (année ${currentYear})...\n`);

    for (const user of users.rows) {
      if (user.actif === 1 || user.actif === null) {
        const typeContrat = user.type_contrat || 'CDI';
        const joursAcquis = calculateLeaveBalance(
          typeContrat,
          user.date_debut_contrat,
          user.date_fin_contrat,
          currentYear
        );

        await db.execute({
          sql: 'INSERT INTO soldes_conges (user_id, annee, jours_acquis, jours_pris, jours_restants, jours_reportes, jours_fractionnement) VALUES (?, ?, ?, 0, ?, 0, 0)',
          args: [user.id, currentYear, joursAcquis, joursAcquis]
        });
      }
    }

    console.log('✅ Soldes recréés avec calcul prorata CDD\n');

    // Afficher la liste complète
    console.log('='.repeat(130));
    console.log('LISTE COMPLÈTE DES UTILISATEURS');
    console.log('='.repeat(130));
    console.log(
      'ID'.padEnd(5) +
      'NOM'.padEnd(20) +
      'PRÉNOM'.padEnd(16) +
      'TYPE'.padEnd(14) +
      'CONTRAT'.padEnd(8) +
      'DÉBUT CONTRAT'.padEnd(14) +
      'FIN CONTRAT'.padEnd(14) +
      'JOURS'.padEnd(8) +
      'SERVICE'.padEnd(20) +
      'ACTIF'.padEnd(6)
    );
    console.log('-'.repeat(130));

    for (const user of users.rows) {
      const typeContrat = user.type_contrat || 'CDI';
      const joursAcquis = (user.actif === 1 || user.actif === null)
        ? calculateLeaveBalance(typeContrat, user.date_debut_contrat, user.date_fin_contrat, currentYear)
        : 0;

      console.log(
        String(user.id).padEnd(5) +
        (user.nom || '').padEnd(20) +
        (user.prenom || '').padEnd(16) +
        (user.type_utilisateur || '').padEnd(14) +
        typeContrat.padEnd(8) +
        (user.date_debut_contrat || '-').padEnd(14) +
        (user.date_fin_contrat || '-').padEnd(14) +
        String(joursAcquis).padEnd(8) +
        (user.service || '-').padEnd(20) +
        (user.actif === 1 || user.actif === null ? 'Oui' : 'Non').padEnd(6)
      );
    }

    console.log('-'.repeat(130));
    console.log(`Total: ${users.rows.length} utilisateur(s)\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
};

resetLeaves();
