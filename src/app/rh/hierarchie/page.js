'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import toast from 'react-hot-toast';
import { buildHierarchyContext, computeIntermediateSteps, isAncestor, isRHType } from '@/lib/circuit';

// Couleurs des échelons (cycle) — sommet RH et base ont leur propre teinte
const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444'];
const RH_COLOR = '#be123c';
const BASE_COLOR = '#64748b';

const DEFAULT_NAMES = {
  1: ['Responsables'],
  2: ['Direction', 'Responsables de service'],
  3: ['Direction', 'Chefs de service', "Responsables d'équipe"],
};

const initials = (p) => `${(p.prenom || '?')[0] || ''}${(p.nom || '')[0] || ''}`.toUpperCase();
const fullName = (p) => (p ? `${p.prenom} ${p.nom}` : '');
const shortName = (p) => (p ? `${(p.prenom || '')[0] || ''}. ${p.nom}` : '');
const snapshot = (echelons, people) =>
  JSON.stringify({
    e: echelons.map((e) => [e.id, e.nom.trim(), e.valide]),
    p: Object.values(people)
      .map((p) => [p.id, p.responsable_id ?? null, p.echelon_id ?? null])
      .sort((a, b) => a[0] - b[0]),
  });

export default function HierarchiePage() {
  const { isRH, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [echelons, setEchelons] = useState([]); // haut → bas, sous la RH
  const [people, setPeople] = useState({}); // id → agent
  const [initialSnapshot, setInitialSnapshot] = useState('');
  const [initialData, setInitialData] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [hoverTarget, setHoverTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [editingEchelon, setEditingEchelon] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const isRHUser = isRH();

  // ---------------------------------------------------------------- chargement
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hierarchie', { cache: 'no-store' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      const map = {};
      for (const u of data.users) map[u.id] = { ...u };
      setEchelons(data.echelons);
      setPeople(map);
      setInitialData({ echelons: data.echelons, people: map });
      setInitialSnapshot(snapshot(data.echelons, map));
    } catch (e) {
      toast.error(e.message || 'Impossible de charger la hiérarchie');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push('/'); return; }
    if (!isRHUser) { router.push('/dashboard'); return; }
    load();
  }, [authLoading, isAuthenticated, isRHUser, router, load]);

  const dirty = !loading && initialSnapshot !== '' && snapshot(echelons, people) !== initialSnapshot;

  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // ---------------------------------------------------------------- calculs dérivés
  const ctx = useMemo(() => buildHierarchyContext(Object.values(people), echelons), [people, echelons]);

  const echelonIndex = useMemo(() => new Map(echelons.map((e, i) => [e.id, i])), [echelons]);

  // Rangée d'une personne : 0 = sommet RH, 1..n = échelons, n+1 = base
  const rowOf = useCallback((p) => {
    if (!p) return -1;
    if (isRHType(p.type_utilisateur)) return 0;
    const idx = p.echelon_id != null ? echelonIndex.get(p.echelon_id) : undefined;
    return idx === undefined ? echelons.length + 1 : idx + 1;
  }, [echelonIndex, echelons.length]);

  const rows = useMemo(() => {
    const list = [
      { key: 'rh', kind: 'rh', nom: 'RH / Direction générale', color: RH_COLOR, members: [] },
      ...echelons.map((e, i) => ({ key: `e:${e.id}`, kind: 'echelon', echelon: e, nom: e.nom, color: PALETTE[i % PALETTE.length], members: [] })),
      { key: 'base', kind: 'base', nom: 'Agents', color: BASE_COLOR, members: [] },
    ];
    for (const p of Object.values(people)) list[rowOf(p)].members.push(p);
    for (const r of list) r.members.sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr'));
    return list;
  }, [people, echelons, rowOf]);

  const childrenOf = useMemo(() => {
    const m = new Map();
    for (const p of Object.values(people)) {
      if (p.responsable_id == null) continue;
      if (!m.has(p.responsable_id)) m.set(p.responsable_id, []);
      m.get(p.responsable_id).push(p);
    }
    return m;
  }, [people]);

  const circuits = useMemo(() => {
    const m = new Map();
    for (const p of Object.values(people)) {
      if (isRHType(p.type_utilisateur)) continue;
      try { m.set(p.id, computeIntermediateSteps(p.id, ctx)); } catch { m.set(p.id, []); }
    }
    return m;
  }, [people, ctx]);

  // Pour chaque validateur : agents pour lesquels il intervient, et à quel niveau
  const validatesFor = useMemo(() => {
    const m = new Map();
    for (const [agentId, steps] of circuits) {
      for (const s of steps) {
        if (!m.has(s.validateur_id)) m.set(s.validateur_id, []);
        m.get(s.validateur_id).push({ agentId, niveau: s.niveau });
      }
    }
    return m;
  }, [circuits]);

  // Responsable placé au même niveau ou plus bas que son agent
  const inverted = useMemo(() => {
    const set = new Set();
    for (const p of Object.values(people)) {
      if (isRHType(p.type_utilisateur) || p.responsable_id == null) continue;
      const resp = people[p.responsable_id];
      if (!resp || isRHType(resp.type_utilisateur)) continue;
      if (rowOf(resp) >= rowOf(p)) set.add(p.id);
    }
    return set;
  }, [people, rowOf]);

  // Personnes qui valident réellement des demandes mais restent dans la rangée « Agents »
  const unranked = useMemo(() => {
    const set = new Set();
    for (const id of validatesFor.keys()) {
      const p = people[id];
      if (p && !isRHType(p.type_utilisateur) && rowOf(p) === echelons.length + 1) set.add(id);
    }
    return set;
  }, [validatesFor, people, rowOf, echelons.length]);

  // Numéro d'étape de chaque échelon validant (étape 1 = le plus proche des agents)
  const stepOfEchelon = useMemo(() => {
    const m = new Map();
    let n = 0;
    for (let i = echelons.length - 1; i >= 0; i--) if (echelons[i].valide) m.set(echelons[i].id, ++n);
    return m;
  }, [echelons]);

  const stats = useMemo(() => {
    let longest = 0;
    for (const steps of circuits.values()) longest = Math.max(longest, steps.length);
    return {
      echelons: echelons.length,
      validants: echelons.filter((e) => e.valide).length,
      longest,
      alerts: inverted.size + unranked.size,
    };
  }, [circuits, echelons, inverted, unranked]);

  // Mise en évidence autour de la personne sélectionnée
  const related = useMemo(() => {
    if (!selectedId) return null;
    const up = new Set();
    let cur = people[selectedId]?.responsable_id;
    while (cur != null && !up.has(cur)) { up.add(cur); cur = people[cur]?.responsable_id; }
    const down = new Set((childrenOf.get(selectedId) || []).map((c) => c.id));
    return { up, down };
  }, [selectedId, people, childrenOf]);

  const searchMatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return new Set(
      Object.values(people)
        .filter((p) => `${p.prenom} ${p.nom} ${p.poste || ''} ${p.service || ''}`.toLowerCase().includes(q))
        .map((p) => p.id)
    );
  }, [search, people]);

  // ---------------------------------------------------------------- actions
  const updatePerson = (id, patch) => setPeople((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const echelonIdForRow = (rowIdx) => (rowIdx >= 1 && rowIdx <= echelons.length ? echelons[rowIdx - 1].id : null);

  const moveToRow = (personId, row) => {
    const p = people[personId];
    if (!p) return;
    if (isRHType(p.type_utilisateur)) {
      toast('Les profils RH / Direction restent au sommet : ils valident toujours en dernier.', { icon: 'ℹ️' });
      return;
    }
    const target = row.kind === 'base' ? null : row.echelon.id;
    if ((p.echelon_id ?? null) === target) return;
    updatePerson(personId, { echelon_id: target });
  };

  const attachTo = (personId, targetId) => {
    const p = people[personId];
    const target = people[targetId];
    if (!p || !target || personId === targetId) return;
    if (isRHType(p.type_utilisateur)) {
      toast('Les profils RH / Direction n\'ont pas de responsable dans le parcours.', { icon: 'ℹ️' });
      return;
    }
    if (isAncestor(personId, targetId, ctx)) {
      toast.error(`Impossible : ${fullName(target)} est déjà sous la responsabilité de ${fullName(p)}.`);
      return;
    }
    const patch = { responsable_id: targetId };
    let targetRow = rowOf(target);
    // Un agent de la base qui reçoit un subordonné devient valideur : il monte dans l'échelon validant le plus bas
    if (!isRHType(target.type_utilisateur) && targetRow === echelons.length + 1) {
      const lowest = [...echelons].reverse().find((e) => e.valide);
      if (lowest) {
        updatePerson(targetId, { echelon_id: lowest.id });
        targetRow = echelonIndex.get(lowest.id) + 1;
      }
    }
    // Garder la pyramide cohérente : l'agent passe sous le niveau de son responsable
    if (!isRHType(target.type_utilisateur) && rowOf(p) <= targetRow) {
      patch.echelon_id = echelonIdForRow(targetRow + 1);
    }
    updatePerson(personId, patch);
    toast.success(`${fullName(p)} → sous la responsabilité de ${fullName(target)}`);
  };

  const detach = (personId) => {
    const p = people[personId];
    if (!p || p.responsable_id == null) return;
    updatePerson(personId, { responsable_id: null });
    toast.success(`${fullName(p)} n'a plus de responsable : validation directe par la RH`);
  };

  const addEchelon = () => {
    const id = `new-${Date.now()}`;
    setEchelons((prev) => [...prev, { id, nom: 'Nouvel échelon', valide: true }]);
    setEditingEchelon(id);
    setEditingName('Nouvel échelon');
  };

  const commitRename = () => {
    const nom = editingName.trim();
    if (nom) setEchelons((prev) => prev.map((e) => (e.id === editingEchelon ? { ...e, nom: nom.slice(0, 60) } : e)));
    setEditingEchelon(null);
  };

  const toggleValide = (id) => setEchelons((prev) => prev.map((e) => (e.id === id ? { ...e, valide: !e.valide } : e)));

  const moveEchelon = (idx, dir) => {
    setEchelons((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const deleteEchelon = (id) => {
    const idx = echelons.findIndex((e) => e.id === id);
    const below = echelons[idx + 1]?.id ?? null; // les membres descendent d'un cran
    setPeople((prev) => {
      const next = { ...prev };
      for (const p of Object.values(prev)) if (p.echelon_id === id) next[p.id] = { ...p, echelon_id: below };
      return next;
    });
    setEchelons((prev) => prev.filter((e) => e.id !== id));
    setConfirmDelete(null);
  };

  // Range la pyramide d'après le parcours réel : chaque valideur est placé selon le nombre de
  // valideurs au-dessus de lui. Les échelons « hors parcours » et leurs membres sont conservés.
  const autoGenerate = () => {
    const validators = [...validatesFor.keys()].map((id) => people[id]).filter((p) => p && !isRHType(p.type_utilisateur));
    if (validators.length === 0) {
      toast('Aucun responsable saisi pour l\'instant : glissez les agents sur leur responsable.', { icon: 'ℹ️' });
      return;
    }
    const kept = echelons.filter((e) => !e.valide);
    const keptIds = new Set(kept.map((e) => e.id));
    const depths = new Map(validators.map((v) => [v.id, (circuits.get(v.id) || []).length]));
    const levels = [...new Set(depths.values())].sort((a, b) => a - b);
    // Réutilise les échelons validants existants (et leurs noms) s'il y en a autant que de niveaux
    const existing = echelons.filter((e) => e.valide);
    const reuse = existing.length === levels.length;
    const names = reuse ? existing.map((e) => e.nom) : DEFAULT_NAMES[levels.length] || [];
    const stamp = Date.now();
    const generated = levels.map((_, i) => ({
      id: reuse ? existing[i].id : `new-${stamp}-${i}`,
      nom: names[i] || `Échelon ${i + 1}`,
      valide: true,
    }));
    setEchelons([...kept, ...generated]);
    setPeople((prev) => {
      const next = {};
      for (const p of Object.values(prev)) {
        if (p.echelon_id != null && keptIds.has(p.echelon_id)) { next[p.id] = p; continue; }
        const d = depths.get(p.id);
        next[p.id] = { ...p, echelon_id: d === undefined ? null : generated[levels.indexOf(d)].id };
      }
      return next;
    });
    toast.success(`Pyramide rangée d'après le parcours : ${levels.length} échelon(s) validant(s) — vérifiez puis enregistrez.`);
  };

  const reset = () => {
    if (!initialData) return;
    setEchelons(initialData.echelons);
    setPeople(initialData.people);
    setSelectedId(null);
    setEditingEchelon(null);
    setConfirmDelete(null);
  };

  const save = async () => {
    if (editingEchelon) commitRename();
    setSaving(true);
    try {
      const res = await fetch('/api/hierarchie', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          echelons: echelons.map((e) => ({ id: e.id, nom: e.nom, valide: e.valide })),
          assignments: Object.values(people).map((p) => ({ id: p.id, responsable_id: p.responsable_id ?? null, echelon_id: p.echelon_id ?? null })),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast.success('Hiérarchie enregistrée');
      if (data.impactedAgents > 0) {
        toast(`${data.impactedAgents} agent(s) avec une demande en cours suivent désormais le nouveau parcours.`, { icon: '🔁', duration: 6000 });
      }
      await load();
    } catch (e) {
      toast.error(e.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------- drag & drop
  const onDragStart = (e, id) => {
    e.dataTransfer.setData('text/plain', String(id));
    e.dataTransfer.effectAllowed = 'move';
    setDragId(id);
  };
  const onDragEnd = () => { setDragId(null); setHoverTarget(null); };
  const hover = (key) => setHoverTarget((prev) => (prev === key ? prev : key));

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center py-32 text-gray-500 gap-3">
          <span className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          Chargement de la hiérarchie…
        </div>
      </div>
    );
  }

  const selected = selectedId ? people[selectedId] : null;
  const totalRows = rows.length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Navbar />

      <div className="container mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* En-tête */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <button onClick={() => router.push('/rh')} className="text-sm text-gray-500 hover:text-gray-800 mb-1">
              ← Interface RH
            </button>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Hiérarchie & parcours de validation</h1>
            <p className="text-gray-600 mt-1 max-w-2xl">
              Glissez un agent <strong>sur une personne</strong> pour en faire son responsable, ou <strong>dans un échelon</strong> pour l&apos;y ranger.
              Chaque échelon « validant » ajoute une étape au parcours ; la RH valide toujours en dernier.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={autoGenerate}
              title="Place chaque valideur dans l'échelon qui correspond à sa position réelle dans le parcours"
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50"
            >
              Ranger selon le parcours
            </button>
            <button
              onClick={addEchelon}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-indigo-200 bg-white text-indigo-700 font-medium hover:bg-indigo-50"
            >
              <span className="text-lg leading-none">+</span> Ajouter un échelon
            </button>
            <button
              onClick={reset}
              disabled={!dirty || saving}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-40"
            >
              Annuler
            </button>
            <button
              onClick={save}
              disabled={!dirty || saving}
              className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-semibold shadow-sm hover:bg-indigo-700 disabled:opacity-40"
            >
              {saving ? 'Enregistrement…' : dirty ? 'Enregistrer les modifications' : 'Enregistré'}
            </button>
          </div>
        </div>

        {/* Indicateurs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Échelons" value={stats.echelons} />
          <Stat label="Échelons validants" value={stats.validants} />
          <Stat label="Parcours le plus long" value={`${stats.longest} étape${stats.longest > 1 ? 's' : ''} + RH`} />
          <Stat label="Alertes" value={stats.alerts} tone={stats.alerts > 0 ? 'warn' : 'ok'} />
        </div>

        {echelons.length === 0 && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <p className="text-indigo-900 text-sm">
              Aucun échelon n&apos;est encore défini. Partez des responsables déjà saisis dans les fiches agents, ou créez vos échelons à la main.
            </p>
            <button onClick={autoGenerate} className="shrink-0 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
              Proposer une pyramide automatiquement
            </button>
          </div>
        )}

        <div className="flex items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un agent, un poste, un service…"
            className="w-full max-w-md px-4 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {searchMatches && <span className="text-sm text-gray-500">{searchMatches.size} résultat(s)</span>}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start">
          {/* ===================== Pyramide ===================== */}
          <div className="space-y-2" onClick={() => setSelectedId(null)}>
            {rows.map((row, r) => {
              const width = totalRows <= 1 ? 100 : 42 + (58 * r) / (totalRows - 1);
              const isEchelon = row.kind === 'echelon';
              const eIdx = isEchelon ? r - 1 : -1;
              const hors = isEchelon && !row.echelon.valide;
              const rowHover = hoverTarget === `row:${row.key}` && row.kind !== 'rh';
              return (
                <div key={row.key}>
                  {r > 0 && (
                    <div className="flex justify-center text-gray-300 -my-1" aria-hidden>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5l7 9H5z" /></svg>
                    </div>
                  )}
                  <div
                    className="mx-auto w-full md:w-[var(--w)] transition-[width] duration-300"
                    style={{ '--w': `${width}%` }}
                  >
                    <div
                      onDragOver={(e) => {
                        if (!dragId || row.kind === 'rh') return;
                        e.preventDefault();
                        hover(`row:${row.key}`);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragId && row.kind !== 'rh') moveToRow(dragId, row);
                        onDragEnd();
                      }}
                      className={`relative rounded-2xl border-2 p-3 transition-colors ${
                        rowHover ? 'border-indigo-400 bg-indigo-50/70' : hors ? 'border-dashed border-gray-300 bg-gray-50' : 'border-transparent bg-white shadow-sm'
                      }`}
                      style={!rowHover && !hors ? { boxShadow: `inset 4px 0 0 ${row.color}, 0 1px 2px rgba(0,0,0,.05)` } : undefined}
                    >
                      {/* En-tête de rangée */}
                      <div className="flex flex-wrap items-center gap-2 mb-2" onClick={(e) => e.stopPropagation()}>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: row.color }} />
                        {isEchelon && editingEchelon === row.echelon.id ? (
                          <input
                            autoFocus
                            value={editingName}
                            maxLength={60}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitRename();
                              if (e.key === 'Escape') setEditingEchelon(null);
                            }}
                            className="px-2 py-0.5 rounded-md border border-indigo-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          />
                        ) : (
                          <button
                            type="button"
                            disabled={!isEchelon}
                            onClick={() => { setEditingEchelon(row.echelon.id); setEditingName(row.echelon.nom); }}
                            className={`text-sm font-semibold text-gray-800 ${isEchelon ? 'hover:underline decoration-dotted cursor-text' : ''}`}
                            title={isEchelon ? 'Cliquer pour renommer' : undefined}
                          >
                            {row.nom}
                          </button>
                        )}
                        <span className="text-xs text-gray-400">{row.members.length}</span>

                        {row.kind === 'rh' && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">Validation finale</span>
                        )}
                        {row.kind === 'base' && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Déposent les demandes</span>
                        )}
                        {isEchelon && row.echelon.valide && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                            Étape {stepOfEchelon.get(row.echelon.id)} du parcours
                          </span>
                        )}
                        {isEchelon && !row.echelon.valide && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Sauté dans le parcours</span>
                        )}

                        {isEchelon && (
                          <div className="ml-auto flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggleValide(row.echelon.id)}
                              className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full border ${
                                row.echelon.valide ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-300 text-gray-500'
                              }`}
                              title={row.echelon.valide ? 'Cet échelon valide les demandes — cliquer pour le retirer du parcours' : 'Hors parcours — cliquer pour qu\'il valide les demandes'}
                            >
                              <span className={`relative inline-block w-6 h-3.5 rounded-full transition-colors ${row.echelon.valide ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                                <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${row.echelon.valide ? 'left-3' : 'left-0.5'}`} />
                              </span>
                              {row.echelon.valide ? 'Valide' : 'Hors parcours'}
                            </button>
                            <IconButton title="Monter" disabled={eIdx === 0} onClick={() => moveEchelon(eIdx, -1)}>↑</IconButton>
                            <IconButton title="Descendre" disabled={eIdx === echelons.length - 1} onClick={() => moveEchelon(eIdx, 1)}>↓</IconButton>
                            {confirmDelete === row.echelon.id ? (
                              <span className="flex items-center gap-1">
                                <button type="button" onClick={() => deleteEchelon(row.echelon.id)} className="text-[11px] font-semibold px-2 py-1 rounded-full bg-red-600 text-white">
                                  Supprimer
                                </button>
                                <button type="button" onClick={() => setConfirmDelete(null)} className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                                  Non
                                </button>
                              </span>
                            ) : (
                              <IconButton title="Supprimer l'échelon (ses membres descendent d'un cran)" onClick={() => setConfirmDelete(row.echelon.id)}>✕</IconButton>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Membres */}
                      <div className="flex flex-wrap justify-center gap-2 min-h-[56px]">
                        {row.members.length === 0 && (
                          <p className="self-center text-xs text-gray-400 italic py-3">
                            {row.kind === 'rh' ? 'Aucun profil RH / Direction actif' : 'Déposez des agents ici'}
                          </p>
                        )}
                        {row.members.map((p) => (
                          <PersonCard
                            key={p.id}
                            person={p}
                            color={row.color}
                            responsable={p.responsable_id != null ? people[p.responsable_id] : null}
                            subCount={(childrenOf.get(p.id) || []).length}
                            stepsCount={circuits.get(p.id)?.length ?? null}
                            draggable={!isRHType(p.type_utilisateur)}
                            isSelected={selectedId === p.id}
                            isDragged={dragId === p.id}
                            isDropTarget={hoverTarget === `card:${p.id}` && dragId !== p.id}
                            isInverted={inverted.has(p.id) || unranked.has(p.id)}
                            dimmed={
                              (searchMatches && !searchMatches.has(p.id)) ||
                              (related && selectedId !== p.id && !related.up.has(p.id) && !related.down.has(p.id))
                            }
                            highlight={related?.up.has(p.id) ? 'up' : related?.down.has(p.id) ? 'down' : searchMatches?.has(p.id) ? 'match' : null}
                            onSelect={() => setSelectedId(selectedId === p.id ? null : p.id)}
                            onDragStart={(e) => onDragStart(e, p.id)}
                            onDragEnd={onDragEnd}
                            onDragOver={(e) => {
                              if (!dragId || dragId === p.id) return;
                              e.preventDefault();
                              e.stopPropagation();
                              hover(`card:${p.id}`);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (dragId) attachTo(dragId, p.id);
                              onDragEnd();
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Zone pour détacher du responsable */}
            <div
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                hover('detach');
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) detach(dragId);
                onDragEnd();
              }}
              className={`mx-auto mt-3 max-w-xl rounded-2xl border-2 border-dashed px-4 py-3 text-center text-sm transition-all ${
                dragId ? 'opacity-100' : 'opacity-0 pointer-events-none h-0 py-0 mt-0 border-0'
              } ${hoverTarget === 'detach' ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-gray-300 text-gray-500'}`}
            >
              Déposer ici pour <strong>retirer le responsable</strong> (validation directe par la RH)
            </div>
          </div>

          {/* ===================== Panneau latéral ===================== */}
          <aside className="xl:sticky xl:top-24 space-y-4">
            {selected ? (
              <SelectedPanel
                person={selected}
                people={people}
                echelons={echelons}
                ctx={ctx}
                rowOf={rowOf}
                rows={rows}
                steps={circuits.get(selected.id) || []}
                validatesFor={validatesFor.get(selected.id) || []}
                subordinates={childrenOf.get(selected.id) || []}
                isInverted={inverted.has(selected.id)}
                onClose={() => setSelectedId(null)}
                onSelect={setSelectedId}
                onSetEchelon={(echelonId) => updatePerson(selected.id, { echelon_id: echelonId })}
                onSetResponsable={(respId) => (respId == null ? detach(selected.id) : attachTo(selected.id, respId))}
              />
            ) : (
              <HelpPanel
                inverted={[...inverted].map((id) => people[id])}
                unranked={[...unranked].map((id) => people[id])}
                onFix={autoGenerate}
                people={people}
                onSelect={setSelectedId}
              />
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

// ======================================================================
// Composants
// ======================================================================

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${tone === 'warn' ? 'text-amber-600' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

function IconButton({ children, title, disabled, onClick }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="w-7 h-7 rounded-full text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function PersonCard({
  person, color, responsable, subCount, stepsCount, draggable, isSelected, isDragged, isDropTarget,
  isInverted, dimmed, highlight, onSelect, onDragStart, onDragEnd, onDragOver, onDrop,
}) {
  const ring = isDropTarget
    ? 'ring-2 ring-indigo-500 scale-[1.03]'
    : isSelected
      ? 'ring-2 ring-gray-900'
      : highlight === 'up'
        ? 'ring-2 ring-amber-400'
        : highlight === 'down'
          ? 'ring-2 ring-sky-300'
          : highlight === 'match'
            ? 'ring-2 ring-yellow-300'
            : '';
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      className={`relative w-[172px] rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-left shadow-sm transition-all select-none
        ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
        ${isDragged ? 'opacity-40' : dimmed ? 'opacity-35' : ''} ${ring} hover:shadow-md`}
      title={draggable ? 'Glisser pour déplacer · Cliquer pour voir le parcours' : 'Cliquer pour voir les détails'}
    >
      {isDropTarget && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
          Devenir responsable
        </span>
      )}
      <div className="flex items-center gap-2">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: color }}
        >
          {initials(person)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-gray-900">{person.prenom} {person.nom}</p>
          <p className="truncate text-[11px] text-gray-500">{person.poste || person.type_utilisateur}</p>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-1 text-[11px]">
        <span className="truncate text-gray-500">
          {isRHType(person.type_utilisateur)
            ? 'Valide en dernier'
            : responsable
              ? `↑ ${shortName(responsable)}`
              : '→ RH directe'}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {stepsCount != null && (
            <span className="rounded-full bg-gray-100 px-1.5 text-gray-600" title={`${stepsCount} étape(s) avant la RH`}>
              {stepsCount}+RH
            </span>
          )}
          {subCount > 0 && (
            <span className="rounded-full bg-indigo-50 px-1.5 text-indigo-700" title={`${subCount} agent(s) sous sa responsabilité`}>
              {subCount}▾
            </span>
          )}
        </span>
      </div>
      {isInverted && (
        <span
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold text-white shadow"
          title="Son responsable est placé au même niveau ou plus bas dans la pyramide"
        >
          !
        </span>
      )}
    </div>
  );
}

function SelectedPanel({
  person, people, echelons, ctx, rowOf, rows, steps, validatesFor, subordinates, isInverted,
  onClose, onSelect, onSetEchelon, onSetResponsable,
}) {
  const rh = isRHType(person.type_utilisateur);

  // Chaîne complète, y compris les responsables sautés (échelon hors parcours / inactifs)
  const chain = [];
  {
    const seen = new Set([person.id]);
    let cur = person.responsable_id;
    while (cur != null && !seen.has(cur)) {
      seen.add(cur);
      const r = people[cur];
      if (!r || isRHType(r.type_utilisateur)) break;
      const step = steps.find((s) => s.validateur_id === r.id);
      const ech = r.echelon_id != null ? echelons.find((e) => e.id === r.echelon_id) : null;
      chain.push({ person: r, step, echelon: ech });
      cur = r.responsable_id;
    }
  }

  // Responsables possibles : tout le monde sauf soi et ses subordonnés (directs ou non)
  const candidates = Object.values(people).filter((p) => p.id !== person.id && !isAncestor(person.id, p.id, ctx));
  const byRow = rows.map((r) => ({ ...r, options: candidates.filter((c) => rowOf(c) === rows.indexOf(r)) })).filter((r) => r.options.length > 0);

  const levelsSummary = validatesFor.reduce((acc, v) => { acc[v.niveau] = (acc[v.niveau] || 0) + 1; return acc; }, {});

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold text-gray-900">{fullName(person)}</p>
          <p className="text-sm text-gray-500">{[person.poste, person.service].filter(Boolean).join(' · ') || person.type_utilisateur}</p>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Fermer">✕</button>
      </div>

      {isInverted && (
        <p className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2">
          Son responsable est placé au même niveau ou plus bas dans la pyramide. Le parcours fonctionne, mais la pyramide n&apos;est plus lisible.
        </p>
      )}

      {rh ? (
        <p className="text-sm text-gray-600">Profil RH / Direction : valide toutes les demandes en dernière étape.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3">
            <label className="text-sm">
              <span className="block text-xs font-medium text-gray-500 mb-1">Échelon</span>
              <select
                value={person.echelon_id ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  const match = echelons.find((ech) => String(ech.id) === v);
                  onSetEchelon(match ? match.id : null);
                }}
                className="w-full rounded-lg border border-gray-200 px-2 py-1.5"
              >
                {echelons.map((e) => <option key={e.id} value={e.id}>{e.nom}{e.valide ? '' : ' (hors parcours)'}</option>)}
                <option value="">Agents (base)</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-xs font-medium text-gray-500 mb-1">Responsable direct</span>
              <select
                value={person.responsable_id ?? ''}
                onChange={(e) => onSetResponsable(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-lg border border-gray-200 px-2 py-1.5"
              >
                <option value="">Aucun — validation directe par la RH</option>
                {byRow.map((r) => (
                  <optgroup key={r.key} label={r.nom}>
                    {r.options.map((c) => <option key={c.id} value={c.id}>{fullName(c)}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Parcours de ses demandes</p>
            <ol className="relative space-y-2 border-l-2 border-gray-100 ml-2.5 pl-4">
              <li className="text-sm text-gray-600">
                <Dot className="bg-gray-300" /> Demande de {person.prenom}
              </li>
              {chain.map(({ person: r, step, echelon }) => (
                <li key={r.id} className={`text-sm ${step ? 'text-gray-900' : 'text-gray-400 line-through decoration-gray-300'}`}>
                  <Dot className={step ? 'bg-indigo-500' : 'bg-gray-200'} />
                  {step && <span className="mr-1 text-xs font-bold text-indigo-600">N{step.niveau}</span>}
                  <button className="hover:underline" onClick={() => onSelect(r.id)}>{fullName(r)}</button>
                  {echelon && <span className="ml-1 text-xs text-gray-500">· {echelon.nom}</span>}
                  {!step && (
                    <span className="ml-1 text-xs no-underline">
                      ({echelon && !echelon.valide ? 'échelon hors parcours' : 'inactif'})
                    </span>
                  )}
                </li>
              ))}
              <li className="text-sm font-semibold text-rose-700">
                <Dot className="bg-rose-600" /> RH — validation finale
              </li>
            </ol>
          </div>
        </>
      )}

      {validatesFor.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Valide pour</p>
          <p className="text-sm text-gray-700">
            {Object.entries(levelsSummary).map(([lvl, n], i) => (
              <span key={lvl}>{i > 0 && ' · '}<strong>N{lvl}</strong> pour {n} agent{n > 1 ? 's' : ''}</span>
            ))}
          </p>
        </div>
      )}

      {subordinates.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Sous sa responsabilité directe ({subordinates.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {subordinates.map((s) => (
              <button key={s.id} onClick={() => onSelect(s.id)} className="text-xs px-2 py-1 rounded-full bg-sky-50 text-sky-800 hover:bg-sky-100">
                {fullName(s)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Dot({ className }) {
  return <span className={`absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full ring-2 ring-white ${className}`} />;
}

function HelpPanel({ inverted, unranked = [], onFix, onSelect }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 space-y-4 text-sm text-gray-700">
      <p className="font-semibold text-gray-900">Mode d&apos;emploi</p>
      <ul className="space-y-2">
        <li><strong>Glisser sur une personne</strong> : elle devient le responsable (l&apos;agent descend sous son niveau si besoin).</li>
        <li><strong>Glisser dans une rangée</strong> : change l&apos;échelon sans toucher au responsable.</li>
        <li><strong>Interrupteur « Valide »</strong> : retire un échelon du parcours sans le supprimer ; ses membres sont alors sautés.</li>
        <li><strong>Cliquer sur une carte</strong> : affiche son parcours de validation, sa chaîne (<span className="text-amber-600">orange</span>) et son équipe (<span className="text-sky-600">bleu</span>).</li>
        <li>Rien n&apos;est appliqué avant <strong>Enregistrer</strong>.</li>
      </ul>
      <p className="text-xs text-gray-500">
        Les demandes déjà en cours conservent les étapes validées et suivent le nouveau parcours pour la suite.
      </p>

      {unranked.length > 0 && (
        <div>
          <p className="font-semibold text-amber-700 mb-1">Valideurs hors pyramide ({unranked.length})</p>
          <p className="text-xs text-gray-500 mb-2">Ils valident des demandes mais sont restés dans la rangée « Agents » :</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {unranked.map((p) => (
              <button key={p.id} onClick={() => onSelect(p.id)} className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-800 hover:bg-amber-100">
                {fullName(p)}
              </button>
            ))}
          </div>
          <button onClick={onFix} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
            Ranger selon le parcours
          </button>
        </div>
      )}

      {inverted.length > 0 && (
        <div>
          <p className="font-semibold text-amber-700 mb-1">À vérifier ({inverted.length})</p>
          <p className="text-xs text-gray-500 mb-2">Responsable placé au même niveau ou plus bas :</p>
          <div className="flex flex-wrap gap-1.5">
            {inverted.map((p) => (
              <button key={p.id} onClick={() => onSelect(p.id)} className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-800 hover:bg-amber-100">
                {fullName(p)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
