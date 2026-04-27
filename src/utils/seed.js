import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { db, initDatabase } from '../lib/db.js';
import bcrypt from 'bcrypt';

const seed = async () => {
  try {
    console.log('🌱 Initialisation de la base de données...');

    await initDatabase();

    console.log('👤 Création des utilisateurs par défaut...');

    const tempPassword = 'chartrettes2026';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const users = [
      { nom: 'Dupont', prenom: 'Marie', email: 'marie.dupont@chartrettes.fr', type: 'RH' },
      { nom: 'Martin', prenom: 'Jean', email: 'jean.martin@chartrettes.fr', type: 'Employé' },
      { nom: 'Durand', prenom: 'Sophie', email: 'sophie.durand@chartrettes.fr', type: 'Employé' },
    ];

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

        console.log(`✅ Utilisateur créé: ${user.prenom} ${user.nom} (${user.email})`);
      } else {
        console.log(`⏭️  Utilisateur existe déjà: ${user.email}`);
      }
    }

    console.log('\n📅 Initialisation des jours fériés...');

    const FRENCH_HOLIDAYS = [
      { date: '2027-01-01', nom: 'Jour de l\'An', annee: 2027 },
      { date: '2027-03-29', nom: 'Lundi de Pâques', annee: 2027 },
      { date: '2027-05-01', nom: 'Fête du Travail', annee: 2027 },
      { date: '2027-05-06', nom: 'Ascension', annee: 2027 },
      { date: '2027-05-08', nom: 'Victoire 1945', annee: 2027 },
      { date: '2027-05-17', nom: 'Lundi de Pentecôte', annee: 2027 },
      { date: '2027-07-14', nom: 'Fête Nationale', annee: 2027 },
      { date: '2027-08-15', nom: 'Assomption', annee: 2027 },
      { date: '2027-11-01', nom: 'Toussaint', annee: 2027 },
      { date: '2027-11-11', nom: 'Armistice 1918', annee: 2027 },
      { date: '2027-12-25', nom: 'Noël', annee: 2027 },
    ];

    for (const holiday of FRENCH_HOLIDAYS) {
      const existing = await db.execute({
        sql: 'SELECT id FROM jours_feries WHERE date = ?',
        args: [holiday.date]
      });

      if (existing.rows.length === 0) {
        await db.execute({
          sql: 'INSERT INTO jours_feries (date, nom, annee) VALUES (?, ?, ?)',
          args: [holiday.date, holiday.nom, holiday.annee]
        });
        console.log(`✅ Jour férié ajouté: ${holiday.nom}`);
      }
    }

    console.log('\n✨ Initialisation terminée avec succès!');
    console.log('\n📝 Informations de connexion:');
    console.log(`   Email: marie.dupont@chartrettes.fr (RH)`);
    console.log(`   Email: jean.martin@chartrettes.fr (Employé)`);
    console.log(`   Mot de passe: ${tempPassword}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error);
    process.exit(1);
  }
};

seed();
