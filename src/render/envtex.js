import * as THREE from 'three';
import { createRng } from '../sim/rng.js';

// Textures d'environnement peintes par programme (papier peint, sols, affiches originales).
const cache = new Map();
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, rep = [1, 1], srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...rep);
  t.anisotropy = 4;
  return t;
}
function grime(ctx, w, h, rng, n = 40, alpha = 0.25) {
  for (let i = 0; i < n; i++) {
    const x = rng.range(0, w), y = rng.range(0, h), r = rng.range(10, 90);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(25,18,10,${alpha * rng.range(0.3, 1)})`); g.addColorStop(1, 'rgba(25,18,10,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // coulures d'humidité
  for (let i = 0; i < n / 4; i++) {
    const x = rng.range(0, w), l = rng.range(40, h * 0.6);
    const g = ctx.createLinearGradient(x, 0, x, l);
    g.addColorStop(0, `rgba(40,30,15,${alpha})`); g.addColorStop(1, 'rgba(40,30,15,0)');
    ctx.fillStyle = g; ctx.fillRect(x, 0, rng.range(3, 12), l);
  }
}

/** Papier peint rayé de fête fané, avec bordure et taches. */
export function wallpaper(a = '#5a2a3a', b = '#7a4a2a', seed = 1, rep = [3, 1]) {
  const key = `wp${a}${b}${seed}`;
  if (cache.has(key)) return cache.get(key);
  const rng = createRng(seed);
  const c = cv(512, 512), x = c.getContext('2d');
  for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? a : b; x.fillRect(i * 32, 0, 32, 512); }
  // motif d'étoiles et de losanges
  x.fillStyle = 'rgba(230,200,120,0.25)';
  for (let i = 0; i < 16; i++) for (let j = 0; j < 8; j++) {
    const cx = i * 32 + 16, cy = j * 64 + (i % 2) * 32 + 16;
    x.beginPath(); x.moveTo(cx, cy - 8); x.lineTo(cx + 5, cy); x.lineTo(cx, cy + 8); x.lineTo(cx - 5, cy); x.fill();
  }
  // soubassement en bois
  x.fillStyle = '#3a2418'; x.fillRect(0, 380, 512, 132);
  x.fillStyle = '#5a3a20'; x.fillRect(0, 372, 512, 10);
  for (let i = 0; i < 512; i += 64) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(i, 382, 2, 130); }
  grime(x, 512, 512, rng, 50, 0.35);
  // papier décollé
  for (let i = 0; i < 6; i++) {
    const px = rng.range(0, 480), py = rng.range(0, 330);
    x.fillStyle = 'rgba(200,190,160,0.5)';
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + rng.range(10, 40), py + rng.range(5, 20)); x.lineTo(px + rng.range(0, 20), py + rng.range(20, 50)); x.fill();
  }
  const t = tex(c, rep);
  cache.set(key, t);
  return t;
}

/** Murs de béton ou de carrelage industriel. */
export function concrete(base = '#4a4a48', seed = 2, rep = [2, 1], tiles = false) {
  const key = `cc${base}${seed}${tiles}`;
  if (cache.has(key)) return cache.get(key);
  const rng = createRng(seed);
  const c = cv(512, 512), x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(${rng.next() > 0.5 ? '255,255,255' : '0,0,0'},${rng.range(0.02, 0.08)})`; x.fillRect(rng.range(0, 512), rng.range(0, 512), rng.range(1, 4), rng.range(1, 4)); }
  if (tiles) {
    x.strokeStyle = 'rgba(20,20,20,0.6)'; x.lineWidth = 3;
    for (let i = 0; i <= 512; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke(); }
  }
  grime(x, 512, 512, rng, 40, 0.4);
  const t = tex(c, rep);
  cache.set(key, t);
  return t;
}

