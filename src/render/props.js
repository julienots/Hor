import * as THREE from 'three';
import { wornPaint, dustyFabric, mat, lathe, dent, mesh, tube, gear, roundedBox, glowMat } from '../models/kit.js';
import { poster } from './envtex.js';

// Accessoires de décor réutilisables (tables, chaises, chapeaux de fête, caisses…).
export const M = {};
export function initPropMaterials() {
  if (M.wood) return M;
  M.wood = mat(wornPaint({ base: '#6a4428', under: '#3a2414', rust: 0, grime: 0.7, scratches: 70, seed: 81 }), { rough: 0.7 });
  M.metal = mat(wornPaint({ base: '#6a6a6a', under: '#2a2826', rust: 0.8, chips: 0.6, seed: 82 }), { metal: 0.7, rough: 0.5 });
  M.redMetal = mat(wornPaint({ base: '#8a2020', under: '#3a3030', rust: 0.7, chips: 0.6, seed: 83 }), { metal: 0.5, rough: 0.5 });
  M.yellow = mat(wornPaint({ base: '#c8a030', under: '#3a3030', rust: 0.5, chips: 0.5, stripes: { color: '#1a1a1a', width: 40, diag: true }, seed: 84 }), { metal: 0.3, rough: 0.6 });
  M.cloth = mat(dustyFabric({ base: '#d8d0c0', seam: '#a03040', plaid: '#c04050', stains: 1, seed: 85 }), { rough: 1, side: THREE.DoubleSide });
  M.curtain = mat(dustyFabric({ base: '#7a1020', seam: '#d0a040', stains: 0.8, seed: 86 }), { rough: 1, side: THREE.DoubleSide });
  M.dark = new THREE.MeshStandardMaterial({ color: '#141010', roughness: 0.9 });
  M.rubber = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.8 });
  M.steel = mat(wornPaint({ base: '#8a8a88', under: '#3a3a3a', rust: 0.3, chips: 0.2, scratches: 120, seed: 87 }), { metal: 0.9, rough: 0.3 });
  M.gold = mat(wornPaint({ base: '#c49a38', under: '#5a3a18', rust: 0.4, seed: 88 }), { metal: 0.85, rough: 0.35 });
  M.paper = new THREE.MeshStandardMaterial({ color: '#d8d0b8', roughness: 1 });
  M.cake = mat(dustyFabric({ base: '#e0b0c0', seam: '#ffffff', stains: 0.6, seed: 89 }), { rough: 0.9 });
  M.screen = new THREE.MeshStandardMaterial({ color: '#0a1a10', emissive: new THREE.Color('#103020'), emissiveIntensity: 1, roughness: 0.2 });
  M.bulb = glowMat('#ffd890', 2);
  M.redLamp = glowMat('#ff2020', 2);
  M.greenLamp = glowMat('#20ff60', 1.5);
  M.hats = ['#c03050', '#3080c0', '#30a050', '#e0a020'].map((c, i) => mat(wornPaint({ base: c, under: '#e0d8c0', stripes: { color: '#f0e8d0', width: 30, diag: true }, rust: 0, chips: 0.3, seed: 90 + i }), { rough: 0.7, side: THREE.DoubleSide }));
  M.balloons = ['#a02030', '#2050a0', '#a08020', '#208040'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35 }));
  return M;
}

export function table(w = 2.4, d = 0.9, cloth = true) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(w, 0.05, d), M.wood, { y: 0.75 }));
  if (cloth) g.add(mesh(new THREE.BoxGeometry(w + 0.1, 0.02, d + 0.1), M.cloth, { y: 0.78 }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 6), M.metal, { x: sx * (w / 2 - 0.1), y: 0.375, z: sz * (d / 2 - 0.1) }));
  return g;
}

export function chair(fallen = false) {
  const g = new THREE.Group();
  g.add(mesh(roundedBox(0.42, 0.05, 0.42, 0.02), M.redMetal, { y: 0.45 }));
  g.add(mesh(roundedBox(0.42, 0.45, 0.04, 0.02), M.redMetal, { y: 0.7, z: -0.2 }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 5), M.metal, { x: sx * 0.18, y: 0.225, z: sz * 0.18 }));
  if (fallen) { g.rotation.z = Math.PI / 2; g.position.y = 0.2; }
  return g;
}

export function partyHat(i = 0) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.ConeGeometry(0.07, 0.2, 12, 1, true), M.hats[i % 4], { y: 0.1 }));
  g.add(mesh(new THREE.SphereGeometry(0.025, 6, 4), M.cake, { y: 0.21 }));
  return g;
}

