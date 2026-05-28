'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { formatDateFR } from '@/lib/clientDateUtils';
import toast from 'react-hot-toast';

export default function ValidationPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [pendingDeclarations, setPendingDeclarations] = useState([]);
  const [pendingUtilisations, setPendingUtilisations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [selectedRecup, setSelectedRecup] = useState(null);
  const [commentaire, setCommentaire] = useState('');
  const [validatorInfo, setValidatorInfo] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    } else {
      fetchPending();
    }
  }, [isAuthenticated, router]);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const [leavesRes, recupRes] = await Promise.all([
        fetch('/api/leaves/pending-validation').then(r => r.json()),
        fetch('/api/recuperation/pending-validation').then(r => r.json())
      ]);
      if (leavesRes.success) {
        setPendingLeaves(leavesRes.leaves || []);
        setValidatorInfo(leavesRes.validator_info);
      }
      if (recupRes.success) {
        setPendingDeclarations(recupRes.declarations || []);
        setPendingUtilisations(recupRes.utilisations || []);
        if (!leavesRes.success) setValidatorInfo(recupRes.validator_info);
      }
    } catch (error) {
      console.error('Error fetching pending validations:', error);
      toast.error('Erreur lors du chargement des demandes');
    } finally {
      setLoading(false);
    }
  };

  const handleValidateLeave = async (leaveId, status) => {
    try {
      const response = await fetch(`/api/leaves/${leaveId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: status, commentaire_rh: commentaire }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      toast.success(data.message);
      setSelectedLeave(null);
      setCommentaire('');
      fetchPending();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleValidateRecup = async (demande, action) => {
    try {
      const endpoint = demande.type_demande === 'declaration'
        ? `/api/recuperation/${demande.id}`
        : `/api/recuperation/utilisation/${demande.id}`;
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, commentaire }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      toast.success(data.message);
      setSelectedRecup(null);
      setCommentaire('');
      fetchPending();
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (!isAuthenticated || !user) return null;

  const totalPending = pendingLeaves.length + pendingDeclarations.length + pendingUtilisations.length;
  const totalRecup = pendingDeclarations.length + pendingUtilisations.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <Navbar />

      <div className="container mx-auto px-4 sm:px-6 py-6 max-w-7xl space-y-6">
        {/* HERO bleu */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-sky-600 to-indigo-600 text-white shadow-xl">
          <div className="absolute -top-16 -right-12 w-72 h-72 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-20 -left-12 w-80 h-80 bg-indigo-300/20 rounded-full blur-3xl"></div>
          <div className="relative p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-full text-xs font-medium uppercase tracking-wider">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                {validatorInfo?.isRH ? 'RH — Validation finale'
                  : validatorInfo?.level === 1 ? 'Responsable direct'
                  : validatorInfo?.level === 2 ? 'Responsable hiérarchique'
                  : 'Validation'}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Validation des demandes</h1>
            <p className="text-white/80 text-sm mt-1.5 max-w-2xl">
              {validatorInfo?.isRH
                ? 'Validation finale des demandes après le circuit hiérarchique.'
                : 'Examinez et validez les demandes de vos collaborateurs.'}
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
              <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3 border border-white/20">
                <p className="text-[10px] uppercase tracking-wider text-white/70 font-medium">Total à traiter</p>
                <p className="text-2xl font-bold tracking-tight">{totalPending}</p>
              </div>
              <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3 border border-white/20">
                <p className="text-[10px] uppercase tracking-wider text-white/70 font-medium">Congés</p>
                <p className="text-2xl font-bold tracking-tight">{pendingLeaves.length}</p>
              </div>
              <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3 border border-white/20">
                <p className="text-[10px] uppercase tracking-wider text-white/70 font-medium">Heures sup</p>
                <p className="text-2xl font-bold tracking-tight">{totalRecup}</p>
              </div>
              <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3 border border-white/20">
                <p className="text-[10px] uppercase tracking-wider text-white/70 font-medium">Niveau</p>
                <p className="text-2xl font-bold tracking-tight">{validatorInfo?.isRH ? 'RH' : `N${validatorInfo?.level || '-'}`}</p>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-600"></div>
            <p className="mt-4 text-gray-600">Chargement...</p>
          </div>
        ) : totalPending === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune demande en attente</h3>
            <p className="mt-1 text-sm text-gray-500">Toutes les demandes ont été traitées.</p>
          </div>
        ) : (
          <>
            {/* SECTION CONGÉS (style bleu) */}
            {pendingLeaves.length > 0 && (
              <SectionHeader
                color="blue"
                title="Demandes de congés"
                subtitle="Validation des absences"
                count={pendingLeaves.length}
                icon={
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                }
              />
            )}
            {pendingLeaves.length > 0 && (
              <>
                {/* Vue mobile : cartes */}
                <div className="md:hidden space-y-3">
                  {pendingLeaves.map((leave) => (
                    <div key={leave.id} className="bg-white rounded-2xl shadow-sm border border-blue-100 border-l-4 border-l-blue-500 p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-gray-900">{leave.prenom} {leave.nom}</p>
                          <p className="text-xs text-gray-500">{leave.type_utilisateur}</p>
                        </div>
                        {leave.validation_info?.isFinal ? (
                          <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs font-semibold rounded">Finale</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-semibold rounded">Niv. {leave.validation_info?.level}</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-700 mb-1">
                        {formatDateFR(leave.date_debut)} - {formatDateFR(leave.date_fin)}
                      </div>
                      <div className="flex justify-between items-center mt-3">
                        <span className="text-sm font-semibold text-gray-800">{leave.nombre_jours_ouvres} jour{leave.nombre_jours_ouvres > 1 ? 's' : ''}</span>
                        <button onClick={() => setSelectedLeave(leave)} className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition">
                          Examiner
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Vue desktop : tableau */}
                <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-blue-100 border-l-4 border-l-blue-500 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-blue-50/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employé</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Période</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jours</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date demande</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Niveau</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {pendingLeaves.map((leave) => (
                          <tr key={leave.id} className="hover:bg-blue-50/30">
                            <td className="px-4 py-3">
                              <p className="font-medium">{leave.prenom} {leave.nom}</p>
                              <p className="text-xs text-gray-500">{leave.type_utilisateur}</p>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <p className="font-medium">{formatDateFR(leave.date_debut)} - {formatDateFR(leave.date_fin)}</p>
                              {leave.type_debut !== 'journee_complete' && (
                                <p className="text-xs text-gray-500">Début: {leave.type_debut === 'matin' ? 'Matin' : 'Après-midi'}</p>
                              )}
                              {leave.type_fin !== 'journee_complete' && (
                                <p className="text-xs text-gray-500">Fin: {leave.type_fin === 'matin' ? 'Matin' : 'Après-midi'}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 font-semibold">{leave.nombre_jours_ouvres}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{formatDateFR(leave.date_demande)}</td>
                            <td className="px-4 py-3 text-sm">
                              {leave.validation_info?.isFinal ? (
                                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded">Finale</span>
                              ) : (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">Niveau {leave.validation_info?.level}</span>
                              )}
                              {leave.statut_niveau_1 === 'validee' && leave.validateur_n1_nom && (
                                <p className="text-xs text-gray-500 mt-1">✓ N1: {leave.validateur_n1_prenom} {leave.validateur_n1_nom}</p>
                              )}
                              {leave.statut_niveau_2 === 'validee' && leave.validateur_n2_nom && (
                                <p className="text-xs text-gray-500 mt-1">✓ N2: {leave.validateur_n2_prenom} {leave.validateur_n2_nom}</p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <button onClick={() => setSelectedLeave(leave)} className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                                Examiner
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* SECTION HEURES SUPPLÉMENTAIRES (style orange) */}
            {totalRecup > 0 && (
              <SectionHeader
                color="orange"
                title="Heures supplémentaires"
                subtitle="Déclarations et utilisations de récupération"
                count={totalRecup}
                icon={
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                }
              />
            )}
            {totalRecup > 0 && (
              <>
                {/* Mobile */}
                <div className="md:hidden space-y-3">
                  {pendingDeclarations.map((d) => (
                    <RecupCard key={`decl-${d.id}`} demande={d} type="declaration" onClick={setSelectedRecup} />
                  ))}
                  {pendingUtilisations.map((d) => (
                    <RecupCard key={`util-${d.id}`} demande={d} type="utilisation" onClick={setSelectedRecup} />
                  ))}
                </div>

                {/* Desktop */}
                <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-orange-100 border-l-4 border-l-orange-500 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-orange-50/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employé</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date(s)</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Heures</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date demande</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Niveau</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {pendingDeclarations.map((d) => (
                          <RecupRow key={`decl-${d.id}`} demande={d} onClick={setSelectedRecup} />
                        ))}
                        {pendingUtilisations.map((d) => (
                          <RecupRow key={`util-${d.id}`} demande={d} onClick={setSelectedRecup} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Modal de validation congés */}
      {selectedLeave && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-blue-100 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-blue-100">
              <h3 className="text-lg sm:text-xl font-bold text-blue-900">Demande de congés</h3>
            </div>
            <div className="p-4 sm:p-6">
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Employé</label>
                  <p className="text-base sm:text-lg font-semibold">{selectedLeave.prenom} {selectedLeave.nom}</p>
                  <p className="text-sm text-gray-500">{selectedLeave.type_utilisateur}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Date de début</label>
                    <p className="font-semibold">{formatDateFR(selectedLeave.date_debut)}</p>
                    {selectedLeave.type_debut !== 'journee_complete' && (
                      <p className="text-xs text-gray-500">{selectedLeave.type_debut === 'matin' ? 'Matin uniquement' : 'Après-midi uniquement'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Date de fin</label>
                    <p className="font-semibold">{formatDateFR(selectedLeave.date_fin)}</p>
                    {selectedLeave.type_fin !== 'journee_complete' && (
                      <p className="text-xs text-gray-500">{selectedLeave.type_fin === 'matin' ? 'Matin uniquement' : 'Après-midi uniquement'}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre de jours</label>
                  <p className="text-xl sm:text-2xl font-bold text-blue-600">{selectedLeave.nombre_jours_ouvres}</p>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Commentaire (optionnel)</label>
                  <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows="3" placeholder="Ajoutez un commentaire..." />
                </div>
              </div>

              <div className="flex gap-2 sm:gap-3 mt-6">
                <button onClick={() => { setSelectedLeave(null); setCommentaire(''); }} className="flex-1 px-3 py-2 text-sm sm:text-base bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium">Annuler</button>
                <button onClick={() => handleValidateLeave(selectedLeave.id, 'refusee')} className="flex-1 px-3 py-2 text-sm sm:text-base bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium">Refuser</button>
                <button onClick={() => handleValidateLeave(selectedLeave.id, 'validee')} className="flex-1 px-3 py-2 text-sm sm:text-base bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium">Valider</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de validation heures sup (style orange) */}
      {selectedRecup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-orange-100 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-6 py-4 border-b border-orange-100">
              <h3 className="text-lg sm:text-xl font-bold text-orange-900">
                {selectedRecup.type_demande === 'declaration'
                  ? 'Déclaration d\'heures supplémentaires'
                  : 'Utilisation de récupération'}
              </h3>
            </div>
            <div className="p-4 sm:p-6">
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Employé</label>
                  <p className="text-base sm:text-lg font-semibold">{selectedRecup.prenom} {selectedRecup.nom}</p>
                  <p className="text-sm text-gray-500">{selectedRecup.type_utilisateur}</p>
                </div>

                {selectedRecup.type_demande === 'declaration' ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Date du travail</label>
                        <p className="font-semibold">{formatDateFR(selectedRecup.date_travail)}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Nombre d'heures</label>
                        <p className="text-xl sm:text-2xl font-bold text-orange-600">{selectedRecup.nombre_heures}h</p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Type de compensation</label>
                      <p className="font-semibold text-gray-800">
                        {selectedRecup.type_compensation === 'remuneration' ? 'Rémunération' : 'Récupération en congé'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Description</label>
                      <p className="text-gray-800 whitespace-pre-wrap">{selectedRecup.raison}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Date de début</label>
                        <p className="font-semibold">{formatDateFR(selectedRecup.date_debut)}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Date de fin</label>
                        <p className="font-semibold">{formatDateFR(selectedRecup.date_fin)}</p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Nombre d'heures</label>
                      <p className="text-xl sm:text-2xl font-bold text-orange-600">{selectedRecup.nombre_heures}h</p>
                    </div>
                    {selectedRecup.raison && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Motif</label>
                        <p className="text-gray-800">{selectedRecup.raison}</p>
                      </div>
                    )}
                  </>
                )}

                {(selectedRecup.statut_niveau_1 === 'validee' || selectedRecup.statut_niveau_2 === 'validee') && (
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-orange-900 mb-2">Validations précédentes</h4>
                    {selectedRecup.statut_niveau_1 === 'validee' && (
                      <p className="text-sm text-orange-800">
                        ✓ Niveau 1: {selectedRecup.validateur_n1_prenom} {selectedRecup.validateur_n1_nom}
                        {selectedRecup.date_validation_niveau_1 && (
                          <span className="text-xs ml-2">({formatDateFR(selectedRecup.date_validation_niveau_1)})</span>
                        )}
                      </p>
                    )}
                    {selectedRecup.statut_niveau_2 === 'validee' && (
                      <p className="text-sm text-orange-800 mt-1">
                        ✓ Niveau 2: {selectedRecup.validateur_n2_prenom} {selectedRecup.validateur_n2_nom}
                        {selectedRecup.date_validation_niveau_2 && (
                          <span className="text-xs ml-2">({formatDateFR(selectedRecup.date_validation_niveau_2)})</span>
                        )}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Commentaire (optionnel)</label>
                  <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" rows="3" placeholder="Ajoutez un commentaire..." />
                </div>
              </div>

              <div className="flex gap-2 sm:gap-3 mt-6">
                <button onClick={() => { setSelectedRecup(null); setCommentaire(''); }} className="flex-1 px-3 py-2 text-sm sm:text-base bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium">Annuler</button>
                <button onClick={() => handleValidateRecup(selectedRecup, 'refuser')} className="flex-1 px-3 py-2 text-sm sm:text-base bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium">Refuser</button>
                <button onClick={() => handleValidateRecup(selectedRecup, 'valider')} className="flex-1 px-3 py-2 text-sm sm:text-base bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium">Valider</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ color, title, subtitle, count, icon }) {
  const palette = {
    blue: { bg: 'from-blue-500 to-indigo-500', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
    orange: { bg: 'from-orange-500 to-amber-500', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' },
  }[color];
  return (
    <div className="flex items-center gap-3 mt-2 mb-1">
      <div className={`p-2 rounded-lg bg-gradient-to-br ${palette.bg} text-white shadow-sm`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{icon}</svg>
      </div>
      <div className="flex-1">
        <h2 className={`font-bold text-lg ${palette.text}`}>{title}</h2>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${palette.badge}`}>
        {count}
      </span>
    </div>
  );
}

