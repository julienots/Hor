import { ROOMS, shortestPath, HUNT_LINKS } from './map.js';

// Base commune : chaque ennemi est une petite machine à états testable.
// États : inactive, roam, atDoor, retreat, stunned, sabotage, attack.
export class Enemy {
  constructor(sim, key, { name, tick, start }) {
    this.sim = sim;
    this.key = key;
    this.name = name;
    this.tickInterval = tick;
    this.tickTimer = tick * (0.5 + sim.rng.next() * 0.5);
    this.start = start;
    this.room = start;
    this.state = 'inactive';
    this.timer = 0;
    this.level = 0;
    this.pose = 'idle';
    this.note = '';
  }

  get active() { return this.level > 0; }

  // Opportunité de mouvement : réussite si un tirage sur 20 est sous le niveau d'IA.
  roll(bonus = 0) { return this.sim.rng.next() * 20 < this.level + bonus; }

  moveTo(room, reason = '') {
    const from = this.room;
    if (from === room) return;
    this.room = room;
    this.note = reason;
    this.sim.emit({ type: 'moved', who: this.key, from, to: room });
    this.sim.disturbCams(from, room);
  }

  update(dt) {
    if (!this.active) {
      if (this.state !== 'inactive') this.state = 'inactive';
      return;
    }
    if (this.state === 'inactive') this.state = 'roam';
    if (this.state === 'hunt') { this.updateHunt(dt); return; }
    this.timer = Math.max(0, this.timer - dt);
    this.tickTimer -= dt;
    if (this.tickTimer <= 0) {
      this.tickTimer += this.tickInterval;
      this.onTick();
    }
    this.onUpdate(dt);
  }

  onTick() {}
  onUpdate() {}

  // Traque : le joueur a quitté la cabine. La mascotte suit ses traces de salle en salle.
  startHunt() {
    this.state = 'hunt';
    this.huntTimer = 30;
    this.huntStep = 2.5;
    this.pose = 'walk';
    this.note = 'traque le joueur';
  }

  updateHunt(dt) {
    const p = this.sim.player;
    this.huntTimer -= dt;
    if (p.room === 'OFFICE' || this.huntTimer <= 0) { this.endHunt(); return; }
    this.huntStep -= dt;
    if (this.huntStep > 0 || this.room === p.room) return;
    this.huntStep = Math.max(2.2, 4.5 - this.level * 0.1);
    const path = shortestPath(this.room, p.room, [], HUNT_LINKS);
    if (path && path.length > 1) {
      this.moveTo(path[1], 'traque');
      this.onHuntMove?.();
      this.sim.sound(this.key === 'mimi' ? 'mimi_scrape_far' : this.key === 'ruban' ? 'ruban_rustle' : this.key === 'choeur' ? 'choeur_hum' : this.key === 'roi' ? 'roi_step' : 'mc_step', { side: 'far', vol: 0.5 });
    }
  }

  endHunt() {
    this.state = 'roam';
    this.pose = 'idle';
    this.timer = 0;
    this.resetToStart?.() ?? this.moveTo(this.start, 'abandonne la traque');
    this.tickTimer = this.tickInterval * 2;
  }

  debug() {
    return { who: this.key, room: this.room, state: this.state, level: this.level, timer: +this.timer.toFixed(1), note: this.note };
  }
}

