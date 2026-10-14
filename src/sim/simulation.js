import { createRng } from './rng.js';
import { NIGHTS, HOUR_SECONDS, aiLevel } from './nights.js';
import { ROOMS, CAMERAS, camRoom } from './map.js';
import { FRAGMENTS } from './story.js';
import { MasterOfCeremonies, Mimi, GearKing, MadameRuban, Choir } from './enemies.js';

// Consommation (en % d'énergie par seconde) par élément actif.
export const DRAIN = { base: 0.085, door: 0.085, light: 0.075, cams: 0.06, vent: 0.07 };
const STEP = 0.05;

// Simulation complète d'une nuit, indépendante du rendu (testable sans navigateur).
export class Simulation {
  constructor({ night = 1, seed = Date.now() & 0xffffffff, hourSeconds = HOUR_SECONDS, collected = [], grace = 0 } = {}) {
    this.grace = grace; // secondes de calme au début (temps d'écouter la bande d'Odile)
    this.nightCfg = NIGHTS.find((n) => n.id === night) ?? NIGHTS[0];
    this.night = this.nightCfg.id;
    this.rng = createRng(seed);
    this.hourSeconds = hourSeconds;
    this.time = 0;
    this.acc = 0;
    this.noise = 0;
    this.events = [];
    this.outcome = null; // 'win' | 'dead'
    this.killer = null;
    this.office = {
      power: 100, doorW: false, doorE: false, lightW: false, lightE: false, vent: false,
      camsOpen: false, cam: 'CAM01', jammed: 0, blackout: 0, powerOut: false,
    };
    this.camState = Object.fromEntries(CAMERAS.map((c) => [c.id, { loopUntil: 0, frozenAt: 0, offlineUntil: 0, alertUntil: 0, disturbUntil: 0 }]));
    // Joueur : dans la cabine par défaut ; peut sortir explorer le bâtiment.
    this.player = { room: 'OFFICE', standing: false, flashlight: false, running: false, looking: null, detection: 0, threat: null };
    this.lureCooldown = 0;
    this.shockCooldown = 0;
    this.powerOutTimer = 0;
    this.paradeStarted = false;
    this.fragments = FRAGMENTS.filter((f) => f.night === this.night && !collected.includes(f.id));
    this.enemies = {
      mc: new MasterOfCeremonies(this),
      mimi: new Mimi(this),
      roi: new GearKing(this),
      ruban: new MadameRuban(this),
      choeur: new Choir(this),
    };
    this.refreshLevels();
  }

  get hour() { return Math.min(6, Math.floor(this.time / this.hourSeconds)); }
  get list() { return Object.values(this.enemies); }

  refreshLevels() {
    for (const e of this.list) e.level = aiLevel(this.nightCfg, e.key, this.hour);
  }

  usage() {
    const o = this.office;
    if (o.powerOut) return 0;
    return 1 + (o.doorW ? 1 : 0) + (o.doorE ? 1 : 0) + (o.lightW || o.lightE ? 1 : 0) + (o.camsOpen ? 1 : 0) + (o.vent ? 1 : 0);
  }

  drainRate() {
    const o = this.office;
    if (o.powerOut) return 0;
    let r = DRAIN.base;
    if (o.doorW) r += DRAIN.door;
    if (o.doorE) r += DRAIN.door;
    if (o.lightW) r += DRAIN.light;
    if (o.lightE) r += DRAIN.light;
    if (o.camsOpen) r += DRAIN.cams;
    if (o.vent) r += DRAIN.vent;
    return r * this.nightCfg.drain;
  }

