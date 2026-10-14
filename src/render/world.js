import * as THREE from 'three';
import { mesh, tube, roundedBox, dent, lathe, glowMat, mat, wornPaint } from '../models/kit.js';
import { wallpaper, concrete, floorTex, banner } from './envtex.js';
import { M, initPropMaterials, table, chair, partyHat, balloon, cake, crate, shelf, posterMesh, hangingLamp, pipeRun, generator } from './props.js';

// ---------------------------------------------------------------------------
// Construction du bâtiment : la cabine (vue joueur) et les salles des caméras.
// Chaque « vue » possède son groupe, sa caméra, sa configuration d'éclairage
// (appliquée à un jeu de lumières partagé, pour éviter les recompilations de
// shaders) et des emplacements pour les mascottes.
// ---------------------------------------------------------------------------

function surface(map, rough = 0.9, color = 0xffffff) {
  return new THREE.MeshStandardMaterial({ map, roughness: rough, color });
}

/** Coquille de salle : sol, plafond et murs tournés vers l'intérieur. */
function shell(g, { w, d, h, wall, floor, ceil = '#141012', skip = [] }) {
  const fl = mesh(new THREE.PlaneGeometry(w, d), floor, { rx: -Math.PI / 2 });
  fl.castShadow = false;
  g.add(fl);
  const ce = mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: ceil, roughness: 1 }), { y: h, rx: Math.PI / 2 });
  ce.castShadow = false;
  g.add(ce);
  const walls = [
    ['back', w, [0, h / 2, -d / 2], 0],
    ['front', w, [0, h / 2, d / 2], Math.PI],
    ['left', d, [-w / 2, h / 2, 0], Math.PI / 2],
    ['right', d, [w / 2, h / 2, 0], -Math.PI / 2],
  ];
  for (const [name, len, p, ry] of walls) {
    if (skip.includes(name)) continue;
    const m = wall.clone();
    if (m.map) { m.map = m.map.clone(); m.map.repeat.set(len / 3, 1); m.map.needsUpdate = true; }
    const wm = mesh(new THREE.PlaneGeometry(len, h), m, { x: p[0], y: p[1], z: p[2], ry });
    wm.castShadow = false;
    g.add(wm);
  }
}

function makeView(id, origin, { camPos, camLook, fov = 70 }) {
  const group = new THREE.Group();
  group.name = id;
  group.position.set(...origin);
  const cam = new THREE.PerspectiveCamera(fov, 16 / 9, 0.05, 60);
  cam.position.set(origin[0] + camPos[0], origin[1] + camPos[1], origin[2] + camPos[2]);
  cam.lookAt(origin[0] + camLook[0], origin[1] + camLook[1], origin[2] + camLook[2]);
  cam.userData.baseQuat = cam.quaternion.clone();
  return { id, group, cam, spots: {}, anomalies: [], updaters: [], lights: null, fog: { color: '#050406', density: 0.06 } };
}

// Configuration d'éclairage compacte : s = projecteurs, p = ponctuelles.
const L = (o) => ({
  s0: { p: [0, 3, 0], t: [0, 0, 0], c: '#ffe0b0', i: 0, a: 0.6, pen: 0.5, d: 14, ...o.s0 },
  s1: { p: [0, 3, 0], t: [0, 0, 0], c: '#ffe0b0', i: 0, a: 0.6, pen: 0.5, d: 14, ...o.s1 },
  p0: { p: [0, 2.5, 0], c: '#ffd8a0', i: 0, d: 10, ...o.p0 },
  p1: { p: [0, 2.5, 0], c: '#ffd8a0', i: 0, d: 10, ...o.p1 },
  amb: { sky: '#40384a', ground: '#100808', i: 0.25, ...o.amb },
  flicker: o.flicker ?? 0,
});

