import * as THREE from 'three';
import { wornPaint, dustyFabric, yellowedPlastic, mat, lathe, dent, mesh, tube, joint, gear, rivets, roundedBox, glowMat, paintedFace } from '../kit.js';
import { Rig, humanoidClips, twitch } from '../rig.js';
import { skeleton, mechHand, curlFingers, mechEye, teethRow, contactShadow } from './common.js';

/**
 * LE ROI DES ROUAGES — mascotte massive (2,4 m) au torse-tonneau qui s'ouvre
 * sur un mécanisme rotatif, couronne d'engrenages, bras-pistons énormes, petite tête.
 */
export function buildRoi() {
  const root = new THREE.Group();
  root.name = 'Roi';
  const m = {
    body: mat(wornPaint({ base: '#5a2a6a', under: '#3a3530', rust: 0.9, chips: 0.6, grime: 0.8, seed: 41 }), { metal: 0.45, rough: 0.6, bump: 0.025 }),
    gold: mat(wornPaint({ base: '#c49a38', under: '#5a3a18', rust: 0.6, chips: 0.6, seed: 42 }), { metal: 0.85, rough: 0.35 }),
    iron: mat(wornPaint({ base: '#4a4644', under: '#24201c', rust: 1, chips: 0.9, grime: 0.9, seed: 43 }), { metal: 0.8, rough: 0.6, bump: 0.03 }),
    brass: mat(wornPaint({ base: '#a87a3a', under: '#4a3018', rust: 0.7, chips: 0.5, seed: 44 }), { metal: 0.9, rough: 0.4 }),
    cape: mat(dustyFabric({ base: '#8a1a1a', seam: '#e0c070', stains: 1, seed: 45 }), { rough: 0.95, side: THREE.DoubleSide }),
    ermine: mat(dustyFabric({ base: '#e8e0d0', seam: '#1a1a1a', stains: 1.2, seed: 46 }), { rough: 1 }),
    face: mat(yellowedPlastic({ base: '#e8d8b8', cracks: 22, seed: 47, blush: 'rgba(160,40,40,0.4)' }), { rough: 0.5 }),
    dark: new THREE.MeshStandardMaterial({ color: '#0e0806', roughness: 0.9 }),
    teeth: new THREE.MeshStandardMaterial({ color: '#c8b890', roughness: 0.4, metalness: 0.3 }),
    furnace: glowMat("#ff6a1a", 2.5),
  };
  const o = { hipY: 0.95, spine: 0.2, chest: 0.45, neckY: 0.46, neckLen: 0.1, shoulderX: 0.55, shoulderY: 0.3, upper: 0.42, fore: 0.45, thigh: 0.42, shin: 0.45, hipX: 0.24, armR: 0.11, legR: 0.13 };
  const J = skeleton(root, o);
  J.shoulderL.rotation.z = 0.3; J.shoulderR.rotation.z = -0.3;

  // Jambes trapues en colonnes rivetées
  for (const s of ['L', 'R']) {
    J['thigh' + s].add(mesh(dent(lathe([[0, 0], [0.15, -0.02], [0.17, -0.2], [0.14, -0.42], [0, -0.43]], 18), 0.02, 2), m.body));
    J['knee' + s].add(mesh(new THREE.SphereGeometry(0.13, 14, 10), m.iron));
    J['knee' + s].add(mesh(dent(lathe([[0, 0], [0.13, -0.03], [0.15, -0.3], [0.19, -0.45], [0, -0.46]], 18), 0.02, 3), m.iron));
    J['foot' + s].add(mesh(dent(roundedBox(0.3, 0.12, 0.38, 0.05), 0.02, 4), m.iron, { y: -0.02, z: 0.06 }));
    rivets(J['foot' + s], m.brass, [[-0.1, 0.02, 0.24], [0, 0.03, 0.25], [0.1, 0.02, 0.24]], 0.015);
  }
  // Bassin
  J.hips.add(mesh(dent(lathe([[0, -0.15], [0.35, -0.12], [0.42, 0.05], [0.4, 0.22], [0, 0.22]], 28), 0.02, 5), m.iron));
  // TORSE-TONNEAU
  const barrel = dent(lathe([[0, -0.05], [0.42, -0.04], [0.55, 0.15], [0.6, 0.45], [0.56, 0.75], [0.42, 0.88], [0.2, 0.92], [0, 0.92]], 36), 0.03, 6);
  J.spine.add(mesh(barrel, m.body, { y: -0.05 }));
  // cerclages de tonneau
  for (const [y, r] of [[0.1, 0.5], [0.4, 0.6], [0.7, 0.57]]) J.spine.add(mesh(new THREE.TorusGeometry(r + 0.01, 0.025, 8, 36), m.brass, { y, rx: Math.PI / 2 }));
  // Cavité thoracique (mécanisme) + portes qui s'ouvrent
  const cavity = new THREE.Group();
  cavity.position.set(0, 0.42, 0.56);
  J.spine.add(cavity);
  cavity.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#1a0e08', roughness: 0.9, side: THREE.DoubleSide }), { rx: Math.PI / 2, z: -0.05 }));
  cavity.add(mesh(new THREE.CircleGeometry(0.27, 24), m.furnace, { z: -0.14 }));
  const gears = [];
  const g1 = mesh(gear({ teeth: 16, r: 0.2, depth: 0.04, tooth: 0.035, hole: 0.04 }), m.brass, { z: 0.02 });
  const g2 = mesh(gear({ teeth: 9, r: 0.1, depth: 0.05, tooth: 0.03, hole: 0.02, spokes: 0 }), m.gold, { x: 0.2, y: 0.17, z: 0.05 });
  const g3 = mesh(gear({ teeth: 10, r: 0.11, depth: 0.05, tooth: 0.03, hole: 0.025, spokes: 3 }), m.iron, { x: -0.19, y: -0.16, z: 0.06 });
  cavity.add(g1, g2, g3);
  gears.push([g1, 1], [g2, -1.8], [g3, -1.6]);
  cavity.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8), m.iron, { rx: Math.PI / 2, z: 0.04 }));
  const doors = [];
  for (const sx of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(sx * 0.3, 0, 0.06);
    cavity.add(hinge);
    const door = mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.04, 24, 1, false, 0, Math.PI), m.body, { x: -sx * 0.3, rx: Math.PI / 2, ry: 0, rz: sx > 0 ? Math.PI / 2 : -Math.PI / 2 });
    hinge.add(door);
    hinge.add(mesh(new THREE.TorusGeometry(0.31, 0.015, 6, 24, Math.PI), m.brass, { x: -sx * 0.3, z: 0.02, rz: sx > 0 ? -Math.PI / 2 : Math.PI / 2 }));
    rivets(hinge, m.brass, [[-sx * 0.15, 0.2, 0.03], [-sx * 0.15, -0.2, 0.03], [-sx * 0.25, 0, 0.03]], 0.014);
    doors.push({ hinge, sx });
  }
  // Cape royale à col d'hermine
  J.chest.add(mesh(lathe([[0.3, 0.4], [0.5, 0.25], [0.65, -0.2], [0.75, -0.9], [0.78, -1.15]], 20, Math.PI * 0.62, Math.PI * 0.76), m.cape, { z: -0.05 }));
  J.chest.add(mesh(new THREE.TorusGeometry(0.38, 0.08, 10, 30), m.ermine, { y: 0.4, rx: Math.PI / 2, s: [1, 0.9, 1] }));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    J.chest.add(mesh(new THREE.CapsuleGeometry(0.012, 0.03, 2, 4), m.dark, { x: Math.cos(a) * 0.38, y: 0.42, z: Math.sin(a) * 0.38 }));
  }
  // Épaules : grosses rotules + cheminées de vapeur
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const sh = J['shoulder' + s];
    sh.add(mesh(new THREE.SphereGeometry(0.2, 18, 12), m.body));
    sh.add(mesh(new THREE.SphereGeometry(0.21, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.35), m.gold, { y: 0.02 }));
    sh.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.25, 10), m.iron, { x: sx * 0.08, y: 0.25, z: -0.1 }));
    // bras supérieur : piston
    sh.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, o.upper, 14), m.body, { y: -o.upper / 2 }));
    sh.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, o.upper * 0.9, 8), m.iron, { x: sx * 0.13, y: -o.upper / 2, z: 0.05 }));
    const el = J['elbow' + s];
    el.add(mesh(new THREE.SphereGeometry(0.13, 14, 10), m.iron));
    // avant-bras énorme (gantelet)
    el.add(mesh(dent(lathe([[0, 0], [0.12, -0.03], [0.17, -0.25], [0.2, -0.42], [0.15, -0.46], [0, -0.46]], 20), 0.03, 7), m.body));
    for (const y of [-0.12, -0.32]) el.add(mesh(new THREE.TorusGeometry(0.175, 0.018, 6, 20), m.brass, { y, rx: Math.PI / 2 }));
  }
  const phal = [];
  for (const [s, side] of [['L', 1], ['R', -1]]) {
    phal.push(...mechHand(J['hand' + s], { palm: 0.2, fingerLen: 0.18, fingers: 3, r: 0.035, mat: m.iron, metal: m.brass, side }));
  }
  // Petite tête (contraste de proportions) enfoncée entre les épaules
  const H = J.head;
  const faceTex = paintedFace((ctx, S) => {
    ctx.fillStyle = '#e8d8b8'; ctx.fillRect(0, 0, S, S);
    // moustache peinte en guidon + rides
    ctx.fillStyle = '#2a1a10';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(128, 280); ctx.quadraticCurveTo(128 + sx * 40, 262, 128 + sx * 66, 250); ctx.quadraticCurveTo(128 + sx * 40, 285, 128, 290); ctx.fill(); }
    ctx.strokeStyle = 'rgba(80,40,20,0.6)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(95, 190 + i * 8); ctx.lineTo(161, 190 + i * 8); ctx.stroke(); }
  }, 'roi');
  const faceMat = m.face.clone();
  faceMat.map = faceTex;
  H.add(mesh(dent(new THREE.SphereGeometry(0.16, 28, 20), 0.03, 11), faceMat, { y: 0.12, s: [1.15, 1, 1] }));
  H.scale.setScalar(1.35);
  // couronne d'engrenages
  const crown = new THREE.Group();
  crown.position.y = 0.25;
  H.add(crown);
  crown.add(mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.06, 20, 1, true), m.gold));
  const crownGears = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const cg = mesh(gear({ teeth: 8, r: 0.055, depth: 0.015, tooth: 0.02, hole: 0.012, spokes: 0 }), m.gold, { x: Math.cos(a) * 0.15, y: 0.06, z: Math.sin(a) * 0.15, ry: -a + Math.PI / 2 });
    crown.add(cg);
    crownGears.push(cg);
  }
  crown.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), glowMat('#ff2244', 1.2), { y: 0.02, z: 0.155 }));
  const eyes = [];
  for (const sx of [-1, 1]) {
    // monocle à droite, œil enfoncé à gauche
    const e = mechEye(H, { r: sx > 0 ? 0.035 : 0.045, x: sx * 0.07, y: 0.15, z: 0.115, irisColor: '#ff5a1a', white: '#d8d0b8', lidMat: m.iron });
    eyes.push(e);
  }
  H.add(mesh(new THREE.TorusGeometry(0.055, 0.008, 6, 20), m.gold, { x: -0.07, y: 0.15, z: 0.16 }));
  H.add(mesh(tube([[-0.12, 0.12, 0.15], [-0.15, 0.0, 0.14], [-0.2, -0.1, 0.1]], 0.003, 10, 3), m.gold));
  // mâchoire en grille
  const jaw = joint('jaw', H, 0, 0.06, 0.05);
  jaw.add(mesh(new THREE.BoxGeometry(0.2, 0.06, 0.1), m.iron, { y: -0.03, z: 0.05 }));
  teethRow(jaw, { n: 8, w: 0.16, h: 0.03, curve: 0.01, y: 0.0, z: 0.105, mat: m.teeth, flip: true });
  H.add(mesh(new THREE.BoxGeometry(0.18, 0.04, 0.03), m.dark, { y: 0.065, z: 0.13 }));

  contactShadow(root, 0.8);

  const clips = humanoidClips({ heavy: 1, stride: 0.3, armSwing: 0.2, sway: 0.08 });
  clips.idle = ((base) => (t, R, T) => {
    base(t, R, T);
    R.r('shoulderL', 0, 0, 0.1); R.r('shoulderR', 0, 0, -0.1);
    R.set('gears', 0.4);
    R.set('doors', 0.05 + Math.max(0, Math.sin(t * 0.4)) * 0.1);
  })(clips.idle);
  clips.walk = ((base) => (t, R, T) => { base(t, R, T); R.set('gears', 1.2); })(clips.walk);
  clips.sabotage = (t, R) => {
    // Arrache les câbles : bras qui tirent en alternance, torse ouvert, engrenages emballés
    const s = Math.sin(t * 3);
    R.r('spine', 0.3, 0, s * 0.05); R.r('chest', 0.2, s * 0.15, 0);
    R.r('shoulderL', -1.3 + s * 0.5, 0, 0.2); R.r('elbowL', -0.8 - s * 0.4, 0, 0);
    R.r('shoulderR', -1.3 - s * 0.5, 0, -0.2); R.r('elbowR', -0.8 + s * 0.4, 0, 0);
    R.r('head', 0.3 + twitch(t, 2, 3), 0, 0);
    R.set('gears', 3); R.set('doors', 0.8); R.set('jaw', 0.3); R.set('fingers', 0.9); R.set('eyes', 2);
  };
  clips.jumpscare = ((base) => (t, R, T) => { base(t, R, T); R.set('doors', 1); R.set('gears', 6); })(clips.jumpscare);
  clips.stunned = ((base) => (t, R, T) => { base(t, R, T); R.set('gears', Math.max(0, 4 - t * 2)); R.set('doors', 0.5); })(clips.stunned);

  let spin = 0;
  const rig = new Rig(root, clips, (p, T) => {
    const gs = p.gears ?? 0.3;
    spin += gs * 0.03;
    for (const [g, k] of gears) g.rotation.z = spin * k;
    crownGears.forEach((g, i) => { g.rotation.z = spin * (i % 2 ? 1 : -1) * 1.3; });
    const d = Math.min(1, p.doors ?? 0);
    for (const { hinge, sx } of doors) hinge.rotation.y = sx * d * 2.5;
    m.furnace.emissiveIntensity = 0.8 + gs * 0.5 + Math.sin(T * 9) * 0.2;
    jaw.rotation.x = (p.jaw ?? 0) * 0.6;
    curlFingers(phal, p.fingers ?? 0.4);
    const glow = p.eyes ?? 1;
    for (const e of eyes) e.irisMat.emissiveIntensity = 0.5 + glow;
  });
  return { root, rig, height: 2.4, name: 'roi', eyeColor: '#ff5a1a' };
}
