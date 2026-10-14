import * as THREE from 'three';
import { createRng } from '../sim/rng.js';

// ---------------------------------------------------------------------------
// Textures procédurales : peinture écaillée, rouille, tissu, plastique jauni…
// Chaque texture est peinte une seule fois sur un canvas puis mise en cache.
// ---------------------------------------------------------------------------
const cache = new Map();
const SIZE = 512;

function canvas(w = SIZE, h = SIZE) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Bruit de valeur lissé (fbm) écrit dans un tableau, utilisé comme base organique.
function fbm(w, h, seed, octaves = 4, scale = 6) {
  const rng = createRng(seed);
  const grids = [];
  for (let o = 0; o < octaves; o++) {
    const n = Math.round(scale * 2 ** o) + 1;
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = rng.next();
    grids.push({ n, g });
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0, amp = 1, tot = 0;
      for (const { n, g } of grids) {
        const fx = (x / w) * (n - 1), fy = (y / h) * (n - 1);
        const ix = Math.floor(fx), iy = Math.floor(fy);
        const tx = fx - ix, ty = fy - iy;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const i0 = iy * n + ix;
        const a = g[i0], b = g[i0 + 1] ?? a, c = g[i0 + n] ?? a, d = g[i0 + n + 1] ?? a;
        v += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
        tot += amp; amp *= 0.5;
      }
      out[y * w + x] = v / tot;
    }
  }
  return out;
}

const hex = (c) => new THREE.Color(c);
const mix = (a, b, t) => a.clone().lerp(b, t);

function toTexture(c, srgb = true, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

/**
 * Surface peinte usée : couleur de base, éclats laissant voir l'apprêt ou le métal,
 * coulures de rouille, crasse et rayures. Renvoie { map, bump, rough }.
 */
export function wornPaint({ base = '#a33', under = '#8a8478', rust = 0.4, grime = 0.5, chips = 0.5, scratches = 40, stripes = null, seed = 1, repeat = 1 } = {}) {
  const key = JSON.stringify(arguments[0] ?? {});
  if (cache.has(key)) return cache.get(key);
  const rng = createRng(seed * 7919);
  const W = SIZE;
  const col = canvas(), bmp = canvas(), rgh = canvas();
  const cc = col.getContext('2d'), bc = bmp.getContext('2d'), rc = rgh.getContext('2d');
  const noise = fbm(W, W, seed, 5, 5);
  const noise2 = fbm(W, W, seed + 11, 3, 14);
  const B = hex(base), U = hex(under), R = hex('#6b3410'), R2 = hex('#a4561c'), G = hex('#2a2218');
  const img = cc.createImageData(W, W), bimg = bc.createImageData(W, W), rimg = rc.createImageData(W, W);
  const stripeCol = stripes ? hex(stripes.color) : null;
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const n = noise[i], n2 = noise2[i];
      let c = B.clone();
      if (stripeCol && Math.floor((x + y * (stripes.diag ? 1 : 0)) / stripes.width) % 2 === 0) c = stripeCol.clone();
      // variation de teinte + décoloration
      c.offsetHSL(0, -0.08 * n2, (n - 0.5) * 0.12);
      // éclats de peinture : seuil sur le bruit
      const chip = n2 > 1 - chips * 0.45 && n > 0.45;
      let h = 0.6;
      if (chip) {
        const r = n * rust;
        c = mix(U, mix(R, R2, n2), Math.min(1, r * 1.6));
        h = 0.35;
      }
      // crasse dans les creux
      const g = Math.max(0, (0.55 - n) * 2) * grime;
      c = mix(c, G, g * 0.7);
      const k = i * 4;
      img.data[k] = c.r * 255; img.data[k + 1] = c.g * 255; img.data[k + 2] = c.b * 255; img.data[k + 3] = 255;
      const hv = (h + n * 0.25) * 255;
      bimg.data[k] = bimg.data[k + 1] = bimg.data[k + 2] = hv; bimg.data[k + 3] = 255;
      const rv = (chip ? 0.85 : 0.45 + g * 0.4 + n2 * 0.1) * 255;
      rimg.data[k] = rimg.data[k + 1] = rimg.data[k + 2] = rv; rimg.data[k + 3] = 255;
    }
  }
  cc.putImageData(img, 0, 0); bc.putImageData(bimg, 0, 0); rc.putImageData(rimg, 0, 0);
  // coulures de rouille verticales
  for (let s = 0; s < 18 * rust; s++) {
    const x = rng.range(0, W), y = rng.range(0, W * 0.7), len = rng.range(30, 160);
    const gr = cc.createLinearGradient(x, y, x, y + len);
    gr.addColorStop(0, 'rgba(120,55,15,0.55)'); gr.addColorStop(1, 'rgba(120,55,15,0)');
    cc.fillStyle = gr; cc.fillRect(x - 2, y, rng.range(2, 6), len);
  }
  // rayures fines
  for (let s = 0; s < scratches; s++) {
    const x = rng.range(0, W), y = rng.range(0, W), a = rng.range(0, Math.PI), l = rng.range(10, 70);
    for (const [ctx, style] of [[cc, 'rgba(220,210,190,0.35)'], [bc, 'rgba(0,0,0,0.8)']]) {
      ctx.strokeStyle = style; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
  }
  // traces de doigts (empreintes huileuses)
  for (let s = 0; s < 4; s++) {
    const x = rng.range(40, W - 40), y = rng.range(40, W - 40);
    for (let r = 4; r < 16; r += 3) {
      cc.strokeStyle = 'rgba(30,25,20,0.08)'; cc.lineWidth = 1.2;
      cc.beginPath(); cc.ellipse(x, y, r, r * 1.3, 0.3, 0, Math.PI * 2); cc.stroke();
    }
  }
  const res = { map: toTexture(col, true, repeat), bump: toTexture(bmp, false, repeat), rough: toTexture(rgh, false, repeat) };
  cache.set(key, res);
  return res;
}

