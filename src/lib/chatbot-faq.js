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
    a: "Saisissez votre identifiant (fourni par la RH) et votre mot de passe sur la page d'accueil. À la première connexion, un mot de passe temporaire vous est attribué : il faudra le changer immédiatement.",
  },
  {
    id: 2,
    cat: 'compte',
    q: "J'ai oublié mon mot de passe, que faire ?",
    keywords: ['oublié', 'oublier', 'reset', 'perdu', 'mot de passe'],
    a: "Contactez le service RH : il pourra réinitialiser votre mot de passe. Un mot de passe temporaire vous sera transmis et vous serez invité à le changer à la prochaine connexion.",
  },
  {
    id: 3,
    cat: 'compte',
    q: "Comment changer mon mot de passe ?",
    keywords: ['changer', 'modifier', 'mot de passe', 'password'],
    a: "Allez sur votre profil (icône en haut à droite) puis cliquez sur \"Changer le mot de passe\". Vous devez saisir l'ancien mot de passe puis le nouveau (deux fois).",
  },
  {
    id: 4,
    cat: 'compte',
    q: "Pourquoi suis-je déconnecté automatiquement ?",
    keywords: ['déconnecté', 'session', 'expirée', 'expire'],
    a: "Pour des raisons de sécurité, votre session expire après une période d'inactivité. Reconnectez-vous simplement avec vos identifiants.",
  },
  {
    id: 5,
    cat: 'compte',
    q: "Comment me déconnecter ?",
    keywords: ['déconnexion', 'logout', 'quitter', 'sortir'],
    a: "Cliquez sur l'icône de déconnexion en haut à droite (porte avec flèche). Sur mobile, ouvrez le menu burger et cliquez sur \"Se déconnecter\".",
  },

  // Demandes (10)
  {
    id: 6,
    cat: 'demandes',
    q: "Comment faire une demande de congés ?",
    keywords: ['demande', 'congés', 'poser', 'créer', 'nouvelle'],
    a: "Allez sur \"Mes demandes\" puis cliquez sur \"Nouvelle demande\". Choisissez le type, les dates de début et de fin, ajoutez un motif si besoin et soumettez.",
  },
  {
    id: 7,
    cat: 'demandes',
    q: "Combien de temps à l'avance dois-je faire ma demande ?",
    keywords: ['avance', 'délai', 'minimum', '7 jours'],
    a: "Toute demande de congés doit être posée au moins 7 jours à l'avance. L'application bloquera les demandes qui ne respectent pas ce délai.",
  },
  {
    id: 8,
    cat: 'demandes',
    q: "Quels sont les types de congés disponibles ?",
    keywords: ['type', 'types', 'rtt', 'cp', 'maladie', 'enfant'],
    a: "Vous pouvez poser : Congés payés, RTT, Récupération, Congé maladie, Congé enfant malade, Congé sans solde, Congé exceptionnel. Chaque type a ses propres règles.",
  },
  {
    id: 9,
    cat: 'demandes',
    q: "Puis-je poser une demi-journée ?",
    keywords: ['demi', 'demi-journée', 'matin', 'après-midi'],
    a: "Oui. Lors de la création, sélectionnez \"Matin\" ou \"Après-midi\" pour le début et/ou la fin. Une demi-journée compte pour 0,5 jour ouvré.",
  },
  {
    id: 10,
    cat: 'demandes',
    q: "Comment annuler une demande ?",
    keywords: ['annuler', 'annulation', 'supprimer'],
    a: "Sur \"Mes demandes\", chaque demande en attente ou validée a un bouton \"Annuler\". Si elle était validée, votre solde est automatiquement recrédité.",
  },
  {
    id: 11,
    cat: 'demandes',
    q: "Comment savoir si ma demande a été validée ?",
    keywords: ['statut', 'validée', 'refusée', 'attente'],
    a: "Sur \"Mes demandes\", chaque demande affiche son statut : En attente (orange), Validée (vert), Refusée (rouge) ou Annulée (gris). Vous recevrez aussi une notification.",
  },
  {
    id: 12,
    cat: 'demandes',
    q: "Les week-ends et jours fériés sont-ils décomptés ?",
    keywords: ['week-end', 'weekend', 'férié', 'samedi', 'dimanche', 'décompte'],
    a: "Non. Seuls les jours ouvrés (lundi-vendredi, hors jours fériés) sont décomptés. La liste officielle des jours fériés est synchronisée avec l'API du gouvernement français.",
  },
  {
    id: 13,
    cat: 'demandes',
    q: "Puis-je modifier une demande déjà soumise ?",
    keywords: ['modifier', 'éditer', 'changer', 'demande'],
    a: "Non, une demande soumise ne peut pas être modifiée directement. Il faut l'annuler et en créer une nouvelle avec les bonnes informations.",
  },
  {
    id: 14,
    cat: 'demandes',
    q: "Que se passe-t-il si ma demande est refusée ?",
    keywords: ['refusée', 'refus', 'rejet'],
    a: "Vous recevez une notification avec le motif du refus. Aucun jour n'est décompté de votre solde. Vous pouvez en discuter avec votre responsable et reposer une demande différente.",
  },
  {
    id: 15,
    cat: 'demandes',
    q: "Combien de jours de congés me reste-t-il avant ma demande ?",
    keywords: ['restant', 'simulation', 'avant'],
    a: "Lors de la création de la demande, l'application calcule automatiquement le nombre de jours ouvrés et affiche votre solde après validation simulée. Cela vous évite les mauvaises surprises.",
  },

  // Solde (5)
  {
    id: 16,
    cat: 'solde',
    q: "Comment voir mon solde de congés ?",
    keywords: ['solde', 'restant', 'voir', 'jours'],
    a: "Le solde est affiché sur le tableau de bord et sur la page \"Mes demandes\". Vous voyez les jours acquis, pris, restants et reportés pour l'année en cours.",
  },
  {
    id: 17,
    cat: 'solde',
    q: "Combien de jours de congés ai-je par an ?",
    keywords: ['nombre', 'an', 'année', 'acquis', '25'],
    a: "Par défaut, chaque agent acquiert 25 jours de congés payés par an. Le décompte exact peut varier selon votre temps de travail et votre statut — voir avec la RH.",
  },
  {
    id: 18,
    cat: 'solde',
    q: "Puis-je reporter mes jours non pris ?",
    keywords: ['reporter', 'report', 'année suivante'],
    a: "Oui, dans les limites prévues par la réglementation et votre statut. Les jours reportés apparaissent dans la colonne \"Jours reportés\" de votre solde.",
  },
  {
    id: 19,
    cat: 'solde',
    q: "Mon solde est faux, que faire ?",
    keywords: ['faux', 'erreur', 'incorrect', 'solde'],
    a: "Le solde est recalculé automatiquement à partir de vos demandes validées. Si vous constatez un écart, contactez la RH avec le détail des dates concernées.",
  },
  {
    id: 20,
    cat: 'solde',
    q: "Quand mon solde est-il mis à jour ?",
    keywords: ['mise à jour', 'maj', 'update', 'recalculer'],
    a: "Immédiatement après chaque validation, refus ou annulation d'une demande. Le compteur \"jours pris\" est recalculé à partir de la somme des congés validés.",
  },

  // Récupération (5)
  {
    id: 21,
    cat: 'recuperation',
    q: "Qu'est-ce que la récupération ?",
    keywords: ['récupération', 'recup', 'heures sup'],
    a: "Les heures de récupération correspondent à des heures travaillées en plus (réunions tardives, samedi exceptionnel, etc.) qui peuvent être converties en demi-journées ou journées de repos.",
  },
  {
    id: 22,
    cat: 'recuperation',
    q: "Comment déclarer des heures de récupération ?",
    keywords: ['déclarer', 'ajouter', 'heures', 'récupération'],
    a: "Allez sur \"Récupération\", cliquez sur \"Nouvelle déclaration\", saisissez la date, le nombre d'heures et le motif. La déclaration est envoyée pour validation.",
  },
  {
    id: 23,
    cat: 'recuperation',
    q: "Comment utiliser mes heures de récupération ?",
    keywords: ['utiliser', 'poser', 'récupération', 'recup'],
    a: "Une fois vos heures validées, vous pouvez créer une demande de congé de type \"Récupération\". Le système décompte les heures de votre solde de récupération.",
  },
  {
    id: 24,
    cat: 'recuperation',
    q: "Combien d'heures de récupération puis-je accumuler ?",
    keywords: ['plafond', 'maximum', 'limite', 'heures'],
    a: "Il n'y a pas de plafond technique mais la RH peut imposer une limite. Privilégiez la prise rapide pour ne pas perdre vos droits.",
  },
  {
    id: 25,
    cat: 'recuperation',
    q: "Qui valide mes heures de récupération ?",
    keywords: ['valide', 'validation', 'qui', 'récupération'],
    a: "Votre responsable hiérarchique direct valide la déclaration, puis la RH peut effectuer un contrôle final selon votre niveau hiérarchique.",
  },

  // CET (5)
  {
    id: 26,
    cat: 'cet',
    q: "Qu'est-ce que le CET ?",
    keywords: ['cet', 'compte épargne', 'épargne'],
    a: "Le Compte Épargne Temps (CET) permet de mettre en réserve des jours de congés non pris pour les utiliser plus tard ou se les faire indemniser, dans la limite de 60 jours.",
  },
  {
    id: 27,
    cat: 'cet',
    q: "Qui peut ouvrir un CET ?",
    keywords: ['éligible', 'qui', 'ouverture', 'cet'],
    a: "Tout agent ayant au moins 1 an d'ancienneté et qui a pris au moins 20 jours de congés dans l'année peut alimenter un CET.",
  },
  {
    id: 28,
    cat: 'cet',
    q: "Combien de jours puis-je transférer chaque année ?",
    keywords: ['transfert', 'transférer', 'cet', 'plafond'],
    a: "Vous pouvez transférer jusqu'à 5 jours par an sur votre CET, dans la limite globale de 60 jours stockés. Tout transfert nécessite une demande validée par la RH.",
  },
  {
    id: 29,
    cat: 'cet',
    q: "Comment demander un transfert sur mon CET ?",
    keywords: ['demande', 'transfert', 'cet'],
    a: "Sur la page CET, cliquez sur \"Nouveau transfert\", saisissez le nombre de jours, validez. La RH reçoit la demande et l'approuve ou la refuse.",
  },
  {
    id: 30,
    cat: 'cet',
    q: "Comment utiliser mes jours stockés sur le CET ?",
    keywords: ['utiliser', 'poser', 'cet', 'jours'],
    a: "Lors de la création d'une demande de congé, choisissez le type \"CET\". Les jours sont alors décomptés de votre solde épargné.",
  },

  // Validation (5)
  {
    id: 31,
    cat: 'validation',
    q: "Qui valide mes demandes ?",
    keywords: ['valide', 'validation', 'responsable', 'qui'],
    a: "Votre responsable hiérarchique direct valide en premier. Selon les règles de votre service, la RH peut effectuer un second contrôle.",
  },
  {
    id: 32,
    cat: 'validation',
    q: "Comment fonctionne la hiérarchie de validation ?",
    keywords: ['hiérarchie', 'organigramme', 'niveau'],
    a: "Chaque agent a un responsable défini dans l'organigramme. Les demandes remontent automatiquement à ce responsable, puis éventuellement à la RH selon le niveau de validation requis.",
  },
  {
    id: 33,
    cat: 'validation',
    q: "Je suis responsable, où je vois les demandes à valider ?",
    keywords: ['à valider', 'pending', 'manager', 'responsable'],
    a: "Si vous avez un niveau hiérarchique supérieur à 0, l'onglet \"Validation\" apparaît dans le menu. Vous y voyez toutes les demandes en attente de votre approbation.",
  },
  {
    id: 34,
    cat: 'validation',
    q: "Combien de temps mon responsable a pour valider ?",
    keywords: ['délai', 'temps', 'attente', 'validation'],
    a: "Il n'y a pas de délai automatique imposé par l'application. Si votre demande tarde, relancez votre responsable directement.",
  },
  {
    id: 35,
    cat: 'validation',
    q: "Que voit mon responsable quand je fais une demande ?",
    keywords: ['voit', 'responsable', 'visibilité'],
    a: "Il voit votre nom, les dates demandées, le type, le nombre de jours ouvrés, votre motif et votre solde restant après validation.",
  },

  // Calendrier (3)
  {
    id: 36,
    cat: 'calendrier',
    q: "Où voir le calendrier de mon équipe ?",
    keywords: ['calendrier', 'équipe', 'team'],
    a: "Onglet \"Calendrier équipe\" : vue mensuelle avec tous les congés validés de votre service. Chaque agent a une couleur, les jours fériés sont grisés.",
  },
  {
    id: 37,
    cat: 'calendrier',
    q: "Puis-je voir les congés des autres services ?",
    keywords: ['autres', 'service', 'visibilité'],
    a: "Par défaut, vous voyez votre service. Seule la RH a accès à la vue globale de tous les services.",
  },
  {
    id: 38,
    cat: 'calendrier',
    q: "Les jours fériés sont-ils affichés ?",
    keywords: ['fériés', 'jours fériés', 'affichage'],
    a: "Oui, les jours fériés sont automatiquement marqués sur tous les calendriers. La liste est synchronisée avec l'API officielle du gouvernement français.",
  },

  // RH (5)
  {
    id: 39,
    cat: 'rh',
    q: "Comment accéder à l'interface RH ?",
    keywords: ['rh', 'interface rh', 'accès rh'],
    a: "Seuls les utilisateurs avec le rôle RH voient l'onglet \"Interface RH\" dans le menu. Si vous êtes RH et ne le voyez pas, contactez votre administrateur.",
  },
  {
    id: 40,
    cat: 'rh',
    q: "Comment créer un nouvel agent ? (RH)",
    keywords: ['créer', 'agent', 'utilisateur', 'nouveau'],
    a: "Interface RH > onglet \"Utilisateurs\" > \"Nouvel utilisateur\". Saisissez nom, prénom, email, type. Un mot de passe temporaire est généré automatiquement.",
  },
  {
    id: 41,
    cat: 'rh',
    q: "Comment poser une demande pour un agent ? (RH)",
    keywords: ['poser pour', 'rh-create', 'à la place'],
    a: "Dans l'interface RH, choisissez l'agent et créez la demande directement validée. Cela permet de saisir des congés exceptionnels ou rétroactifs.",
  },
  {
    id: 42,
    cat: 'rh',
    q: "Comment ajuster manuellement un solde ? (RH)",
    keywords: ['ajuster', 'solde', 'manuellement', 'rh'],
    a: "Interface RH > \"Soldes\" > sélectionnez l'agent > modifiez les jours acquis/pris/reportés. La modification est tracée dans l'historique.",
  },
  {
    id: 43,
    cat: 'rh',
    q: "Comment exporter les données ? (RH)",
    keywords: ['export', 'csv', 'excel', 'données'],
    a: "Interface RH > onglet \"Statistiques\" > bouton \"Exporter\". Le fichier CSV contient toutes les demandes, soldes et historiques sur la période choisie.",
  },

  // Notifications & PWA (4)
  {
    id: 44,
    cat: 'notifs',
    q: "Comment activer les notifications ?",
    keywords: ['notifications', 'activer', 'push', 'autoriser'],
    a: "Cliquez sur l'icône cloche en haut à droite, puis autorisez les notifications dans votre navigateur. Vous recevrez les alertes de validation/refus directement.",
  },
  {
    id: 45,
    cat: 'notifs',
    q: "Comment installer l'application sur mon téléphone ?",
    keywords: ['installer', 'pwa', 'téléphone', 'mobile', 'app'],
    a: "Sur mobile, ouvrez le site dans Chrome/Safari, puis menu > \"Ajouter à l'écran d'accueil\". L'application fonctionne ensuite comme une vraie app.",
  },
  {
    id: 46,
    cat: 'notifs',
    q: "Quelles notifications vais-je recevoir ?",
    keywords: ['types', 'notifications', 'reçois'],
    a: "Vous êtes notifié pour : validation/refus de vos demandes, nouvelles demandes à valider (si responsable), rappels avant le début d'un congé.",
  },
  {
    id: 47,
    cat: 'notifs',
    q: "Comment désactiver les notifications ?",
    keywords: ['désactiver', 'arrêter', 'couper', 'notifications'],
    a: "Cliquez à nouveau sur l'icône cloche pour vous désabonner, ou révoquez l'autorisation dans les paramètres de votre navigateur.",
  },

  // Profil (3)
  {
    id: 48,
    cat: 'profil',
    q: "Comment changer ma photo de profil ?",
    keywords: ['photo', 'avatar', 'profil', 'image'],
    a: "Allez sur votre profil (icône en haut à droite), cliquez sur la photo et téléversez une nouvelle image. Format JPEG ou PNG, max 2 Mo.",
  },
  {
    id: 49,
    cat: 'profil',
    q: "Comment modifier mes informations personnelles ?",
    keywords: ['modifier', 'informations', 'personnelles', 'email'],
    a: "Sur la page profil, vous pouvez modifier votre email et vos coordonnées. Le nom, prénom et type de poste ne sont modifiables que par la RH.",
  },
  {
    id: 50,
    cat: 'profil',
    q: "Quelles infos voient les autres agents sur moi ?",
    keywords: ['voient', 'visibilité', 'confidentialité'],
    a: "Les autres agents voient uniquement votre nom, prénom, photo et vos congés validés sur le calendrier équipe. Votre solde et le détail des demandes restent privés.",
  },
];

const STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'a', 'à', 'au', 'aux',
  'et', 'ou', 'mais', 'donc', 'or', 'ni', 'car', 'que', 'qui', 'quoi',
  'comment', 'pourquoi', 'quand', 'où', 'est', 'sont', 'pour', 'par',
  'sur', 'dans', 'avec', 'sans', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes',
  'son', 'sa', 'ses', 'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles',
  'se', 'ce', 'cette', 'ces', 'en', 'y', 'me', 'te', 'lui', 'leur',
  'pas', 'plus', 'moins', 'très', 'trop', 'peu', 'aussi', 'aussi',
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
