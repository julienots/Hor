import * as THREE from 'three';
import { mesh, glowMat } from '../models/kit.js';
import { M } from './props.js';
import { ROOMS } from '../sim/map.js';
import { ROOM_POS, DIMS, CONNECTIONS, DOOR_W, DOOR_H, wallPos, isXWall } from './layout.js';

// ---------------------------------------------------------------------------
// Exploration dans un bâtiment continu : zones praticables (salles, portes,
// passages), obstacles et salle courante, en coordonnées monde.
// ---------------------------------------------------------------------------

// Obstacles au sol, en coordonnées locales de chaque salle (x0, z0, x1, z1).
const OBSTACLES = {
  OFFICE: [[-1.3, -2.3, 1.3, -1.2]],
  STAGE: [[-4.1, -4.5, 4.1, -1.4], [-3.4, 0.7, -1.6, 1.7], [1.3, 1.1, 3.1, 2.1]],
  PARTY: [[-3.9, -3.0, -0.1, -1.8], [-3.5, -0.9, 0.3, 0.3], [-3.1, 1.2, 0.7, 2.4]],
  LOBBY: [[-0.05, -2.3, 3.05, -1.3], [0.2, -3.5, 2.8, -2.9], [-3.5, 0.5, -2.9, 2.5]],
  KITCHEN: [[-2.3, -3.0, 2.3, -2.2], [2.2, -3.0, 3.6, -2.0], [-1.3, -0.25, 1.3, 0.85], [-4, 0, -3.0, 1.1]],
  WORKSHOP: [[-1.2, -2.8, 2.2, -1.6], [-3.4, 1.4, -2.0, 2.3]],
  GENERATOR: [[-2.0, -2.7, 2.4, -1.3], [-4.3, -3.5, -0.6, -3.0]],
  BACKSTAGE: [[-3.1, -1.8, -0.5, -1.4], [-3.1, 0.2, -0.5, 0.6], [0.5, -3.0, 2.3, -2.4], [-3.2, -3.0, -1.2, -2.5], [2.8, -1.6, 3.5, -0.8]],
  HALL_W: [], HALL_E: [],
};

const R = 0.28; // rayon du joueur

// Zones praticables : { x0, x1, z0, z1, room (ou null pour une porte), block ('W'/'E' : porte blindée) }
const ZONES = [];
const ROOM_RECTS = [];
const OBST = [];

