import {
  Document, Packer, Paragraph, TextRun, ImageRun,
  AlignmentType, HeadingLevel, BorderStyle, TableCell,
  TableRow, Table, WidthType, ShadingType, PageBreak,
  Header, Footer, PageNumber, NumberFormat,
  convertInchesToTwip, TabStopPosition, TabStopType
} from 'docx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Couleurs Mairie de Chartrettes (issues du blason)
const COLORS = {
  bleuClair: '0ea5e9',    // Bleu thème app / blason
  bleuFonce: '0369a1',    // Bleu foncé pour titres
  bleuTresFonce: '0c4a6e', // Bleu très foncé
  vert: '2d7a3a',         // Vert des feuilles de vigne
  bordeaux: '7c2d36',     // Bordeaux des raisins
  or: 'b8941e',           // Or de la couronne
  gris: '64748b',         // Gris texte secondaire
  grisClair: 'f1f5f9',    // Fond gris clair
  blanc: 'ffffff',
  noir: '1e293b',
};

const qrCodePath = path.join(__dirname, 'images', 'QR code.png');
const logoPath = path.join(__dirname, '..', 'public', 'images', 'logo.png');

const qrCodeImage = fs.readFileSync(qrCodePath);
const logoImage = fs.readFileSync(logoPath);

// Helper: créer un paragraphe titre stylisé
function titre(text, level = HeadingLevel.HEADING_1, color = COLORS.bleuFonce) {
  return new Paragraph({
    heading: level,
    spacing: { before: level === HeadingLevel.HEADING_1 ? 400 : 250, after: 150 },
    children: [
      new TextRun({
        text,
        color,
        bold: true,
        font: 'Calibri',
        size: level === HeadingLevel.HEADING_1 ? 36 : level === HeadingLevel.HEADING_2 ? 28 : 24,
      }),
    ],
  });
}

// Helper: paragraphe normal
function para(text, options = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    alignment: options.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [
      new TextRun({
        text,
        font: 'Calibri',
        size: 22,
        color: options.color || COLORS.noir,
        bold: options.bold || false,
        italics: options.italics || false,
      }),
    ],
  });
}

// Helper: étape numérotée avec icône
function etape(numero, texte, detail = '') {
  const children = [
    new TextRun({
      text: `  ${numero}  `,
      bold: true,
      color: COLORS.blanc,
      font: 'Calibri',
      size: 22,
      shading: { type: ShadingType.SOLID, color: COLORS.bleuClair, fill: COLORS.bleuClair },
    }),
    new TextRun({
      text: `   ${texte}`,
      bold: true,
      color: COLORS.bleuFonce,
      font: 'Calibri',
      size: 22,
    }),
  ];
  if (detail) {
    children.push(
      new TextRun({ text: '\n', font: 'Calibri', size: 22 }),
      new TextRun({
        text: `      ${detail}`,
        color: COLORS.gris,
        font: 'Calibri',
        size: 20,
        italics: true,
      })
    );
  }
  return new Paragraph({ spacing: { before: 100, after: 80 }, children });
}

// Helper: puce
function puce(texte, bold = false) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [
      new TextRun({
        text: texte,
        font: 'Calibri',
        size: 22,
        color: COLORS.noir,
        bold,
      }),
    ],
  });
}

// Encadré coloré
function encadre(texte, bgColor = COLORS.grisClair, textColor = COLORS.bleuFonce) {
  return new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.SOLID, color: bgColor, fill: bgColor },
            margins: { top: 120, bottom: 120, left: 200, right: 200 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.bleuClair },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.bleuClair },
              left: { style: BorderStyle.SINGLE, size: 12, color: COLORS.bleuClair },
              right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.bleuClair },
            },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: texte,
                    font: 'Calibri',
                    size: 22,
                    color: textColor,
                    bold: true,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

// Séparateur ligne
function separateur() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.bleuClair },
    },
    children: [],
  });
}

