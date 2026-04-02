'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import toast from 'react-hot-toast';

// Color palette
const COLORS = {
  maire: '#1e3a5f',
  police: '#dc2626',
  ccas: '#7c3aed',
  dgs: '#0369a1',
  technique: '#16a34a',
  urbanisme: '#ca8a04',
  ressources: '#0891b2',
  rh: '#2563eb',
  finances: '#059669',
  affaires: '#9333ea',
  vieLocale: '#e11d48',
  education: '#f97316',
  vieAsso: '#ec4899',
  agent: '#6b7280',
  ecole: '#0d9488',
  restauration: '#d97706',
  communication: '#6366f1',
  etatCivil: '#84cc16',
  enfance: '#f43f5e',
};

// Helpers
function userToNode(user, color, subtitleOverride) {
  return {
    id: `user-${user.id}`,
    label: `${user.prenom} ${user.nom}`,
    subtitle: subtitleOverride || user.poste || user.type_utilisateur || '',
    color,
    isService: false,
    photo: user.photo_profil || null,
    children: [],
  };
}

function svc(id, label, color, children = []) {
  return { id, label, subtitle: '', color, isService: true, photo: null, children };
}

function staticNode(id, label, subtitle, color) {
  return { id, label, subtitle, color, isService: false, photo: null, children: [] };
}

// Check if a field contains a keyword (case-insensitive)
function match(value, ...keywords) {
  if (!value) return false;
  const v = value.toLowerCase();
  return keywords.some(k => v.includes(k.toLowerCase()));
}

// ============================================================
// Routing rules: determine which branch each user belongs to.
// Adding a new user with the right service/poste will auto-place them.
// ============================================================
const ROLE_DGS = u => match(u.poste, 'DGS') || match(u.type_utilisateur, 'DG');
const ROLE_DIR_VIE_LOCALE = u => match(u.poste, 'Dir. Vie Locale', 'Directrice Vie Locale', 'Directeur Vie Locale') || match(u.type_utilisateur, 'Responsable Vie Locale');
const ROLE_RESP_TECH = u => match(u.service, 'SERVICES TECH') && match(u.poste, 'Resp');
const ROLE_RESP_ANIM = u => match(u.service, 'C.L.S.H') && match(u.poste, 'Resp. Centre', 'Resp Centre');
const ROLE_RESP_SOCIAL = u => match(u.poste, 'Resp. Social', 'Resp Social');
const ROLE_RESP_RH = u => match(u.poste, 'Resp. RH', 'Resp RH');
const ROLE_RESP_FINANCES = u => match(u.poste, 'Resp. Finance', 'Resp Finance');
const ROLE_RESP_URBANISME = u => match(u.poste, 'Resp. Urbanisme', 'Resp Urbanisme');

const BRANCH_POLICE = u => match(u.service, 'SÉCURITÉ', 'SECURITE', 'Police') || match(u.type_utilisateur, 'Police');
const BRANCH_TECH = u => match(u.service, 'SERVICES TECH', 'technique');
const BRANCH_VIE_ASSO = u => match(u.service, 'EMC') || match(u.type_utilisateur, 'Animateur Culturel');
const BRANCH_CANTINE = u => match(u.service, 'RESTAURATION', 'restauration', 'cantine');
const BRANCH_ANIMATION = u =>
  !BRANCH_VIE_ASSO(u) && !BRANCH_CANTINE(u) && (
    match(u.service, 'C.L.S.H', 'ÉCOLE', 'ECOLE', 'Enfance') ||
    match(u.type_utilisateur, 'Animateur', 'ATSEM', 'Entretien')
  );
const BRANCH_ADMIN = u => match(u.service, 'ADMIN. GÉNÉRALE', 'ADMIN. GENERALE', 'Etat Civil');
const BRANCH_COMMUNICATION = u => match(u.service, 'communication') || match(u.poste, 'communication');