/** Tissu poussiéreux avec trame, coutures et taches. */
export function dustyFabric({ base = '#6a2a5a', seam = '#e9d8b0', stains = 0.5, plaid = null, seed = 3, repeat = 1 } = {}) {
  const key = 'fab' + JSON.stringify(arguments[0] ?? {});
  if (cache.has(key)) return cache.get(key);
  const rng = createRng(seed * 31);
  const W = SIZE;
  const col = canvas(), bmp = canvas();
  const cc = col.getContext('2d'), bc = bmp.getContext('2d');
  const noise = fbm(W, W, seed, 4, 6);
  const img = cc.createImageData(W, W), bimg = bc.createImageData(W, W);
  const B = hex(base), P = plaid ? hex(plaid) : null, D = hex('#8a7d66');
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x, n = noise[i];
      const weave = ((x % 4 < 2) ^ (y % 4 < 2)) ? 0.06 : -0.06;
      let c = B.clone();
      if (P && ((Math.floor(x / 48) + Math.floor(y / 48)) % 2 === 0)) c = mix(c, P, 0.35);
      c.offsetHSL(0, -0.1 * n, weave + (n - 0.5) * 0.15);
      c = mix(c, D, Math.max(0, n - 0.6) * stains * 1.5); // poussière
      const k = i * 4;
      img.data[k] = c.r * 255; img.data[k + 1] = c.g * 255; img.data[k + 2] = c.b * 255; img.data[k + 3] = 255;
      const hv = (0.5 + weave * 2 + n * 0.2) * 255;
      bimg.data[k] = bimg.data[k + 1] = bimg.data[k + 2] = hv; bimg.data[k + 3] = 255;
    }
  }
  cc.putImageData(img, 0, 0); bc.putImageData(bimg, 0, 0);
  // coutures (points de couture)
  for (let s = 0; s < 3; s++) {
    const y0 = rng.range(30, W - 30), wob = rng.range(5, 25);
    cc.strokeStyle = seam; cc.lineWidth = 3; cc.setLineDash([8, 6]);
    bc.strokeStyle = '#000'; bc.lineWidth = 4; bc.setLineDash([]);
    for (const ctx of [cc, bc]) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 8) ctx.lineTo(x, y0 + Math.sin(x * 0.02 + s) * wob);
      ctx.stroke();
    }
    cc.setLineDash([]);
  }
  // taches sombres
  for (let s = 0; s < 8 * stains; s++) {
    const x = rng.range(0, W), y = rng.range(0, W), r = rng.range(10, 50);
    const g = cc.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(40,30,20,0.35)'); g.addColorStop(1, 'rgba(40,30,20,0)');
    cc.fillStyle = g; cc.beginPath(); cc.arc(x, y, r, 0, Math.PI * 2); cc.fill();
  }
  const res = { map: toTexture(col, true, repeat), bump: toTexture(bmp, false, repeat) };
  cache.set(key, res);
  return res;
}

