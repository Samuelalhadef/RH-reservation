'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import toast from 'react-hot-toast';

export default function ProfilPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [cet, setCet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [transferAmount, setTransferAmount] = useState(0);
  const [transferring, setTransferring] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [withdrawing, setWithdrawing] = useState(false);
  const [activeTab, setActiveTab] = useState('profil');
  const [profileImage, setProfileImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    } else {
      fetchData();
    }
  }, [isAuthenticated, router]);

  const fetchData = async () => {
    try {
      const [profileRes, cetRes] = await Promise.all([
        fetch('/api/users/profile').then(r => r.json()),
        fetch('/api/cet').then(r => r.json()),
      ]);

      setProfile(profileRes.user || null);
      setCet(cetRes.cet || null);

      // Charger l'image de profil si elle existe
      if (profileRes.user?.photo_profil) {
        setProfileImage(profileRes.user.photo_profil);
      }
    } catch (error) {
      console.error('Error fetching profile data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleTransferToCET = async () => {
    if (transferAmount <= 0) {
      toast.error('Veuillez entrer un nombre de jours valide');
      return;
    }

    if (transferAmount > (profile?.jours_restants || 0)) {
      toast.error('Vous n\'avez pas assez de jours disponibles');
      return;
    }

    setTransferring(true);
    try {
      const response = await fetch('/api/cet/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jours: transferAmount, type: 'credit' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      toast.success(data.message);
      setTransferAmount(0);
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Erreur lors de la demande');
    } finally {
      setTransferring(false);
    }
  };

  const handleWithdrawFromCET = async () => {
    if (withdrawAmount <= 0) {
      toast.error('Veuillez entrer un nombre de jours valide');
      return;
    }

    setWithdrawing(true);
    try {
      const response = await fetch('/api/cet/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jours: withdrawAmount, type: 'debit' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      toast.success(data.message);
      setWithdrawAmount(0);
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Erreur lors de la demande');
    } finally {
      setWithdrawing(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image');
      return;
    }

    // Vérifier la taille (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('L\'image ne doit pas dépasser 2 Mo');
      return;
    }

    setUploadingImage(true);

    // Convertir en base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64 = reader.result;

        const response = await fetch('/api/users/photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo: base64 }),
        });

        const data = await response.json();

        if (!response.ok) {
          toast.error(data.message || 'Erreur lors de l\'upload');
          return;
        }

        setProfileImage(base64);
        toast.success('Photo de profil mise à jour');
      } catch (error) {
        toast.error('Erreur lors de l\'upload de la photo');
      } finally {
        setUploadingImage(false);
      }
    };
    reader.onerror = () => {
      toast.error('Erreur lors de la lecture du fichier');
      setUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <p className="text-center">Chargement...</p>
        </div>
      </div>
    );
  }

  const calculateAnciennete = (dateEntree) => {
    if (!dateEntree) return null;
    const start = new Date(dateEntree);
    const now = new Date();
    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();
    if (months < 0) {
      years--;
      months += 12;
    }
    if (now.getDate() < start.getDate()) {
      months--;
      if (months < 0) {
        years--;
        months += 12;
      }
    }
    if (years > 0) return `${years} an${years > 1 ? 's' : ''}${months > 0 ? ` ${months} mois` : ''}`;
    if (months > 0) return `${months} mois`;
    return 'Moins d\'un mois';
  };

  const hasMinOneYearAnciennete = (dateEntree) => {
    if (!dateEntree) return false;
    const entree = new Date(dateEntree);
    const now = new Date();
    return (now - entree) >= 365.25 * 24 * 60 * 60 * 1000;
  };

  const cetAncienneteOk = hasMinOneYearAnciennete(profile?.date_entree_mairie);
  const cetJoursPrisOk = (profile?.jours_pris || 0) >= 20;
  const cetJoursTransferesAnnee = cet?.jours_transferes_annee || 0;
  const cetResteTransferable = Math.max(0, 5 - cetJoursTransferesAnnee);
  const cetSolde = cet?.solde || 0;
  const cetPlaceDisponible = Math.max(0, 60 - cetSolde);
  const cetPlafondOk = cetPlaceDisponible > 0;
  const cetMaxTransferable = Math.min(cetResteTransferable, cetPlaceDisponible, profile?.jours_restants || 0);
  const cetEligible = cetAncienneteOk && cetJoursPrisOk && cetResteTransferable > 0 && cetPlafondOk;

  const cetBlockReasons = [];
  if (!cetAncienneteOk) {
    cetBlockReasons.push(
      profile?.date_entree_mairie
        ? `Ancienneté insuffisante (${calculateAnciennete(profile.date_entree_mairie)}, minimum 1 an requis)`
        : 'Date d\'entrée à la mairie non renseignée. Contactez les RH.'
    );
  }
  if (!cetJoursPrisOk) {
    cetBlockReasons.push(`Vous devez avoir pris au moins 20 jours de congé (${profile?.jours_pris || 0} pris actuellement)`);
  }
  if (cetAncienneteOk && cetJoursPrisOk && cetResteTransferable <= 0) {
    cetBlockReasons.push('Vous avez déjà transféré le maximum de 5 jours cette année');
  }
  if (!cetPlafondOk) {
    cetBlockReasons.push('Votre CET a atteint le plafond maximum de 60 jours');
  }

  const tabs = [
    { id: 'profil', label: 'Mon Profil', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { id: 'conges', label: 'Congés & CET', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'documentation', label: 'Documentation', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="container mx-auto px-4 sm:px-6 py-6 overflow-x-hidden">
        {/* Header avec photo */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="relative group flex-shrink-0">
              <div
                className="w-16 h-16 sm:w-24 sm:h-24 rounded-full flex items-center justify-center overflow-hidden cursor-pointer border-4 border-white shadow-lg"
                style={{
                  background: profileImage ? 'transparent' : 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)'
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                {profileImage ? (
                  <img src={profileImage} alt="Photo de profil" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-3xl font-semibold">
                    {user?.prenom?.[0]}{user?.nom?.[0]}
                  </span>
                )}
              </div>
              <div
                className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              {uploadingImage && (
                <div className="absolute inset-0 bg-white bg-opacity-75 rounded-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              )}
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-800">{user?.prenom} {user?.nom}</h1>
              <p className="text-gray-500">{profile?.type_utilisateur}</p>
              {profile?.service && <p className="text-sm text-gray-400">{profile.service}</p>}
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex overflow-x-auto border-b border-gray-200 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contenu des onglets */}
        {activeTab === 'profil' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Informations personnelles */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Informations personnelles</h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-600">Nom complet</span>
                  <span className="font-medium text-gray-800">{profile?.prenom} {profile?.nom}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-600">Type</span>
                  <span className="font-medium text-gray-800">{profile?.type_utilisateur}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-600">Service</span>
                  <span className="font-medium text-gray-800">{profile?.service || '-'}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-600">Poste</span>
                  <span className="font-medium text-gray-800">{profile?.poste || '-'}</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-gray-600">Ancienneté</span>
                  {profile?.date_entree_mairie ? (
                    <div className="text-right">
                      <span className="font-medium text-gray-800">{calculateAnciennete(profile.date_entree_mairie)}</span>
                      <p className="text-xs text-gray-500">Depuis le {new Date(profile.date_entree_mairie).toLocaleDateString('fr-FR')}</p>
                    </div>
                  ) : (
                    <span className="text-gray-400">Non renseigné</span>
                  )}
                </div>
              </div>
            </div>

            {/* Sécurité */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Sécurité</h3>

              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">Mot de passe</p>
                      <p className="text-sm text-gray-500">Dernière modification : inconnue</p>
                    </div>
                    <button
                      onClick={() => setShowPasswordModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                    >
                      Modifier
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm text-blue-800">
                        Nous vous recommandons de changer votre mot de passe régulièrement et d'utiliser un mot de passe unique.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'conges' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Solde de congés */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Mon solde de congés</h3>

              <div className="space-y-4">
                <div className="text-center p-6 bg-blue-50 rounded-xl">
                  <p className="text-sm text-gray-600 mb-1">Jours restants</p>
                  <p className="text-4xl font-bold text-blue-600">{profile?.jours_restants || 0}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <p className="text-xs text-gray-500">Acquis</p>
                    <p className="text-xl font-bold text-gray-800">{profile?.jours_acquis || 25}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <p className="text-xs text-gray-500">Pris</p>
                    <p className="text-xl font-bold text-gray-800">{profile?.jours_pris || 0}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-orange-50 rounded-lg text-center">
                    <p className="text-xs text-orange-600">Reportés</p>
                    <p className="text-xl font-bold text-orange-600">{profile?.jours_reportes || 0}</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg text-center">
                    <p className="text-xs text-green-600">Fractionnement</p>
                    <p className="text-xl font-bold text-green-600">{profile?.jours_fractionnement || 0}</p>
                  </div>
                </div>

                <div className="p-3 bg-indigo-50 rounded-lg text-center">
                  <p className="text-xs text-indigo-600">Jours compensateurs</p>
                  <p className="text-xl font-bold text-indigo-600">{profile?.jours_compensateurs || 0}</p>
                </div>
              </div>
            </div>

            {/* CET */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-bold text-gray-800">Compte Épargne Temps</h3>
              </div>

              <div className="text-center p-6 bg-indigo-50 rounded-xl mb-4">
                <p className="text-sm text-gray-600 mb-1">Solde CET</p>
                <p className="text-4xl font-bold text-indigo-600">{cet?.solde || 0}</p>
                <p className="text-xs text-gray-500 mt-1">jours épargnés</p>
              </div>

              {/* Demandes en attente */}
              {cet?.demandes_en_attente && cet.demandes_en_attente.length > 0 && (
                <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-sm font-medium text-yellow-800 mb-2">Demande(s) en attente de validation RH :</p>
                  {cet.demandes_en_attente.map((d) => (
                    <div key={d.id} className="flex justify-between items-center text-sm py-1">
                      <span className="text-yellow-700">
                        {d.type === 'credit' ? 'Versement vers CET' : 'Retrait CET vers congés'} - {d.jours} jour(s)
                      </span>
                      <span className="text-xs text-yellow-600">{d.date_demande}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Demandes récentes traitées */}
              {cet?.demandes_recentes && cet.demandes_recentes.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Demandes récentes</p>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {cet.demandes_recentes.slice(0, 5).map((d) => (
                      <div key={d.id} className="flex justify-between items-center text-xs py-1">
                        <span className="text-gray-600">
                          {d.type === 'credit' ? 'Versement' : 'Retrait'} {d.jours}j - {d.date_demande}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded font-medium ${d.statut === 'validee' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {d.statut === 'validee' ? 'Validée' : 'Refusée'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Versement congés -> CET */}
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-semibold text-gray-800 mb-3">Verser des jours vers le CET</p>
                {cetEligible ? (
                  <>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        max={cetMaxTransferable}
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(parseInt(e.target.value) || 0)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Nb jours"
                      />
                      <button
                        onClick={handleTransferToCET}
                        disabled={transferring || transferAmount <= 0}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition font-medium text-sm"
                      >
                        {transferring ? '...' : 'Demander'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {cetJoursTransferesAnnee}/5 jour(s) cette année — Plafond : {cetSolde}/60 — Max : {cetMaxTransferable} jour(s)
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      La demande sera soumise aux RH pour validation.
                    </p>
                  </>
                ) : (
                  <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-sm font-medium text-orange-800">Versement non disponible</p>
                    <ul className="text-xs text-orange-700 mt-1 space-y-0.5">
                      {cetBlockReasons.map((reason, i) => (
                        <li key={i}>- {reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Retrait CET -> congés */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <p className="text-sm font-semibold text-gray-800 mb-3">Retirer des jours du CET vers vos congés</p>
                {cetSolde > 0 ? (
                  <>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        max={cetSolde}
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(parseInt(e.target.value) || 0)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="Nb jours"
                      />
                      <button
                        onClick={handleWithdrawFromCET}
                        disabled={withdrawing || withdrawAmount <= 0}
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition font-medium text-sm"
                      >
                        {withdrawing ? '...' : 'Demander'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {cetSolde} jour(s) disponible(s) dans votre CET
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      La demande sera soumise aux RH pour validation.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">Aucun jour dans votre CET</p>
                )}
              </div>

              {/* Conditions CET */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-600 mb-1">Conditions pour verser vers le CET :</p>
                <ul className="text-xs text-gray-500 space-y-0.5">
                  <li className={cetAncienneteOk ? 'text-green-600' : ''}>
                    {cetAncienneteOk ? '\u2713' : '\u2022'} 1 an d'ancienneté minimum
                  </li>
                  <li className={cetJoursPrisOk ? 'text-green-600' : ''}>
                    {cetJoursPrisOk ? '\u2713' : '\u2022'} 20 jours de congé pris minimum ({profile?.jours_pris || 0}/20)
                  </li>
                  <li className={cetResteTransferable > 0 ? 'text-green-600' : ''}>
                    {cetResteTransferable > 0 ? '\u2713' : '\u2022'} Maximum 5 jours/an ({cetJoursTransferesAnnee}/5 utilisés)
                  </li>
                  <li className={cetPlafondOk ? 'text-green-600' : ''}>
                    {cetPlafondOk ? '\u2713' : '\u2022'} Plafond CET de 60 jours ({cetSolde}/60)
                  </li>
                </ul>
              </div>

              {cet?.historique && cet.historique.length > 0 && (
                <div className="mt-4 border-t border-gray-200 pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Historique des transferts</p>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {cet.historique.slice(0, 5).map((h, i) => (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">{h.date}</span>
                        <span className={h.type === 'credit' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          {h.type === 'credit' ? '+' : '-'}{h.jours} j
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'documentation' && (
          <div className="space-y-6">
            {/* CET Documentation */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-800">Compte Épargne Temps (CET)</h3>
              </div>

              <div className="prose prose-sm max-w-none text-gray-600">
                <p className="mb-4">
                  Le <strong>Compte Épargne Temps (CET)</strong> est un dispositif qui vous permet d'accumuler des droits à congés rémunérés ou de bénéficier d'une rémunération en échange de jours de repos non pris.
                </p>

                <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Comment ça fonctionne ?</h4>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Vous pouvez transférer vos jours de congés non utilisés vers votre CET</li>
                  <li>Les jours épargnés sont conservés sans limite de durée</li>
                  <li>Vous pouvez utiliser ces jours ultérieurement pour prendre des congés plus longs</li>
                  <li>Le CET peut également être monétisé sous certaines conditions</li>
                </ul>

                <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Avantages</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-4">
                  <div className="p-3 sm:p-4 bg-indigo-50 rounded-lg">
                    <div className="font-semibold text-indigo-800 mb-1">Flexibilité</div>
                    <p className="text-sm text-indigo-700">Utilisez vos jours quand vous le souhaitez</p>
                  </div>
                  <div className="p-3 sm:p-4 bg-indigo-50 rounded-lg">
                    <div className="font-semibold text-indigo-800 mb-1">Sécurité</div>
                    <p className="text-sm text-indigo-700">Vos jours ne sont jamais perdus</p>
                  </div>
                  <div className="p-3 sm:p-4 bg-indigo-50 rounded-lg">
                    <div className="font-semibold text-indigo-800 mb-1">Projets</div>
                    <p className="text-sm text-indigo-700">Planifiez des congés plus longs</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Fractionnement Documentation */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-800">Jours de Fractionnement</h3>
              </div>

              <div className="prose prose-sm max-w-none text-gray-600">
                <p className="mb-4">
                  Les <strong>jours de fractionnement</strong> sont des jours de congés supplémentaires accordés aux agents qui prennent une partie de leurs congés en dehors de la période principale (du 1er mai au 31 octobre).
                </p>

                <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Comment les obtenir ?</h4>
                <div className="bg-green-50 rounded-xl p-3 sm:p-4 mb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 bg-green-200 rounded-full flex items-center justify-center">
                        <span className="text-xl sm:text-2xl font-bold text-green-700">1</span>
                      </div>
                      <div>
                        <p className="font-semibold text-green-800">+1 jour</p>
                        <p className="text-sm text-green-700">Si vous prenez 3 à 5 jours hors période principale</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 bg-green-200 rounded-full flex items-center justify-center">
                        <span className="text-xl sm:text-2xl font-bold text-green-700">2</span>
                      </div>
                      <div>
                        <p className="font-semibold text-green-800">+2 jours</p>
                        <p className="text-sm text-green-700">Si vous prenez 6 jours ou plus hors période principale</p>
                      </div>
                    </div>
                  </div>
                </div>

                <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Période principale vs Fractionnement</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="p-3 sm:p-4 bg-orange-50 rounded-lg border-2 border-orange-200">
                    <div className="font-semibold text-orange-800 mb-1 sm:mb-2">Période principale</div>
                    <p className="text-sm text-orange-700 mb-1">Du 1er mai au 31 octobre</p>
                    <p className="text-xs text-orange-600">Période estivale classique pour les congés</p>
                  </div>
                  <div className="p-3 sm:p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                    <div className="font-semibold text-blue-800 mb-1 sm:mb-2">Période de fractionnement</div>
                    <p className="text-sm text-blue-700 mb-1">Du 1er novembre au 30 avril</p>
                    <p className="text-xs text-blue-600">Congés pris ici donnent droit à des jours bonus</p>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="font-semibold text-yellow-800">Bon à savoir</p>
                      <p className="text-sm text-yellow-700">
                        Lorsque vous faites une demande de congés pendant la période de fractionnement, l'application vous indique automatiquement combien de jours supplémentaires vous pouvez gagner.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Règles générales */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-800">Règles de demande de congés</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 flex-shrink-0 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-semibold text-gray-800">Délai de demande</span>
                  </div>
                  <p className="text-sm text-gray-600">Les demandes doivent être faites au moins 7 jours à l'avance</p>
                </div>

                <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 flex-shrink-0 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span className="font-semibold text-gray-800">Circuit de validation</span>
                  </div>
                  <p className="text-sm text-gray-600">Votre demande passe par votre responsable puis la RH</p>
                </div>

                <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 flex-shrink-0 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="font-semibold text-gray-800">Jours ouvrés</span>
                  </div>
                  <p className="text-sm text-gray-600">Seuls les jours ouvrés sont décomptés (hors weekends et fériés)</p>
                </div>

                <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 flex-shrink-0 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span className="font-semibold text-gray-800">Suivi</span>
                  </div>
                  <p className="text-sm text-gray-600">Suivez l'état de vos demandes dans "Mes demandes"</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </div>
  );
}
