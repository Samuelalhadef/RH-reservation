'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { formatDateFR } from '@/lib/clientDateUtils';
import toast from 'react-hot-toast';

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export default function RecuperationPage() {
  const { user, isAuthenticated, isRH } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [demandes, setDemandes] = useState([]);
  const [heuresAcquises, setHeuresAcquises] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [showDocument, setShowDocument] = useState(false);
  const [formData, setFormData] = useState({
    date_travail: '',
    nombre_heures: '',
    raison: '',
    type_compensation: ''
  });
  const [signature, setSignature] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState(null);
  const [selectedDemande, setSelectedDemande] = useState(null);
  const [showUtilForm, setShowUtilForm] = useState(false);
  const [utilData, setUtilData] = useState({ date: '', heure_debut: '', heure_fin: '', raison: '' });
  const [demandesUtil, setDemandesUtil] = useState([]);
  const [heuresUtilisees, setHeuresUtilisees] = useState(0);

  // Nouveaux states UI
  const [activeTab, setActiveTab] = useState('acquises'); // 'acquises' | 'utilisation'
  const [filterStatut, setFilterStatut] = useState('toutes'); // toutes | en_attente | validee | refusee
  const [sortOrder, setSortOrder] = useState('desc'); // desc | asc

  // Signature canvas
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    } else {
      fetchData();
    }
  }, [isAuthenticated, router]);

  const fetchData = async () => {
    try {
      const [recupRes, profileRes, utilRes] = await Promise.all([
        fetch('/api/recuperation').then(r => r.json()),
        fetch('/api/users/profile').then(r => r.json()),
        fetch('/api/recuperation/utilisation').then(r => r.json())
      ]);
      setDemandes(recupRes.demandes || []);
      setHeuresAcquises(recupRes.heures_acquises || 0);
      setProfile(profileRes.user || null);
      setDemandesUtil(utilRes.demandes || []);
      setHeuresUtilisees(utilRes.heures_utilisees || 0);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // --- Signature Canvas Logic ---
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  useEffect(() => {
    if (showDocument) {
      setTimeout(initCanvas, 100);
    }
  }, [showDocument, initCanvas]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    isDrawingRef.current = true;
    lastPosRef.current = getPos(e);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPosRef.current = pos;
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature(null);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let hasContent = false;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] > 0) { hasContent = true; break; }
    }
    if (!hasContent) return null;
    return canvas.toDataURL('image/png');
  };

  const handleShowDocument = () => {
    if (!formData.date_travail || !formData.nombre_heures || !formData.raison || !formData.type_compensation) {
      toast.error('Veuillez remplir tous les champs avant de prévisualiser le document');
      return;
    }
    setShowDocument(true);
  };

  const handleSubmit = async () => {
    const sig = saveSignature();
    if (!sig) {
      toast.error('Veuillez signer le document avant de l\'envoyer');
      return;
    }
    setSignature(sig);
    setSubmitting(true);

    try {
      const response = await fetch('/api/recuperation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          signature: sig,
          document_data: JSON.stringify({
            nom: profile?.nom,
            prenom: profile?.prenom,
            service: profile?.service,
            poste: profile?.poste,
            date_travail: formData.date_travail,
            nombre_heures: formData.nombre_heures,
            raison: formData.raison,
            type_compensation: formData.type_compensation,
            date_signature: new Date().toISOString()
          })
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      toast.success('Demande envoyée avec succès');
      setShowForm(false);
      setShowDocument(false);
      setFormData({ date_travail: '', nombre_heures: '', raison: '', type_compensation: '' });
      setSignature(null);
      fetchData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintDocument = (demande) => {
    setSelectedDemande(demande);
  };

  const formatTypeCompensation = (type) => {
    return type === 'remuneration' ? 'Rémunération' : 'Récupération en congé';
  };

  // --- Filtres + tri + groupement par mois ---
  const groupByMonth = (items, dateField) => {
    const filtered = items.filter(d =>
      filterStatut === 'toutes' ? true : d.statut === filterStatut
    );
    const sorted = [...filtered].sort((a, b) => {
      const da = new Date(a[dateField]).getTime();
      const db = new Date(b[dateField]).getTime();
      return sortOrder === 'desc' ? db - da : da - db;
    });
    const groups = {};
    sorted.forEach(item => {
      const d = new Date(item[dateField]);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      if (!groups[key]) {
        groups[key] = {
          label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
          items: [],
          totalHeures: 0
        };
      }
      groups[key].items.push(item);
      groups[key].totalHeures += Number(item.nombre_heures) || 0;
    });
    return Object.entries(groups).sort((a, b) =>
      sortOrder === 'desc' ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0])
    );
  };

  const demandesGroupees = useMemo(
    () => groupByMonth(demandes, 'date_travail'),
    [demandes, filterStatut, sortOrder]
  );
  const utilisationsGroupees = useMemo(
    () => groupByMonth(demandesUtil, 'date_debut'),
    [demandesUtil, filterStatut, sortOrder]
  );

  const soldeDisponible = heuresAcquises - heuresUtilisees;
  const enAttenteAcquises = demandes.filter(d => d.statut === 'en_attente').length;
  const enAttenteUtil = demandesUtil.filter(d => d.statut === 'en_attente').length;
  const validees = demandes.filter(d => d.statut === 'validee').length;

  // Pourcentage utilisé pour la jauge (max 100)
  const pctUtilise = heuresAcquises > 0
    ? Math.min(100, Math.round((heuresUtilisees / heuresAcquises) * 100))
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <Navbar />
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500">Chargement de vos données…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <Navbar />

      <div className="container mx-auto px-4 sm:px-6 py-6 max-w-6xl">
        {/* ===== HERO ===== */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 text-white shadow-xl mb-6">
          {/* motifs déco */}
          <div className="absolute -top-12 -right-12 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-16 -left-8 w-72 h-72 bg-cyan-300/20 rounded-full blur-3xl"></div>

          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-full text-xs font-medium uppercase tracking-wider">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Heures supplémentaires
                  </span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Récupération</h1>
                <p className="text-white/80 text-sm mt-1.5 max-w-xl">
                  Déclarez vos heures supplémentaires, suivez votre solde et planifiez votre récupération.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => { setShowForm(true); setShowDocument(false); setShowUtilForm(false); }}
                  className="group inline-flex items-center justify-center gap-2 px-5 py-3 bg-white text-blue-700 rounded-xl font-semibold text-sm shadow-lg shadow-black/10 hover:shadow-xl hover:-translate-y-0.5 transition-all"
                >
                  <svg className="w-4 h-4 group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Déclarer des heures
                </button>
                <button
                  onClick={() => { setShowUtilForm(true); setShowForm(false); setShowDocument(false); }}
                  disabled={soldeDisponible <= 0}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white/15 backdrop-blur-sm text-white border border-white/30 rounded-xl font-semibold text-sm hover:bg-white/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Utiliser mes heures
                </button>
              </div>
            </div>

            {/* Solde + Jauge */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-5">
                <p className="text-white/70 text-xs uppercase tracking-widest mb-1">Solde disponible</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl sm:text-6xl font-bold tabular-nums">{soldeDisponible}</span>
                  <span className="text-2xl font-semibold text-white/80">h</span>
                </div>
                <p className="text-white/70 text-sm mt-1">
                  ≈ {(soldeDisponible / 7).toFixed(1)} jour(s) de récupération
                </p>
              </div>

              <div className="md:col-span-7">
                <div className="flex justify-between text-xs text-white/80 mb-2">
                  <span>Utilisées · <strong className="text-white">{heuresUtilisees}h</strong></span>
                  <span>Acquises · <strong className="text-white">{heuresAcquises}h</strong></span>
                </div>
                <div className="h-3 bg-white/15 rounded-full overflow-hidden backdrop-blur-sm">
                  <div
                    className="h-full bg-gradient-to-r from-amber-300 via-orange-300 to-rose-300 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${pctUtilise}%` }}
                  ></div>
                </div>
                <div className="flex gap-3 mt-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-300"></span>
                    <span className="text-white/80">{pctUtilise}% utilisées</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-white/40"></span>
                    <span className="text-white/80">{100 - pctUtilise}% disponibles</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== Stats rapides ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard
            label="Heures acquises"
            value={`${heuresAcquises}h`}
            icon="trending-up"
            tint="blue"
          />
          <StatCard
            label="Heures utilisées"
            value={`${heuresUtilisees}h`}
            icon="check"
            tint="orange"
          />
          <StatCard
            label="En attente"
            value={enAttenteAcquises + enAttenteUtil}
            icon="clock"
            tint="amber"
          />
          <StatCard
            label="Validées"
            value={validees}
            icon="badge"
            tint="emerald"
          />
        </div>

        {/* ===== Formulaire utilisation ===== */}
        {showUtilForm && (
          <UtilisationForm
            soldeDisponible={soldeDisponible}
            utilData={utilData}
            setUtilData={setUtilData}
            submitting={submitting}
            setSubmitting={setSubmitting}
            onClose={() => setShowUtilForm(false)}
            onRefresh={fetchData}
          />
        )}

        {/* ===== Formulaire de déclaration ===== */}
        {showForm && !showDocument && (
          <DeclarationForm
            formData={formData}
            setFormData={setFormData}
            onClose={() => setShowForm(false)}
            onContinue={handleShowDocument}
          />
        )}

        {/* ===== Document officiel + signature ===== */}
        {showDocument && (
          <DocumentSignature
            profile={profile}
            formData={formData}
            canvasRef={canvasRef}
            startDrawing={startDrawing}
            draw={draw}
            stopDrawing={stopDrawing}
            clearSignature={clearSignature}
            submitting={submitting}
            onBack={() => setShowDocument(false)}
            onSubmit={handleSubmit}
          />
        )}

        {/* ===== Onglets ===== */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="border-b border-gray-100 px-2 sm:px-4">
            <nav className="flex gap-1 sm:gap-2 overflow-x-auto">
              <TabButton
                active={activeTab === 'acquises'}
                onClick={() => setActiveTab('acquises')}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                }
                count={demandes.length}
              >
                Mes heures acquises
              </TabButton>
              <TabButton
                active={activeTab === 'utilisation'}
                onClick={() => setActiveTab('utilisation')}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                }
                count={demandesUtil.length}
              >
                Mon utilisation
              </TabButton>
            </nav>
          </div>

          {/* Filtres */}
          <div className="px-4 sm:px-6 py-4 flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50/50">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-1">
              Filtrer
            </span>
            <FilterPill active={filterStatut === 'toutes'} onClick={() => setFilterStatut('toutes')}>
              Toutes
            </FilterPill>
            <FilterPill
              active={filterStatut === 'en_attente'}
              onClick={() => setFilterStatut('en_attente')}
              dot="amber"
            >
              En attente
            </FilterPill>
            <FilterPill
              active={filterStatut === 'validee'}
              onClick={() => setFilterStatut('validee')}
              dot="emerald"
            >
              Validées
            </FilterPill>
            <FilterPill
              active={filterStatut === 'refusee'}
              onClick={() => setFilterStatut('refusee')}
              dot="rose"
            >
              Refusées
            </FilterPill>

            <div className="flex-1"></div>

            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition"
              title="Inverser le tri"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d={sortOrder === 'desc' ? 'M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12' : 'M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4'} />
              </svg>
              {sortOrder === 'desc' ? 'Plus récent' : 'Plus ancien'}
            </button>
          </div>

          {/* Contenu de l'onglet */}
          <div className="p-4 sm:p-6">
            {activeTab === 'acquises' && (
              <DemandesAcquises
                groupes={demandesGroupees}
                onShowDocument={handlePrintDocument}
                formatTypeCompensation={formatTypeCompensation}
              />
            )}
            {activeTab === 'utilisation' && (
              <DemandesUtilisation groupes={utilisationsGroupees} />
            )}
          </div>
        </div>
      </div>

      {/* Modal de visualisation du document */}
      {selectedDemande && (
        <DocumentModal
          demande={selectedDemande}
          profile={profile}
          onClose={() => setSelectedDemande(null)}
        />
      )}
    </div>
  );
}

