'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import toast from 'react-hot-toast';

// High-contrast service palette — each service has a clearly distinct hue
// bg = saturated fill (still printable), text = deep on-color, border = mid tone
const COLORS = {
  maire:         { bg: '#7dd3c0', text: '#0b3d33', border: '#2fa58f' }, // teal
  police:        { bg: '#7cb1e3', text: '#12335e', border: '#3a7bbf' }, // blue
  ccas:          { bg: '#ec6fa3', text: '#5a0f33', border: '#c73a7a' }, // hot pink
  dgs:           { bg: '#8fd98a', text: '#124a16', border: '#4fb149' }, // forest green
  vieLocale:     { bg: '#d87ab8', text: '#531240', border: '#b0438e' }, // fuchsia
  technique:     { bg: '#f0816a', text: '#5e170a', border: '#d14e34' }, // coral/red
  urbanisme:     { bg: '#b8d967', text: '#2f481a', border: '#84b02c' }, // lime
  ressources:    { bg: '#c99ac6', text: '#42204a', border: '#9a66a1' }, // violet
  rh:            { bg: '#f5a3b2', text: '#5c1528', border: '#d26179' }, // rose
  finances:      { bg: '#f7a38a', text: '#5e230e', border: '#d66a4c' }, // salmon
  affaires:      { bg: '#f4d36a', text: '#5e430a', border: '#d1a929' }, // gold
  education:     { bg: '#f5a25e', text: '#5e2906', border: '#d67624' }, // orange
  vieAsso:       { bg: '#e87aad', text: '#4f0f34', border: '#c24484' }, // pink-magenta
  restauration:  { bg: '#f2c16a', text: '#5e3d08', border: '#cf942a', }, // amber
  communication: { bg: '#8f9ef0', text: '#1f2a6b', border: '#5667cf' }, // indigo
  entretien:     { bg: '#6ed8c9', text: '#0f4a44', border: '#2aaa97' }, // cyan
  respAnim:      { bg: '#a78bfa', text: '#3b1681', border: '#7c3aed' }, // purple — Resp. Centre de Loisir
  agent:         { bg: '#c9c9c9', text: '#262e38', border: '#8e8e8e' }, // neutral gray
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

function match(value, ...keywords) {
  if (!value) return false;
  const v = value.toLowerCase();
  return keywords.some(k => v.includes(k.toLowerCase()));
}

// ============================================================
// Routing rules (unchanged from previous version)
// ============================================================
const ROLE_DGS = u => match(u.poste, 'DGS') || match(u.type_utilisateur, 'DG');
const ROLE_DIR_VIE_LOCALE = u => match(u.poste, 'Dir. Vie Locale', 'Directrice Vie Locale', 'Directeur Vie Locale') || match(u.type_utilisateur, 'Directeur Vie Locale');
const ROLE_RESP_TECH = u => match(u.service, 'SERVICES TECH') && match(u.poste, 'Resp');
const ROLE_RESP_ANIM = u => match(u.service, 'C.L.S.H') && match(u.poste, 'Resp. Centre', 'Resp Centre', 'Resp. Adj', 'Resp Adj', 'Adjoint');
const ROLE_RESP_SOCIAL = u => match(u.poste, 'Resp. Social', 'Resp Social');
const ROLE_RESP_RH = u => match(u.poste, 'Resp. RH', 'Resp RH');
const ROLE_RESP_FINANCES = u => match(u.poste, 'Resp. Finance', 'Resp Finance');
const ROLE_RESP_URBANISME = u => match(u.poste, 'Resp. Urbanisme', 'Resp Urbanisme');

const BRANCH_POLICE = u => match(u.service, 'SÉCURITÉ', 'SECURITE', 'Police') || match(u.type_utilisateur, 'Police');
const BRANCH_TECH = u => match(u.service, 'SERVICES TECH', 'technique');
const BRANCH_VIE_ASSO = u => match(u.service, 'EMC') || match(u.type_utilisateur, 'Animateur Culturel');
const BRANCH_CANTINE = u => match(u.service, 'RESTAURATION', 'restauration', 'cantine');
const BRANCH_ENTRETIEN = u => match(u.type_utilisateur, 'Entretien') || match(u.poste, "Agent d'entretien", 'Agent d entretien');
const BRANCH_ANIMATION = u =>
  !BRANCH_VIE_ASSO(u) && !BRANCH_CANTINE(u) && !BRANCH_ENTRETIEN(u) && (
    match(u.service, 'C.L.S.H', 'ÉCOLE', 'ECOLE', 'Enfance') ||
    match(u.type_utilisateur, 'Animateur', 'ATSEM')
  );
const BRANCH_ADMIN = u => match(u.service, 'ADMIN. GÉNÉRALE', 'ADMIN. GENERALE', 'Etat Civil');
const BRANCH_COMMUNICATION = u => match(u.service, 'communication') || match(u.poste, 'communication');

function buildOrgTree(users) {
  const placed = new Set();
  const place = (u, color, sub) => { placed.add(u.id); return userToNode(u, color, sub); };

  const dgsUser = users.find(ROLE_DGS);
  const carmenUser = users.find(ROLE_DIR_VIE_LOCALE);
  const respSocial = users.find(ROLE_RESP_SOCIAL);

  [dgsUser, carmenUser, respSocial].filter(Boolean).forEach(u => placed.add(u.id));

  // Services Techniques
  const respsTech = users.filter(u => !placed.has(u.id) && ROLE_RESP_TECH(u));
  respsTech.forEach(u => placed.add(u.id));
  const techAgents = users.filter(u => !placed.has(u.id) && BRANCH_TECH(u));
  techAgents.forEach(u => placed.add(u.id));
  const techRespNodes = respsTech.map(u => place(u, COLORS.technique));
  const techAgentNodes = techAgents.map(u => userToNode(u, COLORS.technique));
  if (techRespNodes.length > 0 && techAgentNodes.length > 0) {
    const perResp = Math.ceil(techAgentNodes.length / techRespNodes.length);
    techRespNodes.forEach((resp, i) => {
      resp.children = techAgentNodes.slice(i * perResp, (i + 1) * perResp);
    });
  }
  const techChefNodes = techRespNodes.length > 0 ? techRespNodes : techAgentNodes;

  // Urbanisme
  const respsUrba = users.filter(u => !placed.has(u.id) && ROLE_RESP_URBANISME(u));
  respsUrba.forEach(u => placed.add(u.id));
  const urbanismeUsers = respsUrba.map(u => place(u, COLORS.urbanisme));
  users.filter(u => !placed.has(u.id) && match(u.poste, 'urbanisme')).forEach(u => {
    placed.add(u.id);
    urbanismeUsers.push(userToNode(u, COLORS.urbanisme));
  });

  // RH
  const respsRH = users.filter(u => !placed.has(u.id) && ROLE_RESP_RH(u));
  respsRH.forEach(u => placed.add(u.id));
  const rhNodes = respsRH.map(u => place(u, COLORS.rh));
  users.filter(u => !placed.has(u.id) && match(u.poste, 'RH') && !ROLE_DGS(u)).forEach(u => {
    placed.add(u.id);
    if (rhNodes.length > 0) rhNodes[0].children.push(userToNode(u, COLORS.rh));
    else rhNodes.push(userToNode(u, COLORS.rh));
  });

  // Finances
  const respsFinances = users.filter(u => !placed.has(u.id) && ROLE_RESP_FINANCES(u));
  respsFinances.forEach(u => placed.add(u.id));
  const financeNodes = respsFinances.map(u => place(u, COLORS.finances));
  users.filter(u => !placed.has(u.id) && match(u.poste, 'Factur', 'Finance', 'Comptab')).forEach(u => {
    placed.add(u.id);
    financeNodes.push(userToNode(u, COLORS.finances));
  });

  // Admin générale
  const adminUsers = users.filter(u => !placed.has(u.id) && BRANCH_ADMIN(u));
  adminUsers.forEach(u => placed.add(u.id));
  const affairesNodes = adminUsers.map(u => userToNode(u, COLORS.affaires));

  // Animation
  const respsAnim = users.filter(u => !placed.has(u.id) && ROLE_RESP_ANIM(u));
  respsAnim.forEach(u => placed.add(u.id));
  const animUsers = users.filter(u => !placed.has(u.id) && BRANCH_ANIMATION(u));
  animUsers.forEach(u => placed.add(u.id));
  const animRespNodes = respsAnim.map(u => {
    const node = place(u, COLORS.respAnim);
    node.badge = 'Responsable Centre de Loisir';
    return node;
  });
  const animAgentNodes = animUsers.map(u => userToNode(u, COLORS.education));
  const animChefNodes = [...animRespNodes, ...animAgentNodes];

  // Vie Associative
  const vieAssoUsers = users.filter(u => !placed.has(u.id) && BRANCH_VIE_ASSO(u));
  vieAssoUsers.forEach(u => placed.add(u.id));
  const vieAssoNodes = vieAssoUsers.map(u => userToNode(u, COLORS.vieAsso));

  // Cantine
  const cantineUsers = users.filter(u => !placed.has(u.id) && BRANCH_CANTINE(u));
  cantineUsers.forEach(u => placed.add(u.id));
  const cantineNodes = cantineUsers.map(u => userToNode(u, COLORS.restauration));

  // Communication
  const comUsers = users.filter(u => !placed.has(u.id) && BRANCH_COMMUNICATION(u));
  comUsers.forEach(u => placed.add(u.id));
  const comNodes = comUsers.map(u => userToNode(u, COLORS.communication));

  // Entretien (rattaché à Carmen)
  const entretienUsers = users.filter(u => !placed.has(u.id) && BRANCH_ENTRETIEN(u));
  entretienUsers.forEach(u => placed.add(u.id));
  const entretienNodes = entretienUsers.map(u => userToNode(u, COLORS.entretien));

  // Dir. Vie Locale
  const carmen = carmenUser
    ? place(carmenUser, COLORS.vieLocale)
    : staticNode('dir-vie-locale', 'Dir. Vie Locale', '', COLORS.vieLocale);
  carmen.children = [
    svc('clsh', 'C.L.S.H. / Animation', COLORS.education, animChefNodes),
    svc('vie-asso', 'Vie Associative et Culturelle', COLORS.vieAsso, vieAssoNodes),
    svc('cantine', 'Cantine', COLORS.restauration, cantineNodes),
    svc('entretien', 'Entretien', COLORS.entretien, entretienNodes),
    svc('communication', 'Communication', COLORS.communication, comNodes),
  ];

  // Police
  const policeUsers = users.filter(u => !placed.has(u.id) && BRANCH_POLICE(u));
  policeUsers.forEach(u => placed.add(u.id));
  const policeNode = svc('police', 'Police Municipale', COLORS.police,
    policeUsers.map(u => userToNode(u, COLORS.police))
  );

  // CCAS
  const ccasNode = respSocial
    ? place(respSocial, COLORS.ccas)
    : staticNode('ccas', 'CCAS', '', COLORS.ccas);

  // DGS
  const claudine = dgsUser
    ? place(dgsUser, COLORS.dgs)
    : staticNode('dgs', 'DGS', '', COLORS.dgs);
  claudine.children = [
    svc('technique', 'Services techniques et entretien des bâtiments', COLORS.technique, techChefNodes),
    svc('urbanisme', 'Service urbanisme', COLORS.urbanisme, urbanismeUsers),
    svc('ressources', 'Services ressources', COLORS.ressources, [
      svc('rh', 'Ressources Humaines', COLORS.rh, rhNodes),
      svc('finances', 'Finances', COLORS.finances, financeNodes),
    ]),
    svc('affaires-generales', 'Service affaires générales', COLORS.affaires, affairesNodes),
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
  if (presetId === 'ecole') return findVieLocale(tree) || tree;
  if (presetId === 'technique') return findNode(tree, 'technique') || tree;
  return tree;
}

const EXPORT_PRESETS = [
  { id: 'complet', label: 'Organigramme Complet', desc: 'Tous les services et agents', color: '#7fc9a8' },
  { id: 'direction', label: 'Direction', desc: 'Sans Services Techniques ni Vie Locale', color: '#7fc9a8' },
  { id: 'ecole', label: 'Organigramme Ecole', desc: 'Dir. Vie Locale et son equipe', color: '#e38aad' },
  { id: 'technique', label: 'Services Techniques', desc: 'Responsables et agents techniques', color: '#e88874' },
];

// ============================================================
// Card components — pastel pill matching the paper reference
// ============================================================

function OrgCard({ node, collapsed, onToggle, childCount }) {
  const s = node.isService;
  const canCollapse = s && childCount > 0;
  const c = node.color;

  if (s) {
    // Service header: solid pastel pill, centered label
    return (
      <div
        className="org-svc"
        style={{ background: c.bg, borderColor: c.border, color: c.text }}
      >
        <span className="org-svc-label">{node.label}</span>
        {canCollapse && (
          <button
            className="org-collapse-btn"
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            title={collapsed ? 'Deplier' : 'Replier'}
            style={{ color: c.text }}
          >
            <span>{childCount}</span>
            <svg
              width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"
              style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  // Person card: pastel pill with round avatar on left
  const card = (
    <div
      className="org-card"
      style={{ background: c.bg, borderColor: c.border, color: c.text }}
    >
      <div className="org-card-avatar" style={{ borderColor: c.border }}>
        {node.photo ? (
          <img src={node.photo} alt="" />
        ) : (
          <span className="org-card-initials" style={{ color: c.text }}>
            {getInitials(node.label)}
          </span>
        )}
      </div>
      <div className="org-card-text">
        <p className="org-card-name">{node.label}</p>
        {node.subtitle && <p className="org-card-role">{node.subtitle}</p>}
      </div>
    </div>
  );

  if (node.badge) {
    return (
      <div className="org-card-wrap">
        <span
          className="org-card-badge"
          style={{ background: c.border, color: '#fff' }}
        >
          {node.badge}
        </span>
        {card}
      </div>
    );
  }

  return card;
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
        <ul className={node.children.every(c => !c.isService) ? 'org-col' : ''}>
          {node.children.map(child => (
            <OrgNode key={child.id} node={child} />
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
            <button key={preset.id} className="export-preset-btn" onClick={() => onSelect(preset)}>
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

const TODAY_FR = (() => {
  try {
    const d = new Date();
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return ''; }
})();

export default function OrganigrammePage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(0.7);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scroll, setScroll] = useState({ x: 0, y: 0 });
  const [exporting, setExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportData, setExportData] = useState(null);
  const canvasRef = useRef(null);
  const treeRef = useRef(null);
  const exportRef = useRef(null);

  useEffect(() => {
    if (!exportData) return;
    const timer = setTimeout(() => { captureExport(exportData.preset); }, 400);
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

      const treeHtml = el.innerHTML;
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
    width: 584mm; height: 410mm; overflow: hidden; background: #fff;
    font-family: Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  .page { width: 584mm; height: 410mm; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 10mm; }
  .tree-scaler { display: inline-block; transform-origin: center center; }
  .page-footer { position: absolute; bottom: 8mm; left: 0; right: 0; text-align: center; font-family: Arial, Helvetica, sans-serif; }
  .page-footer .title { font-size: 22pt; font-weight: 800; color: #1e293b; letter-spacing: 0.02em; }
  .page-footer .date { font-size: 11pt; color: #64748b; margin-top: 4px; }

  .org-tree { display:flex; justify-content:center; padding:0; margin:0; list-style:none; }
  .org-tree ul { display:flex; justify-content:center; padding-top:30px; position:relative; list-style:none; margin:0; padding-left:0; padding-right:0; gap:14px; }
  .org-tree li { display:flex; flex-direction:column; align-items:center; position:relative; padding:0 10px; }
  .org-tree ul::before { content:""; position:absolute; top:0; left:50%; width:2px; height:30px; background:#94a3b8; }
  .org-tree li::before, .org-tree li::after { content:""; position:absolute; top:0; width:50%; height:30px; border-top:2px solid #94a3b8; }
  .org-tree li::before { left:0; border-right:2px solid #94a3b8; border-radius:0 8px 0 0; }
  .org-tree li::after { right:0; }
  .org-tree li:first-child::before { border-top:none; border-top-right-radius:0; }
  .org-tree li:first-child::after { border-radius:8px 0 0 0; }
  .org-tree li:last-child::before { border-radius:0 8px 0 0; }
  .org-tree li:last-child::after { border-top:none; border-top-right-radius:0; }
  .org-tree li:only-child::before { border-top:none; border-right:2px solid #94a3b8; border-radius:0; }
  .org-tree li:only-child::after { border-top:none; }
  .org-tree > li::before, .org-tree > li::after { display:none; }

  .org-tree ul.org-col { flex-direction: column; align-items: center; padding-top: 18px; gap: 8px; }
  .org-tree ul.org-col::before { height: 18px; }
  .org-tree ul.org-col > li { padding: 0; }
  .org-tree ul.org-col > li::before, .org-tree ul.org-col > li::after { display: none; }
  .org-tree ul.org-col > li + li::before { display: block; content: ""; position: absolute; top: -8px; left: 50%; width: 2px; height: 8px; background: #94a3b8; border: none; border-radius: 0; transform: translateX(-1px); }

  .org-card { position:relative; z-index:2; display:flex; align-items:center; border-radius:999px; border:2px solid; min-width:240px; max-width:340px; height:64px; padding:5px 14px 5px 5px; box-shadow:0 2px 5px rgba(0,0,0,0.14); }
  .org-card-avatar { flex-shrink:0; width:54px; height:54px; border-radius:50%; border:2.5px solid; background:#fff; display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .org-card-avatar img { width:100%; height:100%; object-fit:cover; border-radius:50%; }
  .org-card-initials { font-weight:800; font-size:15px; }
  .org-card-text { padding-left:13px; padding-right:8px; min-width:0; flex:1; }
  .org-card-name { font-weight:800; font-size:0.95rem; text-transform:uppercase; letter-spacing:0.02em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:0; }
  .org-card-role { font-size:0.78rem; opacity:0.85; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:2px 0 0; }
  .org-card-wrap { position:relative; z-index:2; display:flex; flex-direction:column; align-items:center; gap:5px; }
  .org-card-badge { padding:3px 12px; border-radius:999px; font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.04em; white-space:nowrap; box-shadow:0 1px 2px rgba(0,0,0,0.18); }

  .org-svc { position:relative; z-index:2; display:inline-flex; align-items:center; justify-content:center; border-radius:999px; border:2px solid; min-width:230px; max-width:400px; min-height:44px; padding:8px 18px; box-shadow:0 2px 5px rgba(0,0,0,0.14); }
  .org-svc-label { font-weight:800; font-size:0.95rem; text-transform:uppercase; letter-spacing:0.03em; text-align:center; line-height:1.15; }
  .org-collapse-btn { display: none !important; }

  @media print {
    html, body { width:584mm; height:410mm; }
    .page { width:584mm; height:410mm; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="tree-scaler" id="scaler">${treeHtml}</div>
    <div class="page-footer">
      <div class="title">Organigramme Mairie de Chartrettes</div>
      <div class="date">${TODAY_FR}</div>
    </div>
  </div>
  <script>
    function run() {
      var page = document.querySelector('.page');
      var scaler = document.getElementById('scaler');
      var availH = page.clientHeight - 90;
      var sx = (page.clientWidth - 20) / scaler.scrollWidth;
      var sy = availH / scaler.scrollHeight;
      var s = Math.min(sx, sy, 1.6);
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
    if (!isAuthenticated) { router.push('/'); return; }
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
    <div className="min-h-screen flex flex-col" style={{ background: '#f3efe5' }}>
      <Navbar />

      <style>{`
        /* === Tree connectors === */
        .org-tree { display: flex; justify-content: center; padding: 0; margin: 0; list-style: none; }
        .org-tree ul {
          display: flex; justify-content: center; padding-top: 22px; position: relative;
          list-style: none; margin: 0; padding-left: 0; padding-right: 0;
        }
        .org-tree li {
          display: flex; flex-direction: column; align-items: center; position: relative;
          padding: 0 3px;
        }
        .org-tree ul::before {
          content: ""; position: absolute; top: 0; left: 50%;
          width: 2px; height: 22px; background: #94a3b8;
        }
        .org-tree li::before, .org-tree li::after {
          content: ""; position: absolute; top: 0; width: 50%; height: 22px;
          border-top: 2px solid #94a3b8;
        }
        .org-tree li::before {
          left: 0; border-right: 2px solid #94a3b8; border-radius: 0 8px 0 0;
        }
        .org-tree li::after { right: 0; }
        .org-tree li:first-child::before { border-top: none; border-top-right-radius: 0; }
        .org-tree li:first-child::after { border-radius: 8px 0 0 0; }
        .org-tree li:last-child::before { border-radius: 0 8px 0 0; }
        .org-tree li:last-child::after { border-top: none; border-top-right-radius: 0; }
        .org-tree li:only-child::before {
          border-top: none; border-right: 2px solid #94a3b8; border-radius: 0;
        }
        .org-tree li:only-child::after { border-top: none; }
        .org-tree > li::before, .org-tree > li::after { display: none; }

        /* === Column layout: when all children are people, stack vertically === */
        .org-tree ul.org-col {
          flex-direction: column;
          align-items: center;
          padding-top: 14px;
          gap: 4px;
        }
        .org-tree ul.org-col::before {
          height: 14px;
        }
        .org-tree ul.org-col > li {
          padding: 0;
        }
        .org-tree ul.org-col > li::before,
        .org-tree ul.org-col > li::after {
          display: none;
        }
        .org-tree ul.org-col > li + li::before {
          display: block;
          content: "";
          position: absolute;
          top: -4px;
          left: 50%;
          width: 2px;
          height: 4px;
          background: #94a3b8;
          border: none;
          border-radius: 0;
          transform: translateX(-1px);
        }

        /* === Person card (pastel pill) === */
        .org-card {
          position: relative;
          z-index: 2;
          display: flex; align-items: center;
          border: 1.5px solid;
          border-radius: 999px;
          min-width: 180px; max-width: 260px;
          height: 48px;
          padding: 4px 10px 4px 4px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.12);
          user-select: none;
          transition: transform 0.12s, box-shadow 0.12s;
        }
        .org-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(0,0,0,0.18);
        }
        .org-card-avatar {
          flex-shrink: 0;
          width: 40px; height: 40px;
          border-radius: 50%;
          border: 2px solid;
          background: #fff;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
        }
        .org-card-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
        .org-card-initials { font-weight: 800; font-size: 11px; }
        .org-card-text { padding-left: 10px; padding-right: 6px; min-width: 0; flex: 1; }
        .org-card-name {
          font-weight: 800; font-size: 0.72rem;
          text-transform: uppercase; letter-spacing: 0.02em;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          margin: 0;
        }
        .org-card-role {
          font-size: 0.62rem; opacity: 0.85;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          margin: 1px 0 0;
        }
        .org-card-wrap {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .org-card-badge {
          padding: 2px 10px;
          border-radius: 999px;
          font-size: 0.55rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          white-space: nowrap;
          box-shadow: 0 1px 2px rgba(0,0,0,0.18);
        }

        /* === Service banner === */
        .org-svc {
          position: relative;
          z-index: 2;
          display: inline-flex; align-items: center; justify-content: center;
          border: 1.5px solid;
          border-radius: 999px;
          min-width: 180px; max-width: 320px;
          min-height: 34px;
          padding: 6px 14px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.12);
          user-select: none;
        }
        .org-svc-label {
          font-weight: 800; font-size: 0.75rem;
          text-transform: uppercase; letter-spacing: 0.03em;
          text-align: center; line-height: 1.15;
        }
        .org-collapse-btn {
          position: absolute; right: 6px; top: 50%;
          transform: translateY(-50%);
          display: inline-flex; align-items: center; gap: 2px;
          padding: 2px 5px; border-radius: 10px; border: none;
          background: rgba(255,255,255,0.55);
          cursor: pointer;
          font-size: 0.58rem; font-weight: 800;
        }
        .org-collapse-btn:hover { background: rgba(255,255,255,0.85); }

        .org-tree li.collapsed > .org-svc { opacity: 0.7; }

        /* === Export modal === */
        .export-modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 20px;
        }
        .export-modal {
          background: #fff;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 16px;
          padding: 24px;
          max-width: 480px; width: 100%;
          box-shadow: 0 20px 60px rgba(0,0,0,0.25);
        }
        .export-modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
        .export-modal-header h2 { color: #1e293b; font-size: 1.25rem; font-weight: 800; margin: 0; }
        .export-modal-close {
          background: none; border: none; color: #64748b; cursor: pointer;
          padding: 4px; border-radius: 8px; transition: color 0.15s, background 0.15s;
        }
        .export-modal-close:hover { color: #1e293b; background: rgba(0,0,0,0.05); }
        .export-modal-subtitle { color: #64748b; font-size: 0.85rem; margin: 0 0 20px; }
        .export-modal-grid { display: flex; flex-direction: column; gap: 10px; }
        .export-preset-btn {
          display: flex; align-items: center; gap: 0;
          background: #f8fafc;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 12px; cursor: pointer;
          transition: background 0.15s, border-color 0.15s, transform 0.1s;
          overflow: hidden; text-align: left; padding: 0;
        }
        .export-preset-btn:hover {
          background: #f1f5f9;
          border-color: rgba(0,0,0,0.15);
          transform: translateX(2px);
        }
        .export-preset-bar { width: 5px; align-self: stretch; flex-shrink: 0; }
        .export-preset-content { flex: 1; padding: 14px 12px; min-width: 0; }
        .export-preset-label { display: block; color: #1e293b; font-weight: 700; font-size: 0.9rem; }
        .export-preset-desc { display: block; color: #64748b; font-size: 0.75rem; margin-top: 2px; }
        .export-preset-arrow { flex-shrink: 0; color: #94a3b8; margin-right: 14px; }

        /* === Hidden export render === */
        .export-offscreen {
          position: absolute; left: -99999px; top: 0; z-index: -1;
          pointer-events: none; overflow: visible !important;
          width: max-content; height: max-content;
        }
      `}</style>

      {/* Top bar */}
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/calendrier')}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl sm:text-2xl font-black text-gray-800 tracking-wide">
              Organigramme <span className="text-gray-500">Mairie de Chartrettes</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExportModal(true)}
              disabled={exporting || !tree}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white rounded-lg transition text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Imprimer / PDF
            </button>
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
              <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.2))} className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
              </button>
              <button onClick={() => { setZoom(0.7); setScroll({ x: 0, y: 0 }); }} className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition font-medium">
                {Math.round(zoom * 100)}%
              </button>
              <button onClick={() => setZoom(z => Math.min(z + 0.1, 2))} className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition">
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-700" />
          </div>
        ) : tree ? (
          <>
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

            {/* Screen footer title (mimics paper) */}
            <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none select-none">
              <div className="text-gray-800 font-black text-lg sm:text-xl tracking-wide">
                Organigramme Mairie de Chartrettes
              </div>
              <div className="text-gray-500 text-xs sm:text-sm mt-0.5">{TODAY_FR}</div>
            </div>
          </>
        ) : (
          <div className="flex flex-col justify-center items-center h-full py-32 text-gray-500">
            <p className="text-lg font-medium">Erreur de chargement</p>
            <button onClick={fetchUsers} className="mt-3 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition text-sm">
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

      {/* Hidden render for PDF — same component, same styles */}
      {exportData && (
        <div className="export-offscreen">
          <div ref={exportRef} style={{ display: 'inline-block', padding: '20px', background: '#fff', overflow: 'visible', whiteSpace: 'nowrap' }}>
            <ul className="org-tree" style={{ overflow: 'visible' }}>
              <OrgNode node={exportData.tree} />
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
