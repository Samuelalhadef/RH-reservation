import { db } from './db.js';

async function migrateHalfDays() {
  try {
    console.log('🔄 Migration: Ajout des colonnes type_debut et type_fin...');

    // Vérifier si les colonnes existent déjà
    const tableInfo = await db.execute(`PRAGMA table_info(demandes_conges)`);
    const columns = tableInfo.rows.map(row => row.name);

    if (!columns.includes('type_debut')) {
      await db.execute(`
        ALTER TABLE demandes_conges
        ADD COLUMN type_debut TEXT DEFAULT 'journee_complete'
        CHECK(type_debut IN ('journee_complete', 'matin', 'apres_midi'))
      `);
      console.log('✅ Colonne type_debut ajoutée');
    } else {
      console.log('ℹ️  Colonne type_debut existe déjà');
    }

    if (!columns.includes('type_fin')) {
      await db.execute(`
        ALTER TABLE demandes_conges
        ADD COLUMN type_fin TEXT DEFAULT 'journee_complete'
        CHECK(type_fin IN ('journee_complete', 'matin', 'apres_midi'))
      `);
      console.log('✅ Colonne type_fin ajoutée');
    } else {
      console.log('ℹ️  Colonne type_fin existe déjà');
    }

    console.log('✅ Migration terminée avec succès!');
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    throw error;
  }
}

migrateHalfDays();