export function balloon(i = 0, deflated = false) {
  const g = new THREE.Group();
  const s = deflated ? [0.7, 0.45, 0.7] : [1, 1.2, 1];
  g.add(mesh(new THREE.SphereGeometry(0.15, 14, 10), M.balloons[i % 4], { y: 0, s }));
  g.add(mesh(tube([[0, -0.17, 0], [0.03, -0.5, 0.02], [-0.02, -0.9, 0]], 0.003, 10, 3), M.paper));
  return g;
}

export function cake() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.12, 20), M.cake, { y: 0.06 }));
  g.add(mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.09, 18), M.cake, { y: 0.16 }));
  for (let i = 0; i < 5; i++) g.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 4), M.hats[i % 4], { x: Math.cos(i * 1.25) * 0.07, y: 0.24, z: Math.sin(i * 1.25) * 0.07 }));
  return g;
}

export function crate(s = 0.6) {
  const g = new THREE.Group();
  g.add(mesh(dent(new THREE.BoxGeometry(s, s, s, 2, 2, 2), 0.02, 5), M.wood, { y: s / 2 }));
  for (const y of [0.1, s - 0.1]) g.add(mesh(new THREE.BoxGeometry(s + 0.02, 0.05, s + 0.02), M.metal, { y }));
  return g;
}

export function shelf(w = 1.6, h = 2, d = 0.4) {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.04, h, d), M.metal, { x: sx * w / 2, y: h / 2 }));
  for (let i = 0; i < 4; i++) g.add(mesh(new THREE.BoxGeometry(w, 0.03, d), M.metal, { y: 0.2 + i * (h - 0.3) / 3 }));
  return g;
}

export function posterMesh(kind, seed, w = 0.6, variant = 0) {
  const m = new THREE.MeshStandardMaterial({ map: poster(kind, seed, variant), roughness: 0.85, transparent: true, alphaTest: 0.5 });
  const p = mesh(new THREE.PlaneGeometry(w, w * 1.5), m);
  p.castShadow = false;
  p.userData.setVariant = (v) => { m.map = poster(kind, seed, v); m.needsUpdate = true; };
  return p;
}

export function hangingLamp(cordLen = 0.8) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, cordLen, 4), M.dark, { y: -cordLen / 2 }));
  const shade = mesh(lathe([[0.04, 0], [0.06, -0.03], [0.22, -0.18], [0.23, -0.2]], 20), M.redMetal, { y: -cordLen });
  shade.material = shade.material.clone();
  shade.material.side = THREE.DoubleSide;
  g.add(shade);
  const bulb = mesh(new THREE.SphereGeometry(0.05, 10, 8), M.bulb, { y: -cordLen - 0.1 });
  g.add(bulb);
  g.userData.bulb = bulb;
  return g;
}

export function pipeRun(points, r = 0.06, material = M.metal) {
  return mesh(tube(points, r, 40, 10), material);
}

export function generator() {
  const g = new THREE.Group();
  g.add(mesh(dent(roundedBox(2.2, 1.6, 1.2, 0.08), 0.02, 3), M.yellow, { y: 0.8 }));
  g.add(mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.3, 24), M.metal, { y: 0.9, x: -1.3, rz: Math.PI / 2 }));
  const fan = mesh(gear({ teeth: 6, r: 0.35, depth: 0.04, tooth: 0.08, hole: 0.05, spokes: 3 }), M.steel, { x: 0.6, y: 1.65, ry: 0, rx: Math.PI / 2 });
  g.add(fan);
  g.userData.fan = fan;
  for (let i = 0; i < 4; i++) g.add(mesh(new THREE.BoxGeometry(0.3, 0.2, 0.05), M.dark, { x: -0.6 + i * 0.4, y: 1.1, z: 0.61 }));
  const lamps = [];
  for (let i = 0; i < 4; i++) { const l = mesh(new THREE.SphereGeometry(0.03, 8, 6), M.greenLamp.clone(), { x: -0.6 + i * 0.4, y: 1.1, z: 0.64 }); g.add(l); lamps.push(l); }
  g.userData.lamps = lamps;
  // gros câbles qui partent dans le mur
  for (let i = 0; i < 5; i++) g.add(pipeRun([[0.8 - i * 0.15, 1.6, -0.3], [0.8 - i * 0.15, 2.4, -0.5], [0.6 - i * 0.2, 2.6, -1.4]], 0.035, M.rubber));
  return g;
}
