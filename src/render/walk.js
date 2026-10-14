import * as THREE from 'three';
import { mesh, glowMat } from '../models/kit.js';
import { M } from './props.js';
import { ROOMS } from '../sim/map.js';

// ---------------------------------------------------------------------------
// Exploration : zones de marche, obstacles et portes entre les salles.
// Les salles restent séparées ; franchir une porte fait passer (fondu au noir)
// dans la salle reliée, devant la porte correspondante.
// ---------------------------------------------------------------------------

// Dimensions intérieures (x de -w/2 à w/2, z de -d/2 à d/2).
const DIMS = {
  STAGE: [10, 9], PARTY: [12, 8], LOBBY: [9, 7], KITCHEN: [8, 6], WORKSHOP: [8, 6],
  HALL_W: [2.4, 14], HALL_E: [2.4, 14], GENERATOR: [9, 7], BACKSTAGE: [7, 6],
};

// Portes : [salle, mur, position le long du mur, destination]
const DOORS = [
  ['HALL_W', 'front', 0, 'OFFICE'], ['HALL_W', 'back', 0, 'PARTY'], ['HALL_W', 'right', 3, 'WORKSHOP'],
  ['HALL_E', 'front', 0, 'OFFICE'], ['HALL_E', 'back', 0, 'LOBBY'], ['HALL_E', 'left', -1, 'KITCHEN'], ['HALL_E', 'right', -4.5, 'GENERATOR'],
  ['PARTY', 'left', -2, 'HALL_W'], ['PARTY', 'back', 4.6, 'STAGE'], ['PARTY', 'right', 2.4, 'LOBBY'], ['PARTY', 'right', -1.6, 'KITCHEN'],
  ['STAGE', 'front', -2, 'PARTY'], ['STAGE', 'right', 0.2, 'BACKSTAGE'],
  ['BACKSTAGE', 'left', 1.6, 'STAGE'],
  ['LOBBY', 'left', -0.6, 'PARTY'], ['LOBBY', 'right', 2.3, 'HALL_E'],
  ['KITCHEN', 'front', -2, 'PARTY'], ['KITCHEN', 'right', 1.8, 'HALL_E'],
  ['WORKSHOP', 'left', -0.2, 'HALL_W'],
  ['GENERATOR', 'left', 1.6, 'HALL_E'],
];

// Obstacles (boîtes au sol, en coordonnées locales : x0, z0, x1, z1).
const OBSTACLES = {
  OFFICE: [[-1.3, -2.3, 1.3, -1.2]],
  STAGE: [[-4.1, -4.5, 4.1, -1.4], [-3.4, 0.7, -1.6, 1.7], [1.3, 1.1, 3.1, 2.1]],
  PARTY: [[-3.9, -3.0, -0.1, -1.8], [-3.5, -0.9, 0.3, 0.3], [-3.1, 1.2, 0.7, 2.4]],
  LOBBY: [[-0.05, -2.3, 3.05, -1.3], [0.2, -3.5, 2.8, -2.9], [-3.5, 0.5, -2.9, 2.5]],
  KITCHEN: [[-3.8, -3.0, 2.3, -2.2], [2.2, -3.0, 3.6, -2.0], [-1.3, -0.25, 1.3, 0.85], [-4, 0, -3.0, 1.1]],
  WORKSHOP: [[-1.2, -2.8, 2.2, -1.6], [-3.4, 1.4, -2.0, 2.3]],
  GENERATOR: [[-2.0, -2.7, 2.4, -1.3], [-4.3, -3.5, -0.6, -3.0]],
  BACKSTAGE: [[-3.1, -1.8, -0.5, -1.4], [-3.1, 0.2, -0.5, 0.6], [0.5, -3.0, 2.3, -2.4], [-3.2, -3.0, -1.2, -2.5], [2.8, -1.6, 3.5, -0.8]],
  HALL_W: [], HALL_E: [],
};

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

function wallFrame(wall, along, w, d) {
  // position (x, z), rotation pour faire face à la salle, direction vers l'intérieur
  switch (wall) {
    case 'back': return { x: along, z: -d / 2, ry: 0, inX: 0, inZ: 1 };
    case 'front': return { x: along, z: d / 2, ry: Math.PI, inX: 0, inZ: -1 };
    case 'left': return { x: -w / 2, z: along, ry: Math.PI / 2, inX: 1, inZ: 0 };
    default: return { x: w / 2, z: along, ry: -Math.PI / 2, inX: -1, inZ: 0 };
  }
}

// Orientation (lacet) de la caméra pour regarder dans la direction (dx, dz).
export const yawFor = (dx, dz) => Math.atan2(-dx, -dz);

