import { buildMC } from './characters/mc.js';
import { buildMimi } from './characters/mimi.js';
import { buildRoi } from './characters/roi.js';
import { buildRuban } from './characters/ruban.js';
import { buildChoeur } from './characters/choeur.js';

export const BUILDERS = { mc: buildMC, mimi: buildMimi, roi: buildRoi, ruban: buildRuban, choeur: buildChoeur };

export function buildCharacter(key) {
  return BUILDERS[key]();
}
