// Sous-titres des sons (accessibilité). Les imitations du Chœur ont leur propre variante.
export const CAPTIONS = {
  mc_step: 'Pas lourds — à gauche',
  mc_laugh_speaker: 'Ricanement grésillant dans les haut-parleurs',
  mc_breath: 'Servo qui ronronne derrière la porte gauche',
  mc_retreat: 'Pas qui s\'éloignent — à gauche',
  mimi_scrape_far: 'Raclement lointain dans les conduits',
  mimi_scrape_near: 'Raclement proche dans les conduits',
  mimi_tap: 'Tapotements juste devant toi (conduit)',
  mimi_retreat: 'Glissement qui s\'éloigne dans le conduit',
  mimi_giggle: 'Petit rire de marionnette',
  roi_step: 'Mécanisme lourd qui se déplace — côté est',
  roi_grind: 'Grincement d\'engrenages — salle des machines',
  roi_shocked: 'Décharge électrique, rouages qui s\'emballent',
  roi_sabotage: 'Câbles arrachés ! Coupure partielle',
  ruban_rustle: 'Bruissement de rubans — à droite',
  ruban_door: 'Rubans qui glissent sous la porte droite',
  ruban_retreat: 'Rubans qui se rétractent',
  ruban_tamper: 'Petit clic électronique',
  choeur_hum: 'Bourdonnement à plusieurs voix',
  choeur_door: 'Chœur fredonnant derrière une porte',
  choeur_retreat: 'Chœur qui s\'éloigne',
  lure: 'Air de fanfare dans un haut-parleur',
  door: 'Porte métallique',
  vent: 'Volet de conduit',
  parade: 'La mélodie de la Parade… dans le noir',
  power_out: 'Coupure générale',
  chime: 'Carillon de 6 heures',
  shock: 'Décharge',
  jam: 'La porte droite se coince',
};

export function captionFor(id, fake) {
  const base = CAPTIONS[id] ?? id;
  return fake ? `${base}… (plusieurs voix, légèrement fausses)` : base;
}
