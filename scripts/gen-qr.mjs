// Génère guide-qr.svg — QR code du portail RH, sans dépendance externe.
// Mode octet, correction d'erreur niveau M, versions 1 à 10.
// Usage : node scripts/gen-qr.mjs [url] [fichier-de-sortie]
import fs from 'fs';

const URL_PORTAIL = process.argv[2] || 'https://rh-reservation-u9jb.vercel.app/';
const OUT = process.argv[3] || 'guide-qr.svg';

// --- Tables par version (niveau M) : [total codewords, ec/bloc, blocs [nb, data], centres alignement]
const VERSIONS = {
  1:  { total: 26,  ec: 10, blocks: [[1, 16]],           align: [] },
  2:  { total: 44,  ec: 16, blocks: [[1, 28]],           align: [6, 18] },
  3:  { total: 70,  ec: 26, blocks: [[1, 44]],           align: [6, 22] },
  4:  { total: 100, ec: 18, blocks: [[2, 32]],           align: [6, 26] },
  5:  { total: 134, ec: 24, blocks: [[2, 43]],           align: [6, 30] },
  6:  { total: 172, ec: 16, blocks: [[4, 27]],           align: [6, 34] },
  7:  { total: 196, ec: 18, blocks: [[4, 31]],           align: [6, 22, 38] },
  8:  { total: 242, ec: 22, blocks: [[2, 38], [2, 39]],  align: [6, 24, 42] },
  9:  { total: 292, ec: 22, blocks: [[3, 36], [2, 37]],  align: [6, 26, 46] },
  10: { total: 346, ec: 26, blocks: [[4, 43], [1, 44]],  align: [6, 28, 50] },
};
const VERSION_INFO = { 7: 0x07c94, 8: 0x085bc, 9: 0x09a99, 10: 0x0a4d3 };

// --- Corps de Galois GF(256)
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

function rsGenerator(n) {
  let poly = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) { next[j] ^= poly[j]; next[j + 1] ^= mul(poly[j], EXP[i]); }
    poly = next;
  }
  return poly;
}

function rsEncode(data, ecLen) {
  const gen = rsGenerator(ecLen);
  const res = new Array(data.length + ecLen).fill(0);
  data.forEach((b, i) => { res[i] = b; });
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (!coef) continue;
    for (let j = 0; j < gen.length; j++) res[i + j] ^= mul(gen[j], coef);
  }
  return res.slice(data.length);
}

// --- Encodage des données (mode octet)
function encode(text) {
  const bytes = Array.from(new TextEncoder().encode(text));
  let version = null;
  for (let v = 1; v <= 10; v++) {
    const spec = VERSIONS[v];
    const dataCw = spec.blocks.reduce((s, [n, d]) => s + n * d, 0);
    const lenBits = v <= 9 ? 8 : 16;
    if (4 + lenBits + bytes.length * 8 <= dataCw * 8) { version = v; break; }
  }
  if (!version) throw new Error('Texte trop long pour une version 1-10 en niveau M');

  const spec = VERSIONS[version];
  const dataCw = spec.blocks.reduce((s, [n, d]) => s + n * d, 0);
  const lenBits = version <= 9 ? 8 : 16;

  const bits = [];
  const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(0b0100, 4);            // mode octet
  push(bytes.length, lenBits);
  bytes.forEach(b => push(b, 8));

  // Terminateur + alignement sur l'octet + octets de remplissage
  for (let i = 0; i < 4 && bits.length < dataCw * 8; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const cw = [];
  for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let i = 0; cw.length < dataCw; i++) cw.push(i % 2 === 0 ? 0xec : 0x11);

  // Découpage en blocs + calcul des codes correcteurs
  const dataBlocks = [], ecBlocks = [];
  let pos = 0;
  for (const [count, size] of spec.blocks) {
    for (let i = 0; i < count; i++) {
      const block = cw.slice(pos, pos + size);
      pos += size;
      dataBlocks.push(block);
      ecBlocks.push(rsEncode(block, spec.ec));
    }
  }

  // Entrelacement
  const out = [];
  const maxData = Math.max(...dataBlocks.map(b => b.length));
  for (let i = 0; i < maxData; i++) for (const b of dataBlocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < spec.ec; i++) for (const b of ecBlocks) out.push(b[i]);

  return { version, codewords: out };
}

