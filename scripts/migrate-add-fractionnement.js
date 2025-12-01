import { db } from '../src/lib/db.js';

async function migrate() {
  try {
    console.log('🔄 Starting migration: adding jours_fractionnement column...');

    // Ajouter la colonne jours_fractionnement
    await db.execute(`
      ALTER TABLE soldes_conges ADD COLUMN jours_fractionnement REAL DEFAULT 0
    `);

    console.log('✅ Migration completed successfully!');
    console.log('✅ Column jours_fractionnement added to soldes_conges table');

    process.exit(0);
  } catch (error) {
    if (error.message.includes('duplicate column') || error.message.includes('already exists')) {
      console.log('ℹ️ Column jours_fractionnement already exists. Nothing to do.');
      process.exit(0);
    } else {
      console.error('❌ Migration failed:', error.message);
      console.error(error);
      process.exit(1);
    }
  }
}

migrate();
