// Sauvegarde locale (progression + paramètres). Toutes les lectures/écritures
// sont protégées : le jeu fonctionne même si le stockage est indisponible.
const KEY = 'nightshift-hollow-parade.save.v1';

export const DEFAULT_SETTINGS = {
  volMaster: 0.9, volAmbience: 0.7, volSfx: 0.9, volScare: 0.8, volMusic: 0.7,
  sensitivity: 1, quality: 'medium', reduceFlash: false, shake: true, vibration: true,
  subtitles: true, showFps: false, debug: false,
};

const DEFAULT = { unlocked: 1, lastNight: 1, completed: [], fragments: [], hintsSeen: [], deaths: 0, settings: { ...DEFAULT_SETTINGS } };

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    const s = JSON.parse(raw);
    return { ...structuredClone(DEFAULT), ...s, settings: { ...DEFAULT_SETTINGS, ...(s.settings ?? {}) } };
  } catch {
    return structuredClone(DEFAULT);
  }
}

export function writeSave(save) {
  try { localStorage.setItem(KEY, JSON.stringify(save)); return true; } catch { return false; }
}

export function resetProgress(save) {
  const settings = save.settings;
  Object.assign(save, structuredClone(DEFAULT), { settings });
  writeSave(save);
}
