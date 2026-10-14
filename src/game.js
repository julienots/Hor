import { Vector3 as THREE_V } from 'three';
import { Simulation } from './sim/simulation.js';
import { CAMERAS, ROOMS, camRoom } from './sim/map.js';
import { NIGHT_MESSAGES, LORE, ENDINGS, FRAGMENTS } from './sim/story.js';
import { captionFor } from './sim/captions.js';
import { writeSave } from './save.js';
import { nearArmoredDoor } from './render/walk.js';
import { CONNECTIONS, ROOM_POS, wallPos, isXWall } from './render/layout.js';
import { WALK_LINKS } from './sim/map.js';

const KEYS = ['mc', 'mimi', 'roi', 'ruban', 'choeur'];
const VOICE = { mc: 0.8, mimi: 1.6, roi: 0.55, ruban: 1.25, choeur: 0.9 };

const $ = (id) => document.getElementById(id);
const MAX_YAW = 1.2;

// Disposition de la carte des caméras (en % de la mini-carte).
const MAP_POS = {
  CAM10: [16, 12], CAM01: [46, 12], CAM02: [32, 36], CAM04: [72, 36], CAM03: [52, 58],
  CAM06: [20, 62], CAM07: [74, 62], CAM09: [92, 80], CAM05: [10, 88], CAM08: [27, 88],
};
const SIDE_MARK = { W: '◀ ', E: '', C: '▼ ', far: '' };
const SIDE_END = { E: ' ▶' };

const HINTS = {
  mcDoor: 'Quelque chose attend à la porte ouest. Allume la lumière (A) pour vérifier, puis ferme la porte (Q).',
  mimiVent: 'Tapotements juste devant toi : ferme le volet du conduit (S) !',
  roiGen: 'Grincements dans la salle des machines : ouvre la CAM 09 et envoie une décharge (X).',
  rubanDoor: "Bruissement de rubans à droite : éclaire la porte est (E) jusqu'à ce qu'elle recule.",
  choeurHall: 'Le Chœur approche : joue un leurre sonore (L) dans une salle éloignée de toi.',
  tamper: "Une caméra semble figée ? Regarde l'horodatage : s'il ne bouge plus, appuie sur Réinitialiser (R).",
  lowPower: 'Énergie faible : limite les portes, les lumières et les caméras.',
  explore: "Hors de la cabine, les mascottes te repèrent si tu restes près d'elles (bord rouge). La lampe (F) fige le Maître de Cérémonie et fait fuir Madame Ruban. Courir fait du bruit.",
  hunt: "Une mascotte a trouvé la cabine vide : elle te traque ! Reviens dans la cabine pour qu'elle abandonne.",
  cams: "Ouvre les caméras (Espace) pour surveiller le Maître de Cérémonie : il ne bouge pas tant que tu le regardes.",
};

/** Une nuit de jeu : relie la simulation, le rendu, l'audio et l'interface. */
export class Game {
  constructor({ renderer, audio, save, night, onExit }) {
    this.r = renderer;
    this.a = audio;
    this.save = save;
    this.night = night;
    this.onExit = onExit;
    this.sim = new Simulation({ night, seed: (Date.now() ^ (night * 7919)) >>> 0, collected: save.fragments, grace: night === 1 ? 40 : 12 });
    this.paused = false;
    this.ended = false;
    this.subs = [];
    this.tapeLines = [...(NIGHT_MESSAGES[night] ?? [])];
    this.tapeTimer = 0;
    this.hintTimer = 0;
    this.lastCam = null;
    this.debugTimer = 0;
    this.walking = false;
    this.presenceT = 3;
    this.phantomT = 40 + Math.random() * 40;
    this.lastSeen = {};
    this.keys = new Set();
    this.stick = { x: 0, y: 0, id: null };
    this.lookPtr = null;
    this.runToggle = false;
    this.stepAcc = 0;
    this.heartT = 0;
    this.r.resetCameras();
    this.r.yaw = this.r.targetYaw = 0;
    this.r.dark = 0;
    this.r.setOffice(this.sim);
    this.buildCamMap();
    this.bindHud();
    this.a.startAmbience('office');
    this.a.setCamHiss(false);
    $('hud-night').textContent = `Nuit ${night}${night === 6 ? ' (bonus)' : ''}`;
    $('hud').classList.remove('cams-open');
    this.nextTapeLine();
    this.toast(this.sim.nightCfg.title, 3500);
  }