/** Plastique ou porcelaine jaunie et fissurée. */
export function yellowedPlastic({ base = '#efe3c8', cracks = 10, seed = 5, blush = null } = {}) {
  const key = 'pl' + JSON.stringify(arguments[0] ?? {});
  if (cache.has(key)) return cache.get(key);
  const rng = createRng(seed * 13);
  const W = SIZE;
  const col = canvas(), bmp = canvas();
  const cc = col.getContext('2d'), bc = bmp.getContext('2d');
  const noise = fbm(W, W, seed, 4, 4);
  const img = cc.createImageData(W, W), bimg = bc.createImageData(W, W);
  const B = hex(base), Y = hex('#c9a85a');
  for (let i = 0; i < W * W; i++) {
    const n = noise[i];
    const c = mix(B, Y, Math.max(0, n - 0.45) * 0.9);
    const k = i * 4;
    img.data[k] = c.r * 255; img.data[k + 1] = c.g * 255; img.data[k + 2] = c.b * 255; img.data[k + 3] = 255;
    bimg.data[k] = bimg.data[k + 1] = bimg.data[k + 2] = 200; bimg.data[k + 3] = 255;
  }
  cc.putImageData(img, 0, 0); bc.putImageData(bimg, 0, 0);
  if (blush) {
    for (const x of [W * 0.25, W * 0.75]) {
      const g = cc.createRadialGradient(x, W * 0.6, 0, x, W * 0.6, W * 0.12);
      g.addColorStop(0, blush); g.addColorStop(1, 'rgba(0,0,0,0)');
      cc.fillStyle = g; cc.fillRect(0, 0, W, W);
    }
  }
  // fissures ramifiées
  const crack = (x, y, a, len, depth) => {
    for (const [ctx, st, lw] of [[cc, 'rgba(50,35,20,0.75)', 1.4], [bc, 'rgba(0,0,0,1)', 2.2]]) {
      ctx.strokeStyle = st; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x, y);
      let cx = x, cy = y;
      for (let s = 0; s < len; s += 6) { cx += Math.cos(a) * 6; cy += Math.sin(a) * 6; a += rng.range(-0.5, 0.5); ctx.lineTo(cx, cy); }
      ctx.stroke();
    }
    if (depth > 0) crack(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5, a + rng.range(-1, 1), len * 0.6, depth - 1);
  };
  for (let s = 0; s < cracks; s++) crack(rng.range(0, W), rng.range(0, W), rng.range(0, Math.PI * 2), rng.range(30, 120), 2);
  const res = { map: toTexture(col), bump: toTexture(bmp, false) };
  cache.set(key, res);
  return res;
}

/** Visage peint sur canvas (yeux, bouche, fissures), appliqué sur la face avant d'une tête. */
export function paintedFace(draw, key) {
  if (cache.has('face' + key)) return cache.get('face' + key);
  const c = canvas(512, 512);
  const ctx = c.getContext('2d');
  draw(ctx, 512);
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  cache.set('face' + key, t);
  return t;
}

// ---------------------------------------------------------------------------
// Matériaux
// ---------------------------------------------------------------------------
export function mat(tex, { metal = 0.1, rough = 0.7, bump = 0.015, color = 0xffffff, emissive = null, side = THREE.FrontSide } = {}) {
  const m = new THREE.MeshStandardMaterial({
    color, map: tex?.map ?? null, bumpMap: tex?.bump ?? null, bumpScale: bump,
    roughnessMap: tex?.rough ?? null, roughness: rough, metalness: metal, side,
  });
  if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = 1; }
  return m;
}

export const glowMat = (color, intensity = 2) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(color), emissiveIntensity: intensity, roughness: 0.3 });

// ---------------------------------------------------------------------------
// Géométries
// ---------------------------------------------------------------------------

/** Volume de révolution à partir d'un profil [[rayon, hauteur], …]. */
export function lathe(profile, segments = 28, phiStart = 0, phiLength = Math.PI * 2) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y));
  const g = new THREE.LatheGeometry(pts, segments, phiStart, phiLength);
  g.computeVertexNormals();
  return g;
}

/** Bosselage : déplace légèrement les sommets selon un bruit pour casser la perfection des formes. */
export function dent(geo, amount = 0.01, seed = 1) {
  const rng = createRng(seed);
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const bumps = Array.from({ length: 6 }, () => ({ p: new THREE.Vector3(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)), s: rng.range(-1, 1) }));
  const v = new THREE.Vector3();
  // Les sommets aux mêmes coordonnées (coutures) reçoivent le même décalage.
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let d = 0;
    const vn = v.clone().normalize();
    for (const b of bumps) d += b.s * Math.max(0, vn.dot(b.p.clone().normalize()) - 0.6);
    d += Math.sin(v.x * 37.1 + v.y * 21.7 + v.z * 13.3) * 0.15;
    pos.setXYZ(i, v.x + nrm.getX(i) * d * amount, v.y + nrm.getY(i) * d * amount, v.z + nrm.getZ(i) * d * amount);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Segment de membre effilé, origine en haut, s'étend vers -Y. */