// 1. LE MAÎTRE DE CÉRÉMONIE — se déplace seulement quand sa caméra n'est pas regardée.
export class MasterOfCeremonies extends Enemy {
  constructor(sim) {
    super(sim, 'mc', { name: 'Le Maître de Cérémonie', tick: 4.8, start: 'STAGE' });
    this.route = ['STAGE', 'PARTY', 'HALL_W', 'DOOR_W'];
  }
  watched() {
    const p = this.sim.player;
    return this.sim.isWatching(this.room) || (p.room === this.room && p.flashlight && p.looking === 'mc');
  }
  onTick() {
    if (this.state === 'atDoor') return;
    if (this.watched()) { this.note = 'observé : figé'; this.pose = 'frozen'; return; }
    // Ruse : ricanement dans les haut-parleurs de l'autre côté (son « grésillant »).
    if ((this.room === 'PARTY' || this.room === 'HALL_W') && this.sim.rng.chance(0.12 + this.level * 0.01)) {
      this.sim.sound('mc_laugh_speaker', { side: 'E', speaker: true });
    }
    if (!this.roll()) return;
    const i = this.route.indexOf(this.room);
    const next = this.route[Math.min(i + 1, this.route.length - 1)];
    this.moveTo(next, 'avance');
    this.pose = next === 'HALL_W' ? 'lean' : 'walk';
    if (next === 'DOOR_W') {
      this.state = 'atDoor';
      this.timer = Math.max(4.5, 9 - this.level * 0.22);
      this.pose = 'peek';
      this.sim.sound('mc_step', { side: 'W' });
    } else if (next === 'HALL_W') {
      this.sim.sound('mc_step', { side: 'W', vol: 0.4 });
    }
  }
  onUpdate() {
    if (this.state !== 'atDoor') return;
    if (this.sim.rng.chance(0.004)) this.sim.sound('mc_breath', { side: 'W', vol: 0.5 });
    if (this.timer > 0) return;
    if (this.sim.office.doorW) {
      this.state = 'roam';
      this.pose = 'idle';
      this.moveTo('PARTY', 'repoussé par la porte');
      this.sim.sound('mc_retreat', { side: 'W' });
    } else {
      this.sim.attack(this);
    }
  }
}

// 2. MIMI LA MARIONNETTE — conduits, accélérée par le bruit, repoussée par le leurre dans l'atelier.
export class Mimi extends Enemy {
  constructor(sim) {
    super(sim, 'mimi', { name: 'Mimi la Marionnette', tick: 4.3, start: 'WORKSHOP' });
    this.depth = 0; // 0 atelier, 1 conduit lointain, 2 conduit proche, 3 bouche
  }
  setDepth(d, reason) {
    this.depth = d;
    const room = d === 0 ? 'WORKSHOP' : d === 3 ? 'VENT_MOUTH' : 'VENT';
    if (room !== this.room) this.moveTo(room, reason);
    else { this.note = reason; this.sim.emit({ type: 'moved', who: this.key, from: room, to: room }); this.sim.disturbCams(room, room); }
  }
  onTick() {
    if (this.state === 'atDoor') return;
    const noiseBonus = Math.min(6, this.sim.noise * 2);
    if (!this.roll(noiseBonus)) return;
    if (this.depth === 2 && this.sim.office.vent) { this.note = 'bloquée par le volet'; return; }
    this.setDepth(this.depth + 1, 'avance');
    this.pose = 'crawl';
    if (this.depth === 1) this.sim.sound('mimi_scrape_far', { side: 'C', vol: 0.35 });
    if (this.depth === 2) this.sim.sound('mimi_scrape_near', { side: 'C', vol: 0.7 });
    if (this.depth === 3) {
      this.state = 'atDoor';
      this.timer = Math.max(4.5, 8 - this.level * 0.18);
      this.pose = 'peek';
      this.sim.sound('mimi_tap', { side: 'C' });
    }
  }
  onUpdate() {
    if (this.state !== 'atDoor') return;
    if (this.sim.rng.chance(0.006)) this.sim.sound('mimi_tap', { side: 'C', vol: 0.6 });
    if (this.timer > 0) return;
    if (this.sim.office.vent) {
      this.state = 'roam';
      this.pose = 'idle';
      this.setDepth(0, 'repoussée par le volet');
      this.sim.sound('mimi_retreat', { side: 'C' });
    } else {
      this.sim.attack(this);
    }
  }
  onHuntMove() { this.depth = this.room === 'VENT' ? 1 : this.room === 'VENT_MOUTH' ? 3 : 0; }
  resetToStart() { this.setDepth(0, 'abandonne la traque'); }
  onLure(room) {
    if (room === 'WORKSHOP' && (this.depth === 1 || this.depth === 2)) {
      this.setDepth(0, 'attirée par le leurre');
      this.sim.sound('mimi_giggle', { room: 'WORKSHOP', side: 'far', vol: 0.5 });
      this.tickTimer = this.tickInterval * 1.5;
    }
  }
}

