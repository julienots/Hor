// Configuration des nuits : niveaux d'IA (0 = inactif, 20 = maximum) par heure.
// Format : niveau de départ et bonus appliqué à partir d'une heure donnée.
export const HOUR_SECONDS = 60; // une heure de jeu = 60 s réelles (nuit complète = 6 min)

export const NIGHTS = [
  {
    id: 1,
    title: 'Nuit 1 — Prise de poste',
    ai: { mc: [3, { 2: 5, 4: 6 }], mimi: [0, { 2: 3, 4: 4 }], roi: [0], ruban: [0], choeur: [0] },
    drain: 1.0,
    tutorial: true,
  },
  {
    id: 2,
    title: 'Nuit 2 — Les rouages',
    ai: { mc: [5, { 3: 7 }], mimi: [4, { 3: 6 }], roi: [4, { 2: 6, 4: 8 }], ruban: [0], choeur: [0] },
    drain: 1.02,
  },
  {
    id: 3,
    title: 'Nuit 3 — Fausses images',
    ai: { mc: [6, { 3: 8 }], mimi: [5, { 3: 7 }], roi: [5, { 3: 7 }], ruban: [5, { 2: 7, 4: 9 }], choeur: [0] },
    drain: 1.04,
  },
  {
    id: 4,
    title: 'Nuit 4 — Le Chœur',
    ai: { mc: [7, { 3: 9 }], mimi: [7, { 3: 9 }], roi: [6, { 3: 8 }], ruban: [7, { 3: 9 }], choeur: [5, { 2: 7, 4: 10 }] },
    drain: 1.06,
  },
  {
    id: 5,
    title: 'Nuit 5 — La Parade',
    ai: { mc: [9, { 2: 11, 4: 13 }], mimi: [9, { 3: 11 }], roi: [8, { 3: 10 }], ruban: [9, { 3: 11 }], choeur: [8, { 2: 10, 4: 12 }] },
    drain: 1.08,
  },
  {
    id: 6,
    title: 'Nuit 6 — Après la fermeture',
    ai: { mc: [13, { 3: 15 }], mimi: [12, { 3: 14 }], roi: [11, { 3: 13 }], ruban: [12, { 3: 14 }], choeur: [12, { 3: 14 }] },
    drain: 1.1,
    bonus: true,
  },
];

export function aiLevel(nightCfg, key, hour) {
  const [base, bumps = {}] = nightCfg.ai[key] ?? [0];
  let lvl = base;
  for (const [h, v] of Object.entries(bumps)) if (hour >= Number(h)) lvl = v;
  return lvl;
}