/** Sol : damier losange, moquette à confettis ou plaques métalliques. */
export function floorTex(kind = 'diamond', seed = 3, rep = [4, 4]) {
  const key = `fl${kind}${seed}`;
  if (cache.has(key)) return cache.get(key);
  const rng = createRng(seed);
  const c = cv(512, 512), x = c.getContext('2d');
  if (kind === 'diamond') {
    x.fillStyle = '#2a2622'; x.fillRect(0, 0, 512, 512);
    for (let i = -1; i < 9; i++) for (let j = -1; j < 9; j++) {
      x.fillStyle = (i + j) % 2 ? '#6a2a2a' : '#c8b88a';
      const cx = i * 64 + (j % 2) * 32, cy = j * 64;
      x.beginPath(); x.moveTo(cx, cy - 32); x.lineTo(cx + 32, cy); x.lineTo(cx, cy + 32); x.lineTo(cx - 32, cy); x.fill();
    }
  } else if (kind === 'carpet') {
    x.fillStyle = '#2a1a3a'; x.fillRect(0, 0, 512, 512);
    const cols = ['#e0c040', '#40a0c0', '#c04060', '#60c060', '#e07030'];
    for (let i = 0; i < 400; i++) { x.fillStyle = rng.pick(cols); x.globalAlpha = 0.6; x.save(); x.translate(rng.range(0, 512), rng.range(0, 512)); x.rotate(rng.range(0, 6)); x.fillRect(-4, -2, 8, 4); x.restore(); }
    x.globalAlpha = 1;
  } else if (kind === 'metal') {
    x.fillStyle = '#3a3836'; x.fillRect(0, 0, 512, 512);
    x.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 512; i += 16) for (let j = 0; j < 512; j += 16) { x.save(); x.translate(i + 8, j + 8); x.rotate(((i + j) / 16) % 2 ? 0.8 : -0.8); x.fillRect(-5, -1.5, 10, 3); x.restore(); }
  } else {
    x.fillStyle = '#d8d0c0'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#bfb6a2' : '#e2dccd'; x.fillRect(i * 64, j * 64, 64, 64); }
  }
  grime(x, 512, 512, rng, 60, 0.45);
  const t = tex(c, rep);
  cache.set(key, t);
  return t;
}

