import { Simulation } from './sim/simulation.js';
import { CAMERAS, ROOMS, camRoom } from './sim/map.js';
import { NIGHT_MESSAGES, LORE, ENDINGS, FRAGMENTS } from './sim/story.js';
import { captionFor } from './sim/captions.js';
import { writeSave } from './save.js';

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
    if (name === 'fragment') return this.collectFragment();
    if (this.sim.office.camsOpen) return;
    const act = { btn_doorW: () => this.sim.toggleDoor('W'), btn_doorE: () => this.sim.toggleDoor('E'), btn_lightW: () => this.toggleLight('W'), btn_lightE: () => this.toggleLight('E'), btn_vent: () => this.sim.toggleVent(), btn_cams: () => this.setCams(true) }[name];
    act?.();
  }

  collectFragment() {
    const f = this.sim.fragments.find((x) => x.cam === this.sim.office.cam);
    if (!f || !this.sim.collectFragment(f.id)) return;
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
    // rendu
    if (!this.r.jumpscare) {
      if (sim.office.camsOpen) this.r.setCamFeed(sim, sim.office.cam);
      else this.r.setOffice(sim);
    }
    this.r.dark = sim.office.powerOut ? 0.55 : 0;
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
    $('camui').classList.remove('active');
    $('hud').classList.remove('cams-open');
    $('tape').classList.remove('show');
    this.a.setCamHiss(false);
    this.r.post.uniforms.uCam.value = 0;
    this.r.dark = 0;
    this.r.startJumpscare(who);
    this.a.scream(who);
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
    }, 1500);
  }

  onWin() {
    this.ended = true;
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