  // ---------------- Interface ----------------
  buildCamMap() {
    const map = $('cam-map');
    map.innerHTML = '';
    const office = document.createElement('div');
    office.className = 'office';
    office.style.cssText = 'left:42%;top:80%;width:18%;height:14%';
    office.textContent = 'VOUS';
    map.appendChild(office);
    for (const c of CAMERAS) {
      const b = document.createElement('button');
      b.textContent = c.id.replace('CAM', 'CAM ');
      b.title = c.label;
      b.dataset.cam = c.id;
      const [x, y] = MAP_POS[c.id];
      b.style.left = x + '%'; b.style.top = y + '%';
      b.addEventListener('click', (e) => { e.stopPropagation(); this.selectCam(c.id); });
      map.appendChild(b);
    }
  }

  bindHud() {
    const on = (id, fn) => { const el = $(id); el.onclick = (e) => { e.stopPropagation(); this.a.unlock(); fn(); }; };
    on('ctl-doorW', () => this.sim.toggleDoor('W'));
    on('ctl-doorE', () => this.sim.toggleDoor('E'));
    on('ctl-lightW', () => this.toggleLight('W'));
    on('ctl-lightE', () => this.toggleLight('E'));
    on('ctl-vent', () => this.sim.toggleVent());
    on('ctl-cams', () => this.setCams(true));
    on('cam-close', () => this.setCams(false));
    on('cam-lure', () => this.lure());
    on('cam-shock', () => this.shock());
    on('cam-reset', () => { if (this.sim.resetCam()) this.a.play('blip', { side: 'far', vol: 0.5 }); });
    on('btn-pause', () => this.pause(true));
    on('tape-next', () => this.nextTapeLine());
    on('tape-skip', () => { this.tapeLines = []; this.nextTapeLine(); });
    on('ctl-stand', () => this.standUp());
    on('walk-sit', () => this.sitDown());
    on('walk-flash', () => this.toggleFlash());
    on('walk-run', () => { this.runToggle = !this.runToggle; $('walk-run').classList.toggle('on', this.runToggle); });
  }

  toggleLight(side) {
    const o = this.sim.office;
    const cur = side === 'W' ? o.lightW : o.lightE;
    const v = this.sim.setLight(side, !cur);
    if (v) this.r.targetYaw = side === 'W' ? MAX_YAW : -MAX_YAW; // tourne la tête vers la porte éclairée
    this.a.play('click', { side, vol: 0.6 });
  }

  setCams(open) {
    if (this.ended) return;
    const was = this.sim.office.camsOpen;
    const v = this.sim.setCams(open);
    if (v === was) return;
    this.a.play('blip', { side: 'C', vol: 0.6 });
    this.a.setCamHiss(v);
    this.r.static = 0.9;
    $('camui').classList.toggle('active', v);
    $('hud').classList.toggle('cams-open', v);
    document.body.classList.toggle('cams-open', v);
    if (v) { this.onCamChanged(); this.hint('cams', this.night === 1); }
    else this.r.setOffice(this.sim);
  }

  selectCam(id) {
    if (!this.sim.office.camsOpen) return;
    this.sim.selectCam(id);
    this.a.play('blip', { side: 'far', vol: 0.4 });
    this.r.static = 0.7;
    this.onCamChanged();
  }

  onCamChanged() {
    const id = this.sim.office.cam;
    if (this.lastCam !== id) this.r.rollAnomaly(camRoom(id));
    this.lastCam = id;
    for (const b of $('cam-map').querySelectorAll('button')) b.classList.toggle('sel', b.dataset.cam === id);
  }

  lure() {
    if (this.sim.playLure()) this.toast('Leurre sonore joué : ' + ROOMS[camRoom(this.sim.office.cam)].name, 1500);
    else this.a.play('click', { side: 'C', vol: 0.4 });
  }

  shock() {
    if (this.sim.office.cam !== 'CAM09') return;
    const hit = this.sim.shock();
    this.r.static = 1;
    if (hit) this.r.flash = 0.25;
  }

