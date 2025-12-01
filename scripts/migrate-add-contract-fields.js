import { db } from '../src/lib/db.js';

async function migrate() {
  try {
    console.log('🔄 Starting migration: adding contract fields to users table...');

    // Ajouter type_contrat
    try {
      await db.execute(`
        ALTER TABLE users ADD COLUMN type_contrat TEXT DEFAULT 'CDI' CHECK(type_contrat IN ('CDI', 'CDD'))
      `);
      console.log('✅ Column type_contrat added');
    } catch (error) {
      if (error.message.includes('duplicate column')) {
        console.log('ℹ️ Column type_contrat already exists');
      } else {
        throw error;
      }
    }

    // Ajouter date_debut_contrat
    try {
      await db.execute(`
        ALTER TABLE users ADD COLUMN date_debut_contrat DATE
      `);
      console.log('✅ Column date_debut_contrat added');
    } catch (error) {
      if (error.message.includes('duplicate column')) {
        console.log('ℹ️ Column date_debut_contrat already exists');
      } else {
        throw error;
      }
    }

    // Ajouter date_fin_contrat
    try {
      await db.execute(`
        ALTER TABLE users ADD COLUMN date_fin_contrat DATE
      `);
      console.log('✅ Column date_fin_contrat added');
    } catch (error) {
      if (error.message.includes('duplicate column')) {
        console.log('ℹ️ Column date_fin_contrat already exists');
      } else {
        throw error;
      }
    }

    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('✅ Migration completed successfully!');
    console.log('═══════════════════════════════════════');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

migrate();
