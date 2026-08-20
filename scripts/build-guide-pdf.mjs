// Convertit guide-admin.html en PDF via chromium (Playwright).
import { chromium } from 'playwright';
import path from 'path';

const htmlPath = 'file://' + path.resolve('guide-admin.html').replace(/\\/g, '/');
const out = 'Guide-Administrateur-Portail-RH.pdf';

// Chromium embarqué si disponible, sinon le Chrome installé sur la machine.
let browser;
try {
  browser = await chromium.launch();
} catch {
  browser = await chromium.launch({ channel: 'chrome' });
}
const page = await browser.newPage();
await page.goto(htmlPath, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200); // laisser les images se charger
await page.pdf({
  path: out,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
});
await browser.close();
console.log('✅ PDF généré : ' + out);
process.exit(0);
