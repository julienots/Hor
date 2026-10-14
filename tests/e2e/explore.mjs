// Test navigateur de l'exploration à pied : node tests/e2e/explore.mjs [url] [dossier]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const url = process.argv[2] ?? 'http://localhost:5173/';
const out = process.argv[3] ?? 'test-results/explore';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 560 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('fonts.g')) errors.push(m.text()); });
const results = [];
const check = (n, ok, x = '') => { results.push(ok); console.log(`${ok ? 'OK  ' : 'ÉCHEC'} ${n} ${x}`); };
const ev = (f, a) => page.evaluate(f, a);
const wait = (ms) => page.waitForTimeout(ms);
await page.goto(url);
await page.waitForFunction(() => window.__ready === true);
await page.click('#splash-start');
await ev(() => window.__nightshift.startNight(3));
await ev(() => { const g = window.__nightshift.game; g.sim.grace = 1e9; document.getElementById('tape').style.display = 'none'; });
await page.keyboard.press('g');
await wait(800);
check('Se lever (G) : mode exploration', await ev(() => window.__nightshift.game.walking && !!window.__nightshift.renderer.explore));
await page.screenshot({ path: `${out}/01-debout-cabine.png` });
// vers la porte ouest
await ev(() => { const e = window.__nightshift.renderer.explore; e.x = -2.0; e.z = -0.2; e.yaw = Math.PI / 2; });
await page.keyboard.down('z'); await wait(1500); await page.keyboard.up('z');
await wait(800);
check('Porte ouest franchie → couloir ouest', await ev(() => window.__nightshift.game.sim.player.room === 'HALL_W'), await ev(() => window.__nightshift.game.sim.player.room));
await page.keyboard.press('f');
await wait(900);
check('Lampe torche allumée (F)', await ev(() => window.__nightshift.game.sim.player.flashlight));
await page.screenshot({ path: `${out}/02-couloir-ouest.png` });
// téléporte devant la porte du fond (salle de fête) et avance
await ev(() => { const e = window.__nightshift.renderer.explore; e.x = 0; e.z = -6.2; e.yaw = 0; });
await page.keyboard.down('z'); await wait(1200); await page.keyboard.up('z');
await wait(800);
check('Couloir → salle de fête', await ev(() => window.__nightshift.game.sim.player.room === 'PARTY'));
await page.screenshot({ path: `${out}/03-salle-de-fete.png` });
// collision : impossible de traverser une table
const pos = await ev(() => { const r = window.__nightshift.renderer; r.explore.x = -2; r.explore.z = -3.6; r.explore.yaw = Math.PI; for (let i = 0; i < 60; i++) r.walk(0.05, 1, 0, 2); return [r.explore.x, r.explore.z]; });
check('Collision avec la table', pos[1] < -2.9, JSON.stringify(pos));
// Vers la scène, regarder le Maître de Cérémonie
await ev(() => { const r = window.__nightshift.renderer; const g = window.__nightshift.game; g.sim.setPlayerRoom('STAGE'); r.enterRoom('STAGE', 'PARTY'); r.explore.x = -0.5; r.explore.z = 1.5; r.explore.yaw = 0; r.explore.pitch = 0.05; g.sim.enemies.mc.level = 5; g.sim.grace = 0; for (const k of ['mimi','roi','ruban','choeur']) g.sim.enemies[k].level = 0; g.sim.refreshLevels = () => {}; });
await wait(2000);
await page.screenshot({ path: `${out}/04-scene-mc-lampe.png` });
check('Le joueur regarde le Maître (lampe)', await ev(() => window.__nightshift.game.sim.player.looking === 'mc'));
check('Lampe sur le Maître : pas de détection', await ev(() => window.__nightshift.game.sim.player.detection < 0.05));
// Lampe éteinte → la jauge monte, il approche
await page.keyboard.press('f');
await wait(3500);
const det = await ev(() => window.__nightshift.game.sim.player.detection);
check('Sans lampe, la jauge de danger monte', det > 0.2, det.toFixed(2));
await page.screenshot({ path: `${out}/05-danger.png` });
await page.waitForSelector('#gameover.active', { timeout: 40000 }).catch(() => {});
check('Rester trop longtemps → attrapé', await page.isVisible('#gameover'));
await page.screenshot({ path: `${out}/06-attrape.png` });
// Autres salles (captures)
for (const [room, from] of [['KITCHEN', 'PARTY'], ['WORKSHOP', 'HALL_W'], ['GENERATOR', 'HALL_E'], ['BACKSTAGE', 'STAGE'], ['LOBBY', 'PARTY'], ['HALL_E', 'OFFICE']]) {
  await ev(() => window.__nightshift.startNight(3));
  await ev(([room, from]) => { const g = window.__nightshift.game; g.sim.grace = 1e9; document.getElementById('tape').style.display = 'none'; g.standUp(); g.sim.setPlayerRoom(room); g.r.enterRoom(room, from); g.sim.player.flashlight = true; }, [room, from]);
  await wait(1200);
  await page.screenshot({ path: `${out}/07-${room}.png` });
}
check('Aucune erreur JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} vérifications réussies`);
process.exit(results.every(Boolean) ? 0 : 1);