  emit(ev) { this.events.push({ t: this.time, ...ev }); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  sound(id, opts = {}) {
    this.emit({ type: 'sound', id, side: opts.side ?? 'far', vol: opts.vol ?? 1, fake: !!opts.fake, speaker: !!opts.speaker, room: opts.room ?? null });
    if (!opts.fake && this.enemies?.choeur) this.enemies.choeur.hear(id);
  }

  // Le joueur regarde-t-il cette salle sur une caméra en direct (ni figée, ni hors ligne) ?
  isWatching(room) {
    const o = this.office;
    if (!o.camsOpen || o.powerOut) return false;
    if (camRoom(o.cam) !== room) return false;
    const cs = this.camState[o.cam];
    return this.time >= cs.loopUntil && this.time >= cs.offlineUntil;
  }

  // Une caméra affiche-t-elle une image figée (boucle de Madame Ruban) ?
  isLooped(camId) { return this.time < this.camState[camId].loopUntil; }
  isOffline(camId) { return this.time < this.camState[camId].offlineUntil; }

  disturbCams(from, to) {
    for (const c of CAMERAS) {
      if (c.room === from || c.room === to) {
        const cs = this.camState[c.id];
        if (this.time >= cs.loopUntil) cs.disturbUntil = this.time + 0.9;
      }
    }
  }

  // ----- Actions du joueur -----
  toggleDoor(side) {
    const o = this.office;
    if (o.powerOut || this.outcome) return false;
    if (this.player.room !== 'OFFICE') return false; // commandes accessibles depuis la cabine seulement
    const k = side === 'W' ? 'doorW' : 'doorE';
    if (k === 'doorE' && o.jammed > 0) { this.sound('jam', { side: 'E', vol: 0.6 }); return false; }
    o[k] = !o[k];
    this.noise += 1;
    this.sound('door', { side, vol: 0.8 });
    return true;
  }

  setLight(side, on) {
    const o = this.office;
    if (o.powerOut || this.outcome || o.blackout > 0) on = false;
    if (side === 'W') { o.lightW = on; if (on) o.lightE = false; }
    else { o.lightE = on; if (on) o.lightW = false; }
    return on;
  }

  toggleVent() {
    const o = this.office;
    if (o.powerOut || this.outcome || this.player.room !== 'OFFICE') return false;
    o.vent = !o.vent;
    this.noise += 1.5;
    this.sound('vent', { side: 'C', vol: 0.8 });
    return true;
  }

  setCams(open) {
    const o = this.office;
    if (o.powerOut || this.outcome || this.player.room !== 'OFFICE' || this.player.standing) open = false;
    o.camsOpen = open;
    if (open) { o.lightW = false; o.lightE = false; }
    return open;
  }

  selectCam(id) {
    if (!this.camState[id]) return;
    this.office.cam = id;
  }

  // Leurre sonore joué dans la salle de la caméra affichée.
  playLure() {
    const o = this.office;
    if (!o.camsOpen || o.powerOut || this.lureCooldown > 0) return false;
    const room = camRoom(o.cam);
    if (!ROOMS[room]?.speaker || this.isOffline(o.cam)) return false;
    this.lureCooldown = 12;
    o.power = Math.max(0, o.power - 1.5);
    this.sound('lure', { side: 'far', room, vol: 0.6 });
    this.enemies.mimi.onLure(room);
    this.enemies.choeur.onLure(room);
    return true;
  }

  // Décharge électrique dans la salle des machines (caméra 09 uniquement).
  shock() {
    const o = this.office;
    if (!o.camsOpen || o.powerOut || o.cam !== 'CAM09' || this.shockCooldown > 0) return false;
    this.shockCooldown = 5;
    o.power = Math.max(0, o.power - 3);
    this.sound('shock', { side: 'far', room: 'GENERATOR', vol: 0.7 });
    this.emit({ type: 'shock' });
    return this.enemies.roi.onShock();
  }

  // Remet la caméra affichée en direct (annule une boucle) ; elle est hors ligne 2,5 s.
  resetCam() {
    const o = this.office;
    if (!o.camsOpen || o.powerOut) return false;
    const cs = this.camState[o.cam];
    cs.loopUntil = 0;
    cs.alertUntil = 0;
    cs.offlineUntil = this.time + 2.5;
    return true;
  }

  collectFragment(id, walking = false) {
    const f = this.fragments.find((x) => x.id === id);
    if (!f) return false;
    const ok = walking ? this.hour >= f.from && this.hour < f.to && camRoom(f.cam) === this.player.room : this.fragmentVisible(f);
    if (!ok) return false;
    this.fragments = this.fragments.filter((x) => x.id !== id);
    this.emit({ type: 'fragment', id });
    return true;
  }

  fragmentVisible(f) {
    return this.hour >= f.from && this.hour < f.to && this.office.camsOpen && this.office.cam === f.cam && !this.isLooped(f.cam) && !this.isOffline(f.cam);
  }

  // ----- Effets des ennemis -----
  tamper() {
    const cams = CAMERAS.map((c) => c.id).filter((id) => !this.isLooped(id));
    if (!cams.length) return;
    // Cible de préférence une caméra où se trouve un ennemi, pour le masquer.
    const occupied = cams.filter((id) => this.list.some((e) => e.active && e.room === camRoom(id) && e.key !== 'ruban'));
    const target = occupied.length && this.rng.chance(0.7) ? this.rng.pick(occupied) : this.rng.pick(cams);
    const cs = this.camState[target];
    cs.loopUntil = this.time + 25;
    cs.frozenAt = this.time;
    // Fausse alerte de mouvement sur une autre caméra.
    const other = this.rng.pick(cams.filter((c) => c !== target));
    if (other) this.camState[other].alertUntil = this.time + 6;
    this.sound('ruban_tamper', { side: 'far', vol: 0.25 });
    this.emit({ type: 'tamper', cam: target, fakeAlert: other });
  }

  sabotage() {
    const o = this.office;
    o.power = Math.max(0, o.power - 12);
    o.jammed = 20;
    o.doorE = false;
    o.blackout = 2.5;
    o.lightW = o.lightE = false;
    this.sound('roi_sabotage', { side: 'E' });
    this.sound('jam', { side: 'E', vol: 0.8 });
    this.emit({ type: 'sabotage' });
  }

  // Une mascotte arrive au bout de son compte à rebours : si le joueur est dans la cabine,
  // c'est l'attaque ; s'il est sorti, la mascotte entre et le traque dans le bâtiment.
  attack(enemy) {
    if (this.player.room === 'OFFICE') { this.kill(enemy.key); return; }
    if (enemy.key === 'mimi') enemy.setDepth(0, 'sort du conduit');
    enemy.startHunt();
    this.emit({ type: 'hunt', who: enemy.key });
    this.sound('choeur_door', { side: 'far', vol: 0.4 });
  }

  // Le joueur change de salle (exploration).
  setPlayerRoom(room) {
    const p = this.player;
    if (p.room === room) return;
    p.room = room;
    p.detection = Math.max(0, p.detection - 0.35);
    if (room !== 'OFFICE') { this.office.camsOpen = false; this.office.lightW = this.office.lightE = false; }
    this.emit({ type: 'playerRoom', room });
  }

  /** Mascottes actives dans la même salle que le joueur. */
  enemiesWithPlayer() {
    const r = this.player.room;
    if (r === 'OFFICE') return [];
    return this.list.filter((e) => e.active && e.room === r && e.state !== 'stunned' && e.state !== 'inactive');
  }

  // Détection pendant l'exploration : rester près d'une mascotte remplit la jauge.
  updateDetection(dt) {
    const p = this.player;
    const near = this.enemiesWithPlayer();
    let rate = 0, threat = null;
    for (const e of near) {
      const lit = p.flashlight && p.looking === e.key;
      // Règles cohérentes avec la cabine
      if (e.key === 'mc' && lit) { e.note = 'figé par la lampe'; e.pose = 'frozen'; continue; }
      if (e.key === 'ruban' && lit) {
        e.lit = (e.lit ?? 0) + dt;
        if (e.lit > 1.4) { e.lit = 0; e.state = 'roam'; e.moveTo('LOBBY', 'fuit la lampe'); this.sound('ruban_retreat', { side: 'far' }); }
        continue;
      }
      let r = { mc: 0.24, mimi: 0.18, roi: 0.14, ruban: 0.2, choeur: 0.26 }[e.key];
      if (e.key === 'mimi' && !p.running) r *= 0.5;
      if (p.running) r *= 1.7;
      if (p.flashlight && !lit) r *= 1.25;
      if (e.state === 'hunt') r *= 2.2;
      if (e.state === 'sabotage') r *= 0.5;
      if (r > rate) { rate = r; threat = e.key; }
    }
    p.threat = threat;
    if (rate > 0) p.detection += rate * dt;
    else p.detection = Math.max(0, p.detection - dt * 0.4);
    if (p.detection >= 1) this.kill(threat);
  }

  kill(who) {
    if (this.outcome) return;
    this.outcome = 'dead';
    this.killer = who;
    this.office.camsOpen = false;
    this.emit({ type: 'jumpscare', who });
  }

  // ----- Boucle -----
  update(dt) {
    if (this.outcome) return;
    this.acc += Math.min(dt, 0.5);
    while (this.acc >= STEP && !this.outcome) {
      this.acc -= STEP;
      this.step(STEP);
    }
  }

  step(dt) {
    const prevHour = this.hour;
    this.time += dt;
    if (this.hour !== prevHour) {
      this.refreshLevels();
      this.emit({ type: 'hour', hour: this.hour });
    }
    if (this.hour >= 6) {
      this.outcome = 'win';
      this.office.camsOpen = false;
      this.sound('chime', { side: 'far' });
      this.emit({ type: 'win' });
      return;
    }
    const o = this.office;
    this.noise = Math.max(0, this.noise - dt * 0.35);
    this.lureCooldown = Math.max(0, this.lureCooldown - dt);
    this.shockCooldown = Math.max(0, this.shockCooldown - dt);
    o.jammed = Math.max(0, o.jammed - dt);
    o.blackout = Math.max(0, o.blackout - dt);
    if (o.blackout > 0) { o.lightW = o.lightE = false; }

    if (!o.powerOut) {
      o.power = Math.max(0, o.power - this.drainRate() * dt);
      if (o.power <= 0) this.powerOut();
    } else {
      this.powerOutTimer -= dt;
      if (!this.paradeStarted && this.powerOutTimer <= 8) {
        this.paradeStarted = true;
        this.sound('parade', { side: 'W', vol: 0.8 });
        this.emit({ type: 'parade' });
        // Le Roi des Rouages apparaît dans l'encadrement ouest, éclairé par sa chaudière.
        const roi = this.enemies.roi;
        roi.level = Math.max(roi.level, 1);
        roi.room = 'DOOR_W';
        roi.pose = 'peek';
      }
      if (this.powerOutTimer <= 0) this.kill('roi');
      return; // dans le noir, seule la Parade compte
    }

    if (this.time < this.grace) return;
    for (const e of this.list) {
      e.update(dt);
      if (this.outcome) return;
    }
    if (this.player.room !== 'OFFICE') this.updateDetection(dt);
  }

  powerOut() {
    const o = this.office;
    o.powerOut = true;
    o.power = 0;
    o.doorW = o.doorE = o.vent = false;
    o.lightW = o.lightE = false;
    o.camsOpen = false;
    this.powerOutTimer = 12 + this.rng.next() * 14;
    this.sound('power_out', { side: 'far' });
    this.emit({ type: 'powerOut' });
  }

  // Résumé lisible pour l'outil de diagnostic.
  debug() {
    return {
      night: this.night,
      time: this.time.toFixed(1),
      hour: this.hour,
      power: this.office.power.toFixed(1),
      usage: this.usage(),
      noise: this.noise.toFixed(2),
      enemies: this.list.map((e) => e.debug()),
      loops: CAMERAS.filter((c) => this.isLooped(c.id)).map((c) => c.id),
    };
  }
}
