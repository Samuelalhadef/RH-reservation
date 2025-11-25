# Mairie de Chartrettes - Gestion des Congés

Application Next.js pour la gestion des congés de la Mairie de Chartrettes.

## 🚀 Démarrage Rapide

### Installation

```bash
# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env.local
# Puis éditer .env.local avec vos valeurs

# Initialiser la base de données
npm run seed

# Démarrer en développement
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

### Comptes de test

**RH:**
- Email: `marie.dupont@chartrettes.fr`
- Mot de passe: `password123`

**Employé:**
- Email: `jean.martin@chartrettes.fr`
- Mot de passe: `password123`

## 📋 Fonctionnalités

### Pour tous les utilisateurs
- ✅ Connexion sécurisée
- 📊 Tableau de bord avec solde de congés
- 📝 Création de demandes de congés
- 📅 Calendrier des absences partagé
- 🔐 Changement de mot de passe

### Pour les RH
- ✅ Validation/Refus des demandes
- 📋 Vue de toutes les demandes
- 👥 Gestion des utilisateurs
- 🔄 Réinitialisation des mots de passe

## 🛠 Technologies

- **Framework**: Next.js 15 (App Router)
- **Base de données**: Turso (LibSQL)
- **Authentification**: JWT avec cookies HTTP-only
- **Emails**: Resend
- **Styling**: Tailwind CSS
- **UI Components**: React Calendar, React Hot Toast

## 📁 Structure

```
src/
├── app/                 # Pages et API Routes
│   ├── api/            # API Routes Next.js
│   ├── dashboard/      # Page tableau de bord
│   └── rh/            # Page interface RH
├── components/         # Composants React
├── contexts/          # Context React (Auth)
├── lib/              # Utilitaires et helpers
└── utils/            # Scripts (seed, etc.)
```

## 🔧 Configuration

### Variables d'environnement

Créez un fichier `.env.local`:

```env
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
JWT_SECRET=...
RESEND_API_KEY=...
FROM_EMAIL=...
```

### Base de données

Le projet utilise Turso (LibSQL). Pour créer une base de données:

```bash
# Installer Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Créer une base de données
turso db create chartrettes-rh

# Obtenir l'URL et le token
turso db show chartrettes-rh
turso db tokens create chartrettes-rh
```

## 📜 Scripts

- `npm run dev` - Serveur de développement
- `npm run build` - Build production
- `npm start` - Serveur production
- `npm run lint` - Linter
- `npm run seed` - Initialiser la base de données

## 📚 Documentation

Consultez [MIGRATION_NEXTJS.md](./MIGRATION_NEXTJS.md) pour plus de détails sur:
- L'architecture complète
- Les changements par rapport à l'ancienne version
- Les notes de sécurité

## 🔐 Sécurité

- Tokens JWT stockés dans cookies HTTP-only
- Mots de passe hashés avec bcrypt
- Validation des données côté serveur
- Protection CSRF avec cookies SameSite

## 📝 Licence

Propriété de la Mairie de Chartrettes