// Build the full org tree dynamically from DB users
function buildOrgTree(users) {
  const placed = new Set();
  const place = (u, color, sub) => { placed.add(u.id); return userToNode(u, color, sub); };

  const dgsUser = users.find(ROLE_DGS);
  const carmenUser = users.find(ROLE_DIR_VIE_LOCALE);
  const respSocial = users.find(ROLE_RESP_SOCIAL);

  [dgsUser, carmenUser, respSocial].filter(Boolean).forEach(u => placed.add(u.id));

  // --- SERVICES TECHNIQUES ---
  const respsTech = users.filter(u => !placed.has(u.id) && ROLE_RESP_TECH(u));
  respsTech.forEach(u => placed.add(u.id));
  const techAgents = users.filter(u => !placed.has(u.id) && BRANCH_TECH(u));
  techAgents.forEach(u => placed.add(u.id));
  const techRespNodes = respsTech.map(u => place(u, COLORS.technique));
  const techAgentNodes = techAgents.map(u => userToNode(u, COLORS.agent));
  if (techRespNodes.length > 0 && techAgentNodes.length > 0) {
    const perResp = Math.ceil(techAgentNodes.length / techRespNodes.length);
    techRespNodes.forEach((resp, i) => {
      resp.children = techAgentNodes.slice(i * perResp, (i + 1) * perResp);
    });
  }
  const techChefNodes = techRespNodes.length > 0 ? techRespNodes : techAgentNodes;

  // --- URBANISME ---
  const respsUrba = users.filter(u => !placed.has(u.id) && ROLE_RESP_URBANISME(u));
  respsUrba.forEach(u => placed.add(u.id));
  const urbanismeUsers = respsUrba.map(u => place(u, COLORS.urbanisme));
  users.filter(u => !placed.has(u.id) && match(u.poste, 'urbanisme')).forEach(u => {
    placed.add(u.id);
    urbanismeUsers.push(userToNode(u, COLORS.urbanisme));
  });

  // --- RH ---
  const respsRH = users.filter(u => !placed.has(u.id) && ROLE_RESP_RH(u));
  respsRH.forEach(u => placed.add(u.id));
  const rhNodes = respsRH.map(u => { const n = place(u, COLORS.rh); return n; });
  users.filter(u => !placed.has(u.id) && match(u.poste, 'RH') && !ROLE_DGS(u)).forEach(u => {
    placed.add(u.id);
    if (rhNodes.length > 0) rhNodes[0].children.push(userToNode(u, COLORS.rh));
    else rhNodes.push(userToNode(u, COLORS.rh));
  });

  // --- FINANCES ---
  const respsFinances = users.filter(u => !placed.has(u.id) && ROLE_RESP_FINANCES(u));
  respsFinances.forEach(u => placed.add(u.id));
  const financeNodes = respsFinances.map(u => place(u, COLORS.finances));
  users.filter(u => !placed.has(u.id) && match(u.poste, 'Factur', 'Finance', 'Comptab')).forEach(u => {
    placed.add(u.id);
    financeNodes.push(userToNode(u, COLORS.finances));
  });

  // --- ADMIN GÉNÉRALE ---
  const adminUsers = users.filter(u => !placed.has(u.id) && BRANCH_ADMIN(u));
  adminUsers.forEach(u => placed.add(u.id));
  const affairesNodes = adminUsers.map(u => userToNode(u, COLORS.affaires));

  // --- ANIMATION ---
  const respsAnim = users.filter(u => !placed.has(u.id) && ROLE_RESP_ANIM(u));
  respsAnim.forEach(u => placed.add(u.id));
  const animUsers = users.filter(u => !placed.has(u.id) && BRANCH_ANIMATION(u));
  animUsers.forEach(u => placed.add(u.id));
  const animRespNodes = respsAnim.map(u => place(u, COLORS.education));
  const animAgentNodes = animUsers.map(u => userToNode(u, COLORS.agent));
  if (animRespNodes.length > 0 && animAgentNodes.length > 0) {
    const perResp = Math.ceil(animAgentNodes.length / animRespNodes.length);
    animRespNodes.forEach((resp, i) => {
      resp.children = animAgentNodes.slice(i * perResp, (i + 1) * perResp);
    });
  }
  const animChefNodes = animRespNodes.length > 0 ? animRespNodes : animAgentNodes;

  // --- VIE ASSOCIATIVE ---
  const vieAssoUsers = users.filter(u => !placed.has(u.id) && BRANCH_VIE_ASSO(u));
  vieAssoUsers.forEach(u => placed.add(u.id));
  const vieAssoNodes = vieAssoUsers.map(u => userToNode(u, COLORS.vieAsso));

  // --- CANTINE ---
  const cantineUsers = users.filter(u => !placed.has(u.id) && BRANCH_CANTINE(u));
  cantineUsers.forEach(u => placed.add(u.id));
  const cantineNodes = cantineUsers.map(u => userToNode(u, COLORS.restauration));

  // --- COMMUNICATION ---
  const comUsers = users.filter(u => !placed.has(u.id) && BRANCH_COMMUNICATION(u));
  comUsers.forEach(u => placed.add(u.id));
  const comNodes = comUsers.map(u => userToNode(u, COLORS.communication));

  // --- CARMEN / ALEXINE (Dir. Vie Locale) ---
  const carmen = carmenUser
    ? place(carmenUser, COLORS.vieLocale)
    : staticNode('dir-vie-locale', 'Dir. Vie Locale', '', COLORS.vieLocale);
  carmen.children = [
    svc('clsh', 'C.L.S.H. / Animation', COLORS.education, animChefNodes),
    svc('vie-asso', 'Vie Associative et Culturelle', COLORS.vieAsso, vieAssoNodes),
    svc('cantine', 'Cantine', COLORS.restauration, cantineNodes),
    svc('communication', 'Communication', COLORS.communication, comNodes),
  ];

  // --- POLICE ---
  const policeUsers = users.filter(u => !placed.has(u.id) && BRANCH_POLICE(u));
  policeUsers.forEach(u => placed.add(u.id));
  const policeNode = svc('police', 'Service Police', COLORS.police,
    policeUsers.map(u => userToNode(u, COLORS.police))
  );

  // --- CCAS ---
  const ccasNode = respSocial
    ? place(respSocial, COLORS.ccas)
    : staticNode('ccas', 'CCAS', '', COLORS.ccas);

  // --- DGS ---
  const claudine = dgsUser
    ? place(dgsUser, COLORS.dgs)
    : staticNode('dgs', 'DGS', '', COLORS.dgs);
  claudine.children = [
    svc('technique', 'Services Techniques', COLORS.technique, techChefNodes),
    svc('urbanisme', 'Service Urbanisme', COLORS.urbanisme, urbanismeUsers),
    svc('ressources', 'Service Ressources', COLORS.ressources, [
      svc('rh', 'Service RH', COLORS.rh, rhNodes),
      svc('finances', 'Service Finances', COLORS.finances, financeNodes),
    ]),
    svc('affaires-generales', 'Service Affaires Générales', COLORS.affaires, affairesNodes),
    carmen,
  ];

  const unplaced = users.filter(u => !placed.has(u.id) && u.actif === 1);
  if (unplaced.length > 0) {
    claudine.children.push(
      svc('autres', 'Autres', COLORS.agent, unplaced.map(u => userToNode(u, COLORS.agent)))
    );
  }

  const fabrice = staticNode('maire', 'Fabrice Bargeault', 'Maire', COLORS.maire);
  fabrice.children = [policeNode, ccasNode, claudine];

  return fabrice;
}

