// Capture automatique des écrans pour le guide administrateur.
// Base locale de démo + Playwright (chromium). Usage : node scripts/capture-guide.mjs
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:3000';
const OUT = 'guide-screenshots';
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const log = (m) => console.log(m);

async function shot(page, name, { full = true } = {}) {
  try {
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
    results.push({ name, ok: true });
    log(`  ✓ ${name}`);
  } catch (e) {
    results.push({ name, ok: false, err: e.message });
    log(`  ✗ ${name} — ${e.message}`);
  }
}

async function login(page, prenom, nom, password) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('input[placeholder="Rechercher votre nom…"]', { timeout: 15000 });
  await page.fill('input[placeholder="Rechercher votre nom…"]', nom);
  await page.waitForTimeout(400);
  await page.click(`button:has-text("${prenom} ${nom}")`);
  await page.waitForSelector('input[type="password"]', { timeout: 8000 });
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Se connecter")');
  await page.waitForURL('**/dashboard**', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1600);
}

// Navigation via la navbar (router.push côté client → garde la session)
async function nav(page, label, wait = 1800) {
  try {
    await page.locator(`button:visible:has-text("${label}")`).first().click({ timeout: 8000 });
    await page.waitForTimeout(wait);
    return true;
  } catch (e) { log(`  ! nav "${label}" échec: ${e.message.split('\n')[0]}`); return false; }
}

// Onglet dans l'interface RH (scopé au conteneur d'onglets pour éviter la navbar)
async function gotoTab(page, label, name, wait = 1800) {
  try {
    const tabsNav = page.locator('nav', { hasText: 'Toutes les demandes' });
    await tabsNav.locator(`button:has-text("${label}")`).first().click({ timeout: 8000 });
    await page.waitForTimeout(wait);
    await shot(page, name);
  } catch (e) {
    results.push({ name, ok: false, err: e.message });
    log(`  ✗ ${name} — onglet "${label}" introuvable`);
  }
}

const browser = await chromium.launch();

// ============ ADMIN / RH (Marie Dupont) ============
log('ADMIN (Marie Dupont, RH)');
const ctxAdmin = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const admin = await ctxAdmin.newPage();

// 1. Écran de connexion (sélection du nom)
await admin.goto(BASE + '/', { waitUntil: 'networkidle' });
await admin.waitForSelector('input[placeholder="Rechercher votre nom…"]', { timeout: 15000 });
await shot(admin, '01-login-selection', { full: false });

// 2. Écran mot de passe
await admin.fill('input[placeholder="Rechercher votre nom…"]', 'Dupont');
await admin.waitForTimeout(400);
await admin.click('button:has-text("Marie Dupont")');
await admin.waitForSelector('input[type="password"]', { timeout: 8000 });
await shot(admin, '02-login-password', { full: false });

// 3. Connexion → tableau de bord
await admin.fill('input[type="password"]', 'chartrettes2026');
await admin.click('button:has-text("Se connecter")');
await admin.waitForURL('**/dashboard**', { timeout: 20000 }).catch(() => {});
await admin.waitForTimeout(1800);
await shot(admin, '03-admin-dashboard');

// 4. Validation (via navbar)
await nav(admin, 'Validation');
await shot(admin, '13-validation');

// 5. Calendrier équipe
await nav(admin, 'Calendrier équipe');
await shot(admin, '14-calendrier-equipe');

// 6. Interface RH (via navbar → garde la session)
await nav(admin, 'Interface RH', 2200);
await admin.locator('nav', { hasText: 'Toutes les demandes' }).first().waitFor({ timeout: 8000 }).catch(() => {});
await admin.waitForTimeout(1200);
await shot(admin, '04-rh-toutes-demandes');

await gotoTab(admin, 'Statistiques', '05-rh-statistiques', 3200);
await gotoTab(admin, 'Utilisateurs', '06-rh-utilisateurs', 1800);

// 6b. Modale de création d'utilisateur
try {
  await admin.locator('button:visible:has-text("Créer un utilisateur")').first().click({ timeout: 5000 });
  await admin.waitForTimeout(1200);
  await shot(admin, '07-rh-creer-utilisateur');
  await admin.locator('button:visible:has-text("Annuler")').first().click({ timeout: 3000 }).catch(() => admin.keyboard.press('Escape'));
  await admin.waitForTimeout(600);
} catch (e) { log('  ! modale création utilisateur non ouverte'); }

await gotoTab(admin, 'Demandes CET', '08-rh-demandes-cet', 1600);
await gotoTab(admin, 'Soldes CET', '09-rh-soldes-cet', 1600);
await gotoTab(admin, 'Récupération', '10-rh-recuperation', 1800);
await gotoTab(admin, 'Parentalité', '11-rh-parentalite', 1600);
await gotoTab(admin, 'Créer un congé', '12-rh-creer-conge', 1600);

await ctxAdmin.close();

// ============ AGENT temps partiel (Sophie Durand) ============
log('AGENT temps partiel (Sophie Durand)');
const ctxSophie = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const sophie = await ctxSophie.newPage();
await login(sophie, 'Sophie', 'Durand', 'chartrettes2026');
await shot(sophie, '15-agent-dashboard-tempspartiel');
await ctxSophie.close();

// ============ AGENT (Jean Martin) ============
log('AGENT (Jean Martin)');
const ctxJean = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const jean = await ctxJean.newPage();
await login(jean, 'Jean', 'Martin', 'chartrettes2026');
await shot(jean, '16-agent-dashboard-recup');
await nav(jean, 'Mes demandes');
await shot(jean, '17-agent-mes-demandes');
await nav(jean, 'Récupération');
await shot(jean, '18-agent-recuperation');
await ctxJean.close();

await browser.close();

const ok = results.filter(r => r.ok).length;
log(`\n=== ${ok}/${results.length} captures réussies ===`);
if (results.some(r => !r.ok)) log('Échecs : ' + results.filter(r => !r.ok).map(r => r.name).join(', '));
process.exit(0);
