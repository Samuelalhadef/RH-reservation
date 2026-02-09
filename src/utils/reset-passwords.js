import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { db } from '../lib/db.js';
import bcrypt from 'bcrypt';

const resetPasswords = async () => {
  try {
    const newPassword = 'chartrettes2026';
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Récupérer tous les utilisateurs
    const users = await db.execute('SELECT id, nom, prenom, email FROM users');

    console.log(`\n🔄 Réinitialisation des mots de passe pour ${users.rows.length} utilisateur(s)...\n`);

    for (const user of users.rows) {
      await db.execute({
        sql: 'UPDATE users SET mot_de_passe = ?, mot_de_passe_temporaire = 1 WHERE id = ?',
        args: [hashedPassword, user.id]
      });
      console.log(`✅ ${user.prenom} ${user.nom} (${user.email}) - mot de passe réinitialisé`);
    }

    console.log(`\n✨ Terminé! Tous les mots de passe ont été réinitialisés.`);
    console.log(`📝 Nouveau mot de passe: ${newPassword}`);
    console.log(`⚠️  Les utilisateurs devront changer leur mot de passe à la prochaine connexion.\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
};

resetPasswords();