// =============================================================
// Composants
// =============================================================

function StatCard({ label, value, icon, tint }) {
  const tints = {
    blue: 'from-blue-500/10 to-blue-500/0 text-blue-600 ring-blue-100',
    orange: 'from-orange-500/10 to-orange-500/0 text-orange-600 ring-orange-100',
    amber: 'from-amber-500/10 to-amber-500/0 text-amber-600 ring-amber-100',
    emerald: 'from-emerald-500/10 to-emerald-500/0 text-emerald-600 ring-emerald-100',
  };
  const icons = {
    'trending-up': (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    ),
    check: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    ),
    clock: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
    badge: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    ),
  };
  return (
    <div className={`relative overflow-hidden rounded-xl bg-white ring-1 ${tints[tint].split(' ').slice(2).join(' ')} p-4 shadow-sm`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${tints[tint].split(' ').slice(0, 2).join(' ')} pointer-events-none`}></div>
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${tints[tint].split(' ')[2]}`}>{value}</p>
        </div>
        <div className={`p-2 rounded-lg bg-white/60 ${tints[tint].split(' ')[2]}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {icons[icon]}
          </svg>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, count, children }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
        active
          ? 'text-blue-600 border-blue-600'
          : 'text-gray-500 border-transparent hover:text-gray-800 hover:border-gray-200'
      }`}
    >
      {icon}
      {children}
      {count !== undefined && (
        <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
          active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

function FilterPill({ active, onClick, children, dot }) {
  const dotColors = {
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
    rose: 'bg-rose-500',
  };
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition ${
        active
          ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
          : 'bg-white text-gray-600 hover:text-gray-900 ring-1 ring-gray-200 hover:ring-gray-300'
      }`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[dot]}`}></span>}
      {children}
    </button>
  );
}

