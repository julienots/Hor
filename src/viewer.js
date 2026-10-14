// Visionneuse de développement : /viewer.html?m=mc&clip=idle&a=0.4&t=1
import * as THREE from 'three';
import { buildCharacter } from './models/index.js';

const q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1a1820');
const cam = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.05, 50);
const key = new THREE.SpotLight('#ffe2b0', 60, 12, 0.6, 0.5);
key.position.set(2, 4, 3);
key.castShadow = true;
scene.add(key, new THREE.HemisphereLight('#8090b0', '#201010', 0.6));
const rim = new THREE.DirectionalLight('#6080ff', 1.2);
rim.position.set(-3, 2, -3);
scene.add(rim);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ color: '#3a3438' }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const ch = buildCharacter(q.get('m') ?? 'mc');
scene.add(ch.root);
ch.root.rotation.y = Number(q.get('a') ?? 0);
ch.rig.play(q.get('clip') ?? 'idle', { fade: 0 });
const zoom = Number(q.get('z') ?? 1);
const h = ch.height;
const focusY = Number(q.get('fy') ?? h * 0.55);
cam.position.set(0, focusY, (h * 1.9) / zoom);
cam.lookAt(0, focusY, 0);
// Avance l'animation à l'instant t (pour des captures déterministes).
const t0 = Number(q.get('t') ?? 0);
for (let i = 0; i < t0 * 30; i++) ch.rig.update(1 / 30);
let last = performance.now();
const still = q.has('still');
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!still) ch.rig.update(dt);
  renderer.render(scene, cam);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.__ready = true;
