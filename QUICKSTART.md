# Démarrage Rapide

Guide rapide pour lancer l'application en 5 minutes.

## Installation Express

```bash
# 1. Installer toutes les dépendances
npm run install:all

# 2. Configurer les variables d'environnement
# Copiez server/.env.example vers server/.env
# Ajoutez votre clé API Resend dans RESEND_API_KEY

# 3. Initialiser la base de données avec des données de test
cd server
npm run seed

# 4. Lancer l'application (backend + frontend)
cd ..
npm run dev
```

## Accès à l'application

- **Frontend** : http://localhost:5173
- **Backend API** : http://localhost:3000

## Comptes de Test

### Compte RH (accès complet)
Cliquez sur **Marie Dupont**, mot de passe: `password123`

### Compte Employé
Cliquez sur **Sophie Bernard**, mot de passe: `password123`

### Compte DG
Cliquez sur **Jean Martin**, mot de passe: `password123`

## Obtenir une clé API Resend

1. Créez un compte gratuit sur https://resend.com
2. Allez dans "API Keys"
3. Créez une nouvelle clé
4. Ajoutez-la dans `server/.env` :
   ```
   RESEND_API_KEY=re_votre_cle_ici
   ```

Note: Le plan gratuit permet 100 emails/jour, ce qui est suffisant pour le développement.

## Fonctionnalités à Tester

1. **Connexion** - Sélectionnez un utilisateur et entrez le mot de passe
2. **Demande de congés** - Créez une nouvelle demande (minimum 7 jours à l'avance)
3. **Calendrier** - Visualisez toutes les absences et jours fériés
4. **Validation RH** - Connectez-vous en tant que RH pour valider/refuser des demandes
5. **Gestion des utilisateurs** - Créez de nouveaux comptes (RH uniquement)

## Structure du Projet

```
├── server/          # Backend Node.js + Express
│   ├── src/
│   │   ├── config/      # Configuration DB
│   │   ├── controllers/ # Logique métier
│   │   ├── routes/      # Routes API
│   │   ├── middleware/  # Auth & validation
│   │   └── utils/       # Utilitaires & seed
│   └── .env         # Variables d'environnement
│
└── client/          # Frontend React + Vite
    ├── src/
    │   ├── components/  # Composants réutilisables
    │   ├── pages/       # Pages principales
    │   ├── services/    # API calls
    │   └── contexts/    # Auth context
    └── .env         # Variables d'environnement (optionnel)
```

## Endpoints API Principaux

### Authentification
- `GET /api/auth/users` - Liste des utilisateurs
- `POST /api/auth/login` - Connexion
- `POST /api/auth/change-password` - Changer le mot de passe

### Congés
- `GET /api/leaves/my-leaves` - Mes demandes
- `POST /api/leaves` - Créer une demande
- `GET /api/leaves/calendar` - Calendrier global
- `PUT /api/leaves/:id/status` - Valider/Refuser (RH)

### Utilisateurs (RH)
- `GET /api/users/all` - Tous les utilisateurs avec soldes
- `POST /api/users` - Créer un utilisateur
- `POST /api/users/:id/reset-password` - Réinitialiser MDP

### Jours Fériés
- `POST /api/holidays/init` - Initialiser les jours fériés
- `GET /api/holidays` - Récupérer les jours fériés d'une année

## Commandes Utiles

```bash
# Lancer backend seulement
npm run dev:server

# Lancer frontend seulement
npm run dev:client

# Réinitialiser la base de données
cd server && npm run seed

# Build pour production
npm run build
```

## Besoin d'aide ?

Consultez le fichier [SETUP.md](./SETUP.md) pour une documentation complète.