/** Affiches originales du Carnaval des Veilleurs. */
export function poster(kind = 'parade', seed = 4, variant = 0) {
  const key = `po${kind}${seed}${variant}`;
  if (cache.has(key)) return cache.get(key);
  const rng = createRng(seed);
  const c = cv(256, 384), x = c.getContext('2d');
  const bg = { parade: '#2a3a6a', mimi: '#6a2a4a', roi: '#4a2a5a', safety: '#d8c060', drawing: '#efe8d8', ruban: '#1a4a4a', choeur: '#3a2a1a' }[kind] ?? '#333';
  x.fillStyle = bg; x.fillRect(0, 0, 256, 384);
  x.textAlign = 'center';
  if (kind === 'drawing') {
    // dessin d'enfant au crayon : mascottes souriantes… sauf une
    x.lineWidth = 4; x.lineCap = 'round';
    const cols = ['#d03030', '#3050c0', '#30a040', '#e0a020'];
    for (let i = 0; i < 3; i++) {
      x.strokeStyle = cols[i]; const cx = 50 + i * 78, cy = 200;
      x.beginPath(); x.arc(cx, cy - 50, 26, 0, Math.PI * 2); x.stroke();
      x.beginPath(); x.moveTo(cx, cy - 24); x.lineTo(cx, cy + 50); x.moveTo(cx - 30, cy); x.lineTo(cx + 30, cy); x.moveTo(cx, cy + 50); x.lineTo(cx - 20, cy + 90); x.moveTo(cx, cy + 50); x.lineTo(cx + 20, cy + 90); x.stroke();
      x.beginPath(); x.arc(cx, cy - 46, 12, 0.2, Math.PI - 0.2, variant === 1 && i === 1); x.stroke();
      x.fillStyle = '#111'; x.fillRect(cx - 10, cy - 60, 5, 5); x.fillRect(cx + 5, cy - 60, 5, 5);
    }
    x.fillStyle = '#3050c0'; x.font = 'bold 22px sans-serif';
    x.fillText(variant === 1 ? 'ILS ME REGARDENT' : 'MES AMIS DU CARNAVAL', 128, 60);
  } else if (kind === 'safety') {
    x.fillStyle = '#111'; x.font = 'bold 26px sans-serif';
    x.fillText('CONSIGNES', 128, 50);
    x.font = '15px sans-serif';
    ['Ne pas toucher aux', 'mascottes après 23 h.', '', 'Signaler tout', 'déplacement anormal.', '', 'Ne JAMAIS couper', 'le générateur.', '', '— La Direction'].forEach((l, i) => x.fillText(l, 128, 100 + i * 24));
  } else {
    // affiche de spectacle : rayons, étoiles, titre et silhouette
    for (let i = 0; i < 18; i++) { x.fillStyle = i % 2 ? 'rgba(255,220,120,0.12)' : 'rgba(0,0,0,0.1)'; x.beginPath(); x.moveTo(128, 200); x.arc(128, 200, 400, (i / 18) * Math.PI * 2, ((i + 1) / 18) * Math.PI * 2); x.fill(); }
    x.fillStyle = '#f0d060'; x.font = 'bold 30px Georgia, serif';
    const titles = { parade: ['LA PARADE', 'DES VEILLEURS'], mimi: ['MIMI', '& SES FILS'], roi: ['LE ROI DES', 'ROUAGES'], ruban: ['MADAME', 'RUBAN'], choeur: ['LE GRAND', 'CHŒUR'] }[kind] ?? ['CARNAVAL', ''];
    x.fillText(titles[0], 128, 50); x.fillText(titles[1], 128, 84);
    // silhouette de mascotte
    x.fillStyle = 'rgba(10,5,10,0.85)';
    x.beginPath(); x.ellipse(128, 190, 42, 46, 0, 0, Math.PI * 2); x.fill();
    x.fillRect(96, 230, 64, 100);
    if (kind === 'parade') { x.fillRect(100, 110, 56, 40); x.fillRect(82, 146, 92, 8); }
    if (kind === 'roi') for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(98 + i * 15, 142, 9, 0, Math.PI * 2); x.fill(); }
    if (kind === 'mimi') { x.fillRect(80, 140, 14, 70); x.fillRect(162, 140, 14, 70); }
    // yeux
    x.fillStyle = variant === 1 ? '#ff2020' : '#fff';
    x.beginPath(); x.arc(112, 185, 8, 0, Math.PI * 2); x.arc(144, 185, 8, 0, Math.PI * 2); x.fill();
    if (variant === 1) { x.fillStyle = '#fff'; x.fillRect(100, 205, 56, 6); }
    x.fillStyle = '#f0d060'; x.font = '16px Georgia, serif';
    x.fillText('Chaque soir à 19 h', 128, 350);
    x.fillText('Carnaval des Veilleurs', 128, 372);
  }
  grime(x, 256, 384, rng, 14, 0.4);
  // coins déchirés
  x.globalCompositeOperation = 'destination-out';
  x.beginPath(); x.moveTo(256, 0); x.lineTo(210 + rng.range(0, 30), 0); x.lineTo(256, 40 + rng.range(0, 30)); x.fill();
  x.globalCompositeOperation = 'source-over';
  const t = tex(c);
  cache.set(key, t);
  return t;
}

/** Texte peint sur une bannière. */
export function banner(text, bg = '#8a1a2a', fg = '#f0d060') {
  const key = `bn${text}${bg}`;
  if (cache.has(key)) return cache.get(key);
  const c = cv(1024, 128), x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 1024, 128);
  x.fillStyle = fg; x.font = 'bold 70px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 512, 68);
  grime(x, 1024, 128, createRng(text.length), 20, 0.5);
  const t = tex(c);
  cache.set(key, t);
  return t;
}
