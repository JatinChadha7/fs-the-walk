/* Synthesised sound: engine, crashes, explosions, pickups and a driving beat. No audio files needed. */
'use strict';

(function () {
  const A = JC.audio = {
    ctx: null, master: null, sfx: null, music: null,
    soundOn: JC.store.get('sound', true),
    musicOn: JC.store.get('music', true),
    engine: null, noise: null, musicTimer: null, nextNote: 0, step: 0, night: 0,
  };

  A.init = () => {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = A.ctx = new AC();
    A.master = ctx.createGain(); A.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    A.master.connect(comp); comp.connect(ctx.destination);
    A.sfx = ctx.createGain(); A.sfx.gain.value = A.soundOn ? 1 : 0; A.sfx.connect(A.master);
    A.music = ctx.createGain(); A.music.gain.value = A.musicOn ? 0.32 : 0; A.music.connect(A.master);
    A.musicFilter = ctx.createBiquadFilter(); A.musicFilter.type = 'lowpass'; A.musicFilter.frequency.value = 9000;
    A.musicFilter.connect(A.music);
    // shared white-noise buffer
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.noise = buf;
  };

  A.setSound = on => {
    A.soundOn = on; JC.store.set('sound', on);
    if (A.sfx) A.sfx.gain.setTargetAtTime(on ? 1 : 0, A.ctx.currentTime, 0.05);
  };
  A.setMusic = on => {
    A.musicOn = on; JC.store.set('music', on);
    if (A.music) A.music.gain.setTargetAtTime(on ? 0.32 : 0, A.ctx.currentTime, 0.1);
  };
  A.suspend = () => { if (A.ctx && A.ctx.state === 'running') A.ctx.suspend(); };
  A.resume = () => { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); };

  const env = (g, t, a, peak, d, end = 0.0001) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(end, t + a + d);
  };

  function noiseBurst(t, dur, freq, q, gain, type = 'bandpass', sweepTo) {
    const ctx = A.ctx;
    const src = ctx.createBufferSource(); src.buffer = A.noise;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain(); env(g, t, 0.005, gain, dur);
    src.connect(f); f.connect(g); g.connect(A.sfx);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  function tone(t, freq, dur, type, gain, slideTo, dest) {
    const ctx = A.ctx;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain(); env(g, t, 0.006, gain, dur);
    o.connect(g); g.connect(dest || A.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // ---------- engine ----------
  A.startEngine = () => {
    if (!A.ctx || A.engine) return;
    const ctx = A.ctx;
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
    const o2 = ctx.createOscillator(); o2.type = 'square';
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 3;
    const g = ctx.createGain(); g.gain.value = 0;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(A.sfx);
    o1.start(); o2.start();
    g.gain.setTargetAtTime(0.06, ctx.currentTime, 0.3);
    A.engine = { o1, o2, f, g };
  };
  A.engineSpeed = (kmh, rev) => {
    if (!A.engine) return;
    const t = A.ctx.currentTime;
    const base = 38 + kmh * 0.22 + rev * 18;
    A.engine.o1.frequency.setTargetAtTime(base, t, 0.08);
    A.engine.o2.frequency.setTargetAtTime(base * 0.5 + 1.5, t, 0.08);
    A.engine.f.frequency.setTargetAtTime(300 + kmh * 2.2 + rev * 300, t, 0.1);
  };
  A.stopEngine = () => {
    if (!A.engine) return;
    const e = A.engine, t = A.ctx.currentTime;
    e.g.gain.setTargetAtTime(0, t, 0.15);
    setTimeout(() => { try { e.o1.stop(); e.o2.stop(); } catch (err) { /* already stopped */ } }, 800);
    A.engine = null;
  };

  // ---------- effects ----------
  A.crash = size => {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    noiseBurst(t, 0.25 + size * 0.15, 1800 - size * 600, 0.8, 0.9);
    noiseBurst(t, 0.12, 5200, 2, 0.35, 'highpass'); // glass
    tone(t, 140 - size * 40, 0.25 + size * 0.1, 'sine', 0.9, 38);
  };
  A.coin = combo => {
    if (!A.ctx) return;
    const t = A.ctx.currentTime + 0.03;
    const base = 660 * Math.pow(2, Math.min(combo, 12) / 12);
    tone(t, base, 0.08, 'square', 0.12);
    tone(t + 0.06, base * 1.5, 0.12, 'square', 0.1);
  };
  A.explode = () => {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    noiseBurst(t, 1.6, 2400, 0.6, 1.2, 'lowpass', 120);
    noiseBurst(t + 0.05, 0.9, 600, 0.7, 0.8);
    tone(t, 90, 1.2, 'sine', 1.2, 24);
    tone(t, 60, 1.4, 'triangle', 0.6, 20);
  };
  A.whoosh = () => {
    if (!A.ctx) return;
    noiseBurst(A.ctx.currentTime, 0.14, 900, 1.2, 0.18, 'bandpass', 2600);
  };
  A.power = () => {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => tone(t + i * 0.06, f, 0.16, 'triangle', 0.22));
  };
  A.shieldPop = () => {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    tone(t, 1200, 0.4, 'sine', 0.3, 200);
    noiseBurst(t, 0.3, 3000, 1, 0.4, 'highpass');
  };
  A.lap = () => {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    [392, 523, 659, 784, 1046].forEach((f, i) => { tone(t + i * 0.09, f, 0.22, 'square', 0.13); tone(t + i * 0.09, f / 2, 0.22, 'triangle', 0.15); });
  };
  A.horn = () => {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    tone(t, 370, 0.35, 'sawtooth', 0.08); tone(t, 466, 0.35, 'sawtooth', 0.06);
  };
  A.click = () => { if (A.ctx) tone(A.ctx.currentTime, 900, 0.05, 'square', 0.08); };

  // ---------- music: a four-on-the-floor loop with an arpeggiated bass ----------
  const BPM = 124, STEP = 60 / BPM / 4;
  const BASS = [[45, 45, 57, 45, 48, 45, 55, 45], [41, 41, 53, 41, 43, 43, 55, 43]];
  const LEAD = [69, 72, 76, 72, 74, 72, 67, 64];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function scheduleStep(i, t) {
    const ctx = A.ctx, dest = A.musicFilter;
    const bar = Math.floor(i / 16) % 4;
    const s = i % 16;
    if (s % 4 === 0) { // kick
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      const g = ctx.createGain(); env(g, t, 0.002, 0.9, 0.2);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.25);
    }
    if (s % 4 === 2) { // off-beat hat
      const src = ctx.createBufferSource(); src.buffer = A.noise;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      const g = ctx.createGain(); env(g, t, 0.002, 0.16, 0.05);
      src.connect(f); f.connect(g); g.connect(dest); src.start(t, Math.random()); src.stop(t + 0.08);
    }
    if (s === 4 || s === 12) { // snare
      const src = ctx.createBufferSource(); src.buffer = A.noise;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7;
      const g = ctx.createGain(); env(g, t, 0.002, 0.3, 0.14);
      src.connect(f); f.connect(g); g.connect(dest); src.start(t, Math.random()); src.stop(t + 0.2);
    }
    if (s % 2 === 0) { // bass
      const pat = BASS[bar < 2 ? 0 : 1];
      const n = pat[(s / 2) % 8];
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(200, t + STEP * 1.8);
      const g = ctx.createGain(); env(g, t, 0.005, 0.22, STEP * 1.8);
      o.connect(f); f.connect(g); g.connect(dest); o.start(t); o.stop(t + STEP * 2);
    }
    if (bar === 3 && s % 2 === 0) { // lead fill every fourth bar
      const n = LEAD[(s / 2) % 8];
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = mtof(n);
      const g = ctx.createGain(); env(g, t, 0.005, 0.06, STEP * 1.5);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + STEP * 2);
    }
  }

  A.startMusic = () => {
    if (!A.ctx || A.musicTimer) return;
    A.nextNote = A.ctx.currentTime + 0.1;
    A.step = 0;
    A.musicTimer = setInterval(() => {
      if (!A.ctx || A.ctx.state !== 'running') return;
      while (A.nextNote < A.ctx.currentTime + 0.12) {
        scheduleStep(A.step, A.nextNote);
        A.nextNote += STEP; A.step++;
      }
    }, 25);
  };
  A.stopMusic = () => { clearInterval(A.musicTimer); A.musicTimer = null; };
  // Night mode mellows the music with a lower filter cutoff.
  A.setNight = n => {
    if (!A.musicFilter) return;
    A.musicFilter.frequency.setTargetAtTime(9000 - n * 7800, A.ctx.currentTime, 0.5);
  };
})();
