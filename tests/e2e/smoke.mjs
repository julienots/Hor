// Test de fumée dans Chromium : menu, nuit 1, portes, lumières, caméras, jumpscare, victoire.
// Usage : node tests/e2e/smoke.mjs [url] [dossier_captures]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5173/';
const out = process.argv[3] ?? 'test-results';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('fonts.g')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'OK  ' : 'ÉCHEC'} ${name} ${extra}`); };
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
const wait = (ms) => page.waitForTimeout(ms);

await page.goto(url);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
await shot('01-splash');
await page.click('#splash-start');
await wait(1500);
check('Menu principal affiché', await page.isVisible('#menu'));
await shot('02-menu');

// Dossiers des mascottes
await page.click('[data-action=files]');
await wait(1200);
check('Dossiers : nom affiché', (await page.textContent('#file-name')).length > 3);
await shot('03-dossier-mc');
for (let i = 0; i < 4; i++) { await page.click('#file-next'); await wait(900); await shot(`03-dossier-${i + 2}`); }
await page.click('#files [data-action=back]');
await wait(400);

// Nouvelle partie
await page.click('[data-action=new]');
await wait(2500);
check('HUD de jeu affiché', await page.isVisible('#hud'));
check('Bande d\'Odile affichée', await page.isVisible('#tape'));
await shot('04-cabine');
// Regard à gauche + lumière
await page.mouse.move(10, 360);
await wait(800);
await page.keyboard.press('a');
await wait(600);
await shot('05-lumiere-ouest');
const lightOn = await page.evaluate(() => window.__nightshift.game.sim.office.lightW);
check('Lumière ouest allumée (touche A)', lightOn);
await page.keyboard.press('q');
await wait(900);
check('Porte ouest fermée (touche Q)', await page.evaluate(() => window.__nightshift.game.sim.office.doorW));
await shot('06-porte-ouest');
await page.keyboard.press('q');
await page.keyboard.press('a');
await page.mouse.move(640, 360);
await wait(600);
// Volet du conduit
await page.click('#ctl-vent');
await wait(700);
check('Volet fermé (bouton)', await page.evaluate(() => window.__nightshift.game.sim.office.vent));
await shot('07-volet');
await page.click('#ctl-vent');
// Caméras
await page.keyboard.press(' ');
await wait(1200);
check('Caméras ouvertes', await page.isVisible('#camui'));
await shot('08-cam01');
const cams = ['CAM02', 'CAM03', 'CAM04', 'CAM05', 'CAM06', 'CAM07', 'CAM08', 'CAM09', 'CAM10'];
for (const c of cams) {
  await page.click(`#cam-map button[data-cam=${c}]`);
  await wait(1300);
  await shot(`09-${c}`);
}
check('Sélection de la CAM10', await page.evaluate(() => window.__nightshift.game.sim.office.cam === 'CAM10'));
await page.keyboard.press(' ');
await wait(600);
check('Caméras fermées', !(await page.isVisible('#camui')));

// Mascottes aux portes (forçage de l'état pour vérifier le rendu)
await page.evaluate(() => { const s = window.__nightshift.game.sim; s.enemies.mc.level = 1; s.enemies.mc.room = 'DOOR_W'; s.enemies.mc.state = 'atDoor'; s.enemies.mc.timer = 999; s.enemies.mc.pose = 'peek'; });
await page.mouse.move(5, 360);
await page.keyboard.press('a');
await wait(1200);
await shot('10-mc-porte');
await page.keyboard.press('a');
await page.evaluate(() => { const s = window.__nightshift.game.sim; s.enemies.ruban.level = 1; s.enemies.ruban.room = 'DOOR_E'; s.enemies.ruban.state = 'atDoor'; s.enemies.ruban.timer = 999; s.enemies.ruban.pose = 'peek'; });
await page.mouse.move(1275, 360);
await page.keyboard.press('e');
await wait(1200);
await shot('11-ruban-porte');
await page.keyboard.press('e');
await page.evaluate(() => { const s = window.__nightshift.game.sim; s.enemies.mimi.level = 1; s.enemies.mimi.room = 'VENT_MOUTH'; s.enemies.mimi.depth = 3; s.enemies.mimi.state = 'atDoor'; s.enemies.mimi.timer = 999; s.enemies.mimi.pose = 'peek'; });
await page.mouse.move(560, 360);
await wait(1200);
await shot('12-mimi-conduit');

// Jumpscare : on laisse le Maître de Cérémonie entrer porte ouverte
await page.evaluate(() => { const s = window.__nightshift.game.sim; s.grace = 0; s.enemies.mc.timer = 0.05; });
await wait(500);
await shot('13-jumpscare');
await wait(2200);
check('Écran de fin de service', await page.isVisible('#gameover'));
await shot('14-gameover');

// Victoire : nuit 1 accélérée
await page.click('#gameover [data-action=retry]');
await wait(1000);
await page.evaluate(() => { const s = window.__nightshift.game.sim; for (const e of s.list) e.level = 0; s.refreshLevels = () => {}; s.time = s.hourSeconds * 6 - 0.5; });
await page.waitForSelector('#win.active', { timeout: 20000 }).catch(() => {});
check('Écran de victoire 06:00', await page.isVisible('#win'));
await shot('15-victoire');
check('Sauvegarde : nuit 2 débloquée', await page.evaluate(() => window.__nightshift.save.unlocked >= 2));
// Paramètres
await page.click('#win [data-action=quit]');
await wait(800);
await page.click('[data-action=settings]');
await wait(500);
check('Paramètres affichés', await page.isVisible('#settings'));
await shot('16-parametres');

// Mesure des performances (logiciel, sans GPU : indicatif seulement)
const fps = await page.evaluate(async () => { let n = 0; const t0 = performance.now(); await new Promise((r) => { const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); }); return (n / ((performance.now() - t0) / 1000)).toFixed(1); });
console.log(`Images/s en rendu logiciel (SwiftShader, sans GPU) : ${fps}`);
check('Aucune erreur JavaScript', errors.length === 0, errors.slice(0, 5).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} vérifications réussies`);
process.exit(failed ? 1 : 0);