  toast(text, ms = 2000) {
    const t = $('toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(this.toastTO);
    this.toastTO = setTimeout(() => t.classList.remove('show'), ms);
  }

  hint(key, force = false) {
    if (this.night > 4 && !force) return;
    if (this.save.hintsSeen.includes(key)) return;
    this.save.hintsSeen.push(key);
    writeSave(this.save);
    const h = $('hint');
    h.textContent = '💡 ' + HINTS[key];
    h.classList.add('show');
    this.hintTimer = 7;
  }

  nextTapeLine() {
    const tape = $('tape');
    const line = this.tapeLines.shift();
    if (!line) { tape.classList.remove('show'); this.tapeTimer = 0; return; }
    $('tape-text').textContent = line;
    tape.classList.add('show');
    const secs = Math.min(11, 3 + line.length / 18);
    this.tapeTimer = secs;
    this.a.tapeMurmur(secs);
  }

  subtitle(text, fake, side) {
    if (!this.save.settings.subtitles) return;
    const el = document.createElement('div');
    el.textContent = (SIDE_MARK[side] ?? '') + '[' + text + ']' + (SIDE_END[side] ?? '');
    if (fake) el.className = 'fake';
    const box = $('subs');
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.remove(), 3800);
  }

  // ---------------- Entrées ----------------
  onKey(e) {
    if (this.ended) return;
    const k = e.key.toLowerCase();
    if (k === 'escape' || k === 'p') { this.pause(!this.paused); return; }
    if (this.paused) return;
    this.a.unlock();
    if (k === 'g') { this.walking ? this.sitDown() : this.standUp(); return; }
    if (this.walking) {
      this.keys.add(k);
      if (k === 'f') this.toggleFlash();
      if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
      return;
    }
    const o = this.sim.office;
    if (k === ' ' || k === 'tab') { e.preventDefault(); this.setCams(!o.camsOpen); return; }
    if (k === 'q') this.sim.toggleDoor('W');
    else if (k === 'd') this.sim.toggleDoor('E');
    else if (k === 'a') this.toggleLight('W');
    else if (k === 'e') this.toggleLight('E');
    else if (k === 's') this.sim.toggleVent();
    else if (k === 'l') this.lure();
    else if (k === 'x') this.shock();
    else if (k === 'r') { if (this.sim.resetCam()) this.a.play('blip', { side: 'far', vol: 0.5 }); }
    else if (k === 'arrowleft') this.r.targetYaw = Math.min(MAX_YAW, this.r.targetYaw + 0.4);
    else if (k === 'arrowright') this.r.targetYaw = Math.max(-MAX_YAW, this.r.targetYaw - 0.4);
    else if (/^[0-9]$/.test(k) && o.camsOpen) this.selectCam('CAM' + (k === '0' ? '10' : '0' + k));
  }

  onKeyUp(e) { this.keys.delete(e.key.toLowerCase()); }

  // ---------------- Exploration à pied ----------------
  standUp() {
    const o = this.sim.office;
    if (this.ended || this.walking || o.camsOpen) return;
    this.walking = true;
    this.sim.player.standing = true;
    this.r.startExplore('OFFICE', 0, 0.75, this.r.yaw);
    $('walkui').classList.add('active');
    $('hud').classList.add('walking');
    $('walk-room').textContent = 'Cabine de surveillance';
    this.hint('explore', true);
  }

  sitDown() {
    if (!this.walking) return;
    if (this.sim.player.room !== 'OFFICE') { this.toast("Retourne dans la cabine pour t'asseoir.", 1800); return; }
    const yaw = this.r.explore?.yaw ?? 0;
    this.walking = false;
    this.presenceT = 3;
    this.phantomT = 40 + Math.random() * 40;
    this.lastSeen = {};
    this.sim.player.standing = false;
    this.sim.player.running = false;
    this.r.stopExplore();
    this.r.yaw = this.r.targetYaw = Math.max(-MAX_YAW, Math.min(MAX_YAW, Math.atan2(Math.sin(yaw), Math.cos(yaw))));
    $('walkui').classList.remove('active');
    $('hud').classList.remove('walking');
    $('danger').style.opacity = 0;
    if (document.pointerLockElement) document.exitPointerLock?.();
  }

  toggleFlash() {
    const p = this.sim.player;
    p.flashlight = !p.flashlight;
    $('walk-flash').classList.toggle('on', p.flashlight);
    this.a.play('flashlight', { side: 'C', vol: 0.6 });
  }

