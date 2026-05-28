'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { formatDateFR, formatStatus, getStatusColor } from '@/lib/clientDateUtils';
import toast from 'react-hot-toast';

// Composant pour afficher le circuit de validation détaillé
const ValidationCircuit = ({ leave }) => {
  const { statut, validation_info } = leave;
  const circuit = validation_info?.circuit;
  const pendingValidation = validation_info?.pending_validation;

  // Construire les étapes basées sur le circuit réel
  const buildSteps = () => {
    const steps = [
      {
        id: 'demande',
        label: 'Demande créée',
        status: 'completed',
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
      }
    ];

    // Ajouter les niveaux du circuit s'ils existent
    if (circuit?.niveaux) {
      const n1 = circuit.niveaux.find(n => n.niveau === 1);
      const n2 = circuit.niveaux.find(n => n.niveau === 2);

      if (n1) {
        const isValidated = validation_info?.validated_n1;
        const isPending = pendingValidation?.niveau === 1;
        steps.push({
          id: 'n1',
          label: n1.validateur_prenom ? `${n1.validateur_prenom} ${n1.validateur_nom}` : 'Responsable',
          sublabel: 'N+1',
          status: statut === 'refusee' && !isValidated ? 'rejected' : isValidated ? 'completed' : isPending ? 'current' : 'pending',
          icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
        });
      }

      if (n2) {
        const isValidated = validation_info?.validated_n2;
        const isPending = pendingValidation?.niveau === 2;
        steps.push({
          id: 'n2',
          label: n2.validateur_prenom ? `${n2.validateur_prenom} ${n2.validateur_nom}` : 'Direction',
          sublabel: 'N+2',
          status: statut === 'refusee' && !isValidated && validation_info?.validated_n1 ? 'rejected' : isValidated ? 'completed' : isPending ? 'current' : 'pending',
          icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
        });
      }
    }

    // Toujours ajouter RH à la fin
    const isRHPending = pendingValidation?.niveau === 'rh';
    const isRHStep = statut !== 'en_attente';
    steps.push({
      id: 'rh',
      label: 'Service RH',
      sublabel: 'Final',
      status: statut === 'validee' ? 'completed' : statut === 'refusee' && isRHStep ? 'rejected' : isRHPending ? 'current' : 'pending',
      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
    });

    return steps;
  };

  const steps = buildSteps();

  const getStepColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-500 text-white';
      case 'current': return 'bg-yellow-500 text-white animate-pulse';
      case 'rejected': return 'bg-red-500 text-white';
      default: return 'bg-gray-200 text-gray-400';
    }
  };

  const getLineColor = (currentStep, nextStep) => {
    if (currentStep.status === 'completed' && (nextStep.status === 'completed' || nextStep.status === 'current')) {
      return 'bg-green-500';
    }
    if (currentStep.status === 'completed' && nextStep.status === 'rejected') {
      return 'bg-red-500';
    }
    return 'bg-gray-200';
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center" title={`${step.label}${step.sublabel ? ` (${step.sublabel})` : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${getStepColor(step.status)}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={step.icon} />
                </svg>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className={`w-4 h-1 ${getLineColor(step, steps[index + 1])}`} />
            )}
          </div>
        ))}
      </div>
      {/* Afficher où ça bloque */}
      {statut === 'en_attente' && pendingValidation && (
        <div className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded mt-1">
          <span className="font-semibold">En attente : </span>
          {pendingValidation.validateur || pendingValidation.type}
        </div>
      )}
    </div>
  );
};

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center text-gray-400 text-sm">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <Navbar />

      <div className="container mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* HERO bleu */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 via-sky-500 to-cyan-500 text-white shadow-xl">
          <div className="absolute -top-16 -right-12 w-72 h-72 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-20 -left-12 w-80 h-80 bg-sky-300/20 rounded-full blur-3xl"></div>
          <div className="relative p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-full text-xs font-medium uppercase tracking-wider">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Historique
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Mes demandes de congés</h1>
            <p className="text-white/80 text-sm mt-1.5 max-w-2xl">
              Suivez l&apos;avancée et l&apos;historique complet de vos demandes.
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
              <MesDemHeroStat label="Total" value={stats.total} icon="folder" />
              <MesDemHeroStat label="En attente" value={stats.enAttente} icon="clock" highlight={stats.enAttente > 0} />
              <MesDemHeroStat label="Validées" value={stats.validee} icon="check" />
              <MesDemHeroStat label="Refusées" value={stats.refusee} icon="cross" />
            </div>
          </div>
        </div>

        {/* Card principale avec filtres + légende */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3 border-b border-gray-100 bg-gray-50/50">
            <div className="flex flex-wrap items-center gap-2">
              <FiltrePill active={filterStatus === 'all'} onClick={() => setFilterStatus('all')}>Toutes <span className="opacity-60 ml-1">({stats.total})</span></FiltrePill>
              <FiltrePill active={filterStatus === 'en_attente'} onClick={() => setFilterStatus('en_attente')} dot="amber">En attente <span className="opacity-60 ml-1">({stats.enAttente})</span></FiltrePill>
              <FiltrePill active={filterStatus === 'validee'} onClick={() => setFilterStatus('validee')} dot="emerald">Validées <span className="opacity-60 ml-1">({stats.validee})</span></FiltrePill>
              <FiltrePill active={filterStatus === 'refusee'} onClick={() => setFilterStatus('refusee')} dot="rose">Refusées <span className="opacity-60 ml-1">({stats.refusee})</span></FiltrePill>
            </div>
            <div className="hidden lg:flex flex-wrap items-center gap-3 ml-auto text-xs">
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-green-500 rounded-full"></span><span className="text-gray-500">Validé</span></span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-yellow-500 rounded-full"></span><span className="text-gray-500">Bloqué</span></span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-red-500 rounded-full"></span><span className="text-gray-500">Refusé</span></span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-gray-300 rounded-full"></span><span className="text-gray-500">À venir</span></span>
            </div>
          </div>
          <div className="bg-white">
        {/* Liste des demandes */}
        <div className="bg-white">
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
            <>
              {/* Vue mobile : cartes */}
              <div className="md:hidden divide-y divide-gray-200">
                {filteredLeaves.map((leave) => (
                  <div key={leave.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {formatDateFR(leave.date_debut)} — {formatDateFR(leave.date_fin)}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {leave.nombre_jours_ouvres} jour{leave.nombre_jours_ouvres > 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(leave.statut)}`}>
                        {formatStatus(leave.statut)}
                      </span>
                    </div>
                    {leave.motif && (
                      <p className="text-xs text-gray-600 mb-2">{leave.motif}</p>
                    )}
                    <div className="flex justify-between items-center">
                      <ValidationCircuit leave={leave} />
                      {leave.statut === 'en_attente' && new Date(leave.date_debut) >= new Date(new Date().setHours(0,0,0,0)) && (
                        <button
                          onClick={() => handleDeleteLeave(leave.id, leave.date_debut)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Supprimer"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Vue desktop : tableau */}
              <div className="hidden md:block overflow-x-auto">
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
                        Circuit de validation
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Statut
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
                        <td className="px-6 py-4">
                          <ValidationCircuit leave={leave} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(leave.statut)}`}>
                            {formatStatus(leave.statut)}
                          </span>
                          {leave.statut === 'en_attente' ? (
                            <div className="text-xs text-gray-500 mt-1">
                              En attente de validation
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 mt-1">
                              {leave.validateur_nom && (
                                <span>Par {leave.validateur_prenom} {leave.validateur_nom}</span>
                              )}
                              {leave.date_validation && (
                                <span className="block">Le {formatDateFR(leave.date_validation)}</span>
                              )}
                            </div>
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
            </>
          )}
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MesDemHeroStat({ label, value, icon, highlight }) {
  const icons = {
    folder: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
    clock: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
    check: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
    cross: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />,
  };
  return (
    <div className={`relative bg-white/15 backdrop-blur-sm rounded-xl p-3 border ${highlight ? 'border-white/40 ring-2 ring-white/30' : 'border-white/20'}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <svg className="w-3.5 h-3.5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">{icons[icon]}</svg>
        <p className="text-[10px] uppercase tracking-wider text-white/70 font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function FiltrePill({ active, onClick, children, dot }) {
  const dotColors = { amber: 'bg-amber-500', emerald: 'bg-emerald-500', rose: 'bg-rose-500' };
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
        active
          ? 'bg-blue-600 text-white shadow-sm'
          : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
      }`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white/80' : dotColors[dot]}`}></span>}
      {children}
    </button>
  );
}
