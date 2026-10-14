// ---------------------------------------------------------------------------
// Plan du bâtiment : toutes les salles sont placées les unes à côté des autres,
// reliées par de vraies ouvertures dans les murs (ou un court passage).
// Coordonnées monde : x vers l'est, z vers le sud (le nord est en -z).
//
//            STAGE ── BACKSTAGE
//              │
//   HALL_W ── PARTY ── LOBBY ── HALL_E
//     │  │       │               │  │
//  WORKSHOP      └── KITCHEN ────┘  GENERATOR
//     │                              │
//     └──── couloir ── CABINE ── couloir
// ---------------------------------------------------------------------------

// Centre de chaque salle (x, z) et dimensions intérieures (largeur x, profondeur z).
export const ROOM_POS = {
  STAGE: [-6, -24.5], PARTY: [-6, -16], LOBBY: [4.5, -15.5], KITCHEN: [2.4, -9],
  WORKSHOP: [-13.4, -6], HALL_W: [-8.2, -5], HALL_E: [8.2, -5], GENERATOR: [13.9, -7.6],
  BACKSTAGE: [2.5, -25], VENT: [0, 80], OFFICE: [0, 0],
};
export const DIMS = {
  STAGE: [10, 9], PARTY: [12, 8], LOBBY: [9, 7], KITCHEN: [8, 6], WORKSHOP: [8, 6],
  HALL_W: [2.4, 14], HALL_E: [2.4, 14], GENERATOR: [9, 7], BACKSTAGE: [7, 6],
};

export const DOOR_W = 1.2; // largeur des ouvertures
export const DOOR_H = 2.3; // hauteur des ouvertures

// Liaisons : [salle A, mur A, salle B, mur B, coordonnée monde le long du mur]
// (z pour les murs left/right, x pour les murs back/front).
export const CONNECTIONS = [
  ['OFFICE', 'stubW', 'HALL_W', 'right', -0.2],
  ['OFFICE', 'stubE', 'HALL_E', 'left', -0.2],
  ['HALL_W', 'back', 'PARTY', 'front', -8.2],
  ['HALL_W', 'left', 'WORKSHOP', 'right', -8],
  ['HALL_E', 'back', 'LOBBY', 'front', 8.2],
  ['HALL_E', 'right', 'GENERATOR', 'left', -6],
  ['HALL_E', 'left', 'KITCHEN', 'right', -7.2],
  ['PARTY', 'right', 'LOBBY', 'left', -16],
  ['PARTY', 'front', 'KITCHEN', 'back', -0.8],
  ['PARTY', 'back', 'STAGE', 'front', -2],
  ['STAGE', 'right', 'BACKSTAGE', 'left', -23],
];

/** Position monde d'un mur de salle. */
export function wallPos(room, wall) {
  if (wall === 'stubW') return -7;
  if (wall === 'stubE') return 7;
  const [cx, cz] = ROOM_POS[room];
  const [w, d] = DIMS[room];
  return { left: cx - w / 2, right: cx + w / 2, back: cz - d / 2, front: cz + d / 2 }[wall];
}
export const isXWall = (wall) => wall === 'left' || wall === 'right' || wall === 'stubW' || wall === 'stubE';

/** Ouvertures d'une salle, en coordonnée locale le long de chaque mur. */
export function roomOpenings(room) {
  const out = { back: [], front: [], left: [], right: [] };
  const [cx, cz] = ROOM_POS[room] ?? [0, 0];
  for (const [a, wa, b, wb, at] of CONNECTIONS) {
    for (const [r, w] of [[a, wa], [b, wb]]) {
      if (r !== room || !out[w]) continue;
      out[w].push(isXWall(w) ? at - cz : at - cx);
    }
  }
  return out;
}
