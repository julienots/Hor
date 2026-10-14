// Plan du Carnaval des Veilleurs : salles, caméras et liaisons.
export const ROOMS = {
  STAGE: { name: 'Scène principale', cam: 'CAM01', speaker: true },
  PARTY: { name: 'Salle de fête', cam: 'CAM02', speaker: true },
  LOBBY: { name: 'Réception', cam: 'CAM03', speaker: true },
  KITCHEN: { name: 'Cuisine de service', cam: 'CAM04', speaker: true },
  WORKSHOP: { name: 'Atelier de maintenance', cam: 'CAM05', speaker: true },
  HALL_W: { name: 'Couloir ouest', cam: 'CAM06', speaker: false },
  HALL_E: { name: 'Couloir est', cam: 'CAM07', speaker: false },
  VENT: { name: 'Conduits', cam: 'CAM08', speaker: false },
  GENERATOR: { name: 'Salle des machines', cam: 'CAM09', speaker: false },
  BACKSTAGE: { name: 'Loge des costumes', cam: 'CAM10', speaker: true },
  // Emplacements collés à la cabine : visibles seulement depuis la cabine (lumières).
  DOOR_W: { name: 'Porte ouest', cam: null },
  DOOR_E: { name: 'Porte est', cam: null },
  VENT_MOUTH: { name: 'Bouche du conduit', cam: null },
};

export const CAMERAS = [
  { id: 'CAM01', room: 'STAGE', label: 'Scène' },
  { id: 'CAM02', room: 'PARTY', label: 'Salle de fête' },
  { id: 'CAM03', room: 'LOBBY', label: 'Réception' },
  { id: 'CAM04', room: 'KITCHEN', label: 'Cuisine' },
  { id: 'CAM05', room: 'WORKSHOP', label: 'Atelier' },
  { id: 'CAM06', room: 'HALL_W', label: 'Couloir O.' },
  { id: 'CAM07', room: 'HALL_E', label: 'Couloir E.' },
  { id: 'CAM08', room: 'VENT', label: 'Conduits' },
  { id: 'CAM09', room: 'GENERATOR', label: 'Machines' },
  { id: 'CAM10', room: 'BACKSTAGE', label: 'Loge' },
];

export const camRoom = (camId) => CAMERAS.find((c) => c.id === camId)?.room ?? null;

// Graphe de déplacement du Chœur (non orienté).
export const LINKS = {
  STAGE: ['PARTY', 'BACKSTAGE'],
  BACKSTAGE: ['STAGE'],
  PARTY: ['STAGE', 'LOBBY', 'HALL_W', 'KITCHEN'],
  LOBBY: ['PARTY', 'HALL_E'],
  KITCHEN: ['PARTY', 'HALL_E'],
  HALL_W: ['PARTY', 'DOOR_W'],
  HALL_E: ['LOBBY', 'KITCHEN', 'DOOR_E', 'GENERATOR'],
  GENERATOR: ['HALL_E'],
  WORKSHOP: ['VENT'],
  VENT: ['WORKSHOP', 'VENT_MOUTH'],
  DOOR_W: ['HALL_W'],
  DOOR_E: ['HALL_E'],
  VENT_MOUTH: ['VENT'],
};

// Salles accessibles à pied par le joueur (les portes qu'il peut franchir).
export const WALK_LINKS = {
  OFFICE: ['HALL_W', 'HALL_E'],
  HALL_W: ['OFFICE', 'PARTY', 'WORKSHOP'],
  HALL_E: ['OFFICE', 'LOBBY', 'KITCHEN', 'GENERATOR'],
  PARTY: ['HALL_W', 'STAGE', 'LOBBY', 'KITCHEN'],
  STAGE: ['PARTY', 'BACKSTAGE'],
  BACKSTAGE: ['STAGE'],
  LOBBY: ['PARTY', 'HALL_E'],
  KITCHEN: ['PARTY', 'HALL_E'],
  WORKSHOP: ['HALL_W'],
  GENERATOR: ['HALL_E'],
};

// Graphe utilisé par une mascotte qui traque le joueur hors de la cabine.
export const HUNT_LINKS = (() => {
  const g = {};
  for (const src of [LINKS, WALK_LINKS]) {
    for (const [a, list] of Object.entries(src)) {
      for (const b of list) {
        if (a === 'OFFICE' || b === 'OFFICE') continue;
        (g[a] ??= new Set()).add(b);
        (g[b] ??= new Set()).add(a);
      }
    }
  }
  return Object.fromEntries(Object.entries(g).map(([k, v]) => [k, [...v]]));
})();

// Plus court chemin (BFS) ; renvoie la liste des salles de `from` à `to` incluses.
export function shortestPath(from, to, blocked = [], links = LINKS) {
  if (from === to) return [from];
  const prev = { [from]: null };
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const nb of links[cur] ?? []) {
      if (nb in prev || blocked.includes(nb)) continue;
      prev[nb] = cur;
      if (nb === to) {
        const path = [to];
        let p = cur;
        while (p !== null) { path.unshift(p); p = prev[p]; }
        return path;
      }
      queue.push(nb);
    }
  }
  return null;
}
