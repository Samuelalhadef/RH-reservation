import Link from 'next/link';

export const metadata = {
  title: 'Politique de confidentialité - Portail Agent Chartrettes',
  description: 'Politique de protection des données personnelles du Portail Agent de la Mairie de Chartrettes.',
};

// ⚠️ À COMPLÉTER PAR LA MAIRIE / LE DPO : les mentions entre [crochets] doivent
// être vérifiées et complétées (coordonnées du DPO, durées exactes de conservation,
// localisation des sous-traitants) avant la mise en production.

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-10">
        <Link href="/" className="text-violet-600 hover:text-violet-800 text-sm font-medium">
          ← Retour à l'accueil
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mt-4 mb-2">Politique de confidentialité</h1>
        <p className="text-sm text-gray-500 mb-8">
          Protection des données personnelles — Portail Agent de la Mairie de Chartrettes
        </p>

        <div className="prose prose-sm sm:prose-base max-w-none text-gray-700 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-900">1. Responsable du traitement</h2>
            <p>
              Le responsable du traitement des données est la <strong>Mairie de Chartrettes</strong>,
              [adresse postale], représentée par Monsieur/Madame le Maire.
            </p>
            <p>
              Délégué à la protection des données (DPO) : <strong>[nom / e-mail du DPO]</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">2. Finalité du traitement</h2>
            <p>
              Le Portail Agent a pour finalité la <strong>gestion administrative des congés et absences</strong>{' '}
              des agents de la Mairie de Chartrettes : demandes de congés, validation hiérarchique,
              suivi des soldes, Compte Épargne Temps (CET), récupérations et congés liés à la parentalité.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">3. Base légale</h2>
            <p>
              Le traitement repose sur l'<strong>exécution d'une mission d'intérêt public</strong> et le respect
              des <strong>obligations légales</strong> de l'employeur en matière de gestion du personnel
              (article 6.1.c et 6.1.e du RGPD ; Code général de la fonction publique).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">4. Données collectées</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Identité : nom, prénom, adresse e-mail, photo de profil (facultative) ;</li>
              <li>Données professionnelles : service, poste, type et dates de contrat, date d'entrée, quotité de travail, ligne hiérarchique ;</li>
              <li>Données de gestion des congés : demandes, soldes, CET, récupérations ;</li>
              <li>Données relatives à la parentalité (maternité, paternité, adoption) et pièces justificatives associées, lorsque vous en faites la demande.</li>
            </ul>
            <p>
              Les données relatives à la parentalité peuvent constituer des <strong>données sensibles</strong>{' '}
              et ne sont accessibles qu'aux agents habilités du service RH.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">5. Destinataires et sous-traitants</h2>
            <p>
              Vos données sont accessibles, selon les habilitations, à votre hiérarchie et au
              service RH. Elles sont hébergées sur un <strong>serveur dédié situé dans les locaux
              de la Mairie de Chartrettes</strong> ; elles ne quittent donc pas les installations
              de la collectivité et restent sur le territoire français.
            </p>
            <p>
              L'administration technique de ce serveur est confiée à la société{' '}
              <strong>Mousquetaires</strong> (10 avenue de la Forêt, 77590 Bois-le-Roi), agissant
              en qualité de sous-traitant au sens de l'article 28 du RGPD.
            </p>
            <p>
              Le cas échéant, l'envoi des e-mails de notification est assuré par le prestataire{' '}
              <strong>Resend</strong>, et les notifications push (si vous y consentez) transitent
              par le service de notification de votre navigateur. {/* À confirmer/retirer selon l'architecture finale on-premise */}
            </p>
            <p>
              Aucune donnée n'est cédée à des tiers à des fins commerciales. Aucun outil de mesure
              d'audience tiers n'est utilisé.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">6. Durée de conservation</h2>
            <p>
              Les données sont conservées pendant la durée de la relation de travail, puis archivées
              ou supprimées conformément aux durées légales applicables à la fonction publique
              (à titre indicatif, <strong>[5 ans]</strong> pour les éléments liés aux congés après le départ de l'agent).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">7. Vos droits</h2>
            <p>Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Droit d'accès et de portabilité</strong> : vous pouvez télécharger l'ensemble de vos données depuis votre profil (bouton « Exporter mes données »).</li>
              <li><strong>Droit de rectification</strong> : demande de correction de données inexactes.</li>
              <li><strong>Droit à l'effacement et à la limitation</strong>, dans les limites des obligations légales de conservation.</li>
              <li><strong>Droit d'opposition</strong> pour motif légitime.</li>
            </ul>
            <p>
              Pour exercer ces droits, contactez le service RH ou le DPO à l'adresse{' '}
              <strong>[e-mail du DPO]</strong>. Vous pouvez également introduire une réclamation
              auprès de la <strong>CNIL</strong> (www.cnil.fr).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">8. Cookies</h2>
            <p>
              L'application utilise uniquement un <strong>cookie de session strictement nécessaire</strong>{' '}
              (authentification sécurisée). Ce cookie ne sert à aucun suivi publicitaire et ne requiert
              donc pas de consentement préalable. Les notifications push ne sont activées qu'avec votre accord.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">9. Sécurité</h2>
            <p>
              Les mots de passe sont stockés sous forme chiffrée (hachage bcrypt), les échanges sont
              protégés par HTTPS et l'accès aux données est restreint selon le rôle de chaque utilisateur.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-100 text-sm text-gray-500">
          <Link href="/mentions-legales" className="text-violet-600 hover:text-violet-800 font-medium">
            Mentions légales
          </Link>
        </div>
      </div>
    </div>
  );
}