// --- Construction de la matrice
function buildMatrix(version, codewords, mask) {
  const spec = VERSIONS[version];
  const size = version * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(0));
  const fixed = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (r, c, v) => { m[r][c] = v; fixed[r][c] = true; };

  // Motifs de repérage + séparateurs
  for (const [ro, co] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const rr = ro + r, cc = co + c;
      if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
      const inner = r >= 0 && r <= 6 && c >= 0 && c <= 6 &&
        (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      set(rr, cc, inner ? 1 : 0);
    }
  }
  // Motifs de synchronisation
  for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0 ? 1 : 0); set(i, 6, i % 2 === 0 ? 1 : 0); }
  // Motifs d'alignement
  for (const ar of spec.align) for (const ac of spec.align) {
    if ((ar <= 8 && ac <= 8) || (ar <= 8 && ac >= size - 9) || (ar >= size - 9 && ac <= 8)) continue;
    for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++)
      set(ar + r, ac + c, (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) ? 1 : 0);
  }
  // Module noir + zones réservées au format
  set(size - 8, 8, 1);
  for (let i = 0; i < 9; i++) { if (!fixed[8][i]) set(8, i, 0); if (!fixed[i][8]) set(i, 8, 0); }
  for (let i = 0; i < 8; i++) { if (!fixed[8][size - 1 - i]) set(8, size - 1 - i, 0); if (!fixed[size - 1 - i][8]) set(size - 1 - i, 8, 0); }
  // Information de version (v >= 7)
  if (version >= 7) {
    const vi = VERSION_INFO[version];
    for (let i = 0; i < 18; i++) {
      const bit = (vi >> i) & 1;
      set(Math.floor(i / 3), size - 11 + (i % 3), bit);
      set(size - 11 + (i % 3), Math.floor(i / 3), bit);
    }
  }

  // Placement des données en zigzag
  const maskFn = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ][mask];

  let bitIdx = 0;
  const totalBits = codewords.length * 8;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < size; i++) {
      const row = ((size - 1 - col) & 2) === 0 ? size - 1 - i : i;
      for (const c of [col, col - 1]) {
        if (fixed[row][c]) continue;
        let bit = 0;
        if (bitIdx < totalBits) bit = (codewords[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1;
        bitIdx++;
        m[row][c] = maskFn(row, c) ? bit ^ 1 : bit;
      }
    }
  }

  // Information de format (niveau M = 00)
  let fmt = (0b00 << 3) | mask;
  let rem = fmt << 10;
  for (let i = 4; i >= 0; i--) if ((rem >> (i + 10)) & 1) rem ^= 0x537 << i;
  const format = ((fmt << 10) | rem) ^ 0x5412;
  for (let i = 0; i < 15; i++) {
    const bit = (format >> i) & 1;
    // Copie 1 — autour du motif de repérage haut-gauche
    if (i < 6) m[i][8] = bit;
    else if (i < 8) m[i + 1][8] = bit;
    else if (i === 8) m[8][7] = bit;
    else m[8][14 - i] = bit;
    // Copie 2 — bas-gauche (colonne 8) et haut-droite (ligne 8)
    if (i < 8) m[8][size - 1 - i] = bit;
    else m[size - 15 + i][8] = bit;
  }
  m[size - 8][8] = 1; // module toujours noir
  return m;
}

// --- Score de pénalité (choix du masque optimal)
function penalty(m) {
  const size = m.length;
  let score = 0;
  const line = arr => {
    let run = 1;
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] === arr[i - 1]) { run++; if (run === 5) score += 3; else if (run > 5) score++; }
      else run = 1;
    }
  };
  for (let i = 0; i < size; i++) { line(m[i]); line(m.map(r => r[i])); }
  for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++)
    if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) score += 3;
  const pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const rpat = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const scan = arr => {
    for (let i = 0; i + 11 <= arr.length; i++) {
      if (pat.every((v, k) => arr[i + k] === v)) score += 40;
      if (rpat.every((v, k) => arr[i + k] === v)) score += 40;
    }
  };
  for (let i = 0; i < size; i++) { scan(m[i]); scan(m.map(r => r[i])); }
  const dark = m.flat().reduce((s, v) => s + v, 0);
  score += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
  return score;
}

// --- SVG
function toSvg(m, quiet = 4) {
  const size = m.length, dim = size + quiet * 2;
  let d = '';
  for (let r = 0; r < size; r++) {
    let c = 0;
    while (c < size) {
      if (!m[r][c]) { c++; continue; }
      let len = 0;
      while (c + len < size && m[r][c + len]) len++;
      d += `M${c + quiet} ${r + quiet}h${len}v1h-${len}z`;
      c += len;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img" aria-label="QR code vers le portail RH">
<rect width="${dim}" height="${dim}" fill="#ffffff"/>
<path d="${d}" fill="#111827"/>
</svg>
`;
}

const { version, codewords } = encode(URL_PORTAIL);
let best = null;
for (let mask = 0; mask < 8; mask++) {
  const m = buildMatrix(version, codewords, mask);
  const p = penalty(m);
  if (!best || p < best.p) best = { m, p, mask };
}
fs.writeFileSync(OUT, toSvg(best.m));
console.log(`✅ ${OUT} — version ${version}, masque ${best.mask}, ${best.m.length}×${best.m.length} modules`);
console.log(`   URL : ${URL_PORTAIL}`);
