// Moteur audio 100 % synthétisé (Web Audio). Aucun son externe n'est utilisé.
// Spatialisation : W = gauche, E = droite, C = conduit devant/bas, far = lointain.

const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);

export class AudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.loops = {};
  }

  // Le contexte audio ne peut démarrer qu'après une interaction de l'utilisateur.
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -10; comp.ratio.value = 4;
    this.master.connect(comp).connect(c.destination);
    this.bus = {};
    for (const k of ['amb', 'sfx', 'scare', 'music', 'voice']) { this.bus[k] = c.createGain(); this.bus[k].connect(this.master); }
    // réverbération courte (couloirs) par convolution d'un bruit décroissant
    this.reverb = c.createConvolver();
    const len = c.sampleRate * 1.8, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; }
    this.reverb.buffer = ir;
    this.revGain = c.createGain(); this.revGain.gain.value = 0.35;
    this.reverb.connect(this.revGain).connect(this.bus.sfx);
    this.noiseBuf = this.makeNoise('white');
    this.brownBuf = this.makeNoise('brown');
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = this.settings;
    this.master.gain.value = s.volMaster;
    this.bus.amb.gain.value = s.volAmbience;
    this.bus.sfx.gain.value = s.volSfx;
    this.bus.scare.gain.value = s.volScare;
    this.bus.music.gain.value = s.volMusic;
    this.bus.voice.gain.value = s.volSfx * 0.8;
  }

  makeNoise(kind) {
    const c = this.ctx, len = c.sampleRate * 3, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }

  // ---------- primitives ----------
  out(side = 'far', bus = 'sfx', vol = 1, { reverb = 0, speaker = false } = {}) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = vol;
    let node = g;
    const pan = c.createStereoPanner();
    pan.pan.value = side === 'W' ? -0.85 : side === 'E' ? 0.85 : 0;
    if (side === 'C') { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; node.connect(lp); node = lp; }
    if (side === 'far') { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; node.connect(lp); node = lp; reverb = Math.max(reverb, 0.6); g.gain.value = vol * 0.6; }
    if (speaker) {
      // haut-parleur : bande passante étroite + saturation
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 1.2;
      const ws = c.createWaveShaper(); ws.curve = this.distCurve(30);
      node.connect(bp); bp.connect(ws); node = ws;
    }
    node.connect(pan);
    pan.connect(this.bus[bus]);
    if (reverb > 0) { const s = c.createGain(); s.gain.value = reverb; pan.connect(s); s.connect(this.reverb); }
    return g;
  }

  distCurve(k) {
    const n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x)); }
    return curve;
  }

  noise(dest, t0, dur, { type = 'bandpass', freq = 1000, q = 1, gain = 0.5, attack = 0.005, freqEnd = null, brown = false, rate = 1 } = {}) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = brown ? this.brownBuf : this.noiseBuf;
    src.playbackRate.value = rate;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t0, Math.random() * 2);
    src.stop(t0 + dur + 0.05);
    return { src, f, g };
  }

  tone(dest, t0, dur, { type = 'sine', freq = 440, freqEnd = null, gain = 0.3, attack = 0.005, detune = 0, vibrato = 0, vibRate = 5 } = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t0); o.detune.value = detune;
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    if (vibrato) { const l = c.createOscillator(); const lg = c.createGain(); l.frequency.value = vibRate; lg.gain.value = vibrato; l.connect(lg).connect(o.frequency); l.start(t0); l.stop(t0 + dur + 0.05); }
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(dest);
    o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }

  thump(dest, t0, { freq = 70, gain = 0.8, dur = 0.35 } = {}) {
    this.tone(dest, t0, dur, { freq, freqEnd: freq * 0.4, gain });
    this.noise(dest, t0, dur * 0.6, { type: 'lowpass', freq: 400, gain: gain * 0.5 });
  }

  // Voix synthétique (formants) pour rires, chœurs et murmures.
  voice(dest, t0, dur, { pitch = 160, formants = [700, 1200, 2600], gain = 0.25, vibrato = 4, pitchEnd = null, type = 'sawtooth' } = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type; o.frequency.setValueAtTime(pitch, t0);
    if (pitchEnd) o.frequency.exponentialRampToValueAtTime(pitchEnd, t0 + dur);
    const l = c.createOscillator(), lg = c.createGain();
    l.frequency.value = 5.5; lg.gain.value = vibrato;
    l.connect(lg).connect(o.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.04);
    g.gain.setValueAtTime(gain, t0 + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    for (const [i, f] of formants.entries()) {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 8;
      const fg = c.createGain(); fg.gain.value = 1 / (i + 1);
      o.connect(bp).connect(fg).connect(g);
    }
    g.connect(dest);
    o.start(t0); l.start(t0); o.stop(t0 + dur + 0.05); l.stop(t0 + dur + 0.05);
  }

  // ---------- recettes de sons ----------
  play(id, { side = 'far', vol = 1, fake = false, speaker = false } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + 0.01;
    // Les imitations du Chœur : trois copies désaccordées, légèrement décalées
    if (fake) {
      for (const [k, d] of [[0, 0], [1, 0.03], [2, 0.06]]) {
        const dest = this.out(side, 'sfx', vol * 0.45, { reverb: 0.4 });
        this.recipe(id, dest, t + d, 1 + (k - 1) * 0.06);
      }
      const hum = this.out(side, 'sfx', vol * 0.3, { reverb: 0.5 });
      for (const n of [57, 60, 64]) this.voice(hum, t, 1.2, { pitch: NOTE(n) * (1 + (Math.random() - 0.5) * 0.03), formants: [600, 1000], gain: 0.12 });
      return;
    }
    const dest = this.out(side, 'sfx', vol, { reverb: side === 'far' ? 0.6 : 0.25, speaker });
    this.recipe(id, dest, t, 1);
  }

  recipe(id, d, t, p) {
    const R = Math.random;
    switch (id) {
      case 'door':
        this.thump(d, t, { freq: 90 * p, gain: 0.9 });
        this.noise(d, t, 0.6, { freq: 600 * p, q: 6, gain: 0.5 });
        this.tone(d, t + 0.02, 0.8, { type: 'triangle', freq: 220 * p, freqEnd: 210, gain: 0.08 });
        break;
      case 'vent':
        for (let i = 0; i < 6; i++) this.noise(d, t + i * 0.05, 0.08, { type: 'highpass', freq: 2500 * p, gain: 0.35 });
        this.thump(d, t + 0.3, { freq: 120, gain: 0.4, dur: 0.2 });
        break;
      case 'mc_step': case 'mc_retreat': {
        const n = id === 'mc_retreat' ? 4 : 3;
        for (let i = 0; i < n; i++) {
          const g = id === 'mc_retreat' ? 0.8 - i * 0.18 : 0.5 + i * 0.15;
          this.thump(d, t + i * 0.55, { freq: 55 * p, gain: g });
          this.noise(d, t + i * 0.55 + 0.05, 0.15, { freq: 3000, q: 4, gain: g * 0.15 });
        }
        break;
      }
      case 'mc_laugh_speaker': case 'mc_laugh':
        for (let i = 0; i < 5; i++) this.voice(d, t + i * 0.18, 0.15, { pitch: (210 - i * 15) * p, formants: [750, 1150, 2500], gain: 0.35 });
        this.noise(d, t, 1.1, { type: 'highpass', freq: 3000, gain: 0.08 });
        for (let i = 0; i < 12; i++) this.noise(d, t + R() * 1, 0.02, { type: 'highpass', freq: 4000, gain: 0.3 });
        break;
      case 'mc_breath':
        this.tone(d, t, 1.3, { type: 'sawtooth', freq: 70 * p, freqEnd: 95 * p, gain: 0.07, vibrato: 6, vibRate: 11 });
        this.noise(d, t, 1.3, { freq: 500, q: 2, gain: 0.12 });
        break;
      case 'mimi_scrape_far': case 'mimi_scrape_near': case 'mimi_retreat': {
        const near = id === 'mimi_scrape_near';
        for (let i = 0; i < 4; i++) this.noise(d, t + i * 0.32, 0.28, { freq: (near ? 1800 : 1200) * p, freqEnd: (near ? 2600 : 900) * p, q: 3, gain: near ? 0.5 : 0.3, attack: 0.08 });
        this.tone(d, t, 1.2, { type: 'triangle', freq: 1320 * p, freqEnd: 1280, gain: 0.03 });
        break;
      }
      case 'mimi_tap':
        for (let i = 0; i < 5; i++) { const tt = t + i * 0.14 + (i > 2 ? 0.25 : 0); this.noise(d, tt, 0.04, { freq: 2600 * p, q: 10, gain: 0.7 }); this.tone(d, tt, 0.05, { freq: 900 * p, gain: 0.1 }); }
        break;
      case 'mimi_giggle':
        for (let i = 0; i < 4; i++) this.voice(d, t + i * 0.12, 0.1, { pitch: (520 + i * 40) * p, formants: [1100, 2200], gain: 0.18, type: 'triangle' });
        break;
      case 'roi_step':
        this.thump(d, t, { freq: 40 * p, gain: 1, dur: 0.6 });
        this.noise(d, t + 0.1, 0.3, { freq: 900, q: 8, gain: 0.25 });
        this.tone(d, t + 0.1, 0.4, { type: 'square', freq: 110 * p, gain: 0.03 });
        break;
      case 'roi_grind':
        this.tone(d, t, 2.2, { type: 'sawtooth', freq: 38 * p, freqEnd: 52 * p, gain: 0.2, vibrato: 8, vibRate: 13 });
        this.noise(d, t, 2.2, { freq: 320 * p, q: 3, gain: 0.35, attack: 0.3 });
        for (let i = 0; i < 6; i++) this.noise(d, t + i * 0.33, 0.06, { freq: 1500, q: 12, gain: 0.3 });
        break;
      case 'roi_shocked': case 'shock':
        for (let i = 0; i < 10; i++) this.tone(d, t + i * 0.05, 0.05, { type: 'square', freq: 200 + R() * 1800, gain: 0.12 });
        this.noise(d, t, 0.6, { type: 'highpass', freq: 2000, gain: 0.4 });
        if (id === 'roi_shocked') this.tone(d, t + 0.4, 1.2, { type: 'sawtooth', freq: 120, freqEnd: 30, gain: 0.15 });
        break;
      case 'roi_sabotage':
        this.thump(d, t, { freq: 50, gain: 1.2, dur: 1 });
        this.noise(d, t, 0.8, { type: 'highpass', freq: 1500, gain: 0.6 });
        this.tone(d, t + 0.1, 1.5, { type: 'sawtooth', freq: 400, freqEnd: 40, gain: 0.2 });
        break;
      case 'ruban_rustle': case 'ruban_door': case 'ruban_retreat': {
        const n = id === 'ruban_door' ? 8 : 5;
        for (let i = 0; i < n; i++) this.noise(d, t + i * 0.11 + R() * 0.05, 0.18, { type: 'highpass', freq: 4500 * p, gain: id === 'ruban_door' ? 0.35 : 0.22, attack: 0.04 });
        if (id === 'ruban_door') this.voice(d, t + 0.3, 1.0, { pitch: 90 * p, formants: [400, 1800, 3200], gain: 0.05, type: 'triangle' });
        break;
      }
      case 'ruban_tamper':
        this.tone(d, t, 0.06, { type: 'square', freq: 2400, gain: 0.08 });
        this.tone(d, t + 0.08, 0.06, { type: 'square', freq: 1800, gain: 0.06 });
        break;
      case 'choeur_hum': case 'choeur_door': case 'choeur_retreat': {
        const notes = id === 'choeur_door' ? [50, 53, 57, 61, 64] : [50, 57, 62];
        for (const [i, n] of notes.entries()) this.voice(d, t + i * 0.05, 2.2, { pitch: NOTE(n) * p * (1 + (R() - 0.5) * 0.025), formants: [500 + i * 80, 900 + i * 60, 2400], gain: id === 'choeur_door' ? 0.16 : 0.1, pitchEnd: id === 'choeur_retreat' ? NOTE(n - 5) : null });
        break;
      }
      case 'lure':
        this.melody(d, t, [72, 76, 79, 76, 72, 74, 77, 74], 0.13, { type: 'square', gain: 0.1, p });
        break;
      case 'parade':
        this.melody(d, t, [62, 65, 69, 65, 64, 67, 70, 67, 62, 65, 69, 74, 73, 69, 64, 61, 62], 0.42, { type: 'triangle', gain: 0.22, p: 1, bell: true });
        break;
      case 'power_out':
        this.tone(d, t, 2.2, { type: 'sawtooth', freq: 300, freqEnd: 25, gain: 0.25 });
        this.thump(d, t + 2.0, { freq: 60, gain: 1 });
        break;
      case 'chime':
        for (const [i, n] of [72, 76, 79, 84].entries()) this.tone(d, t + i * 0.35, 2.5, { type: 'sine', freq: NOTE(n), gain: 0.25 });
        for (const [i, n] of [72, 76, 79, 84].entries()) this.tone(d, t + i * 0.35, 1.5, { type: 'sine', freq: NOTE(n) * 2.76, gain: 0.05 });
        break;
      case 'jam':
        this.noise(d, t, 0.5, { freq: 300, q: 5, gain: 0.5 });
        this.thump(d, t, { freq: 80, gain: 0.5 });
        break;
      case 'blip':
        this.tone(d, t, 0.05, { type: 'square', freq: 1200, gain: 0.05 });
        this.noise(d, t, 0.18, { type: 'highpass', freq: 3000, gain: 0.12 });
        break;
      case 'fragment':
        this.melody(d, t, [79, 83, 86, 91], 0.09, { type: 'sine', gain: 0.15, p: 1, bell: true });
        break;
      case 'click':
        this.tone(d, t, 0.03, { type: 'square', freq: 800, gain: 0.05 });
        break;
      default:
        this.noise(d, t, 0.2, { gain: 0.2 });
    }
  }

  melody(d, t, notes, step, { type = 'square', gain = 0.1, p = 1, bell = false }) {
    notes.forEach((n, i) => {
      const f = NOTE(n) * p;
      this.tone(d, t + i * step, step * (bell ? 3 : 0.9), { type, freq: f, gain, vibrato: 3 });
      if (bell) this.tone(d, t + i * step, step * 2, { type: 'sine', freq: f * 3.01, gain: gain * 0.25 });
    });
  }

  /** Cri du jumpscare, propre à chaque mascotte. */
  scream(who) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + 0.01;
    const g = c.createGain();
    g.gain.value = 1;
    const ws = c.createWaveShaper(); ws.curve = this.distCurve(60);
    g.connect(ws).connect(this.bus.scare);
    const base = { mc: 160, mimi: 420, roi: 70, ruban: 300, choeur: 140 }[who] ?? 150;
    const layers = who === 'choeur' ? 5 : 3;
    for (let i = 0; i < layers; i++) this.tone(g, t, 1.6, { type: 'sawtooth', freq: base * (1 + i * 0.07), freqEnd: base * 1.9, gain: 0.35, vibrato: 30, vibRate: 17 + i });
    this.noise(g, t, 1.6, { freq: 1800, freqEnd: 3000, q: 0.8, gain: 0.9 });
    this.noise(g, t, 0.5, { type: 'lowpass', freq: 200, gain: 1 });
    if (who === 'roi') this.tone(g, t, 1.6, { type: 'square', freq: 45, freqEnd: 30, gain: 0.5 });
  }

  // ---------- boucles d'ambiance ----------
  startAmbience(kind = 'office') {
    if (!this.ctx) return;
    this.stopAmbience();
    const c = this.ctx;
    const nodes = [];
    const g = c.createGain(); g.gain.value = 0; g.connect(this.bus.amb);
    g.gain.linearRampToValueAtTime(1, c.currentTime + 2);
    // bourdonnement électrique 50 Hz + harmoniques
    for (const [f, a] of [[50, 0.05], [100, 0.03], [150, 0.012]]) {
      const o = c.createOscillator(); o.frequency.value = f; const og = c.createGain(); og.gain.value = a; o.connect(og).connect(g); o.start(); nodes.push(o);
    }
    // ventilation (bruit brun filtré, modulé lentement)
    const src = c.createBufferSource(); src.buffer = this.brownBuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
    const vg = c.createGain(); vg.gain.value = kind === 'menu' ? 0.18 : 0.3;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.08; const lg = c.createGain(); lg.gain.value = 120; lfo.connect(lg).connect(f.frequency); lfo.start();
    src.connect(f).connect(vg).connect(g); src.start(); nodes.push(src, lfo);
    // nappe grave inquiétante
    for (const [n, det] of [[38, -6], [45, 7]]) {
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = NOTE(n); o.detune.value = det;
      const og = c.createGain(); og.gain.value = kind === 'menu' ? 0.05 : 0.025;
      o.connect(og).connect(g); o.start(); nodes.push(o);
    }
    this.loops.amb = { g, nodes };
    // bruits ponctuels aléatoires (grincements, objets qui tombent, jouets)
    clearInterval(this.creakTimer);
    this.creakTimer = setInterval(() => {
      if (!this.ctx || Math.random() > 0.35) return;
      const t = c.currentTime;
      const side = ['W', 'E', 'far', 'C'][Math.floor(Math.random() * 4)];
      const d = this.out(side, 'amb', 0.25, { reverb: 0.7 });
      const r = Math.random();
      if (r < 0.4) this.tone(d, t, 1.4, { type: 'sawtooth', freq: 180 + Math.random() * 200, freqEnd: 120, gain: 0.04, vibrato: 10, vibRate: 7 });
      else if (r < 0.7) this.thump(d, t, { freq: 90, gain: 0.25 });
      else this.melody(d, t, [84, 83, 81], 0.25, { type: 'sine', gain: 0.04, bell: true });
    }, 5000);
  }

  stopAmbience() {
    clearInterval(this.creakTimer);
    const a = this.loops.amb;
    if (!a || !this.ctx) return;
    const t = this.ctx.currentTime;
    a.g.gain.cancelScheduledValues(t);
    a.g.gain.setValueAtTime(a.g.gain.value, t);
    a.g.gain.linearRampToValueAtTime(0, t + 0.5);
    setTimeout(() => a.nodes.forEach((n) => { try { n.stop(); } catch { /* déjà arrêté */ } }), 700);
    this.loops.amb = null;
  }

  /** Souffle de caméra (actif quand la tablette est ouverte). */
  setCamHiss(on) {
    if (!this.ctx) return;
    if (!this.loops.hiss) {
      const c = this.ctx;
      const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 5000; f.Q.value = 0.6;
      const g = c.createGain(); g.gain.value = 0;
      src.connect(f).connect(g).connect(this.bus.amb); src.start();
      this.loops.hiss = g;
    }
    this.loops.hiss.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx.currentTime, 0.05);
  }

  /** Murmure de bande magnétique (messages d'Odile). */
  tapeMurmur(seconds) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const d = this.out('C', 'voice', 0.6);
    this.noise(d, t, seconds, { type: 'bandpass', freq: 3000, q: 0.5, gain: 0.04, attack: 0.2 });
    let tt = t + 0.2;
    while (tt < t + seconds - 0.3) {
      const dur = 0.08 + Math.random() * 0.18;
      this.voice(d, tt, dur, { pitch: 170 + Math.random() * 50, formants: [500 + Math.random() * 400, 1300 + Math.random() * 600], gain: 0.05, vibrato: 3 });
      tt += dur + (Math.random() < 0.15 ? 0.35 : 0.03);
    }
  }
}
