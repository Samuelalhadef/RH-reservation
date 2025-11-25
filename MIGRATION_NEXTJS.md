# Migration vers Next.js - Mairie de Chartrettes

Ce projet a été entièrement migré de React + Express vers Next.js 15 avec App Router.

## Structure du Projet

```
RH-reservation/
├── src/
│   ├── app/                    # App Router Next.js
│   │   ├── api/               # API Routes (remplace Express)
│   │   │   ├── auth/          # Authentification
│   │   │   ├── users/         # Gestion utilisateurs
│   │   │   ├── leaves/        # Gestion des congés
│   │   │   └── holidays/      # Jours fériés
│   │   ├── dashboard/         # Page tableau de bord
│   │   ├── rh/               # Page interface RH
│   │   ├── layout.js         # Layout racine
│   │   ├── page.js           # Page de connexion
│   │   └── globals.css       # Styles globaux
│   ├── components/           # Composants React
│   ├── contexts/            # Contexts (AuthContext)
│   ├── lib/                 # Utilitaires
│   │   ├── db.js           # Configuration base de données
│   │   ├── auth.js         # Helpers authentification
│   │   ├── email.js        # Service email
│   │   ├── dateUtils.js    # Utilitaires dates (serveur)
│   │   └── clientDateUtils.js  # Utilitaires dates (client)
│   └── utils/              # Scripts utilitaires
├── public/                 # Fichiers statiques
├── next.config.js         # Configuration Next.js
├── tailwind.config.js     # Configuration Tailwind
├── postcss.config.js      # Configuration PostCSS
├── jsconfig.json          # Configuration JavaScript
├── .env.example           # Variables d'environnement exemple
└── package.json           # Dépendances

# Anciens dossiers (à supprimer)
├── client/                # ❌ Ancien client React/Vite
└── server/               # ❌ Ancien serveur Express
```

## Installation et Configuration

### 1. Prérequis

- Node.js 18+
- Une base de données Turso (ou SQLite compatible)
- Un compte Resend pour l'envoi d'emails

### 2. Installation des dépendances

```bash
npm install
```

### 3. Configuration des variables d'environnement

Créez un fichier `.env.local` à la racine du projet:

```env
# Database Configuration (Turso)
TURSO_DATABASE_URL=libsql://your-database-url.turso.io
TURSO_AUTH_TOKEN=your-auth-token-here

# JWT Configuration
JWT_SECRET=your-jwt-secret-here-change-in-production

# Email Configuration (Resend)
RESEND_API_KEY=re_your_resend_api_key
FROM_EMAIL=noreply@chartrettes.fr
```

### 4. Initialisation de la base de données

```bash
npm run seed
```

Cela créera:
- Les tables nécessaires
- Des utilisateurs de test
- Les jours fériés 2025

### 5. Démarrage en développement

```bash
npm run dev
```

L'application sera disponible sur `http://localhost:3000`

### 6. Build pour production

```bash
npm run build
npm start
```

## Changements Majeurs

### Architecture

- **Avant**: Client React (Vite) + Serveur Express séparés
- **Maintenant**: Application Next.js unifiée avec App Router

### Authentification

- **Avant**: JWT stocké dans localStorage, envoyé via headers axios
- **Maintenant**: JWT stocké dans cookies HTTP-only sécurisés

### API Routes

- **Avant**: Routes Express dans `/server/src/routes`
- **Maintenant**: API Routes Next.js dans `/src/app/api`

### Composants

- **Avant**: Composants client React avec React Router
- **Maintenant**: Composants Next.js avec directive `'use client'` et Next Router

### Utilitaires

- **Serveur**: `/src/lib/` (db, auth, email, dateUtils)
- **Client**: `/src/lib/clientDateUtils.js` pour les fonctions côté client

## Comptes de Test

Après avoir exécuté `npm run seed`:

**Compte RH:**
- Email: `marie.dupont@chartrettes.fr`
- Mot de passe: `password123`

**Compte Employé:**
- Email: `jean.martin@chartrettes.fr`
- Mot de passe: `password123`

## Fonctionnalités

### Pour tous les utilisateurs:
- Connexion avec sélection de nom et mot de passe
- Tableau de bord avec solde de congés
- Création de demandes de congés
- Calendrier des absences
- Changement de mot de passe

### Pour les RH:
- Validation/Refus des demandes de congés
- Vue de toutes les demandes
- Gestion des utilisateurs
- Réinitialisation des mots de passe

## Scripts Disponibles

- `npm run dev` - Démarre le serveur de développement
- `npm run build` - Compile l'application pour la production
- `npm start` - Démarre le serveur de production
- `npm run lint` - Vérifie le code avec ESLint
- `npm run seed` - Initialise la base de données

## Migration des Anciens Dossiers

Une fois que vous avez vérifié que tout fonctionne correctement:

1. Vous pouvez supprimer les anciens dossiers:
```bash
rm -rf client/
rm -rf server/
```

2. Nettoyez les fichiers de configuration obsolètes si nécessaires

## Notes de Sécurité

- Les tokens JWT sont maintenant stockés dans des cookies HTTP-only
- Les API routes utilisent des helpers d'authentification (`requireAuth`, `requireRH`)
- Les mots de passe sont hashés avec bcrypt
- Validation des données côté serveur

## Support

Pour toute question ou problème, consultez:
- Documentation Next.js: https://nextjs.org/docs
- Documentation Turso: https://docs.turso.tech
- Documentation Resend: https://resend.com/docs
