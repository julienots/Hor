import * as THREE from 'three';
import { buildWorld, fragmentMesh } from './world.js';
import { createPost } from './post.js';
import { buildCharacter } from '../models/index.js';
import { camRoom } from '../sim/map.js';
import { addWalkData, arrivalIn, collide, doorAt } from './walk.js';

const ENEMIES = ['mc', 'mimi', 'roi', 'ruban', 'choeur'];
const QUALITY = {
  low: { pixel: 0.6, shadows: false, shadowSize: 512 },
  medium: { pixel: 0.85, shadows: true, shadowSize: 1024 },
  high: { pixel: 1, shadows: true, shadowSize: 2048 },
};

/**
 * Moteur de rendu du jeu : une scène unique contenant toutes les salles,
 * dont une seule est visible à la fois (cabine ou caméra).
 */
export class GameRenderer {
  constructor(container, settings) {
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2('#050406', 0.05);
    this.scene.background = new THREE.Color('#000000');
    this.views = buildWorld();
    addWalkData(this.views);
    for (const v of Object.values(this.views)) { this.scene.add(v.group); v.group.visible = false; }
    this.office = this.views.OFFICE;
    this.officeCam = this.office.cam;
    // Jeu de lumières partagé : toujours 2 projecteurs + 2 ponctuelles + ambiance.
    this.L = {
      s0: new THREE.SpotLight('#fff', 0), s1: new THREE.SpotLight('#fff', 0),
      p0: new THREE.PointLight('#fff', 0), p1: new THREE.PointLight('#fff', 0),
      amb: new THREE.HemisphereLight('#fff', '#000', 0.2),
      flash: new THREE.SpotLight('#fff4dc', 0, 16, 0.42, 0.55, 1.2), // lampe torche (exploration)
    };
    for (const l of Object.values(this.L)) this.scene.add(l);
    this.scene.add(this.L.s0.target, this.L.s1.target, this.L.flash.target);
    // Caméra du joueur à pied
    this.exploreCam = new THREE.PerspectiveCamera(72, 16 / 9, 0.05, 60);
    this.explore = null;
    this.L.s0.castShadow = true;
    this.L.s0.shadow.bias = -0.0005;
    this.L.s0.shadow.normalBias = 0.02;
    this.post = createPost(this.renderer);
    // Mascottes
    this.chars = {};
    for (const k of ENEMIES) { this.chars[k] = buildCharacter(k); this.chars[k].root.visible = false; this.scene.add(this.chars[k].root); }
    this.charRoom = {};
    // Fragment secret
    this.fragment = fragmentMesh();
    this.fragment.visible = false;
    this.scene.add(this.fragment);
    this.view = null;
    this.yaw = 0;
    this.targetYaw = 0;
    this.time = 0;
    this.shake = 0;
    this.flash = 0;
    this.static = 0;
    this.dark = 0;
    this.jumpscare = null;
    this.raycaster = new THREE.Raycaster();
    this.applyQuality();
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  applyQuality() {
    const q = QUALITY[this.settings.quality] ?? QUALITY.medium;
    this.q = q;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2) * q.pixel);
    this.renderer.shadowMap.enabled = q.shadows;
    this.L.s0.shadow.mapSize.set(q.shadowSize, q.shadowSize);
    if (this.L.s0.shadow.map) { this.L.s0.shadow.map.dispose(); this.L.s0.shadow.map = null; }
    this.scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.needsUpdate = true; }); } });
    this.resize();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    this.post.setSize(Math.floor(w * pr), Math.floor(h * pr));
    const aspect = w / h;
    // FOV horizontal constant (~100°) : en portrait, on voit autant de la cabine
    const hfov = 100;
    const vfov = THREE.MathUtils.clamp((2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(hfov / 2)) / aspect) * 180) / Math.PI, 55, 105);
    this.exploreCam.aspect = aspect;
    this.exploreCam.fov = THREE.MathUtils.clamp(vfov * 0.92, 55, 100);
    this.exploreCam.updateProjectionMatrix();
    for (const v of Object.values(this.views)) {
      v.cam.aspect = aspect;
      v.cam.fov = v.id === 'OFFICE' ? vfov : THREE.MathUtils.clamp(vfov * 0.95, 55, 100);
      v.cam.updateProjectionMatrix();
    }
  }

  /** Active une vue : rend sa salle visible et applique son éclairage. */
  setView(id) {
    if (this.view?.id === id) return;
    if (this.view) this.view.group.visible = false;
    this.view = this.views[id];
    this.view.group.visible = true;
    const o = this.view.group.position;
    const cfg = this.view.lights;
    for (const k of ['s0', 's1']) {
      const l = this.L[k], c = cfg[k];
      l.position.set(o.x + c.p[0], o.y + c.p[1], o.z + c.p[2]);
      l.target.position.set(o.x + c.t[0], o.y + c.t[1], o.z + c.t[2]);
      const office = this.view.id === 'OFFICE';
      l.color.set(c.c); l.angle = c.a; l.penumbra = c.pen; l.distance = c.d * (office ? 1 : 1.5); l.decay = office ? 1.6 : 1.0;
      l.userData.base = c.i * (office ? 1 : 4);
      l.intensity = l.userData.base;
    }
    for (const k of ['p0', 'p1']) {
      const l = this.L[k], c = cfg[k];
      l.position.set(o.x + c.p[0], o.y + c.p[1], o.z + c.p[2]);
      const office = this.view.id === 'OFFICE';
      l.color.set(c.c); l.distance = c.d * (office ? 1 : 1.5); l.decay = office ? 1.6 : 1.0;
      l.userData.base = c.i * (office ? 1 : 4);
      l.intensity = l.userData.base;
    }
    this.L.amb.color.set(cfg.amb.sky); this.L.amb.groundColor.set(cfg.amb.ground);
    this.L.amb.userData.base = cfg.amb.i * (this.view.id === 'OFFICE' ? 1 : 2.2);
    this.scene.fog.color.set(this.view.fog.color);
    this.scene.fog.density = this.view.fog.density;
    this.post.uniforms.uNight.value = this.view.night ? 1 : 0;
  }

  /** Met à jour l'éclairage de la cabine selon l'état (lumières de porte, panne). */
  updateOfficeLights(o, flick) {
    const cfg = this.office.lights;
    const out = o.powerOut;
    const black = o.blackout > 0;
    this.L.s0.intensity = o.lightW && !out && !black ? 26 * flick : 0;
    this.L.s1.intensity = o.lightE && !out && !black ? 26 * flick : 0;
    this.L.p0.intensity = out || black ? 0 : cfg.p0.i * flick;
    this.L.p1.intensity = out ? 0 : cfg.p1.i;
    this.L.amb.intensity = out ? 0.03 : cfg.amb.i;
    this.office.lamp.userData.bulb.material.emissiveIntensity = out || black ? 0 : 2 * flick;
    if (this.jumpscare) {
      // lumière de face, vacillante, pour révéler le visage pendant le jumpscare
      const j = this.jumpscare, c = this.officeCam;
      this.L.s0.position.set(c.position.x, c.position.y + 0.5, c.position.z + 0.2);
      this.L.s0.target.position.copy(j.ch.root.position).add(j.parent.position).add(new THREE.Vector3(0, j.headY, 0));
      this.L.s0.angle = 0.8; this.L.s0.distance = 6; this.L.s0.decay = 1;
      this.L.s0.color.set('#ffd0a0');
      this.L.s0.intensity = 6 * (0.6 + Math.random() * 0.4);
    }
  }

  /** Place chaque mascotte à l'emplacement correspondant à sa salle. */
  placeEnemies(sim, hiddenForLoop) {
    for (const k of ENEMIES) {
      const e = sim.enemies[k];
      const ch = this.chars[k];
      if (!e.active || sim.outcome === 'dead') { ch.root.visible = false; continue; }
      let viewId = e.room, spotKey = k;
      if (e.room.startsWith('DOOR_') || e.room === 'VENT_MOUTH') { viewId = 'OFFICE'; spotKey = e.room; }
      if (k === 'mimi' && e.room === 'VENT') spotKey = e.depth === 1 ? 'mimi1' : 'mimi2';
      const v = this.views[viewId];
      const spot = v?.spots[spotKey] ?? v?.spots.any;
      if (!spot) { ch.root.visible = false; continue; }
      const key = viewId + spotKey;
      if (this.charRoom[k] !== key) {
        this.charRoom[k] = key;
        (spot.parent ?? v.group).add(ch.root);
        ch.root.position.set(...spot.p);
        // décalage si deux mascottes partagent la même porte
        if (k === 'choeur' && viewId === 'OFFICE') ch.root.position.z += 0.5;
        if (!v.spots[spotKey]) ch.root.position.x += (ENEMIES.indexOf(k) - 2) * 0.9; // emplacement générique
        ch.root.rotation.set(0, spot.ry, 0);
        ch.root.scale.setScalar(spot.scale ?? 1);
      }
      const clip = e.pose === 'frozen' ? 'frozen' : e.pose === 'stunned' ? 'stunned' : e.pose === 'sabotage' && ch.rig.has('sabotage') ? 'sabotage' : spot.clip;
      if (!this.chasing?.has(k)) ch.rig.play(clip);
      ch.root.visible = !hiddenForLoop;
    }
  }

  update(dt, sim) {
    this.time += dt;
    const t = this.time;
    const o = sim?.office;
    // Animation des mascottes visibles uniquement
    for (const ch of Object.values(this.chars)) if (ch.root.visible && ch.root.parent?.visible !== false) ch.rig.update(dt);
    for (const u of this.view?.updaters ?? []) u(t, dt, o);
    // Scintillement des lumières
    const fl = this.view?.lights.flicker ?? 0;
    const flick = fl > 0 && Math.sin(t * 13.7) * Math.sin(t * 7.3 + 1) > 1 - fl * 0.3 ? 0.35 : 1;
    if (this.view?.id === 'OFFICE' && o) {
      this.updateOfficeLights(o, flick);
    } else if (this.view) {
      for (const k of ['s0', 's1', 'p0', 'p1']) this.L[k].intensity = this.L[k].userData.base * (k === 'p0' || k === 's0' ? flick : 1);
      this.L.amb.intensity = this.L.amb.userData.base;
    }
    // Regard dans la cabine (lissage)
    this.yaw += (this.targetYaw - this.yaw) * Math.min(1, dt * 7);
    if (this.view?.id === 'OFFICE' && !this.jumpscare) {
      const c = this.officeCam;
      c.position.set(0, 1.32, 0.95);
      c.rotation.set(-0.04, this.yaw, 0, 'YXZ');
    }
    // Caméras de surveillance : léger balayage
    if (this.view && this.view.id !== 'OFFICE') {
      const c = this.view.cam;
      c.quaternion.copy(c.userData.baseQuat);
      c.rotateY(Math.sin(t * 0.25) * 0.06);
    }
    if (this.explore) this.updateExploreCam(dt, sim);
    if (this.jumpscare) this.updateJumpscare(dt);
    // Tremblement
    if (this.shake > 0 && this.settings.shake) {
      const c = this.activeCam();
      c.rotation.x += (Math.random() - 0.5) * this.shake * 0.05;
      c.rotation.z += (Math.random() - 0.5) * this.shake * 0.05;
    }
    this.shake = Math.max(0, this.shake - dt * 2);
    this.flash = Math.max(0, this.flash - dt * 3);
    this.static = Math.max(0, this.static - dt * 1.8);
    const U = this.post.uniforms;
    U.uTime.value = t;
    U.uFlash.value = this.settings.reduceFlash ? this.flash * 0.15 : this.flash;
    U.uDark.value = this.dark;
    this.fragment.rotation.y += dt * 1.5;
    this.post.render(this.scene, this.activeCam());
  }

  activeCam() {
    if (this.explore) return this.exploreCam;
    return this.view?.cam ?? this.officeCam;
  }

  /** Rendu d'une caméra : salle, parasites, image figée (Madame Ruban). */
  setCamFeed(sim, camId) {
    const room = camRoom(camId);
    this.setView(room);
    const looped = sim.isLooped(camId), offline = sim.isOffline(camId);
    const cs = sim.camState[camId];
    const disturbed = sim.time < cs.disturbUntil;
    const U = this.post.uniforms;
    U.uCam.value = 1;
    U.uLooped.value = looped ? 1 : 0;
    const base = offline ? 1 : disturbed ? 0.75 : 0.06;
    this.static = Math.max(this.static, base);
    U.uStatic.value = Math.min(1, this.static);
    this.placeEnemies(sim, looped);
    // fragment de partition
    const f = sim.fragments.find((x) => x.cam === camId);
    const v = this.views[room];
    if (f && sim.fragmentVisible(f) && v.fragment) {
      this.fragment.visible = true;
      this.fragment.position.set(v.group.position.x + v.fragment[0], v.fragment[1] + 0.15 + Math.sin(this.time * 2) * 0.03, v.group.position.z + v.fragment[2]);
      this.fragment.userData.id = f.id;
    } else this.fragment.visible = false;
  }

  setOffice(sim) {
    this.setView('OFFICE');
    const U = this.post.uniforms;
    U.uCam.value = 0;
    U.uLooped.value = 0;
    U.uStatic.value = Math.min(1, this.static);
    this.fragment.visible = false;
    if (sim) {
      this.placeEnemies(sim, false);
      const o = sim.office;
      const v = this.office;
      // portes et volet animés
      for (const side of ['W', 'E']) {
        const d = v.doors[side];
        const closed = side === 'W' ? o.doorW : o.doorE;
        const target = closed ? d.closed : d.open;
        d.group.position.y += (target - d.group.position.y) * Math.min(1, 0.25);
        v.buttons['door' + side].material.emissiveIntensity = closed ? 2.5 : 0.4;
        v.buttons['light' + side].material.emissiveIntensity = (side === 'W' ? o.lightW : o.lightE) ? 2.5 : 0.25;
      }
      const sy = o.vent ? v.shutterRange[1] : v.shutterRange[0];
      v.shutter.position.y += (sy - v.shutter.position.y) * 0.25;
      v.buttons.vent.material.emissiveIntensity = o.vent ? 2.5 : 0.5;
      v.ventLamp.material.emissive.set(sim.enemies.mimi.room === 'VENT_MOUTH' ? '#ff2020' : '#20ff60');
      v.ventLamp.material.emissiveIntensity = o.powerOut ? 0 : 1.5;
      for (const s of v.screens) s.material.emissiveIntensity = o.powerOut ? 0 : 0.6 + Math.random() * 0.4;
      v.clockHand.rotation.z = -(sim.time / sim.hourSeconds) * (Math.PI * 2 / 12);
      for (const r of v.reels) r.rotation.y += 0.05;
    }
  }

  /** Lancer le jumpscare : la mascotte surgit devant la caméra du joueur (cabine ou exploration). */
  startJumpscare(who) {
    if (!this.explore) this.setView('OFFICE');
    const parent = this.explore ? this.view.group : this.office.group;
    const ch = this.chars[who];
    parent.add(ch.root);
    this.charRoom[who] = 'JUMPSCARE';
    ch.root.visible = true;
    ch.root.scale.setScalar(1);
    const yaw = this.explore ? this.explore.yaw : this.yaw;
    ch.root.rotation.set(0, yaw, 0);
    ch.rig.play('jumpscare', { fade: 0.05, restart: true });
    ch.rig.update(0.15);
    const dist = { mc: 0.72, mimi: 0.55, roi: 1.25, ruban: 0.68, choeur: 1.15 }[who] ?? 0.8;
    this.jumpscare = { who, t: 0, ch, dist, yaw, parent };
    this.frameJumpscare(1);
    this.shake = 1.5;
    this.flash = 0.7;
  }

  camWorldPos() {
    if (!this.explore) return new THREE.Vector3(0, 1.32, 0.95);
    const o = this.view.group.position;
    return new THREE.Vector3(o.x + this.explore.x, 1.6, o.z + this.explore.z);
  }

  // Place la mascotte pour que sa tête soit juste devant l'objectif (cadrage robuste).
  frameJumpscare(k) {
    const j = this.jumpscare;
    const fwd = new THREE.Vector3(-Math.sin(j.yaw), 0, -Math.cos(j.yaw));
    j.ch.root.updateMatrixWorld(true);
    const head = j.ch.rig.joints.head.getWorldPosition(new THREE.Vector3());
    const rootW = j.ch.root.getWorldPosition(new THREE.Vector3());
    const offset = head.sub(rootW);
    const d = j.dist + (1 - k) * 0.6;
    const want = this.camWorldPos().addScaledVector(fwd, d).add(new THREE.Vector3(0, -0.12, 0)).sub(offset).sub(j.parent.position);
    if (k >= 1 && j.t === 0) j.ch.root.position.copy(want);
    else j.ch.root.position.lerp(want, 0.5);
    j.headY = offset.y;
  }

  updateJumpscare(dt) {
    const j = this.jumpscare;
    j.t += dt;
    if (!this.explore) {
      const c = this.officeCam;
      c.position.set(0, 1.32, 0.95);
      c.rotation.set(-0.04, this.yaw, 0, 'YXZ');
    } else {
      this.explore.pitch *= 0.8;
    }
    this.frameJumpscare(Math.min(1, j.t / 0.25));
    this.shake = Math.max(this.shake, 0.8);
  }

  endJumpscare() {
    if (!this.jumpscare) return;
    const view = this.view; this.view = null; this.setView(view.id); // restaure l'éclairage
    this.jumpscare.ch.root.visible = false;
    this.charRoom[this.jumpscare.who] = null;
    this.jumpscare = null;
  }

  /** Lance un rayon depuis l'écran ; renvoie le nom du bouton cliqué. */
  pick(x, y) {
    const ndc = new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.activeCam());
    const targets = [];
    if (this.view?.id === 'OFFICE') this.office.group.traverse((o) => { if (o.name?.startsWith('btn_')) targets.push(o); });
    if (this.fragment.visible) targets.push(this.fragment.children[0]);
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    return hit?.object.name ?? null;
  }

  /** Petites anomalies de décor qui changent entre deux observations. */
  rollAnomaly(roomId, rng = Math.random) {
    const v = this.views[roomId];
    if (!v?.anomalies.length) return;
    for (const a of v.anomalies) a(rng() < 0.18);
  }

  /** Rendu d'une scène de vitrine (menu, dossiers) avec une mascotte. */
  showcase(key, clip = 'idle') {
    this.setView('STAGE');
    for (const k of ENEMIES) this.chars[k].root.visible = false;
    const ch = this.chars[key];
    const v = this.views.STAGE;
    v.group.add(ch.root);
    this.charRoom[key] = 'SHOWCASE';
    ch.root.position.set(0, 0.8, -2.9);
    ch.root.rotation.set(0, 0, 0);
    ch.root.scale.setScalar(1);
    ch.root.visible = true;
    ch.rig.play(clip, { fade: 0.3 });
    const cam = v.cam;
    const o = v.group.position;
    this.showcaseState = { key, cam, o, ch };
  }

  updateShowcase(dt, orbit = 0.3) {
    const s = this.showcaseState;
    if (!s) return;
    const t = this.time;
    const h = s.ch.height;
    const r = 2.2 + h * 0.9;
    const a = Math.sin(t * 0.15) * orbit + 0.25;
    s.cam.position.set(s.o.x + Math.sin(a) * r, s.o.y + 0.8 + h * 0.6, s.o.z - 2.9 + Math.cos(a) * r);
    s.cam.lookAt(s.o.x, s.o.y + 0.8 + h * 0.5, s.o.z - 2.9);
    s.cam.userData.baseQuat = s.cam.quaternion.clone();
  }

  // ------------------------------------------------------------------
  // EXPLORATION À PIED
  // ------------------------------------------------------------------
  startExplore(room, x, z, yaw) {
    this.explore = { room, x, z, yaw, pitch: 0, bob: 0, moving: 0 };
    this.chasing = new Set();
    this.post.uniforms.uCam.value = 0;
    this.post.uniforms.uLooped.value = 0;
    this.post.uniforms.uNight.value = 0;
    this.setView(room);
  }

  stopExplore() {
    this.explore = null;
    this.chasing = new Set();
    this.L.flash.intensity = 0;
    this.fragment.visible = false;
  }

  /** Passe dans la salle reliée par une porte. */
  enterRoom(room, from) {
    const a = arrivalIn(this.views, room, from);
    Object.assign(this.explore, { room, x: a.x, z: a.z, yaw: a.yaw, pitch: 0 });
    for (const k of ENEMIES) this.charRoom[k] = null;
    this.chasing = new Set();
    this.setView(room);
  }

  /** Déplacement du joueur (vitesse en m/s dans le repère de la caméra). Renvoie une porte atteinte. */
  walk(dt, fwd, side, speed) {
    const e = this.explore;
    const v = this.views[e.room];
    const sin = Math.sin(e.yaw), cos = Math.cos(e.yaw);
    const dx = (-sin * fwd + cos * side) * speed * dt;
    const dz = (-cos * fwd - sin * side) * speed * dt;
    [e.x, e.z] = collide(v, e.x + dx, e.z + dz);
    e.moving = Math.hypot(fwd, side) * speed;
    return doorAt(v, e.x, e.z);
  }

  look(dyaw, dpitch) {
    const e = this.explore;
    if (!e) return;
    e.yaw += dyaw;
    e.pitch = Math.max(-1.2, Math.min(1.1, e.pitch + dpitch));
  }

  updateExploreCam(dt, sim) {
    const e = this.explore;
    const o = this.view.group.position;
    e.bob += dt * e.moving * 3.2;
    const c = this.exploreCam;
    if (!this.jumpscare) {
      c.position.set(o.x + e.x, 1.6 + Math.sin(e.bob) * 0.035 * Math.min(1, e.moving), o.z + e.z);
      c.rotation.set(e.pitch, e.yaw, Math.sin(e.bob * 0.5) * 0.008, 'YXZ');
    }
    // lampe torche accrochée à la caméra
    const on = sim?.player.flashlight ? 1 : 0; // la lampe a sa propre pile
    const f = this.L.flash;
    f.position.copy(c.position).add(new THREE.Vector3(0.15, -0.2, 0).applyQuaternion(c.quaternion));
    f.target.position.copy(c.position).add(new THREE.Vector3(0, 0, -5).applyQuaternion(c.quaternion));
    f.intensity = on * (14 + Math.random() * (sim?.office.power < 15 ? 8 : 0.6));
    if (!sim) return;
    // Qui le joueur regarde-t-il ? (cône de 22°, 11 m)
    let looking = null, best = 0.38;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion);
    const tmp = new THREE.Vector3();
    for (const k of ENEMIES) {
      const ch = this.chars[k];
      if (!ch.root.visible || sim.enemies[k].room !== e.room) continue;
      ch.rig.joints.chest.getWorldPosition(tmp).sub(c.position);
      const dist = tmp.length();
      if (dist > 11) continue;
      const ang = fwd.angleTo(tmp.normalize());
      if (ang < best) { best = ang; looking = k; }
    }
    sim.player.looking = looking;
    // Les mascottes qui t'ont repéré se tournent vers toi et avancent
    const p = sim.player;
    for (const k of ENEMIES) {
      const en = sim.enemies[k];
      const ch = this.chars[k];
      const chase = en.room === e.room && ch.root.visible && !this.jumpscare && en.pose !== 'frozen' && (en.state === 'hunt' || (p.threat === k && p.detection > 0.35));
      if (!chase) { if (this.chasing.has(k)) { this.chasing.delete(k); this.charRoom[k] = null; } continue; }
      this.chasing.add(k);
      const r = ch.root;
      const dx = e.x - r.position.x, dz = e.z - r.position.z;
      const d = Math.hypot(dx, dz);
      r.rotation.y = Math.atan2(dx, dz);
      const speed = (en.state === 'hunt' ? 1.25 : 0.7) * (k === 'roi' ? 0.7 : 1);
      if (d > 1.1) {
        r.position.x += (dx / d) * speed * dt;
        r.position.z += (dz / d) * speed * dt;
        r.position.y = k === 'mc' && e.room === 'STAGE' && r.position.z < -1.4 ? 0.8 : 0;
        ch.rig.play('walk');
      } else ch.rig.play('attack');
    }
    // Fragment de partition posé dans la salle
    const frag = sim.fragments.find((fr) => sim.hour >= fr.from && sim.hour < fr.to && camRoom(fr.cam) === e.room);
    const v = this.view;
    if (frag && v.fragment) {
      this.fragment.visible = true;
      this.fragment.position.set(o.x + v.fragment[0], v.fragment[1] + 0.15 + Math.sin(this.time * 2) * 0.03, o.z + v.fragment[2]);
      this.fragment.userData.id = frag.id;
      this.fragment.userData.near = Math.hypot(v.fragment[0] - e.x, v.fragment[2] - e.z) < 1.4;
    } else { this.fragment.visible = false; this.fragment.userData.near = false; }
  }

  resetCameras() {
    this.stopExplore();
    // restaure les caméras de salle après la vitrine
    this.views.STAGE.cam.position.set(this.views.STAGE.group.position.x + 4.2, 3.6, this.views.STAGE.group.position.z + 3.8);
    this.views.STAGE.cam.lookAt(this.views.STAGE.group.position.x - 0.5, 1.1, this.views.STAGE.group.position.z - 2.4);
    this.views.STAGE.cam.userData.baseQuat = this.views.STAGE.cam.quaternion.clone();
    for (const k of ENEMIES) this.charRoom[k] = null;
    this.showcaseState = null;
  }
}