/** Ajoute à chaque vue : zone de marche, obstacles, portes (avec leur décor). */
export function addWalkData(views) {
  const doorMat = M.wood;
  const lamp = glowMat('#ff3a2a', 1.6);
  for (const [room, [w, d]] of Object.entries(DIMS)) {
    const v = views[room];
    v.walk = { bounds: [-w / 2 + 0.35, w / 2 - 0.35, -d / 2 + 0.35, d / 2 - 0.35], obstacles: OBSTACLES[room], doors: [] };
    v.spots.any = { p: [0, 0, d / 4], ry: Math.PI, clip: 'walk' };
  }
  for (const [room, wall, along, to] of DOORS) {
    const v = views[room];
    const [w, d] = DIMS[room];
    const f = wallFrame(wall, along, w, d);
    const g = new THREE.Group();
    g.position.set(f.x + f.inX * 0.02, 0, f.z + f.inZ * 0.02);
    g.rotation.y = f.ry;
    v.group.add(g);
    // encadrement + porte + plaque + veilleuse rouge
    g.add(mesh(new THREE.BoxGeometry(1.15, 2.2, 0.06), doorMat, { y: 1.1, z: 0.0 }));
    for (const sx of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.1, 2.35, 0.14), M.metal, { x: sx * 0.62, y: 1.17 }));
    g.add(mesh(new THREE.BoxGeometry(1.34, 0.1, 0.14), M.metal, { y: 2.33 }));
    g.add(mesh(new THREE.SphereGeometry(0.04, 8, 6), M.gold, { x: 0.42, y: 1.05, z: 0.06 }));
    const sign = mesh(new THREE.PlaneGeometry(0.9, 0.22), new THREE.MeshBasicMaterial({ map: signTexture(to === 'OFFICE' ? 'Cabine de surveillance' : ROOMS[to].name) }), { y: 2.58, z: 0.04 });
    sign.castShadow = false;
    g.add(sign);
    g.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), lamp, { y: 2.85, z: 0.05 }));
    v.walk.doors.push({ to, x: f.x, z: f.z, inX: f.inX, inZ: f.inZ, wall });
  }
  // Cabine : on sort par les portes blindées (ouvertes) vers les couloirs.
  const off = views.OFFICE;
  off.walk = {
    bounds: [-2.35, 2.35, -2.35, 1.55],
    obstacles: OBSTACLES.OFFICE,
    doors: [
      { to: 'HALL_W', x: -2.6, z: -0.2, inX: 1, inZ: 0, side: 'W', zRange: [-0.85, 0.45] },
      { to: 'HALL_E', x: 2.6, z: -0.2, inX: -1, inZ: 0, side: 'E', zRange: [-0.85, 0.45] },
    ],
  };
  off.spots.any = { p: [0, 0, -0.5], ry: 0, clip: 'walk' };
  // Vue « conduits » : non praticable
  views.VENT.spots.any = { p: [0, 0.05, -4], ry: 0, clip: 'crawl', scale: 0.85 };
}

/** Point d'arrivée dans `room` quand on vient de `from`. */
export function arrivalIn(views, room, from) {
  const v = views[room];
  const door = v.walk.doors.find((dd) => dd.to === from) ?? v.walk.doors[0];
  const k = room === 'OFFICE' ? 0.7 : 0.9;
  return { x: door.x + door.inX * k, z: door.z + door.inZ * k, yaw: yawFor(door.inX, door.inZ) };
}

/** Déplacement avec collisions (cercle de rayon r contre la zone et les boîtes). */
export function collide(v, x, z, r = 0.3) {
  const [x0, x1, z0, z1] = v.walk.bounds;
  x = Math.max(x0, Math.min(x1, x));
  z = Math.max(z0, Math.min(z1, z));
  for (const [ax, az, bx, bz] of v.walk.obstacles) {
    const cx = Math.max(ax, Math.min(bx, x)), cz = Math.max(az, Math.min(bz, z));
    const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) { const d = Math.sqrt(d2); x = cx + (dx / d) * r; z = cz + (dz / d) * r; }
      else {
        // centre à l'intérieur de la boîte : sortie par le côté le plus proche
        const opts = [[ax - r, z, x - ax], [bx + r, z, bx - x], [x, az - r, z - az], [x, bz + r, bz - z]];
        opts.sort((a, b) => a[2] - b[2]);
        [x, z] = opts[0];
      }
    }
  }
  return [x, z];
}

/** Porte atteinte ? (le joueur est assez près du mur, dans l'encadrement) */
export function doorAt(v, x, z) {
  for (const d of v.walk.doors) {
    if (d.zRange) {
      if (z > d.zRange[0] && z < d.zRange[1] && Math.abs(x - d.x) < 0.42) return d;
      continue;
    }
    const along = d.inX !== 0 ? Math.abs(z - d.z) : Math.abs(x - d.x);
    const dist = d.inX !== 0 ? Math.abs(x - d.x) : Math.abs(z - d.z);
    if (along < 0.5 && dist < 0.55) return d;
  }
  return null;
}