// ---------------------------------------------------------------------------
// LA CABINE DE SURVEILLANCE
// ---------------------------------------------------------------------------
function buildOffice() {
  const v = makeView('OFFICE', [0, 0, 0], { camPos: [0, 1.32, 0.95], camLook: [0, 1.25, -2], fov: 70 });
  const g = v.group;
  const W = 2.6, D0 = -2.6, D1 = 1.8, H = 2.8;
  const wallMat = surface(wallpaper('#2a3a3a', '#34302a', 7), 0.9);
  const floorMat = surface(floorTex('metal', 8, [5, 5]), 0.6);
  const ceilMat = new THREE.MeshStandardMaterial({ color: '#181414', roughness: 1 });
  g.add(mesh(new THREE.PlaneGeometry(W * 2, D1 - D0), floorMat, { z: (D0 + D1) / 2, rx: -Math.PI / 2 }));
  g.add(mesh(new THREE.PlaneGeometry(W * 2, D1 - D0), ceilMat, { y: H, z: (D0 + D1) / 2, rx: Math.PI / 2 }));
  const wallSeg = (w, h, x, y, z, ry) => {
    const m = wallMat.clone();
    m.map = m.map.clone(); m.map.repeat.set(w / 3, h / H); m.map.needsUpdate = true;
    const s = mesh(new THREE.PlaneGeometry(w, h), m, { x, y, z, ry });
    s.castShadow = false;
    g.add(s);
  };
  // Murs latéraux percés d'une porte (z de -0.9 à 0.5, hauteur 2.3)
  const DZ0 = -0.9, DZ1 = 0.5, DH = 2.3;
  for (const [sx, ry] of [[-1, Math.PI / 2], [1, -Math.PI / 2]]) {
    wallSeg(DZ0 - D0, H, sx * W, H / 2, (D0 + DZ0) / 2, ry);
    wallSeg(D1 - DZ1, H, sx * W, H / 2, (DZ1 + D1) / 2, ry);
    wallSeg(DZ1 - DZ0, H - DH, sx * W, (H + DH) / 2, (DZ0 + DZ1) / 2, ry);
    // encadrement métallique
    for (const z of [DZ0, DZ1]) g.add(mesh(new THREE.BoxGeometry(0.2, DH, 0.08), M.yellow, { x: sx * W, y: DH / 2, z }));
    g.add(mesh(new THREE.BoxGeometry(0.2, 0.1, DZ1 - DZ0 + 0.08), M.yellow, { x: sx * W, y: DH + 0.05, z: (DZ0 + DZ1) / 2 }));
  }
  // Mur du fond (derrière le joueur)
  wallSeg(W * 2, H, 0, H / 2, D1, Math.PI);
  // Mur avant percé de la bouche du conduit (x de 0.9 à 1.9, y de 0.15 à 0.85)
  const VX0 = 1.5, VX1 = 2.42, VY0 = 0.2, VY1 = 1.02;
  wallSeg(W + VX0, H, (-W + VX0) / 2, H / 2, D0, 0);
  wallSeg(W - VX1, H, (VX1 + W) / 2, H / 2, D0, 0);
  wallSeg(VX1 - VX0, H - VY1, (VX0 + VX1) / 2, (H + VY1) / 2, D0, 0);
  wallSeg(VX1 - VX0, VY0, (VX0 + VX1) / 2, VY0 / 2, D0, 0);
  // cadre du conduit
  for (const x of [VX0, VX1]) g.add(mesh(new THREE.BoxGeometry(0.06, VY1 - VY0 + 0.06, 0.1), M.metal, { x, y: (VY0 + VY1) / 2, z: D0 }));
  for (const y of [VY0, VY1]) g.add(mesh(new THREE.BoxGeometry(VX1 - VX0 + 0.06, 0.06, 0.1), M.metal, { x: (VX0 + VX1) / 2, y, z: D0 }));
  // Tunnel du conduit derrière le mur
  const ductMat = surface(floorTex('metal', 12, [1, 3]), 0.5);
  const duct = new THREE.Mesh(new THREE.BoxGeometry(VX1 - VX0, VY1 - VY0, 3), ductMat);
  duct.material.side = THREE.BackSide;
  duct.position.set((VX0 + VX1) / 2, (VY0 + VY1) / 2, D0 - 1.5);
  g.add(duct);
  // Volet du conduit (grille qui descend)
  const shutter = new THREE.Group();
  shutter.position.set((VX0 + VX1) / 2, 0, D0 - 0.04); // glisse derrière le mur quand il est ouvert
  g.add(shutter);
  for (let i = 0; i < 8; i++) shutter.add(mesh(new THREE.BoxGeometry(VX1 - VX0 - 0.02, 0.09, 0.02), M.steel, { y: VY0 + 0.05 + i * 0.1, rx: 0.35 }));
  v.shutter = shutter;
  v.shutterRange = [VY1 - VY0 + 0.02, 0]; // décalage ouvert / fermé
  // Lampe d'état du conduit
  const ventLamp = mesh(new THREE.SphereGeometry(0.035, 10, 8), M.greenLamp.clone(), { x: VX1 + 0.12, y: VY1 + 0.1, z: D0 + 0.03 });
  g.add(ventLamp);
  v.ventLamp = ventLamp;

  // Portes blindées (glissent dans le plafond)
  v.doors = {};
  for (const [side, sx] of [['W', -1], ['E', 1]]) {
    const door = new THREE.Group();
    door.position.set(sx * W, 0, (DZ0 + DZ1) / 2);
    g.add(door);
    const slab = mesh(dent(roundedBox(0.12, DH, DZ1 - DZ0 - 0.05, 0.02), 0.01, 4), M.yellow, { y: DH / 2 });
    door.add(slab);
    for (let i = 0; i < 5; i++) door.add(mesh(new THREE.BoxGeometry(0.14, 0.04, DZ1 - DZ0 - 0.1), M.metal, { y: 0.3 + i * 0.42 }));
    door.add(mesh(new THREE.BoxGeometry(0.15, 0.3, 0.5), M.dark, { y: 1.7 }));
    v.doors[side] = { group: door, open: DH + 0.05, closed: 0 };
    door.position.y = DH + 0.05;
    // Couloir d'accès (court) au-delà de la porte
    const hall = new THREE.Group();
    hall.position.set(sx * (W + 2.2), 0, (DZ0 + DZ1) / 2);
    g.add(hall);
    const hw = 1.8, hd = 4.4;
    const hm = surface(concrete('#3a3634', 20 + sx, [2, 1], true), 0.95);
    hall.add(mesh(new THREE.PlaneGeometry(hd, hw), surface(floorTex('diamond', 21, [3, 1.2]), 0.8), { rx: -Math.PI / 2 }));
    hall.add(mesh(new THREE.PlaneGeometry(hd, hw), ceilMat, { y: 2.6, rx: Math.PI / 2 }));
    hall.add(mesh(new THREE.PlaneGeometry(hd, 2.6), hm, { y: 1.3, z: -hw / 2 }));
    hall.add(mesh(new THREE.PlaneGeometry(hd, 2.6), hm, { y: 1.3, z: hw / 2, ry: Math.PI }));
    hall.add(mesh(new THREE.PlaneGeometry(hw, 2.6), new THREE.MeshStandardMaterial({ color: '#050404' }), { x: sx * hd / 2, y: 1.3, ry: -sx * Math.PI / 2 }));
    const p = posterMesh(sx < 0 ? 'parade' : 'ruban', 30 + sx, 0.55);
    p.position.set(sx * 0.4, 1.5, -hw / 2 + 0.01);
    hall.add(p);
    // emplacement de la mascotte devant la porte
    v.spots['DOOR_' + side] = { parent: hall, p: [-sx * 0.75, 0, 0.05], ry: -sx * Math.PI / 2, clip: 'peek' };
  }
  // Emplacement de Mimi dans la bouche du conduit
  v.spots.VENT_MOUTH = { parent: g, p: [(VX0 + VX1) / 2, 0.22, D0 - 0.45], ry: -0.5, clip: 'ventpeek', scale: 0.9 };

  // Panneaux de commande près des portes (boutons cliquables)
  v.buttons = {};
  for (const [side, sx] of [['W', -1], ['E', 1]]) {
    const panel = new THREE.Group();
    panel.position.set(sx * (W - 0.03), 1.25, DZ1 + 0.45);
    panel.rotation.y = -sx * Math.PI / 2;
    g.add(panel);
    panel.add(mesh(roundedBox(0.36, 0.6, 0.06, 0.02), M.metal));
    const doorBtn = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 20), M.redLamp.clone(), { y: 0.13, z: 0.04, rx: Math.PI / 2 });
    const lightBtn = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 20), glowMat('#e8e8d0', 0.3), { y: -0.13, z: 0.04, rx: Math.PI / 2 });
    doorBtn.name = 'btn_door' + side; lightBtn.name = 'btn_light' + side;
    panel.add(doorBtn, lightBtn);
    v.buttons['door' + side] = doorBtn;
    v.buttons['light' + side] = lightBtn;
  }
  // Bureau et équipement
  const desk = new THREE.Group();
  desk.position.set(0, 0, -1.75);
  g.add(desk);
  desk.add(mesh(roundedBox(2.5, 0.06, 1.0, 0.02), M.wood, { y: 0.78 }));
  desk.add(mesh(new THREE.BoxGeometry(2.4, 0.75, 0.05), M.metal, { y: 0.375, z: -0.45 }));
  for (const sx of [-1, 1]) desk.add(mesh(new THREE.BoxGeometry(0.05, 0.75, 0.9), M.metal, { x: sx * 1.2, y: 0.375 }));
  // moniteurs cathodiques
  const screens = [];
  for (const [x, ry, s] of [[-0.62, 0.2, 0.95], [0.05, 0, 1.1], [0.72, -0.25, 0.85]]) {
    const crt = new THREE.Group();
    crt.position.set(x, 0.81, -0.1);
    crt.rotation.y = ry;
    crt.scale.setScalar(s);
    desk.add(crt);
    crt.add(mesh(dent(roundedBox(0.5, 0.42, 0.45, 0.04), 0.01, 2), mat(wornPaint({ base: '#c8c0a8', under: '#8a8070', rust: 0, grime: 0.8, seed: 101 }), { rough: 0.6 }), { y: 0.23 }));
    const scr = mesh(new THREE.PlaneGeometry(0.4, 0.3), M.screen.clone(), { y: 0.24, z: 0.226 });
    crt.add(scr);
    screens.push(scr);
  }
  v.screens = screens;
  // ventilateur de bureau qui tourne
  const fan = new THREE.Group();
  fan.position.set(-1.0, 0.81, 0.05);
  fan.rotation.y = 0.5;
  desk.add(fan);
  fan.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.03, 16), M.metal));
  fan.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), M.metal, { y: 0.15 }));
  const blades = new THREE.Group();
  blades.position.set(0, 0.32, 0.05);
  fan.add(blades);
  for (let i = 0; i < 3; i++) blades.add(mesh(new THREE.BoxGeometry(0.05, 0.16, 0.005), M.steel, { rz: (i / 3) * Math.PI * 2, y: 0, x: 0 }));
  blades.children.forEach((b, i) => { b.position.set(Math.cos((i / 3) * Math.PI * 2 + Math.PI / 2) * 0.07, Math.sin((i / 3) * Math.PI * 2 + Math.PI / 2) * 0.07, 0); });
  fan.add(mesh(new THREE.TorusGeometry(0.15, 0.006, 4, 24), M.metal, { y: 0.32, z: 0.05 }));
  v.updaters.push((t, dt, o) => { if (!o?.powerOut) blades.rotation.z -= dt * 18; });
  // magnétophone d'Odile
  const tape = new THREE.Group();
  tape.position.set(0.85, 0.81, 0.25);
  tape.rotation.y = -0.4;
  desk.add(tape);
  tape.add(mesh(roundedBox(0.36, 0.1, 0.22, 0.015), M.dark, { y: 0.05 }));
  const reels = [];
  for (const x of [-0.08, 0.08]) { const r = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 16), M.steel, { x, y: 0.105 }); tape.add(r); reels.push(r); }
  v.reels = reels;
  // tablette des caméras posée sur le bureau
  const tablet = mesh(roundedBox(0.5, 0.03, 0.34, 0.015), M.dark, { x: 0, y: 0.81, z: 0.25 });
  tablet.name = 'btn_cams';
  desk.add(tablet);
  desk.add(mesh(new THREE.PlaneGeometry(0.42, 0.26), M.screen, { y: 0.827, z: 0.25, rx: -Math.PI / 2 }));
  // bouton du volet du conduit
  const ventBtn = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16), glowMat('#20c0ff', 0.6), { x: 1.05, y: 0.82, z: -0.2 });
  ventBtn.name = 'btn_vent';
  desk.add(ventBtn);
  v.buttons.vent = ventBtn;
  // gobelet, papiers, peluche oubliée, cupcake moisi
  desk.add(mesh(lathe([[0, 0], [0.04, 0], [0.05, 0.11], [0.048, 0.11]], 14), M.redMetal, { x: -0.4, y: 0.81, z: 0.3 }));
  for (let i = 0; i < 4; i++) desk.add(mesh(new THREE.PlaneGeometry(0.21, 0.29), M.paper, { x: 0.45 + i * 0.05, y: 0.812 + i * 0.002, z: 0.25, rx: -Math.PI / 2, rz: i * 0.3 - 0.4 }));
  const cupcake = cake();
  cupcake.scale.setScalar(0.4);
  cupcake.position.set(-0.8, 0.81, 0.32);
  desk.add(cupcake);
  // lampe de bureau
  const dl = new THREE.Group();
  dl.position.set(-0.4, 0.81, -0.3);
  desk.add(dl);
  dl.add(mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.03, 16), M.metal));
  dl.add(mesh(tube([[0, 0, 0], [0, 0.3, -0.05], [0.12, 0.45, 0.05]], 0.012, 12, 6), M.metal));
  dl.add(mesh(lathe([[0.02, 0], [0.05, -0.02], [0.1, -0.1]], 14), M.greenLamp.clone(), { x: 0.12, y: 0.45, z: 0.05, rx: 0.6 }));
  // affiches et dessins
  const posters = [['safety', 1, [-1.3, 1.6, D0 + 0.01], 0], ['drawing', 2, [-0.3, 1.75, D0 + 0.01], 0], ['parade', 3, [1.95, 1.75, D0 + 0.01], 0], ['mimi', 4, [-W + 0.01, 1.5, -1.8], Math.PI / 2], ['roi', 5, [W - 0.01, 1.5, -1.8], -Math.PI / 2], ['choeur', 6, [-1.2, 1.5, D1 - 0.01], Math.PI]];
  for (const [k, s, p, ry] of posters) {
    const pm = posterMesh(k, s, 0.55);
    pm.position.set(...p);
    pm.rotation.y = ry;
    g.add(pm);
    if (k === 'drawing') v.anomalies.push((on) => pm.userData.setVariant(on ? 1 : 0));
  }
  // horloge murale (aiguilles animées par l'heure du jeu)
  const clock = new THREE.Group();
  clock.position.set(0.9, 2.15, D0 + 0.02);
  g.add(clock);
  clock.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 28), M.paper, { rx: Math.PI / 2 }));
  clock.add(mesh(new THREE.TorusGeometry(0.2, 0.02, 6, 28), M.redMetal));
  const hand = mesh(new THREE.BoxGeometry(0.015, 0.14, 0.01), M.dark, { y: 0.06, z: 0.03 });
  const hp = new THREE.Group(); hp.position.z = 0.0; hp.add(hand); clock.add(hp);
  v.clockHand = hp;
  // câbles au plafond et lampe suspendue
  for (let i = 0; i < 3; i++) g.add(pipeRun([[-W, 2.6 - i * 0.07, -2 + i * 0.1], [0, 2.5 - i * 0.05, -1.2], [W, 2.6 - i * 0.07, -2 + i * 0.1]], 0.025, M.rubber));
  const lamp = hangingLamp(0.6);
  lamp.position.set(0, H, -0.4);
  g.add(lamp);
  v.lamp = lamp;
  // confettis au sol
  for (let i = 0; i < 60; i++) {
    const c = mesh(new THREE.PlaneGeometry(0.03, 0.02), M.hats[i % 4], { x: Math.sin(i * 7.3) * 2.2, y: 0.003, z: Math.cos(i * 3.1) * 1.8 - 0.4, rx: -Math.PI / 2, rz: i });
    c.castShadow = false;
    g.add(c);
  }
  v.lights = L({
    s0: { p: [-W - 0.9, 2.55, (DZ0 + DZ1) / 2 + 0.6], t: [-W - 1.0, 0, (DZ0 + DZ1) / 2], c: '#fff0d0', i: 0, a: 0.75, pen: 0.4, d: 8 },
    s1: { p: [W + 0.9, 2.55, (DZ0 + DZ1) / 2 + 0.6], t: [W + 1.0, 0, (DZ0 + DZ1) / 2], c: '#fff0d0', i: 0, a: 0.75, pen: 0.4, d: 8 },
    p0: { p: [0, H - 0.75, -0.4], c: '#ffcf88', i: 5, d: 9 },
    p1: { p: [1.7, 1.1, -2.0], c: '#70ff9a', i: 1.6, d: 3.2 },
    amb: { sky: '#3a3848', ground: '#100808', i: 0.18 },
    flicker: 0.15,
  });
  v.fog = { color: '#030304', density: 0.035 };
  return v;
}