function EmptyState({ icon, title, description }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 text-gray-400 mb-3">
        {icon}
      </div>
      <p className="font-medium text-gray-700">{title}</p>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </div>
  );
}

function MonthHeader({ label, totalHeures, count }) {
  return (
    <div className="flex items-center justify-between mb-3 px-1">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{label}</h3>
        <span className="text-xs text-gray-400">·</span>
        <span className="text-xs text-gray-500">{count} demande{count > 1 ? 's' : ''}</span>
      </div>
      <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
        Total · {totalHeures}h
      </span>
    </div>
  );
}

function StatusBadge({ statut }) {
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

function DemandesAcquises({ groupes, onShowDocument, formatTypeCompensation }) {
  if (groupes.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
        title="Aucune demande pour ce filtre"
        description="Cliquez sur « Déclarer des heures » pour ajouter votre première demande."
      />
    );
  }
  return (
    <div className="space-y-6">
      {groupes.map(([key, group]) => (
        <div key={key}>
          <MonthHeader label={group.label} totalHeures={group.totalHeures} count={group.items.length} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {group.items.map(d => (
              <div
                key={d.id}
                className="group relative p-4 bg-white rounded-xl ring-1 ring-gray-100 hover:ring-blue-200 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white shadow-sm">
                      <span className="text-lg font-bold leading-none">{d.nombre_heures}</span>
                      <span className="text-[10px] font-medium uppercase opacity-90">h</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{d.date_travail_fr}</p>
                      <span className={`inline-block mt-1 px-2 py-0.5 text-[11px] font-medium rounded-full ${
                        d.type_compensation === 'remuneration'
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                          : 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
                      }`}>
                        {formatTypeCompensation(d.type_compensation)}
                      </span>
                    </div>
                  </div>
                  <StatusBadge statut={d.statut} />
                </div>

                <p className="text-sm text-gray-600 line-clamp-2 mb-3">{d.raison}</p>

                {d.commentaire && (
                  <div className="mb-3 p-2 bg-gray-50 rounded-lg text-xs text-gray-600 italic border-l-2 border-gray-300">
                    {d.commentaire}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
                  <span>Demande du {d.date_demande_fr}</span>
                  <button
                    onClick={() => onShowDocument(d)}
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Voir le document
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DemandesUtilisation({ groupes }) {
  if (groupes.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        }
        title="Aucune utilisation pour ce filtre"
        description="Utilisez le bouton « Utiliser mes heures » pour poser de la récupération."
      />
    );
  }
  return (
    <div className="space-y-6">
      {groupes.map(([key, group]) => (
        <div key={key}>
          <MonthHeader label={group.label} totalHeures={group.totalHeures} count={group.items.length} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {group.items.map(d => (
              <div
                key={d.id}
                className="group relative p-4 bg-white rounded-xl ring-1 ring-gray-100 hover:ring-orange-200 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center justify-center w-12 h-12 bg-gradient-to-br from-orange-500 to-rose-500 rounded-xl text-white shadow-sm">
                      <span className="text-lg font-bold leading-none">{d.nombre_heures}</span>
                      <span className="text-[10px] font-medium uppercase opacity-90">h</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">
                        {formatDateFR(d.date_debut)}
                        {d.date_debut !== d.date_fin && ` → ${formatDateFR(d.date_fin)}`}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">Récupération posée</p>
                    </div>
                  </div>
                  <StatusBadge statut={d.statut} />
                </div>

                {d.raison && (
                  <p className="text-sm text-gray-600 mt-2 mb-1">{d.raison}</p>
                )}

                {d.commentaire && (
                  <div className="mt-2 p-2 bg-gray-50 rounded-lg text-xs text-gray-600 italic border-l-2 border-gray-300">
                    {d.commentaire}
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

// ---------- Formulaires ----------

function DeclarationForm({ formData, setFormData, onClose, onContinue }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-blue-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-gray-800">Nouvelle déclaration</h2>
              <p className="text-xs text-gray-500">Décrivez les heures supplémentaires effectuées</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white rounded-lg text-gray-500 hover:text-gray-700 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Date du travail supplémentaire
            </label>
            <input
              type="date"
              value={formData.date_travail}
              onChange={(e) => setFormData({ ...formData, date_travail: e.target.value })}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nombre d'heures
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="24"
              value={formData.nombre_heures}
              onChange={(e) => setFormData({ ...formData, nombre_heures: e.target.value })}
              placeholder="Ex : 3.5"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Description du travail effectué
          </label>
          <textarea
            value={formData.raison}
            onChange={(e) => setFormData({ ...formData, raison: e.target.value })}
            rows={3}
            placeholder="Décrivez le travail supplémentaire effectué..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type de compensation
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
              formData.type_compensation === 'recuperation'
                ? 'border-blue-500 bg-blue-50/50 ring-4 ring-blue-100'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}>
              <input
                type="radio"
                name="type_compensation"
                value="recuperation"
                checked={formData.type_compensation === 'recuperation'}
                onChange={(e) => setFormData({ ...formData, type_compensation: e.target.value })}
                className="mt-0.5 w-4 h-4 text-blue-600"
              />
              <div>
                <p className="font-semibold text-gray-800 text-sm">Récupération en congé</p>
                <p className="text-xs text-gray-500 mt-0.5">Convertir en heures/jours de récupération</p>
              </div>
            </label>

            <label className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
              formData.type_compensation === 'remuneration'
                ? 'border-emerald-500 bg-emerald-50/50 ring-4 ring-emerald-100'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}>
              <input
                type="radio"
                name="type_compensation"
                value="remuneration"
                checked={formData.type_compensation === 'remuneration'}
                onChange={(e) => setFormData({ ...formData, type_compensation: e.target.value })}
                className="mt-0.5 w-4 h-4 text-emerald-600"
              />
              <div>
                <p className="font-semibold text-gray-800 text-sm">Rémunération</p>
                <p className="text-xs text-gray-500 mt-0.5">Être payé pour les heures supplémentaires</p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium transition"
          >
            Annuler
          </button>
          <button
            onClick={onContinue}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition"
          >
            Générer le document officiel
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function UtilisationForm({ soldeDisponible, utilData, setUtilData, submitting, setSubmitting, onClose, onRefresh }) {
  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + 7);
  const minDateStr = minDate.toISOString().split('T')[0];

  const calcHeures = (hd, hf) => {
    if (!hd || !hf) return 0;
    const [h1, m1] = hd.split(':').map(Number);
    const [h2, m2] = hf.split(':').map(Number);
    const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    return diff > 0 ? Math.round(diff / 30) * 0.5 : 0;
  };
  const heuresDemandees = calcHeures(utilData.heure_debut, utilData.heure_fin);

  const timeOptions = Array.from({ length: 27 }, (_, i) => {
    const h = Math.floor((i + 14) / 2);
    const m = (i + 14) % 2 === 0 ? '00' : '30';
    if (h > 19) return null;
    return `${String(h).padStart(2, '0')}:${m}`;
  }).filter(Boolean);

  const handleSubmit = async () => {
    if (!utilData.date || !utilData.heure_debut || !utilData.heure_fin) {
      toast.error('Veuillez remplir la date et les heures');
      return;
    }
    if (heuresDemandees <= 0) {
      toast.error('L\'heure de fin doit être après l\'heure de début');
      return;
    }
    if (heuresDemandees > soldeDisponible) {
      toast.error('Solde insuffisant');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/recuperation/utilisation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_debut: utilData.date,
          date_fin: utilData.date,
          nombre_heures: heuresDemandees,
          raison: utilData.raison ? `${utilData.raison} (${utilData.heure_debut} - ${utilData.heure_fin})` : `${utilData.heure_debut} - ${utilData.heure_fin}`
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success('Demande d\'utilisation envoyée');
      onClose();
      setUtilData({ date: '', heure_debut: '', heure_fin: '', raison: '' });
      onRefresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="bg-gradient-to-r from-orange-50 to-rose-50 px-6 py-4 border-b border-orange-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-600 rounded-lg text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-gray-800">Utiliser mes heures</h2>
              <p className="text-xs text-gray-500">Planifier une récupération</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white rounded-lg text-gray-500 hover:text-gray-700 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-5">
        <div className="flex items-start gap-3 bg-orange-50 border border-orange-100 rounded-xl p-4">
          <svg className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm">
            <p className="text-orange-900 font-medium">
              Solde disponible · <span className="font-bold">{soldeDisponible}h</span>
              <span className="text-orange-700 font-normal"> ({(soldeDisponible / 7).toFixed(1)} jour(s))</span>
            </p>
            <p className="text-xs text-orange-700 mt-1">
              La récupération doit être posée au minimum 7 jours à l'avance.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date *</label>
            <input
              type="date"
              value={utilData.date}
              onChange={(e) => setUtilData({ ...utilData, date: e.target.value })}
              min={minDateStr}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Début *</label>
            <select
              value={utilData.heure_debut}
              onChange={(e) => setUtilData({ ...utilData, heure_debut: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
            >
              <option value="">-- Choisir --</option>
              {timeOptions.map(val => <option key={val} value={val}>{val}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fin *</label>
            <select
              value={utilData.heure_fin}
              onChange={(e) => setUtilData({ ...utilData, heure_fin: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
            >
              <option value="">-- Choisir --</option>
              {timeOptions.map(val => <option key={val} value={val}>{val}</option>)}
            </select>
          </div>
        </div>

        {heuresDemandees > 0 && (
          <div className={`flex items-center gap-3 p-4 rounded-xl ${
            heuresDemandees > soldeDisponible
              ? 'bg-rose-50 border border-rose-200 text-rose-800'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          }`}>
            <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${
              heuresDemandees > soldeDisponible ? 'bg-rose-100' : 'bg-emerald-100'
            }`}>
              <span className="font-bold text-sm">{heuresDemandees}h</span>
            </div>
            <div className="text-sm">
              <p className="font-medium">
                Durée demandée : {utilData.heure_debut} → {utilData.heure_fin}
              </p>
              {heuresDemandees > soldeDisponible && (
                <p className="text-xs mt-0.5">Solde insuffisant.</p>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Motif (optionnel)</label>
          <input
            type="text"
            value={utilData.raison}
            onChange={(e) => setUtilData({ ...utilData, raison: e.target.value })}
            placeholder="Ex : Rendez-vous personnel"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium transition"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || heuresDemandees <= 0 || heuresDemandees > soldeDisponible}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {submitting ? 'Envoi…' : `Utiliser ${heuresDemandees || 0}h`}
          </button>
        </div>
      </div>
    </div>
  );
}

function DocumentSignature({ profile, formData, canvasRef, startDrawing, draw, stopDrawing, clearSignature, submitting, onBack, onSubmit }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-4 border-b border-indigo-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-gray-800">Document officiel</h2>
              <p className="text-xs text-gray-500">Signature requise pour valider</p>
            </div>
          </div>
          <button onClick={onBack} className="p-1.5 hover:bg-white rounded-lg text-gray-500 hover:text-gray-700 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-6">
        <div id="document-officiel" className="border-2 border-gray-200 rounded-xl p-6 sm:p-8 mb-6 bg-white">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <img src="/images/logo.png" alt="Logo" loading="lazy" decoding="async" width={64} height={64} className="w-16 h-16 object-contain" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 uppercase tracking-wide">
              Commune de Chartrettes
            </h3>
            <p className="text-sm text-gray-600 mt-1">Service des Ressources Humaines</p>
            <div className="w-24 h-0.5 bg-gray-400 mx-auto mt-3"></div>
          </div>

          <h4 className="text-center text-lg font-bold text-gray-800 mb-6 uppercase">
            Demande de {formData.type_compensation === 'remuneration' ? 'Rémunération' : 'Récupération'} d'Heures Supplémentaires
          </h4>

          <div className="space-y-4 text-sm text-gray-700">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
              <div><span className="font-semibold">Nom :</span> {profile?.nom || ''}</div>
              <div><span className="font-semibold">Prénom :</span> {profile?.prenom || ''}</div>
              <div><span className="font-semibold">Service :</span> {profile?.service || 'Non renseigné'}</div>
              <div><span className="font-semibold">Poste :</span> {profile?.poste || 'Non renseigné'}</div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <p className="mb-3">
                Je soussigné(e) <span className="font-semibold">{profile?.prenom} {profile?.nom}</span>,
                déclare avoir effectué des heures de travail supplémentaires dans les conditions suivantes :
              </p>
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <p><span className="font-semibold">Date du travail supplémentaire :</span> {formData.date_travail ? formatDateFR(formData.date_travail) : ''}</p>
                <p><span className="font-semibold">Nombre d'heures effectuées :</span> {formData.nombre_heures} heure(s)</p>
                <p><span className="font-semibold">Nature du travail :</span> {formData.raison}</p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <p className="mb-2"><span className="font-semibold">Compensation demandée :</span></p>
              <div className="flex items-center gap-2 ml-4">
                <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${
                  formData.type_compensation === 'recuperation' ? 'border-blue-500 bg-blue-500' : 'border-gray-400'
                }`}>
                  {formData.type_compensation === 'recuperation' && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span>Récupération en jours de congé</span>
              </div>
              <div className="flex items-center gap-2 ml-4 mt-1">
                <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${
                  formData.type_compensation === 'remuneration' ? 'border-emerald-500 bg-emerald-500' : 'border-gray-400'
                }`}>
                  {formData.type_compensation === 'remuneration' && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span>Rémunération des heures supplémentaires</span>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 mt-4">
              <p className="text-xs text-gray-500 italic mb-4">
                En signant ce document, je certifie sur l'honneur l'exactitude des informations ci-dessus
                et demande le traitement de ma requête conformément à la réglementation en vigueur.
              </p>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-sm font-semibold">Fait à Chartrettes,</p>
                  <p className="text-sm">Le {formatDateFR(new Date().toISOString())}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold mb-1">Signature de l'agent</p>
                  <div className="w-48 h-0.5 bg-gray-400"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-2 border-dashed border-indigo-300 bg-indigo-50/30 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <p className="text-sm font-medium text-gray-700">
              Signez avec la souris ou le doigt
            </p>
          </div>
          <canvas
            ref={canvasRef}
            className="w-full border border-gray-200 rounded-lg bg-white cursor-crosshair touch-none"
            style={{ height: '150px' }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          <div className="flex justify-between mt-2">
            <button onClick={clearSignature} className="text-sm text-rose-600 hover:text-rose-700 font-medium">
              Effacer la signature
            </button>
            <p className="text-xs text-gray-500">La signature est obligatoire</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <button
            onClick={onBack}
            className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
          >
            Retour au formulaire
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition text-sm font-semibold disabled:opacity-50 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {submitting ? 'Envoi en cours…' : 'Signer et envoyer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Document modal (visualisation existante, inchangée) ----------

function DocumentModal({ demande, profile, onClose }) {
  const documentRef = useRef(null);

  const handlePrint = () => {
    const content = documentRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Demande de récupération - ${demande.nom || profile?.nom} ${demande.prenom || profile?.prenom} - ${demande.date_travail_fr}</title>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #1a1a2e; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { font-size: 20px; text-transform: uppercase; letter-spacing: 2px; margin: 0; }
          .header p { font-size: 14px; color: #555; margin: 5px 0; }
          .separator { width: 100px; height: 2px; background: #555; margin: 15px auto; }
          .title { text-align: center; font-size: 16px; font-weight: bold; text-transform: uppercase; margin: 30px 0; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .info-grid span { font-weight: bold; }
          .section { margin: 20px 0; padding-top: 15px; border-top: 1px solid #ddd; }
          .detail-box { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0; }
          .checkbox-line { display: flex; align-items: center; gap: 8px; margin: 5px 0 5px 20px; }
          .checkbox { width: 14px; height: 14px; border: 2px solid #555; display: inline-block; text-align: center; line-height: 12px; font-size: 10px; }
          .checkbox.checked { background: #333; color: white; }
          .footer { display: flex; justify-content: space-between; margin-top: 40px; }
          .signature-area { text-align: center; }
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
          <div><span>Nom :</span> ${demande.nom || profile?.nom || ''}</div>
          <div><span>Prénom :</span> ${demande.prenom || profile?.prenom || ''}</div>
          <div><span>Service :</span> ${demande.service || profile?.service || 'Non renseigné'}</div>
          <div><span>Poste :</span> ${demande.poste || profile?.poste || 'Non renseigné'}</div>
        </div>
        <div class="section">
          <p>Je soussigné(e) <strong>${demande.prenom || profile?.prenom || ''} ${demande.nom || profile?.nom || ''}</strong>,
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
        <p class="disclaimer">En signant ce document, je certifie sur l'honneur l'exactitude des informations ci-dessus
        et demande le traitement de ma requête conformément à la réglementation en vigueur.</p>
        <div class="footer">
          <div>
            <p><strong>Fait à Chartrettes,</strong></p>
            <p>Le ${demande.date_demande_fr}</p>
          </div>
          <div class="signature-area">
            <p><strong>Signature de l'agent</strong></p>
            ${demande.signature ? `<img src="${demande.signature}" alt="Signature" />` : '<div style="width:200px;height:1px;background:#555;margin-top:40px"></div>'}
          </div>
        </div>
        ${demande.statut !== 'en_attente' ? `
          <div class="stamp ${demande.statut === 'validee' ? 'validated' : 'refused'}">
            ${demande.statut === 'validee' ? 'VALIDEE' : 'REFUSEE'}
            ${demande.date_validation_fr ? ` - Le ${demande.date_validation_fr}` : ''}
            ${demande.validateur_prenom ? ` - Par ${demande.validateur_prenom} ${demande.validateur_nom}` : ''}
          </div>
        ` : ''}
        ${demande.commentaire ? `<p style="margin-top:15px;font-style:italic;color:#555"><strong>Commentaire :</strong> ${demande.commentaire}</p>` : ''}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex justify-between items-center z-10">
          <h3 className="font-bold text-gray-800">Document officiel</h3>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimer / PDF
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div ref={documentRef} className="p-6 sm:p-8">
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 uppercase tracking-wide">
              Commune de Chartrettes
            </h3>
            <p className="text-sm text-gray-600 mt-1">Service des Ressources Humaines</p>
            <div className="w-24 h-0.5 bg-gray-400 mx-auto mt-3"></div>
          </div>

          <h4 className="text-center text-base font-bold text-gray-800 mb-6 uppercase">
            Demande de {demande.type_compensation === 'remuneration' ? 'Rémunération' : 'Récupération'} d'Heures Supplémentaires
          </h4>

          <div className="grid grid-cols-2 gap-2 bg-gray-50 p-4 rounded-lg text-sm mb-4">
            <p><span className="font-semibold">Nom :</span> {demande.nom || profile?.nom}</p>
            <p><span className="font-semibold">Prénom :</span> {demande.prenom || profile?.prenom}</p>
            <p><span className="font-semibold">Service :</span> {demande.service || profile?.service || 'Non renseigné'}</p>
            <p><span className="font-semibold">Poste :</span> {demande.poste || profile?.poste || 'Non renseigné'}</p>
          </div>

          <div className="border-t border-gray-200 pt-4 text-sm space-y-3">
            <p>
              Je soussigné(e) <strong>{demande.prenom || profile?.prenom} {demande.nom || profile?.nom}</strong>,
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
              demande.statut === 'validee'
                ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
                : 'border-rose-500 text-rose-600 bg-rose-50'
            }`}>
              {demande.statut === 'validee' ? 'VALIDÉE' : 'REFUSÉE'}
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
