import * as THREE from 'three';
import { joint, mesh, limb, balljoint, lathe } from '../kit.js';

/**
 * Squelette humanoïde de base (os nommés). Le personnage regarde vers +Z.
 * Renvoie les articulations ; les maillages sont attachés par chaque personnage.
 */
export function skeleton(root, o) {
  const J = {};
  J.hips = joint('hips', root, 0, o.hipY, 0);
  J.spine = joint('spine', J.hips, 0, o.spine ?? 0.18, 0);
  J.chest = joint('chest', J.spine, 0, o.chest ?? 0.3, 0);
  J.neck = joint('neck', J.chest, 0, o.neckY ?? 0.32, o.neckZ ?? 0);
  J.head = joint('head', J.neck, 0, o.neckLen ?? 0.14, 0);
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    J['shoulder' + s] = joint('shoulder' + s, J.chest, sx * o.shoulderX, o.shoulderY ?? 0.24, 0);
    J['elbow' + s] = joint('elbow' + s, J['shoulder' + s], 0, -o.upper, 0);
    J['hand' + s] = joint('hand' + s, J['elbow' + s], 0, -o.fore, 0);
    J['thigh' + s] = joint('thigh' + s, J.hips, sx * o.hipX, -0.02, 0);
    J['knee' + s] = joint('knee' + s, J['thigh' + s], 0, -o.thigh, 0);
    J['foot' + s] = joint('foot' + s, J['knee' + s], 0, -o.shin, 0);
  }
  // pose de repos : bras légèrement écartés
  J.shoulderL.rotation.z = 0.12; J.shoulderR.rotation.z = -0.12;
  return J;
}

/** Bras et jambes mécaniques : segments effilés + rotules apparentes. */
export function dressLimbs(J, o, m) {
  for (const s of ['L', 'R']) {
    J['shoulder' + s].add(mesh(limb(o.upper, o.armR, o.armR * 0.8), m.arm));
    balljoint(J['shoulder' + s], o.armR * 1.15, m.metal);
    J['elbow' + s].add(mesh(limb(o.fore, o.armR * 0.85, o.armR * 0.65), m.fore ?? m.arm));
    balljoint(J['elbow' + s], o.armR * 0.9, m.metal);
    J['thigh' + s].add(mesh(limb(o.thigh, o.legR, o.legR * 0.8), m.leg));
    balljoint(J['knee' + s], o.legR * 0.85, m.metal);
    J['knee' + s].add(mesh(limb(o.shin, o.legR * 0.8, o.legR * 0.55), m.shin ?? m.leg));
  }
}

/**
 * Main mécanique à doigts articulés (3 phalanges chacun). Renvoie les phalanges
 * pour pouvoir les replier via le paramètre « fingers ».
 */
export function mechHand(parent, { palm = 0.08, fingerLen = 0.09, fingers = 4, r = 0.012, mat, metal, side = 1 }) {
  const phal = [];
  const pg = new THREE.BoxGeometry(palm, palm * 1.1, palm * 0.35);
  parent.add(mesh(pg, mat, { y: -palm * 0.55 }));
  for (let f = 0; f < fingers + 1; f++) {
    const thumb = f === fingers;
    const x = thumb ? side * palm * 0.62 : (f / (fingers - 1) - 0.5) * palm * 0.85;
    let p = joint(`fing${side > 0 ? "L" : "R"}${f}`, parent, x, thumb ? -palm * 0.45 : -palm * 1.1, 0);
    if (thumb) p.rotation.z = side * 0.6;
    const len = thumb ? fingerLen * 0.6 : fingerLen * (1 - Math.abs(f - (fingers - 1) / 2) * 0.08);
    for (let k = 0; k < 3; k++) {
      p.add(mesh(new THREE.CylinderGeometry(r * (1 - k * 0.15), r * (0.9 - k * 0.15), len / 3, 6), k % 2 ? metal : mat, { y: -len / 6 }));
      p.add(mesh(new THREE.SphereGeometry(r * 1.05, 6, 4), metal));
      phal.push(p);
      const nxt = new THREE.Object3D();
      nxt.position.y = -len / 3;
      p.add(nxt);
      p = nxt;
    }
    // pointe métallique
    p.add(mesh(new THREE.ConeGeometry(r * 0.8, r * 2.5, 6), metal, { y: -r * 1.2, rx: Math.PI }));
  }
  return phal;
}

