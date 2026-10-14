// Rig articulé et lecteur de clips d'animation avec fondu enchaîné.
// Un clip est une fonction (t, R) qui ajoute des rotations/positions aux os
// par rapport à la pose de repos, et des paramètres spéciaux (mâchoire, cou…).

class Accumulator {
  constructor() { this.rot = {}; this.pos = {}; this.par = {}; }
  r(name, x = 0, y = 0, z = 0) {
    const a = (this.rot[name] ??= [0, 0, 0]);
    a[0] += x; a[1] += y; a[2] += z;
  }
  p(name, x = 0, y = 0, z = 0) {
    const a = (this.pos[name] ??= [0, 0, 0]);
    a[0] += x; a[1] += y; a[2] += z;
  }
  set(param, v) { this.par[param] = (this.par[param] ?? 0) + v; }
}

export class Rig {
  constructor(root, clips, applyParams = () => {}) {
    this.root = root;
    this.joints = {};
    root.traverse((o) => { if (o.name && o.type === 'Object3D') this.joints[o.name] = o; });
    this.rest = {};
    for (const [n, j] of Object.entries(this.joints)) this.rest[n] = { p: j.position.clone(), r: j.rotation.clone() };
    this.clips = clips;
    this.applyParams = applyParams;
    this.layers = []; // { name, t, w, target, speed, once }
    this.current = null;
    this.time = 0;
  }

  has(name) { return !!this.clips[name]; }

  play(name, { fade = 0.35, speed = 1, restart = false } = {}) {
    if (!this.clips[name]) name = 'idle';
    if (this.current === name && !restart) return;
    this.current = name;
    for (const l of this.layers) l.target = 0;
    this.layers.push({ name, t: 0, w: fade <= 0 ? 1 : 0, target: 1, speed, fade: Math.max(0.001, fade) });
    if (fade <= 0) this.layers = this.layers.filter((l) => l.target === 1);
  }

  update(dt) {
    this.time += dt;
    const blended = new Accumulator();
    for (const l of this.layers) {
      l.t += dt * l.speed;
      const dw = dt / l.fade;
      l.w = l.target > l.w ? Math.min(l.target, l.w + dw) : Math.max(l.target, l.w - dw);
    }
    this.layers = this.layers.filter((l) => l.w > 0 || l.target > 0);
    const total = this.layers.reduce((s, l) => s + l.w, 0) || 1;
    for (const l of this.layers) {
      const acc = new Accumulator();
      this.clips[l.name](l.t, acc, this.time);
      const k = l.w / total;
      for (const [n, v] of Object.entries(acc.rot)) blended.r(n, v[0] * k, v[1] * k, v[2] * k);
      for (const [n, v] of Object.entries(acc.pos)) blended.p(n, v[0] * k, v[1] * k, v[2] * k);
      for (const [n, v] of Object.entries(acc.par)) blended.set(n, v * k);
    }
    for (const [n, j] of Object.entries(this.joints)) {
      const rs = this.rest[n];
      const r = blended.rot[n], p = blended.pos[n];
      j.rotation.set(rs.r.x + (r?.[0] ?? 0), rs.r.y + (r?.[1] ?? 0), rs.r.z + (r?.[2] ?? 0));
      j.position.set(rs.p.x + (p?.[0] ?? 0), rs.p.y + (p?.[1] ?? 0), rs.p.z + (p?.[2] ?? 0));
    }
    this.applyParams(blended.par, this.time);
  }
}

const S = Math.sin, C = Math.cos;
// Petit tremblement mécanique (servo usé) déterministe.
export const twitch = (t, f = 1, a = 1) => (S(t * 13.1 * f) * S(t * 3.7 * f + 1.3) > 0.82 ? S(t * 47) * 0.05 * a : 0);
// Claquement de tête : rare, brutal, puis immobile (effet « servo qui saute »).
export const snap = (t) => {
  const k = Math.floor(t / 2.7);
  const ph = t - k * 2.7;
  const dir = Math.sin(k * 91.7) > 0.3 ? Math.sign(Math.sin(k * 13.1)) : 0;
  return ph < 0.06 ? dir * (ph / 0.06) * 0.55 : ph < 1.2 ? dir * 0.55 : ph < 1.3 ? dir * 0.55 * (1 - (ph - 1.2) / 0.1) : 0;
};

