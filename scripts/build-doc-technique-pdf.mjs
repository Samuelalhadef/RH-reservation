// Convertit doc-technique.html en PDF A4 via Chromium (Playwright).
// Usage : node scripts/build-doc-technique-pdf.mjs
//
// La feuille de style d'impression vit dans doc-technique.html (@media print) :
// ce script ne fait que piloter le rendu. Deux précautions sont indispensables.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SRC = path.resolve('doc-technique.html');
const OUT = 'Documentation-Technique-Portail-Agent.pdf';
const step = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

if (!fs.existsSync(SRC)) {
  console.error(`Introuvable : ${SRC}`);
  process.exit(1);
}

let browser;
try { browser = await chromium.launch(); }
catch { browser = await chromium.launch({ channel: 'chrome' }); }

const ctx = await browser.newContext({ colorScheme: 'light' });
const page = await ctx.newPage();
await page.goto('file://' + SRC.replace(/\\/g, '/'), { waitUntil: 'load' });
step('document chargé');

// (1) Les captures portent loading="lazy" — utile sur le web, fatal ici :
//     hors écran elles ne se chargent jamais et les figures sortent vides.
await page.evaluate(() => {
  for (const img of document.images) {
    img.loading = 'eager';
    if (!img.complete) { const s = img.src; img.src = ''; img.src = s; }
  }
});
await page.waitForFunction(
  () => [...document.images].every((i) => i.complete && i.naturalWidth > 0),
  null, { timeout: 60_000 });
const n = await page.evaluate(() => document.images.length);
step(`${n} captures prêtes`);

// (2) Ne jamais appeler img.decode() après emulateMedia('print') : la promesse
//     ne se résout pas (l'image n'est plus peinte) et le script reste suspendu.
await page.emulateMedia({ media: 'print', colorScheme: 'light' });
step('mise en page impression appliquée');

const footer = `<div style="width:100%;font-size:7.5pt;font-family:Segoe UI,sans-serif;
  color:#66787E;padding:0 17mm;display:flex;justify-content:space-between;">
  <span>Mon Portail Agent — Documentation technique · Mairie de Chartrettes</span>
  <span class="pageNumber"></span></div>`;

await page.pdf({
  path: OUT,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: footer,
  margin: { top: '16mm', bottom: '18mm', left: '17mm', right: '17mm' },
});

await browser.close();
console.log(`✅ ${OUT} — ${(fs.statSync(OUT).size / 1024 / 1024).toFixed(2)} Mo`);
process.exit(0);
