import * as THREE from 'three';
import { wornPaint, dustyFabric, yellowedPlastic, mat, lathe, dent, mesh, tube, rivets, joint, roundedBox, paintedFace } from '../kit.js';
import { Rig, humanoidClips, twitch } from '../rig.js';
import { skeleton, dressLimbs, mechHand, curlFingers, mechEye, teethRow, contactShadow } from './common.js';

/**
 * LE MAÎTRE DE CÉRÉMONIE — grand présentateur (2,3 m), haut-de-forme cabossé,
 * visage à plaques articulées, sourire démesuré, doigts télescopiques, micro sur canne.
 */
export function buildMC() {
  const root = new THREE.Group();
  root.name = 'MC';
  const m = {
    coat: mat(dustyFabric({ base: '#7a1a22', seam: '#d8b04a', stains: 0.8, seed: 11 }), { rough: 0.9, bump: 0.02 }),
    vest: mat(dustyFabric({ base: '#c9a043', seam: '#5a1010', plaid: '#7a5a20', seed: 12 }), { rough: 0.8 }),
    trouser: mat(wornPaint({ base: '#1d1a22', under: '#55505a', stripes: { color: '#3a3044', width: 24 }, rust: 0.1, seed: 13 }), { rough: 0.8 }),
    metal: mat(wornPaint({ base: '#5b5a5e', under: '#2c2a28', rust: 0.9, chips: 0.7, seed: 14 }), { metal: 0.75, rough: 0.55, bump: 0.02 }),
    gold: mat(wornPaint({ base: '#c79a3c', under: '#6b4a20', rust: 0.3, chips: 0.6, seed: 15 }), { metal: 0.8, rough: 0.35 }),
    face: mat(yellowedPlastic({ base: '#f2e7d0', cracks: 14, seed: 16, blush: 'rgba(200,60,70,0.35)' }), { rough: 0.45, bump: 0.01 }),
    plate: mat(wornPaint({ base: '#e8dcc0', under: '#7d6e55', rust: 0.35, chips: 0.35, seed: 17 }), { rough: 0.5, metal: 0.2, side: THREE.DoubleSide }),
    shirt: mat(yellowedPlastic({ base: '#efe6d2', cracks: 3, seed: 18 }), { rough: 0.7 }),
    hat: mat(dustyFabric({ base: '#1c1820', seam: '#c9a043', stains: 1, seed: 19 }), { rough: 0.9 }),
    teeth: new THREE.MeshStandardMaterial({ color: '#e8dcb8', roughness: 0.35 }),
    mouth: new THREE.MeshStandardMaterial({ color: '#1a0506', roughness: 0.9 }),
    shoe: mat(wornPaint({ base: '#2a1610', under: '#5a4030', rust: 0, seed: 20 }), { rough: 0.35, metal: 0.1 }),
  };
  const o = { hipY: 1.05, spine: 0.2, chest: 0.32, neckY: 0.34, neckLen: 0.13, shoulderX: 0.28, upper: 0.36, fore: 0.36, thigh: 0.5, shin: 0.5, hipX: 0.11, armR: 0.068, legR: 0.065 };
  const J = skeleton(root, o);
  dressLimbs(J, o, { arm: m.coat, fore: m.coat, leg: m.trouser, metal: m.metal });

  // Bassin + taille
  J.hips.add(mesh(dent(lathe([[0, -0.1], [0.17, -0.08], [0.2, 0.05], [0.17, 0.2], [0, 0.22]]), 0.02, 3), m.trouser));
  // Torse : redingote évasée (gilet doré devant)
  const torso = dent(lathe([[0, -0.05], [0.2, -0.02], [0.24, 0.15], [0.29, 0.38], [0.31, 0.5], [0.24, 0.6], [0.1, 0.66], [0, 0.66]], 32), 0.025, 4);
  J.spine.add(mesh(torso, m.coat, { y: -0.05 }));
  const vest = lathe([[0, 0], [0.2, 0.02], [0.245, 0.2], [0.27, 0.42], [0.18, 0.52], [0, 0.55]], 24, -Math.PI * 0.28, Math.PI * 0.56);
  J.spine.add(mesh(vest, m.vest, { y: -0.02, z: 0.015, s: [1, 1, 1.05] }));
  // plastron de chemise et nœud papillon
  J.chest.add(mesh(new THREE.SphereGeometry(0.13, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), m.shirt, { y: 0.2, z: 0.17, rx: 1.3, s: [1, 1.4, 0.4] }));
  for (const sx of [-1, 1]) J.chest.add(mesh(new THREE.ConeGeometry(0.07, 0.13, 4), m.gold, { x: sx * 0.065, y: 0.31, z: 0.23, rz: sx * Math.PI / 2 }));
  J.chest.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), m.gold, { y: 0.31, z: 0.24 }));
  // boutons dorés
  for (let i = 0; i < 4; i++) J.spine.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 12), m.gold, { y: 0.06 + i * 0.1, z: 0.25 + i * 0.012, rx: Math.PI / 2 }));
  // basques de la queue-de-pie
  for (const sx of [-1, 1]) {
    const tail = lathe([[0.02, 0], [0.15, -0.05], [0.16, -0.35], [0.12, -0.62], [0.02, -0.66]], 10, Math.PI * (sx > 0 ? 0.72 : 0.98), 0.3 * Math.PI);
    J.hips.add(mesh(tail, m.coat, { y: 0.15, z: -0.05, s: [1.4, 1, 1.4] }));
  }
  // épaulettes dorées à franges
  for (const s of ['L', 'R']) {
    const ep = J['shoulder' + s];
    ep.add(mesh(new THREE.SphereGeometry(0.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.gold, { y: 0.03, s: [1.2, 0.5, 1] }));
    for (let i = 0; i < 9; i++) ep.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.08, 4), m.gold, { x: Math.cos(i / 9 * Math.PI * 2) * 0.1, y: -0.03, z: Math.sin(i / 9 * Math.PI * 2) * 0.1 }));
  }
  // Mains : doigts trop longs
  const phal = [];
  for (const [s, side] of [['L', 1], ['R', -1]]) {
    const wrist = J['hand' + s];
    wrist.add(mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.05, 12), m.shirt, { y: 0.02 })); // manchette
    phal.push(...mechHand(wrist, { palm: 0.09, fingerLen: 0.22, r: 0.011, mat: m.plate, metal: m.metal, side }));
  }
  // Canne-micro tenue dans la main droite
  const cane = new THREE.Group();
  cane.position.set(0, -0.12, 0.03);
  cane.rotation.x = 0.15;
  J.handR.add(cane);
  cane.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.2, 8), m.metal, { y: -0.35 }));
  cane.add(mesh(new THREE.SphereGeometry(0.06, 14, 10), m.metal, { y: 0.28 }));
  cane.add(mesh(new THREE.TorusGeometry(0.062, 0.01, 6, 18), m.gold, { y: 0.28, rx: Math.PI / 2 }));
  // Jambes : chaussures pointues vernies
  for (const s of ['L', 'R']) {
    const f = J['foot' + s];
    f.add(mesh(dent(roundedBox(0.13, 0.08, 0.32, 0.04), 0.01, 5), m.shoe, { y: -0.03, z: 0.08 }));
    f.add(mesh(new THREE.ConeGeometry(0.05, 0.12, 10), m.shoe, { y: -0.04, z: 0.28, rx: Math.PI / 2 }));
  }
  // Cou : piston et câbles apparents
  J.neck.add(mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.22, 10), m.metal, { y: 0.05, s: [1, 0.7, 1] }));
  for (const sx of [-1, 1]) J.neck.add(mesh(tube([[sx * 0.05, -0.02, -0.02], [sx * 0.07, 0.08, 0.02], [sx * 0.04, 0.2, 0]], 0.009), m.mouth));
  J.neck.add(mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.05, 16), m.shirt, { y: -0.02 })); // col cassé

  // ---- TÊTE ----
  const H = J.head;
  const skull = dent(new THREE.SphereGeometry(0.2, 32, 24), 0.03, 7);
  const faceTex = paintedFace((ctx, S) => {
    ctx.fillStyle = '#f2e7d0'; ctx.fillRect(0, 0, S, S);
    // sourcils peints, fissures, larmes de peinture
    ctx.strokeStyle = '#2a1515'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(128 + sx * 18, 205); ctx.quadraticCurveTo(128 + sx * 40, 185, 128 + sx * 62, 208); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(120,20,30,0.7)'; ctx.lineWidth = 3;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(128 + sx * 42, 258); ctx.lineTo(128 + sx * 46, 300); ctx.stroke(); }
    // commissures du sourire prolongées jusqu'aux oreilles
    ctx.strokeStyle = '#3a0c10'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(40, 268); ctx.quadraticCurveTo(128, 330, 216, 268); ctx.stroke();
    ctx.fillStyle = 'rgba(190,40,60,0.4)';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(128 + sx * 70, 285, 22, 0, Math.PI * 2); ctx.fill(); }
  }, 'mc');
  const faceMat = m.face.clone();
  faceMat.map = faceTex;
  H.add(mesh(skull, faceMat, { y: 0.17, s: [1, 1.12, 1] }));
  // Plaques articulées autour du visage (bougent avec le paramètre « plates »)
  const plates = [];
  const plateGeo = new THREE.SphereGeometry(0.215, 10, 6, 0, 0.7, 0.3, 0.6);
  const platePos = [[-1.05, 0.05], [0.95, 0.05], [-0.85, -0.35], [0.75, -0.35], [-0.75, 0.45], [0.65, 0.45]];
  for (const [i, [a, b]] of platePos.entries()) {
    const pivot = new THREE.Group();
    pivot.position.y = 0.17;
    pivot.rotation.set(b - 0.05, Math.PI / 2 + a - 0.35, 0);
    H.add(pivot);
    const pl = mesh(plateGeo, m.plate, { s: [1, 1.12, 1] });
    pivot.add(pl);
    rivets(pivot, m.gold, [[Math.sin(0.35) * 0.218, 0.04, Math.cos(0.35) * 0.218]], 0.008);
    plates.push({ pivot, base: pivot.rotation.clone(), i });
  }
  // Yeux enfoncés
  const eyes = [];
  for (const sx of [-1, 1]) {
    H.add(mesh(new THREE.TorusGeometry(0.058, 0.014, 8, 20), m.metal, { x: sx * 0.08, y: 0.22, z: 0.172 }));
    const e = mechEye(H, { r: 0.05, x: sx * 0.08, y: 0.22, z: 0.15, irisColor: '#ffb020', lidMat: m.plate });
    e.g.rotation.y = sx * 0.12;
    eyes.push(e);
  }
  // Sourire démesuré : mâchoire articulée + dents
  const mouth = new THREE.Group();
  mouth.position.set(0, 0.095, 0.155);
  H.add(mouth);
  // cavité sombre très large, qui déborde jusqu'aux joues
  mouth.add(mesh(new THREE.SphereGeometry(0.16, 28, 14), m.mouth, { s: [1.05, 0.32, 0.38] }));
  // lèvre supérieure peinte (bourrelet)
  mouth.add(mesh(new THREE.TorusGeometry(0.162, 0.016, 8, 32, Math.PI), m.plate, { y: 0.004, s: [1.04, 0.33, 1.1], rz: 0 }));
  const upper = new THREE.Group();
  upper.position.set(0, 0.04, 0.062);
  mouth.add(upper);
  teethRow(upper, { n: 20, w: 0.3, h: 0.042, curve: 0.035, mat: m.teeth });
  const jaw = joint('jaw', mouth, 0, 0.01, -0.03);
  const lower = new THREE.Group();
  lower.position.set(0, -0.042, 0.088);
  jaw.add(lower);
  teethRow(lower, { n: 18, w: 0.27, h: 0.04, curve: 0.032, mat: m.teeth, flip: true });
  // menton articulé (plaque inférieure)
  jaw.add(mesh(new THREE.SphereGeometry(0.15, 24, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), faceMat, { y: -0.03, z: 0.02, s: [1.05, 0.55, 0.7] }));
  // Oreilles en pavillon de haut-parleur
  for (const sx of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(sx * 0.21, 0.19, 0);
    ear.rotation.z = -sx * Math.PI / 2;
    H.add(ear);
    ear.add(mesh(lathe([[0.02, 0], [0.035, 0.02], [0.07, 0.08], [0.075, 0.085]], 16), m.gold, { s: 1 }));
    ear.add(mesh(new THREE.CircleGeometry(0.068, 16), m.mouth, { y: 0.082, rx: -Math.PI / 2 }));
  }
  // Haut-de-forme cabossé, penché
  const hat = new THREE.Group();
  hat.position.set(0.03, 0.36, -0.01);
  hat.rotation.z = -0.18;
  H.add(hat);
  hat.add(mesh(dent(lathe([[0, 0], [0.32, 0], [0.33, 0.015], [0.17, 0.03], [0.16, 0.05], [0.17, 0.32], [0.18, 0.34], [0, 0.345]], 32), 0.04, 8), m.hat));
  hat.add(mesh(new THREE.CylinderGeometry(0.172, 0.168, 0.06, 32, 1, true), m.gold, { y: 0.08 }));
  hat.add(mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 12), m.gold, { x: 0.1, y: 0.09, z: 0.14 }));

  contactShadow(root, 0.55);

  const clips = humanoidClips({ stride: 0.5, armSwing: 0.25 });
  clips.idle = ((base) => (t, R, T) => {
    base(t, R, T);
    R.r('shoulderR', -0.5, 0, -0.1); R.r('elbowR', -0.7, 0, 0); // tient la canne
    R.set('plates', 0.2 + 0.2 * Math.max(0, Math.sin(t * 0.8)));
  })(clips.idle);
  clips.present = (t, R) => {
    // Présente le spectacle : bras gauche ouvert, révérence lente.
    const s = Math.sin(t * 1.2);
    R.r('shoulderL', -1.2 - s * 0.2, 0, 0.9); R.r('elbowL', -0.3, 0, 0);
    R.r('shoulderR', -0.5, 0, -0.1); R.r('elbowR', -0.7, 0, 0);
    R.r('spine', 0.1 + s * 0.08, 0, 0); R.r('head', -0.1 + twitch(t), 0, 0.15);
    R.set('jaw', 0.2 + Math.max(0, Math.sin(t * 6)) * 0.3);
    R.set('plates', 0.6);
  };
  clips.jumpscare = ((base) => (t, R, T) => { base(t, R, T); R.set('plates', 1.5 + Math.sin(t * 40)); })(clips.jumpscare);

  const rig = new Rig(root, clips, (p) => {
    jaw.rotation.x = (p.jaw ?? 0) * 0.7;
    curlFingers(phal, p.fingers ?? 0.2);
    const pv = p.plates ?? 0;
    for (const pl of plates) {
      pl.pivot.rotation.x = pl.base.x + Math.sin(pl.i * 1.7) * 0.06 * pv;
      pl.pivot.rotation.y = pl.base.y + Math.cos(pl.i * 2.3) * 0.08 * pv;
      pl.pivot.scale.setScalar(1 + 0.04 * pv);
    }
    const glow = p.eyes ?? 1;
    for (const e of eyes) {
      e.irisMat.emissiveIntensity = 0.6 + glow * 1.2;
      if (e.lid) e.lid.rotation.x = -0.5 - Math.min(1, glow) * 0.6;
    }
  });
  return { root, rig, height: 2.35, name: 'mc', eyeColor: '#ffb020' };
}