// ---------------------------------------------------------------------------
// SALLES DES CAMÉRAS
// ---------------------------------------------------------------------------
function buildStage(o) {
  const v = makeView('STAGE', o, { camPos: [4.2, 3.6, 3.8], camLook: [-0.5, 1.1, -2.4] });
  const g = v.group;
  shell(g, { w: 10, d: 9, h: 5, wall: surface(wallpaper('#3a1a3a', '#2a1a40', 31)), floor: surface(floorTex('carpet', 32, [4, 4])) });
  // estrade
  g.add(mesh(new THREE.BoxGeometry(8, 0.8, 3), M.wood, { y: 0.4, z: -3 }));
  g.add(mesh(new THREE.BoxGeometry(8, 0.1, 0.1), M.gold, { y: 0.8, z: -1.5 }));
  for (let i = 0; i < 9; i++) g.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), M.bulb, { x: -3.6 + i * 0.9, y: 0.6, z: -1.48 }));
  // rideaux ondulés
  const curtainGeo = new THREE.PlaneGeometry(2.6, 4.6, 40, 1);
  const pos = curtainGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 9) * 0.08);
  curtainGeo.computeVertexNormals();
  for (const x of [-3.7, 3.7]) g.add(mesh(curtainGeo, M.curtain, { x, y: 2.5, z: -2.0 }));
  g.add(mesh(curtainGeo, M.curtain, { x: 0, y: 2.5, z: -4.4, s: [3.2, 1, 1] }));
  const bn = mesh(new THREE.PlaneGeometry(6, 0.7), new THREE.MeshStandardMaterial({ map: banner('LA PARADE DES VEILLEURS'), roughness: 0.9 }), { y: 4.2, z: -1.9 });
  g.add(bn);
  // étoiles de décor
  for (const [x, y] of [[-2.5, 3.2], [2.5, 3.4], [0, 3.7]]) {
    const st = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.15 : 0.35, a = (i / 10) * Math.PI * 2 + Math.PI / 2; i ? st.lineTo(Math.cos(a) * r, Math.sin(a) * r) : st.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.add(mesh(new THREE.ExtrudeGeometry(st, { depth: 0.05, bevelEnabled: false }), M.gold, { x, y, z: -4.2 }));
  }
  // tables du public
  for (const [x, z] of [[-2.5, 1.2], [2.2, 1.6]]) { const t = table(1.6, 0.9); t.position.set(x, 0, z); g.add(t); const h = partyHat(x > 0 ? 1 : 2); h.position.set(x + 0.3, 0.8, z); g.add(h); }
  const c = chair(true); c.position.set(0.5, 0, 2.5); g.add(c);
  v.spots.mc = { p: [0, 0.8, -2.9], ry: 0, clip: 'present' };
  v.spots.choeur = { p: [-2.8, 0.8, -3.2], ry: 0.3, clip: 'sing' };
  v.fragment = [3.4, 0.9, -1.6];
  v.lights = L({
    s0: { p: [2, 4.8, 1], t: [0, 0.8, -2.9], c: '#ffd0a0', i: 30, a: 0.35, pen: 0.4, d: 12 },
    s1: { p: [-2.5, 4.8, 0], t: [-2.8, 0.8, -3.2], c: '#c060ff', i: 12, a: 0.4, d: 12 },
    p0: { p: [0, 1, -1.2], c: '#ffb070', i: 2.5, d: 5 },
    p1: { p: [3, 2.5, 2.5], c: '#6080ff', i: 1.5, d: 8 },
  });
  return v;
}

