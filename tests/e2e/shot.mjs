// Capture d'écran d'une URL locale : node tests/e2e/shot.mjs <url> <fichier> [largeur] [hauteur]
import { chromium } from 'playwright';
const [url, out, w = 800, h = 900] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
await page.waitForTimeout(Number(process.env.WAIT ?? 1500));
await page.screenshot({ path: out });
if (errors.length) console.log('ERREURS:', errors.join('\n'));
await browser.close();
