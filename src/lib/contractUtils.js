/**
 * Calcule le nombre de jours de congés acquis pour un CDD
 * Formule : 2.08 jours ouvrables par mois travaillé
 * Maximum : 25 jours pour une année complète
 *
 * @param {string} dateDebut - Date de début du contrat (format YYYY-MM-DD)
 * @param {string} dateFin - Date de fin du contrat (format YYYY-MM-DD)
 * @param {number} annee - Année de référence pour le calcul
 * @returns {number} - Nombre de jours acquis (arrondi à 2 décimales)
 */
export function calculateCDDLeaveBalance(dateDebut, dateFin, annee) {
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

/**
 * Calcule le nombre total de jours acquis selon le type de contrat
 *
 * @param {string} typeContrat - 'CDI' ou 'CDD'
 * @param {string} dateDebut - Date de début du contrat CDD
 * @param {string} dateFin - Date de fin du contrat CDD
 * @param {number} annee - Année de référence
 * @returns {number} - Nombre de jours acquis
 */
export function calculateLeaveBalance(typeContrat, dateDebut, dateFin, annee) {
  if (typeContrat === 'CDD') {
    return calculateCDDLeaveBalance(dateDebut, dateFin, annee);
  }

  // Pour les CDI, 25 jours par an
  return 25;
}

/**
 * Vérifie si un contrat CDD est toujours actif
 *
 * @param {string} dateFin - Date de fin du contrat
 * @returns {boolean} - true si le contrat est actif
 */
export function isCDDActive(dateFin) {
  if (!dateFin) return false;
  return new Date(dateFin) >= new Date();
}

/**
 * Formate la période du contrat CDD
 *
 * @param {string} dateDebut - Date de début
 * @param {string} dateFin - Date de fin
 * @returns {string} - Période formatée
 */
export function formatContractPeriod(dateDebut, dateFin) {
  if (!dateDebut || !dateFin) return '';

  const debut = new Date(dateDebut).toLocaleDateString('fr-FR');
  const fin = new Date(dateFin).toLocaleDateString('fr-FR');

  return `${debut} - ${fin}`;
}