  updateWalking(dt) {
    const sim = this.sim, r = this.r;
    const K = this.keys;
    const has = (...ks) => ks.some((k) => K.has(k));
    let fwd = (has('z', 'w', 'arrowup') ? 1 : 0) - (has('s', 'arrowdown') ? 1 : 0) - this.stick.y;
    let side = (has('d') ? 1 : 0) - (has('q', 'a') ? 1 : 0) + this.stick.x;
    const turn = (has('arrowleft') ? 1 : 0) - (has('arrowright') ? 1 : 0);
    if (turn) r.look(turn * dt * 2.2, 0);
    const mag = Math.hypot(fwd, side);
    if (mag > 1) { fwd /= mag; side /= mag; }
    const moving = mag > 0.1;
    const running = moving && (has('shift') || this.runToggle);
    sim.player.running = running;
    const speed = running ? 3.4 : 1.9;
    const res = r.walk(dt, fwd, side, speed, sim.office);
    // Changement de salle : le bâtiment est continu, on passe simplement la porte.
    if (res.room && res.room !== sim.player.room) {
      sim.setPlayerRoom(res.room);
      r.setExploreRoom(res.room);
      const name = res.room === 'OFFICE' ? 'Cabine de surveillance' : ROOMS[res.room].name;
      $('walk-room').textContent = name;
      this.toast(name, 1100);
    }
    // Porte blindée fermée devant soi
    if (res.blocked && moving && !this.blockedMsg) {
      const d = nearArmoredDoor(r.explore.x, r.explore.z);
      if (d && (d === 'W' ? sim.office.doorW : sim.office.doorE)) {
        this.toast('La porte blindée est fermée.', 1500);
        this.blockedMsg = true;
        setTimeout(() => { this.blockedMsg = false; }, 1600);
      }
    }
    if (moving) {
      this.stepAcc += Math.min(1, mag) * speed * dt;
      if (this.stepAcc > (running ? 1.0 : 0.75)) { this.stepAcc = 0; this.a.play('step', { side: 'C', vol: running ? 0.6 : 0.3 }); }
      if (running) sim.noise = Math.min(4, sim.noise + dt * 0.6);
    }
    // jauge de danger + battements de cœur
    const det = sim.player.detection;
    $('danger').style.opacity = Math.min(1, det * 1.15);
    $('hud').classList.toggle('outside', sim.player.room !== 'OFFICE');
    if (det > 0.25) {
      this.heartT -= dt;
      if (this.heartT <= 0) { this.heartT = 1.1 - det * 0.6; this.a.play('heart', { side: 'C', vol: 0.4 + det * 0.6 }); }
    }
    // fragment ramassé à pied
    if (r.fragment.visible && r.fragment.userData.near) this.collectFragment(r.fragment.userData.id, true);
  }

