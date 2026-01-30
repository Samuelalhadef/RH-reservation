import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Exporte les données de congés au format Excel
 * @param {Array} users - Liste des utilisateurs avec leurs soldes
 * @param {number} year - Année concernée
 */
export function exportToExcel(users, year) {
  // Préparer les données pour Excel
  const data = users.map(user => ({
    'Nom': user.nom,
    'Prénom': user.prenom,
    'Service': user.service || '-',
    'Poste': user.poste || '-',
    'Type': user.type_utilisateur,
    'Contrat': user.type_contrat || 'CDI',
    'Jours Acquis': user.jours_acquis || 0,
    'Jours Pris': user.jours_pris || 0,
    'Jours Restants': user.jours_restants || 0,
    'Jours Reportés': user.jours_reportes || 0,
    'Jours Fractionnement': user.jours_fractionnement || 0
  }));

  // Créer le workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Définir les largeurs de colonnes
  const wscols = [
    { wch: 15 }, // Nom
    { wch: 15 }, // Prénom
    { wch: 20 }, // Service
    { wch: 25 }, // Poste
    { wch: 20 }, // Type
    { wch: 10 }, // Contrat
    { wch: 12 }, // Jours Acquis
    { wch: 12 }, // Jours Pris
    { wch: 12 }, // Jours Restants
    { wch: 12 }, // Jours Reportés
    { wch: 15 }  // Jours Fractionnement
  ];
  ws['!cols'] = wscols;

  // Ajouter la feuille au workbook
  XLSX.utils.book_append_sheet(wb, ws, `Congés ${year}`);

  // Télécharger le fichier
  XLSX.writeFile(wb, `conges_mairie_chartrettes_${year}.xlsx`);
}

/**
 * Exporte les données de congés au format PDF
 * @param {Array} users - Liste des utilisateurs avec leurs soldes
 * @param {number} year - Année concernée
 */
export function exportToPDF(users, year) {
  const doc = new jsPDF('landscape');

  // En-tête
  doc.setFontSize(18);
  doc.text('Mon Portail Agent - Chartrettes', 14, 15);
  doc.setFontSize(14);
  doc.text(`Récapitulatif des Congés - Année ${year}`, 14, 25);
  doc.setFontSize(10);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 14, 32);

  // Préparer les données pour le tableau
  const tableData = users.map(user => [
    `${user.prenom} ${user.nom}`,
    user.service || '-',
    user.poste || '-',
    user.type_contrat || 'CDI',
    user.jours_acquis || 0,
    user.jours_pris || 0,
    user.jours_restants || 0,
    user.jours_reportes || 0,
    user.jours_fractionnement || 0
  ]);

  // Ajouter le tableau
  autoTable(doc, {
    startY: 40,
    head: [[
      'Agent',
      'Service',
      'Poste',
      'Contrat',
      'Acquis',
      'Pris',
      'Restants',
      'Reportés',
      'Fract.'
    ]],
    body: tableData,
    styles: {
      fontSize: 8,
      cellPadding: 2
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    },
    columnStyles: {
      0: { cellWidth: 45 }, // Agent
      1: { cellWidth: 35 }, // Service
      2: { cellWidth: 45 }, // Poste
      3: { cellWidth: 20 }, // Contrat
      4: { cellWidth: 20, halign: 'center' }, // Acquis
      5: { cellWidth: 20, halign: 'center' }, // Pris
      6: { cellWidth: 20, halign: 'center' }, // Restants
      7: { cellWidth: 20, halign: 'center' }, // Reportés
      8: { cellWidth: 20, halign: 'center' }  // Fract.
    },
    didDrawPage: function(data) {
      // Pied de page
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.text(
        `Page ${data.pageNumber} sur ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }
  });

  // Ajouter les totaux en bas
  const finalY = doc.lastAutoTable.finalY + 10;
  const totalAcquis = users.reduce((sum, u) => sum + (u.jours_acquis || 0), 0);
  const totalPris = users.reduce((sum, u) => sum + (u.jours_pris || 0), 0);
  const totalRestants = users.reduce((sum, u) => sum + (u.jours_restants || 0), 0);

  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.text(`TOTAUX:`, 14, finalY);
  doc.text(`Jours acquis: ${totalAcquis}`, 60, finalY);
  doc.text(`Jours pris: ${totalPris}`, 120, finalY);
  doc.text(`Jours restants: ${totalRestants}`, 180, finalY);

  // Télécharger le PDF
  doc.save(`conges_mairie_chartrettes_${year}.pdf`);
}

/**
 * Exporte le détail des congés d'un agent spécifique au format PDF
 * @param {Object} user - Données de l'utilisateur
 * @param {Array} leaves - Liste des demandes de congés
 * @param {number} year - Année concernée
 */
export function exportUserLeavesToPDF(user, leaves, year) {
  const doc = new jsPDF();

  // En-tête
  doc.setFontSize(18);
  doc.text('Mon Portail Agent - Chartrettes', 14, 15);
  doc.setFontSize(14);
  doc.text(`Fiche de Congés ${year}`, 14, 25);

  // Informations de l'agent
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.text('Agent:', 14, 35);
  doc.setFont(undefined, 'normal');
  doc.text(`${user.prenom} ${user.nom}`, 35, 35);

  doc.setFont(undefined, 'bold');
  doc.text('Service:', 14, 42);
  doc.setFont(undefined, 'normal');
  doc.text(user.service || '-', 35, 42);

  doc.setFont(undefined, 'bold');
  doc.text('Poste:', 14, 49);
  doc.setFont(undefined, 'normal');
  doc.text(user.poste || '-', 35, 49);

  // Solde de congés
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('Solde de congés:', 14, 60);

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Jours acquis: ${user.jours_acquis || 0}`, 20, 68);
  doc.text(`Jours pris: ${user.jours_pris || 0}`, 20, 74);
  doc.text(`Jours restants: ${user.jours_restants || 0}`, 20, 80);
  doc.text(`Jours reportés: ${user.jours_reportes || 0}`, 20, 86);

  // Tableau des demandes
  if (leaves && leaves.length > 0) {
    const tableData = leaves.map(leave => [
      new Date(leave.date_debut).toLocaleDateString('fr-FR'),
      new Date(leave.date_fin).toLocaleDateString('fr-FR'),
      leave.nombre_jours_ouvres,
      leave.statut === 'validee' ? 'Validée' :
      leave.statut === 'refusee' ? 'Refusée' : 'En attente',
      leave.motif || '-'
    ]);

    autoTable(doc, {
      startY: 95,
      head: [['Date début', 'Date fin', 'Jours', 'Statut', 'Motif']],
      body: tableData,
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 30 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 30 },
        4: { cellWidth: 70 }
      }
    });
  } else {
    doc.setFontSize(10);
    doc.text('Aucune demande de congés pour cette année.', 14, 100);
  }

  // Pied de page
  doc.setFontSize(8);
  doc.text(
    `Document généré le ${new Date().toLocaleDateString('fr-FR')}`,
    14,
    doc.internal.pageSize.height - 10
  );

  // Télécharger le PDF
  doc.save(`fiche_conges_${user.nom}_${user.prenom}_${year}.pdf`);
}