function buildParty(o) {
  const v = makeView('PARTY', o, { camPos: [5.3, 3.4, 3.6], camLook: [-1, 0.9, -1.5] });
  const g = v.group;
  shell(g, { w: 12, d: 8, h: 4, wall: surface(wallpaper('#5a2a2a', '#6a4a2a', 41)), floor: surface(floorTex('diamond', 42, [5, 4])) });
  for (let r = 0; r < 3; r++) {
    const t = table(3.6, 1.0);
    t.position.set(-2 + r * 0.4, 0, -2.4 + r * 2.1);
    g.add(t);
    for (let k = 0; k < 5; k++) { const h = partyHat(k + r); h.position.set(t.position.x - 1.5 + k * 0.75, 0.8, t.position.z + (k % 2 ? 0.3 : -0.3)); if ((k + r) % 3 === 0) { h.rotation.z = Math.PI / 2; h.position.y = 0.86; } g.add(h); }
    for (let k = 0; k < 4; k++) { const c = chair(r === 1 && k === 2); c.position.set(t.position.x - 1.3 + k * 0.85, 0, t.position.z + 0.75); c.rotation.y = Math.PI; g.add(c); }
    const ck = cake(); ck.position.set(t.position.x + 0.2, 0.79, t.position.z); g.add(ck);
  }
  for (let i = 0; i < 7; i++) { const b = balloon(i, i % 3 === 0); b.position.set(-5 + i * 1.5, i % 3 === 0 ? 0.25 : 3.3, -3.6 + (i % 2) * 0.4); g.add(b); }
  const bn = mesh(new THREE.PlaneGeometry(6, 0.6), new THREE.MeshStandardMaterial({ map: banner('BON ANNIVERSAIRE !', '#2a4a8a'), roughness: 0.9 }), { y: 3.2, z: -3.95 });
  g.add(bn);
  // guirlande de fanions
  for (let i = 0; i < 20; i++) g.add(mesh(new THREE.ConeGeometry(0.12, 0.25, 3), M.hats[i % 4], { x: -5.5 + i * 0.58, y: 3.6 - Math.sin((i / 19) * Math.PI) * 0.4, z: -2, rx: Math.PI }));
  const p = posterMesh('mimi', 43, 0.7); p.position.set(-5.99, 1.7, 1); p.rotation.y = Math.PI / 2; g.add(p);
  v.anomalies.push((on) => p.userData.setVariant(on ? 1 : 0));
  v.spots.mc = { p: [1.4, 0, 1.4], ry: 0.7, clip: 'idle' };
  v.spots.choeur = { p: [-4.0, 0, -0.5], ry: 0.9, clip: 'idle' };
  v.lights = L({
    s0: { p: [0, 3.9, 0.5], t: [0, 0, -0.5], c: '#ffe0b0', i: 25, a: 0.9, pen: 0.6, d: 12 },
    s1: { p: [-4.5, 3.8, 1], t: [-4, 0, -0.5], c: '#ff8060', i: 8, a: 0.5, d: 10 },
    p0: { p: [2, 2.5, 2], c: '#ffb070', i: 2, d: 8 },
    p1: { p: [-5, 2, -3], c: '#4060ff', i: 1.5, d: 6 },
    flicker: 0.3,
  });
  return v;
}

