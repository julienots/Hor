import { describe, it, expect } from 'vitest';
import { Simulation, DRAIN } from '../../src/sim/simulation.js';
import { shortestPath } from '../../src/sim/map.js';
import { makeBot, runNight } from './bot.js';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

describe('Carte', () => {
  it('trouve un chemin de la salle de fête aux portes', () => {
    expect(shortestPath('PARTY', 'DOOR_W')).toEqual(['PARTY', 'HALL_W', 'DOOR_W']);
    expect(shortestPath('STAGE', 'DOOR_E')).toEqual(['STAGE', 'PARTY', 'LOBBY', 'HALL_E', 'DOOR_E']);
  });
});

describe('Énergie et horloge', () => {
  it('la nuit dure 6 heures et se gagne sans ennemi', () => {
    const sim = new Simulation({ night: 1, seed: 1 });
    for (const e of sim.list) e.level = 0;
    sim.refreshLevels = () => {};
    runNight(sim, null);
    expect(sim.outcome).toBe('win');
    expect(sim.time).toBeGreaterThanOrEqual(360);
  });

  it("la consommation augmente avec l'usage", () => {
    const sim = new Simulation({ night: 1, seed: 1 });
    const idle = sim.drainRate();
    sim.toggleDoor('W');
    sim.toggleDoor('E');
    expect(sim.drainRate()).toBeCloseTo(idle + 2 * DRAIN.door * sim.nightCfg.drain);
  });

  it('à 0 % : portes ouvertes, puis la Parade et le Roi des Rouages', () => {
    const sim = new Simulation({ night: 1, seed: 3 });
    for (const e of sim.list) e.level = 0;
    sim.refreshLevels = () => {};
    sim.toggleDoor('W');
    sim.office.power = 0.01;
    sim.update(0.2);
    expect(sim.office.powerOut).toBe(true);
    expect(sim.office.doorW).toBe(false);
    expect(sim.toggleDoor('W')).toBe(false);
    runNight(sim, null);
    const types = sim.drainEvents().map((e) => e.type);
    if (sim.outcome === 'dead') {
      expect(sim.killer).toBe('roi');
      expect(types).toContain('parade');
    }
  });
});

describe('Le Maître de Cérémonie', () => {
  it('reste figé tant que sa caméra est regardée', () => {
    const sim = new Simulation({ night: 1, seed: 5 });
    sim.enemies.mc.level = 20;
    sim.refreshLevels = () => {};
    sim.setCams(true);
    sim.selectCam('CAM01');
    // L'énergie ne doit pas interférer.
    for (let i = 0; i < 300; i++) { sim.office.power = 100; sim.update(0.1); }
    expect(sim.enemies.mc.room).toBe('STAGE');
    sim.setCams(false);
    for (let i = 0; i < 300 && sim.enemies.mc.room === 'STAGE'; i++) sim.update(0.1);
    expect(sim.enemies.mc.room).not.toBe('STAGE');
  });

  it('recule si la porte ouest est fermée, tue sinon', () => {
    for (const closeDoor of [true, false]) {
      const sim = new Simulation({ night: 1, seed: 9 });
      sim.refreshLevels = () => {};
      sim.enemies.mc.level = 20;
      for (let i = 0; i < 2000 && sim.enemies.mc.room !== 'DOOR_W'; i++) sim.update(0.1);
      expect(sim.enemies.mc.room).toBe('DOOR_W');
      if (closeDoor) sim.toggleDoor('W');
      for (let i = 0; i < 200 && !sim.outcome && sim.enemies.mc.room === 'DOOR_W'; i++) sim.update(0.1);
      if (closeDoor) { expect(sim.outcome).toBeNull(); expect(sim.enemies.mc.room).toBe('PARTY'); }
      else { expect(sim.outcome).toBe('dead'); expect(sim.killer).toBe('mc'); }
    }
  });
});

describe('Mimi', () => {
  it('le bruit accélère Mimi', () => {
    const avgSteps = (noisy) => {
      let total = 0;
      for (const seed of SEEDS) {
        const sim = new Simulation({ night: 1, seed });
        sim.refreshLevels = () => {};
        for (const e of sim.list) e.level = 0;
        sim.enemies.mimi.level = 4;
        for (let i = 0; i < 400; i++) {
          if (noisy && i % 10 === 0) sim.noise = 3;
          sim.office.power = 100;
          sim.update(0.1);
          if (sim.outcome) break;
        }
        total += sim.drainEvents().filter((e) => e.type === 'moved' && e.who === 'mimi').length;
      }
      return total;
    };
    expect(avgSteps(true)).toBeGreaterThan(avgSteps(false));
  });

  it('le leurre dans l’atelier la renvoie en arrière', () => {
    const sim = new Simulation({ night: 1, seed: 2 });
    sim.enemies.mimi.setDepth(2, 'test');
    sim.enemies.mimi.state = 'roam';
    sim.setCams(true);
    sim.selectCam('CAM05');
    expect(sim.playLure()).toBe(true);
    expect(sim.enemies.mimi.depth).toBe(0);
  });
});

