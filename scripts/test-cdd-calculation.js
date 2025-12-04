/**
 * Script pour tester le calcul des jours de congé CDD
 */

// Simuler la fonction calculateCDDTotalLeaveBalance
function calculateCDDTotalLeaveBalance(dateDebut, dateFin) {
  if (!dateDebut || !dateFin) {
    return 0;
  }

  const debut = new Date(dateDebut);
  const fin = new Date(dateFin);

  // Calculer le nombre de jours travaillés (inclure le premier et dernier jour)
  const diffInMs = fin - debut + (1000 * 60 * 60 * 24); // +1 jour pour inclure le dernier jour
  const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

  // Calculer les mois avec plus de précision
  let monthsWorked;

  // Si le contrat couvre une année complète ou plus (365 ou 366 jours), on donne 12 mois
  if (diffInDays >= 365) {
    monthsWorked = 12;
  } else {
    // Sinon, calcul basé sur le nombre de jours réels
    monthsWorked = diffInDays / 30.44; // Moyenne de jours par mois
  }

  // 2.08 jours ouvrables par mois
  let joursAcquis = monthsWorked * 2.08;

  // Si on dépasse 25 jours ou si le contrat fait 12 mois ou plus, plafonner à 25
  if (joursAcquis > 25 || monthsWorked >= 12) {
    joursAcquis = 25;
  }

  // Arrondir à 2 décimales
  return Math.round(joursAcquis * 100) / 100;
}

// Test avec votre contrat
const dateDebut = '2025-12-18';
const dateFin = '2026-09-30';

console.log('═══════════════════════════════════════');
console.log('Test de calcul des jours de congé CDD');
console.log('═══════════════════════════════════════');
console.log('');
console.log(`Date de début : ${dateDebut}`);
console.log(`Date de fin   : ${dateFin}`);
console.log('');

const debut = new Date(dateDebut);
const fin = new Date(dateFin);
const diffInMs = fin - debut + (1000 * 60 * 60 * 24);
const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
const monthsWorked = diffInDays / 30.44;

console.log(`Nombre de jours : ${diffInDays} jours`);
console.log(`Nombre de mois  : ${monthsWorked.toFixed(2)} mois`);
console.log('');

const joursAcquis = calculateCDDTotalLeaveBalance(dateDebut, dateFin);
console.log(`✅ JOURS DE CONGÉ ACQUIS : ${joursAcquis} jours`);
console.log('');
console.log('═══════════════════════════════════════');
