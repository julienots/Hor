import { loadSave, writeSave, resetProgress } from './save.js';
import { GameRenderer } from './render/renderer.js';
import { AudioEngine } from './audio/audio.js';
import { Game } from './game.js';
import { NIGHTS } from './sim/nights.js';
import { LORE, FRAGMENTS } from './sim/story.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const save = loadSave();
const settings = save.settings;

let renderer;
try {
  renderer = new GameRenderer($('gl'), settings);
} catch (err) {
  const d = document.createElement('div');
  d.className = 'gl-error';
  d.textContent = "WebGL n'est pas disponible sur cet appareil ou ce navigateur. Le jeu ne peut pas démarrer.";
  document.body.appendChild(d);
  throw err;
}
const audio = new AudioEngine(settings);
let game = null;
let mode = 'splash'; // splash | menu | files | game
let screenStack = [];
const MASCOTS = ['mc', 'mimi', 'roi', 'ruban', 'choeur'];
const SPECIAL = { mc: ['present', 'Présentation'], mimi: ['crawl', 'Ramper'], roi: ['sabotage', 'Sabotage'], ruban: ['peek', 'Ruban'], choeur: ['sing', 'Chant'] };
let showcaseIdx = 0, showcaseTimer = 0, fileIdx = 0;

// ---------------- Navigation entre écrans ----------------
function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('active', s.id === id);
}
function openPanel(id) { screenStack.push(document.querySelector('.screen.active')?.id ?? 'menu'); show(id); }
function back() {
  const prev = screenStack.pop() ?? 'menu';
  if (prev === 'pause' && game) { $('pause').classList.add('active'); $('settings').classList.remove('active'); $('hud').classList.add('active'); return; }
  show(prev);
}

function goMenu() {
  if (game) { game.destroy(); game = null; }
  mode = 'menu';
  screenStack = [];
  show('menu');
  const cont = $('btn-continue');
  const n = Math.min(save.lastNight, save.unlocked);
  cont.textContent = `Continuer — Nuit ${n}`;
  cont.style.display = save.completed.length || save.lastNight > 1 ? '' : 'none';
  $('menu-foot').textContent = `Fragments dorés : ${save.fragments.length}/${FRAGMENTS.length} · Nuits terminées : ${save.completed.length}`;
  renderer.resetCameras();
  renderer.showcase(MASCOTS[showcaseIdx], 'idle');
  audio.startAmbience('menu');
}

function startNight(n) {
  if (game) game.destroy();
  mode = 'game';
  screenStack = [];
  show('hud');
  save.lastNight = n;
  writeSave(save);
  game = new Game({ renderer, audio, save, night: n, onExit: goMenu });
}

function renderNights() {
  const list = $('night-list');
  list.innerHTML = '';
  for (const n of NIGHTS) {
    const b = document.createElement('button');
    b.className = 'btn';
    const locked = n.id > save.unlocked;
    b.disabled = locked;
    b.innerHTML = `${locked ? '🔒 ' : save.completed.includes(n.id) ? '✔ ' : ''}${n.title.split(' — ')[0]}<span>${locked ? 'Verrouillée' : n.title.split(' — ')[1]}</span>`;
    b.onclick = () => startNight(n.id);
    list.appendChild(b);
  }
  $('frag-count').textContent = `Fragments de partition dorés trouvés : ${save.fragments.length}/${FRAGMENTS.length}. Ils se cachent dans les caméras… à certaines heures.`;
}

function renderFile() {
  const key = MASCOTS[fileIdx];
  const lore = LORE[key];
  $('file-name').textContent = lore.name;
  $('file-bio').textContent = lore.bio;
  const met = save.completed.length + 1 >= { mc: 1, mimi: 1, roi: 2, ruban: 3, choeur: 4 }[key];
  $('file-rule').textContent = met ? 'Contre-mesure : ' + lore.rule : 'Contre-mesure : ??? (rencontre-le d\'abord)';
  const box = $('anim-buttons');
  box.innerHTML = '';
  const clips = [['idle', 'Repos'], ['walk', 'Marche'], ['observe', 'Observation'], SPECIAL[key], ['attack', 'Attaque'], ['jumpscare', 'Jumpscare'], ['stunned', 'Désactivation']];
  for (const [clip, label] of clips) {
    const b = document.createElement('button');
    b.className = 'btn small';
    b.textContent = label;
    b.onclick = () => { renderer.chars[key].rig.play(clip, { restart: true }); if (clip === 'jumpscare') audio.scream(key); };
    box.appendChild(b);
  }
  renderer.showcase(key, 'idle');
}

