'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { formatDateFR, formatStatus, getStatusColor } from '@/lib/clientDateUtils';
import toast from 'react-hot-toast';

export default function MesDemandesPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    } else {
      fetchLeaves();
    }
  }, [isAuthenticated, router]);

  const fetchLeaves = async () => {
    try {
      const response = await fetch('/api/leaves/my-leaves');
      const data = await response.json();

      if (data.success) {
        setLeaves(data.leaves);
      } else {
        toast.error('Erreur lors du chargement des demandes');
      }
    } catch (error) {
      toast.error('Erreur lors du chargement des demandes');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLeave = async (id, dateDebut) => {
    // Vérifier que la date n'est pas passée
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(dateDebut);

    if (startDate < today) {
      toast.error('Vous ne pouvez pas supprimer une demande dont la date est déjà passée');
      return;
    }

    if (!confirm('Êtes-vous sûr de vouloir supprimer cette demande de congé ?')) {
      return;
    }

    try {
      const response = await fetch(`/api/leaves/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Demande supprimée avec succès');
        fetchLeaves();
      } else {
        toast.error(data.message || 'Erreur lors de la suppression');
      }
    } catch (error) {
      toast.error('Erreur lors de la suppression de la demande');
    }
  };

  const filteredLeaves = leaves.filter(leave => {
    if (filterStatus === 'all') return true;
    return leave.statut === filterStatus;
  });

  const getStatistics = () => {
    return {
      total: leaves.length,
      enAttente: leaves.filter(l => l.statut === 'en_attente').length,
      validee: leaves.filter(l => l.statut === 'validee').length,
      refusee: leaves.filter(l => l.statut === 'refusee').length,
    };
  };

  const stats = getStatistics();

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

      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Mes demandes de congés</h1>
          <p className="text-gray-600">Consultez l'historique complet de vos demandes</p>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total</p>
                <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
              </div>
              <div className="bg-gray-100 rounded-full p-3">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">En attente</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.enAttente}</p>
              </div>
              <div className="bg-yellow-100 rounded-full p-3">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Validées</p>
                <p className="text-3xl font-bold text-green-600">{stats.validee}</p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Refusées</p>
                <p className="text-3xl font-bold text-red-600">{stats.refusee}</p>
              </div>
              <div className="bg-red-100 rounded-full p-3">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Toutes ({stats.total})
            </button>
            <button
              onClick={() => setFilterStatus('en_attente')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                filterStatus === 'en_attente'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              En attente ({stats.enAttente})
            </button>
            <button
              onClick={() => setFilterStatus('validee')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                filterStatus === 'validee'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Validées ({stats.validee})
            </button>
            <button
              onClick={() => setFilterStatus('refusee')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                filterStatus === 'refusee'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Refusées ({stats.refusee})
            </button>
          </div>
        </div>

        {/* Liste des demandes */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {filteredLeaves.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500 text-lg">Aucune demande trouvée</p>
              <p className="text-gray-400 text-sm mt-2">
                {filterStatus === 'all'
                  ? 'Vous n\'avez pas encore fait de demande de congés'
                  : `Vous n'avez aucune demande avec le statut "${formatStatus(filterStatus)}"`
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date de demande
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Période
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Durée
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Motif
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Validateur
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredLeaves.map((leave) => (
                    <tr key={leave.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateFR(leave.date_demande)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatDateFR(leave.date_debut)}
                        </div>
                        <div className="text-sm text-gray-500">
                          au {formatDateFR(leave.date_fin)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {leave.nombre_jours_ouvres} jour{leave.nombre_jours_ouvres > 1 ? 's' : ''}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs">
                          {leave.motif || <span className="text-gray-400 italic">Non précisé</span>}
                        </div>
                        {leave.commentaire_rh && (
                          <div className="text-xs text-gray-500 mt-1 p-2 bg-yellow-50 rounded border border-yellow-200">
                            <span className="font-semibold">Commentaire RH:</span> {leave.commentaire_rh}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(leave.statut)}`}>
                          {formatStatus(leave.statut)}
                        </span>
                        {leave.date_validation && (
                          <div className="text-xs text-gray-500 mt-1">
                            Le {formatDateFR(leave.date_validation)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {leave.validateur_nom ? (
                          <div>
                            <div className="font-medium text-gray-900">
                              {leave.validateur_prenom} {leave.validateur_nom}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">En attente</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {leave.statut === 'en_attente' && new Date(leave.date_debut) >= new Date(new Date().setHours(0,0,0,0)) ? (
                          <button
                            onClick={() => handleDeleteLeave(leave.id, leave.date_debut)}
                            className="text-red-600 hover:text-red-800 font-medium transition flex items-center gap-1"
                            title="Supprimer la demande"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Supprimer
                          </button>
                        ) : (
                          <span className="text-gray-400 italic">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