export function limb(len, r1, r2, seg = 14) {
  const g = lathe([[0, 0], [r1 * 0.7, -0.01], [r1, -len * 0.08], [(r1 + r2) / 2 * 1.05, -len * 0.5], [r2, -len * 0.92], [r2 * 0.6, -len], [0, -len - 0.001]], seg);
  return g;
}

/** Tube le long d'une courbe. */
export function tube(points, radius = 0.02, seg = 24, radial = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))));
  return new THREE.TubeGeometry(curve, seg, radius, radial, false);
}

/** Engrenage extrudé avec moyeu. */
export function gear({ teeth = 12, r = 0.3, depth = 0.05, tooth = 0.05, hole = 0.08, spokes = 4 } = {}) {
  const shape = new THREE.Shape();
  const steps = teeth * 4;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const phase = i % 4;
    const rr = phase === 1 || phase === 2 ? r + tooth : r;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  const h = new THREE.Path();
  h.absarc(0, 0, hole, 0, Math.PI * 2, true);
  shape.holes.push(h);
  // évidements entre les rayons
  if (spokes > 0 && r > hole * 2.5) {
    for (let s = 0; s < spokes; s++) {
      const a0 = (s / spokes) * Math.PI * 2 + 0.25, a1 = ((s + 1) / spokes) * Math.PI * 2 - 0.25;
      const p = new THREE.Path();
      const ri = hole * 1.6, ro = r * 0.78;
      p.moveTo(Math.cos(a0) * ri, Math.sin(a0) * ri);
      p.absarc(0, 0, ro, a0, a1, false);
      p.lineTo(Math.cos(a1) * ri, Math.sin(a1) * ri);
      p.absarc(0, 0, ri, a1, a0, true);
      shape.holes.push(p);
    }
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Bande de ruban (géométrie déformable) le long d'une suite de points. */
export function ribbonGeo(n = 30, len = 1.2, width = 0.08) {
  const g = new THREE.PlaneGeometry(width, len, 1, n);
  g.translate(0, -len / 2, 0);
  g.userData.rest = g.attributes.position.array.slice();
  return g;
}

/** Boîte arrondie simple (biseau par sphérisation). */
export function roundedBox(w, h, d, r = 0.03, seg = 3) {
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
  const pos = g.attributes.position;
  const v = new THREE.Vector3(), inner = new THREE.Vector3();
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    inner.set(THREE.MathUtils.clamp(v.x, -hx, hx), THREE.MathUtils.clamp(v.y, -hy, hy), THREE.MathUtils.clamp(v.z, -hz, hz));
    const dir = v.clone().sub(inner);
    if (dir.lengthSq() > 0) dir.normalize().multiplyScalar(r);
    pos.setXYZ(i, inner.x + dir.x, inner.y + dir.y, inner.z + dir.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Crée un mesh qui projette et reçoit les ombres. */
export function mesh(geo, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, name = '' } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  if (Array.isArray(s)) m.scale.set(...s); else m.scale.setScalar(s);
  m.castShadow = true;
  m.receiveShadow = true;
  if (name) m.name = name;
  return m;
}

/** Articulation (os) du rig : simple Object3D nommé, position de repos mémorisée. */
export function joint(name, parent, x = 0, y = 0, z = 0) {
  const j = new THREE.Object3D();
  j.name = name;
  j.position.set(x, y, z);
  parent.add(j);
  return j;
}

/** Petit boulon/rivet décoratif. */
export function rivets(parent, material, points, r = 0.012) {
  const g = new THREE.SphereGeometry(r, 6, 4);
  for (const p of points) parent.add(mesh(g, material, { x: p[0], y: p[1], z: p[2] }));
}

/** Rotule mécanique visible (sphère + bague) placée à une articulation. */
export function balljoint(parent, r, metalMat) {
  parent.add(mesh(new THREE.SphereGeometry(r, 14, 10), metalMat));
  parent.add(mesh(new THREE.TorusGeometry(r * 1.05, r * 0.18, 6, 16), metalMat, { rx: Math.PI / 2 }));
}
