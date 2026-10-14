// « Joueur robot » qui applique les règles apprises dans les messages d'Odile,
// avec un temps de réaction humain. Sert à vérifier qu'aucune mort n'est injuste.
export function makeBot(sim, { reaction = 1.2 } = {}) {
  const seen = {};
  const since = (key, cond) => {
    if (!cond) { delete seen[key]; return false; }
    seen[key] ??= sim.time;
    return sim.time - seen[key] >= reaction;
  };
  let camWatch = 0;
  return function act() {
    const o = sim.office;
    const e = sim.enemies;
    if (o.powerOut || sim.outcome) return;
    const at = (who, room) => e[who].active && e[who].room === room;

    // Portes
    const wantW = since('mcW', at('mc', 'DOOR_W')) || since('chW', at('choeur', 'DOOR_W'));
    const wantE = since('chE', at('choeur', 'DOOR_E'));
    if (wantW !== o.doorW && (wantW || !at('mc', 'DOOR_W') && !at('choeur', 'DOOR_W'))) sim.toggleDoor('W');
    if (wantE !== o.doorE && !o.jammed && (wantE || !at('choeur', 'DOOR_E'))) sim.toggleDoor('E');
    // Volet
    const wantVent = since('mimi', at('mimi', 'VENT_MOUTH'));
    if (wantVent !== o.vent && (wantVent || !at('mimi', 'VENT_MOUTH'))) sim.toggleVent();
    // Lumière contre Madame Ruban
    const wantLightE = since('ruban', at('ruban', 'DOOR_E'));
    if (wantLightE !== o.lightE) sim.setLight('E', wantLightE);

    // Caméras : décharge sur le Roi, leurre contre le Chœur et Mimi
    if (since('roi', at('roi', 'GENERATOR'))) {
      sim.setCams(true); sim.selectCam('CAM09'); sim.shock();
    } else if (since('chHall', at('choeur', 'HALL_W') || at('choeur', 'HALL_E')) && sim.lureCooldown === 0) {
      sim.setCams(true); sim.selectCam('CAM01'); sim.playLure();
    } else if (since('mimiVent', at('mimi', 'VENT') && e.mimi.depth === 2) && sim.lureCooldown === 0) {
      sim.setCams(true); sim.selectCam('CAM05'); sim.playLure();
    } else if (at('mc', 'HALL_W') && camWatch < 2.5 && o.power > 35) {
      // Bloquer le Maître de Cérémonie en le regardant quelques secondes.
      sim.setCams(true); sim.selectCam('CAM06'); camWatch += 0.1;
    } else {
      if (o.camsOpen) sim.setCams(false);
      if (!at('mc', 'HALL_W')) camWatch = 0;
    }
  };
}

export function runNight(sim, bot, dt = 0.1) {
  let guard = 0;
  while (!sim.outcome && guard++ < 1e6) {
    if (bot) bot();
    sim.update(dt);
  }
  return sim;
}
