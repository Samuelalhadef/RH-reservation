import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { db } from '../lib/db.js';
import bcrypt from 'bcrypt';

const importUsers = async () => {
  try {
    console.log('📥 Importation des utilisateurs - Mon Portail Agent Chartrettes...');

    const tempPassword = 'chartrettes2025';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const users = [
      { nom: 'Noyelle', prenom: 'Claudine', email: 'dgs@mairie-chartrettes.fr', type: 'DG', service: 'Direction' },
      { nom: 'DI STEFANO', prenom: 'Carmen', email: 'vie.locale@mairie-chartrettes.fr', type: 'DG', service: 'Direction' },
      { nom: 'MOUJAMI', prenom: 'Imane', email: 'etatcivil@mairie-chartrettes.fr', type: 'Employé', service: 'Services administratifs' },
      { nom: 'DE MELO', prenom: 'Virginie', email: 'RH@mairie-chartrettes.fr', type: 'RH', service: 'Services administratifs' },
      { nom: 'Mirguet', prenom: 'Valérie', email: 'social@mairie-chartrettes.fr', type: 'Employé', service: 'Services administratifs' },
      { nom: 'ROUX', prenom: 'Ingrid', email: 'finances2@mairie-chartrettes.fr', type: 'Employé', service: 'Services administratifs' },
      { nom: 'GONOD', prenom: 'Nadine', email: 'finances@mairie-chartrettes.fr', type: 'Employé', service: 'Services administratifs' },
      { nom: 'MESSMER', prenom: 'Frédéric', email: 'police@mairie-chartrettes.fr', type: 'Employé', service: 'Services administratifs' },
      { nom: 'KRANTZ', prenom: 'Laura', email: 'urbanisme@mairie-chartrettes.fr', type: 'Employé', service: 'Services administratifs' },
      { nom: 'CONIN', prenom: 'Guillaume', email: 'animateur.culturel@mairie-chartrettes.fr', type: 'Employé', service: 'Services à la population' },
      { nom: 'Marques', prenom: 'Alexine', email: 'centredeloisirs@mairie-chartrettes.fr', type: 'Employé', service: 'Services à la population' },
      { nom: 'Desfosses', prenom: 'Directrice', email: 'ce.0772204@ac-creteil.fr', type: 'Employé', service: 'Services à la population' },
      { nom: 'Animateurs', prenom: 'Centre de Loisirs', email: 'centredeloisirs2@mairie-chartrettes.fr', type: 'Employé', service: 'Services à la population' },
      { nom: 'Goffaux', prenom: 'Stephanie', email: 'restaurant@mairie-chartrettes.fr', type: 'Employé', service: 'Services à la population' },
      { nom: 'LEROI', prenom: 'Dominique', email: 'servicestechniques@mairie-chartrettes.fr', type: 'Service Technique', service: 'Services techniques' },
    ];

    let addedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      const existing = await db.execute({
        sql: 'SELECT id FROM users WHERE email = ?',
        args: [user.email]
      });

      if (existing.rows.length === 0) {
        const result = await db.execute({
          sql: `INSERT INTO users (nom, prenom, email, mot_de_passe, type_utilisateur, mot_de_passe_temporaire)
                VALUES (?, ?, ?, ?, ?, 1)`,
          args: [user.nom, user.prenom, user.email, hashedPassword, user.type]
        });

        const userId = result.lastInsertRowid;
        const currentYear = new Date().getFullYear();

        await db.execute({
          sql: `INSERT INTO soldes_conges (user_id, annee, jours_acquis, jours_pris, jours_restants, jours_reportes)
                VALUES (?, ?, 25, 0, 25, 0)`,
          args: [userId, currentYear]
        });

        console.log(`✅ Utilisateur créé: ${user.prenom} ${user.nom} (${user.email}) - ${user.service}`);
        addedCount++;
      } else {
        console.log(`⏭️  Utilisateur existe déjà: ${user.email}`);
        skippedCount++;
      }
    }

    console.log('\n✨ Importation terminée!');
    console.log(`📊 Statistiques:`);
    console.log(`   - ${addedCount} utilisateur(s) ajouté(s)`);
    console.log(`   - ${skippedCount} utilisateur(s) déjà existant(s)`);
    console.log(`\n📝 Mot de passe par défaut: ${tempPassword}`);
    console.log(`   Les utilisateurs devront changer leur mot de passe lors de la première connexion.\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de l\'importation:', error);
    process.exit(1);
  }
};

importUsers();
