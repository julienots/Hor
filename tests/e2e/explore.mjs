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
await page.keyboard.down('z');
await page.waitForFunction(() => window.__nightshift.game.sim.player.room === 'HALL_W', null, { timeout: 60000 }).catch(() => {});
await page.keyboard.up('z');
await wait(500);
check('Porte ouest franchie → couloir ouest', await ev(() => window.__nightshift.game.sim.player.room === 'HALL_W'), await ev(() => window.__nightshift.game.sim.player.room));
await page.keyboard.press('f');
await wait(900);
check('Lampe torche allumée (F)', await ev(() => window.__nightshift.game.sim.player.flashlight));
await page.screenshot({ path: `${out}/02-couloir-ouest.png` });
// téléporte devant la porte du fond (salle de fête) et avance
await ev(() => { const e = window.__nightshift.renderer.explore; e.x = -8.2; e.z = -10.8; e.yaw = 0; });
await page.keyboard.down('z');
await page.waitForFunction(() => window.__nightshift.game.sim.player.room === 'PARTY', null, { timeout: 30000 }).catch(() => {});
await page.keyboard.up('z');
await wait(500);
check('Couloir → salle de fête', await ev(() => window.__nightshift.game.sim.player.room === 'PARTY'));
await page.screenshot({ path: `${out}/03-salle-de-fete.png` });
// collision : impossible de traverser une table
const pos = await ev(() => { const r = window.__nightshift.renderer; r.explore.x = -8; r.explore.z = -19.6; r.explore.yaw = Math.PI; for (let i = 0; i < 60; i++) r.walk(0.05, 1, 0, 2, {}); return [r.explore.x, r.explore.z]; });
check('Collision avec la table', pos[1] < -18.9, JSON.stringify(pos));
// Le joueur ne traverse pas les murs
const wall = await ev(() => { const r = window.__nightshift.renderer; r.explore.x = -6; r.explore.z = -12.7; r.explore.yaw = -Math.PI / 2; for (let i = 0; i < 200; i++) r.walk(0.05, 1, 0, 2, {}); return r.explore.x; });
check('Mur de la salle de fête infranchissable hors des portes', wall > -0.6 && wall < 0.01, wall.toFixed(2));
// Vers la scène, regarder le Maître de Cérémonie
// Marche continue de la salle de fête jusqu'à la scène, par la porte du fond
await ev(() => { const e = window.__nightshift.renderer.explore; e.x = -2; e.z = -18.5; e.yaw = 0; e.pitch = 0; });
await page.keyboard.down('z');
await page.waitForFunction(() => window.__nightshift.game.sim.player.room === 'STAGE', null, { timeout: 30000 }).catch(() => {});
await page.keyboard.up('z');
await wait(500);
check('Passage continu salle de fête → scène (sans fondu)', await ev(() => window.__nightshift.game.sim.player.room === 'STAGE'), await ev(() => window.__nightshift.game.sim.player.room));
await page.screenshot({ path: `${out}/03b-porte-scene.png` });
await ev(() => { const r = window.__nightshift.renderer; const g = window.__nightshift.game; r.explore.x = -6.5; r.explore.z = -23; r.explore.yaw = 0; r.explore.pitch = 0.05; g.sim.enemies.mc.level = 5; g.sim.enemies.mc.tickInterval = 1e9; g.sim.enemies.mc.tickTimer = 1e9; g.sim.grace = 0; for (const k of ['mimi','roi','ruban','choeur']) g.sim.enemies[k].level = 0; g.sim.refreshLevels = () => {}; });
await wait(2000);
await page.screenshot({ path: `${out}/04-scene-mc-lampe.png` });
check('Le joueur regarde le Maître (lampe)', await ev(() => window.__nightshift.game.sim.player.looking === 'mc'));
check('Lampe sur le Maître : pas de détection', await ev(() => window.__nightshift.game.sim.player.detection < 0.05));
// Lampe éteinte → la jauge monte, il approche
await page.keyboard.press('f');
await page.waitForFunction(() => window.__nightshift.game.sim.player.detection > 0.2 || window.__nightshift.game.ended, null, { timeout: 20000 }).catch(() => {});
const det = await ev(() => window.__nightshift.game.sim.player.detection);
check('Sans lampe, la jauge de danger monte', det > 0.2 || (await ev(() => window.__nightshift.game.ended)), det.toFixed(2));
await page.screenshot({ path: `${out}/05-danger.png` });
await page.waitForSelector('#gameover.active', { timeout: 90000 }).catch(() => {});
check('Rester trop longtemps → attrapé', await page.isVisible('#gameover'));
await page.screenshot({ path: `${out}/06-attrape.png` });
// Toutes les liaisons se traversent à pied, dans les deux sens
await ev(() => window.__nightshift.startNight(3));
const conn = await ev(() => {
  const { layout, roomAt, renderer: r, game: g } = window.__nightshift;
  g.sim.grace = 1e9; g.standUp();
  const res = [];
  for (const [a, wa, b, wb, at] of layout.CONNECTIONS) {
    for (const [from, wf, to, wt] of [[a, wa, b, wb], [b, wb, a, wa]]) {
      const pf = layout.wallPos(from, wf), pt = layout.wallPos(to, wt);
      const x = layout.isXWall(wf);
      const dir = (Math.abs(pt - pf) > 0.01 ? Math.sign(pt - pf) : 0) || Math.sign(pf - (from === 'OFFICE' ? 0 : (x ? layout.ROOM_POS[from][0] : layout.ROOM_POS[from][1])));
      const start = pf - dir * 1.2;
      Object.assign(r.explore, x ? { x: start, z: at } : { x: at, z: start });
      r.explore.yaw = x ? (dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (dir > 0 ? Math.PI : 0);
      const startRoom = roomAt(r.explore.x, r.explore.z);
      let reached = null;
      for (let i = 0; i < 200 && !reached; i++) { const w = r.walk(0.05, 1, 0, 2, {}); if (w.room === to) reached = to; }
      res.push(`${from}→${to}:${startRoom === from && reached === to ? 'ok' : 'NON(' + startRoom + ')'}`);
    }
  }
  return res;
});
const bad = conn.filter((c) => !c.endsWith('ok'));
check(`Les ${conn.length} passages entre salles se traversent`, bad.length === 0, bad.join(' '));
await ev(() => { const e = window.__nightshift.renderer.explore; e.x = -4; e.z = -0.2; e.yaw = Math.PI / 2; window.__nightshift.game.sim.player.flashlight = true; });
await wait(1200);
await page.screenshot({ path: `${out}/08-couloir-cabine-vers-ouest.png` });
await ev(() => { const g = window.__nightshift.game; const r = g.r; g.sim.setPlayerRoom('PARTY'); r.setExploreRoom('PARTY'); Object.assign(r.explore, { x: -3, z: -14, yaw: -Math.PI / 2 + 0.25 }); });
await wait(1200);
await page.screenshot({ path: `${out}/09-fete-vers-reception.png` });
await ev(() => { const g = window.__nightshift.game; const r = g.r; g.sim.setPlayerRoom('PARTY'); r.setExploreRoom('PARTY'); Object.assign(r.explore, { x: -2, z: -16.5, yaw: 0 }); });
await wait(1200);
await page.screenshot({ path: `${out}/10-fete-vers-scene.png` });
// Autres salles (captures)
for (const [room, from] of [['KITCHEN', 'PARTY'], ['WORKSHOP', 'HALL_W'], ['GENERATOR', 'HALL_E'], ['BACKSTAGE', 'STAGE'], ['LOBBY', 'PARTY'], ['HALL_E', 'OFFICE']]) {
  await ev(() => window.__nightshift.startNight(3));
  await ev(([room, from]) => { const g = window.__nightshift.game; g.sim.grace = 1e9; document.getElementById('tape').style.display = 'none'; g.standUp(); const p = { KITCHEN: [4.5, -7.5, 1.9], WORKSHOP: [-11, -7, 1.6], GENERATOR: [11.5, -6, -1.6], BACKSTAGE: [0.5, -23, -1.6], LOBBY: [5.5, -13, 0.4], HALL_E: [8.2, 0.5, 0] }[room]; Object.assign(g.r.explore, { x: p[0], z: p[1], yaw: p[2] }); g.sim.player.flashlight = true; }, [room, from]);
  await wait(1200);
  await page.screenshot({ path: `${out}/07-${room}.png` });
}
check('Aucune erreur JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} vérifications réussies`);
process.exit(results.every(Boolean) ? 0 : 1);