// ============================================================
// Tree helpers for export presets
// ============================================================

function getInitials(label) {
  return label.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function countMembers(node) {
  if (!node.children || node.children.length === 0) return node.isService ? 0 : 1;
  return (node.isService ? 0 : 1) + node.children.reduce((sum, c) => sum + countMembers(c), 0);
}

function cloneNode(node) {
  return { ...node, children: (node.children || []).map(cloneNode) };
}

function findNode(node, id) {
  if (node.id === id) return node;
  for (const c of (node.children || [])) {
    const found = findNode(c, id);
    if (found) return found;
  }
  return null;
}

// Find Dir. Vie Locale node (the person whose children contain 'clsh')
function findVieLocale(node) {
  if (!node.isService && (node.children || []).some(c => c.id === 'clsh')) return node;
  for (const c of (node.children || [])) {
    const found = findVieLocale(c);
    if (found) return found;
  }
  return null;
}

function getPresetTree(fullTree, presetId) {
  if (presetId === 'complet') return fullTree;

  const tree = cloneNode(fullTree);

  if (presetId === 'direction') {
    // Remove Services Techniques branch and Dir. Vie Locale branch
    const strip = (node) => {
      node.children = (node.children || []).filter(c => {
        if (c.id === 'technique') return false;
        if (!c.isService && c.children && c.children.some(gc => gc.id === 'clsh')) return false;
        return true;
      });
      node.children.forEach(strip);
    };
    strip(tree);
    return tree;
  }

  if (presetId === 'ecole') {
    return findVieLocale(tree) || tree;
  }

  if (presetId === 'technique') {
    return findNode(tree, 'technique') || tree;
  }

  return tree;
}

// ============================================================
// Export presets
// ============================================================
const EXPORT_PRESETS = [
  { id: 'complet', label: 'Organigramme Complet', desc: 'Tous les services et agents', color: '#0369a1' },
  { id: 'direction', label: 'Direction', desc: 'Sans Services Techniques ni Vie Locale', color: '#1e3a5f' },
  { id: 'ecole', label: 'Organigramme Ecole', desc: 'Dir. Vie Locale et son equipe', color: '#e11d48' },
  { id: 'technique', label: 'Services Techniques', desc: 'Responsables et agents techniques', color: '#16a34a' },
];

// ============================================================
// Components
// ============================================================

function OrgCard({ node, collapsed, onToggle, childCount }) {
  const s = node.isService;
  const canCollapse = s && childCount > 0;
  return (
    <div
      className="org-card"
      style={{
        background: node.color,
        border: s ? '2px dashed rgba(255,255,255,0.5)' : '3px solid rgba(255,255,255,0.2)',
      }}
    >
      <div
        className="org-card-avatar"
        style={{
          background: s ? 'rgba(255,255,255,0.2)' : node.color,
          filter: s ? 'none' : 'brightness(1.4)',
          overflow: 'hidden',
        }}
      >
        {s ? (
          <svg width="18" height="18" fill="none" stroke="#fff" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ) : node.photo ? (
          <img src={node.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span className="org-card-initials">{getInitials(node.label)}</span>
        )}
      </div>
      <div className="org-card-text">
        <p className="org-card-name">{node.label}</p>
        {node.subtitle && <p className="org-card-role">{node.subtitle}</p>}
      </div>
      {canCollapse && (
        <button
          className="org-collapse-btn"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          title={collapsed ? 'Déplier' : 'Replier'}
        >
          <span className="org-collapse-count">{childCount}</span>
          <svg
            width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
    </div>
  );
}

function OrgNode({ node }) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const memberCount = hasChildren ? countMembers(node) : 0;

  return (
    <li className={collapsed ? 'collapsed' : ''}>
      <OrgCard
        node={node}
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        childCount={memberCount}
      />
      {hasChildren && !collapsed && (
        <ul>
          {node.children.map(child => (
            <OrgNode key={child.id} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

// Static version for PDF export (white bg, always expanded, no interactivity)
function OrgNodeStatic({ node }) {
  const s = node.isService;
  const hasChildren = node.children && node.children.length > 0;
  return (
    <li>
      <div
        className="print-card"
        style={{
          borderLeft: `4px solid ${node.color}`,
        }}
      >
        <div
          className="print-avatar"
          style={{ background: node.color }}
        >
          {s ? (
            <svg width="16" height="16" fill="none" stroke="#fff" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ) : node.photo ? (
            <img src={node.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          ) : (
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '11px' }}>{getInitials(node.label)}</span>
          )}
        </div>
        <div className="print-text">
          <p className="print-name">{node.label}</p>
          {node.subtitle && <p className="print-role">{node.subtitle}</p>}
        </div>
      </div>
      {hasChildren && (
        <ul>
          {node.children.map(child => (
            <OrgNodeStatic key={child.id} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

function ExportModal({ onClose, onSelect }) {
  return (
    <div className="export-modal-overlay" onClick={onClose}>
      <div className="export-modal" onClick={e => e.stopPropagation()}>
        <div className="export-modal-header">
          <h2>Exporter en PDF</h2>
          <button onClick={onClose} className="export-modal-close">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="export-modal-subtitle">Choisissez la vue a imprimer (format A2 paysage)</p>
        <div className="export-modal-grid">
          {EXPORT_PRESETS.map(preset => (
            <button
              key={preset.id}
              className="export-preset-btn"
              onClick={() => onSelect(preset)}
            >
              <div className="export-preset-bar" style={{ background: preset.color }} />
              <div className="export-preset-content">
                <span className="export-preset-label">{preset.label}</span>
                <span className="export-preset-desc">{preset.desc}</span>
              </div>
              <svg className="export-preset-arrow" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Page
// ============================================================
export default function OrganigrammePage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(0.65);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scroll, setScroll] = useState({ x: 0, y: 0 });
  const [exporting, setExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportData, setExportData] = useState(null); // { tree, preset }
  const canvasRef = useRef(null);
  const treeRef = useRef(null);
  const exportRef = useRef(null);

  // When exportData is set, wait for render then capture
  useEffect(() => {
    if (!exportData) return;
    const timer = setTimeout(() => {
      captureExport(exportData.preset);
    }, 400);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportData]);

  const startExport = useCallback((preset) => {
    if (!tree) return;
    setShowExportModal(false);
    setExporting(true);
    toast.loading('Preparation du rendu...', { id: 'pdf-export' });
    const filteredTree = getPresetTree(tree, preset.id);
    setExportData({ tree: filteredTree, preset });
  }, [tree]);

  const captureExport = useCallback(async (preset) => {
    try {
      const el = exportRef.current;
      if (!el) throw new Error('Rendu echoue');

      toast.loading('Ouverture de l\'apercu...', { id: 'pdf-export' });

      // Grab the rendered tree HTML
      const treeHtml = el.innerHTML;

      // Open a new window with print-ready page
      const printWin = window.open('', '_blank', 'width=1200,height=800');
      if (!printWin) {
        toast.error('Popup bloquee — autorisez les popups pour ce site', { id: 'pdf-export' });
        return;
      }

      printWin.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${preset.label} - Mairie de Chartrettes</title>
<style>
  @page { size: 594mm 420mm; margin: 5mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 584mm;
    height: 410mm;
    overflow: hidden;
    background: #fff;
    font-family: Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  .page {
    width: 584mm;
    height: 410mm;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .tree-scaler {
    display: inline-block;
    transform-origin: center center;
  }

  /* ---- Tree connectors ---- */
  .org-tree { display:flex; justify-content:center; padding:0; margin:0; list-style:none; }
  .org-tree ul { display:flex; justify-content:center; padding-top:24px; position:relative; list-style:none; margin:0; padding-left:0; padding-right:0; }
  .org-tree li { display:flex; flex-direction:column; align-items:center; position:relative; padding:0 3px; }
  .org-tree ul::before { content:""; position:absolute; top:0; left:50%; width:2px; height:24px; background:#94a3b8; }
  .org-tree li::before, .org-tree li::after { content:""; position:absolute; top:0; width:50%; height:24px; border-top:2px solid #94a3b8; }
  .org-tree li::before { left:0; border-right:2px solid #94a3b8; border-radius:0 8px 0 0; }
  .org-tree li::after { right:0; }
  .org-tree li:first-child::before { border-top:none; border-top-right-radius:0; }
  .org-tree li:first-child::after { border-radius:8px 0 0 0; }
  .org-tree li:last-child::before { border-radius:0 8px 0 0; }
  .org-tree li:last-child::after { border-top:none; border-top-right-radius:0; }
  .org-tree li:only-child::before { border-top:none; border-right:2px solid #94a3b8; border-radius:0; }
  .org-tree li:only-child::after { border-top:none; }
  .org-tree > li::before, .org-tree > li::after { display:none; }

  /* ---- Print cards ---- */
  .print-card { display:flex; align-items:center; border-radius:10px; min-width:170px; max-width:300px; height:56px; padding-left:8px; padding-right:10px; background:#fff; box-shadow:0 1px 4px rgba(0,0,0,0.15); }
  .print-avatar { flex-shrink:0; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .print-avatar img { width:100%; height:100%; object-fit:cover; border-radius:50%; }
  .print-text { padding-left:8px; padding-right:4px; min-width:0; flex:1; }
  .print-name { color:#1e293b; font-weight:800; font-size:0.72rem; text-transform:uppercase; letter-spacing:0.02em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:0; }
  .print-role { color:#64748b; font-size:0.62rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:1px 0 0; }

  @media print {
    html, body { width:584mm; height:410mm; }
    .page { width:584mm; height:410mm; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="tree-scaler" id="scaler">
      ${treeHtml}
    </div>
  </div>
  <script>
    function run() {
      var page = document.querySelector('.page');
      var scaler = document.getElementById('scaler');
      var sx = page.clientWidth / scaler.scrollWidth;
      var sy = page.clientHeight / scaler.scrollHeight;
      var s = Math.min(sx, sy, 1);
      scaler.style.transform = 'scale(' + s + ')';
      setTimeout(function(){ window.print(); }, 300);
    }
    var imgs = document.querySelectorAll('img');
    var total = imgs.length;
    if (total === 0) { run(); }
    else {
      var loaded = 0;
      function check() { loaded++; if (loaded >= total) run(); }
      imgs.forEach(function(img) {
        if (img.complete) check();
        else { img.onload = check; img.onerror = check; }
      });
    }
  </script>
</body>
</html>`);
      printWin.document.close();

      toast.success('Choisissez "Enregistrer en PDF" dans la boite de dialogue', { id: 'pdf-export' });
    } catch (err) {
      console.error('Erreur export PDF:', err);
      toast.error('Erreur lors de la generation', { id: 'pdf-export' });
    } finally {
      setExporting(false);
      setExportData(null);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users/organigramme');
      const data = await res.json();
      if (data.success && data.users?.length > 0) {
        setTree(buildOrgTree(data.users));
      } else {
        setTree(buildOrgTree([]));
      }
    } catch (err) {
      console.error('Erreur chargement organigramme:', err);
      setTree(buildOrgTree([]));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    fetchUsers();
  }, [isAuthenticated, router, fetchUsers]);

  const handleMouseDown = (e) => {
    if (e.target.closest('button')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - scroll.x, y: e.clientY - scroll.y });
  };
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setScroll({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setIsDragging(false);
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - scroll.x, y: e.touches[0].clientY - scroll.y });
    }
  };
  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    setScroll({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#1a202c' }}>
      <Navbar />

      <style>{`
        /* === CSS-ONLY TREE CONNECTORS === */
        .org-tree {
          display: flex;
          justify-content: center;
          padding: 0;
          margin: 0;
        }
        .org-tree ul {
          display: flex;
          justify-content: center;
          padding-top: 24px;
          position: relative;
          list-style: none;
          margin: 0;
          padding-left: 0;
          padding-right: 0;
        }
        .org-tree li {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          padding: 0 2px;
        }
        .org-tree ul::before {
          content: "";
          position: absolute;
          top: 0;
          left: 50%;
          width: 2px;
          height: 24px;
          background: rgba(255,255,255,0.25);
        }
        .org-tree li::before,
        .org-tree li::after {
          content: "";
          position: absolute;
          top: 0;
          width: 50%;
          height: 24px;
          border-top: 2px solid rgba(255,255,255,0.25);
        }
        .org-tree li::before {
          left: 0;
          border-right: 2px solid rgba(255,255,255,0.25);
          border-radius: 0 8px 0 0;
        }
        .org-tree li::after {
          right: 0;
        }
        .org-tree li:first-child::before {
          border-top: none;
          border-top-right-radius: 0;
        }
        .org-tree li:first-child::after {
          border-radius: 8px 0 0 0;
        }
        .org-tree li:last-child::before {
          border-radius: 0 8px 0 0;
        }
        .org-tree li:last-child::after {
          border-top: none;
          border-top-right-radius: 0;
        }
        .org-tree li:only-child::before {
          border-top: none;
          border-right: 2px solid rgba(255,255,255,0.25);
          border-radius: 0;
        }
        .org-tree li:only-child::after {
          border-top: none;
        }
        .org-tree > li::before,
        .org-tree > li::after {
          display: none;
        }

        /* === CARD STYLES === */
        .org-card {
          position: relative;
          display: flex;
          align-items: center;
          border-radius: 14px;
          min-width: 180px;
          max-width: 260px;
          height: 62px;
          padding-left: 10px;
          padding-right: 6px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.3);
          overflow: hidden;
          user-select: none;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .org-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.4);
        }
        .org-card-avatar {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .org-card-initials {
          color: #fff;
          font-weight: 700;
          font-size: 12px;
        }
        .org-card-text {
          padding-left: 10px;
          padding-right: 4px;
          min-width: 0;
          flex: 1;
        }
        .org-card-name {
          color: #fff;
          font-weight: 800;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin: 0;
        }
        .org-card-role {
          color: rgba(255,255,255,0.8);
          font-size: 0.65rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin: 0;
          margin-top: 1px;
        }

        /* === COLLAPSE BUTTON === */
        .org-collapse-btn {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 3px;
          padding: 3px 6px;
          border-radius: 8px;
          border: none;
          background: rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.8);
          cursor: pointer;
          transition: background 0.15s;
          margin-left: 2px;
        }
        .org-collapse-btn:hover {
          background: rgba(255,255,255,0.3);
        }
        .org-collapse-count {
          font-size: 0.6rem;
          font-weight: 700;
        }

        /* === COLLAPSED STATE === */
        .org-tree li.collapsed > .org-card {
          opacity: 0.85;
        }

        /* === EXPORT MODAL === */
        .export-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .export-modal {
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          padding: 24px;
          max-width: 480px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
        .export-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .export-modal-header h2 {
          color: #fff;
          font-size: 1.25rem;
          font-weight: 800;
          margin: 0;
        }
        .export-modal-close {
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          border-radius: 8px;
          transition: color 0.15s, background 0.15s;
        }
        .export-modal-close:hover {
          color: #fff;
          background: rgba(255,255,255,0.1);
        }
        .export-modal-subtitle {
          color: #94a3b8;
          font-size: 0.85rem;
          margin: 0 0 20px;
        }
        .export-modal-grid {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .export-preset-btn {
          display: flex;
          align-items: center;
          gap: 0;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s, transform 0.1s;
          overflow: hidden;
          text-align: left;
          padding: 0;
        }
        .export-preset-btn:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.15);
          transform: translateX(2px);
        }
        .export-preset-bar {
          width: 5px;
          align-self: stretch;
          flex-shrink: 0;
        }
        .export-preset-content {
          flex: 1;
          padding: 14px 12px;
          min-width: 0;
        }
        .export-preset-label {
          display: block;
          color: #fff;
          font-weight: 700;
          font-size: 0.9rem;
        }
        .export-preset-desc {
          display: block;
          color: #94a3b8;
          font-size: 0.75rem;
          margin-top: 2px;
        }
        .export-preset-arrow {
          flex-shrink: 0;
          color: #64748b;
          margin-right: 14px;
        }

        /* === HIDDEN EXPORT RENDER === */
        .export-offscreen {
          position: absolute;
          left: -99999px;
          top: 0;
          z-index: -1;
          pointer-events: none;
          overflow: visible !important;
          width: max-content;
          height: max-content;
        }

        /* === PRINT-FRIENDLY STYLES (white bg) === */
        .print-tree ul::before {
          background: #94a3b8 !important;
        }
        .print-tree li::before {
          border-top-color: #94a3b8 !important;
          border-right-color: #94a3b8 !important;
        }
        .print-tree li::after {
          border-top-color: #94a3b8 !important;
        }
        .print-tree li:only-child::before {
          border-right-color: #94a3b8 !important;
        }
        .print-card {
          display: flex;
          align-items: center;
          border-radius: 10px;
          min-width: 170px;
          max-width: 300px;
          height: 56px;
          padding-left: 8px;
          padding-right: 10px;
          background: #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.13);
          user-select: none;
        }
        .print-avatar {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .print-text {
          padding-left: 8px;
          padding-right: 4px;
          min-width: 0;
          flex: 1;
        }
        .print-name {
          color: #1e293b;
          font-weight: 800;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin: 0;
        }
        .print-role {
          color: #64748b;
          font-size: 0.62rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin: 1px 0 0;
        }
      `}</style>

      {/* Top bar */}
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/calendrier')}
              className="p-2 text-gray-300 hover:text-white hover:bg-gray-600 rounded-lg transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl sm:text-3xl font-black">
              <span className="text-white">ORGANIGRAMME </span>
              <span className="text-cyan-400">MAIRIE DE CHARTRETTES</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExportModal(true)}
              disabled={exporting || !tree}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg transition text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              PDF
            </button>
            <div className="flex items-center gap-1 bg-gray-700/50 rounded-lg p-1">
              <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.2))} className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-600 rounded transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
              </button>
              <button onClick={() => { setZoom(0.65); setScroll({ x: 0, y: 0 }); }} className="px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-gray-600 rounded transition font-medium">
                {Math.round(zoom * 100)}%
              </button>
              <button onClick={() => setZoom(z => Math.min(z + 0.1, 2))} className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-600 rounded transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 overflow-hidden relative"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      >
        {loading ? (
          <div className="flex justify-center items-center h-full py-32">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400" />
          </div>
        ) : tree ? (
          <div
            className="inline-flex justify-center min-w-full p-10"
            style={{
              transform: `translate(${scroll.x}px, ${scroll.y}px) scale(${zoom})`,
              transformOrigin: 'top center',
              transition: isDragging ? 'none' : 'transform 0.2s ease',
            }}
          >
            <div ref={treeRef} style={{ display: 'inline-block' }}>
              <ul className="org-tree">
                <OrgNode node={tree} />
              </ul>
            </div>
          </div>
        ) : (
          <div className="flex flex-col justify-center items-center h-full py-32 text-gray-400">
            <p className="text-lg font-medium text-gray-300">Erreur de chargement</p>
            <button onClick={fetchUsers} className="mt-3 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition text-sm">
              Réessayer
            </button>
          </div>
        )}
      </div>

      {/* Export modal */}
      {showExportModal && (
        <ExportModal
          onClose={() => setShowExportModal(false)}
          onSelect={startExport}
        />
      )}

      {/* Hidden off-screen render for PDF capture (white bg for print) */}
      {exportData && (
        <div className="export-offscreen">
          <div ref={exportRef} style={{ display: 'inline-block', padding: '40px', background: '#f8fafc', overflow: 'visible', whiteSpace: 'nowrap' }}>
            <ul className="org-tree print-tree" style={{ overflow: 'visible' }}>
              <OrgNodeStatic node={exportData.tree} />
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
