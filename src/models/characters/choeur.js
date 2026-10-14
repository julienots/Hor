import * as THREE from 'three';
import { wornPaint, dustyFabric, yellowedPlastic, mat, lathe, dent, mesh, tube, joint, rivets } from '../kit.js';
import { Rig, humanoidClips, twitch } from '../rig.js';
import { skeleton, dressLimbs, mechHand, curlFingers, mechEye, teethRow, contactShadow } from './common.js';

/**
 * LE CHŒUR — cinq têtes de mascottes de la troupe (lapin, ours, oiseau, chat, clown)
 * soudées sur un corps commun en patchwork, trois bras dépareillés, voix multiples.
 */
export function buildChoeur() {
  const root = new THREE.Group();
  root.name = 'Choeur';
  const m = {
    patch: mat(dustyFabric({ base: '#6a5a3a', seam: '#d0b070', plaid: '#3a5a6a', stains: 1.3, seed: 61 }), { rough: 1, bump: 0.03 }),
    patch2: mat(dustyFabric({ base: '#7a3a4a', seam: '#e0d0b0', stains: 1.2, seed: 62 }), { rough: 1, bump: 0.03 }),
    metal: mat(wornPaint({ base: '#5a5652', under: '#2a2420', rust: 1, chips: 0.9, grime: 1, seed: 63 }), { metal: 0.8, rough: 0.5, bump: 0.02 }),
    weld: new THREE.MeshStandardMaterial({ color: '#3a2a20', emissive: new THREE.Color('#7a2a08'), emissiveIntensity: 0.4, roughness: 0.6, metalness: 0.6 }),
    teeth: new THREE.MeshStandardMaterial({ color: '#d8ccaa', roughness: 0.4 }),
    dark: new THREE.MeshStandardMaterial({ color: '#0c0606', roughness: 0.9 }),
    heads: {
      lapin: mat(dustyFabric({ base: '#c8c0d8', seam: '#5a3a5a', stains: 1, seed: 64 }), { rough: 1, bump: 0.03 }),
      ours: mat(dustyFabric({ base: '#8a5a30', seam: '#e0c080', stains: 1, seed: 65 }), { rough: 1, bump: 0.03 }),
      oiseau: mat(wornPaint({ base: '#d8b830', under: '#6a5a2a', rust: 0.4, chips: 0.5, seed: 66 }), { rough: 0.5, metal: 0.2 }),
      chat: mat(dustyFabric({ base: '#3a3a44', seam: '#c0c0c0', stains: 0.8, seed: 67 }), { rough: 1, bump: 0.03 }),
      clown: mat(yellowedPlastic({ base: '#f2ead8', cracks: 16, seed: 68, blush: 'rgba(220,40,60,0.5)' }), { rough: 0.4 }),
    },
    beak: mat(wornPaint({ base: '#e07a20', under: '#5a3010', rust: 0.3, seed: 69 }), { rough: 0.4 }),
    red: new THREE.MeshStandardMaterial({ color: '#c01828', roughness: 0.35 }),
    ruff: mat(dustyFabric({ base: '#e8e0f0', seam: '#c01828', stains: 1, seed: 70 }), { rough: 1, side: THREE.DoubleSide }),
  };
  const o = { hipY: 0.8, spine: 0.2, chest: 0.4, neckY: 0.5, neckLen: 0.08, shoulderX: 0.48, shoulderY: 0.3, upper: 0.38, fore: 0.4, thigh: 0.34, shin: 0.34, hipX: 0.2, armR: 0.06, legR: 0.1 };
  const J = skeleton(root, o);
  dressLimbs(J, o, { arm: m.metal, leg: m.patch2, metal: m.metal });
  for (const s of ['L', 'R']) J['foot' + s].add(mesh(new THREE.SphereGeometry(0.13, 14, 10), m.patch, { y: -0.04, z: 0.06, s: [1, 0.6, 1.4] }));
  // Corps bossu en sac de tissu cousu sur une cage métallique
  const body = dent(lathe([[0, -0.15], [0.32, -0.12], [0.45, 0.1], [0.55, 0.4], [0.58, 0.6], [0.5, 0.82], [0.3, 0.92], [0, 0.94]], 32), 0.09, 21);
  J.spine.add(mesh(body, m.patch, { y: -0.1, s: [1.1, 1, 0.9] }));
  // pièces rapportées
  for (const [x, y, z, r] of [[0.3, 0.35, 0.33, 0.18], [-0.35, 0.15, 0.28, 0.15], [0.05, 0.6, -0.42, 0.2]]) {
    J.spine.add(mesh(new THREE.SphereGeometry(r, 14, 10), m.patch2, { x, y, z, s: [1, 1, 0.35] }));
  }
  // côtes métalliques apparentes
  for (let i = 0; i < 4; i++) J.spine.add(mesh(new THREE.TorusGeometry(0.4 + i * 0.03, 0.015, 6, 24, Math.PI * 0.8), m.metal, { y: 0.15 + i * 0.13, z: 0.05, rx: Math.PI / 2, rz: Math.PI * 0.1 }));

  // ---- TÊTES ----
  const heads = [];
  const makeHead = (parent, kind, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, phase = 0 }) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    pivot.rotation.set(rx, ry, rz);
    pivot.scale.setScalar(s);
    parent.add(pivot);
    const hm = m.heads[kind];
    pivot.add(mesh(dent(new THREE.SphereGeometry(0.17, 26, 18), 0.03, phase * 10 + 3), hm, { y: 0.15, s: [1.05, 0.95, 1] }));
    // collier de soudure à la base
    pivot.add(mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 18), m.weld, { y: 0.0, rx: Math.PI / 2 }));
    const eyes = [];
    const eyeColor = { lapin: '#ff3a8a', ours: '#ffb020', oiseau: '#40ff60', chat: '#c0ff20', clown: '#ff2020' }[kind];
    for (const sx of [-1, 1]) {
      // yeux dépareillés : parfois un bouton cousu à la place
      if (kind === 'ours' && sx < 0) {
        pivot.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.015, 12), m.dark, { x: sx * 0.065, y: 0.19, z: 0.15, rx: Math.PI / 2 }));
        continue;
      }
      eyes.push(mechEye(pivot, { r: 0.038, x: sx * 0.065, y: 0.19, z: 0.13, irisColor: eyeColor, lidMat: hm }));
    }
    const jaw = new THREE.Group();
    jaw.position.set(0, 0.1, 0.08);
    pivot.add(jaw);
    jaw.add(mesh(new THREE.SphereGeometry(0.1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), hm, { y: 0.0, z: 0.02, s: [1, 0.6, 0.9] }));
    pivot.add(mesh(new THREE.SphereGeometry(0.09, 16, 8), m.dark, { y: 0.095, z: 0.1, s: [1, 0.35, 0.6] }));
    teethRow(pivot, { n: 8, w: 0.13, h: 0.025, curve: 0.02, y: 0.115, z: 0.165, mat: m.teeth });
    // attributs propres à chaque mascotte
    if (kind === 'lapin') {
      for (const sx of [-1, 1]) {
        const ear = mesh(lathe([[0, 0], [0.04, 0.05], [0.05, 0.2], [0.03, 0.34], [0, 0.36]], 12), hm, { x: sx * 0.07, y: 0.28, rz: -sx * 0.25, s: [1, 1, 0.4] });
        if (sx > 0) ear.rotation.x = 1.2; // oreille cassée, pliée
        pivot.add(ear);
      }
    } else if (kind === 'ours') {
      for (const sx of [-1, 1]) pivot.add(mesh(new THREE.SphereGeometry(0.06, 12, 8), hm, { x: sx * 0.13, y: 0.3, s: [1, 1, 0.5] }));
      pivot.add(mesh(new THREE.SphereGeometry(0.025, 8, 6), m.dark, { y: 0.15, z: 0.175 }));
    } else if (kind === 'oiseau') {
      pivot.add(mesh(new THREE.ConeGeometry(0.06, 0.18, 12), m.beak, { y: 0.14, z: 0.22, rx: Math.PI / 2 }));
      for (let i = 0; i < 5; i++) pivot.add(mesh(new THREE.ConeGeometry(0.02, 0.15, 6), m.red, { x: (i - 2) * 0.03, y: 0.34, z: -0.02, rz: (i - 2) * 0.25 }));
    } else if (kind === 'chat') {
      for (const sx of [-1, 1]) pivot.add(mesh(new THREE.ConeGeometry(0.06, 0.13, 4), hm, { x: sx * 0.1, y: 0.31, rz: -sx * 0.3 }));
      for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) pivot.add(mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.16, 3), m.metal, { x: sx * 0.12, y: 0.13 + k * 0.015, z: 0.15, rz: Math.PI / 2 + sx * (k - 1) * 0.15 }));
    } else if (kind === 'clown') {
      pivot.add(mesh(new THREE.SphereGeometry(0.04, 12, 10), m.red, { y: 0.15, z: 0.18 }));
      pivot.add(mesh(lathe([[0.1, 0], [0.22, 0.02], [0.24, 0.04], [0.1, 0.05]], 24), m.ruff, { y: -0.02 }));
      pivot.add(mesh(new THREE.ConeGeometry(0.07, 0.2, 12), m.patch2, { y: 0.38, rz: 0.3 }));
    }
    heads.push({ pivot, jaw, eyes, phase, base: pivot.rotation.clone() });
    return pivot;
  };
  // tête centrale (lapin), tête d'épaule gauche (ours), droite (oiseau), sur le torse (chat), à l'envers dans le dos (clown)
  makeHead(J.neck, 'lapin', { y: 0.0, s: 1.55, phase: 0 });
  makeHead(J.chest, 'ours', { x: 0.4, y: 0.45, z: 0.05, rz: -0.55, s: 1.25, phase: 1.3 });
  makeHead(J.chest, 'oiseau', { x: -0.42, y: 0.42, z: 0.08, rz: 0.6, ry: -0.2, s: 1.2, phase: 2.1 });
  makeHead(J.spine, 'chat', { x: 0.12, y: 0.32, z: 0.42, rx: Math.PI / 2 - 0.2, s: 1.05, phase: 3.4 });
  makeHead(J.spine, 'clown', { x: -0.1, y: 0.25, z: -0.4, rx: -Math.PI / 2 - 0.5, ry: Math.PI, s: 0.85, phase: 4.2 });
  // câbles reliant les têtes
  for (const pts of [[[0.3, 0.45, 0.1], [0.15, 0.6, 0.2], [0, 0.55, 0.1]], [[-0.3, 0.45, 0.1], [-0.15, 0.62, 0.2], [0, 0.55, 0.1]]]) J.chest.add(mesh(tube(pts, 0.012, 16, 5), m.dark));

  // Troisième bras dépareillé sortant du flanc
  const extra = joint('extraArm', J.chest, -0.35, 0.05, 0.25);
  extra.rotation.set(-0.6, 0, 0.9);
  extra.add(mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.42, 8), m.metal, { y: -0.21 }));
  const extraEl = joint('extraElbow', extra, 0, -0.42, 0);
  extraEl.rotation.x = -0.8;
  extraEl.add(mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.36, 8), m.metal, { y: -0.18 }));
  const extraHand = new THREE.Group();
  extraHand.position.y = -0.36;
  extraEl.add(extraHand);
  const phal = mechHand(extraHand, { palm: 0.06, fingerLen: 0.12, r: 0.008, mat: m.heads.clown, metal: m.metal, side: -1 });
  // grosses mains de peluche
  for (const s of ['L', 'R']) {
    const h = J['hand' + s];
    h.add(mesh(new THREE.SphereGeometry(0.1, 14, 10), m.heads.ours, { y: -0.08, s: [1, 1.2, 0.7] }));
    for (let f = 0; f < 4; f++) h.add(mesh(new THREE.ConeGeometry(0.012, 0.05, 6), m.teeth, { x: (f - 1.5) * 0.04, y: -0.2, z: 0.03, rx: Math.PI }));
  }

  contactShadow(root, 0.7);

  const clips = humanoidClips({ stride: 0.35, sway: 0.15, heavy: 0.5, armSwing: 0.3 });
  clips.idle = ((base) => (t, R, T) => { base(t, R, T); R.set('sing', 0.3); R.r('chest', 0.15, 0, 0.08); })(clips.idle);
  clips.walk = ((base) => (t, R, T) => { base(t, R, T); R.set('sing', 0.6); })(clips.walk);
  clips.sing = (t, R) => {
    R.r('chest', 0.1 + Math.sin(t * 2) * 0.05, 0, 0);
    R.r('shoulderL', -0.8, 0, 0.5); R.r('shoulderR', -0.8, 0, -0.5);
    R.r('elbowL', -0.9 + Math.sin(t * 3) * 0.2, 0, 0); R.r('elbowR', -0.9 - Math.sin(t * 3) * 0.2, 0, 0);
    R.set('sing', 1.4); R.set('eyes', 1.8);
  };
  clips.peek = ((base) => (t, R, T) => { base(t, R, T); R.set('sing', 0.8); })(clips.peek);
  clips.jumpscare = ((base) => (t, R, T) => { base(t, R, T); R.set('sing', 3); })(clips.jumpscare);

  const rig = new Rig(root, clips, (p, T) => {
    const sing = p.sing ?? 0.3;
    for (const h of heads) {
      // chaque tête « chante » à son propre rythme, désynchronisée des autres
      const open = Math.max(0, Math.sin(T * (3 + h.phase * 0.4) + h.phase)) * 0.35 * sing + (p.jaw ?? 0) * 0.5;
      h.jaw.rotation.x = Math.min(1, open);
      h.pivot.rotation.z = h.base.z + Math.sin(T * 0.9 + h.phase) * 0.06 * sing + twitch(T + h.phase, 1, 2);
      h.pivot.rotation.x = h.base.x + Math.sin(T * 1.3 + h.phase * 2) * 0.04 * sing;
      for (const e of h.eyes) e.irisMat.emissiveIntensity = 0.5 + (p.eyes ?? 1) * (0.7 + 0.3 * Math.sin(T * 5 + h.phase));
    }
    curlFingers(phal, 0.3 + Math.sin(T * 2) * 0.3);
  });
  return { root, rig, height: 2.2, name: 'choeur', eyeColor: '#ff3a8a' };
}