// ---------------- Paramètres ----------------
function bindSettings() {
  for (const el of document.querySelectorAll('[data-set]')) {
    const k = el.dataset.set;
    if (el.type === 'checkbox') el.checked = !!settings[k]; else el.value = settings[k];
    el.addEventListener('input', () => {
      settings[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value;
      writeSave(save);
      audio.applyVolumes();
      if (k === 'quality') renderer.applyQuality();
      $('fps').classList.toggle('show', settings.showFps);
    });
  }
  $('fps').classList.toggle('show', settings.showFps);
  // Confirmation intégrée à la page (les boîtes de dialogue du navigateur peuvent être bloquées).
  const reset = $('btn-reset');
  let armed = null;
  reset.onclick = () => {
    if (!armed) {
      reset.textContent = 'Confirmer : tout effacer (nuits et fragments) ?';
      armed = setTimeout(() => { armed = null; reset.textContent = 'Effacer la progression'; }, 4000);
      return;
    }
    clearTimeout(armed); armed = null;
    reset.textContent = 'Effacer la progression';
    resetProgress(save);
    goMenu();
  };
}

// ---------------- Actions des boutons ----------------
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  audio.unlock();
  audio.play('click', { side: 'C', vol: 0.5 });
  const a = b.dataset.action;
  if (a === 'continue') startNight(Math.min(save.lastNight, save.unlocked));
  else if (a === 'new') startNight(1);
  else if (a === 'nights') { renderNights(); openPanel('nights'); }
  else if (a === 'files') { mode = 'files'; fileIdx = 0; openPanel('files'); renderFile(); }
  else if (a === 'settings') {
    if (game) { screenStack.push('pause'); $('pause').classList.remove('active'); $('settings').classList.add('active'); }
    else openPanel('settings');
  }
  else if (a === 'credits') openPanel('credits');
  else if (a === 'back') { if (mode === 'files') { mode = 'menu'; renderer.showcase(MASCOTS[showcaseIdx], 'idle'); } back(); }
  else if (a === 'resume') game?.pause(false);
  else if (a === 'quit') goMenu();
  else if (a === 'retry') startNight(game?.night ?? 1);
  else if (a === 'next') startNight(Math.min(6, (game?.night ?? 0) + 1));
});
$('file-prev').onclick = () => { fileIdx = (fileIdx + MASCOTS.length - 1) % MASCOTS.length; renderFile(); };
$('file-next').onclick = () => { fileIdx = (fileIdx + 1) % MASCOTS.length; renderFile(); };
$('splash-start').onclick = () => { audio.unlock(); goMenu(); };

// ---------------- Entrées ----------------
addEventListener('keydown', (e) => {
  if (e.key === 'F3') { e.preventDefault(); settings.debug = !settings.debug; writeSave(save); return; }
  if (mode === 'game' && game) game.onKey(e);
});
addEventListener('keyup', (e) => { if (mode === 'game' && game) game.onKeyUp(e); });
const walking = () => mode === 'game' && game && game.walking && !game.paused && !game.ended;
const canvas = renderer.canvas;
let down = null;
canvas.addEventListener('pointerdown', (e) => {
  if (walking()) { game.onWalkPointer('down', e); return; }
  down = { x: e.clientX, y: e.clientY, lx: e.clientX, moved: 0 };
});
addEventListener('pointermove', (e) => {
  if (walking()) { game.onWalkPointer('move', e); return; }
  if (mode !== 'game' || !game) return;
  if (e.pointerType === 'mouse') game.onPointerMove(e.clientX, e.clientY, 'mouse', 0);
  else if (down) { const dx = e.clientX - down.lx; down.lx = e.clientX; down.moved += Math.abs(dx); game.onPointerMove(e.clientX, e.clientY, 'touch', dx); }
});
addEventListener('pointerup', (e) => {
  if (walking()) { game.onWalkPointer('up', e); return; }
  if (down && down.moved < 12 && e.target === canvas && mode === 'game' && game) game.onTap(e.clientX, e.clientY);
  down = null;
});
addEventListener('pointercancel', (e) => { if (walking()) game.onWalkPointer('cancel', e); });
document.addEventListener('visibilitychange', () => { if (document.hidden && game && !game.ended) game.pause(true); });

// ---------------- Boucle principale ----------------
let last = performance.now(), fpsAcc = 0, fpsN = 0;
function frame(now) {
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
  last = now;
  if (mode === 'game' && game) {
    game.update(dt);
  } else if (mode === 'menu' || mode === 'splash' || mode === 'files') {
    if (mode === 'menu') {
      showcaseTimer += dt;
      if (showcaseTimer > 14) { showcaseTimer = 0; showcaseIdx = (showcaseIdx + 1) % MASCOTS.length; renderer.static = 1; renderer.showcase(MASCOTS[showcaseIdx], SPECIAL[MASCOTS[showcaseIdx]][0]); }
    }
    renderer.post.uniforms.uCam.value = mode === 'menu' ? 1 : 0;
    renderer.post.uniforms.uStatic.value = Math.min(1, renderer.static);
    renderer.updateShowcase(dt, mode === 'files' ? 1.2 : 0.4);
    renderer.update(dt, null);
  }
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { $('fps').textContent = `${Math.round(fpsN / fpsAcc)} FPS`; fpsAcc = 0; fpsN = 0; }
  requestAnimationFrame(frame);
}
bindSettings();
renderer.showcase('mc', 'present');
requestAnimationFrame(frame);
window.__ready = true;
window.__nightshift = { get game() { return game; }, renderer, audio, save, startNight, goMenu };
