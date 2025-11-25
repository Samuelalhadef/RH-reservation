import bcrypt from 'bcrypt';
import { db, initDatabase } from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const FRENCH_HOLIDAYS_2025 = [
  { date: '2025-01-01', nom: 'Jour de l\'An', annee: 2025 },
  { date: '2025-04-21', nom: 'Lundi de Pâques', annee: 2025 },
  { date: '2025-05-01', nom: 'Fête du Travail', annee: 2025 },
  { date: '2025-05-08', nom: 'Victoire 1945', annee: 2025 },
  { date: '2025-05-29', nom: 'Ascension', annee: 2025 },
  { date: '2025-06-09', nom: 'Lundi de Pentecôte', annee: 2025 },
  { date: '2025-07-14', nom: 'Fête Nationale', annee: 2025 },
  { date: '2025-08-15', nom: 'Assomption', annee: 2025 },
  { date: '2025-11-01', nom: 'Toussaint', annee: 2025 },
  { date: '2025-11-11', nom: 'Armistice 1918', annee: 2025 },
  { date: '2025-12-25', nom: 'Noël', annee: 2025 },
];

const SAMPLE_USERS = [
  {
    nom: 'Dupont',
    prenom: 'Marie',
    email: 'marie.dupont@chartrettes.fr',
    password: 'password123',
    type: 'RH',
  },
  {
    nom: 'Martin',
    prenom: 'Jean',
    email: 'jean.martin@chartrettes.fr',
    password: 'password123',
    type: 'DG',
  },
  {
    nom: 'Bernard',
    prenom: 'Sophie',
    email: 'sophie.bernard@chartrettes.fr',
    password: 'password123',
    type: 'Employé',
  },
  {
    nom: 'Dubois',
    prenom: 'Pierre',
    email: 'pierre.dubois@chartrettes.fr',
    password: 'password123',
    type: 'Service Technique',
  },
  {
    nom: 'Thomas',
    prenom: 'Julie',
    email: 'julie.thomas@chartrettes.fr',
    password: 'password123',
    type: 'Employé',
  },
  {
    nom: 'Robert',
    prenom: 'Lucas',
    email: 'lucas.robert@chartrettes.fr',
    password: 'password123',
    type: 'Alternant',
  },
];

async function seed() {
  try {
    console.log('🌱 Starting database seeding...');

    // Initialiser les tables
    await initDatabase();

    // Vérifier si des utilisateurs existent déjà
    const existingUsers = await db.execute('SELECT COUNT(*) as count FROM users');
    if (existingUsers.rows[0].count > 0) {
      console.log('⚠️  Database already contains users. Skipping seed.');
      return;
    }

    // Créer les utilisateurs
    console.log('Creating users...');
    const userIds = [];
    for (const user of SAMPLE_USERS) {
      const hashedPassword = await bcrypt.hash(user.password, 10);

      const result = await db.execute({
        sql: `
          INSERT INTO users (nom, prenom, email, mot_de_passe, type_utilisateur, mot_de_passe_temporaire)
          VALUES (?, ?, ?, ?, ?, 0)
        `,
        args: [user.nom, user.prenom, user.email, hashedPassword, user.type],
      });

      userIds.push(result.lastInsertRowid);
      console.log(`  ✓ Created user: ${user.prenom} ${user.nom} (${user.type})`);
    }

    // Créer les soldes de congés pour l'année en cours
    console.log('Creating leave balances...');
    const currentYear = new Date().getFullYear();
    for (const userId of userIds) {
      await db.execute({
        sql: `
          INSERT INTO soldes_conges (user_id, annee, jours_acquis, jours_pris, jours_restants, jours_reportes)
          VALUES (?, ?, 25, 0, 25, 0)
        `,
        args: [userId, currentYear],
      });
    }
    console.log(`  ✓ Created leave balances for ${userIds.length} users`);

    // Insérer les jours fériés
    console.log('Creating public holidays...');
    for (const holiday of FRENCH_HOLIDAYS_2025) {
      await db.execute({
        sql: 'INSERT INTO jours_feries (date, nom, annee) VALUES (?, ?, ?)',
        args: [holiday.date, holiday.nom, holiday.annee],
      });
    }
    console.log(`  ✓ Created ${FRENCH_HOLIDAYS_2025.length} public holidays for 2025`);

    // Créer quelques demandes de congés de test
    console.log('Creating sample leave requests...');

    // Demande validée (Sophie Bernard)
    await db.execute({
      sql: `
        INSERT INTO demandes_conges (user_id, date_debut, date_fin, nombre_jours_ouvres, statut, validateur_id, date_validation)
        VALUES (?, '2025-07-01', '2025-07-15', 11, 'validee', ?, CURRENT_TIMESTAMP)
      `,
      args: [userIds[2], userIds[0]], // Sophie demande, Marie RH valide
    });

    // Mettre à jour le solde
    await db.execute({
      sql: `
        UPDATE soldes_conges
        SET jours_pris = 11, jours_restants = 14
        WHERE user_id = ? AND annee = ?
      `,
      args: [userIds[2], currentYear],
    });

    // Demande en attente (Jean Martin)
    await db.execute({
      sql: `
        INSERT INTO demandes_conges (user_id, date_debut, date_fin, nombre_jours_ouvres, motif, statut)
        VALUES (?, '2025-08-10', '2025-08-20', 9, 'Vacances d''été', 'en_attente')
      `,
      args: [userIds[1]],
    });

    console.log('  ✓ Created 2 sample leave requests');

    console.log('\n✅ Database seeding completed successfully!');
    console.log('\n📝 Test credentials:');
    console.log('='.repeat(50));
    SAMPLE_USERS.forEach((user) => {
      console.log(`${user.prenom} ${user.nom} (${user.type})`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Password: ${user.password}`);
      console.log('');
    });
    console.log('='.repeat(50));
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

seed();