/**
 * Bibliothèque de clips humanoïdes génériques ; chaque personnage
 * peut les surcharger. Options : knee = +1 (normal) ou -1 (genoux inversés).
 */
export function humanoidClips({ knee = 1, stride = 0.45, sway = 0.06, heavy = 0, armSwing = 0.4 } = {}) {
  return {
    idle(t, R) {
      const b = S(t * 1.3);
      R.r('spine', b * 0.015, 0, 0);
      R.r('chest', b * 0.02, S(t * 0.4) * 0.03, 0);
      R.r('neck', 0, S(t * 0.3) * 0.08, twitch(t, 1, 2));
      R.r('head', S(t * 0.7) * 0.03 + twitch(t, 0.7, 3), snap(t) * 0.6, S(t * 0.21) * 0.06 + snap(t + 1.3) * 0.5);
      R.r('shoulderL', 0, 0, 0.05 + b * 0.02); R.r('shoulderR', 0, 0, -0.05 - b * 0.02);
      R.r('elbowL', -0.15, 0, 0); R.r('elbowR', -0.15 + twitch(t, 1.3, 2), 0, 0);
      R.p('hips', 0, b * 0.006, 0);
      R.set('jaw', 0.03 + Math.max(0, twitch(t, 0.5, 4)));
    },
    walk(t, R) {
      const w = t * (3.2 - heavy * 1.2);
      const s = S(w), c = C(w);
      R.r('thighL', s * stride, 0, 0); R.r('thighR', -s * stride, 0, 0);
      R.r('kneeL', knee * Math.max(0, -c) * stride * 1.4, 0, 0); R.r('kneeR', knee * Math.max(0, c) * stride * 1.4, 0, 0);
      R.r('footL', -s * 0.2, 0, 0); R.r('footR', s * 0.2, 0, 0);
      R.r('shoulderL', -s * armSwing, 0, 0.08); R.r('shoulderR', s * armSwing, 0, -0.08);
      R.r('elbowL', -0.3, 0, 0); R.r('elbowR', -0.3, 0, 0);
      R.r('hips', 0, s * sway, c * sway * 0.5 * (1 + heavy));
      R.r('chest', 0.05 + heavy * 0.1, -s * sway, 0);
      R.r('head', 0, s * sway * 0.6, twitch(t, 1, 2));
      R.p('hips', 0, Math.abs(c) * 0.04 * (1 + heavy) - 0.02, 0);
      R.set('jaw', 0.05);
    },
    observe(t, R) {
      // Tête qui se tourne lentement vers l'objectif, puis s'incline.
      const k = Math.min(1, t / 1.2);
      R.r('neck', 0, 0, 0.25 * k);
      R.r('head', -0.1 * k + twitch(t, 2, 3), 0, 0.35 * k + S(t * 2.3) * 0.02);
      R.r('chest', 0.05, 0, 0);
      R.r('shoulderL', 0, 0, 0.05); R.r('shoulderR', -0.2, 0, -0.1); R.r('elbowR', -0.9, 0, 0);
      R.set('jaw', 0.1 + 0.05 * S(t * 3));
      R.set('eyes', 1.5);
    },
    peek(t, R) {
      // Penché dans l'encadrement de la porte, immobile, avec à-coups.
      R.r('spine', 0.12, 0, 0.12);
      R.r('chest', 0.15, 0.1, 0.1);
      R.r('neck', 0.1, 0, 0.2);
      R.r('head', 0.05 + twitch(t, 1.6, 4), 0, 0.3);
      R.r('shoulderL', -0.8, 0, 0.2); R.r('elbowL', -0.6, 0, 0);
      R.r('shoulderR', 0.1, 0, -0.1);
      R.set('jaw', 0.15 + 0.1 * Math.max(0, S(t * 0.9)));
      R.set('eyes', 2);
    },
    attack(t, R) {
      // Élan vers l'avant, bras levés.
      const k = Math.min(1, t / 0.35);
      R.r('spine', 0.25 * k, 0, 0); R.r('chest', 0.3 * k, 0, 0);
      R.r('shoulderL', -2.2 * k, 0, 0.4 * k); R.r('shoulderR', -2.2 * k, 0, -0.4 * k);
      R.r('elbowL', -0.5 * k, 0, 0); R.r('elbowR', -0.5 * k, 0, 0);
      R.r('thighL', -0.4 * k, 0, 0); R.r('kneeL', knee * 0.6 * k, 0, 0);
      R.p('hips', 0, 0, 0.3 * k);
      R.set('jaw', 0.9 * k);
      R.set('eyes', 3);
    },
    jumpscare(t, R) {
      // Cri : tête qui tremble violemment, mâchoire grande ouverte, bras projetés.
      const k = Math.min(1, t / 0.12);
      const shake = S(t * 61) * 0.12 + S(t * 37) * 0.08;
      R.r('spine', 0.35 * k, 0, 0); R.r('chest', 0.25 * k, shake * 0.3, 0);
      R.r('neck', 0.2 * k + shake, shake, 0);
      R.r('head', -0.25 * k + shake * 0.7, shake * 0.8, shake * 0.5);
      R.r('shoulderL', -1.9 * k, 0, 0.7 * k); R.r('shoulderR', -1.9 * k, 0, -0.7 * k);
      R.r('elbowL', -0.9 * k, 0, 0); R.r('elbowR', -0.9 * k, 0, 0);
      R.set('jaw', 1.0 * k);
      R.set('eyes', 4);
      R.set('fingers', 1);
    },
    stunned(t, R) {
      // Désactivation : effondrement, tête pendante, sursauts électriques.
      const k = Math.min(1, t / 0.8);
      const z = S(t * 40) * Math.max(0, 1 - t / 3) * 0.08;
      R.r('spine', 0.35 * k, 0, z); R.r('chest', 0.25 * k, 0, 0);
      R.r('neck', 0.5 * k, 0, 0.2 * k); R.r('head', 0.3 * k + z, 0, 0.3 * k);
      R.r('shoulderL', 0.2 * k, 0, 0.3 * k); R.r('shoulderR', 0.2 * k, 0, -0.3 * k);
      R.r('elbowL', -0.1, 0, 0); R.r('elbowR', -0.1, 0, 0);
      R.r('thighL', -0.3 * k, 0, 0); R.r('thighR', -0.3 * k, 0, 0); R.r('kneeL', knee * 0.6 * k, 0, 0); R.r('kneeR', knee * 0.6 * k, 0, 0);
      R.p('hips', 0, -0.12 * k, 0);
      R.set('jaw', 0.4 * k);
      R.set('eyes', 0.2 + Math.max(0, S(t * 9)) * 0.3);
    },
    frozen(t, R) {
      // Figé face à la caméra : seulement des micro-tremblements.
      R.r('head', twitch(t, 0.4, 2), 0, 0.12);
      R.r('neck', 0, 0.1, 0);
      R.set('jaw', 0.05);
      R.set('eyes', 1.2);
    },
    lean(t, R) {
      R.r('spine', 0.08, 0.2, 0.06);
      R.r('chest', 0.1, 0.15, 0);
      R.r('head', 0.05, 0.25, 0.2 + twitch(t, 1, 2));
      R.r('shoulderL', -0.4, 0, 0.2); R.r('elbowL', -0.5, 0, 0);
      R.set('eyes', 1.4);
    },
  };
}