function buildLobby(o) {
  const v = makeView('LOBBY', o, { camPos: [-3.8, 3.2, 3.0], camLook: [1, 0.9, -1.5] });
  const g = v.group;
  shell(g, { w: 9, d: 7, h: 3.8, wall: surface(wallpaper('#2a3a5a', '#3a2a4a', 51)), floor: surface(floorTex('diamond', 52, [4, 3])) });
  // comptoir d'accueil
  g.add(mesh(roundedBox(3, 1.1, 0.8, 0.05), M.redMetal, { x: 1.5, y: 0.55, z: -1.8 }));
  g.add(mesh(new THREE.BoxGeometry(3.1, 0.05, 0.9), M.wood, { x: 1.5, y: 1.12, z: -1.8 }));
  const bell = mesh(lathe([[0, 0], [0.06, 0], [0.05, 0.05], [0.02, 0.08], [0, 0.09]], 14), M.gold, { x: 1, y: 1.15, z: -1.7 });
  g.add(bell);
  // étagère des lots (peluches = têtes miniatures)
  const sh = shelf(2.4, 2.4, 0.4); sh.position.set(1.5, 0, -3.2); g.add(sh);
  const heads = [];
  for (let i = 0; i < 8; i++) {
    const h = mesh(new THREE.SphereGeometry(0.13, 12, 10), M.hats[i % 4], { x: 0.5 + (i % 4) * 0.65, y: 0.42 + Math.floor(i / 4) * 0.7 + 0.12, z: -3.15 });
    g.add(h);
    for (const sx of [-1, 1]) h.add(mesh(new THREE.SphereGeometry(0.025, 6, 4), M.dark, { x: sx * 0.045, y: 0.02, z: 0.115 }));
    heads.push(h);
  }
  v.anomalies.push((on) => { heads[5].rotation.y = on ? Math.PI : 0; heads[2].rotation.z = on ? 0.6 : 0; });
  // porte d'entrée enchaînée
  for (const x of [-2.6, -1.6]) g.add(mesh(new THREE.BoxGeometry(0.95, 2.4, 0.08), M.steel, { x, y: 1.2, z: -3.45 }));
  for (let i = 0; i < 9; i++) g.add(mesh(new THREE.TorusGeometry(0.05, 0.012, 5, 10), M.metal, { x: -2.5 + i * 0.1, y: 1.15 + Math.sin(i * 0.4) * 0.05, z: -3.38, ry: i % 2 ? Math.PI / 2 : 0 }));
  g.add(mesh(roundedBox(0.12, 0.16, 0.06, 0.02), M.gold, { x: -2.1, y: 1.05, z: -3.36 }));
  // banc et guichet
  g.add(mesh(roundedBox(1.8, 0.1, 0.5, 0.02), M.wood, { x: -3.2, y: 0.45, z: 1.5, ry: Math.PI / 2 }));
  const p = posterMesh('ruban', 53, 0.7); p.position.set(4.49, 1.7, 0); p.rotation.y = -Math.PI / 2; g.add(p);
  v.spots.ruban = { p: [-1.6, 0, -1.2], ry: 0.6, clip: 'idle' };
  v.spots.choeur = { p: [2.6, 0, 0.6], ry: -0.6, clip: 'idle' };
  v.fragment = [3.6, 1.15, -1.8];
  v.lights = L({
    s0: { p: [0, 3.7, 1], t: [0, 0, -1.5], c: '#d0e0ff', i: 18, a: 0.9, d: 10 },
    s1: { p: [1.5, 3.7, -1], t: [1.5, 1, -3], c: '#ffd0a0', i: 10, a: 0.6, d: 8 },
    p0: { p: [-2.1, 2.5, -3], c: '#60a0ff', i: 1.2, d: 5 },
    p1: { p: [3, 2, 2], c: '#ff9050', i: 1, d: 6 },
    flicker: 0.2,
  });
  return v;
}

