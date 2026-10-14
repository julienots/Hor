import * as THREE from 'three';
import { wornPaint, dustyFabric, yellowedPlastic, mat, lathe, dent, mesh, tube, joint, ribbonGeo, paintedFace } from '../kit.js';
import { Rig, humanoidClips, twitch } from '../rig.js';
import { skeleton, dressLimbs, mechHand, curlFingers, mechEye, contactShadow } from './common.js';

/**
 * MADAME RUBAN — silhouette très fine (2,5 m), masque de porcelaine allongé,
 * taille en bobine, jupe et bras entourés de rubans motorisés qui ondulent.
 */
export function buildRuban() {
  const root = new THREE.Group();
  root.name = 'Ruban';
  const ribbonColors = ['#3aa6a0', '#d0607a', '#e8d6b0', '#6a4a9a'];
  const m = {
    porcelain: mat(yellowedPlastic({ base: '#f0ebe4', cracks: 12, seed: 51 }), { rough: 0.25, bump: 0.01 }),
    body: mat(wornPaint({ base: '#2e6e72', under: '#d8cdb0', rust: 0.3, chips: 0.5, seed: 52 }), { metal: 0.4, rough: 0.45 }),
    metal: mat(wornPaint({ base: '#8a8078', under: '#3a3028', rust: 0.8, chips: 0.6, seed: 53 }), { metal: 0.85, rough: 0.4 }),
    spool: mat(wornPaint({ base: '#b8945a', under: '#5a4020', rust: 0.2, grime: 0.6, scratches: 90, seed: 54 }), { rough: 0.6 }),
    ribbons: ribbonColors.map((c, i) => mat(dustyFabric({ base: c, seam: '#f4ead0', stains: 0.6, seed: 55 + i }), { rough: 0.6, side: THREE.DoubleSide })),
    dark: new THREE.MeshStandardMaterial({ color: '#0a0608', roughness: 0.9 }),
    lips: new THREE.MeshStandardMaterial({ color: '#7a0a22', roughness: 0.3 }),
  };
  const o = { hipY: 1.25, spine: 0.15, chest: 0.32, neckY: 0.3, neckLen: 0.22, shoulderX: 0.2, upper: 0.46, fore: 0.46, thigh: 0.6, shin: 0.62, hipX: 0.08, armR: 0.032, legR: 0.04 };
  const J = skeleton(root, o);
  dressLimbs(J, o, { arm: m.body, leg: m.porcelain, metal: m.metal });
  // pieds en pointe (danseuse)
  for (const s of ['L', 'R']) {
    J['foot' + s].add(mesh(new THREE.ConeGeometry(0.035, 0.16, 10), m.ribbons[1], { y: -0.07, z: 0.02, rx: Math.PI - 0.25 }));
  }
  // Taille en bobine de fil
  J.hips.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.18, 20), m.spool, { y: 0.05 }));
  for (const y of [-0.05, 0.15]) J.hips.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 28), m.spool, { y }));
  // fil enroulé
  for (let i = 0; i < 5; i++) J.hips.add(mesh(new THREE.TorusGeometry(0.105 + (i % 2) * 0.004, 0.012, 6, 24), m.ribbons[i % 4], { y: i * 0.032 - 0.02, rx: Math.PI / 2 }));
  // Buste en corset fin
  J.spine.add(mesh(dent(lathe([[0, 0], [0.09, 0.02], [0.1, 0.15], [0.15, 0.32], [0.17, 0.45], [0.12, 0.52], [0, 0.53]], 26), 0.015, 4), m.body));
  for (let i = 0; i < 6; i++) J.spine.add(mesh(new THREE.TorusGeometry(0.1 + i * 0.012, 0.004, 4, 20), m.metal, { y: 0.06 + i * 0.06, rx: Math.PI / 2 }));
  // Cou très long en vertèbres de porcelaine
  for (let i = 0; i < 6; i++) J.neck.add(mesh(new THREE.SphereGeometry(0.035, 10, 8), i % 2 ? m.metal : m.porcelain, { y: i * 0.04, s: [1, 0.7, 1] }));

  // ---- RUBANS (géométries déformées chaque image) ----
  const ribbons = [];
  const addRibbon = (parent, { x = 0, y = 0, z = 0, len = 1, width = 0.07, color = 0, phase = 0, swing = 1, ry = 0 }) => {
    const g = ribbonGeo(24, len, width);
    const r = mesh(g, m.ribbons[color % 4], { x, y, z, ry });
    parent.add(r);
    ribbons.push({ g, len, phase, swing });
    return r;
  };
  // jupe de rubans
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    addRibbon(J.hips, { x: Math.sin(a) * 0.19, y: -0.05, z: Math.cos(a) * 0.19, ry: a, len: 0.9 + (i % 3) * 0.15, width: 0.09, color: i, phase: i * 0.7 });
  }
  // rubans des bras et des cheveux
  for (const s of ['L', 'R']) {
    for (let i = 0; i < 3; i++) addRibbon(J['elbow' + s], { y: -0.1 - i * 0.1, z: 0.02, len: 0.5 + i * 0.1, width: 0.05, color: i + 1, phase: i * 1.3, swing: 1.4 });
    // spirale autour du bras
    const pts = [];
    for (let k = 0; k <= 30; k++) { const a = k * 0.8; pts.push([Math.cos(a) * 0.045, -k * 0.015, Math.sin(a) * 0.045]); }
    J['shoulder' + s].add(mesh(tube(pts, 0.008, 60, 4), m.ribbons[0]));
  }
  const phal = [];
  for (const [s, side] of [['L', 1], ['R', -1]]) phal.push(...mechHand(J['hand' + s], { palm: 0.06, fingerLen: 0.2, r: 0.007, mat: m.porcelain, metal: m.metal, side }));

  // ---- TÊTE : masque ovale allongé ----
  const H = J.head;
  const faceTex = paintedFace((ctx, S) => {
    ctx.fillStyle = '#f0ebe4'; ctx.fillRect(0, 0, S, S);
    // larmes noires peintes et losanges d'arlequin
    ctx.fillStyle = 'rgba(20,10,30,0.85)';
    ctx.beginPath(); ctx.moveTo(150, 250); ctx.lineTo(156, 300); ctx.lineTo(146, 300); ctx.fill();
    ctx.fillStyle = 'rgba(58,166,160,0.7)';
    ctx.beginPath(); ctx.moveTo(128, 150); ctx.lineTo(140, 170); ctx.lineTo(128, 190); ctx.lineTo(116, 170); ctx.fill();
    ctx.strokeStyle = 'rgba(80,20,40,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(128, 215, 40, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  }, 'ruban');
  const faceMat = m.porcelain.clone();
  faceMat.map = faceTex;
  H.add(mesh(dent(new THREE.SphereGeometry(0.13, 30, 22), 0.02, 13), faceMat, { y: 0.16, s: [0.9, 1.45, 0.95] }));
  // chignon de rubans
  H.add(mesh(new THREE.TorusKnotGeometry(0.07, 0.022, 48, 6, 2, 3), m.ribbons[1], { y: 0.36, z: -0.05 }));
  for (let i = 0; i < 4; i++) addRibbon(H, { y: 0.34, z: -0.08, len: 0.6 + i * 0.12, width: 0.05, color: i, phase: i * 0.9, ry: Math.PI + (i - 1.5) * 0.3, swing: 1.2 });
  // un seul grand œil (l'autre est bandé)
  const eyes = [mechEye(H, { r: 0.04, x: 0.045, y: 0.2, z: 0.1, irisColor: '#7affd0', white: '#f8f4ee', lidMat: m.porcelain })];
  eyes[0].g.scale.set(1, 1.3, 0.8);
  // bandeau de ruban sur l'œil droit
  H.add(mesh(new THREE.TorusGeometry(0.128, 0.03, 4, 32), m.ribbons[3], { y: 0.2, rx: Math.PI / 2 + 0.3, rz: 0.4, s: [0.95, 1.05, 0.5] }));
  // bouche fine en cœur qui s'étire
  const mouth = new THREE.Group();
  mouth.position.set(0, 0.06, 0.11);
  H.add(mouth);
  const lip = mesh(new THREE.SphereGeometry(0.025, 14, 8), m.lips, { s: [1.4, 0.45, 0.5] });
  mouth.add(lip);
  const gape = mesh(new THREE.SphereGeometry(0.022, 12, 8), m.dark, { z: 0.003, s: [1.2, 0.1, 0.5] });
  mouth.add(gape);

  contactShadow(root, 0.35);

  const clips = humanoidClips({ stride: 0.35, armSwing: 0.5, sway: 0.04 });
  clips.idle = ((base) => (t, R, T) => {
    base(t, R, T);
    // pose de danseuse figée : un bras en arc au-dessus de la tête
    R.r('shoulderL', -2.6, 0, 0.3); R.r('elbowL', -0.5, 0, 0);
    R.r('shoulderR', 0.2, 0, -0.5); R.r('elbowR', -0.4, 0, 0);
    R.r('head', 0, 0, 0.25 + twitch(t, 0.8, 3));
    R.set('ribbons', 0.4);
  })(clips.idle);
  clips.walk = (t, R) => {
    // Glisse sur les pointes, presque sans bouger le buste
    const s = Math.sin(t * 2.4);
    R.r('thighL', s * 0.2, 0, 0); R.r('thighR', -s * 0.2, 0, 0);
    R.r('shoulderL', -0.4, 0, 0.6); R.r('shoulderR', -0.4, 0, -0.6);
    R.r('elbowL', -1, 0, 0); R.r('elbowR', -1, 0, 0);
    R.r('head', 0, Math.sin(t * 0.7) * 0.3, 0.2);
    R.p('hips', 0, 0.03 + Math.abs(s) * 0.02, 0);
    R.set('ribbons', 1.2);
  };
  clips.peek = (t, R) => {
    // Glisse un bras et des rubans par l'encadrement, tête inclinée à 90°
    R.r('spine', 0.1, 0, -0.25); R.r('chest', 0.1, 0, -0.2);
    R.r('neck', 0, 0, -0.4); R.r('head', 0.1 + twitch(t, 1.5, 4), 0, -0.9);
    R.r('shoulderR', -1.4, 0, -0.3); R.r('elbowR', -0.3, 0, 0);
    R.r('shoulderL', -0.3, 0, 0.5);
    R.set('ribbons', 1.6); R.set('eyes', 2.2); R.set('fingers', 0.3);
  };
  clips.jumpscare = ((base) => (t, R, T) => { base(t, R, T); R.set('ribbons', 4); })(clips.jumpscare);

  const rig = new Rig(root, clips, (p, T) => {
    const amp = p.ribbons ?? 0.5;
    for (const r of ribbons) {
      const pos = r.g.attributes.position;
      const rest = r.g.userData.rest;
      for (let i = 0; i < pos.count; i++) {
        const y = rest[i * 3 + 1];
        const k = -y / r.len; // 0 en haut, 1 en bas
        const w = Math.sin(T * 2.2 * r.swing + r.phase + k * 5) * 0.12 * k * amp;
        pos.setXYZ(i, rest[i * 3] + Math.cos(T + r.phase + k * 3) * 0.04 * k * amp, y, rest[i * 3 + 2] + w + k * k * 0.15);
      }
      pos.needsUpdate = true;
      r.g.computeVertexNormals();
    }
    const jaw = p.jaw ?? 0;
    mouth.scale.set(1 + jaw * 0.6, 1 + jaw * 6, 1);
    curlFingers(phal, p.fingers ?? 0.1);
    for (const e of eyes) e.irisMat.emissiveIntensity = 0.6 + (p.eyes ?? 1);
  });
  return { root, rig, height: 2.55, name: 'ruban', eyeColor: '#7affd0' };
}
