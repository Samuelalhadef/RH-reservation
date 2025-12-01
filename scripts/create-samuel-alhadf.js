import { db } from '../src/lib/db.js';
import bcrypt from 'bcrypt';

async function createUser() {
  try {
    console.log('🔄 Creating user Samuel Alhadf...');

    // Vérifier si l'utilisateur existe déjà
    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: ['samuel.alhadf@example.com']
    });

    if (existing.rows.length > 0) {
      console.log('⚠️ User already exists with this email');

      // Afficher les informations
      const user = await db.execute({
        sql: 'SELECT * FROM users WHERE email = ?',
        args: ['samuel.alhadf@example.com']
      });

      console.log('User info:', user.rows[0]);
      process.exit(0);
    }

    // Générer un mot de passe temporaire
    const tempPassword = 'Samuel2024!';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Créer l'utilisateur
    const result = await db.execute({
      sql: `
        INSERT INTO users (nom, prenom, email, mot_de_passe, type_utilisateur, mot_de_passe_temporaire)
        VALUES (?, ?, ?, ?, ?, 1)
      `,
      args: ['Alhadf', 'Samuel', 'samuel.alhadf@example.com', hashedPassword, 'RH']
    });

    const userId = result.lastInsertRowid;
    console.log('✅ User created with ID:', userId);

    // Créer le solde de congés pour l'année en cours
    const currentYear = new Date().getFullYear();
    await db.execute({
      sql: `
        INSERT INTO soldes_conges (user_id, annee, jours_acquis, jours_pris, jours_restants, jours_reportes, jours_fractionnement)
        VALUES (?, ?, 25, 0, 25, 0, 0)
      `,
      args: [userId, currentYear]
    });

    console.log('✅ Balance created for year:', currentYear);
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('✅ User Samuel Alhadf created successfully!');
    console.log('═══════════════════════════════════════');
    console.log('Email: samuel.alhadf@example.com');
    console.log('Mot de passe temporaire:', tempPassword);
    console.log('Type: RH');
    console.log('═══════════════════════════════════════');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating user:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createUser();
