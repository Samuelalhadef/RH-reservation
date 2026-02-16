import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { getDb } from '../lib/db.js';

const reset = async () => {
  try {
    const client = getDb();

    console.log('🔄 Réinitialisation des congés...\n');

    // 1. Supprimer toutes les demandes de congés
    const demandes = await client.execute('SELECT COUNT(*) as count FROM demandes_conges');
    console.log(`📋 Demandes de congés trouvées: ${demandes.rows[0].count}`);
    await client.execute('DELETE FROM demandes_conges');
    console.log('✅ Toutes les demandes de congés supprimées\n');

    // 2. Réinitialiser les soldes de congés
    const soldes = await client.execute('SELECT COUNT(*) as count FROM soldes_conges');
    console.log(`💰 Soldes de congés trouvés: ${soldes.rows[0].count}`);
    await client.execute(`
      UPDATE soldes_conges SET
        jours_pris = 0,
        jours_restants = jours_acquis + jours_reportes + jours_fractionnement + jours_compensateurs
    `);
    console.log('✅ Tous les soldes de congés réinitialisés (jours_pris = 0)\n');

    // 3. Supprimer les demandes CET
    try {
      const demandesCet = await client.execute('SELECT COUNT(*) as count FROM demandes_cet');
      console.log(`📋 Demandes CET trouvées: ${demandesCet.rows[0].count}`);
      await client.execute('DELETE FROM demandes_cet');
      console.log('✅ Toutes les demandes CET supprimées\n');
    } catch (e) { console.log('ℹ️  Table demandes_cet non trouvée, ignorée\n'); }

    // 4. Réinitialiser l'historique CET
    try {
      const histCet = await client.execute('SELECT COUNT(*) as count FROM cet_historique');
      console.log(`📋 Historique CET trouvé: ${histCet.rows[0].count}`);
      await client.execute('DELETE FROM cet_historique');
      console.log('✅ Historique CET supprimé\n');
    } catch (e) { console.log('ℹ️  Table cet_historique non trouvée, ignorée\n'); }

    // 5. Réinitialiser les soldes CET à 0
    try {
      await client.execute('UPDATE cet SET solde = 0');
      console.log('✅ Soldes CET réinitialisés à 0\n');
    } catch (e) { console.log('ℹ️  Table cet non trouvée, ignorée\n'); }

    // Afficher le résumé
    console.log('--- Résumé après réinitialisation ---');
    const soldesAfter = await client.execute(`
      SELECT u.prenom, u.nom, s.annee, s.jours_acquis, s.jours_pris, s.jours_restants, s.jours_reportes, s.jours_fractionnement, s.jours_compensateurs
      FROM soldes_conges s
      JOIN users u ON u.id = s.user_id
      ORDER BY u.nom, s.annee
    `);
    for (const row of soldesAfter.rows) {
      console.log(`  ${row.prenom} ${row.nom} (${row.annee}): acquis=${row.jours_acquis}, pris=${row.jours_pris}, restants=${row.jours_restants}, reportés=${row.jours_reportes}, fractionnement=${row.jours_fractionnement}, compensateurs=${row.jours_compensateurs}`);
    }

    console.log('\n✨ Réinitialisation terminée avec succès!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
};

reset();