function buildZones() {
  if (ZONES.length) return;
  for (const [room, [w, d]] of Object.entries(DIMS)) {
    const [cx, cz] = ROOM_POS[room];
    ROOM_RECTS.push({ room, x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
    ZONES.push({ room, x0: cx - w / 2 + R, x1: cx + w / 2 - R, z0: cz - d / 2 + R, z1: cz + d / 2 - R });
  }
  // Cabine et ses deux couloirs d'accès (font partie de la cabine)
  ROOM_RECTS.push({ room: 'OFFICE', x0: -7, x1: 7, z0: -2.6, z1: 1.8 });
  ZONES.push({ room: 'OFFICE', x0: -2.6 + R, x1: 2.6 - R, z0: -2.6 + R, z1: 1.8 - R });
  ZONES.push({ room: 'OFFICE', x0: -7, x1: -2.5, z0: -1.1 + R, z1: 0.7 - R });
  ZONES.push({ room: 'OFFICE', x0: 2.5, x1: 7, z0: -1.1 + R, z1: 0.7 - R });
  // Portes blindées de la cabine (bloquées quand elles sont fermées)
  ZONES.push({ room: null, block: 'W', x0: -3.0, x1: -2.2, z0: -0.9 + R, z1: 0.5 - R });
  ZONES.push({ room: null, block: 'E', x0: 2.2, x1: 3.0, z0: -0.9 + R, z1: 0.5 - R });
  // Ouvertures entre salles (et passage s'il y a un écart entre les murs)
  for (const [a, wa, b, wb, at] of CONNECTIONS) {
    const pa = wallPos(a, wa), pb = wallPos(b, wb);
    const lo = Math.min(pa, pb) - 0.75, hi = Math.max(pa, pb) + 0.75;
    const half = DOOR_W / 2 - R;
    if (isXWall(wa)) ZONES.push({ room: null, x0: lo, x1: hi, z0: at - half, z1: at + half });
    else ZONES.push({ room: null, x0: at - half, x1: at + half, z0: lo, z1: hi });
  }
  for (const [room, list] of Object.entries(OBSTACLES)) {
    const [cx, cz] = ROOM_POS[room];
    for (const [ax, az, bx, bz] of list) OBST.push([cx + ax - R, cz + az - R, cx + bx + R, cz + bz + R]);
  }
}

const inside = (z, x, y) => x >= z.x0 && x <= z.x1 && y >= z.z0 && y <= z.z1;

/** Position valide ? `office` donne l'état des portes blindées. */
export function valid(x, z, office) {
  let ok = false;
  for (const zn of ZONES) {
    if (!inside(zn, x, z)) continue;
    if (zn.block && (zn.block === 'W' ? office?.doorW : office?.doorE)) continue;
    ok = true;
    break;
  }
  if (!ok) return false;
  for (const [ax, az, bx, bz] of OBST) if (x > ax && x < bx && z > az && z < bz) return false;
  return true;
}

/** Déplacement avec glissement le long des murs. Renvoie { x, z, blocked }. */
export function moveIn(x, z, dx, dz, office) {
  if (valid(x + dx, z + dz, office)) return { x: x + dx, z: z + dz, blocked: false };
  if (valid(x + dx, z, office)) return { x: x + dx, z, blocked: true };
  if (valid(x, z + dz, office)) return { x, z: z + dz, blocked: true };
  return { x, z, blocked: true };
}

/** Salle contenant ce point (null dans l'épaisseur d'une porte). */
export function roomAt(x, z) {
  for (const r of ROOM_RECTS) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.room;
  return null;
}

/** Porte blindée devant laquelle se trouve le joueur (pour afficher « fermée »). */
export function nearArmoredDoor(x, z) {
  if (z < -0.95 || z > 0.55) return null;
  if (Math.abs(x + 2.6) < 0.6) return 'W';
  if (Math.abs(x - 2.6) < 0.6) return 'E';
  return null;
}

function signTexture(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#1a0e0a'; x.fillRect(0, 0, 256, 64);
  x.strokeStyle = '#c49a38'; x.lineWidth = 4; x.strokeRect(4, 4, 248, 56);
  x.fillStyle = '#f0d890'; x.font = 'bold 26px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text.length > 18 ? text.slice(0, 17) + '…' : text, 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const roomName = (r) => (r === 'OFFICE' ? 'Cabine de surveillance' : ROOMS[r].name);

/**
 * Ajoute le décor des ouvertures (encadrements, panneau indiquant la salle voisine,
 * veilleuse) et les passages entre murs écartés. Renvoie le groupe des passages.
 */
export function addWalkData(views, scene) {
  buildZones();
  const lamp = glowMat('#ff3a2a', 1.6);
  const passages = new THREE.Group();
  passages.name = 'passages';
  scene.add(passages);
  const frame = (room, wall, at, to) => {
    if (room === 'OFFICE') return;
    const v = views[room];
    const [cx, cz] = ROOM_POS[room];
    const wp = wallPos(room, wall);
    const g = new THREE.Group();
    const inward = { left: [1, 0], right: [-1, 0], back: [0, 1], front: [0, -1] }[wall];
    const lx = isXWall(wall) ? wp - cx : at - cx;
    const lz = isXWall(wall) ? at - cz : wp - cz;
    g.position.set(lx + inward[0] * 0.03, 0, lz + inward[1] * 0.03);
    g.rotation.y = { back: 0, front: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }[wall];
    v.group.add(g);
    for (const sx of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.1, DOOR_H + 0.05, 0.16), M.metal, { x: sx * (DOOR_W / 2 + 0.05), y: (DOOR_H + 0.05) / 2 }));
    g.add(mesh(new THREE.BoxGeometry(DOOR_W + 0.2, 0.1, 0.16), M.metal, { y: DOOR_H + 0.05 }));
    const sign = mesh(new THREE.PlaneGeometry(0.9, 0.22), new THREE.MeshBasicMaterial({ map: signTexture(roomName(to)) }), { y: DOOR_H + 0.28, z: 0.05 });
    sign.castShadow = false;
    g.add(sign);
    g.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), lamp, { y: DOOR_H + 0.55, z: 0.05 }));
  };
  const wallMat = new THREE.MeshStandardMaterial({ color: '#2a2422', roughness: 0.95, side: THREE.DoubleSide });
  for (const [a, wa, b, wb, at] of CONNECTIONS) {
    frame(a, wa, at, b);
    frame(b, wb, at, a);
    const pa = wallPos(a, wa), pb = wallPos(b, wb);
    const gap = Math.abs(pa - pb);
    if (gap < 0.05) continue;
    // court passage entre deux murs écartés
    const mid = (pa + pb) / 2;
    const g = new THREE.Group();
    if (isXWall(wa)) { g.position.set(mid, 0, at); g.rotation.y = Math.PI / 2; } else g.position.set(at, 0, mid);
    passages.add(g);
    g.add(mesh(new THREE.PlaneGeometry(DOOR_W, gap), M.wood, { rx: -Math.PI / 2, y: 0.002 }));
    g.add(mesh(new THREE.PlaneGeometry(DOOR_W, gap), wallMat, { rx: Math.PI / 2, y: DOOR_H }));
    for (const sx of [-1, 1]) g.add(mesh(new THREE.PlaneGeometry(gap, DOOR_H), wallMat, { x: sx * DOOR_W / 2, y: DOOR_H / 2, ry: Math.PI / 2 }));
  }
  for (const room of Object.keys(DIMS)) views[room].spots.any = { p: [0, 0, DIMS[room][1] / 4], ry: Math.PI, clip: 'walk' };
  views.OFFICE.spots.any = { p: [0, 0, -0.5], ry: 0, clip: 'walk' };
  views.VENT.spots.any = { p: [0, 0.05, -4], ry: 0, clip: 'crawl', scale: 0.85 };
  return passages;
}

export { roomName };