// 3. LE ROI DES ROUAGES — lent ; sabote la salle des machines.
export class GearKing extends Enemy {
  constructor(sim) {
    super(sim, 'roi', { name: 'Le Roi des Rouages', tick: 8.5, start: 'KITCHEN' });
    this.route = ['KITCHEN', 'HALL_E', 'GENERATOR'];
  }
  onTick() {
    if (this.state === 'stunned' || this.state === 'sabotage') return;
    if (!this.roll()) return;
    const i = this.route.indexOf(this.room);
    const next = this.route[Math.min(i + 1, this.route.length - 1)];
    if (next === this.room) return;
    this.moveTo(next, 'avance');
    this.pose = 'walk';
    this.sim.sound('roi_step', { side: 'E', vol: next === 'HALL_E' ? 0.5 : 0.3 });
    if (next === 'GENERATOR') {
      this.state = 'sabotage';
      this.pose = 'sabotage';
      this.timer = Math.max(7, 13 - this.level * 0.25);
      this.sim.sound('roi_grind', { side: 'far', room: 'GENERATOR', vol: 0.6 });
    }
  }
  onUpdate() {
    if (this.state === 'stunned' && this.timer <= 0) { this.state = 'roam'; this.pose = 'idle'; }
    if (this.state !== 'sabotage') return;
    if (this.sim.rng.chance(0.01)) this.sim.sound('roi_grind', { side: 'far', room: 'GENERATOR', vol: 0.5 });
    if (this.timer > 0) return;
    this.sim.sabotage();
    this.state = 'stunned';
    this.timer = 6;
    this.pose = 'idle';
    this.moveTo('KITCHEN', 'sabotage réussi, retourne en cuisine');
  }
  onShock() {
    if (this.room !== 'GENERATOR') return false;
    this.state = 'stunned';
    this.timer = 10;
    this.pose = 'stunned';
    this.sim.sound('roi_shocked', { side: 'far', room: 'GENERATOR' });
    this.moveTo('KITCHEN', 'décharge reçue');
    this.tickTimer = this.tickInterval;
    return true;
  }
}

// 4. MADAME RUBAN — fige les caméras, crée de fausses alertes ; repoussée par la lumière.
export class MadameRuban extends Enemy {
  constructor(sim) {
    super(sim, 'ruban', { name: 'Madame Ruban', tick: 5.6, start: 'LOBBY' });
    this.route = ['LOBBY', 'HALL_E', 'DOOR_E'];
    this.tamperTimer = 18;
    this.lit = 0;
  }
  onTick() {
    if (this.state === 'atDoor') return;
    if (!this.roll()) return;
    const i = this.route.indexOf(this.room);
    const next = this.route[Math.min(i + 1, this.route.length - 1)];
    this.moveTo(next, 'avance');
    this.pose = 'walk';
    if (next === 'HALL_E') this.sim.sound('ruban_rustle', { side: 'E', vol: 0.35 });
    if (next === 'DOOR_E') {
      this.state = 'atDoor';
      this.timer = Math.max(5, 9.5 - this.level * 0.2);
      this.lit = 0;
      this.pose = 'peek';
      this.sim.sound('ruban_door', { side: 'E' });
    }
  }
  onUpdate(dt) {
    // Sabotage vidéo périodique.
    this.tamperTimer -= dt;
    if (this.tamperTimer <= 0) {
      this.tamperTimer = Math.max(10, 30 - this.level * 1.0) * (0.8 + this.sim.rng.next() * 0.4);
      this.sim.tamper();
    }
    if (this.state !== 'atDoor') return;
    const o = this.sim.office;
    // La porte fermée ne fait que la faire attendre : son compte à rebours se fige.
    if (o.doorE && !o.jammed) this.timer += dt;
    if (o.lightE && o.power > 0) {
      this.lit += dt;
      if (this.lit >= 1.4) {
        this.state = 'roam';
        this.pose = 'idle';
        this.moveTo('LOBBY', 'repoussée par la lumière');
        this.sim.sound('ruban_retreat', { side: 'E' });
        return;
      }
    }
    if (this.sim.rng.chance(0.005)) this.sim.sound('ruban_door', { side: 'E', vol: 0.4 });
    if (this.timer <= 0) this.sim.attack(this);
  }
}

