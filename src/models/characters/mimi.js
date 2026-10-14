import * as THREE from 'three';
import { wornPaint, dustyFabric, yellowedPlastic, mat, lathe, dent, mesh, tube, joint, paintedFace } from '../kit.js';
import { Rig, humanoidClips, twitch } from '../rig.js';
import { skeleton, dressLimbs, mechEye, contactShadow } from './common.js';

/**
 * MIMI LA MARIONNETTE — petite (1,15 m), tête de porcelaine trop grosse,
 * cou extensible en anneaux, genoux inversés, fils coupés, mâchoire de ventriloque.
 */
export function buildMimi() {
  const root = new THREE.Group();
  root.name = 'Mimi';
  const m = {
    wood: mat(wornPaint({ base: '#b98a5a', under: '#6a4a2a', rust: 0, grime: 0.7, chips: 0.3, scratches: 80, seed: 31 }), { rough: 0.75, bump: 0.02 }),
    porcelain: mat(yellowedPlastic({ base: '#f4ece0', cracks: 18, seed: 32, blush: 'rgba(230,90,120,0.45)' }), { rough: 0.3, bump: 0.012 }),
    dress: mat(dustyFabric({ base: '#c26a86', seam: '#f0e0c0', plaid: '#5aa0a0', stains: 0.9, seed: 33 }), { rough: 0.95, bump: 0.02, side: THREE.DoubleSide }),
    apron: mat(dustyFabric({ base: '#e6dcc4', seam: '#c26a86', stains: 1, seed: 34 }), { rough: 0.95, side: THREE.DoubleSide }),
    metal: mat(wornPaint({ base: '#6a6460', under: '#2a2420', rust: 1, chips: 0.8, seed: 35 }), { metal: 0.7, rough: 0.5 }),
    yarn: mat(dustyFabric({ base: '#4a7e86', seam: '#2a4a50', stains: 0.4, seed: 36 }), { rough: 1 }),
    string: new THREE.MeshStandardMaterial({ color: '#d8ccb0', roughness: 1 }),
    dark: new THREE.MeshStandardMaterial({ color: '#120608', roughness: 0.9 }),
    shoe: mat(wornPaint({ base: '#7a1828', under: '#3a1010', rust: 0, seed: 37 }), { rough: 0.3 }),
  };
  const o = { hipY: 0.5, spine: 0.08, chest: 0.16, neckY: 0.17, neckLen: 0.06, shoulderX: 0.15, upper: 0.2, fore: 0.2, thigh: 0.24, shin: 0.25, hipX: 0.07, armR: 0.03, legR: 0.035 };
  const J = skeleton(root, o);
  dressLimbs(J, o, { arm: m.wood, leg: m.wood, metal: m.metal });
  // Genoux inversés : pose de repos pliée vers l'avant, articulation visible
  J.kneeL.rotation.x = -0.35; J.kneeR.rotation.x = -0.35;
  J.thighL.rotation.x = 0.25; J.thighR.rotation.x = 0.25;
  J.footL.rotation.x = 0.1; J.footR.rotation.x = 0.1;

  // Corps : robe en cloche + tablier
  J.hips.add(mesh(dent(lathe([[0, 0.25], [0.11, 0.24], [0.13, 0.12], [0.2, -0.05], [0.27, -0.2], [0.28, -0.22], [0.26, -0.21]], 28), 0.03, 2), m.dress));
  J.hips.add(mesh(lathe([[0.17, 0.05], [0.22, -0.08], [0.26, -0.2]], 14, -Math.PI * 0.2, Math.PI * 0.4), m.apron, { s: 1.03 }));
  J.spine.add(mesh(dent(lathe([[0, -0.05], [0.12, -0.03], [0.13, 0.1], [0.13, 0.28], [0.08, 0.36], [0, 0.37]], 22), 0.02, 3), m.dress));
  // col claudine
  J.chest.add(mesh(new THREE.TorusGeometry(0.075, 0.025, 6, 18), m.apron, { y: 0.16, rx: Math.PI / 2, s: [1, 1, 0.6] }));
  // nœud dans le dos (clé de remontage)
  J.chest.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6), m.metal, { y: 0.06, z: -0.16, rx: Math.PI / 2 }));
  for (const sx of [-1, 1]) J.chest.add(mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 14), m.metal, { x: sx * 0.035, y: 0.06, z: -0.22, ry: Math.PI / 2 }));
  // Mains en bois, doigts raides
  for (const s of ['L', 'R']) {
    const h = J['hand' + s];
    h.add(mesh(new THREE.SphereGeometry(0.035, 10, 8), m.wood, { y: -0.03, s: [1, 1.3, 0.6] }));
    for (let f = 0; f < 4; f++) h.add(mesh(new THREE.CylinderGeometry(0.006, 0.005, 0.07, 5), m.wood, { x: (f - 1.5) * 0.013, y: -0.09, z: 0.005 }));
    // fil coupé qui pend du poignet
    h.add(mesh(tube([[0, 0, 0], [0.02, 0.25, 0.01], [0.05, 0.45, -0.02]], 0.0025, 12, 4), m.string));
  }
  for (const s of ['L', 'R']) {
    J['foot' + s].add(mesh(new THREE.SphereGeometry(0.05, 12, 8), m.shoe, { y: -0.02, z: 0.03, s: [0.9, 0.6, 1.4] }));
  }

  // ---- COU EXTENSIBLE (anneaux télescopiques) ----
  const neckRings = [];
  for (let i = 0; i < 6; i++) {
    const r = mesh(new THREE.CylinderGeometry(0.04 - i * 0.002, 0.042 - i * 0.002, 0.04, 12), i % 2 ? m.metal : m.wood, { y: i * 0.02 });
    J.neck.add(r);
    neckRings.push(r);
  }
  // ---- TÊTE DE PORCELAINE ----
  const H = J.head;
  const faceTex = paintedFace((ctx, S) => {
    ctx.fillStyle = '#f4ece0'; ctx.fillRect(0, 0, S, S);
    // taches de rousseur, sourcils fins, larme peinte qui coule
    ctx.fillStyle = 'rgba(150,80,60,0.6)';
    for (let i = 0; i < 18; i++) ctx.fillRect(128 + Math.cos(i * 2.1) * 55, 285 + Math.sin(i * 1.3) * 12, 3, 3);
    ctx.strokeStyle = '#3a2020'; ctx.lineWidth = 3;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(128 + sx * 15, 210); ctx.quadraticCurveTo(128 + sx * 40, 195, 128 + sx * 58, 215); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(20,20,40,0.8)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(100, 262); ctx.bezierCurveTo(96, 300, 104, 330, 98, 360); ctx.stroke();
    // lignes de ventriloque (mâchoire)
    ctx.strokeStyle = '#2a1414'; ctx.lineWidth = 3;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(128 + sx * 30, 300); ctx.lineTo(128 + sx * 28, 345); ctx.stroke(); }
    ctx.fillStyle = '#9a1830';
    ctx.beginPath(); ctx.ellipse(128, 302, 24, 5, 0, 0, Math.PI * 2); ctx.fill();
  }, 'mimi');
  const faceMat = m.porcelain.clone();
  faceMat.map = faceTex;
  H.add(mesh(dent(new THREE.SphereGeometry(0.17, 32, 24), 0.025, 9), faceMat, { y: 0.14, s: [1.08, 1, 1] }));
  // éclat manquant dans la porcelaine (trou noir)
  H.add(mesh(new THREE.SphereGeometry(0.04, 10, 8), m.dark, { x: 0.11, y: 0.22, z: 0.1, s: [1, 0.7, 0.4] }));
  const eyes = [];
  for (const sx of [-1, 1]) {
    const e = mechEye(H, { r: 0.045, x: sx * 0.065, y: 0.165, z: 0.125, irisColor: '#4fe0ff', white: '#f6f0e6', lidMat: m.porcelain });
    e.g.scale.set(1, 1.1, 0.8);
    eyes.push(e);
  }
  // Mâchoire de ventriloque qui coulisse vers le bas
  const chin = new THREE.Group();
  chin.position.set(0, 0.06, 0.1);
  H.add(chin);
  chin.add(mesh(new THREE.SphereGeometry(0.06, 14, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.4), faceMat, { y: 0.02, z: 0.01, s: [1, 0.9, 0.9] }));
  const cavity = mesh(new THREE.BoxGeometry(0.06, 0.05, 0.05), m.dark, { y: 0.045, z: 0.02 });
  H.add(cavity);
  cavity.position.copy(chin.position).add(new THREE.Vector3(0, 0.0, 0.02));
  // Couettes de laine et nœuds
  for (const sx of [-1, 1]) {
    const pts = [[sx * 0.16, 0.2, -0.02], [sx * 0.24, 0.12, -0.04], [sx * 0.26, 0.0, -0.02], [sx * 0.23, -0.12, 0.0]];
    for (let k = 0; k < 5; k++) H.add(mesh(tube(pts.map(([x, y, z]) => [x + k * 0.006 * sx, y, z + (k - 2) * 0.01]), 0.012, 20, 5), m.yarn));
    H.add(mesh(new THREE.TorusGeometry(0.03, 0.012, 6, 12), m.dress, { x: sx * 0.17, y: 0.21, z: -0.02, ry: Math.PI / 2 }));
  }
  // chevelure de laine (calotte) avec mèches
  H.add(mesh(dent(new THREE.SphereGeometry(0.182, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), 0.04, 4), m.yarn, { y: 0.15, z: -0.015, rx: -0.25, s: [1.1, 1, 1.05] }));
  for (let k = 0; k < 7; k++) H.add(mesh(tube([[(k - 3) * 0.035, 0.29, 0.06], [(k - 3) * 0.04, 0.27, 0.12], [(k - 3) * 0.045 + 0.01, 0.235, 0.15]], 0.011, 8, 5), m.yarn));
  // Croix de manipulation (contrôleur de marionnette) cassée, accrochée dans le dos
  const ctrl = new THREE.Group();
  ctrl.position.set(0.05, 0.35, -0.1);
  ctrl.rotation.z = 0.4;
  J.chest.add(ctrl);
  ctrl.add(mesh(new THREE.BoxGeometry(0.28, 0.025, 0.025), m.wood));
  ctrl.add(mesh(new THREE.BoxGeometry(0.025, 0.025, 0.2), m.wood));
  for (const x of [-0.13, 0.13]) ctrl.add(mesh(tube([[x, 0, 0], [x * 1.2, -0.15, 0.05], [x * 1.4, -0.25, 0.02]], 0.002, 8, 3), m.string));

  contactShadow(root, 0.35);

  const clips = humanoidClips({ knee: -1, stride: 0.55, armSwing: 0.6, sway: 0.12 });
  clips.idle = ((base) => (t, R, T) => {
    base(t, R, T);
    // tête qui penche de façon saccadée, comme tirée par un fil invisible
    const jerk = Math.floor(t * 0.7) % 3;
    R.r('head', 0, 0, [-0.25, 0.05, 0.3][jerk] * 0.8 + twitch(t, 1.2, 3));
    R.r('shoulderL', 0, 0, 0.3); R.r('shoulderR', 0, 0, -0.3);
    R.set('neck', 0.1 + Math.max(0, Math.sin(t * 0.5)) * 0.15);
  })(clips.idle);
  clips.crawl = (t, R) => {
    // Rampe à quatre pattes, tête tournée vers le haut (conduits)
    const w = t * 4, s = Math.sin(w);
    R.p('hips', 0, -0.28, 0);
    R.r('hips', 1.25, 0, s * 0.1);
    R.r('chest', 0.1, 0, 0);
    R.r('neck', -1.2, 0, 0); R.r('head', -0.3 + twitch(t, 2, 4), 0, 0.5);
    R.r('shoulderL', -1.6 + s * 0.5, 0, 0.1); R.r('shoulderR', -1.6 - s * 0.5, 0, -0.1);
    R.r('thighL', -0.6 - s * 0.4, 0, 0); R.r('thighR', -0.6 + s * 0.4, 0, 0);
    R.r('kneeL', -0.9, 0, 0); R.r('kneeR', -0.9, 0, 0);
    R.set('neck', 0.4);
  };
  clips.peek = (t, R) => {
    // Sort la tête du conduit sur un cou étiré, et la fait pivoter lentement
    R.p('hips', 0, -0.3, 0);
    R.r('hips', 1.3, 0, 0);
    R.r('neck', -1.25, 0, 0);
    R.r('head', -0.2, 0, Math.sin(t * 0.6) * 0.9 + twitch(t, 1.5, 4));
    R.r('shoulderL', -2.4, 0, 0.3); R.r('shoulderR', -2.4, 0, -0.3);
    R.set('neck', 1);
    R.set('jaw', 0.3 + Math.max(0, Math.sin(t * 2)) * 0.3);
    R.set('eyes', 2.5);
  };
  clips.ventpeek = (t, R) => {
    // Allongée dans le conduit, le cou déplié vers l'avant, la tête tournée vers le joueur
    R.p('hips', 0, -0.32, 0);
    R.r('hips', 1.45, 0, 0);
    R.r('chest', 0.05, 0, 0);
    R.r('neck', 0.05, 0, 0);
    R.r('head', -1.45, Math.sin(t * 0.5) * 0.25, Math.sin(t * 0.7) * 0.5 + twitch(t, 1.5, 4));
    R.r('shoulderL', -2.6, 0, 0.2); R.r('shoulderR', -2.6, 0, -0.2);
    R.set('neck', 0.55 + Math.sin(t * 0.9) * 0.08);
    R.set('jaw', 0.2 + Math.max(0, Math.sin(t * 2)) * 0.3);
    R.set('eyes', 2.5);
  };
  clips.jumpscare = ((base) => (t, R, T) => { base(t, R, T); R.set('neck', Math.min(0.5, t * 4)); R.set('jaw', 1.2); R.r('head', -0.55, 0, 0); })(clips.jumpscare);

  const rig = new Rig(root, clips, (p) => {
    const ext = p.neck ?? 0;
    const gap = 0.02 + ext * 0.06;
    neckRings.forEach((r, i) => { r.position.y = i * gap; r.scale.y = Math.max(1, gap / 0.03); });
    J.head.position.y = 0.06 + ext * 0.36;
    chin.position.y = 0.06 - (p.jaw ?? 0) * 0.06;
    const glow = p.eyes ?? 1;
    for (const e of eyes) {
      e.irisMat.emissiveIntensity = 0.5 + glow;
      if (e.lid) e.lid.rotation.x = -0.6 - Math.min(1.2, glow) * 0.5;
    }
  });
  return { root, rig, height: 1.2, name: 'mimi', eyeColor: '#4fe0ff' };
}