  // Pointeur pendant l'exploration : joystick (moitié gauche) et regard (moitié droite)
  onWalkPointer(type, e) {
    const s = this.save.settings.sensitivity;
    if (e.pointerType === 'mouse') {
      if (type === 'down') { this.r.canvas.requestPointerLock?.()?.catch?.(() => {}); this.lookPtr = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 }; }
      if (type === 'move') {
        if (document.pointerLockElement) this.r.look(-e.movementX * 0.0025 * s, -e.movementY * 0.0025 * s);
        else if (this.lookPtr) { this.r.look(-(e.clientX - this.lookPtr.x) * 0.005 * s, -(e.clientY - this.lookPtr.y) * 0.005 * s); this.lookPtr.x = e.clientX; this.lookPtr.y = e.clientY; }
      }
      if (type === 'up') { if (this.lookPtr && !document.pointerLockElement) this.onTap(e.clientX, e.clientY); else if (document.pointerLockElement) this.onTap(innerWidth / 2, innerHeight / 2); this.lookPtr = null; }
      return;
    }
    document.body.classList.add('touch');
    const base = $('stick-base').getBoundingClientRect();
    const cx = base.left + base.width / 2, cy = base.top + base.height / 2;
    if (type === 'down') {
      if (e.clientX < innerWidth * 0.45 && this.stick.id === null) { this.stick.id = e.pointerId; }
      else if (!this.lookPtr) this.lookPtr = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
    }
    if (this.stick.id === e.pointerId) {
      if (type === 'up' || type === 'cancel') { this.stick = { x: 0, y: 0, id: null }; }
      else {
        let dx = e.clientX - cx, dy = e.clientY - cy;
        const l = Math.hypot(dx, dy), max = 50;
        if (l > max) { dx = (dx / l) * max; dy = (dy / l) * max; }
        this.stick.x = dx / max; this.stick.y = dy / max;
      }
      $('stick-knob').style.transform = `translate(${this.stick.x * 50}px, ${this.stick.y * 50}px)`;
      return;
    }
    if (this.lookPtr?.id === e.pointerId) {
      if (type === 'move') {
        const dx = e.clientX - this.lookPtr.x, dy = e.clientY - this.lookPtr.y;
        this.lookPtr.moved += Math.abs(dx) + Math.abs(dy);
        this.r.look(-dx * 0.006 * s, -dy * 0.006 * s);
        this.lookPtr.x = e.clientX; this.lookPtr.y = e.clientY;
      }
      if (type === 'up' || type === 'cancel') { if (this.lookPtr.moved < 12 && type === 'up') this.onTap(e.clientX, e.clientY); this.lookPtr = null; }
    }
  }

  onPointerMove(x, y, type, dx) {
    if (this.paused || this.ended || this.sim.office.camsOpen) return;
    const s = this.save.settings.sensitivity;
    if (type === 'mouse') this.r.targetYaw = Math.max(-MAX_YAW, Math.min(MAX_YAW, -((x / innerWidth) - 0.5) * 2 * MAX_YAW * s * 1.15));
    else this.r.targetYaw = Math.max(-MAX_YAW, Math.min(MAX_YAW, this.r.targetYaw + (dx / innerWidth) * 2.6 * s));
  }

  onTap(x, y) {
    if (this.paused || this.ended) return;
    this.a.unlock();
    const name = this.r.pick(x, y);
    if (!name) return;
    if (name === 'fragment') return this.collectFragment(this.r.fragment.userData.id, this.walking);
    if (this.sim.office.camsOpen) return;
    const act = { btn_doorW: () => this.sim.toggleDoor('W'), btn_doorE: () => this.sim.toggleDoor('E'), btn_lightW: () => this.toggleLight('W'), btn_lightE: () => this.toggleLight('E'), btn_vent: () => this.sim.toggleVent(), btn_cams: () => this.setCams(true) }[name];
    act?.();
  }

  collectFragment(id = null, walking = false) {
    const f = id ? this.sim.fragments.find((x) => x.id === id) : this.sim.fragments.find((x) => x.cam === this.sim.office.cam);
    if (!f || !this.sim.collectFragment(f.id, walking)) return;
    if (!this.save.fragments.includes(f.id)) this.save.fragments.push(f.id);
    writeSave(this.save);
    this.a.play('fragment', { side: 'C' });
    this.toast(`Fragment de partition doré trouvé ! (${this.save.fragments.length}/${FRAGMENTS.length})`, 3000);
  }

  pause(p) {
    if (this.ended) return;
    this.paused = p;
    $('pause').classList.toggle('active', p);
    if (this.a.ctx) p ? this.a.ctx.suspend() : this.a.ctx.resume();
  }

  // ---------------- Boucle ----------------
  update(dt) {
    if (this.paused) { this.r.update(0, this.sim); return; }
    const sim = this.sim;
    if (!this.ended) sim.update(dt);
    for (const ev of sim.drainEvents()) this.handle(ev);
    // bande magnétique automatique
    if (this.tapeTimer > 0) { this.tapeTimer -= dt; if (this.tapeTimer <= 0) this.nextTapeLine(); }
    if (this.hintTimer > 0) { this.hintTimer -= dt; if (this.hintTimer <= 0) $('hint').classList.remove('show'); }
    // indices contextuels
    const e = sim.enemies;
    if (e.mc.room === 'DOOR_W') this.hint('mcDoor');
    if (e.mimi.room === 'VENT_MOUTH') this.hint('mimiVent');
    if (e.roi.state === 'sabotage') this.hint('roiGen');
    if (e.ruban.room === 'DOOR_E') this.hint('rubanDoor');
    if (e.choeur.active && (e.choeur.room === 'HALL_W' || e.choeur.room === 'HALL_E')) this.hint('choeurHall');
    if (sim.office.power < 20 && !sim.office.powerOut) this.hint('lowPower');
    if (this.walking && !this.ended) this.updateWalking(dt);
    // rendu
    if (!this.r.jumpscare) {
      if (this.walking) {
        if (sim.player.room === 'OFFICE') this.r.setOffice(sim);
        else this.r.placeEnemies(sim, false);
        this.r.post.uniforms.uCam.value = 0;
      } else if (sim.office.camsOpen) this.r.setCamFeed(sim, sim.office.cam);
      else this.r.setOffice(sim);
    }
    if (!this.r.jumpscare) this.r.dark = sim.office.powerOut ? 0.55 : 0;
    if (!this.ended) this.updateDread(dt);
    this.r.update(dt, sim);
    this.updateHud();
  }

  handle(ev) {
    const sim = this.sim;
    switch (ev.type) {
      case 'sound':
        this.a.play(ev.id, { side: ev.side, vol: ev.vol, fake: ev.fake, speaker: ev.speaker });
        if (!['click', 'blip'].includes(ev.id)) this.subtitle(captionFor(ev.id, ev.fake), ev.fake, ev.side);
        break;
      case 'hunt':
        this.toast(`${LORE[ev.who].name} est entré dans la cabine vide… il te traque !`, 3000);
        this.hint('hunt', true);
        break;
      case 'tamper':
        if (this.night >= 3) this.hint('tamper');
        break;
      case 'sabotage':
        this.r.shake = 0.6;
        this.toast('Sabotage ! La porte est est bloquée.', 2500);
        break;
      case 'powerOut':
        this.setCams(false);
        $('camui').classList.remove('active');
        this.a.stopAmbience();
        this.a.setCamHiss(false);
        this.toast('Coupure générale…', 2500);
        break;
      case 'jumpscare':
        this.onDeath(ev.who);
        break;
      case 'win':
        this.onWin();
        break;
      case 'hour':
        this.toast(`${String(ev.hour).padStart(2, '0')}:00`, 1500);
        break;
      default:
    }
  }

  updateHud() {
    const sim = this.sim, o = sim.office;
    const totalMin = Math.floor((sim.time / sim.hourSeconds) * 60);
    $('hud-clock').textContent = `0${Math.min(6, Math.floor(totalMin / 60))}:${String(totalMin % 60).padStart(2, '0')}`;
    $('hud-power').textContent = `${Math.ceil(o.power)} %`;
    const u = sim.usage();
    $('hud-usage').innerHTML = Array.from({ length: u }, (_, i) => `<i class="${i >= 3 ? 'r' : i >= 2 ? 'y' : ''}"></i>`).join('');
    const status = [];
    if (o.jammed > 0) status.push(`Porte est bloquée (${Math.ceil(o.jammed)} s)`);
    if (o.powerOut) status.push('PLUS D\'ÉNERGIE');
    $('hud-status').textContent = status.join(' · ');
    $('ctl-doorW').classList.toggle('on', o.doorW);
    $('ctl-doorE').classList.toggle('on', o.doorE);
    $('ctl-doorE').classList.toggle('blocked', o.jammed > 0);
    $('ctl-lightW').classList.toggle('on', o.lightW);
    $('ctl-lightE').classList.toggle('on', o.lightE);
    $('ctl-vent').classList.toggle('on', o.vent);
    for (const id of ['ctl-doorW', 'ctl-doorE', 'ctl-lightW', 'ctl-lightE', 'ctl-vent', 'ctl-cams']) $(id).disabled = o.powerOut;
    if (o.camsOpen) {
      const id = o.cam;
      const cs = sim.camState[id];
      const looped = sim.isLooped(id);
      const t = looped ? cs.frozenAt : sim.time;
      const secs = Math.floor((t / sim.hourSeconds) * 3600);
      const hh = Math.floor(secs / 3600), mm = Math.floor(secs / 60) % 60, ss = secs % 60;
      $('cam-name').textContent = `${id.replace('CAM', 'CAM ')} — ${ROOMS[camRoom(id)].name}`;
      $('cam-stamp').textContent = `NUIT ${this.night} · 0${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
      $('cam-msg').textContent = sim.isOffline(id) ? 'SIGNAL PERDU' : '';
      const room = camRoom(id);
      $('cam-lure').disabled = !ROOMS[room].speaker || sim.lureCooldown > 0;
      $('cam-lure').lastChild.textContent = sim.lureCooldown > 0 ? `Leurre (${Math.ceil(sim.lureCooldown)} s)` : ROOMS[room].speaker ? 'Leurre sonore' : 'Pas de haut-parleur';
      $('cam-shock').style.display = id === 'CAM09' ? '' : 'none';
      $('cam-shock').disabled = sim.shockCooldown > 0;
      for (const b of $('cam-map').querySelectorAll('button')) b.classList.toggle('alert', sim.time < sim.camState[b.dataset.cam].alertUntil);
    }
    if (this.save.settings.debug) {
      this.debugTimer -= 1;
      if (this.debugTimer <= 0) {
        this.debugTimer = 10;
        const d = sim.debug();
        $('debug').textContent = `DIAGNOSTIC IA — nuit ${d.night}  t=${d.time}s  h=${d.hour}\nénergie ${d.power}%  usage ${d.usage}  bruit ${d.noise}\ncaméras figées : ${d.loops.join(', ') || '—'}\n` +
          d.enemies.map((x) => `${x.who.padEnd(7)} niv ${String(x.level).padStart(2)}  ${x.room.padEnd(10)} ${x.state.padEnd(8)} ${x.timer ? x.timer + 's' : ''}\n         ${x.note}`).join('\n');
      }
    }
    $('debug').classList.toggle('show', !!this.save.settings.debug);
  }

  onDeath(who) {
    this.ended = true;
    $('walkui').classList.remove('active');
    $('danger').style.opacity = 0;
    if (document.pointerLockElement) document.exitPointerLock?.();
    $('camui').classList.remove('active');
    $('hud').classList.remove('cams-open');
    document.body.classList.remove('cams-open');
    $('tape').classList.remove('show');
    this.a.setCamHiss(false);
    this.r.post.uniforms.uCam.value = 0;
    this.r.dark = 0;
    this.r.startJumpscare(who);
    // silence glaçant, un chuchotement… puis le cri
    this.a.stopAmbience();
    this.a.setChase(0);
    this.a.play('whisper', { side: 'C', vol: 0.9, pitch: VOICE[who] });
    setTimeout(() => this.a.scream(who), 380);
    if (this.save.settings.vibration && navigator.vibrate) navigator.vibrate([200, 80, 400]);
    this.save.deaths++;
    writeSave(this.save);
    setTimeout(() => {
      this.r.endJumpscare();
      this.r.static = 1;
      this.a.stopAmbience();
      $('hud').classList.remove('active');
      const lore = LORE[who];
      $('go-who').textContent = `${lore.name} t'a attrapé à ${$('hud-clock').textContent}.`;
      $('go-tip').textContent = (this.sim.office.power <= 0 ? "Tu as manqué d'énergie : à 0 %, plus rien ne te protège. " : '') + 'Règle : ' + lore.rule;
      $('gameover').classList.add('active');
    }, 1900);
  }

  // ---------------- Effroi : présence, sursauts, traque, fantômes ----------------
  updateDread(dt) {
    const sim = this.sim, r = this.r, p = sim.player;
    // Respiration mécanique des mascottes proches, localisable à l'oreille
    this.presenceT -= dt;
    if (this.presenceT <= 0) {
      this.presenceT = 2.5 + Math.random() * 2.5;
      const near = this.walking ? [p.room, ...(WALK_LINKS[p.room] ?? [])] : ['DOOR_W', 'DOOR_E', 'VENT_MOUTH'];
      const cands = KEYS.filter((k) => sim.enemies[k].active && near.includes(sim.enemies[k].room) && r.chars[k].root.visible);
      if (cands.length) {
        const k = cands[Math.floor(Math.random() * cands.length)];
        const w = r.chars[k].root.getWorldPosition(r.chars[k].root.position.clone());
        let side, vol;
        if (this.walking) {
          const e = r.explore, dx = w.x - e.x, dz = w.z - e.z, d = Math.hypot(dx, dz) || 1;
          side = (dx * Math.cos(e.yaw) - dz * Math.sin(e.yaw)) / d;
          vol = Math.max(0, 1.1 - d / 14);
        } else {
          const room = sim.enemies[k].room;
          side = room === 'DOOR_W' ? 'W' : room === 'DOOR_E' ? 'E' : 'C';
          vol = 0.45;
        }
        if (vol > 0.05) this.a.play('breath', { side, vol, pitch: VOICE[k] });
      }
    }
    // Sursaut : première fois qu'on aperçoit une mascotte depuis un moment
    if (this.walking && p.looking) {
      if (sim.time - (this.lastSeen[p.looking] ?? -99) > 12) { this.a.play('sting', { side: 'C', vol: 0.8 }); r.shake = Math.max(r.shake, 0.5); }
      this.lastSeen[p.looking] = sim.time;
    }
    // Bourdon de traque
    let chase = 0;
    for (const k of KEYS) {
      const en = sim.enemies[k];
      if (en.state !== 'hunt') continue;
      chase = Math.max(chase, en.room === p.room ? 1 : (WALK_LINKS[p.room] ?? []).includes(en.room) ? 0.6 : 0.3);
    }
    if (this.walking) chase = Math.max(chase, Math.min(1, p.detection * 1.2));
    this.a.setChase(chase);
    // Fantômes (hallucinations) : jamais une vraie menace, mais on ne peut pas le savoir sans vérifier
    if (r.phantom?.side && (r.phantom.side === 'W' ? sim.office.lightW : sim.office.lightE)) r.clearPhantom();
    this.phantomT -= dt;
    if (this.phantomT > 0 || r.phantom || sim.office.powerOut) return;
    this.phantomT = (this.walking ? 35 : 60) + Math.random() * 50;
    const key = KEYS[Math.floor(Math.random() * KEYS.length)];
    if (this.walking) {
      if (sim.enemiesWithPlayer().length || p.detection > 0.2) return;
      const opts = [];
      for (const [a, wa, b, wb, at] of CONNECTIONS) {
        for (const [from, nb, wnb] of [[a, b, wb], [b, a, wa]]) {
          if (from !== p.room || nb === 'OFFICE') continue;
          const pb = wallPos(nb, wnb);
          const x = isXWall(wnb);
          const sgn = Math.sign((x ? ROOM_POS[nb][0] : ROOM_POS[nb][1]) - pb) || 1;
          opts.push(x ? [pb + sgn * 1.4, at] : [at, pb + sgn * 1.4]);
        }
      }
      if (!opts.length) return;
      const [x, z] = opts[Math.floor(Math.random() * opts.length)];
      const e = r.explore;
      r.spawnPhantom(key, new THREE_V(x, 0, z), Math.atan2(e.x - x, e.z - z), { dur: 2.2, vanishOnLook: true });
      this.a.play('whisper', { side: 'far', vol: 0.5, pitch: VOICE[key] });
    } else if (this.night >= 2 && !sim.office.camsOpen) {
      const o = sim.office;
      const sides = ['W', 'E'].filter((s) => !(s === 'W' ? o.doorW || o.lightW : o.doorE || o.lightE)
        && !KEYS.some((k) => ['DOOR_' + s, 'HALL_' + s].includes(sim.enemies[k].room)));
      if (!sides.length) return;
      const side = sides[Math.floor(Math.random() * sides.length)];
      const spot = r.officeDoorSpot(side);
      r.spawnPhantom(key, spot.pos, spot.ry, { dur: 3.5, vanishOnLook: false });
      r.phantom.side = side;
      this.a.play('whisper', { side, vol: 0.35, pitch: VOICE[key] });
    }
  }

  onWin() {
    this.ended = true;
    this.a.setChase(0);
    this.r.clearPhantom(false);
    this.setCams(false);
    $('tape').classList.remove('show');
    const n = this.night;
    if (!this.save.completed.includes(n)) this.save.completed.push(n);
    this.save.unlocked = Math.max(this.save.unlocked, Math.min(6, n + 1));
    this.save.lastNight = Math.min(6, n + 1);
    writeSave(this.save);
    this.a.stopAmbience();
    setTimeout(() => {
      $('hud').classList.remove('active');
      let text = `Nuit ${n} terminée. Énergie restante : ${Math.ceil(this.sim.office.power)} %.`;
      if (n === 5) text += '\n\n' + (this.save.fragments.length >= FRAGMENTS.length ? ENDINGS.secret : ENDINGS.normal) + '\n\nNuit 6 débloquée.';
      if (n === 6) text += '\n\nTu as survécu à la nuit bonus. Merci d\'avoir joué !';
      $('win-text').innerText = text;
      document.querySelector('#win [data-action=next]').style.display = n >= 6 ? 'none' : '';
      $('win').classList.add('active');
    }, 2500);
  }

  destroy() {
    this.r.clearPhantom(false);
    this.a.setChase(0);
    $('walkui').classList.remove('active');
    $('hud').classList.remove('walking');
    $('danger').style.opacity = 0;
    $('fade').classList.remove('on');
    if (document.pointerLockElement) document.exitPointerLock?.();
    document.body.classList.remove('cams-open');
    this.a.stopAmbience();
    this.a.setCamHiss(false);
    for (const id of ['hud', 'camui', 'pause', 'gameover', 'win']) $(id).classList.remove('active');
    $('tape').classList.remove('show');
    $('hint').classList.remove('show');
    $('debug').classList.remove('show');
    $('subs').innerHTML = '';
    this.r.endJumpscare();
  }
}
