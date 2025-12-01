import { db } from '../config/database.js';

/**
 * Script de migration pour ajouter la colonne jours_fractionnement
 * à la table soldes_conges si elle n'existe pas déjà
 */
async function migrateFractionnement() {
  try {
    console.log('🔄 Début de la migration pour jours_fractionnement...');

    // Vérifier si la colonne existe déjà
    const tableInfo = await db.execute({
      sql: 'PRAGMA table_info(soldes_conges)'
    });

    const columnExists = tableInfo.rows.some(col => col.name === 'jours_fractionnement');

    if (columnExists) {
      console.log('✅ La colonne jours_fractionnement existe déjà');
    } else {
      // Ajouter la colonne
      await db.execute({
        sql: 'ALTER TABLE soldes_conges ADD COLUMN jours_fractionnement REAL DEFAULT 0'
      });
      console.log('✅ Colonne jours_fractionnement ajoutée avec succès');
    }

    // Mettre à jour toutes les lignes qui ont NULL ou qui n'ont pas de valeur
    await db.execute({
      sql: 'UPDATE soldes_conges SET jours_fractionnement = 0 WHERE jours_fractionnement IS NULL'
    });

    console.log('✅ Migration terminée avec succès');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

migrateFractionnement();