function buildKitchen(o) {
  const v = makeView('KITCHEN', o, { camPos: [3.4, 3.0, 2.6], camLook: [-0.5, 0.9, -1.2] });
  const g = v.group;
  shell(g, { w: 8, d: 6, h: 3.4, wall: surface(concrete('#8a8a80', 61, [3, 1], true)), floor: surface(floorTex('tile', 62, [5, 4])) });
  for (let i = 0; i < 4; i++) g.add(mesh(roundedBox(1.4, 0.9, 0.7, 0.03), M.steel, { x: -3 + i * 1.5, y: 0.45, z: -2.6 }));
  g.add(mesh(roundedBox(1.2, 1, 0.8, 0.04), M.dark, { x: 2.9, y: 0.5, z: -2.5 }));
  for (let i = 0; i < 4; i++) g.add(mesh(new THREE.TorusGeometry(0.12, 0.02, 6, 16), M.metal, { x: 2.6 + (i % 2) * 0.5, y: 1.02, z: -2.6 + Math.floor(i / 2) * 0.35, rx: Math.PI / 2 }));
  g.add(mesh(roundedBox(1, 2.2, 0.8, 0.05), M.steel, { x: -3.5, y: 1.1, z: 0.5, ry: Math.PI / 2 }));
  // casseroles suspendues
  const rack = new THREE.Group(); rack.position.set(0, 2.6, -1.2); g.add(rack);
  rack.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 3, 6), M.metal, { rz: Math.PI / 2 }));
  const pans = [];
  for (let i = 0; i < 6; i++) { const pan = new THREE.Group(); pan.position.x = -1.3 + i * 0.5; rack.add(pan); pan.add(mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.25, 3), M.metal, { y: -0.12 })); pan.add(mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.08, 16), M.steel, { y: -0.3 })); pans.push(pan); }
  v.updaters.push((t) => pans.forEach((p, i) => { p.rotation.z = Math.sin(t * 0.8 + i) * 0.04; }));
  // îlot central avec plateaux
  g.add(mesh(roundedBox(2.4, 0.9, 1.0, 0.03), M.steel, { x: 0, y: 0.45, z: 0.3 }));
  for (let i = 0; i < 3; i++) { const ck = cake(); ck.scale.setScalar(0.6); ck.position.set(-0.8 + i * 0.8, 0.9, 0.3); g.add(ck); }
  v.anomalies.push((on) => { rack.rotation.y = on ? 0.25 : 0; });
  v.spots.roi = { p: [0.2, 0, -1.4], ry: 0.4, clip: 'idle' };
  v.spots.choeur = { p: [2.6, 0, 1.0], ry: -1.2, clip: 'idle' };
  v.fragment = [-3.0, 0.92, -2.5];
  v.lights = L({
    s0: { p: [0, 3.3, 0.5], t: [0, 0, -1], c: '#e0ffe8', i: 20, a: 0.9, d: 9 },
    s1: { p: [2.6, 3.3, 1.5], t: [2.6, 0, 1], c: '#ffe0b0', i: 6, a: 0.6, d: 8 },
    p0: { p: [2.9, 1.2, -2.4], c: '#ff5020', i: 1.0, d: 3 },
    p1: { p: [-3, 2.5, 2], c: '#80a0ff', i: 1, d: 6 },
    flicker: 0.4,
  });
  return v;
}

function buildWorkshop(o) {
  const v = makeView('WORKSHOP', o, { camPos: [-3.3, 2.9, 2.5], camLook: [0.6, 0.9, -1.4] });
  const g = v.group;
  shell(g, { w: 8, d: 6, h: 3.2, wall: surface(concrete('#4a443a', 71, [3, 1])), floor: surface(floorTex('metal', 72, [4, 3])) });
  // établi
  g.add(mesh(roundedBox(3.2, 0.08, 1.0, 0.02), M.wood, { x: 0.5, y: 0.9, z: -2.2 }));
  for (const sx of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.08, 0.9, 0.9), M.metal, { x: 0.5 + sx * 1.5, y: 0.45, z: -2.2 }));
  // pièces de mascottes en réparation : tête, bras, œil
  const spare = mesh(new THREE.SphereGeometry(0.22, 16, 12), M.cake, { x: 1.4, y: 1.15, z: -2.3, s: [1, 1.1, 1] });
  g.add(spare);
  for (const sx of [-1, 1]) spare.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), M.dark, { x: sx * 0.08, y: 0.05, z: 0.17 }));
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.7, 10), M.metal, { x: -0.3, y: 0.97, z: -2.0, rz: Math.PI / 2, ry: 0.4 }));
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.SphereGeometry(0.035, 10, 8), glowMat('#ffb020', 0.4), { x: 0.2 + i * 0.12, y: 0.97, z: -1.9 }));
  // panneau d'outils
  g.add(mesh(new THREE.PlaneGeometry(2.4, 1.2), M.wood, { x: 0.5, y: 2.0, z: -2.98 }));
  for (let i = 0; i < 8; i++) g.add(mesh(new THREE.BoxGeometry(0.04, 0.35, 0.03), i % 2 ? M.steel : M.redMetal, { x: -0.4 + i * 0.25, y: 2.0, z: -2.95, rz: (i % 3 - 1) * 0.2 }));
  // entrée du conduit (vers la cabine)
  g.add(mesh(new THREE.BoxGeometry(1.0, 0.75, 0.05), M.dark, { x: 3.97, y: 0.6, z: 0.5, ry: Math.PI / 2 }));
  for (let i = 0; i < 4; i++) g.add(mesh(new THREE.BoxGeometry(0.05, 0.05, 1.0), M.metal, { x: 3.95, y: 0.3 + i * 0.2, z: 0.5 }));
  for (let i = 0; i < 4; i++) { const c = crate(0.5 + (i % 2) * 0.2); c.position.set(-3 + (i % 2) * 0.7, Math.floor(i / 2) * 0.6, 1.8); g.add(c); }
  v.anomalies.push((on) => { spare.rotation.y = on ? -1.2 : 0; });
  v.spots.mimi = { p: [-0.6, 0.94, -2.25], ry: 0.3, clip: 'idle' };
  v.fragment = [-3.0, 1.25, 1.8];
  v.lights = L({
    s0: { p: [0.5, 3.1, -0.8], t: [0.5, 0.9, -2.2], c: '#ffe8c0', i: 22, a: 0.6, pen: 0.5, d: 6 },
    s1: { p: [-2, 3.1, 1.5], t: [-3, 0, 1.8], c: '#a0c0ff', i: 6, a: 0.6, d: 7 },
    p0: { p: [3.5, 0.8, 0.5], c: '#40ff80', i: 0.6, d: 3 },
    p1: { p: [-1, 2, 0], c: '#ff9050', i: 0.8, d: 6 },
    flicker: 0.25,
  });
  return v;
}

