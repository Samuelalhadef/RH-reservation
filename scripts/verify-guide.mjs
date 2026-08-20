import { chromium } from 'playwright';
import path from 'path';
const url = 'file://' + path.resolve('guide-admin.html').replace(/\\/g, '/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 820, height: 1160 } });
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
await p.screenshot({ path: 'guide-screenshots/_verify-cover.png' });        // haut = couverture
const c5 = await p.$('#c5');
if (c5) await c5.scrollIntoViewIfNeeded();
await p.waitForTimeout(400);
await p.screenshot({ path: 'guide-screenshots/_verify-chapter.png' });
await b.close();
console.log('verify shots done');
process.exit(0);
