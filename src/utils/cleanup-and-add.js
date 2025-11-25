import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { db } from '../lib/db.js';
import bcrypt from 'bcrypt';

const cleanupAndAdd = async () => {
  try {
    console.log('🧹 Nettoyage et mise à jour de la base de données...\n');

    // Supprimer les utilisateurs non souhaités
    const usersToRemove = [
      'jean.martin@chartrettes.fr',
      'sophie.durand@chartrettes.fr',
      'ce.0772204@ac-creteil.fr',
      'centredeloisirs2@mairie-chartrettes.fr'
    ];

    for (const email of usersToRemove) {
      const result = await db.execute({
        sql: 'DELETE FROM users WHERE email = ?',
        args: [email]
      });

      if (result.rowsAffected > 0) {
        console.log(`❌ Utilisateur supprimé: ${email}`);
      }
    }

    console.log('\n➕ Ajout de Samuel Alhadef...');

    // Ajouter Samuel Alhadef
    const tempPassword = 'chartrettes2025';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const existingSamuel = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: ['samuel.alhadef@mairie-chartrettes.fr']
    });

    if (existingSamuel.rows.length === 0) {
      const result = await db.execute({
        sql: `INSERT INTO users (nom, prenom, email, mot_de_passe, type_utilisateur, mot_de_passe_temporaire)
              VALUES (?, ?, ?, ?, ?, 1)`,
        args: ['Alhadef', 'Samuel', 'samuel.alhadef@mairie-chartrettes.fr', hashedPassword, 'RH']
      });

      const userId = result.lastInsertRowid;
      const currentYear = new Date().getFullYear();

      await db.execute({
        sql: `INSERT INTO soldes_conges (user_id, annee, jours_acquis, jours_pris, jours_restants, jours_reportes)
              VALUES (?, ?, 25, 0, 25, 0)`,
        args: [userId, currentYear]
      });

      console.log(`✅ Samuel Alhadef ajouté avec le rôle RH (Administrateur)`);
    } else {
      console.log(`⏭️  Samuel Alhadef existe déjà`);
    }

    console.log('\n🔐 Mise à jour des administrateurs...');

    // Mettre Virginie DE MELO comme RH (administrateur)
    const virginieResult = await db.execute({
      sql: 'UPDATE users SET type_utilisateur = ? WHERE email = ?',
      args: ['RH', 'RH@mairie-chartrettes.fr']
    });

    if (virginieResult.rowsAffected > 0) {
      console.log(`✅ Virginie DE MELO mise à jour comme Administrateur (RH)`);
    }

    // Vérifier que Samuel est bien RH
    const samuelResult = await db.execute({
      sql: 'UPDATE users SET type_utilisateur = ? WHERE email = ?',
      args: ['RH', 'samuel.alhadef@mairie-chartrettes.fr']
    });

    if (samuelResult.rowsAffected > 0) {
      console.log(`✅ Samuel Alhadef confirmé comme Administrateur (RH)`);
    }

    console.log('\n✨ Mise à jour terminée!');
    console.log('\n👥 Administrateurs de l\'application:');
    console.log('   - Virginie DE MELO (RH@mairie-chartrettes.fr)');
    console.log('   - Samuel Alhadef (samuel.alhadef@mairie-chartrettes.fr)');
    console.log(`\n📝 Mot de passe par défaut: ${tempPassword}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour:', error);
    process.exit(1);
  }
};

cleanupAndAdd();
