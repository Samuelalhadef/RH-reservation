export const FAQ_CATEGORIES = [
  { id: 'compte', label: 'Compte & connexion' },
  { id: 'demandes', label: 'Demandes de congés' },
  { id: 'solde', label: 'Solde & jours' },
  { id: 'recuperation', label: 'Récupération' },
  { id: 'cet', label: 'CET' },
  { id: 'validation', label: 'Validation' },
  { id: 'calendrier', label: 'Calendrier' },
  { id: 'rh', label: 'Interface RH' },
  { id: 'notifs', label: 'Notifications & PWA' },
  { id: 'profil', label: 'Profil' },
];

export const FAQ = [
  // Compte & connexion (5)
  {
    id: 1,
    cat: 'compte',
    q: "Comment me connecter à l'application ?",
    keywords: ['connexion', 'connecter', 'login', 'identifiant', "se connecter"],
    a: "Sur l'écran d'accueil, sélectionnez votre nom dans la liste, puis saisissez votre mot de passe. À la première connexion, un mot de passe temporaire vous est attribué : un bandeau rouge sur le tableau de bord vous demandera de le changer immédiatement.",
  },
  {
    id: 2,
    cat: 'compte',
    q: "J'ai oublié mon mot de passe, que faire ?",
    keywords: ['oublié', 'oublier', 'reset', 'perdu', 'mot de passe'],
    a: "Contactez le service RH : il peut réinitialiser votre mot de passe depuis l'interface RH (onglet \"Gestion des utilisateurs\" > bouton \"Réinitialiser mot de passe\"). Un mot de passe temporaire vous sera communiqué.",
  },
  {
    id: 3,
    cat: 'compte',
    q: "Comment changer mon mot de passe ?",
    keywords: ['changer', 'modifier', 'mot de passe', 'password'],
    a: "Allez sur \"Profil\" (icône en haut à droite), onglet \"Mon Profil\", cliquez sur \"Modifier\" à côté du mot de passe. Saisissez l'ancien puis le nouveau (deux fois) pour confirmer.",
  },
  {
    id: 4,
    cat: 'compte',
    q: "Pourquoi suis-je déconnecté automatiquement ?",
    keywords: ['déconnecté', 'session', 'expirée', 'expire'],
    a: "Pour des raisons de sécurité, votre session expire après une période d'inactivité. Un message \"Session expirée\" s'affiche et vous êtes redirigé vers l'écran de connexion. Reconnectez-vous simplement.",
  },
  {
    id: 5,
    cat: 'compte',
    q: "Comment me déconnecter ?",
    keywords: ['déconnexion', 'logout', 'quitter', 'sortir'],
    a: "Sur desktop, cliquez sur l'icône de déconnexion (porte avec flèche) en haut à droite de la barre de navigation. Sur mobile, ouvrez le menu burger et cliquez sur \"Se déconnecter\" en bas.",
  },

  // Demandes (10)
  {
    id: 6,
    cat: 'demandes',
    q: "Comment faire une demande de congés ?",
    keywords: ['demande', 'congés', 'poser', 'créer', 'nouvelle', 'faire', 'tableau', 'bord', 'calendrier', 'cliquer'],
    a: "Allez sur le \"Tableau de bord\" : un calendrier interactif s'affiche. Cliquez sur la date de début (matin ou après-midi), puis sur la date de fin (matin ou après-midi). Un bouton \"Continuer\" apparaît, puis une fenêtre vous permet d'ajouter un motif et d'envoyer.",
  },
  {
    id: 7,
    cat: 'demandes',
    q: "Combien de temps à l'avance dois-je faire ma demande ?",
    keywords: ['avance', 'délai', 'minimum', '7 jours'],
    a: "Toute demande de congés doit être posée au moins 7 jours à l'avance. L'application bloque les demandes qui ne respectent pas ce délai et affiche un message d'erreur.",
  },
  {
    id: 8,
    cat: 'demandes',
    q: "Faut-il choisir un type de congé ?",
    keywords: ['type', 'cp', 'rtt', 'maladie', 'choix'],
    a: "Lors de la pose via le calendrier du tableau de bord, vous indiquez seulement les dates et un motif optionnel. La nature du congé (CP, récupération, CET) est gérée par les fonctionnalités dédiées : Récupération pour les heures sup, Profil > Congés & CET pour le CET.",
  },
  {
    id: 9,
    cat: 'demandes',
    q: "Puis-je poser une demi-journée ?",
    keywords: ['demi', 'demi-journée', 'matin', 'après-midi'],
    a: "Oui. Lorsque vous cliquez sur une date dans le calendrier du tableau de bord, vous choisissez \"Matin\" ou \"Après-midi\" pour le début et la fin. Une demi-journée compte pour 0,5 jour ouvré.",
  },
  {
    id: 10,
    cat: 'demandes',
    q: "Comment supprimer une demande ?",
    keywords: ['annuler', 'supprimer', 'annulation'],
    a: "Sur \"Mes demandes\", chaque demande encore en attente et dont la date de début n'est pas passée affiche une icône poubelle \"Supprimer\". Une fois validée ou passée, la demande ne peut plus être supprimée — contactez la RH.",
  },
  {
    id: 11,
    cat: 'demandes',
    q: "Comment savoir si ma demande a été validée ?",
    keywords: ['statut', 'validée', 'refusée', 'attente'],
    a: "Sur \"Mes demandes\", chaque demande affiche son statut (En attente, Validée, Refusée). Vous voyez aussi le circuit de validation détaillé : qui doit valider (N+1, N+2, RH) et où la demande est bloquée. Vous recevez une notification à chaque étape.",
  },
  {
    id: 12,
    cat: 'demandes',
    q: "Les week-ends et jours fériés sont-ils décomptés ?",
    keywords: ['week-end', 'weekend', 'férié', 'samedi', 'dimanche', 'décompte'],
    a: "Non. Seuls les jours ouvrés (lundi-vendredi, hors jours fériés) sont décomptés. La liste des jours fériés est synchronisée avec l'API officielle du gouvernement français.",
  },
  {
    id: 13,
    cat: 'demandes',
    q: "Puis-je modifier une demande déjà soumise ?",
    keywords: ['modifier', 'éditer', 'changer', 'demande'],
    a: "Non, une demande ne peut pas être modifiée. Si elle est encore en attente et non commencée, supprimez-la depuis \"Mes demandes\" et créez-en une nouvelle. Sinon, contactez votre responsable ou la RH.",
  },
  {
    id: 14,
    cat: 'demandes',
    q: "Que se passe-t-il si ma demande est refusée ?",
    keywords: ['refusée', 'refus', 'rejet'],
    a: "Le statut passe à \"Refusée\" et vous recevez une notification. Aucun jour n'est décompté de votre solde. Vous pouvez en discuter avec votre responsable et reposer une nouvelle demande.",
  },
  {
    id: 15,
    cat: 'demandes',
    q: "Comment retrouver l'historique de toutes mes demandes ?",
    keywords: ['historique', 'liste', 'toutes', 'demandes'],
    a: "Allez sur \"Mes demandes\" : vous voyez le total, les en attente, validées et refusées. Quatre filtres en haut permettent de basculer entre ces statuts. Le tableau affiche les dates, jours, motif et circuit de validation.",
  },

  // Solde (5)
  {
    id: 16,
    cat: 'solde',
    q: "Où voir mon solde de congés ?",
    keywords: ['solde', 'restant', 'voir', 'jours'],
    a: "Le solde est affiché dans le panneau \"Mon solde\" du tableau de bord (à gauche) et également sur \"Profil\" > onglet \"Congés & CET\". Vous y voyez les jours restants, acquis, pris, reportés et fractionnés.",
  },
  {
    id: 17,
    cat: 'solde',
    q: "Combien de jours de congés ai-je par an ?",
    keywords: ['nombre', 'an', 'année', 'acquis', '25'],
    a: "Le nombre de jours acquis dépend de votre quotité de travail et de votre statut. Il est saisi par la RH lors de la création de votre compte. Consultez votre solde sur le tableau de bord ou la fiche Profil pour voir la valeur exacte.",
  },
  {
    id: 18,
    cat: 'solde',
    q: "Puis-je bénéficier de jours de fractionnement ?",
    keywords: ['fractionnement', 'bonus', 'jours sup', 'octobre', 'novembre'],
    a: "Oui : si vous prenez 3 à 5 jours de congés en dehors de la période mai-octobre, vous gagnez 1 jour bonus ; au-delà de 5 jours, +2 jours. Le formulaire de demande affiche un bandeau d'info à ce sujet et le compteur \"jours fractionnés\" apparaît sur votre solde.",
  },
  {
    id: 19,
    cat: 'solde',
    q: "Mon solde semble incorrect, que faire ?",
    keywords: ['faux', 'erreur', 'incorrect', 'solde'],
    a: "Le solde est recalculé automatiquement à partir de vos demandes validées. Si vous constatez un écart, contactez la RH : elle peut relancer un recalcul global depuis l'interface RH.",
  },
  {
    id: 20,
    cat: 'solde',
    q: "Quand mon solde est-il mis à jour ?",
    keywords: ['mise à jour', 'maj', 'update', 'recalculer'],
    a: "Immédiatement : à chaque validation, refus ou suppression d'une demande, le compteur \"jours pris\" est recalculé à partir de la somme des congés validés.",
  },

  // Récupération (5)
  {
    id: 21,
    cat: 'recuperation',
    q: "Qu'est-ce que la récupération ?",
    keywords: ['récupération', 'recup', 'heures sup'],
    a: "Les heures de récupération correspondent à des heures travaillées en plus (réunion en soirée, samedi exceptionnel, etc.). Vous pouvez choisir entre les récupérer en congé ou demander une rémunération équivalente.",
  },
  {
    id: 22,
    cat: 'recuperation',
    q: "Comment déclarer des heures de récupération ?",
    keywords: ['déclarer', 'ajouter', 'heures', 'récupération'],
    a: "Onglet \"Récupération\" > bouton bleu \"+ Déclarer des heures\". Saisissez la date du travail supplémentaire, le nombre d'heures, la raison et le type de compensation (Récupération en congé ou Rémunération). Cliquez \"Générer le document officiel\", signez numériquement, puis \"Signer et envoyer\".",
  },
  {
    id: 23,
    cat: 'recuperation',
    q: "Comment utiliser mes heures de récupération ?",
    keywords: ['utiliser', 'poser', 'récupération', 'recup'],
    a: "Une fois vos heures validées, allez sur \"Récupération\" et cliquez sur le bouton orange \"Utiliser mes heures\". Saisissez la date, l'heure de début et de fin (créneaux 14h00-19h30 par tranches de 30 min) et un motif.",
  },
  {
    id: 24,
    cat: 'recuperation',
    q: "Combien d'heures de récupération puis-je accumuler ?",
    keywords: ['plafond', 'maximum', 'limite', 'heures'],
    a: "Il n'y a pas de plafond technique imposé par l'application. Privilégiez toutefois la prise rapide pour rester en règle avec votre service.",
  },
  {
    id: 25,
    cat: 'recuperation',
    q: "Qui valide mes heures de récupération ?",
    keywords: ['valide', 'validation', 'qui', 'récupération'],
    a: "La RH valide depuis l'interface RH > onglet \"Récupération\". Elle voit votre demande, le document officiel signé, et peut Valider ou Refuser. Vous êtes notifié du résultat.",
  },

  // CET (5)
  {
    id: 26,
    cat: 'cet',
    q: "Qu'est-ce que le CET ?",
    keywords: ['cet', 'compte épargne', 'épargne'],
    a: "Le Compte Épargne Temps (CET) permet de mettre en réserve des jours de congés non pris pour les utiliser plus tard, dans la limite de 60 jours. Toutes les opérations CET passent par votre Profil et nécessitent une validation RH.",
  },
  {
    id: 27,
    cat: 'cet',
    q: "Qui peut alimenter un CET ?",
    keywords: ['éligible', 'qui', 'ouverture', 'cet'],
    a: "Tout agent ayant au moins 1 an d'ancienneté et qui a pris au moins 20 jours de congés dans l'année peut transférer des jours sur son CET. Ces conditions sont rappelées sur la page \"Profil\" > onglet \"Congés & CET\".",
  },
  {
    id: 28,
    cat: 'cet',
    q: "Combien de jours puis-je transférer chaque année ?",
    keywords: ['transfert', 'transférer', 'cet', 'plafond'],
    a: "Vous pouvez transférer jusqu'à 5 jours par an sur votre CET, dans la limite globale de 60 jours stockés. La RH valide chaque demande de transfert.",
  },
  {
    id: 29,
    cat: 'cet',
    q: "Comment transférer des jours sur mon CET ?",
    keywords: ['demande', 'transfert', 'verser', 'cet'],
    a: "Allez sur \"Profil\" > onglet \"Congés & CET\". Dans la section CET, cliquez sur \"Verser des jours vers le CET\", saisissez le nombre de jours et cliquez \"Demander\". Votre demande passe en attente de validation RH.",
  },
  {
    id: 30,
    cat: 'cet',
    q: "Comment utiliser des jours stockés sur le CET ?",
    keywords: ['utiliser', 'retirer', 'cet', 'jours'],
    a: "Sur \"Profil\" > onglet \"Congés & CET\", utilisez \"Retirer des jours du CET vers vos congés\" : indiquez le nombre de jours et cliquez \"Demander\". Une fois validé par la RH, ces jours sont ajoutés à votre solde de congés et vous pouvez les poser normalement.",
  },

  // Validation (5)
  {
    id: 31,
    cat: 'validation',
    q: "Qui valide mes demandes ?",
    keywords: ['valide', 'validation', 'responsable', 'qui'],
    a: "Votre responsable hiérarchique direct (N+1) valide en premier. Selon votre service, un N+2 puis la RH peuvent intervenir. Le circuit complet est affiché sur chaque demande dans \"Mes demandes\".",
  },
  {
    id: 32,
    cat: 'validation',
    q: "Comment fonctionne le circuit de validation ?",
    keywords: ['circuit', 'hiérarchie', 'niveau', 'étapes'],
    a: "Sur \"Mes demandes\", chaque ligne affiche un schéma visuel : Demande créée → N+1 → N+2 (si applicable) → RH. Les étapes terminées sont vertes, l'étape bloquante est mise en évidence.",
  },
  {
    id: 33,
    cat: 'validation',
    q: "Je suis responsable, où voir les demandes à valider ?",
    keywords: ['à valider', 'pending', 'manager', 'responsable'],
    a: "Si vous avez un niveau de validation > 0, l'onglet \"Validation\" apparaît dans le menu. Vous y voyez les demandes en attente à votre niveau (N+1, N+2 ou RH). Cliquez \"Examiner\" pour ouvrir la fenêtre Valider/Refuser/Annuler.",
  },
  {
    id: 34,
    cat: 'validation',
    q: "Combien de temps mon responsable a-t-il pour valider ?",
    keywords: ['délai', 'temps', 'attente', 'validation'],
    a: "Aucun délai automatique n'est imposé par l'application. Si votre demande tarde, relancez votre responsable directement.",
  },
  {
    id: 35,
    cat: 'validation',
    q: "Que voit mon responsable quand je fais une demande ?",
    keywords: ['voit', 'responsable', 'visibilité'],
    a: "Sur sa page \"Validation\", il voit : votre nom, les dates demandées, le nombre de jours ouvrés, votre motif et un bouton \"Examiner\" qui ouvre tous les détails dans une fenêtre.",
  },

  // Calendrier (3)
  {
    id: 36,
    cat: 'calendrier',
    q: "Où voir le calendrier de mon équipe ?",
    keywords: ['calendrier', 'équipe', 'team'],
    a: "Onglet \"Calendrier équipe\" : vue mensuelle de tous les congés VALIDÉS de votre équipe. Les demandes en attente n'y apparaissent pas. Un bandeau d'info le rappelle en haut de page.",
  },
  {
    id: 37,
    cat: 'calendrier',
    q: "Puis-je voir l'organigramme ?",
    keywords: ['organigramme', 'équipe', 'voir'],
    a: "Oui : depuis le \"Calendrier équipe\", un bouton \"Organigramme des membres\" ouvre une vue arborescente avec tous les services et agents. Vous pouvez aussi imprimer ou exporter en PDF.",
  },
  {
    id: 38,
    cat: 'calendrier',
    q: "Les jours fériés sont-ils affichés ?",
    keywords: ['fériés', 'jours fériés', 'affichage'],
    a: "Oui, les jours fériés sont automatiquement marqués sur le calendrier équipe et celui du tableau de bord. La liste est synchronisée avec l'API officielle du gouvernement français (calendrier.api.gouv.fr).",
  },

  // RH (5)
  {
    id: 39,
    cat: 'rh',
    q: "Comment accéder à l'interface RH ?",
    keywords: ['rh', 'interface rh', 'accès rh'],
    a: "Seuls les utilisateurs avec le rôle \"RH\", \"Direction\" ou \"DG\" voient l'onglet \"Interface RH\" dans la barre de navigation. Si vous êtes RH et ne le voyez pas, votre rôle doit être ajusté par un administrateur.",
  },
  {
    id: 40,
    cat: 'rh',
    q: "Comment la RH crée-t-elle un nouvel agent ?",
    keywords: ['créer', 'agent', 'utilisateur', 'nouveau'],
    a: "Interface RH > onglet \"Gestion des utilisateurs\" > bouton \"+ Créer un utilisateur\". Le formulaire demande nom, prénom, email, type d'utilisateur, service, poste, type de contrat, dates et quotité. Un mot de passe temporaire est généré.",
  },
  {
    id: 41,
    cat: 'rh',
    q: "La RH peut-elle poser un congé pour moi ?",
    keywords: ['rh', 'à la place', 'rh-create'],
    a: "Oui : Interface RH > onglet \"Créer un congé\". La RH choisit l'agent, les dates et un motif ; la demande est validée d'office et apparaît immédiatement dans votre solde.",
  },
  {
    id: 42,
    cat: 'rh',
    q: "Que peut faire la RH sur ma demande ?",
    keywords: ['rh', 'demande', 'forcer', 'annuler'],
    a: "Depuis l'onglet \"Toutes les demandes\", la RH peut Examiner, Valider, Refuser, \"Forcer validation RH\" pour court-circuiter le circuit, ou \"Annuler congé\" sur une demande déjà validée (avec saisie d'un motif).",
  },
  {
    id: 43,
    cat: 'rh',
    q: "La RH peut-elle exporter les données ?",
    keywords: ['export', 'csv', 'excel', 'données'],
    a: "Oui : Interface RH > onglet \"Statistiques avancées\". Boutons \"Export Excel\" et \"Export PDF\", avec sélecteur d'année. L'export contient demandes, soldes et statistiques agrégées.",
  },

  // Notifications & PWA (4)
  {
    id: 44,
    cat: 'notifs',
    q: "Comment activer les notifications ?",
    keywords: ['notifications', 'activer', 'push', 'autoriser'],
    a: "Cliquez sur l'icône cloche en haut à droite de la barre de navigation puis autorisez les notifications dans votre navigateur. La cloche devient bleue quand c'est activé.",
  },
  {
    id: 45,
    cat: 'notifs',
    q: "Comment installer l'application sur mon téléphone ?",
    keywords: ['installer', 'pwa', 'téléphone', 'mobile', 'app'],
    a: "Sur mobile, ouvrez le site dans Chrome ou Safari, puis menu navigateur > \"Ajouter à l'écran d'accueil\". L'application apparaît alors comme une vraie app et fonctionne en mode autonome.",
  },
  {
    id: 46,
    cat: 'notifs',
    q: "Quelles notifications vais-je recevoir ?",
    keywords: ['types', 'notifications', 'reçois'],
    a: "Vous êtes notifié pour : nouvelle demande à valider (si vous êtes responsable), validation/refus de vos demandes, étapes du circuit franchies, validation/refus d'une demande CET ou de récupération.",
  },
  {
    id: 47,
    cat: 'notifs',
    q: "Comment désactiver les notifications ?",
    keywords: ['désactiver', 'arrêter', 'couper', 'notifications'],
    a: "Cliquez à nouveau sur l'icône cloche pour vous désabonner, ou révoquez l'autorisation dans les paramètres de notifications de votre navigateur.",
  },

  // Profil (3)
  {
    id: 48,
    cat: 'profil',
    q: "Que contient la page Profil ?",
    keywords: ['profil', 'page', 'onglets', 'que voir'],
    a: "La page Profil a trois onglets : \"Mon Profil\" (infos personnelles + changement de mot de passe), \"Congés & CET\" (solde détaillé et opérations CET), et \"Documentation\" (règles fractionnement, CET, circuit de validation).",
  },
  {
    id: 49,
    cat: 'profil',
    q: "Puis-je modifier mes informations personnelles ?",
    keywords: ['modifier', 'informations', 'personnelles', 'email'],
    a: "Sur l'onglet \"Mon Profil\" vous pouvez changer votre mot de passe via le bouton \"Modifier\". Les autres champs (nom, prénom, type, service, poste, ancienneté) sont en consultation : pour les modifier, contactez la RH.",
  },
  {
    id: 50,
    cat: 'profil',
    q: "Quelles infos voient les autres agents sur moi ?",
    keywords: ['voient', 'visibilité', 'confidentialité'],
    a: "Les autres agents voient uniquement votre nom, prénom, et vos congés VALIDÉS sur le calendrier équipe. Votre solde, vos demandes en attente et leurs motifs restent privés.",
  },
];

const STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'a', 'à', 'au', 'aux',
  'et', 'ou', 'mais', 'donc', 'or', 'ni', 'car', 'que', 'qui', 'quoi',
  'comment', 'pourquoi', 'quand', 'où', 'est', 'sont', 'pour', 'par',
  'sur', 'dans', 'avec', 'sans', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes',
  'son', 'sa', 'ses', 'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles',
  'se', 'ce', 'cette', 'ces', 'en', 'y', 'me', 'te', 'lui', 'leur',
  'pas', 'plus', 'moins', 'très', 'trop', 'peu', 'aussi',
  'd', 'l', 's', 't', 'n', 'qu', 'm',
]);

function normalize(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w));
}

export function searchFaqIn(dataset, query, limit = 3) {
  const tokens = normalize(query);
  if (tokens.length === 0) return [];

  const scored = dataset.map((entry) => {
    const haystack = normalize(`${entry.q} ${entry.keywords.join(' ')} ${entry.a}`);
    let score = 0;
    for (const t of tokens) {
      for (const h of haystack) {
        if (h === t) score += 3;
        else if (h.startsWith(t) || t.startsWith(h)) score += 2;
        else if (h.includes(t) || t.includes(h)) score += 1;
      }
    }
    return { entry, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);
}

export function searchFaq(query, limit = 3) {
  return searchFaqIn(FAQ, query, limit);
}