function RecupCard({ demande, type, onClick }) {
  const isDecl = type === 'declaration';
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-orange-100 border-l-4 border-l-orange-500 p-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-semibold text-gray-900">{demande.prenom} {demande.nom}</p>
          <p className="text-xs text-gray-500">{demande.type_utilisateur}</p>
        </div>
        {demande.validation_info?.isFinal ? (
          <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs font-semibold rounded">Finale</span>
        ) : (
          <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-xs font-semibold rounded">Niv. {demande.validation_info?.level}</span>
        )}
      </div>
      <p className="text-xs uppercase tracking-wide text-orange-700 font-medium mb-1">
        {isDecl ? 'Déclaration d\'heures sup' : 'Utilisation de récupération'}
      </p>
      <div className="text-sm text-gray-700 mb-1">
        {isDecl
          ? formatDateFR(demande.date_travail)
          : `${formatDateFR(demande.date_debut)}${demande.date_debut !== demande.date_fin ? ' → ' + formatDateFR(demande.date_fin) : ''}`}
      </div>
      <div className="flex justify-between items-center mt-3">
        <span className="text-sm font-semibold text-orange-700">{demande.nombre_heures}h</span>
        <button onClick={() => onClick(demande)} className="px-3 py-1.5 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition">
          Examiner
        </button>
      </div>
    </div>
  );
}

