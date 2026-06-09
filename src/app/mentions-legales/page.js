import Link from 'next/link';

export const metadata = {
  title: 'Mentions légales - Portail Agent Chartrettes',
  description: 'Mentions légales du Portail Agent de la Mairie de Chartrettes.',
};

// ⚠️ À COMPLÉTER PAR LA MAIRIE : les mentions entre [crochets] (adresse, contact,
// directeur de publication, hébergeur exact) doivent être renseignées avant mise en production.

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-10">
        <Link href="/" className="text-violet-600 hover:text-violet-800 text-sm font-medium">
          ← Retour à l'accueil
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mt-4 mb-8">Mentions légales</h1>

        <div className="prose prose-sm sm:prose-base max-w-none text-gray-700 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-900">Éditeur</h2>
            <p>
              <strong>Mairie de Chartrettes</strong><br />
              [Adresse postale]<br />
              Téléphone : [numéro]<br />
              Courriel : [contact@mairie-chartrettes.fr]<br />
              Directeur de la publication : [Monsieur/Madame le Maire]
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Hébergement</h2>
            <p>
              L'application et les données sont hébergées sur un <strong>serveur dédié installé
              dans les locaux de la Mairie de Chartrettes</strong>. L'installation et l'administration
              technique de ce serveur sont assurées par la société{' '}
              <strong>Mousquetaires</strong>, 10 avenue de la Forêt, 77590 Bois-le-Roi.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Objet</h2>
            <p>
              Le Portail Agent est un outil interne réservé aux agents de la Mairie de Chartrettes
              pour la gestion de leurs congés et absences. L'accès est restreint aux personnes habilitées.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Propriété intellectuelle</h2>
            <p>
              L'ensemble des contenus de cette application est la propriété de la Mairie de Chartrettes.
              Toute reproduction sans autorisation est interdite.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">Protection des données</h2>
            <p>
              Le traitement de vos données personnelles est décrit dans notre{' '}
              <Link href="/confidentialite" className="text-violet-600 hover:text-violet-800 font-medium">
                politique de confidentialité
              </Link>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