function buildHall(o, side) {
  const v = makeView('HALL_' + side, o, { camPos: [0.6, 2.5, 2.4], camLook: [-0.1, 1.0, -4] , fov: 65 });
  const g = v.group;
  shell(g, { w: 2.4, d: 14, h: 2.8, wall: surface(wallpaper(side === 'W' ? '#3a2a2a' : '#2a2a3a', '#2a2420', side === 'W' ? 81 : 82, [4, 1])), floor: surface(floorTex('diamond', 83, [2, 10])) });
  for (let i = 0; i < 5; i++) {
    const kind = ['drawing', 'parade', 'safety', 'drawing', side === 'W' ? 'mimi' : 'roi'][i];
    const p = posterMesh(kind, 84 + i + (side === 'W' ? 0 : 9), 0.5);
    const sx = i % 2 ? 1 : -1;
    p.position.set(sx * 1.19, 1.5, -1 - i * 2.2);
    p.rotation.y = -sx * Math.PI / 2;
    g.add(p);
    if (kind === 'drawing' && i === 3) v.anomalies.push((on) => p.userData.setVariant(on ? 1 : 0));
  }
  for (let i = 0; i < 3; i++) { const l = hangingLamp(0.25); l.position.set(0, 2.8, -1.5 - i * 4); g.add(l); }
  g.add(pipeRun([[1.1, 2.6, 6], [1.1, 2.6, -7]], 0.05));
  const ch = chair(true); ch.position.set(-0.7, 0, -6); g.add(ch);
  if (side === 'W') {
    v.spots.mc = { p: [-0.2, 0, -2.6], ry: 0, clip: 'lean' };
    v.spots.choeur = { p: [0.2, 0, -5.5], ry: 0, clip: 'idle' };
  } else {
    v.spots.roi = { p: [0, 0, -5], ry: 0, clip: 'idle' };
    v.spots.ruban = { p: [-0.35, 0, -2.4], ry: 0.2, clip: 'idle' };
    v.spots.choeur = { p: [0.3, 0, -7.5], ry: 0, clip: 'idle' };
  }
  v.lights = L({
    s0: { p: [0, 2.7, -1.5], t: [0, 0, -2.6], c: '#ffe0b0', i: 14, a: 0.9, pen: 0.6, d: 7 },
    s1: { p: [0, 2.7, -5.5], t: [0, 0, -6], c: '#ffc080', i: 7, a: 0.9, pen: 0.6, d: 6 },
    p0: { p: [0, 2.3, -9.5], c: '#ff4040', i: 0.8, d: 6 },
    p1: { p: [0, 1.5, 1.5], c: '#6070ff', i: 0.5, d: 4 },
    flicker: 0.6,
  });
  v.fog = { color: '#040306', density: 0.12 };
  return v;
}

function buildVent(o) {
  const v = makeView('VENT', o, { camPos: [0.35, 0.8, 1.2], camLook: [0, 0.4, -6], fov: 75 });
  const g = v.group;
  const dm = surface(floorTex('metal', 91, [1, 6]), 0.4);
  dm.metalness = 0.6;
  const duct = mesh(new THREE.BoxGeometry(1.2, 1.0, 14), dm, { y: 0.5, z: -5 });
  duct.material = dm.clone(); duct.material.side = THREE.BackSide;
  g.add(duct);
  for (let i = 0; i < 12; i++) g.add(mesh(new THREE.TorusGeometry(0.62, 0.025, 4, 4), M.metal, { y: 0.5, z: 1 - i * 1.1, rz: Math.PI / 4, s: [1.15, 0.95, 1] }));
  // poussière et ressorts arrachés
  for (let i = 0; i < 8; i++) g.add(mesh(new THREE.SphereGeometry(0.05, 6, 4), M.dark, { x: Math.sin(i) * 0.4, y: 0.02, z: -i * 1.4, s: [2, 0.3, 1.5] }));
  v.spots.mimi1 = { p: [0, 0.05, -7.5], ry: 0, clip: 'crawl', scale: 0.85 };
  v.spots.mimi2 = { p: [0.05, 0.05, -2.8], ry: 0, clip: 'crawl', scale: 0.85 };
  v.lights = L({
    s0: { p: [0.3, 0.95, 1.0], t: [0, 0.2, -5], c: '#a0ffb0', i: 8, a: 0.5, pen: 0.8, d: 12 },
    s1: { p: [0, 0.9, -6], t: [0, 0, -7.5], c: '#40ff80', i: 0, a: 0.6, d: 4 },
    p0: { p: [0, 0.8, -4], c: '#305040', i: 0.6, d: 5 },
    p1: { p: [0, 0.8, -9], c: '#304050', i: 0.4, d: 5 },
    amb: { sky: '#203028', ground: '#050505', i: 0.15 },
  });
  v.fog = { color: '#010302', density: 0.16 };
  v.night = true; // vision nocturne
  return v;
}

function buildGenerator(o) {
  const v = makeView('GENERATOR', o, { camPos: [-3.8, 3.2, 2.8], camLook: [0.8, 0.9, -1.2] });
  const g = v.group;
  shell(g, { w: 9, d: 7, h: 3.8, wall: surface(concrete('#3a3a36', 101, [3, 1])), floor: surface(floorTex('metal', 102, [4, 3])) });
  const gen = generator(); gen.position.set(1.2, 0, -2.0); g.add(gen);
  v.gen = gen;
  v.updaters.push((t, dt, o) => { gen.userData.fan.rotation.z += dt * (o?.powerOut ? 0 : 10); });
  // armoires électriques
  for (let i = 0; i < 4; i++) {
    g.add(mesh(roundedBox(0.8, 1.9, 0.4, 0.02), M.metal, { x: -3.8 + i * 0.9, y: 0.95, z: -3.25 }));
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.25, 0.04), M.redMetal, { x: -3.6 + i * 0.9, y: 1.3, z: -3.03 }));
  }
  g.add(mesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshStandardMaterial({ map: banner('DANGER — HAUTE TENSION', '#d8b030', '#1a1a1a'), roughness: 0.8 }), { x: -2.4, y: 2.4, z: -3.44 }));
  for (let i = 0; i < 6; i++) g.add(pipeRun([[-4.5, 3.3 - i * 0.08, -3.3 + i * 0.05], [0, 3.4 - i * 0.05, -3], [4.5, 3.2 - i * 0.08, -2.5]], 0.03, M.rubber));
  v.spots.roi = { p: [0.0, 0, -0.5], ry: Math.PI * 0.85, clip: 'sabotage' };
  v.fragment = [-3.5, 1.95, -3.2];
  v.lights = L({
    s0: { p: [-1, 3.7, 1.5], t: [0.5, 0, -1], c: '#ffe8a0', i: 20, a: 0.8, d: 10 },
    s1: { p: [2, 3.7, 0], t: [1.2, 1, -2], c: '#ff8040', i: 8, a: 0.5, d: 8 },
    p0: { p: [1.2, 1.8, -1.2], c: '#40ff80', i: 1.2, d: 4 },
    p1: { p: [-3, 2, -2.5], c: '#ff3020', i: 0.8, d: 4 },
    flicker: 0.35,
  });
  return v;
}