// ==================== CONSTRUCTION DU DOCUMENT ====================

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: 'Calibri', size: 22, color: COLORS.noir },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(0.8),
            bottom: convertInchesToTwip(0.8),
            left: convertInchesToTwip(1),
            right: convertInchesToTwip(1),
          },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: 'Mon Portail Agent - Mairie de Chartrettes',
                  font: 'Calibri',
                  size: 16,
                  color: COLORS.gris,
                  italics: true,
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: 'Mairie de Chartrettes - Guide utilisateur',
                  font: 'Calibri',
                  size: 16,
                  color: COLORS.gris,
                }),
              ],
            }),
          ],
        }),
      },
      children: [
        // ============ PAGE DE COUVERTURE ============
        new Paragraph({ spacing: { before: 600 }, children: [] }),

        // Logo centré
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: logoImage,
              transformation: { width: 160, height: 160 },
              type: 'png',
            }),
          ],
        }),

        new Paragraph({ spacing: { before: 300 }, children: [] }),

        // Titre principal
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [
            new TextRun({
              text: 'MON PORTAIL AGENT',
              bold: true,
              font: 'Calibri',
              size: 52,
              color: COLORS.bleuFonce,
            }),
          ],
        }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 50 },
          children: [
            new TextRun({
              text: 'Guide d\'installation et d\'utilisation',
              font: 'Calibri',
              size: 30,
              color: COLORS.gris,
            }),
          ],
        }),

        // Ligne décorative
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 100 },
          children: [
            new TextRun({
              text: '━━━━━━━━━━━━━━━━━━━━━━━',
              color: COLORS.bleuClair,
              font: 'Calibri',
              size: 24,
            }),
          ],
        }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: 'Mairie de Chartrettes',
              font: 'Calibri',
              size: 26,
              color: COLORS.vert,
              bold: true,
            }),
          ],
        }),

        // QR Code centré
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 100 },
          children: [
            new ImageRun({
              data: qrCodeImage,
              transformation: { width: 220, height: 220 },
              type: 'png',
            }),
          ],
        }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 50 },
          children: [
            new TextRun({
              text: 'Scannez ce QR code pour accéder à l\'application',
              font: 'Calibri',
              size: 20,
              color: COLORS.gris,
              italics: true,
            }),
          ],
        }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [
            new TextRun({
              text: 'ou rendez-vous sur : ',
              font: 'Calibri',
              size: 20,
              color: COLORS.gris,
            }),
            new TextRun({
              text: 'rh-chartrettes.vercel.app',
              font: 'Calibri',
              size: 20,
              color: COLORS.bleuClair,
              bold: true,
            }),
          ],
        }),

        // ============ SAUT DE PAGE ============
        new Paragraph({ children: [new PageBreak()] }),

        // ============ SOMMAIRE ============
        titre('Sommaire', HeadingLevel.HEADING_1, COLORS.bleuFonce),
        separateur(),

        para('1.  Installer l\'application sur votre téléphone', { bold: true, color: COLORS.bleuFonce }),
        para('       - Sur iPhone / iPad (Safari)', { color: COLORS.gris }),
        para('       - Sur Android (Chrome / Google)', { color: COLORS.gris }),
        para('       - Sur ordinateur (Chrome)', { color: COLORS.gris }),
        new Paragraph({ spacing: { after: 80 }, children: [] }),
        para('2.  Se connecter à l\'application', { bold: true, color: COLORS.bleuFonce }),
        para('3.  Tableau de bord : votre espace congés', { bold: true, color: COLORS.bleuFonce }),
        para('4.  Faire une demande de congé', { bold: true, color: COLORS.bleuFonce }),
        para('5.  Suivre vos demandes', { bold: true, color: COLORS.bleuFonce }),
        para('6.  Consulter le calendrier d\'équipe', { bold: true, color: COLORS.bleuFonce }),
        para('7.  Gérer votre profil', { bold: true, color: COLORS.bleuFonce }),

        // ============ SAUT DE PAGE ============
        new Paragraph({ children: [new PageBreak()] }),

        // ============ SECTION 1 : INSTALLATION ============
        titre('1. Installer l\'application sur votre téléphone', HeadingLevel.HEADING_1),
        separateur(),

        encadre('L\'application Mon Portail Agent fonctionne comme une application classique, directement depuis votre navigateur web. Pas besoin de passer par l\'App Store ou le Play Store !'),

        new Paragraph({ spacing: { after: 200 }, children: [] }),

        // --- iPhone ---
        titre('Sur iPhone / iPad (Safari)', HeadingLevel.HEADING_2, COLORS.bleuTresFonce),

        etape('1', 'Ouvrez Safari sur votre iPhone'),
        etape('2', 'Scannez le QR code ci-dessus ou tapez l\'adresse du site', 'rh-chartrettes.vercel.app'),
        etape('3', 'Appuyez sur le bouton de partage', 'C\'est l\'icône carrée avec une flèche vers le haut, en bas de l\'écran'),
        etape('4', 'Faites défiler et appuyez sur "Sur l\'écran d\'accueil"', 'L\'icône ressemble à un + dans un carré'),
        etape('5', 'Appuyez sur "Ajouter"', 'L\'application apparaîtra sur votre écran d\'accueil comme une vraie application'),

        encadre('Important : sur iPhone, utilisez obligatoirement Safari. L\'installation ne fonctionne pas depuis Chrome ou Firefox sur iOS.'),

        new Paragraph({ spacing: { after: 200 }, children: [] }),

        // --- Android ---
        titre('Sur Android (Chrome)', HeadingLevel.HEADING_2, COLORS.bleuTresFonce),

        etape('1', 'Ouvrez Chrome (Google) sur votre téléphone'),
        etape('2', 'Scannez le QR code ou tapez l\'adresse du site', 'rh-chartrettes.vercel.app'),
        etape('3', 'Une bannière "Ajouter à l\'écran d\'accueil" peut apparaître', 'Si elle apparaît, appuyez simplement dessus'),
        etape('4', 'Sinon : appuyez sur les 3 points en haut à droite (⋮)', 'Le menu de Chrome s\'ouvre'),
        etape('5', 'Appuyez sur "Ajouter à l\'écran d\'accueil"'),
        etape('6', 'Confirmez en appuyant sur "Ajouter"', 'L\'application apparaîtra sur votre écran d\'accueil'),

        new Paragraph({ spacing: { after: 200 }, children: [] }),

        // --- Ordinateur ---
        titre('Sur ordinateur (Chrome)', HeadingLevel.HEADING_2, COLORS.bleuTresFonce),

        etape('1', 'Ouvrez Chrome sur votre ordinateur'),
        etape('2', 'Allez sur le site : rh-chartrettes.vercel.app'),
        etape('3', 'Cliquez sur l\'icône d\'installation dans la barre d\'adresse', 'C\'est un petit écran avec une flèche, à droite de la barre d\'adresse'),
        etape('4', 'Cliquez sur "Installer"', 'L\'application s\'ouvre dans sa propre fenêtre, comme un logiciel classique'),

        // ============ SAUT DE PAGE ============
        new Paragraph({ children: [new PageBreak()] }),

        // ============ SECTION 2 : CONNEXION ============
        titre('2. Se connecter', HeadingLevel.HEADING_1),
        separateur(),

        etape('1', 'Ouvrez l\'application Mon Portail Agent'),
        etape('2', 'Sélectionnez votre nom dans la liste', 'Cliquez sur votre nom et prénom dans la grille affichée'),
        etape('3', 'Entrez votre mot de passe', 'Lors de la première connexion, le mot de passe par défaut vous sera communiqué par le service RH'),
        etape('4', 'Changez votre mot de passe', 'Lors de votre première connexion, l\'application vous demandera de choisir un nouveau mot de passe personnel'),

        encadre('En cas d\'oubli de mot de passe, contactez le service RH qui pourra le réinitialiser.'),

        new Paragraph({ spacing: { after: 200 }, children: [] }),

        // ============ SECTION 3 : TABLEAU DE BORD ============
        titre('3. Votre tableau de bord', HeadingLevel.HEADING_1),
        separateur(),

        para('Le tableau de bord est la page principale de l\'application. Vous y retrouvez en un coup d\'oeil :'),
        new Paragraph({ spacing: { after: 100 }, children: [] }),

        puce('Vos jours de congés restants (affiché en grand)', true),
        puce('Le détail de vos jours : acquis, pris, reportés, fractionnement, compensateurs'),
        puce('Vos prochains congés à venir'),
        puce('Un calendrier interactif pour poser vos congés directement'),

        new Paragraph({ spacing: { after: 150 }, children: [] }),

        // Tableau récapitulatif des types de jours
        titre('Comprendre vos types de jours', HeadingLevel.HEADING_3, COLORS.vert),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                new TableCell({
                  shading: { type: ShadingType.SOLID, color: COLORS.bleuFonce, fill: COLORS.bleuFonce },
                  margins: { top: 60, bottom: 60, left: 120, right: 120 },
                  width: { size: 30, type: WidthType.PERCENTAGE },
                  children: [new Paragraph({ children: [new TextRun({ text: 'Type', bold: true, color: COLORS.blanc, font: 'Calibri', size: 20 })] })],
                }),
                new TableCell({
                  shading: { type: ShadingType.SOLID, color: COLORS.bleuFonce, fill: COLORS.bleuFonce },
                  margins: { top: 60, bottom: 60, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: 'Description', bold: true, color: COLORS.blanc, font: 'Calibri', size: 20 })] })],
                }),
              ],
            }),
            ...([
              ['Jours acquis', 'Le nombre total de jours de congés auxquels vous avez droit pour l\'année'],
              ['Jours pris', 'Le nombre de jours que vous avez déjà posés et qui ont été validés'],
              ['Jours restants', 'Les jours qu\'il vous reste à poser (acquis - pris + bonus)'],
              ['Jours reportés', 'Les jours non utilisés l\'année précédente, reportés sur cette année'],
              ['Jours de fractionnement', 'Jours bonus accordés si vous posez des congés en dehors de la période mai-octobre'],
              ['Jours compensateurs', 'Jours accordés en compensation d\'heures supplémentaires'],
            ].map((row, i) =>
              new TableRow({
                children: [
                  new TableCell({
                    shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: COLORS.grisClair, fill: COLORS.grisClair } : undefined,
                    margins: { top: 50, bottom: 50, left: 120, right: 120 },
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: row[0], bold: true, color: COLORS.bleuFonce, font: 'Calibri', size: 20 })] })],
                  }),
                  new TableCell({
                    shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: COLORS.grisClair, fill: COLORS.grisClair } : undefined,
                    margins: { top: 50, bottom: 50, left: 120, right: 120 },
                    children: [new Paragraph({ children: [new TextRun({ text: row[1], color: COLORS.noir, font: 'Calibri', size: 20 })] })],
                  }),
                ],
              })
            )),
          ],
        }),

        // ============ SAUT DE PAGE ============
        new Paragraph({ children: [new PageBreak()] }),

        // ============ SECTION 4 : DEMANDE DE CONGÉ ============
        titre('4. Faire une demande de congé', HeadingLevel.HEADING_1),
        separateur(),

        para('Depuis le tableau de bord, le calendrier vous permet de poser vos congés facilement :'),
        new Paragraph({ spacing: { after: 100 }, children: [] }),

        etape('1', 'Cliquez sur la date de début de votre congé dans le calendrier'),
        etape('2', 'Cliquez sur la date de fin', 'Les jours sélectionnés apparaissent en surbrillance'),
        etape('3', 'Choisissez le type de journée si besoin', 'Journée complète, matin uniquement ou après-midi uniquement'),
        etape('4', 'Vérifiez le nombre de jours ouvrés calculé automatiquement', 'Les week-ends et jours fériés sont automatiquement exclus'),
        etape('5', 'Ajoutez un motif si vous le souhaitez (facultatif)'),
        etape('6', 'Validez votre demande'),

        new Paragraph({ spacing: { after: 150 }, children: [] }),

        encadre('Les demandes doivent être faites au minimum 7 jours à l\'avance. Vous ne pouvez pas poser de congés sur des dates passées.'),

        new Paragraph({ spacing: { after: 150 }, children: [] }),

        titre('Le circuit de validation', HeadingLevel.HEADING_3, COLORS.vert),
        para('Votre demande passe par plusieurs étapes avant d\'être acceptée :'),
        new Paragraph({ spacing: { after: 80 }, children: [] }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 100 },
          children: [
            new TextRun({ text: 'Demande créée', bold: true, color: COLORS.bleuClair, font: 'Calibri', size: 22 }),
            new TextRun({ text: '  →  ', color: COLORS.gris, font: 'Calibri', size: 22 }),
            new TextRun({ text: 'Chef de service (N+1)', bold: true, color: COLORS.or, font: 'Calibri', size: 22 }),
            new TextRun({ text: '  →  ', color: COLORS.gris, font: 'Calibri', size: 22 }),
            new TextRun({ text: 'Direction (N+2)', bold: true, color: COLORS.or, font: 'Calibri', size: 22 }),
            new TextRun({ text: '  →  ', color: COLORS.gris, font: 'Calibri', size: 22 }),
            new TextRun({ text: 'Service RH', bold: true, color: COLORS.vert, font: 'Calibri', size: 22 }),
          ],
        }),

        new Paragraph({ spacing: { after: 80 }, children: [] }),
        para('Vous recevrez une notification à chaque étape de la validation.'),

        // ============ SAUT DE PAGE ============
        new Paragraph({ children: [new PageBreak()] }),

        // ============ SECTION 5 : SUIVI DES DEMANDES ============
        titre('5. Suivre vos demandes', HeadingLevel.HEADING_1),
        separateur(),

        para('La page "Mes demandes" accessible depuis le menu vous permet de :'),
        new Paragraph({ spacing: { after: 100 }, children: [] }),

        puce('Voir toutes vos demandes de congés passées et en cours'),
        puce('Filtrer par statut : en attente, validées, refusées'),
        puce('Suivre visuellement le circuit de validation de chaque demande'),
        puce('Annuler une demande en attente si vous changez d\'avis'),
        puce('Consulter les commentaires du service RH en cas de refus'),

        new Paragraph({ spacing: { after: 150 }, children: [] }),

        titre('Les statuts de vos demandes', HeadingLevel.HEADING_3, COLORS.vert),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            ...([
              ['En attente', 'Votre demande est en cours d\'examen', COLORS.or],
              ['Validée', 'Votre congé est approuvé, les jours sont décomptés', COLORS.vert],
              ['Refusée', 'Votre demande a été refusée (un motif est indiqué)', COLORS.bordeaux],
              ['Annulée', 'Vous avez annulé cette demande', COLORS.gris],
            ].map((row) =>
              new TableRow({
                children: [
                  new TableCell({
                    margins: { top: 50, bottom: 50, left: 120, right: 120 },
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: {
                      left: { style: BorderStyle.SINGLE, size: 10, color: row[2] },
                    },
                    children: [new Paragraph({ children: [new TextRun({ text: row[0], bold: true, color: row[2], font: 'Calibri', size: 20 })] })],
                  }),
                  new TableCell({
                    margins: { top: 50, bottom: 50, left: 120, right: 120 },
                    children: [new Paragraph({ children: [new TextRun({ text: row[1], color: COLORS.noir, font: 'Calibri', size: 20 })] })],
                  }),
                ],
              })
            )),
          ],
        }),

        new Paragraph({ spacing: { after: 200 }, children: [] }),

        // ============ SECTION 6 : CALENDRIER EQUIPE ============
        titre('6. Calendrier d\'équipe', HeadingLevel.HEADING_1),
        separateur(),

        para('La page "Calendrier équipe" vous permet de visualiser les congés validés de tous vos collègues.'),
        new Paragraph({ spacing: { after: 80 }, children: [] }),
        puce('Consultez le planning de l\'équipe avant de poser vos congés'),
        puce('Seuls les congés validés sont affichés'),
        puce('Survolez une date pour voir le nom du collègue en congé'),

        new Paragraph({ spacing: { after: 200 }, children: [] }),

        // ============ SECTION 7 : PROFIL ============
        titre('7. Votre profil', HeadingLevel.HEADING_1),
        separateur(),

        para('Accédez à votre profil en cliquant sur votre photo (ou initiales) dans le menu. Vous pouvez :'),
        new Paragraph({ spacing: { after: 100 }, children: [] }),

        puce('Modifier votre photo de profil'),
        puce('Changer votre mot de passe'),
        puce('Consulter le détail de vos soldes de congés'),
        puce('Gérer votre Compte Épargne Temps (CET) si vous y êtes éligible'),

        new Paragraph({ spacing: { after: 200 }, children: [] }),

        encadre('Le Compte Épargne Temps (CET) vous permet d\'épargner des jours de congés non pris. Conditions : 1 an d\'ancienneté minimum, 20 jours de congés posés dans l\'année, maximum 5 jours par an, plafond de 60 jours.'),

        // ============ SAUT DE PAGE ============
        new Paragraph({ children: [new PageBreak()] }),

        // ============ PAGE FINALE ============
        new Paragraph({ spacing: { before: 800 }, children: [] }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: logoImage,
              transformation: { width: 120, height: 120 },
              type: 'png',
            }),
          ],
        }),

        new Paragraph({ spacing: { before: 200 }, children: [] }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [
            new TextRun({
              text: 'Besoin d\'aide ?',
              bold: true,
              font: 'Calibri',
              size: 32,
              color: COLORS.bleuFonce,
            }),
          ],
        }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [
            new TextRun({
              text: 'Contactez le service des Ressources Humaines',
              font: 'Calibri',
              size: 24,
              color: COLORS.gris,
            }),
          ],
        }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: 'Mairie de Chartrettes',
              font: 'Calibri',
              size: 22,
              color: COLORS.vert,
              bold: true,
            }),
          ],
        }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 100 },
          children: [
            new TextRun({
              text: '━━━━━━━━━━━━━━━━━━━━━━━',
              color: COLORS.bleuClair,
              font: 'Calibri',
              size: 24,
            }),
          ],
        }),

        // QR code en bas
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100 },
          children: [
            new ImageRun({
              data: qrCodeImage,
              transformation: { width: 180, height: 180 },
              type: 'png',
            }),
          ],
        }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: 'Scannez pour accéder à l\'application',
              font: 'Calibri',
              size: 18,
              color: COLORS.gris,
              italics: true,
            }),
          ],
        }),
      ],
    },
  ],
});

// Génération du fichier
const outputPath = path.join(__dirname, 'Guide_Mon_Portail_Agent.docx');
const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outputPath, buffer);
console.log(`Document généré avec succès : ${outputPath}`);
