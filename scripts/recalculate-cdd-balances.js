import { db } from '../src/lib/db.js';

/**
 * Calcule le nombre de jours de congés acquis pour un CDD
 * Formule : 2.08 jours ouvrables par mois travaillé
 * Maximum : 25 jours pour une année complète
 */
function calculateCDDLeaveBalance(dateDebut, dateFin, annee) {
  if (!dateDebut || !dateFin) {
    return 0;
  }

  const debut = new Date(dateDebut);
  const fin = new Date(dateFin);
  const currentYear = annee || new Date().getFullYear();

  // Dates de début et fin de l'année de référence
  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear, 11, 31);

  // On prend la date la plus tardive entre le début du contrat et le début de l'année
  const effectiveStart = debut > yearStart ? debut : yearStart;

  // On prend la date la plus tôt entre la fin du contrat et la fin de l'année
  const effectiveEnd = fin < yearEnd ? fin : yearEnd;

  // Si le contrat ne couvre pas l'année en cours, retourner 0
  if (effectiveStart > yearEnd || effectiveEnd < yearStart) {
    return 0;
  }

  // Calculer le nombre de jours travaillés
  const diffInMs = effectiveEnd - effectiveStart + (1000 * 60 * 60 * 24); // +1 jour pour inclure le dernier jour
  const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

  // Calculer les mois avec plus de précision
  let monthsWorked;

  // Si le contrat couvre toute l'année (365 ou 366 jours), on donne 12 mois
  if (diffInDays >= 365) {
    monthsWorked = 12;
  } else {
    // Sinon, calcul basé sur le nombre de jours réels
    monthsWorked = diffInDays / 30.44; // Moyenne de jours par mois
  }

  // 2.08 jours ouvrables par mois
  let joursAcquis = monthsWorked * 2.08;

  // Si on dépasse 25 jours ou si le contrat fait 12 mois, plafonner à 25
  if (joursAcquis > 25 || monthsWorked >= 12) {
    joursAcquis = 25;
  }

  // Arrondir à 2 décimales
  return Math.round(joursAcquis * 100) / 100;
}

async function recalculateBalances() {
  try {
    console.log('🔄 Starting recalculation of CDD leave balances...');

    const currentYear = new Date().getFullYear();

    // Récupérer tous les utilisateurs CDD
    const usersResult = await db.execute(`
      SELECT id, nom, prenom, type_contrat, date_debut_contrat, date_fin_contrat
      FROM users
      WHERE type_contrat = 'CDD'
    `);

    const cddUsers = usersResult.rows;

    if (cddUsers.length === 0) {
      console.log('ℹ️  No CDD users found.');
      process.exit(0);
    }

    console.log(`Found ${cddUsers.length} CDD user(s)`);
    console.log('');

    for (const user of cddUsers) {
      console.log(`Processing: ${user.prenom} ${user.nom}`);
      console.log(`  Contract: ${user.date_debut_contrat} to ${user.date_fin_contrat}`);

      // Calculer les nouveaux jours acquis
      const newJoursAcquis = calculateCDDLeaveBalance(
        user.date_debut_contrat,
        user.date_fin_contrat,
        currentYear
      );

      console.log(`  New balance: ${newJoursAcquis} days`);

      // Récupérer le solde existant
      const balanceResult = await db.execute({
        sql: 'SELECT jours_pris FROM soldes_conges WHERE user_id = ? AND annee = ?',
        args: [user.id, currentYear]
      });

      if (balanceResult.rows.length > 0) {
        const joursPris = balanceResult.rows[0].jours_pris || 0;
        const joursRestants = newJoursAcquis - joursPris;

        await db.execute({
          sql: `
            UPDATE soldes_conges
            SET jours_acquis = ?, jours_restants = ?
            WHERE user_id = ? AND annee = ?
          `,
          args: [newJoursAcquis, joursRestants, user.id, currentYear]
        });

        console.log(`  ✅ Updated: ${joursPris} taken, ${joursRestants} remaining`);
      } else {
        // Créer un nouveau solde si inexistant
        await db.execute({
          sql: `
            INSERT INTO soldes_conges (user_id, annee, jours_acquis, jours_pris, jours_restants, jours_reportes, jours_fractionnement)
            VALUES (?, ?, ?, 0, ?, 0, 0)
          `,
          args: [user.id, currentYear, newJoursAcquis, newJoursAcquis]
        });

        console.log(`  ✅ Created balance: ${newJoursAcquis} days`);
      }

      console.log('');
    }

    console.log('═══════════════════════════════════════');
    console.log('✅ Recalculation completed successfully!');
    console.log('═══════════════════════════════════════');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

recalculateBalances();