function buildBackstage(o) {
  const v = makeView('BACKSTAGE', o, { camPos: [2.9, 2.8, 2.4], camLook: [-0.6, 1.0, -1.3] });
  const g = v.group;
  shell(g, { w: 7, d: 6, h: 3.2, wall: surface(wallpaper('#4a2a2a', '#2a2a2a', 111)), floor: surface(floorTex('carpet', 112, [3, 3])) });
  // portants de costumes
  for (const z of [-1.6, 0.4]) {
    g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.4, 6), M.metal, { x: -1.8, y: 1.8, z, rz: Math.PI / 2 }));
    for (const x of [-3, -0.6]) g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 6), M.metal, { x, y: 0.9, z }));
    for (let i = 0; i < 6; i++) g.add(mesh(new THREE.PlaneGeometry(0.4, 1.1, 1, 6), i % 2 ? M.curtain : M.cloth, { x: -2.8 + i * 0.4, y: 1.2, z, ry: Math.PI / 2 + (i - 3) * 0.1 }));
  }
  // coiffeuse à miroir et ampoules
  g.add(mesh(roundedBox(1.6, 0.05, 0.5, 0.01), M.wood, { x: 1.4, y: 0.8, z: -2.7 }));
  g.add(mesh(new THREE.PlaneGeometry(1.2, 0.9), new THREE.MeshStandardMaterial({ color: '#202830', metalness: 1, roughness: 0.15 }), { x: 1.4, y: 1.5, z: -2.98 }));
  for (let i = 0; i < 6; i++) g.add(mesh(new THREE.SphereGeometry(0.04, 8, 6), i === 4 ? M.dark : M.bulb, { x: 0.7 + i * 0.28, y: 2.0, z: -2.95 }));
  // casier d'Odile avec photo
  g.add(mesh(roundedBox(0.6, 1.9, 0.5, 0.02), M.metal, { x: 3.15, y: 0.95, z: -1.2, ry: -Math.PI / 2 }));
  g.add(mesh(new THREE.PlaneGeometry(0.15, 0.2), M.paper, { x: 2.89, y: 1.5, z: -1.2, ry: -Math.PI / 2 }));
  // têtes de rechange sur étagère : l'une regarde la caméra quand elle change
  const sh = shelf(1.8, 1.6, 0.4); sh.position.set(-2.2, 0, -2.75); g.add(sh);
  const spareHeads = [];
  for (let i = 0; i < 3; i++) { const h = mesh(new THREE.SphereGeometry(0.17, 14, 10), M.hats[i], { x: -2.8 + i * 0.6, y: 0.75, z: -2.7 }); g.add(h); spareHeads.push(h); h.add(mesh(new THREE.SphereGeometry(0.04, 6, 4), M.dark, { x: 0.05, z: 0.15 })); h.add(mesh(new THREE.SphereGeometry(0.04, 6, 4), M.dark, { x: -0.05, z: 0.15 })); }
  v.anomalies.push((on) => { spareHeads[1].rotation.y = on ? 0.9 : 0; spareHeads[1].rotation.x = on ? 0.4 : 0; });
  v.spots.choeur = { p: [0.8, 0, -0.6], ry: -0.4, clip: 'idle' };
  v.fragment = [1.9, 0.85, -2.6];
  v.lights = L({
    s0: { p: [1.4, 3.1, -1.4], t: [1.4, 0.8, -2.7], c: '#ffd890', i: 16, a: 0.7, d: 6 },
    s1: { p: [-1.8, 3.1, 1.2], t: [-1.8, 0, -0.6], c: '#c080ff', i: 7, a: 0.7, d: 7 },
    p0: { p: [1.4, 2.0, -2.6], c: '#ffd890', i: 1.4, d: 3 },
    p1: { p: [2.8, 2.2, 1.8], c: '#ff6060', i: 0.6, d: 5 },
    flicker: 0.2,
  });
  return v;
}

/** Fragment de partition doré (secret à collectionner). */
export function fragmentMesh() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 160;
  const x = c.getContext('2d');
  x.fillStyle = '#e8c860'; x.fillRect(0, 0, 128, 160);
  x.strokeStyle = '#5a3a10'; x.lineWidth = 2;
  for (let s = 0; s < 3; s++) for (let l = 0; l < 5; l++) { x.beginPath(); x.moveTo(8, 25 + s * 45 + l * 6); x.lineTo(120, 25 + s * 45 + l * 6); x.stroke(); }
  x.fillStyle = '#3a2008';
  for (let n = 0; n < 12; n++) { x.beginPath(); x.ellipse(16 + n * 9, 30 + (n % 3) * 45 + ((n * 7) % 5) * 4, 4, 3, -0.4, 0, Math.PI * 2); x.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({ map: t, emissive: new THREE.Color('#ffb020'), emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide });
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.28), m);
  p.name = 'fragment';
  g.add(p);
  g.userData.mat = m;
  return g;
}

export function buildWorld() {
  initPropMaterials();
  const views = {};
  views.OFFICE = buildOffice();
  const rooms = [buildStage, buildParty, buildLobby, buildKitchen, buildWorkshop, (o) => buildHall(o, 'W'), (o) => buildHall(o, 'E'), buildVent, buildGenerator, buildBackstage];
  rooms.forEach((b, i) => { const v = b([60 + (i % 5) * 40, 0, Math.floor(i / 5) * 40 - 20]); views[v.id] = v; });
  return views;
}
