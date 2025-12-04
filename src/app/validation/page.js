'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { formatDateFR, formatStatus, getStatusColor } from '@/lib/clientDateUtils';
import toast from 'react-hot-toast';

export default function ValidationPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [commentaire, setCommentaire] = useState('');
  const [validatorInfo, setValidatorInfo] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    } else {
      fetchPendingLeaves();
    }
  }, [isAuthenticated, router]);

  const fetchPendingLeaves = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/leaves/pending-validation');
      const data = await response.json();

      if (data.success) {
        setPendingLeaves(data.leaves || []);
        setValidatorInfo(data.validator_info);
      } else {
        toast.error('Erreur lors du chargement des demandes');
      }
    } catch (error) {
      console.error('Error fetching pending leaves:', error);
      toast.error('Erreur lors du chargement des demandes');
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async (leaveId, status) => {
    try {
      const response = await fetch(`/api/leaves/${leaveId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: status, commentaire_rh: commentaire }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      toast.success(data.message);
      setSelectedLeave(null);
      setCommentaire('');
      fetchPendingLeaves();
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">
            Validation des demandes de congés
          </h1>
          <p className="text-gray-600 mt-2">
            {validatorInfo?.isRH
              ? 'Validation finale RH'
              : validatorInfo?.level === 1
              ? 'Validation responsable direct'
              : validatorInfo?.level === 2
              ? 'Validation responsable hiérarchique'
              : 'Demandes en attente de validation'}
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-600"></div>
            <p className="mt-4 text-gray-600">Chargement...</p>
          </div>
        ) : pendingLeaves.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              Aucune demande en attente
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Toutes les demandes ont été traitées.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Employé
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Période
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Jours
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date demande
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Niveau validation
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pendingLeaves.map((leave) => (
                    <tr key={leave.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium">{leave.prenom} {leave.nom}</p>
                        <p className="text-xs text-gray-500">{leave.type_utilisateur}</p>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div>
                          <p className="font-medium">{formatDateFR(leave.date_debut)} - {formatDateFR(leave.date_fin)}</p>
                          {leave.type_debut !== 'journee_complete' && (
                            <p className="text-xs text-gray-500">
                              Début: {leave.type_debut === 'matin' ? 'Matin' : 'Après-midi'}
                            </p>
                          )}
                          {leave.type_fin !== 'journee_complete' && (
                            <p className="text-xs text-gray-500">
                              Fin: {leave.type_fin === 'matin' ? 'Matin' : 'Après-midi'}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {leave.nombre_jours_ouvres}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDateFR(leave.date_demande)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {leave.validation_info?.isFinal ? (
                          <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded">
                            Validation finale
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                            Niveau {leave.validation_info?.level}
                          </span>
                        )}
                        {leave.statut_niveau_1 === 'validee' && leave.validateur_n1_nom && (
                          <p className="text-xs text-gray-500 mt-1">
                            ✓ N1: {leave.validateur_n1_prenom} {leave.validateur_n1_nom}
                          </p>
                        )}
                        {leave.statut_niveau_2 === 'validee' && leave.validateur_n2_nom && (
                          <p className="text-xs text-gray-500 mt-1">
                            ✓ N2: {leave.validateur_n2_prenom} {leave.validateur_n2_nom}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedLeave(leave)}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            Examiner
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal de validation */}
      {selectedLeave && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Demande de congés
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Employé</label>
                  <p className="text-lg font-semibold">{selectedLeave.prenom} {selectedLeave.nom}</p>
                  <p className="text-sm text-gray-500">{selectedLeave.type_utilisateur}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Date de début</label>
                    <p className="font-semibold">{formatDateFR(selectedLeave.date_debut)}</p>
                    {selectedLeave.type_debut !== 'journee_complete' && (
                      <p className="text-xs text-gray-500">
                        {selectedLeave.type_debut === 'matin' ? 'Matin uniquement' : 'Après-midi uniquement'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Date de fin</label>
                    <p className="font-semibold">{formatDateFR(selectedLeave.date_fin)}</p>
                    {selectedLeave.type_fin !== 'journee_complete' && (
                      <p className="text-xs text-gray-500">
                        {selectedLeave.type_fin === 'matin' ? 'Matin uniquement' : 'Après-midi uniquement'}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre de jours</label>
                  <p className="text-2xl font-bold text-blue-600">{selectedLeave.nombre_jours_ouvres}</p>
                </div>

                {selectedLeave.motif && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Motif</label>
                    <p className="text-gray-800">{selectedLeave.motif}</p>
                  </div>
                )}

                {(selectedLeave.statut_niveau_1 === 'validee' || selectedLeave.statut_niveau_2 === 'validee') && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">Validations précédentes</h4>
                    {selectedLeave.statut_niveau_1 === 'validee' && (
                      <p className="text-sm text-blue-800">
                        ✓ Niveau 1: {selectedLeave.validateur_n1_prenom} {selectedLeave.validateur_n1_nom}
                        {selectedLeave.date_validation_niveau_1 && (
                          <span className="text-xs ml-2">({formatDateFR(selectedLeave.date_validation_niveau_1)})</span>
                        )}
                      </p>
                    )}
                    {selectedLeave.statut_niveau_2 === 'validee' && (
                      <p className="text-sm text-blue-800 mt-1">
                        ✓ Niveau 2: {selectedLeave.validateur_n2_prenom} {selectedLeave.validateur_n2_nom}
                        {selectedLeave.date_validation_niveau_2 && (
                          <span className="text-xs ml-2">({formatDateFR(selectedLeave.date_validation_niveau_2)})</span>
                        )}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Commentaire (optionnel)
                  </label>
                  <textarea
                    value={commentaire}
                    onChange={(e) => setCommentaire(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                    placeholder="Ajoutez un commentaire..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setSelectedLeave(null);
                    setCommentaire('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleValidate(selectedLeave.id, 'refusee')}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
                >
                  Refuser
                </button>
                <button
                  onClick={() => handleValidate(selectedLeave.id, 'validee')}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                >
                  Valider
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