function RecupRow({ demande, onClick }) {
  const isDecl = demande.type_demande === 'declaration';
  return (
    <tr className="hover:bg-orange-50/30">
      <td className="px-4 py-3">
        <p className="font-medium">{demande.prenom} {demande.nom}</p>
        <p className="text-xs text-gray-500">{demande.type_utilisateur}</p>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
          isDecl ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
        }`}>
          {isDecl ? 'Déclaration' : 'Utilisation'}
        </span>
        {isDecl && demande.type_compensation && (
          <p className="text-xs text-gray-500 mt-1">
            {demande.type_compensation === 'remuneration' ? 'Rémunération' : 'Récupération'}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-sm">
        {isDecl
          ? formatDateFR(demande.date_travail)
          : `${formatDateFR(demande.date_debut)}${demande.date_debut !== demande.date_fin ? ' → ' + formatDateFR(demande.date_fin) : ''}`}
      </td>
      <td className="px-4 py-3 font-semibold text-orange-700">{demande.nombre_heures}h</td>
      <td className="px-4 py-3 text-sm text-gray-600">{formatDateFR(demande.date_demande)}</td>
      <td className="px-4 py-3 text-sm">
        {demande.validation_info?.isFinal ? (
          <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded">Finale</span>
        ) : (
          <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded">Niveau {demande.validation_info?.level}</span>
        )}
        {demande.statut_niveau_1 === 'validee' && demande.validateur_n1_nom && (
          <p className="text-xs text-gray-500 mt-1">✓ N1: {demande.validateur_n1_prenom} {demande.validateur_n1_nom}</p>
        )}
        {demande.statut_niveau_2 === 'validee' && demande.validateur_n2_nom && (
          <p className="text-xs text-gray-500 mt-1">✓ N2: {demande.validateur_n2_prenom} {demande.validateur_n2_nom}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <button onClick={() => onClick(demande)} className="text-orange-600 hover:text-orange-700 text-sm font-medium">
          Examiner
        </button>
      </td>
    </tr>
  );
}