/** Repli des doigts (0 = ouverts, 1 = griffes). */
export function curlFingers(phal, v) {
  for (const p of phal) p.rotation.x = -0.15 - v * 0.55;
}

/** Œil mécanique : globe, iris émissif, paupière. */
// Halo lumineux des yeux (visible dans le noir), texture partagée.
let haloTex = null;
function getHaloTex() {
  if (haloTex) return haloTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  haloTex = new THREE.CanvasTexture(c);
  return haloTex;
}

const oilMat = new THREE.MeshStandardMaterial({ color: '#050203', roughness: 0.08, metalness: 0.3 });

/** Œil mécanique : globe, iris émissif à pupille en tête d'épingle, halo, paupière, coulures d'huile. */
export function mechEye(parent, { r = 0.05, x = 0, y = 0, z = 0, irisColor = '#ff2a1a', white = '#efe6cf', lidMat, drip = true }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  const ball = mesh(new THREE.SphereGeometry(r, 18, 12), new THREE.MeshStandardMaterial({ color: white, roughness: 0.25 }));
  g.add(ball);
  const irisMat = new THREE.MeshStandardMaterial({ color: '#111', emissive: new THREE.Color(irisColor), emissiveIntensity: 1.5, roughness: 0.2 });
  irisMat.userData.iris = true;
  irisMat.userData.baseColor = new THREE.Color(irisColor);
  const iris = mesh(new THREE.CircleGeometry(r * 0.42, 16), irisMat, { z: r * 0.995 });
  g.add(iris);
  // pupille minuscule : regard fixe et vide
  const pupil = mesh(new THREE.CircleGeometry(r * 0.08, 10), new THREE.MeshBasicMaterial({ color: '#000' }), { z: r * 1.0 });
  g.add(pupil);
  // halo additif : les yeux brillent dans l'obscurité
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: getHaloTex(), color: irisColor, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
  halo.scale.setScalar(r * 7);
  halo.position.z = r * 1.2;
  halo.userData.halo = true;
  halo.userData.iris = irisMat;
  halo.castShadow = false;
  g.add(halo);
  let lid = null;
  if (lidMat) {
    lid = mesh(new THREE.SphereGeometry(r * 1.08, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), lidMat, { rx: -0.5 });
    g.add(lid);
  }
  // coulures d'huile noire sous l'œil, comme des larmes
  if (drip) {
    for (const [dx, len] of [[-0.25, 2.4], [0.2, 1.5]]) {
      const d = mesh(new THREE.CapsuleGeometry(r * 0.11, r * len, 2, 6), oilMat, { x: r * dx, y: -r * (0.9 + len / 2), z: r * 0.92 });
      g.add(d);
    }
  }
  return { g, irisMat, lid, halo };
}

/** Rangée de dents (blocs légèrement irréguliers). */
export function teethRow(parent, { n = 12, w = 0.3, h = 0.04, curve = 0.08, y = 0, z = 0, mat, flip = false }) {
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1) - 0.5;
    const th = h * (0.8 + ((i * 7) % 5) * 0.08);
    const t = mesh(new THREE.BoxGeometry(w / n * 0.85, th, 0.02), mat, {
      x: u * w, y: y + (flip ? th / 2 : -th / 2), z: z - u * u * curve * 4, ry: -u * 1.6,
    });
    parent.add(t);
  }
}

/** Disque d'ombre au sol (contact visuel même sans ombres temps réel). */
export function contactShadow(root, r = 0.5) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.005;
  m.renderOrder = -1;
  root.add(m);
  return m;
}

export const profileOf = (pts) => lathe(pts, 32);
