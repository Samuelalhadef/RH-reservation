'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import dynamic from 'next/dynamic';
const AdvancedStatsRH = dynamic(() => import('@/components/AdvancedStatsRH'), {
  loading: () => <div className="p-8 text-center text-gray-500">Chargement des statistiques...</div>
});
import { formatDateFR, formatStatus, getStatusColor } from '@/lib/clientDateUtils';
import toast from 'react-hot-toast';

export default function RHPage() {
  const { isRH, isAuthenticated } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('all');
  const [allLeaves, setAllLeaves] = useState([]);
  const [searchAll, setSearchAll] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    nom: '',
    prenom: '',
    email: '',
    type_utilisateur: 'Employé',
    service: '',
    poste: '',
    type_contrat: 'CDI',
    date_debut_contrat: '',
    date_fin_contrat: '',
    date_entree_mairie: '',
    quotite_travail: 100,
    responsable_id: ''
  });
  const [editingUser, setEditingUser] = useState(null);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [rhLeaveForm, setRhLeaveForm] = useState({
    user_id: '',
    date_debut: '',
    date_fin: '',
    motif: ''
  });
  const [rhLeaveLoading, setRhLeaveLoading] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustingUser, setAdjustingUser] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ adjustment: '', motif: '', type: 'compensateurs' });
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [cetRequests, setCetRequests] = useState([]);
  const [cetBalances, setCetBalances] = useState([]);
  const [cetActionLoading, setCetActionLoading] = useState(null);
  const [showCetAdjustModal, setShowCetAdjustModal] = useState(false);
  const [cetAdjustingUser, setCetAdjustingUser] = useState(null);
  const [cetAdjustForm, setCetAdjustForm] = useState({ jours: '', motif: '' });
  const [cetAdjustLoading, setCetAdjustLoading] = useState(false);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(null);
  const [recupRequests, setRecupRequests] = useState([]);
  const [recupUtilRequests, setRecupUtilRequests] = useState([]);
  const [recupActionLoading, setRecupActionLoading] = useState(null);
  const [selectedRecupDoc, setSelectedRecupDoc] = useState(null);
  const [recupBalances, setRecupBalances] = useState([]);
  const [rhRecupForm, setRhRecupForm] = useState({
    user_id: '',
    date_debut: '',
    date_fin: '',
    nombre_heures: '',
    raison: ''
  });
  const [rhRecupLoading, setRhRecupLoading] = useState(false);
  const [recupSubTab, setRecupSubTab] = useState('pending'); // pending | declarations | utilisations | balances | place
  const [recupSearch, setRecupSearch] = useState('');
  const [recupStatusFilter, setRecupStatusFilter] = useState('toutes'); // toutes | en_attente | validee | refusee
  const [forceValidateModal, setForceValidateModal] = useState(null); // { leave, action: 'valider'|'refuser' }
  const [forceValidateComment, setForceValidateComment] = useState('');
  const [forceValidateLoading, setForceValidateLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    } else if (!isRH()) {
      router.push('/dashboard');
    } else {
      fetchData();
    }
  }, [activeTab, isAuthenticated, isRH, router]);

  const fetchData = async () => {
    // Toujours charger le nombre de demandes CET et récup pour les badges
    try {
      const [cetRes, recupRes] = await Promise.all([
        fetch('/api/cet/requests').then(r => r.json()),
        fetch('/api/recuperation/all').then(r => r.json())
      ]);
      setCetRequests(cetRes.demandes || []);
      setRecupRequests(recupRes.demandes || []);
    } catch (e) { /* ignore */ }

    if (activeTab === 'stats') {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (activeTab === 'all') {
        const response = await fetch('/api/leaves');
        const data = await response.json();
        setAllLeaves(data.leaves || []);
      } else if (activeTab === 'users') {
        const response = await fetch('/api/users/all');
        const data = await response.json();
        console.log('Users data:', data);
        setUsers(data.users || []);
      } else if (activeTab === 'create-leave') {
        const response = await fetch('/api/users/all');
        const data = await response.json();
        setAllUsers(data.users || []);
      } else if (activeTab === 'cet-requests') {
        const response = await fetch('/api/cet/requests');
        const data = await response.json();
        setCetRequests(data.demandes || []);
      } else if (activeTab === 'recup-requests') {
        const [allRes, balRes, usersRes] = await Promise.all([
          fetch('/api/recuperation/all').then(r => r.json()),
          fetch('/api/recuperation/all-balances').then(r => r.json()),
          fetch('/api/users/all').then(r => r.json())
        ]);
        setRecupRequests(allRes.demandes || []);
        setRecupUtilRequests(allRes.demandes_utilisation || []);
        setRecupBalances(balRes.balances || []);
        setAllUsers(usersRes.users || []);
      } else if (activeTab === 'cet-balances') {
        const response = await fetch('/api/cet/all-balances');
        const data = await response.json();
        setCetBalances(data.balances || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
      if (activeTab === 'all') setAllLeaves([]);
      if (activeTab === 'users') setUsers([]);
      if (activeTab === 'create-leave') setAllUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (userId) => {
    if (!window.confirm('Réinitialiser le mot de passe de cet utilisateur ?')) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${userId}/reset-password`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      toast.success('Mot de passe réinitialisé. Nouveau mot de passe: ' + data.tempPassword);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();

    if (!newUser.nom || !newUser.prenom) {
      toast.error('Tous les champs sont requis');
      return;
    }

    if (newUser.type_contrat === 'CDD' && (!newUser.date_debut_contrat || !newUser.date_fin_contrat)) {
      toast.error('Les dates de début et fin sont requises pour un CDD');
      return;
    }

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      toast.success(`Utilisateur créé avec succès ! Mot de passe temporaire: ${data.tempPassword}`, { duration: 8000 });
      setShowCreateUserModal(false);
      setNewUser({ nom: '', prenom: '', email: '', type_utilisateur: 'Employé', service: '', poste: '', type_contrat: 'CDI', date_debut_contrat: '', date_fin_contrat: '', date_entree_mairie: '', quotite_travail: 100, responsable_id: '' });
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();

    if (!editingUser.nom || !editingUser.prenom || !editingUser.email) {
      toast.error('Tous les champs sont requis');
      return;
    }

    if (editingUser.type_contrat === 'CDD' && (!editingUser.date_debut_contrat || !editingUser.date_fin_contrat)) {
      toast.error('Les dates de début et fin sont requises pour un CDD');
      return;
    }

    try {
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingUser),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      toast.success('Utilisateur modifié avec succès');
      setShowEditUserModal(false);
      setEditingUser(null);
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur ${userName} ? Cette action est irréversible et supprimera également toutes ses demandes de congés.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      toast.success('Utilisateur supprimé avec succès');
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleAdjustBalance = async (e) => {
    e.preventDefault();

    const adj = parseFloat(adjustForm.adjustment);
    if (!adjustForm.adjustment || isNaN(adj) || adj === 0) {
      toast.error('Veuillez entrer un nombre de jours valide (différent de 0)');
      return;
    }

    setAdjustLoading(true);
    try {
      const response = await fetch(`/api/users/${adjustingUser.id}/adjust-balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustment: adj, motif: adjustForm.motif, type: adjustForm.type }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      toast.success(data.message);
      setShowAdjustModal(false);
      setAdjustingUser(null);
      setAdjustForm({ adjustment: '', motif: '', type: 'compensateurs' });
      fetchData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setAdjustLoading(false);
    }
  };

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

  const handleCetAction = async (requestId, action) => {
    const label = action === 'valider' ? 'valider' : 'refuser';
    const commentaire = action === 'refuser' ? window.prompt('Motif du refus (optionnel) :') : null;
    if (action === 'refuser' && commentaire === null) return; // Annulé

    setCetActionLoading(requestId);
    try {
      const response = await fetch(`/api/cet/requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, commentaire }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      toast.success(data.message);
      fetchData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCetActionLoading(null);
    }
  };

  const handleRecupAction = async (requestId, action) => {
    const commentaire = action === 'refuser' ? window.prompt('Motif du refus (optionnel) :') : null;
    if (action === 'refuser' && commentaire === null) return;

    setRecupActionLoading(requestId);
    try {
      const response = await fetch(`/api/recuperation/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, commentaire }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      toast.success(data.message);
      fetchData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRecupActionLoading(null);
    }
  };

  const handleRecupUtilAction = async (requestId, action) => {
    const commentaire = action === 'refuser' ? window.prompt('Motif du refus (optionnel) :') : null;
    if (action === 'refuser' && commentaire === null) return;

    setRecupActionLoading(`util-${requestId}`);
    try {
      const response = await fetch(`/api/recuperation/utilisation/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, commentaire }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      toast.success(data.message);
      fetchData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRecupActionLoading(null);
    }
  };

  const handleRecalculateBalances = async () => {
    if (!window.confirm('Recalculer les soldes de tous les utilisateurs à partir des congés validés ?')) {
      return;
    }
    setRecalcLoading(true);
    try {
      const response = await fetch('/api/balance/recalculate', {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      toast.success(data.message);
      fetchData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRecalcLoading(false);
    }
  };

  const handleCetAdjust = async (e) => {
    e.preventDefault();
    const jours = parseFloat(cetAdjustForm.jours);
    if (!cetAdjustForm.jours || isNaN(jours) || jours === 0) {
      toast.error('Veuillez entrer un nombre de jours valide');
      return;
    }
    setCetAdjustLoading(true);
    try {
      const response = await fetch('/api/cet/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: cetAdjustingUser.id,
          jours,
          motif: cetAdjustForm.motif
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      toast.success(data.message);
      setShowCetAdjustModal(false);
      setCetAdjustingUser(null);
      setCetAdjustForm({ jours: '', motif: '' });
      fetchData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCetAdjustLoading(false);
    }
  };

  const handleConfirmForceValidate = async () => {
    if (!forceValidateModal) return;
    const { leave, action } = forceValidateModal;
    const statut = action === 'valider' ? 'validee' : 'refusee';
    setForceValidateLoading(true);
    try {
      const response = await fetch(`/api/leaves/${leave.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statut,
          commentaire_rh: forceValidateComment,
          force_rh: true
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      toast.success(data.message);
      setForceValidateModal(null);
      setForceValidateComment('');
      fetchData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setForceValidateLoading(false);
    }
  };

  const handleCancelLeave = async (leaveId, employeeName) => {
    const motif = window.prompt(`Motif de l'annulation du congé de ${employeeName} :`);
    if (motif === null) return; // Annulé par l'utilisateur

    setCancelLoading(leaveId);
    try {
      const response = await fetch(`/api/leaves/${leaveId}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motif }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      toast.success(data.message);
      fetchData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCancelLoading(null);
    }
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          Interface RH
        </h1>

        <div className="bg-white rounded-lg shadow mb-6">
          <div className="flex border-b overflow-x-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'all'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Toutes les demandes
            </button>

            <button
              onClick={() => setActiveTab('stats')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'stats'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              📊 Statistiques avancées
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'users'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Gestion des utilisateurs
            </button>

            <button
              onClick={() => setActiveTab('cet-requests')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'cet-requests'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Demandes CET
              {cetRequests.filter(r => r.statut === 'en_attente').length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                  {cetRequests.filter(r => r.statut === 'en_attente').length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('cet-balances')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'cet-balances'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Soldes CET
            </button>

            <button
              onClick={() => setActiveTab('recup-requests')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'recup-requests'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Récupération
              {(recupRequests.filter(r => r.statut === 'en_attente').length + recupUtilRequests.filter(r => r.statut === 'en_attente').length) > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-orange-500 text-white rounded-full">
                  {recupRequests.filter(r => r.statut === 'en_attente').length + recupUtilRequests.filter(r => r.statut === 'en_attente').length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('create-leave')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'create-leave'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Créer un congé
            </button>
          </div>
        </div>

        {activeTab === 'stats' && (
          <div>
            <AdvancedStatsRH />
          </div>
        )}

        {activeTab === 'all' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Toutes les demandes - Suivi de validation
            </h2>

            {/* Légende */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs font-semibold text-gray-700 mb-2">Légende du circuit de validation :</p>
              <div className="flex flex-wrap gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                  <span className="text-gray-600">En attente</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                  <span className="text-gray-600">Bloqué ici</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">Validé</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-gray-600">Refusé</span>
                </div>
              </div>
            </div>

            {/* Barre de recherche */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Rechercher par nom, prénom, type..."
                value={searchAll}
                onChange={(e) => setSearchAll(e.target.value)}
                className="w-full md:w-80 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {allLeaves.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Aucune demande
              </p>
            ) : (() => {
              const q = searchAll.toLowerCase().trim();
              const filtered = q ? allLeaves.filter(l =>
                `${l.prenom} ${l.nom} ${l.type_utilisateur} ${l.type_conge || ''}`.toLowerCase().includes(q)
              ) : allLeaves;
              return filtered.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Aucun résultat pour &quot;{searchAll}&quot;
                </p>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employé</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Période</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jours</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Circuit de validation</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut final</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date demande</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filtered.map((leave) => {
                      // Déterminer où en est la validation
                      const hasN1 = leave.responsable_nom != null;
                      const hasN2 = leave.responsable_n2_nom != null;

                      const n1Validated = leave.statut_niveau_1 === 'validee';
                      const n2Validated = leave.statut_niveau_2 === 'validee';
                      const isFinalValidated = leave.statut === 'validee';
                      const isRefused = leave.statut === 'refusee';

                      // Où est-ce que ça bloque ?
                      let blockingAt = null;
                      if (!isRefused && !isFinalValidated) {
                        if (hasN1 && !n1Validated) {
                          blockingAt = 'n1';
                        } else if (hasN2 && !n2Validated) {
                          blockingAt = 'n2';
                        } else {
                          blockingAt = 'rh';
                        }
                      }

                      return (
                        <tr key={leave.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium">{leave.prenom} {leave.nom}</p>
                            <p className="text-xs text-gray-500">{leave.type_utilisateur}</p>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {formatDateFR(leave.date_debut)} - {formatDateFR(leave.date_fin)}
                          </td>
                          <td className="px-4 py-3">{leave.nombre_jours_ouvres}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {/* Niveau 1 - Responsable direct */}
                              {hasN1 && (
                                <div className="flex flex-col items-center">
                                  <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                                      isRefused && !n1Validated ? 'bg-red-500' :
                                      n1Validated ? 'bg-green-500' :
                                      blockingAt === 'n1' ? 'bg-yellow-400 animate-pulse' : 'bg-gray-300'
                                    }`}
                                    title={`N1: ${leave.responsable_prenom} ${leave.responsable_nom}`}
                                  >
                                    N1
                                  </div>
                                  <span className="text-xs text-gray-500 mt-1 max-w-[60px] truncate" title={`${leave.responsable_prenom} ${leave.responsable_nom}`}>
                                    {leave.responsable_prenom?.charAt(0)}. {leave.responsable_nom}
                                  </span>
                                  {n1Validated && leave.validateur_n1_nom && (
                                    <span className="text-xs text-green-600">✓</span>
                                  )}
                                </div>
                              )}

                              {hasN1 && (
                                <div className={`w-6 h-0.5 ${n1Validated ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                              )}

                              {/* Niveau 2 - Responsable hiérarchique */}
                              {hasN2 && (
                                <>
                                  <div className="flex flex-col items-center">
                                    <div
                                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                                        isRefused && n1Validated && !n2Validated ? 'bg-red-500' :
                                        n2Validated ? 'bg-green-500' :
                                        blockingAt === 'n2' ? 'bg-yellow-400 animate-pulse' : 'bg-gray-300'
                                      }`}
                                      title={`N2: ${leave.responsable_n2_prenom} ${leave.responsable_n2_nom}`}
                                    >
                                      N2
                                    </div>
                                    <span className="text-xs text-gray-500 mt-1 max-w-[60px] truncate" title={`${leave.responsable_n2_prenom} ${leave.responsable_n2_nom}`}>
                                      {leave.responsable_n2_prenom?.charAt(0)}. {leave.responsable_n2_nom}
                                    </span>
                                    {n2Validated && leave.validateur_n2_nom && (
                                      <span className="text-xs text-green-600">✓</span>
                                    )}
                                  </div>
                                  <div className={`w-6 h-0.5 ${n2Validated ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                </>
                              )}

                              {/* RH - Validation finale */}
                              <div className="flex flex-col items-center">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                                    isRefused && ((!hasN1) || (hasN1 && n1Validated && (!hasN2 || n2Validated))) ? 'bg-red-500' :
                                    isFinalValidated ? 'bg-green-500' :
                                    blockingAt === 'rh' ? 'bg-yellow-400 animate-pulse' : 'bg-gray-300'
                                  }`}
                                  title="Validation RH"
                                >
                                  RH
                                </div>
                                <span className="text-xs text-gray-500 mt-1">Final</span>
                                {isFinalValidated && leave.validateur_nom && (
                                  <span className="text-xs text-green-600">✓</span>
                                )}
                              </div>
                            </div>

                            {/* Info sur le blocage */}
                            {blockingAt && (
                              <p className="text-xs text-yellow-600 mt-2 font-medium">
                                ⏳ En attente : {
                                  blockingAt === 'n1' ? `${leave.responsable_prenom} ${leave.responsable_nom}` :
                                  blockingAt === 'n2' ? `${leave.responsable_n2_prenom} ${leave.responsable_n2_nom}` :
                                  'Validation RH'
                                }
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs font-semibold rounded ${getStatusColor(leave.statut)}`}>
                              {formatStatus(leave.statut)}
                            </span>
                            {leave.validateur_nom && leave.statut !== 'en_attente' && (
                              <p className="text-xs text-gray-500 mt-1">
                                par {leave.validateur_prenom} {leave.validateur_nom}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDateFR(leave.date_demande)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              {leave.statut === 'en_attente' && (
                                <>
                                  <button
                                    onClick={() => { setForceValidateComment(''); setForceValidateModal({ leave, action: 'valider' }); }}
                                    className="text-green-700 hover:text-green-900 text-sm font-medium text-left"
                                    title="Valider directement (dernier recours si responsable absent)"
                                  >
                                    Valider directement
                                  </button>
                                  <button
                                    onClick={() => { setForceValidateComment(''); setForceValidateModal({ leave, action: 'refuser' }); }}
                                    className="text-orange-700 hover:text-orange-900 text-sm font-medium text-left"
                                    title="Refuser directement (dernier recours si responsable absent)"
                                  >
                                    Refuser directement
                                  </button>
                                </>
                              )}
                              {leave.statut !== 'annulee' && (
                                <button
                                  onClick={() => handleCancelLeave(leave.id, `${leave.prenom} ${leave.nom}`)}
                                  disabled={cancelLoading === leave.id}
                                  className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50 text-left"
                                >
                                  {cancelLoading === leave.id ? '...' : 'Annuler'}
                                </button>
                              )}
                              {leave.statut === 'annulee' && (
                                <span className="text-xs text-gray-400">Annulée</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              );
            })()}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                Gestion des utilisateurs
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={handleRecalculateBalances}
                  disabled={recalcLoading}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition disabled:opacity-50"
                  title="Recalculer les soldes de tous les utilisateurs"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {recalcLoading ? 'Recalcul...' : 'Recalculer soldes'}
                </button>
                <button
                  onClick={() => setShowCreateUserModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Créer un utilisateur
                </button>
              </div>
            </div>

            {users && users.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Aucun utilisateur trouvé
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Poste</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contrat</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ancienneté</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jours restants</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users && users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">
                          {user.prenom} {user.nom}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="font-medium text-gray-900">{user.poste || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="text-gray-600">{user.service || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">{user.email}</td>
                        <td className="px-4 py-3 text-sm">{user.type_utilisateur}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${
                            user.type_contrat === 'CDD' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {user.type_contrat || 'CDI'}
                          </span>
                          {user.type_contrat === 'CDD' && user.date_fin_contrat && (
                            <div className="text-xs text-gray-500 mt-1">
                              Fin: {new Date(user.date_fin_contrat).toLocaleDateString('fr-FR')}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {user.date_entree_mairie ? (
                            <>
                              <span className="font-medium text-gray-900">{calculateAnciennete(user.date_entree_mairie)}</span>
                              <div className="text-xs text-gray-500 mt-1">
                                Depuis le {new Date(user.date_entree_mairie).toLocaleDateString('fr-FR')}
                              </div>
                            </>
                          ) : (
                            <span className="text-gray-400">Non renseigné</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold">{user.jours_restants || 0}</span> / {user.jours_acquis || 0}
                          {user.type_contrat === 'CDD' && (
                            <div className="text-xs text-gray-500 mt-1">
                              (2,08 j/mois)
                            </div>
                          )}
                          <div className="text-xs text-indigo-600 mt-1 font-medium">
                            {user.jours_compensateurs || 0} comp.
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingUser(user);
                                setShowEditUserModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                              title="Modifier"
                            >
                              Modifier
                            </button>
                            <button
                              onClick={() => {
                                setAdjustingUser(user);
                                setAdjustForm({ adjustment: '', motif: '', type: 'compensateurs' });
                                setShowAdjustModal(true);
                              }}
                              className="text-green-600 hover:text-green-700 text-sm font-medium"
                              title="Ajuster les jours de congé"
                            >
                              Jours
                            </button>
                            <button
                              onClick={() => handleResetPassword(user.id)}
                              className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                              title="Réinitialiser le mot de passe"
                            >
                              MDP
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id, `${user.prenom} ${user.nom}`)}
                              className="text-red-600 hover:text-red-700 text-sm font-medium"
                              title="Supprimer"
                            >
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'cet-requests' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Demandes CET
            </h2>

            {cetRequests.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Aucune demande CET
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jours</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Solde CET</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motif</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {cetRequests.map((req) => (
                      <tr key={req.id} className={`hover:bg-gray-50 ${req.statut === 'en_attente' ? 'bg-yellow-50' : ''}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium">{req.prenom} {req.nom}</p>
                          <p className="text-xs text-gray-500">{req.service || ''} {req.poste ? `- ${req.poste}` : ''}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${
                            req.type === 'credit'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            {req.type === 'credit' ? 'Versement' : 'Retrait'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold">{req.jours}</td>
                        <td className="px-4 py-3 text-sm">{req.solde_cet || 0}/60</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{req.motif || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{req.date_demande}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${
                            req.statut === 'en_attente' ? 'bg-yellow-100 text-yellow-800' :
                            req.statut === 'validee' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {req.statut === 'en_attente' ? 'En attente' : req.statut === 'validee' ? 'Validée' : 'Refusée'}
                          </span>
                          {req.commentaire_rh && (
                            <p className="text-xs text-gray-500 mt-1">{req.commentaire_rh}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {req.statut === 'en_attente' ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleCetAction(req.id, 'valider')}
                                disabled={cetActionLoading === req.id}
                                className="text-green-600 hover:text-green-700 text-sm font-medium disabled:opacity-50"
                              >
                                {cetActionLoading === req.id ? '...' : 'Valider'}
                              </button>
                              <button
                                onClick={() => handleCetAction(req.id, 'refuser')}
                                disabled={cetActionLoading === req.id}
                                className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
                              >
                                Refuser
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Traitée {req.date_validation}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'cet-balances' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Soldes CET de tous les agents
            </h2>

            {cetBalances.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Aucun agent trouvé
              </p>
            ) : (
              <>
                {/* Résumé */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                    <p className="text-sm text-indigo-600 font-medium">Agents avec CET</p>
                    <p className="text-2xl font-bold text-indigo-800">
                      {cetBalances.filter(b => b.solde_cet > 0).length}
                    </p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-600 font-medium">Total jours en CET</p>
                    <p className="text-2xl font-bold text-green-800">
                      {cetBalances.reduce((sum, b) => sum + (b.solde_cet || 0), 0)}
                    </p>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <p className="text-sm text-orange-600 font-medium">Demandes en attente</p>
                    <p className="text-2xl font-bold text-orange-800">
                      {cetBalances.reduce((sum, b) => sum + (b.demandes_en_attente || 0), 0)}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Poste</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Solde CET</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Crédités {new Date().getFullYear()}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Débités {new Date().getFullYear()}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">En attente</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {cetBalances.map((agent) => (
                        <tr key={agent.id} className={`hover:bg-gray-50 ${agent.solde_cet > 0 ? '' : 'opacity-60'}`}>
                          <td className="px-4 py-3">
                            <p className="font-medium">{agent.prenom} {agent.nom}</p>
                            <p className="text-xs text-gray-500">{agent.type_utilisateur}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{agent.service || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{agent.poste || '-'}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-lg">{agent.solde_cet || 0}</span>
                              <span className="text-xs text-gray-500">/ 60</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                              <div
                                className={`h-2 rounded-full ${
                                  agent.solde_cet >= 50 ? 'bg-red-500' :
                                  agent.solde_cet >= 30 ? 'bg-orange-500' :
                                  'bg-indigo-500'
                                }`}
                                style={{ width: `${Math.min(100, ((agent.solde_cet || 0) / 60) * 100)}%` }}
                              ></div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {agent.jours_credites_annee ? (
                              <span className="text-green-600 font-semibold">+{agent.jours_credites_annee}</span>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {agent.jours_debites_annee ? (
                              <span className="text-orange-600 font-semibold">-{agent.jours_debites_annee}</span>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {agent.demandes_en_attente > 0 ? (
                              <span className="px-2 py-1 text-xs font-semibold rounded bg-yellow-100 text-yellow-800">
                                {agent.demandes_en_attente}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => {
                                setCetAdjustingUser(agent);
                                setCetAdjustForm({ jours: '', motif: '' });
                                setShowCetAdjustModal(true);
                              }}
                              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                            >
                              Ajuster
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'recup-requests' && (
          <RecuperationRHView
            recupRequests={recupRequests}
            recupUtilRequests={recupUtilRequests}
            recupBalances={recupBalances}
            recupSubTab={recupSubTab}
            setRecupSubTab={setRecupSubTab}
            recupSearch={recupSearch}
            setRecupSearch={setRecupSearch}
            recupStatusFilter={recupStatusFilter}
            setRecupStatusFilter={setRecupStatusFilter}
            recupActionLoading={recupActionLoading}
            handleRecupAction={handleRecupAction}
            handleRecupUtilAction={handleRecupUtilAction}
            setSelectedRecupDoc={setSelectedRecupDoc}
            rhRecupForm={rhRecupForm}
            setRhRecupForm={setRhRecupForm}
            rhRecupLoading={rhRecupLoading}
            setRhRecupLoading={setRhRecupLoading}
            setRecupBalances={setRecupBalances}
            fetchData={fetchData}
          />
        )}

        {/* Modal document récupération */}
        {selectedRecupDoc && (
          <RecupDocumentModal demande={selectedRecupDoc} onClose={() => setSelectedRecupDoc(null)} />
        )}

        {activeTab === 'create-leave' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Créer un congé (validation directe)
            </h2>

            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                Ce formulaire permet de créer un congé directement validé, sans passer par le circuit de validation
                et sans la contrainte des 7 jours à l'avance.
              </p>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!rhLeaveForm.user_id || !rhLeaveForm.date_debut || !rhLeaveForm.date_fin) {
                toast.error('Veuillez remplir tous les champs obligatoires');
                return;
              }
              if (new Date(rhLeaveForm.date_debut) > new Date(rhLeaveForm.date_fin)) {
                toast.error('La date de début doit être avant la date de fin');
                return;
              }
              setRhLeaveLoading(true);
              try {
                const response = await fetch('/api/leaves/rh-create', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(rhLeaveForm),
                });
                const data = await response.json();
                if (!response.ok) {
                  throw new Error(data.message);
                }
                toast.success(`Congé créé et validé avec succès (${data.businessDays} jour(s) ouvrés)`);
                setRhLeaveForm({ user_id: '', date_debut: '', date_fin: '', motif: '' });
              } catch (error) {
                toast.error(error.message);
              } finally {
                setRhLeaveLoading(false);
              }
            }} className="space-y-4 max-w-xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employé *
                </label>
                <select
                  value={rhLeaveForm.user_id}
                  onChange={(e) => setRhLeaveForm({ ...rhLeaveForm, user_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Sélectionner un employé</option>
                  {allUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.prenom} {user.nom} ({user.type_utilisateur}) - {user.jours_restants || 0} jours restants
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de début *
                  </label>
                  <input
                    type="date"
                    value={rhLeaveForm.date_debut}
                    onChange={(e) => setRhLeaveForm({ ...rhLeaveForm, date_debut: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de fin *
                  </label>
                  <input
                    type="date"
                    value={rhLeaveForm.date_fin}
                    onChange={(e) => setRhLeaveForm({ ...rhLeaveForm, date_fin: e.target.value })}
                    min={rhLeaveForm.date_debut}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motif (optionnel)
                </label>
                <textarea
                  value={rhLeaveForm.motif}
                  onChange={(e) => setRhLeaveForm({ ...rhLeaveForm, motif: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Motif du congé..."
                />
              </div>

              <button
                type="submit"
                disabled={rhLeaveLoading}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold"
              >
                {rhLeaveLoading ? 'Création en cours...' : 'Créer et valider le congé'}
              </button>
            </form>
          </div>
        )}

      </div>

      {/* Modal de création d'utilisateur */}
      {showCreateUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              Créer un nouvel utilisateur
            </h3>

            <form onSubmit={handleCreateUser}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom *
                </label>
                <input
                  type="text"
                  value={newUser.nom}
                  onChange={(e) => setNewUser({ ...newUser, nom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prénom *
                </label>
                <input
                  type="text"
                  value={newUser.prenom}
                  onChange={(e) => setNewUser({ ...newUser, prenom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optionnel"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service *
                </label>
                <select
                  value={newUser.service}
                  onChange={(e) => {
                    setNewUser({ ...newUser, service: e.target.value, poste: '', type_utilisateur: 'Employé', responsable_id: '' });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Choisir un service --</option>
                  <optgroup label="Direction">
                    <option value="ADMIN. GÉNÉRALE">Administration Générale</option>
                    <option value="Etat Civil">Etat Civil</option>
                  </optgroup>
                  <optgroup label="Services Techniques">
                    <option value="SERVICES TECH.">Services Techniques</option>
                  </optgroup>
                  <optgroup label="Ressources">
                    <option value="SÉCURITÉ">Sécurité / Police</option>
                  </optgroup>
                  <optgroup label="Vie Locale">
                    <option value="Vie Locale">Directeur Vie Locale</option>
                    <option value="C.L.S.H.">C.L.S.H. / Animation</option>
                    <option value="ÉCOLE ÉLÉM.">École Élémentaire</option>
                    <option value="ÉCOLE MAT.">École Maternelle</option>
                    <option value="RESTAURATION">Cantine / Restauration</option>
                    <option value="EMC">Vie Associative et Culturelle</option>
                    <option value="communication">Communication</option>
                    <option value="Enfance">Enfance</option>
                  </optgroup>
                </select>
              </div>

              {newUser.service && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Poste / Rôle *
                </label>
                <select
                  value={newUser.poste}
                  onChange={(e) => {
                    const poste = e.target.value;
                    const dgs = allUsers.find(u => u.poste === 'DGS');
                    const carmen = allUsers.find(u => u.type_utilisateur === 'Directeur Vie Locale');
                    const respTech = allUsers.find(u => u.poste?.includes('Resp') && u.service === 'SERVICES TECH.');
                    const respAnim = allUsers.find(u => u.poste?.includes('Resp. Centre') || u.poste?.includes('Resp Centre'));

                    const POSTE_CONFIG = {
                      'DGS': { type: 'DG', resp: '' },
                      'Dir. Vie Locale': { type: 'Directeur Vie Locale', resp: dgs?.id },
                      'Resp. Services Tech': { type: 'Responsable Serv. Tech.', resp: dgs?.id },
                      'Resp. Centre Loisirs': { type: 'Directeur Centre', resp: carmen?.id },
                      'Resp. adj. ACM': { type: 'Responsable', resp: respAnim?.id },
                      'Resp. RH': { type: 'RH', resp: dgs?.id },
                      'Resp. Finances': { type: 'Responsable', resp: dgs?.id },
                      'Resp. Urbanisme': { type: 'Responsable', resp: dgs?.id },
                      'Resp. Social': { type: 'Responsable', resp: dgs?.id },
                      'Responsable RMS': { type: 'Responsable', resp: carmen?.id },
                      'Service Technique': { type: 'Service Technique', resp: respTech?.id },
                      'Agent technique': { type: 'Service Technique', resp: respTech?.id },
                      'Animateur': { type: 'Animateur', resp: respAnim?.id },
                      'Animatrice': { type: 'Animateur', resp: respAnim?.id },
                      'Adj. Anim. (ATSEM)': { type: 'ATSEM/Animation', resp: respAnim?.id },
                      'Adj. d\'animation': { type: 'Animateur', resp: respAnim?.id },
                      'Adj. Tech. Territ.': { type: 'Employé', resp: respAnim?.id },
                      'Agent d\'entretien': { type: 'Entretien', resp: respAnim?.id },
                      'Animateur Culturel': { type: 'Animateur Culturel', resp: carmen?.id },
                      'Cantinière': { type: 'Cantinière', resp: carmen?.id },
                      'Agent en communication': { type: 'Employé', resp: carmen?.id },
                      'Policier Municipal': { type: 'Police Municipale', resp: dgs?.id },
                      'Etat Civil': { type: 'Employé', resp: dgs?.id },
                      'Facturation': { type: 'Administratif', resp: dgs?.id },
                      'Administratif': { type: 'Administratif', resp: dgs?.id },
                      'Alternant': { type: 'Alternant', resp: dgs?.id },
                      'Directeur ACM': { type: 'Responsable', resp: carmen?.id },
                    };
                    const cfg = POSTE_CONFIG[poste] || {};
                    setNewUser({
                      ...newUser,
                      poste,
                      type_utilisateur: cfg.type || newUser.type_utilisateur,
                      responsable_id: cfg.resp || '',
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Choisir un poste --</option>
                  {newUser.service === 'SERVICES TECH.' && (
                    <optgroup label="Services Techniques">
                      <option value="Resp. Services Tech">Responsable Services Techniques</option>
                      <option value="Service Technique">Agent technique</option>
                    </optgroup>
                  )}
                  {newUser.service === 'C.L.S.H.' && (
                    <optgroup label="Animation / C.L.S.H.">
                      <option value="Resp. Centre Loisirs">Responsable Centre de Loisirs</option>
                      <option value="Resp. adj. ACM">Responsable adjoint ACM</option>
                      <option value="Directeur ACM">Directeur ACM</option>
                      <option value="Animateur">Animateur</option>
                      <option value="Animatrice">Animatrice</option>
                      <option value="Adj. Anim. (ATSEM)">ATSEM / Adj. Animation</option>
                      <option value="Adj. d'animation">Adjoint d'animation</option>
                      <option value="Adj. Tech. Territ.">Adjoint Technique Territorial</option>
                      <option value="Agent d'entretien">Agent d'entretien</option>
                    </optgroup>
                  )}
                  {(newUser.service === 'ÉCOLE ÉLÉM.' || newUser.service === 'ÉCOLE MAT.') && (
                    <optgroup label="Écoles">
                      <option value="Adj. Anim. (ATSEM)">ATSEM / Adj. Animation</option>
                      <option value="Adj. Tech. Territ.">Adjoint Technique Territorial</option>
                      <option value="Agent d'entretien">Agent d'entretien</option>
                    </optgroup>
                  )}
                  {newUser.service === 'ADMIN. GÉNÉRALE' && (
                    <optgroup label="Administration Générale">
                      <option value="DGS">Directeur Général des Services</option>
                      <option value="Resp. RH">Responsable RH</option>
                      <option value="Resp. Finances">Responsable Finances</option>
                      <option value="Resp. Urbanisme">Responsable Urbanisme</option>
                      <option value="Resp. Social">Responsable Social / CCAS</option>
                      <option value="Facturation">Facturation</option>
                      <option value="Administratif">Administratif</option>
                      <option value="Alternant">Alternant</option>
                    </optgroup>
                  )}
                  {newUser.service === 'SÉCURITÉ' && (
                    <optgroup label="Sécurité">
                      <option value="Policier Municipal">Policier Municipal</option>
                    </optgroup>
                  )}
                  {newUser.service === 'RESTAURATION' && (
                    <optgroup label="Cantine / Restauration">
                      <option value="Responsable RMS">Responsable Restauration</option>
                      <option value="Cantinière">Cantinière / Agent de restauration</option>
                    </optgroup>
                  )}
                  {newUser.service === 'EMC' && (
                    <optgroup label="Vie Associative">
                      <option value="Animateur Culturel">Animateur Culturel</option>
                    </optgroup>
                  )}
                  {newUser.service === 'Etat Civil' && (
                    <optgroup label="Etat Civil">
                      <option value="Etat Civil">Agent Etat Civil</option>
                    </optgroup>
                  )}
                  {newUser.service === 'communication' && (
                    <optgroup label="Communication">
                      <option value="Agent en communication">Agent en communication</option>
                    </optgroup>
                  )}
                  {newUser.service === 'Enfance' && (
                    <optgroup label="Enfance">
                      <option value="Directeur ACM">Directeur ACM</option>
                    </optgroup>
                  )}
                  {newUser.service === 'Vie Locale' && (
                    <optgroup label="Vie Locale">
                      <option value="Dir. Vie Locale">Directeur Vie Locale</option>
                    </optgroup>
                  )}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Le poste détermine automatiquement le responsable hiérarchique
                </p>
              </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type d'utilisateur *
                </label>
                <select
                  value={newUser.type_utilisateur}
                  onChange={(e) => setNewUser({ ...newUser, type_utilisateur: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Employé">Employé</option>
                  <option value="DG">Direction Générale</option>
                  <option value="RH">RH</option>
                  <option value="Responsable">Responsable</option>
                  <option value="Directeur Vie Locale">Directeur Vie Locale</option>

                  <option value="Responsable Serv. Tech.">Responsable Service Technique</option>
                  <option value="Directeur Centre">Directeur Centre</option>
                  <option value="Responsable Anim.">Responsable Animation</option>
                  <option value="Administratif">Administratif</option>
                  <option value="Service Technique">Service Technique</option>
                  <option value="Animateur">Animateur</option>
                  <option value="Animateur Culturel">Animateur Culturel</option>
                  <option value="ATSEM/Animation">ATSEM/Animation</option>
                  <option value="Police Municipale">Police Municipale</option>
                  <option value="Entretien">Entretien</option>
                  <option value="Cantinière">Cantinière</option>
                  <option value="Alternant">Alternant</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Pré-rempli selon le poste, modifiable si besoin
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date d'entrée à la mairie
                </label>
                <input
                  type="date"
                  value={newUser.date_entree_mairie}
                  onChange={(e) => setNewUser({ ...newUser, date_entree_mairie: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Permet de calculer l'ancienneté de l'agent
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quotité de travail (%)
                </label>
                <select
                  value={newUser.quotite_travail}
                  onChange={(e) => setNewUser({ ...newUser, quotite_travail: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={100}>100% - Temps plein</option>
                  <option value={90}>90%</option>
                  <option value={80}>80% - 4/5e</option>
                  <option value={70}>70%</option>
                  <option value={60}>60% - 3/5e</option>
                  <option value={50}>50% - Mi-temps</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Les jours de congés seront proratisés selon la quotité ({Math.round(25 * newUser.quotite_travail / 100 * 100) / 100} jours/an)
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type de contrat *
                </label>
                <select
                  value={newUser.type_contrat}
                  onChange={(e) => setNewUser({ ...newUser, type_contrat: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CDI">CDI</option>
                  <option value="CDD">CDD</option>
                </select>
              </div>

              {newUser.type_contrat === 'CDD' && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date de début du contrat *
                    </label>
                    <input
                      type="date"
                      value={newUser.date_debut_contrat}
                      onChange={(e) => setNewUser({ ...newUser, date_debut_contrat: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date de fin du contrat *
                    </label>
                    <input
                      type="date"
                      value={newUser.date_fin_contrat}
                      onChange={(e) => setNewUser({ ...newUser, date_fin_contrat: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Responsable hiérarchique
                </label>
                <select
                  value={newUser.responsable_id}
                  onChange={(e) => setNewUser({ ...newUser, responsable_id: e.target.value ? Number(e.target.value) : '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Aucun (validation directe RH)</option>
                  {(() => {
                    const responsables = allUsers.filter(u => u.actif !== 0 && (
                      u.poste?.includes('Resp') || u.poste?.includes('DGS') || u.poste?.includes('Dir.')
                    ));
                    const autres = allUsers.filter(u => u.actif !== 0 && !responsables.find(r => r.id === u.id));
                    return (
                      <>
                        <optgroup label="Responsables / Direction">
                          {responsables.map(u => (
                            <option key={u.id} value={u.id}>{u.prenom} {u.nom} — {u.poste || u.type_utilisateur}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Autres agents">
                          {autres.map(u => (
                            <option key={u.id} value={u.id}>{u.prenom} {u.nom} — {u.poste || u.type_utilisateur}</option>
                          ))}
                        </optgroup>
                      </>
                    );
                  })()}
                </select>
                {newUser.responsable_id && (() => {
                  const resp = allUsers.find(u => u.id === Number(newUser.responsable_id));
                  const resp2 = resp ? allUsers.find(u => u.id === resp.responsable_id) : null;
                  return (
                    <p className="text-xs text-blue-600 mt-1 font-medium">
                      Circuit : Agent → {resp?.prenom} {resp?.nom}{resp2 ? ` → ${resp2.prenom} ${resp2.nom}` : ''} → RH
                    </p>
                  );
                })()}
                {!newUser.responsable_id && (
                  <p className="text-xs text-gray-500 mt-1">
                    Auto-rempli selon le service choisi
                  </p>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateUserModal(false);
                    setNewUser({ nom: '', prenom: '', email: '', type_utilisateur: 'Employé', service: '', poste: '', type_contrat: 'CDI', date_debut_contrat: '', date_fin_contrat: '', date_entree_mairie: '', quotite_travail: 100, responsable_id: '' });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de modification d'utilisateur */}
      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              Modifier l'utilisateur
            </h3>

            <form onSubmit={handleEditUser}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom *
                </label>
                <input
                  type="text"
                  value={editingUser.nom}
                  onChange={(e) => setEditingUser({ ...editingUser, nom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prénom *
                </label>
                <input
                  type="text"
                  value={editingUser.prenom}
                  onChange={(e) => setEditingUser({ ...editingUser, prenom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service *
                </label>
                <select
                  value={editingUser.service || ''}
                  onChange={(e) => {
                    const svc = e.target.value;
                    const SERVICE_CONFIG = {
                      'SERVICES TECH.': { resp: allUsers.find(u => u.poste?.includes('Resp') && u.service === 'SERVICES TECH.')?.id },
                      'C.L.S.H.': { resp: allUsers.find(u => u.poste?.includes('Resp. Centre') || u.poste?.includes('Resp Centre'))?.id },
                      'ÉCOLE ÉLÉM.': { resp: allUsers.find(u => u.poste?.includes('Resp. Centre') || u.poste?.includes('Resp Centre'))?.id },
                      'ÉCOLE MAT.': { resp: allUsers.find(u => u.poste?.includes('Resp. Centre') || u.poste?.includes('Resp Centre'))?.id },
                      'RESTAURATION': { resp: allUsers.find(u => u.type_utilisateur === 'Directeur Vie Locale')?.id },
                      'ADMIN. GÉNÉRALE': { resp: allUsers.find(u => u.poste === 'DGS')?.id },
                      'EMC': { resp: allUsers.find(u => u.type_utilisateur === 'Directeur Vie Locale')?.id },
                      'SÉCURITÉ': { resp: allUsers.find(u => u.poste === 'DGS')?.id },
                      'Etat Civil': { resp: allUsers.find(u => u.poste === 'DGS')?.id },
                      'communication': { resp: allUsers.find(u => u.type_utilisateur === 'Directeur Vie Locale')?.id },
                      'Enfance': { resp: allUsers.find(u => u.type_utilisateur === 'Directeur Vie Locale')?.id },
                    };
                    const cfg = SERVICE_CONFIG[svc] || {};
                    setEditingUser({
                      ...editingUser,
                      service: svc,
                      responsable_id: cfg.resp || editingUser.responsable_id,
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Choisir un service --</option>
                  <optgroup label="Direction">
                    <option value="ADMIN. GÉNÉRALE">Administration Générale</option>
                    <option value="Etat Civil">Etat Civil</option>
                  </optgroup>
                  <optgroup label="Services Techniques">
                    <option value="SERVICES TECH.">Services Techniques</option>
                  </optgroup>
                  <optgroup label="Ressources">
                    <option value="SÉCURITÉ">Sécurité / Police</option>
                  </optgroup>
                  <optgroup label="Vie Locale">
                    <option value="Vie Locale">Directeur Vie Locale</option>
                    <option value="C.L.S.H.">C.L.S.H. / Animation</option>
                    <option value="ÉCOLE ÉLÉM.">École Élémentaire</option>
                    <option value="ÉCOLE MAT.">École Maternelle</option>
                    <option value="RESTAURATION">Cantine / Restauration</option>
                    <option value="EMC">Vie Associative et Culturelle</option>
                    <option value="communication">Communication</option>
                    <option value="Enfance">Enfance</option>
                  </optgroup>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Poste
                </label>
                <input
                  type="text"
                  value={editingUser.poste || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, poste: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Resp. RH, Agent technique, DGS"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type d'utilisateur *
                </label>
                <select
                  value={editingUser.type_utilisateur}
                  onChange={(e) => setEditingUser({ ...editingUser, type_utilisateur: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Employé">Employé</option>
                  <option value="DG">Direction Générale</option>
                  <option value="RH">RH</option>
                  <option value="Responsable">Responsable</option>
                  <option value="Directeur Vie Locale">Directeur Vie Locale</option>

                  <option value="Responsable Serv. Tech.">Responsable Service Technique</option>
                  <option value="Directeur Centre">Directeur Centre</option>
                  <option value="Responsable Anim.">Responsable Animation</option>
                  <option value="Administratif">Administratif</option>
                  <option value="Service Technique">Service Technique</option>
                  <option value="Animateur">Animateur</option>
                  <option value="Animateur Culturel">Animateur Culturel</option>
                  <option value="ATSEM/Animation">ATSEM/Animation</option>
                  <option value="Police Municipale">Police Municipale</option>
                  <option value="Entretien">Entretien</option>
                  <option value="Cantinière">Cantinière</option>
                  <option value="Alternant">Alternant</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date d'entrée à la mairie
                </label>
                <input
                  type="date"
                  value={editingUser.date_entree_mairie || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, date_entree_mairie: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {editingUser.date_entree_mairie && (
                  <p className="text-xs text-blue-600 mt-1 font-medium">
                    Ancienneté : {calculateAnciennete(editingUser.date_entree_mairie)}
                  </p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quotité de travail (%)
                </label>
                <select
                  value={editingUser.quotite_travail || 100}
                  onChange={(e) => setEditingUser({ ...editingUser, quotite_travail: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={100}>100% - Temps plein</option>
                  <option value={90}>90%</option>
                  <option value={80}>80% - 4/5e</option>
                  <option value={70}>70%</option>
                  <option value={60}>60% - 3/5e</option>
                  <option value={50}>50% - Mi-temps</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Les jours de congés seront proratisés selon la quotité ({Math.round(25 * (editingUser.quotite_travail || 100) / 100 * 100) / 100} jours/an)
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type de contrat *
                </label>
                <select
                  value={editingUser.type_contrat || 'CDI'}
                  onChange={(e) => setEditingUser({ ...editingUser, type_contrat: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CDI">CDI</option>
                  <option value="CDD">CDD</option>
                </select>
              </div>

              {editingUser.type_contrat === 'CDD' && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date de début du contrat *
                    </label>
                    <input
                      type="date"
                      value={editingUser.date_debut_contrat || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, date_debut_contrat: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date de fin du contrat *
                    </label>
                    <input
                      type="date"
                      value={editingUser.date_fin_contrat || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, date_fin_contrat: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Responsable hiérarchique
                </label>
                <select
                  value={editingUser.responsable_id || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, responsable_id: e.target.value ? Number(e.target.value) : null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Aucun (validation directe RH)</option>
                  {(() => {
                    const responsables = allUsers.filter(u => u.actif !== 0 && u.id !== editingUser.id && (
                      u.poste?.includes('Resp') || u.poste?.includes('DGS') || u.poste?.includes('Dir.')
                    ));
                    const autres = allUsers.filter(u => u.actif !== 0 && u.id !== editingUser.id && !responsables.find(r => r.id === u.id));
                    return (
                      <>
                        <optgroup label="Responsables / Direction">
                          {responsables.map(u => (
                            <option key={u.id} value={u.id}>{u.prenom} {u.nom} — {u.poste || u.type_utilisateur}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Autres agents">
                          {autres.map(u => (
                            <option key={u.id} value={u.id}>{u.prenom} {u.nom} — {u.poste || u.type_utilisateur}</option>
                          ))}
                        </optgroup>
                      </>
                    );
                  })()}
                </select>
                {editingUser.responsable_id && (() => {
                  const resp = allUsers.find(u => u.id === Number(editingUser.responsable_id));
                  const resp2 = resp ? allUsers.find(u => u.id === resp.responsable_id) : null;
                  return (
                    <p className="text-xs text-blue-600 mt-1 font-medium">
                      Circuit : Agent → {resp?.prenom} {resp?.nom}{resp2 ? ` → ${resp2.prenom} ${resp2.nom}` : ''} → RH
                    </p>
                  );
                })()}
              </div>

              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editingUser.actif !== 0}
                    onChange={(e) => setEditingUser({ ...editingUser, actif: e.target.checked ? 1 : 0 })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Utilisateur actif</span>
                </label>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditUserModal(false);
                    setEditingUser(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Modifier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal d'ajustement des jours de congé */}
      {showAdjustModal && adjustingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Ajuster les jours
            </h3>
            <p className="text-sm text-gray-600 mb-1">
              {adjustingUser.prenom} {adjustingUser.nom}
            </p>
            <div className="text-sm text-gray-600 mb-4 space-y-0.5">
              <p>Solde restant : <span className="font-semibold">{adjustingUser.jours_restants || 0}</span> jours</p>
              <p>Jours acquis : <span className="font-semibold text-blue-600">{adjustingUser.jours_acquis || 0}</span></p>
              <p>Jours compensateurs : <span className="font-semibold text-indigo-600">{adjustingUser.jours_compensateurs || 0}</span></p>
            </div>

            <form onSubmit={handleAdjustBalance}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type de jours *
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustForm({ ...adjustForm, type: 'compensateurs' })}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition ${
                      adjustForm.type === 'compensateurs'
                        ? 'bg-indigo-100 border-indigo-400 text-indigo-700'
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Compensateurs
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustForm({ ...adjustForm, type: 'conges' })}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition ${
                      adjustForm.type === 'conges'
                        ? 'bg-blue-100 border-blue-400 text-blue-700'
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Congés (acquis)
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de jours *
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={adjustForm.adjustment}
                  onChange={(e) => setAdjustForm({ ...adjustForm, adjustment: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: 2 pour ajouter, -3 pour retirer"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Positif pour ajouter des jours, négatif pour en retirer
                </p>
              </div>

              {adjustForm.adjustment && !isNaN(parseFloat(adjustForm.adjustment)) && parseFloat(adjustForm.adjustment) !== 0 && (
                <div className={`mb-4 p-3 rounded-lg border ${parseFloat(adjustForm.adjustment) > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <p className="text-sm font-medium">
                    {parseFloat(adjustForm.adjustment) > 0 ? '+ ' : ''}{adjustForm.adjustment} jour(s) {adjustForm.type === 'compensateurs' ? 'compensateurs' : 'de congés'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {adjustForm.type === 'compensateurs' ? (
                      <>Compensateurs : {(adjustingUser.jours_compensateurs || 0)} → {((adjustingUser.jours_compensateurs || 0) + parseFloat(adjustForm.adjustment)).toFixed(2)}</>
                    ) : (
                      <>Acquis : {(adjustingUser.jours_acquis || 0)} → {((adjustingUser.jours_acquis || 0) + parseFloat(adjustForm.adjustment)).toFixed(2)}</>
                    )}
                    {' | '}Solde restant : {(adjustingUser.jours_restants || 0)} → {((adjustingUser.jours_restants || 0) + parseFloat(adjustForm.adjustment)).toFixed(2)}
                  </p>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motif
                </label>
                <textarea
                  value={adjustForm.motif}
                  onChange={(e) => setAdjustForm({ ...adjustForm, motif: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={adjustForm.type === 'compensateurs' ? 'Ex: Heures supplémentaires, récupération...' : 'Ex: Correction de solde, ajustement annuel...'}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdjustModal(false);
                    setAdjustingUser(null);
                    setAdjustForm({ adjustment: '', motif: '', type: 'compensateurs' });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={adjustLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
                >
                  {adjustLoading ? 'En cours...' : 'Valider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal d'ajustement CET */}
      {showCetAdjustModal && cetAdjustingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Ajuster le CET
            </h3>
            <p className="text-sm text-gray-600 mb-1">
              {cetAdjustingUser.prenom} {cetAdjustingUser.nom}
            </p>
            <div className="text-sm text-gray-600 mb-4">
              <p>Solde CET actuel : <span className="font-semibold text-indigo-600">{cetAdjustingUser.solde_cet || 0}</span> / 60 jours</p>
            </div>

            <form onSubmit={handleCetAdjust}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de jours *
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={cetAdjustForm.jours}
                  onChange={(e) => setCetAdjustForm({ ...cetAdjustForm, jours: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: 10 pour ajouter, -5 pour retirer"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Positif pour ajouter, négatif pour retirer (max 60 jours au total)
                </p>
              </div>

              {cetAdjustForm.jours && !isNaN(parseFloat(cetAdjustForm.jours)) && parseFloat(cetAdjustForm.jours) !== 0 && (
                <div className={`mb-4 p-3 rounded-lg border ${parseFloat(cetAdjustForm.jours) > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <p className="text-sm font-medium">
                    {parseFloat(cetAdjustForm.jours) > 0 ? '+ ' : ''}{cetAdjustForm.jours} jour(s)
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    CET : {cetAdjustingUser.solde_cet || 0} → {((cetAdjustingUser.solde_cet || 0) + parseFloat(cetAdjustForm.jours))} / 60 jours
                  </p>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motif
                </label>
                <textarea
                  value={cetAdjustForm.motif}
                  onChange={(e) => setCetAdjustForm({ ...cetAdjustForm, motif: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: CET accumulé dans un précédent poste, régularisation..."
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowCetAdjustModal(false);
                    setCetAdjustingUser(null);
                    setCetAdjustForm({ jours: '', motif: '' });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={cetAdjustLoading}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
                >
                  {cetAdjustLoading ? 'En cours...' : 'Valider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal validation directe (dernier recours) */}
      {forceValidateModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => !forceValidateLoading && setForceValidateModal(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-200 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-800 text-lg">
                {forceValidateModal.action === 'valider' ? 'Validation directe' : 'Refus direct'} - Attention
              </h3>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                <p className="text-sm text-yellow-800 font-semibold mb-1">
                  Cette option est un dernier recours.
                </p>
                <p className="text-sm text-yellow-700">
                  Elle ne doit être utilisée que si un responsable est absent ou malade
                  et ne peut pas valider la demande lui-même.
                </p>
              </div>

              <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
                <p><span className="font-semibold">Agent :</span> {forceValidateModal.leave.prenom} {forceValidateModal.leave.nom}</p>
                <p><span className="font-semibold">Période :</span> {formatDateFR(forceValidateModal.leave.date_debut)} → {formatDateFR(forceValidateModal.leave.date_fin)}</p>
                <p><span className="font-semibold">Jours :</span> {forceValidateModal.leave.nombre_jours_ouvres}</p>
                {forceValidateModal.leave.responsable_nom && (
                  <p><span className="font-semibold">Responsable N1 :</span> {forceValidateModal.leave.responsable_prenom} {forceValidateModal.leave.responsable_nom}</p>
                )}
                {forceValidateModal.leave.responsable_n2_nom && (
                  <p><span className="font-semibold">Responsable N2 :</span> {forceValidateModal.leave.responsable_n2_prenom} {forceValidateModal.leave.responsable_n2_nom}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motif {forceValidateModal.action === 'refuser' ? '(obligatoire)' : '(recommandé)'}
                </label>
                <textarea
                  value={forceValidateComment}
                  onChange={(e) => setForceValidateComment(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Ex : Responsable N1 absent pour maladie, validation effectuée par la RH..."
                />
              </div>
            </div>

            <div className="border-t border-gray-200 p-4 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setForceValidateModal(null); setForceValidateComment(''); }}
                disabled={forceValidateLoading}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmForceValidate}
                disabled={
                  forceValidateLoading ||
                  (forceValidateModal.action === 'refuser' && !forceValidateComment.trim())
                }
                className={`px-4 py-2 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                  forceValidateModal.action === 'valider'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {forceValidateLoading
                  ? 'En cours...'
                  : forceValidateModal.action === 'valider'
                    ? 'Valider'
                    : 'Refuser'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================
// Récupération RH - Interface refondue
// =============================================================

const RECUP_MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

function getInitials(prenom, nom) {
  return `${(prenom || '').charAt(0)}${(nom || '').charAt(0)}`.toUpperCase();
}

function avatarColor(id) {
  const colors = [
    'from-blue-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-rose-500',
    'from-purple-500 to-pink-600',
    'from-amber-500 to-orange-600',
    'from-cyan-500 to-blue-600',
  ];
  return colors[(Number(id) || 0) % colors.length];
}

function RecupStatusBadge({ statut }) {
  const config = {
    en_attente: { label: 'En attente', bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', dot: 'bg-amber-500' },
    validee: { label: 'Validée', bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', dot: 'bg-emerald-500' },
    refusee: { label: 'Refusée', bg: 'bg-rose-50', text: 'text-rose-700', ring: 'ring-rose-200', dot: 'bg-rose-500' },
    annulee: { label: 'Annulée', bg: 'bg-gray-50', text: 'text-gray-700', ring: 'ring-gray-200', dot: 'bg-gray-400' },
  };
  const c = config[statut] || config.en_attente;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text} ring-1 ${c.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>
      {c.label}
    </span>
  );
}

function RecupSubTab({ active, onClick, children, count, icon }) {
  return (
    <button
      onClick={onClick}
      className={`relative inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${
        active
          ? 'bg-white text-orange-700 shadow-sm ring-1 ring-orange-100'
          : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
      }`}
    >
      {icon}
      {children}
      {count !== undefined && count > 0 && (
        <span className={`ml-1 px-1.5 py-0.5 text-[11px] rounded-full font-bold ${
          active ? 'bg-orange-100 text-orange-700' : 'bg-gray-200 text-gray-700'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

function RecupFilterPill({ active, onClick, children, dot }) {
  const dotColors = { amber: 'bg-amber-500', emerald: 'bg-emerald-500', rose: 'bg-rose-500' };
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition ${
        active
          ? 'bg-orange-600 text-white shadow-sm shadow-orange-200'
          : 'bg-white text-gray-600 hover:text-gray-900 ring-1 ring-gray-200'
      }`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[dot]}`}></span>}
      {children}
    </button>
  );
}

function RecuperationRHView({
  recupRequests, recupUtilRequests, recupBalances,
  recupSubTab, setRecupSubTab,
  recupSearch, setRecupSearch,
  recupStatusFilter, setRecupStatusFilter,
  recupActionLoading, handleRecupAction, handleRecupUtilAction,
  setSelectedRecupDoc,
  rhRecupForm, setRhRecupForm, rhRecupLoading, setRhRecupLoading,
  setRecupBalances, fetchData
}) {
  // Stats globales
  const pendingAcq = recupRequests.filter(r => r.statut === 'en_attente').length;
  const pendingUtil = recupUtilRequests.filter(r => r.statut === 'en_attente').length;
  const totalPending = pendingAcq + pendingUtil;
  const totalHeuresAcq = recupRequests
    .filter(r => r.statut === 'validee')
    .reduce((s, r) => s + (Number(r.nombre_heures) || 0), 0);
  const totalHeuresUtil = recupUtilRequests
    .filter(r => r.statut === 'validee')
    .reduce((s, r) => s + (Number(r.nombre_heures) || 0), 0);
  const agentsAvecSolde = recupBalances.filter(b => b.heures_disponibles > 0).length;

  // Filtrage
  const matchesSearch = (req) => {
    if (!recupSearch.trim()) return true;
    const q = recupSearch.toLowerCase();
    return (
      (req.prenom || '').toLowerCase().includes(q) ||
      (req.nom || '').toLowerCase().includes(q) ||
      (req.service || '').toLowerCase().includes(q)
    );
  };
  const matchesStatus = (req) =>
    recupStatusFilter === 'toutes' ? true : req.statut === recupStatusFilter;

  // Pending unifié (les deux types)
  const pendingItems = useMemo(() => {
    const acq = recupRequests
      .filter(r => r.statut === 'en_attente')
      .filter(matchesSearch)
      .map(r => ({ ...r, _kind: 'acquisition' }));
    const util = recupUtilRequests
      .filter(r => r.statut === 'en_attente')
      .filter(matchesSearch)
      .map(r => ({ ...r, _kind: 'utilisation' }));
    return [...acq, ...util].sort((a, b) =>
      new Date(b.date_demande || 0).getTime() - new Date(a.date_demande || 0).getTime()
    );
  }, [recupRequests, recupUtilRequests, recupSearch]);

  // Filtré + groupé par mois pour vues historiques
  const groupByMonth = (items, dateField) => {
    const filtered = items.filter(matchesSearch).filter(matchesStatus);
    const sorted = [...filtered].sort((a, b) => {
      const da = new Date(a[dateField] || 0).getTime();
      const db = new Date(b[dateField] || 0).getTime();
      return db - da;
    });
    const groups = {};
    sorted.forEach(item => {
      const d = new Date(item[dateField]);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      if (!groups[key]) {
        groups[key] = {
          label: `${RECUP_MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
          items: [],
          totalHeures: 0
        };
      }
      groups[key].items.push(item);
      groups[key].totalHeures += Number(item.nombre_heures) || 0;
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  };

  const declarationsGroupes = useMemo(
    () => groupByMonth(recupRequests, 'date_travail'),
    [recupRequests, recupSearch, recupStatusFilter]
  );
  const utilisationsGroupes = useMemo(
    () => groupByMonth(recupUtilRequests, 'date_debut'),
    [recupUtilRequests, recupSearch, recupStatusFilter]
  );

  // Soldes filtrés
  const filteredBalances = useMemo(() => {
    const filtered = recupBalances.filter(b => {
      if (!recupSearch.trim()) return true;
      const q = recupSearch.toLowerCase();
      return (
        (b.prenom || '').toLowerCase().includes(q) ||
        (b.nom || '').toLowerCase().includes(q) ||
        (b.service || '').toLowerCase().includes(q)
      );
    });
    return [...filtered].sort((a, b) => b.heures_disponibles - a.heures_disponibles);
  }, [recupBalances, recupSearch]);

  return (
    <div className="space-y-6">
      {/* ===== HERO ===== */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-rose-500 to-pink-500 text-white shadow-xl">
        <div className="absolute -top-16 -right-12 w-72 h-72 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -left-12 w-80 h-80 bg-amber-300/20 rounded-full blur-3xl"></div>

        <div className="relative p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-full text-xs font-medium uppercase tracking-wider">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Gestion RH
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Récupérations</h1>
          <p className="text-white/80 text-sm mt-1.5 max-w-2xl">
            Validez les heures déclarées, planifiez les récupérations et suivez les soldes de chaque agent.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            <RecupHeroStat label="À traiter" value={totalPending} icon="bell" highlight={totalPending > 0} />
            <RecupHeroStat label="Heures déclarées (validées)" value={`${totalHeuresAcq}h`} icon="trending-up" />
            <RecupHeroStat label="Heures utilisées" value={`${totalHeuresUtil}h`} icon="calendar" />
            <RecupHeroStat label="Agents avec solde" value={agentsAvecSolde} icon="users" />
          </div>
        </div>
      </div>

      {/* ===== Bloc principal ===== */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Sous-onglets */}
        <div className="border-b border-gray-100 bg-gradient-to-b from-orange-50/50 to-transparent px-3 py-3">
          <nav className="flex gap-1 overflow-x-auto">
            <RecupSubTab
              active={recupSubTab === 'pending'}
              onClick={() => setRecupSubTab('pending')}
              count={totalPending}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              }
            >
              À traiter
            </RecupSubTab>
            <RecupSubTab
              active={recupSubTab === 'declarations'}
              onClick={() => setRecupSubTab('declarations')}
              count={recupRequests.length}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              }
            >
              Heures déclarées
            </RecupSubTab>
            <RecupSubTab
              active={recupSubTab === 'utilisations'}
              onClick={() => setRecupSubTab('utilisations')}
              count={recupUtilRequests.length}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
            >
              Utilisations
            </RecupSubTab>
            <RecupSubTab
              active={recupSubTab === 'balances'}
              onClick={() => setRecupSubTab('balances')}
              count={recupBalances.length}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
            >
              Soldes
            </RecupSubTab>
            <RecupSubTab
              active={recupSubTab === 'place'}
              onClick={() => setRecupSubTab('place')}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              Placer pour un agent
            </RecupSubTab>
          </nav>
        </div>

        {/* Barre de filtres */}
        {recupSubTab !== 'place' && (
          <div className="px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3 border-b border-gray-100 bg-gray-50/50">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={recupSearch}
                onChange={(e) => setRecupSearch(e.target.value)}
                placeholder="Rechercher un agent…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
              />
            </div>

            {(recupSubTab === 'declarations' || recupSubTab === 'utilisations') && (
              <div className="flex flex-wrap items-center gap-2">
                <RecupFilterPill active={recupStatusFilter === 'toutes'} onClick={() => setRecupStatusFilter('toutes')}>
                  Toutes
                </RecupFilterPill>
                <RecupFilterPill active={recupStatusFilter === 'en_attente'} onClick={() => setRecupStatusFilter('en_attente')} dot="amber">
                  En attente
                </RecupFilterPill>
                <RecupFilterPill active={recupStatusFilter === 'validee'} onClick={() => setRecupStatusFilter('validee')} dot="emerald">
                  Validées
                </RecupFilterPill>
                <RecupFilterPill active={recupStatusFilter === 'refusee'} onClick={() => setRecupStatusFilter('refusee')} dot="rose">
                  Refusées
                </RecupFilterPill>
              </div>
            )}
          </div>
        )}

        {/* Contenus */}
        <div className="p-4 sm:p-6">
          {recupSubTab === 'pending' && (
            <PendingView
              items={pendingItems}
              recupActionLoading={recupActionLoading}
              handleRecupAction={handleRecupAction}
              handleRecupUtilAction={handleRecupUtilAction}
              setSelectedRecupDoc={setSelectedRecupDoc}
            />
          )}
          {recupSubTab === 'declarations' && (
            <DeclarationsView
              groupes={declarationsGroupes}
              recupActionLoading={recupActionLoading}
              handleRecupAction={handleRecupAction}
              setSelectedRecupDoc={setSelectedRecupDoc}
            />
          )}
          {recupSubTab === 'utilisations' && (
            <UtilisationsView
              groupes={utilisationsGroupes}
              recupActionLoading={recupActionLoading}
              handleRecupUtilAction={handleRecupUtilAction}
            />
          )}
          {recupSubTab === 'balances' && (
            <BalancesView balances={filteredBalances} />
          )}
          {recupSubTab === 'place' && (
            <PlaceRecupForm
              recupBalances={recupBalances}
              rhRecupForm={rhRecupForm}
              setRhRecupForm={setRhRecupForm}
              rhRecupLoading={rhRecupLoading}
              setRhRecupLoading={setRhRecupLoading}
              setRecupBalances={setRecupBalances}
              fetchData={fetchData}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function RecupHeroStat({ label, value, icon, highlight }) {
  const icons = {
    bell: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />,
    'trending-up': <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />,
    calendar: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
    users: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />,
  };
  return (
    <div className={`relative bg-white/15 backdrop-blur-sm rounded-xl p-3 border ${highlight ? 'border-white/40 ring-2 ring-white/30' : 'border-white/20'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white/80 text-[11px] uppercase tracking-wider font-medium">{label}</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
        </div>
        <div className="p-1.5 bg-white/15 rounded-lg">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {icons[icon]}
          </svg>
        </div>
      </div>
    </div>
  );
}

function AgentAvatar({ user_id, prenom, nom, size = 'md' }) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base'
  };
  return (
    <div className={`flex-shrink-0 ${sizes[size]} bg-gradient-to-br ${avatarColor(user_id)} rounded-full flex items-center justify-center text-white font-bold shadow-sm`}>
      {getInitials(prenom, nom)}
    </div>
  );
}

function PendingEmptyState() {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 text-emerald-500 mb-3">
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="font-medium text-gray-700">Tout est traité</p>
      <p className="text-sm text-gray-500 mt-1">Aucune demande en attente.</p>
    </div>
  );
}

function PendingView({ items, recupActionLoading, handleRecupAction, handleRecupUtilAction, setSelectedRecupDoc }) {
  if (items.length === 0) return <PendingEmptyState />;

  return (
    <div className="space-y-3">
      {items.map(item => (
        <div
          key={`${item._kind}-${item.id}`}
          className="group p-4 bg-white rounded-xl ring-1 ring-amber-100 hover:ring-amber-300 hover:shadow-md transition-all"
        >
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            {/* Agent */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <AgentAvatar user_id={item.user_id} prenom={item.prenom} nom={item.nom} size="lg" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-800 truncate">{item.prenom} {item.nom}</p>
                  <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${
                    item._kind === 'acquisition'
                      ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
                      : 'bg-orange-50 text-orange-700 ring-1 ring-orange-100'
                  }`}>
                    {item._kind === 'acquisition' ? 'Déclaration' : 'Utilisation'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {item.service || 'Service non renseigné'}
                  {item.poste && ` · ${item.poste}`}
                </p>
              </div>
            </div>

            {/* Détails */}
            <div className="flex items-center gap-4 px-2">
              <div className="text-center">
                <div className="flex items-baseline gap-0.5">
                  <span className="text-2xl font-bold text-gray-800 tabular-nums">{item.nombre_heures}</span>
                  <span className="text-xs text-gray-500">h</span>
                </div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wider">heures</p>
              </div>

              <div className="text-sm">
                {item._kind === 'acquisition' ? (
                  <>
                    <p className="text-gray-700"><span className="text-gray-400">Travail :</span> {item.date_travail_fr}</p>
                    <p className="text-gray-700">
                      <span className="text-gray-400">Type :</span>{' '}
                      <span className={`font-medium ${item.type_compensation === 'remuneration' ? 'text-emerald-700' : 'text-blue-700'}`}>
                        {item.type_compensation === 'remuneration' ? 'Rémunération' : 'Récupération'}
                      </span>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-700">
                      <span className="text-gray-400">Du :</span> {item.date_debut_fr}
                      {item.date_debut_fr !== item.date_fin_fr && ` → ${item.date_fin_fr}`}
                    </p>
                    <p className="text-xs text-gray-400">Demande du {item.date_demande_fr}</p>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 lg:ml-auto">
              {item._kind === 'acquisition' && (
                <button
                  onClick={() => setSelectedRecupDoc(item)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                  title="Voir le document signé"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Document
                </button>
              )}
              <button
                onClick={() =>
                  item._kind === 'acquisition'
                    ? handleRecupAction(item.id, 'refuser')
                    : handleRecupUtilAction(item.id, 'refuser')
                }
                disabled={recupActionLoading === item.id || recupActionLoading === `util-${item.id}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 ring-1 ring-rose-200 rounded-lg transition disabled:opacity-50"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Refuser
              </button>
              <button
                onClick={() =>
                  item._kind === 'acquisition'
                    ? handleRecupAction(item.id, 'valider')
                    : handleRecupUtilAction(item.id, 'valider')
                }
                disabled={recupActionLoading === item.id || recupActionLoading === `util-${item.id}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition disabled:opacity-50"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Valider
              </button>
            </div>
          </div>

          {item.raison && (
            <div className="mt-3 ml-14 pl-3 border-l-2 border-amber-200 text-sm text-gray-600 italic">
              {item.raison}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MonthSectionHeader({ label, totalHeures, count }) {
  return (
    <div className="flex items-center justify-between mb-3 px-1">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{label}</h3>
        <span className="text-xs text-gray-400">·</span>
        <span className="text-xs text-gray-500">{count} demande{count > 1 ? 's' : ''}</span>
      </div>
      <span className="text-xs font-semibold text-orange-700 bg-orange-50 px-2.5 py-1 rounded-full">
        Total · {totalHeures}h
      </span>
    </div>
  );
}

function DeclarationsView({ groupes, recupActionLoading, handleRecupAction, setSelectedRecupDoc }) {
  if (groupes.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 text-gray-400 mb-3">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <p className="font-medium text-gray-700">Aucune déclaration</p>
        <p className="text-sm text-gray-500 mt-1">Ajustez vos filtres pour voir plus de résultats.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupes.map(([key, group]) => (
        <div key={key}>
          <MonthSectionHeader label={group.label} totalHeures={group.totalHeures} count={group.items.length} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {group.items.map(req => (
              <div
                key={req.id}
                className={`p-4 bg-white rounded-xl ring-1 transition-all hover:shadow-md ${
                  req.statut === 'en_attente'
                    ? 'ring-amber-200 hover:ring-amber-300 bg-amber-50/30'
                    : 'ring-gray-100 hover:ring-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <AgentAvatar user_id={req.user_id} prenom={req.prenom} nom={req.nom} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{req.prenom} {req.nom}</p>
                        <p className="text-xs text-gray-500 truncate">{req.service || '—'}</p>
                      </div>
                      <RecupStatusBadge statut={req.statut} />
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-sm">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg font-medium">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {req.nombre_heures}h
                      </span>
                      <span className="text-xs text-gray-600">{req.date_travail_fr}</span>
                      <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${
                        req.type_compensation === 'remuneration'
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                          : 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
                      }`}>
                        {req.type_compensation === 'remuneration' ? 'Rémunération' : 'Récupération'}
                      </span>
                    </div>
                    {req.raison && (
                      <p className="text-xs text-gray-600 mt-2 line-clamp-2">{req.raison}</p>
                    )}
                    {req.commentaire && (
                      <p className="text-xs text-gray-500 italic mt-1.5 border-l-2 border-gray-200 pl-2">
                        {req.commentaire}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => setSelectedRecupDoc(req)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    Voir document
                  </button>
                  {req.statut === 'en_attente' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRecupAction(req.id, 'refuser')}
                        disabled={recupActionLoading === req.id}
                        className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md disabled:opacity-50"
                      >
                        Refuser
                      </button>
                      <button
                        onClick={() => handleRecupAction(req.id, 'valider')}
                        disabled={recupActionLoading === req.id}
                        className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50"
                      >
                        Valider
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function UtilisationsView({ groupes, recupActionLoading, handleRecupUtilAction }) {
  if (groupes.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 text-gray-400 mb-3">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="font-medium text-gray-700">Aucune utilisation</p>
        <p className="text-sm text-gray-500 mt-1">Ajustez vos filtres pour voir plus de résultats.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupes.map(([key, group]) => (
        <div key={key}>
          <MonthSectionHeader label={group.label} totalHeures={group.totalHeures} count={group.items.length} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {group.items.map(req => (
              <div
                key={req.id}
                className={`p-4 bg-white rounded-xl ring-1 transition-all hover:shadow-md ${
                  req.statut === 'en_attente'
                    ? 'ring-amber-200 hover:ring-amber-300 bg-amber-50/30'
                    : 'ring-gray-100 hover:ring-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <AgentAvatar user_id={req.user_id} prenom={req.prenom} nom={req.nom} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{req.prenom} {req.nom}</p>
                        <p className="text-xs text-gray-500 truncate">{req.service || '—'}</p>
                      </div>
                      <RecupStatusBadge statut={req.statut} />
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-sm">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-orange-50 text-orange-700 rounded-lg font-medium">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {req.nombre_heures}h
                      </span>
                      <span className="text-xs text-gray-600">
                        {req.date_debut_fr}
                        {req.date_debut_fr !== req.date_fin_fr && ` → ${req.date_fin_fr}`}
                      </span>
                    </div>
                    {req.raison && (
                      <p className="text-xs text-gray-600 mt-2 line-clamp-2">{req.raison}</p>
                    )}
                    {req.commentaire && (
                      <p className="text-xs text-gray-500 italic mt-1.5 border-l-2 border-gray-200 pl-2">
                        {req.commentaire}
                      </p>
                    )}
                  </div>
                </div>

                {req.statut === 'en_attente' && (
                  <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleRecupUtilAction(req.id, 'refuser')}
                      disabled={recupActionLoading === `util-${req.id}`}
                      className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md disabled:opacity-50"
                    >
                      Refuser
                    </button>
                    <button
                      onClick={() => handleRecupUtilAction(req.id, 'valider')}
                      disabled={recupActionLoading === `util-${req.id}`}
                      className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50"
                    >
                      Valider
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BalancesView({ balances }) {
  if (balances.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="font-medium text-gray-700">Aucun agent trouvé</p>
        <p className="text-sm text-gray-500 mt-1">Ajustez votre recherche.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {balances.map(b => {
        const pct = b.heures_acquises > 0
          ? Math.min(100, Math.round((b.heures_utilisees / b.heures_acquises) * 100))
          : 0;
        return (
          <div
            key={b.id}
            className="p-4 bg-white rounded-xl ring-1 ring-gray-100 hover:ring-orange-200 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3 mb-3">
              <AgentAvatar user_id={b.id} prenom={b.prenom} nom={b.nom} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-800 truncate">{b.prenom} {b.nom}</p>
                <p className="text-xs text-gray-500 truncate">{b.service || '—'}</p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-gray-500">Disponible</span>
                <span className="text-2xl font-bold text-orange-700 tabular-nums">{b.heures_disponibles}h</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[11px] text-gray-500 pt-1">
                <span>Acquises : <strong className="text-gray-700">{b.heures_acquises}h</strong></span>
                <span>Utilisées : <strong className="text-gray-700">{b.heures_utilisees}h</strong></span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PlaceRecupForm({ recupBalances, rhRecupForm, setRhRecupForm, rhRecupLoading, setRhRecupLoading, setRecupBalances, fetchData }) {
  const selectedBalance = recupBalances.find(b => String(b.id) === String(rhRecupForm.user_id));
  const dispo = selectedBalance ? selectedBalance.heures_disponibles : null;
  const heuresVal = parseFloat(rhRecupForm.nombre_heures);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rhRecupForm.user_id || !rhRecupForm.date_debut || !rhRecupForm.date_fin || !rhRecupForm.nombre_heures) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    if (new Date(rhRecupForm.date_debut) > new Date(rhRecupForm.date_fin)) {
      toast.error('La date de début doit être avant la date de fin');
      return;
    }
    if (isNaN(heuresVal) || heuresVal <= 0) {
      toast.error('Le nombre d\'heures doit être positif');
      return;
    }
    setRhRecupLoading(true);
    try {
      const response = await fetch('/api/recuperation/utilisation/rh-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rhRecupForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      toast.success('Récupération placée et validée');
      setRhRecupForm({ user_id: '', date_debut: '', date_fin: '', nombre_heures: '', raison: '' });
      const balRes = await fetch('/api/recuperation/all-balances').then(r => r.json());
      setRecupBalances(balRes.balances || []);
      if (fetchData) fetchData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRhRecupLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-gradient-to-br from-orange-50 to-rose-50 border border-orange-100 rounded-xl p-4 mb-6 flex items-start gap-3">
        <div className="p-2 bg-orange-600 text-white rounded-lg flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-orange-900">Placer une récupération directement validée</p>
          <p className="text-orange-700 text-xs mt-0.5">
            Aucune contrainte de délai : la date peut être dans le passé, le présent ou le futur.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Agent *</label>
          <select
            value={rhRecupForm.user_id}
            onChange={(e) => setRhRecupForm({ ...rhRecupForm, user_id: e.target.value })}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
            required
          >
            <option value="">Sélectionner un agent</option>
            {recupBalances.map((b) => (
              <option key={b.id} value={b.id}>
                {b.prenom} {b.nom} {b.service ? `(${b.service})` : ''} — {b.heures_disponibles}h disponibles
              </option>
            ))}
          </select>

          {selectedBalance && (
            <div className="mt-3 p-3 bg-white border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <AgentAvatar user_id={selectedBalance.id} prenom={selectedBalance.prenom} nom={selectedBalance.nom} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {selectedBalance.prenom} {selectedBalance.nom}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{selectedBalance.service || '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-blue-50 rounded-md">
                  <p className="text-[10px] text-blue-700 uppercase tracking-wider font-medium">Acquises</p>
                  <p className="text-sm font-bold text-blue-700">{selectedBalance.heures_acquises}h</p>
                </div>
                <div className="p-2 bg-amber-50 rounded-md">
                  <p className="text-[10px] text-amber-700 uppercase tracking-wider font-medium">Utilisées</p>
                  <p className="text-sm font-bold text-amber-700">{selectedBalance.heures_utilisees}h</p>
                </div>
                <div className="p-2 bg-emerald-50 rounded-md">
                  <p className="text-[10px] text-emerald-700 uppercase tracking-wider font-medium">Dispo.</p>
                  <p className="text-sm font-bold text-emerald-700">{selectedBalance.heures_disponibles}h</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date de début *</label>
            <input
              type="date"
              value={rhRecupForm.date_debut}
              onChange={(e) => setRhRecupForm({ ...rhRecupForm, date_debut: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date de fin *</label>
            <input
              type="date"
              value={rhRecupForm.date_fin}
              onChange={(e) => setRhRecupForm({ ...rhRecupForm, date_fin: e.target.value })}
              min={rhRecupForm.date_debut}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre d'heures *</label>
          <input
            type="number"
            step="0.5"
            min="0.5"
            value={rhRecupForm.nombre_heures}
            onChange={(e) => setRhRecupForm({ ...rhRecupForm, nombre_heures: e.target.value })}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            placeholder="Ex : 3.5"
            required
          />
          {dispo !== null && heuresVal > 0 && heuresVal > dispo && (
            <p className="text-xs text-rose-600 mt-1.5 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Dépasse le solde disponible ({dispo}h)
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Motif (optionnel)</label>
          <textarea
            value={rhRecupForm.raison}
            onChange={(e) => setRhRecupForm({ ...rhRecupForm, raison: e.target.value })}
            rows={3}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            placeholder="Motif de la récupération..."
          />
        </div>

        <button
          type="submit"
          disabled={rhRecupLoading}
          className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-rose-600 hover:from-orange-700 hover:to-rose-700 text-white py-3 rounded-xl font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {rhRecupLoading ? (
            'Enregistrement…'
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Placer et valider la récupération
            </>
          )}
        </button>
      </form>
    </div>
  );
}

function RecupDocumentModal({ demande, onClose }) {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Récupération - ${demande.prenom} ${demande.nom} - ${demande.date_travail_fr}</title>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #1a1a2e; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { font-size: 20px; text-transform: uppercase; letter-spacing: 2px; margin: 0; }
          .header p { font-size: 14px; color: #555; margin: 5px 0; }
          .separator { width: 100px; height: 2px; background: #555; margin: 15px auto; }
          .title { text-align: center; font-size: 16px; font-weight: bold; text-transform: uppercase; margin: 30px 0; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .section { margin: 20px 0; padding-top: 15px; border-top: 1px solid #ddd; }
          .detail-box { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0; }
          .checkbox-line { display: flex; align-items: center; gap: 8px; margin: 5px 0 5px 20px; }
          .checkbox { width: 14px; height: 14px; border: 2px solid #555; display: inline-block; text-align: center; line-height: 12px; font-size: 10px; }
          .checkbox.checked { background: #333; color: white; }
          .footer { display: flex; justify-content: space-between; margin-top: 40px; }
          .signature-area img { max-width: 200px; max-height: 80px; }
          .stamp { margin-top: 30px; padding: 15px; border: 2px solid; text-align: center; font-weight: bold; }
          .stamp.validated { border-color: #16a34a; color: #16a34a; }
          .stamp.refused { border-color: #dc2626; color: #dc2626; }
          .disclaimer { font-size: 11px; font-style: italic; color: #777; margin: 20px 0; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Commune de Chartrettes</h1>
          <p>Service des Ressources Humaines</p>
          <div class="separator"></div>
        </div>
        <div class="title">
          Demande de ${demande.type_compensation === 'remuneration' ? 'Rémunération' : 'Récupération'} d'Heures Supplémentaires
        </div>
        <div class="info-grid">
          <div><strong>Nom :</strong> ${demande.nom}</div>
          <div><strong>Prénom :</strong> ${demande.prenom}</div>
          <div><strong>Service :</strong> ${demande.service || 'Non renseigné'}</div>
          <div><strong>Poste :</strong> ${demande.poste || 'Non renseigné'}</div>
        </div>
        <div class="section">
          <p>Je soussigné(e) <strong>${demande.prenom} ${demande.nom}</strong>,
          déclare avoir effectué des heures de travail supplémentaires dans les conditions suivantes :</p>
          <div class="detail-box">
            <p><strong>Date du travail supplémentaire :</strong> ${demande.date_travail_fr}</p>
            <p><strong>Nombre d'heures effectuées :</strong> ${demande.nombre_heures} heure(s)</p>
            <p><strong>Nature du travail :</strong> ${demande.raison}</p>
          </div>
        </div>
        <div class="section">
          <p><strong>Compensation demandée :</strong></p>
          <div class="checkbox-line">
            <span class="checkbox ${demande.type_compensation === 'recuperation' ? 'checked' : ''}">${demande.type_compensation === 'recuperation' ? 'X' : ''}</span>
            <span>Récupération en jours de congé</span>
          </div>
          <div class="checkbox-line">
            <span class="checkbox ${demande.type_compensation === 'remuneration' ? 'checked' : ''}">${demande.type_compensation === 'remuneration' ? 'X' : ''}</span>
            <span>Rémunération des heures supplémentaires</span>
          </div>
        </div>
        <p class="disclaimer">En signant ce document, je certifie sur l'honneur l'exactitude des informations ci-dessus.</p>
        <div class="footer">
          <div>
            <p><strong>Fait à Chartrettes,</strong></p>
            <p>Le ${demande.date_demande_fr}</p>
          </div>
          <div class="signature-area">
            <p><strong>Signature de l'agent</strong></p>
            ${demande.signature ? `<img src="${demande.signature}" alt="Signature" />` : ''}
          </div>
        </div>
        ${demande.statut !== 'en_attente' ? `
          <div class="stamp ${demande.statut === 'validee' ? 'validated' : 'refused'}">
            ${demande.statut === 'validee' ? 'VALIDEE' : 'REFUSEE'}
            ${demande.date_validation_fr ? ` - Le ${demande.date_validation_fr}` : ''}
            ${demande.validateur_prenom ? ` - Par ${demande.validateur_prenom} ${demande.validateur_nom}` : ''}
          </div>
        ` : ''}
        ${demande.commentaire ? `<p style="margin-top:15px;font-style:italic"><strong>Commentaire :</strong> ${demande.commentaire}</p>` : ''}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
          <h3 className="font-bold text-gray-800">Document - {demande.prenom} {demande.nom}</h3>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
            >
              Imprimer / PDF
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 uppercase tracking-wide">Commune de Chartrettes</h3>
            <p className="text-sm text-gray-600 mt-1">Service des Ressources Humaines</p>
            <div className="w-24 h-0.5 bg-gray-400 mx-auto mt-3"></div>
          </div>

          <h4 className="text-center text-base font-bold text-gray-800 mb-6 uppercase">
            Demande de {demande.type_compensation === 'remuneration' ? 'Rémunération' : 'Récupération'} d'Heures Supplémentaires
          </h4>

          <div className="grid grid-cols-2 gap-2 bg-gray-50 p-4 rounded-lg text-sm mb-4">
            <p><span className="font-semibold">Nom :</span> {demande.nom}</p>
            <p><span className="font-semibold">Prénom :</span> {demande.prenom}</p>
            <p><span className="font-semibold">Service :</span> {demande.service || 'Non renseigné'}</p>
            <p><span className="font-semibold">Poste :</span> {demande.poste || 'Non renseigné'}</p>
          </div>

          <div className="border-t border-gray-200 pt-4 text-sm space-y-3">
            <p>
              Je soussigné(e) <strong>{demande.prenom} {demande.nom}</strong>,
              déclare avoir effectué des heures de travail supplémentaires :
            </p>
            <div className="bg-gray-50 p-4 rounded-lg space-y-1">
              <p><strong>Date :</strong> {demande.date_travail_fr}</p>
              <p><strong>Heures :</strong> {demande.nombre_heures}h</p>
              <p><strong>Nature :</strong> {demande.raison}</p>
            </div>
            <p>
              <strong>Compensation :</strong>{' '}
              {demande.type_compensation === 'remuneration' ? 'Rémunération' : 'Récupération en congé'}
            </p>
          </div>

          <div className="border-t border-gray-200 pt-4 mt-4 flex justify-between items-end text-sm">
            <div>
              <p className="font-semibold">Fait à Chartrettes,</p>
              <p>Le {demande.date_demande_fr}</p>
            </div>
            <div className="text-center">
              <p className="font-semibold mb-1">Signature</p>
              {demande.signature && (
                <img src={demande.signature} alt="Signature" className="max-w-[180px] max-h-[70px]" />
              )}
            </div>
          </div>

          {demande.statut !== 'en_attente' && (
            <div className={`mt-6 p-3 border-2 rounded-lg text-center font-bold ${
              demande.statut === 'validee' ? 'border-green-500 text-green-600' : 'border-red-500 text-red-600'
            }`}>
              {demande.statut === 'validee' ? 'VALIDEE' : 'REFUSEE'}
              {demande.date_validation_fr && ` - Le ${demande.date_validation_fr}`}
              {demande.validateur_prenom && ` - Par ${demande.validateur_prenom} ${demande.validateur_nom}`}
            </div>
          )}

          {demande.commentaire && (
            <p className="mt-3 text-sm italic text-gray-600">
              <strong>Commentaire :</strong> {demande.commentaire}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
