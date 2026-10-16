/* JC Car Crasher — shared helpers: math, seeded random, colours, sprite cache. */
'use strict';

const JC = window.JC = {};

// Logical playfield: 480 units wide, height follows the screen's aspect ratio.
JC.W = 480;
JC.LANES = 5;
JC.LANE_W = 62;
JC.ROAD_W = JC.LANE_W * JC.LANES;          // 310
JC.ROAD_X = (JC.W - JC.ROAD_W) / 2;        // 85
JC.SEG = 256;                              // height of one terrain tile
JC.laneX = i => JC.ROAD_X + JC.LANE_W * (i + 0.5);

// Canvas pixels per logical unit; sprites are rasterised at this scale.
JC.R = { scale: 1, gen: 0 };

JC.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
JC.lerp = (a, b, t) => a + (b - a) * t;
JC.rand = (a, b) => a + Math.random() * (b - a);
JC.randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
JC.pick = arr => arr[Math.floor(Math.random() * arr.length)];
JC.chance = p => Math.random() < p;
JC.ease = t => t * t * (3 - 2 * t);
JC.easeOutBack = t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

JC.weighted = obj => {
  let total = 0;
  for (const k in obj) total += obj[k];
  let r = Math.random() * total;
  for (const k in obj) { r -= obj[k]; if (r <= 0) return k; }
  return Object.keys(obj)[0];
};

JC.shuffle = arr => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Small deterministic PRNG so terrain tiles and props can be re-rendered identically.
JC.rng = seed => {
  let s = seed >>> 0;
  const f = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (a, b) => a + f() * (b - a);
  f.int = (a, b) => Math.floor(a + f() * (b - a + 1));
  f.pick = arr => arr[Math.floor(f() * arr.length)];
  f.chance = p => f() < p;
  return f;
};

// ---------- colour ----------
JC.hex = h => {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
JC.rgb = (r, g, b, a) => a === undefined
  ? `rgb(${r | 0},${g | 0},${b | 0})`
  : `rgba(${r | 0},${g | 0},${b | 0},${a})`;
// Lighten (amt > 0) or darken (amt < 0) a hex colour; amt in -1..1.
JC.shade = (h, amt, a) => {
  const [r, g, b] = JC.hex(h);
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  return JC.rgb(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p, a);
};
JC.alpha = (h, a) => { const [r, g, b] = JC.hex(h); return JC.rgb(r, g, b, a); };
JC.mix = (h1, h2, t) => {
  const a = JC.hex(h1), b = JC.hex(h2);
  return JC.rgb(JC.lerp(a[0], b[0], t), JC.lerp(a[1], b[1], t), JC.lerp(a[2], b[2], t));
};

// ---------- canvas helpers ----------
JC.rr = (g, x, y, w, h, r) => {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
};
JC.rrPath = (x, y, w, h, r) => {
  const p = new Path2D();
  r = Math.min(r, w / 2, h / 2);
  p.moveTo(x + r, y);
  p.arcTo(x + w, y, x + w, y + h, r);
  p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r);
  p.arcTo(x, y, x + w, y, r);
  p.closePath();
  return p;
};
JC.circle = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); };
JC.poly = (g, pts) => {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
};

// Rasterise a drawing into an offscreen canvas at the current render scale.
// The returned sprite is drawn centred (or anchored) in logical units.
JC.sprite = (w, h, draw, pad = 0) => {
  const s = JC.R.scale;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil((w + pad * 2) * s));
  c.height = Math.max(1, Math.ceil((h + pad * 2) * s));
  const g = c.getContext('2d');
  g.scale(s, s);
  g.translate(pad, pad);
  draw(g, w, h);
  return { c, w: w + pad * 2, h: h + pad * 2, pad, iw: w, ih: h };
};

// Lazily built sprite cache; cleared whenever the render scale changes.
JC.cache = new Map();
JC.cached = (key, make) => {
  let s = JC.cache.get(key);
  if (!s) { s = make(); JC.cache.set(key, s); }
  return s;
};

JC.drawC = (ctx, sp, x, y, rot, sc) => {
  if (!rot && !sc) {
    ctx.drawImage(sp.c, x - sp.w / 2, y - sp.h / 2, sp.w, sp.h);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (sc) ctx.scale(sc, sc);
  ctx.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
  ctx.restore();
};

// Glow helper used while building neon sprites.
JC.glow = (g, color, blur) => { g.shadowColor = color; g.shadowBlur = blur; };
JC.noGlow = g => { g.shadowColor = 'transparent'; g.shadowBlur = 0; };

JC.fmt = n => Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

JC.store = {
  get(k, d) { try { const v = localStorage.getItem('jc_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('jc_' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
};

JC.FONT_DISPLAY = "'Bungee', 'Arial Black', Impact, sans-serif";
JC.FONT_SIGN = "'Overpass', 'Arial Narrow', Arial, sans-serif";
JC.FONT_MONO = "'Overpass Mono', 'Courier New', monospace";
