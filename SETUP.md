# Guide d'Installation - Application de Gestion des Congés

## Prérequis

- Node.js 18+ installé
- npm ou yarn
- Compte Turso (base de données déjà configurée)
- Compte Resend (pour les emails)

## Installation

### 1. Installer les dépendances

```bash
# Installer toutes les dépendances (root, server, client)
npm run install:all

# Ou installer manuellement
npm install
cd server && npm install
cd ../client && npm install
```

### 2. Configuration du serveur backend

Créer un fichier `.env` dans le dossier `server/` avec le contenu suivant :

```env
# Database Turso
TURSO_DATABASE_URL=libsql://chartrettes-rh-samuel-mairie.aws-eu-west-1.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjMxMjgxOTQsImlkIjoiODMwMzM4N2ItMDk0Yi00YzkzLWIwN2QtMmNmYWYzMGEwZjIyIiwicmlkIjoiMDQxYzVkMWQtNWZlYS00NWUyLWE3ZWQtZDY1MzgxYWFlZDMwIn0.bCsRlJoaQdMTUKDFFjW7lq4p0oHpO460V_FX82NwOPYxtdf3ZDniWzWxPn_nyb6ZpSxQHWVfW7z9yIqsPHmsBA

# JWT Secret (changez cette valeur en production)
JWT_SECRET=chartrettes_rh_super_secret_jwt_key_2024_change_in_production

# Resend API Key
RESEND_API_KEY=re_votre_cle_api_resend

# Server Config
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

**Important** : Pour obtenir votre clé API Resend :
1. Créez un compte sur https://resend.com
2. Allez dans "API Keys"
3. Créez une nouvelle clé API
4. Copiez-la dans le fichier `.env`

### 3. Configuration du client frontend (optionnel)

Créer un fichier `.env` dans le dossier `client/` :

```env
VITE_API_URL=http://localhost:3000/api
```

### 4. Initialiser la base de données

Exécuter le script de seed pour créer les tables et insérer les données de test :

```bash
cd server
node src/utils/seed.js
```

Ce script va :
- Créer toutes les tables nécessaires (users, soldes_conges, demandes_conges, jours_feries)
- Créer 6 utilisateurs de test avec différents rôles
- Initialiser les soldes de congés (25 jours par personne)
- Ajouter les jours fériés français de 2025
- Créer quelques demandes de congés de test

## Lancement de l'application

### Option 1 : Lancer backend et frontend ensemble

```bash
# Depuis la racine du projet
npm run dev
```

Cette commande lance :
- Le serveur backend sur http://localhost:3000
- Le client frontend sur http://localhost:5173

### Option 2 : Lancer séparément

```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd client
npm run dev
```

## Accéder à l'application

1. Ouvrez votre navigateur sur http://localhost:5173
2. Vous verrez la page de connexion avec la liste des utilisateurs

## Comptes de test

Après avoir exécuté le script de seed, vous pouvez vous connecter avec :

### Compte RH (accès complet)
- **Nom** : Marie Dupont
- **Email** : marie.dupont@chartrettes.fr
- **Mot de passe** : password123

### Compte DG
- **Nom** : Jean Martin
- **Email** : jean.martin@chartrettes.fr
- **Mot de passe** : password123

### Compte Employé
- **Nom** : Sophie Bernard
- **Email** : sophie.bernard@chartrettes.fr
- **Mot de passe** : password123

### Autres comptes
- **Pierre Dubois** (Service Technique) - password123
- **Julie Thomas** (Employé) - password123
- **Lucas Robert** (Alternant) - password123

## Test des fonctionnalités

### 1. Connexion
- Cliquez sur un nom d'utilisateur
- Entrez le mot de passe
- Vous êtes redirigé vers le tableau de bord

### 2. Demande de congés (Employé)
- Remplissez le formulaire de demande
- Sélectionnez une date de début (minimum 7 jours à l'avance)
- Sélectionnez une date de fin
- Le nombre de jours ouvrés est calculé automatiquement
- Soumettez la demande

### 3. Validation de congés (RH uniquement)
- Connectez-vous avec le compte RH (Marie Dupont)
- Cliquez sur "Interface RH" dans la navbar
- Allez dans l'onglet "Demandes en attente"
- Validez ou refusez les demandes avec un commentaire optionnel

### 4. Gestion des utilisateurs (RH uniquement)
- Interface RH → Onglet "Gestion des utilisateurs"
- Créez de nouveaux utilisateurs
- Réinitialisez les mots de passe
- Consultez les soldes de congés de tous les employés

### 5. Calendrier global
- Visualisez toutes les absences validées sur le calendrier
- Les jours fériés sont affichés en violet
- Les absences sont affichées en orange
- Cliquez sur une date pour voir les détails

## Dépannage

### Le serveur ne démarre pas
- Vérifiez que le fichier `.env` est bien créé dans `server/`
- Vérifiez que toutes les variables d'environnement sont définies
- Vérifiez que le port 3000 n'est pas déjà utilisé

### Le client ne se connecte pas au serveur
- Vérifiez que le serveur backend est bien démarré
- Vérifiez l'URL de l'API dans `client/.env` ou `client/src/services/api.js`

### Erreurs de base de données
- Vérifiez que les credentials Turso sont corrects
- Vérifiez votre connexion internet
- Relancez le script de seed si nécessaire

### Les emails ne sont pas envoyés
- Vérifiez que votre clé API Resend est correcte
- Vérifiez que vous n'avez pas dépassé les limites du plan gratuit (100 emails/jour)
- Consultez les logs du serveur pour plus de détails

## Production

Pour déployer en production :

1. Construire le frontend :
```bash
cd client
npm run build
```

2. Servir les fichiers statiques depuis le backend ou utiliser un service comme Vercel/Netlify pour le frontend

3. **Important** : Changez les variables d'environnement en production :
   - `JWT_SECRET` : Utilisez une clé secrète forte et unique
   - `NODE_ENV=production`
   - `FRONTEND_URL` : URL de votre frontend en production
   - Configurez un domaine d'envoi vérifié sur Resend

4. Configurez HTTPS pour la sécurité

## Support

Pour toute question ou problème :
- Vérifiez les logs du serveur dans la console
- Vérifiez les logs du navigateur (Console DevTools)
- Consultez la documentation de Turso : https://docs.turso.tech
- Consultez la documentation de Resend : https://resend.com/docs