// 5. LE CHŒUR — suit les leurres sonores, imite les bruits entendus.
export class Choir extends Enemy {
  constructor(sim) {
    super(sim, 'choeur', { name: 'Le Chœur', tick: 6.2, start: 'PARTY' });
    this.lureRoom = null;
    this.lureUntil = 0;
    this.heard = [];
    this.mimicTimer = 14;
  }
  hear(id) {
    if (!this.heard.includes(id)) this.heard.push(id);
    if (this.heard.length > 6) this.heard.shift();
  }
  target() {
    if (this.lureRoom && this.sim.time < this.lureUntil) return this.lureRoom;
    return 'OFFICE';
  }
  onTick() {
    if (this.state === 'atDoor') return;
    if (!this.roll()) return;
    const t = this.target();
    let path;
    if (t === 'OFFICE') {
      const a = shortestPath(this.room, 'DOOR_W', ['GENERATOR', 'BACKSTAGE']);
      const b = shortestPath(this.room, 'DOOR_E', ['GENERATOR', 'BACKSTAGE']);
      path = !a ? b : !b ? a : a.length === b.length ? (this.sim.rng.chance(0.5) ? a : b) : a.length < b.length ? a : b;
    } else {
      path = shortestPath(this.room, t);
    }
    if (!path || path.length < 2) { this.note = 'attend près du leurre'; return; }
    const next = path[1];
    this.moveTo(next, t === 'OFFICE' ? 'vers la cabine' : `vers le leurre (${ROOMS[t].name})`);
    this.pose = 'walk';
    if (next === 'HALL_W' || next === 'HALL_E') this.sim.sound('choeur_hum', { side: next === 'HALL_W' ? 'W' : 'E', vol: 0.35 });
    if (next === 'DOOR_W' || next === 'DOOR_E') {
      this.state = 'atDoor';
      this.timer = Math.max(4.5, 8 - this.level * 0.18);
      this.pose = 'peek';
      this.sim.sound('choeur_door', { side: next === 'DOOR_W' ? 'W' : 'E' });
    }
  }
  onUpdate(dt) {
    this.mimicTimer -= dt;
    if (this.mimicTimer <= 0) {
      this.mimicTimer = Math.max(9, 24 - this.level) * (0.7 + this.sim.rng.next() * 0.6);
      const pool = this.heard.filter((id) => FAKEABLE[id]);
      if (pool.length) {
        const id = this.sim.rng.pick(pool);
        this.sim.sound(id, { side: FAKEABLE[id], fake: true, vol: 0.7 });
      }
    }
    if (this.state !== 'atDoor') return;
    if (this.timer > 0) return;
    const side = this.room === 'DOOR_W' ? 'doorW' : 'doorE';
    const closed = this.sim.office[side] && !(side === 'doorE' && this.sim.office.jammed);
    if (closed) {
      this.state = 'roam';
      this.pose = 'idle';
      this.moveTo('PARTY', 'repoussé par la porte');
      this.sim.sound('choeur_retreat', { side: side === 'doorW' ? 'W' : 'E' });
    } else {
      this.sim.attack(this);
    }
  }
  onLure(room) {
    if (this.state === 'atDoor') return; // engagé : le leurre n'a plus d'effet
    this.lureRoom = room;
    this.lureUntil = this.sim.time + 30;
    this.hear('lure');
  }
}

// Sons que le Chœur sait imiter, avec le côté d'où provient l'imitation.
const FAKEABLE = {
  mc_step: 'W',
  mimi_tap: 'C',
  mimi_scrape_near: 'C',
  ruban_door: 'E',
  roi_grind: 'far',
  lure: 'far',
};