describe('Le Roi des Rouages', () => {
  it('la décharge le renvoie en cuisine ; le sabotage bloque la porte est', () => {
    const sim = new Simulation({ night: 2, seed: 4 });
    sim.refreshLevels = () => {};
    for (const e of sim.list) e.level = 0;
    sim.enemies.roi.level = 20;
    for (let i = 0; i < 3000 && sim.enemies.roi.room !== 'GENERATOR'; i++) sim.update(0.1);
    expect(sim.enemies.roi.state).toBe('sabotage');
    sim.setCams(true);
    sim.selectCam('CAM09');
    expect(sim.shock()).toBe(true);
    expect(sim.enemies.roi.room).toBe('KITCHEN');
    sim.setCams(false);
    for (let i = 0; i < 3000 && sim.enemies.roi.state !== 'sabotage'; i++) sim.update(0.1);
    const before = sim.office.power;
    for (let i = 0; i < 300 && sim.office.jammed === 0; i++) sim.update(0.1);
    expect(sim.office.jammed).toBeGreaterThan(0);
    expect(sim.office.power).toBeLessThan(before - 10);
    expect(sim.toggleDoor('E')).toBe(false);
  });
});

describe('Madame Ruban', () => {
  it('fige des caméras et seule la lumière la repousse', () => {
    const sim = new Simulation({ night: 3, seed: 6 });
    sim.refreshLevels = () => {};
    for (const e of sim.list) e.level = 0;
    sim.enemies.ruban.level = 20;
    sim.enemies.ruban.tamperTimer = 0.1;
    sim.update(0.2);
    expect(sim.debug().loops.length).toBe(1);
    const looped = sim.debug().loops[0];
    sim.setCams(true);
    sim.selectCam(looped);
    sim.resetCam();
    expect(sim.isLooped(looped)).toBe(false);
    sim.setCams(false);
    for (let i = 0; i < 3000 && sim.enemies.ruban.room !== 'DOOR_E'; i++) { sim.office.power = 100; sim.update(0.1); }
    // Porte fermée : elle attend sans tuer.
    sim.toggleDoor('E');
    for (let i = 0; i < 300; i++) { sim.office.power = 100; sim.update(0.1); }
    expect(sim.outcome).toBeNull();
    expect(sim.enemies.ruban.room).toBe('DOOR_E');
    sim.setLight('E', true);
    for (let i = 0; i < 30; i++) sim.update(0.1);
    expect(sim.enemies.ruban.room).toBe('LOBBY');
  });
});

describe('Le Chœur', () => {
  it('suit le leurre et imite des sons entendus', () => {
    const sim = new Simulation({ night: 4, seed: 8 });
    sim.refreshLevels = () => {};
    for (const e of sim.list) e.level = 0;
    sim.enemies.choeur.level = 20;
    sim.setCams(true);
    sim.selectCam('CAM04');
    sim.playLure();
    sim.setCams(false);
    for (let i = 0; i < 200; i++) { sim.office.power = 100; sim.update(0.1); }
    expect(sim.enemies.choeur.room).toBe('KITCHEN');
    sim.sound('mimi_tap', { side: 'C' });
    sim.enemies.choeur.mimicTimer = 0.01;
    sim.drainEvents();
    sim.update(0.1);
    const fakes = sim.drainEvents().filter((e) => e.type === 'sound' && e.fake);
    expect(fakes.length).toBe(1);
  });
});

describe('Équité : un joueur appliquant les règles survit, un joueur passif meurt', () => {
  for (const night of [1, 2, 3, 4, 5]) {
    it(`nuit ${night}`, () => {
      let wins = 0;
      let idleDeaths = 0;
      const deaths = {};
      for (const seed of SEEDS) {
        const sim = new Simulation({ night, seed });
        runNight(sim, makeBot(sim));
        if (sim.outcome === 'win') wins++;
        else deaths[sim.killer] = (deaths[sim.killer] ?? 0) + 1;
        const idle = new Simulation({ night, seed });
        runNight(idle, null);
        if (idle.outcome === 'dead') idleDeaths++;
      }
      // Le robot doit gagner (quasi) toujours, le joueur passif doit (quasi) toujours mourir.
      expect(wins, `morts du robot : ${JSON.stringify(deaths)}`).toBeGreaterThanOrEqual(SEEDS.length - 1);
      expect(idleDeaths).toBeGreaterThanOrEqual(SEEDS.length - 1);
    });
  }
});
