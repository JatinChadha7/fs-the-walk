/* JC Car Crasher — game loop, world, traffic, collisions, effects, HUD and input. */
'use strict';

(function () {
  const { W, SEG, ROAD_X, ROAD_W, laneX, clamp, lerp, rand, randi, pick, chance } = JC;
  const RX2 = ROAD_X + ROAD_W;
  const BASE_SPEED = 260;          // road units per second on lap 1
  const MAX_SPEED_MUL = 2.45;
  const TILE_VARIANTS = 3;
  const KMH = 0.32;
  const SHORT_COUNTRY = { 'United Arab Emirates': 'UAE', 'United Kingdom': 'UK', 'United States': 'USA' };
  const $ = id => document.getElementById(id);

  const app = $('app');
  const canvas = $('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const audio = JC.audio;

  let H = 900, cssW = 360;
  let S = null;                    // the current run (or the attract-mode demo)
  let state = 'boot';              // boot | title | playing | paused | dying | over
  let best = JC.store.get('best', 0);
  let vibeOn = JC.store.get('vibe', true);
  let lastT = 0;

  const tileCache = new Map();
  const propPools = new Map();

  const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const vibrate = p => { if (!vibeOn || !navigator.vibrate) return; try { navigator.vibrate(p); } catch (e) { /* unsupported */ } };

  // ---------------------------------------------------------------- sizing
  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    let w = vw;
    if (vw / vh > 0.7) w = Math.round(vh * 0.6);      // tablets/desktop: keep a phone-shaped column
    cssW = w;
    app.style.width = w + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(vh * dpr);
    const scale = canvas.width / W;
    H = canvas.height / scale;
    if (Math.abs(scale - JC.R.scale) > 0.01) {
      JC.R.scale = scale;
      JC.cache.clear(); tileCache.clear(); propPools.clear();
      if (S) S.props.forEach(p => { p.stale = true; });
    }
    if (S) S.player.y = playerY();
  }
  const playerY = () => H - Math.max(150, H * 0.17);

  // ---------------------------------------------------------------- caches
  function tileSprite(loc, v) {
    const k = loc.id + ':' + v;
    let sp = tileCache.get(k);
    if (!sp) { sp = JC.renderTile(loc, hashStr(loc.id) + v * 7919); tileCache.set(k, sp); }
    return sp;
  }
  function belowSprite(loc, v) {
    const k = 'below:' + loc.id + ':' + v;
    let sp = tileCache.get(k);
    if (!sp) { sp = JC.renderBelowTile(loc, hashStr(loc.id) + 99 + v * 131); tileCache.set(k, sp); }
    return sp;
  }
  function belowGlow(v) {
    const k = 'belowglow:' + v;
    let sp = tileCache.get(k);
    if (!sp) { sp = JC.renderBelowGlow(1234 + v * 17); tileCache.set(k, sp); }
    return sp;
  }
  // Keep only what the current and next locations need in memory.
  function evict(keep) {
    const ids = keep.map(l => l.id);
    for (const k of [...tileCache.keys()]) {
      if (k.startsWith('belowglow:')) continue;
      const id = k.startsWith('below:') ? k.split(':')[1] : k.split(':')[0];
      if (!ids.includes(id)) tileCache.delete(k);
    }
    for (const k of [...propPools.keys()]) if (!ids.includes(k)) propPools.delete(k);
    // road signs and landmarks of places we've left
    const marks = keep.map(l => l.landmark);
    for (const k of [...JC.cache.keys()]) {
      const [kind, id] = k.split(':');
      if ((kind === 'welcome' || kind === 'dir') && !ids.includes(id)) JC.cache.delete(k);
      else if (kind === 'lm' && !marks.includes(id)) JC.cache.delete(k);
    }
  }
  function pooled(loc, kind, max, make) {
    let pool = propPools.get(loc.id);
    if (!pool) { pool = {}; propPools.set(loc.id, pool); }
    const arr = pool[kind] || (pool[kind] = []);
    if (arr.length < max) {
      const item = make(JC.rng(hashStr(loc.id + kind) + arr.length * 977));
      arr.push(item);
      return item;
    }
    return pick(arr);
  }

  // ---------------------------------------------------------------- run setup
  function newRun(demo) {
    const queue = JC.shuffle(JC.LOCATIONS);
    const loc = queue.shift();
    const sp = BASE_SPEED * (demo ? 1.25 : 1);
    S = {
      demo, t: 0, score: 0, lap: 1, lapTarget: demo ? randi(8, 10) : randi(20, 25), lapSpawned: 0, lapDone: 0,
      crashed: 0, combo: 0, maxCombo: 0, mult: 1, speed: sp, targetSpeed: sp, topKmh: 0,
      queue, loc, tileLoc: loc, propLoc: loc, seamY: null, pendingSeam: false, visited: [loc],
      player: { lane: 2, x: laneX(2), y: playerY(), tilt: 0, shield: 0, dbl: 0, alive: true, bump: 0, spin: 0, rot: 0, burnt: 0, vx: 0 },
      cars: [], hazards: [], powers: [], wrecks: [], parts: [], pops: [], over: [], props: [], scorch: [], tiles: [], below: [],
      rowGap: 1.2 * BASE_SPEED, safeLane: 2, lapPause: 0,
      zones: { L: { outer: 0, inner: 0 }, R: { outer: 0, inner: 0 } },
      nextLandmark: rand(260, 520), nextSign: rand(900, 1500), nextFlags: rand(300, 600),
      dn: { n: 0, phase: 'day', t: demo ? rand(10, 16) : rand(28, 40) },
      shake: 0, flash: 0, deathT: 0, cause: '', causeLoc: loc,
      wx: [], glints: [], aiCool: 0, hudCache: {}, hintT: demo ? 0 : 4.5, powerCooldown: 6,
    };
    for (let y = H - SEG; y > -SEG * 2; y -= SEG) S.tiles.push({ y, loc, v: randi(0, TILE_VARIANTS - 1) });
    for (let y = H - SEG; y > -SEG * 2; y -= SEG) S.below.push({ y, v: randi(0, 2) });
    // pre-populate the roadside so the first frame is already dressed
    for (let i = 0, step = 24; i < (H + 60) / step; i++) { scrollProps(step); spawnProps(step); }
    evict([loc]);
    setWeather(loc);
  }

  // ---------------------------------------------------------------- props
  function addProp(sp, x, y, extra) {
    const p = Object.assign({ day: sp.day, glow: sp.glow || null, w: sp.w, h: sp.h, pad: sp.pad || 0, x, y }, extra || {});
    S.props.push(p);
    return p;
  }
  const lampSprite = side => JC.cached('lamp:' + side, () => JC.makeLamp(side));

  function spawnLandmark(loc, side) {
    const lm = JC.makeLandmark(loc.landmark, side);
    if (!lm) return 0;
    const y = -2;
    if (loc.landmark === 'seaplane') {
      const x = side === 'L' ? 4 : RX2 + 26;
      addProp(lm, x, y);
    } else if (loc.landmark === 'watchtower') {
      addProp(lm, side === 'L' ? ROAD_X - 14 - lm.w : RX2 + 24, y);
    } else {
      addProp(lm, side === 'L' ? ROAD_X - 6 - lm.w : RX2 + 6, y);
    }
    return lm.h * 0.45 + 30;
  }

  // Outer zone: buildings, boats, trees… Returns the distance until the next spawn.
  function spawnOuter(side, loc) {
    const L = side === 'L';
    const T = loc.terrain;
    if (S.nextLandmark <= 0 && loc.landmark && (loc.landmark !== 'pylon' || chance(0.8))) {
      S.nextLandmark = rand(1500, 2300);
      return spawnLandmark(loc, side);
    }
    if (T === 'city' || T === 'flyover') {
      const st = JC.STYLES[loc.style] || {};
      if (T === 'city' && st.trees && chance(0.16)) {
        const t = pooled(loc, 'tree', 4, r => JC.makeTree(r));
        const cx = L ? rand(16, 50) : rand(RX2 + 30, W - 14);
        addProp(t, cx - t.w / 2, -2);
        return rand(26, 46);
      }
      const b = pooled(loc, 'bld' + side, 10, r => JC.makeBuilding(loc, side, r));
      const edge = T === 'flyover' ? 26 : 20;
      addProp(b, L ? ROAD_X - edge - b.w : RX2 + edge, -2);
      // leave room so most of each facade shows above the next building down the street
      return b.gap + b.fh * (T === 'flyover' ? 0.55 : 0.45) + rand(0, 34);
    }
    if (T === 'bridge') {
      const id = loc.id;
      const xIn = (w) => L ? rand(2, ROAD_X - 28 - w) : rand(RX2 + 18, W - w - 2);
      if (id === 'maldives') {
        const k = Math.random();
        if (k < 0.45) { const v = pooled(loc, 'villa' + side, 2, r => JC.makeVillas(r, side)); addProp(v, L ? ROAD_X - 12 - v.w : RX2 + 12, -2); return rand(90, 140); }
        if (k < 0.75) { const i = pooled(loc, 'island', 3, r => JC.makeIsland(r)); addProp(i, xIn(i.w), -2); return rand(120, 220); }
      }
      const kinds = { mumbai: ['speed', 'cargo', 'longtail'], lagos: ['speed', 'cargo', 'longtail'], sydney: ['ferry', 'yacht', 'speed'], maldives: ['speed', 'yacht', 'jetski'] }[id] || ['speed', 'yacht'];
      if (chance(0.22)) { const b = JC.cached('buoy', () => JC.makeBuoy()); addProp(b, xIn(b.w), -2); return rand(60, 120); }
      const kind = pick(kinds);
      const boat = pooled(loc, 'boat:' + kind, 2, r => JC.makeBoat(r, kind));
      addProp(boat, xIn(boat.w), -2);
      return rand(150, 300);
    }
    if (T === 'mountain') {
      const snow = !!loc.pal.snow;
      if (L) { // rock face side
        const r = pooled(loc, 'rock', 3, rr => JC.makeRock(rr, JC.shade(loc.pal.rock, 0.1)));
        addProp(r, rand(2, ROAD_X - 18 - r.w), -2);
        if (chance(0.5)) { const p = pooled(loc, 'pine', 4, rr => JC.makePine(rr, snow)); addProp(p, rand(0, 40), -2 - rand(10, 30)); }
        return rand(50, 120);
      }
      if (loc.style === 'greatwall') {
        if (chance(0.3)) { const t = JC.cached('watchtower', () => JC.makeWatchtower()); addProp(t, RX2 + 24, -2); return rand(160, 260); }
        const p = pooled(loc, 'pine', 4, rr => JC.makePine(rr, false));
        addProp(p, rand(RX2 + 12, RX2 + 22), -2);
        return rand(30, 70);
      }
      if ((loc.style === 'alps' || loc.style === 'himalaya') && chance(0.12)) {
        const c = pooled(loc, 'chalet', 3, rr => JC.makeChalet(rr, loc.style === 'himalaya'));
        addProp(c, rand(RX2 + 16, W - c.w + 10), -2);
        return rand(60, 100);
      }
      const p = pooled(loc, 'pine', 5, rr => JC.makePine(rr, snow));
      addProp(p, rand(RX2 + 14, W - 18), -2);
      return rand(16, 44);
    }
    if (T === 'beach') {
      if (L) {
        const k = Math.random();
        if (k < 0.15) { const h = pooled(loc, 'hut', 2, r => JC.makeHut(r)); addProp(h, rand(0, ROAD_X - 22 - h.w), -2); return rand(60, 90); }
        if (k < 0.4) { const u = pooled(loc, 'umb', 4, r => JC.makeUmbrella(r)); addProp(u, rand(2, ROAD_X - 22 - u.w), -2); return rand(30, 60); }
        const p = pooled(loc, 'palm' + side, 4, r => JC.makePalm(r, side)); addProp(p, rand(-10, ROAD_X - 30 - p.w / 2), -2);
        return rand(36, 70);
      }
      if (chance(0.4)) { const u = pooled(loc, 'umb', 4, r => JC.makeUmbrella(r)); addProp(u, RX2 + 12, -2); return rand(40, 80); }
      const kind = pick(['jetski', 'longtail', 'speed']);
      const boat = pooled(loc, 'boat:' + kind, 2, r => JC.makeBoat(r, kind));
      addProp(boat, rand(RX2 + 52, W - boat.w + 6), -2);
      return rand(120, 220);
    }
    if (T === 'desert') {
      const xIn = (w) => L ? rand(-4, ROAD_X - 12 - w) : rand(RX2 + 10, W - w + 4);
      const k = Math.random();
      if (loc.style === 'giza') {
        if (k < 0.25) { const c = pooled(loc, 'camel' + side, 2, r => JC.makeCamel(r, side)); addProp(c, xIn(c.w), -2); return rand(60, 120); }
        if (k < 0.45) { const p = pooled(loc, 'palm' + side, 3, r => JC.makePalm(r, side)); addProp(p, xIn(p.w), -2); return rand(60, 110); }
        const r = pooled(loc, 'rock', 3, rr => JC.makeRock(rr, '#b8996a')); addProp(r, xIn(r.w), -2); return rand(70, 150);
      }
      if (k < 0.4) { const s = pooled(loc, 'spin', 3, r => JC.makeSpinifex(r)); addProp(s, xIn(s.w), -2); return rand(24, 50); }
      if (k < 0.65) { const t = JC.cached('termite', () => JC.makeTermiteMound()); addProp(t, xIn(t.w), -2); return rand(40, 80); }
      const r = pooled(loc, 'rock', 3, rr => JC.makeRock(rr, '#a3462a')); addProp(r, xIn(r.w), -2);
      return rand(60, 120);
    }
    return 200;
  }

  // Inner zone: lamps, kerbside trees, palms, road signs.
  function spawnInner(side, loc) {
    const L = side === 'L';
    const T = loc.terrain;
    const lamp = gap => {
      const l = lampSprite(side);
      const pole = T === 'bridge' ? 5 : T === 'flyover' ? 6 : 8;
      const x = L ? ROAD_X - pole - 3 : RX2 + pole - (l.w - 3);
      addProp(l, x, -2, { pool: { x: L ? x + l.w - 4 : x + 4 } });
      return gap;
    };
    if (T === 'city') {
      const st = JC.STYLES[loc.style] || {};
      if (chance(0.5)) return lamp(rand(150, 200));
      if (st.trees) { const t = pooled(loc, 'tree', 4, r => JC.makeTree(r)); addProp(t, (L ? ROAD_X - 10 : RX2 + 10) - t.w / 2, -2); return rand(70, 120); }
      return 80;
    }
    if (T === 'bridge' || T === 'flyover') return lamp(rand(140, 170));
    if (T === 'beach') {
      if (L && chance(0.5)) { const p = pooled(loc, 'palm' + side, 4, r => JC.makePalm(r, side)); addProp(p, ROAD_X - 12 - p.w / 2, -2); return rand(70, 120); }
      return lamp(rand(160, 200));
    }
    if (T === 'desert') {
      if (chance(0.25)) { const s = JC.cached('sign:' + loc.style, () => JC.makeRoadSign(loc.style === 'giza' ? 'camel' : 'kangaroo')); addProp(s, L ? ROAD_X - 18 : RX2 + 4, -2); }
      return rand(500, 900);
    }
    return 400;
  }

  function scrollProps(dy) {
    for (const p of S.props) p.y += dy;
    if (S.props.length && S.props.some(p => p.y - p.h - p.pad > H)) S.props = S.props.filter(p => p.y - p.h - p.pad <= H);
  }
  function spawnProps(dy) {
    const loc = S.propLoc;
    S.nextLandmark -= dy;
    for (const side of ['L', 'R']) {
      const z = S.zones[side];
      z.outer -= dy; z.inner -= dy;
      // Props spawn on the line just above the screen; push them down by however far we overshot it.
      while (z.outer <= 0) { const over = -z.outer, before = S.props.length; z.outer += spawnOuter(side, loc); shiftNew(before, over); }
      while (z.inner <= 0) { const over = -z.inner, before = S.props.length; z.inner += spawnInner(side, loc); shiftNew(before, over); }
    }
  }
  function shiftNew(from, by) { for (let i = from; i < S.props.length; i++) S.props[i].y += by; }

  // ---------------------------------------------------------------- overhead structures
  function addOverhead(kind, y, data) {
    S.over.push(Object.assign({ kind, y }, data || {}));
  }

  // ---------------------------------------------------------------- traffic
  function laneClear(lane, list, span) {
    for (const o of list) if (o.lane === lane && o.y < span) return false;
    return true;
  }

  function spawnCar(lane) {
    const loc = S.propLoc;
    let type = JC.weighted(loc.traffic);
    if (chance(0.025 + S.lap * 0.002)) type = 'golden';
    const t = JC.CAR_TYPES[type];
    const vary = (loc.vary && loc.vary[type]) || null;
    let col = vary && vary.col ? vary.col : pick(JC.DAY_COLORS);
    if (type === 'golden') col = '#f6c445';
    let variant = null;
    if (vary) { variant = Object.assign({}, vary); delete variant.col; if (!Object.keys(variant).length) variant = null; }
    const neon = type === 'golden' ? '#ffd23f' : pick(JC.NEON_COLORS);
    S.cars.push({
      type, lane, x: laneX(lane), y: -t.h / 2 - 12, w: t.w, h: t.h, pts: t.pts,
      fwd: rand(t.fwd[0], t.fwd[1]), sp: JC.carSprite(type, col, neon, variant), col,
      tx: laneX(lane), switchT: rand(2.5, 6), blink: 0, phase: Math.random() * 6,
    });
    S.lapSpawned++;
  }

  function spawnHazard(lane, y) {
    const kind = chance(0.5) ? 'bomb' : 'dynamite';
    const t = JC.HAZARDS[kind];
    S.hazards.push({ kind, lane, x: laneX(lane) + rand(-6, 6), y, w: t.w, h: t.h, sp: JC.hazardSprite(kind), phase: Math.random() * 6 });
  }

  function spawnPower(lane) {
    const kind = chance(0.5) ? 'shield' : 'double';
    S.powers.push({ kind, lane, x: laneX(lane), y: -40, sp: JC.powerSprite(kind), phase: 0 });
  }

  function spawnRow() {
    const lapK = Math.min(1, (S.lap - 1) / 12);
    const spF = S.speed / BASE_SPEED;
    S.rowGap = (S.demo ? 230 : 300 - 70 * lapK) * Math.pow(spF, 0.55) * rand(0.8, 1.25);
    S.safeLane = clamp(S.safeLane + randi(-1, 1), 0, 4);
    const lanes = JC.shuffle([0, 1, 2, 3, 4]);
    const used = new Set();
    const left = S.lapTarget - S.lapSpawned;
    if (left > 0) {
      const r = Math.random();
      let n = r < 0.5 ? 1 : r < 0.88 ? 2 : 3;
      n = Math.min(n, left);
      for (const lane of lanes) {
        if (n <= 0) break;
        if (!laneClear(lane, S.cars, 90)) continue;
        spawnCar(lane); used.add(lane); n--;
      }
    }
    const hzP = S.demo ? 0.35 : Math.min(0.62, 0.22 + 0.04 * (S.lap - 1));
    if (S.t > 2.5 && Math.random() < hzP) {
      let n = 1 + (S.lap >= 3 && chance(0.35) ? 1 : 0) + (S.lap >= 7 && chance(0.3) ? 1 : 0);
      for (const lane of lanes) {
        if (n <= 0) break;
        if (lane === S.safeLane || used.has(lane) || !laneClear(lane, S.hazards, 80)) continue;
        spawnHazard(lane, -30 - rand(0, 80)); used.add(lane); n--;
      }
    }
    S.powerCooldown -= 1;
    if (!S.demo && S.powerCooldown <= 0 && chance(0.12) && !S.powers.length) {
      const lane = !used.has(S.safeLane) ? S.safeLane : lanes.find(l => !used.has(l));
      if (lane !== undefined) { spawnPower(lane); S.powerCooldown = 10; }
    }
  }

  // ---------------------------------------------------------------- effects
  function part(o) { if (S.parts.length < 520) S.parts.push(o); }

  function sparks(x, y, n, spd, col) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), v = rand(0.3, 1) * spd;
      part({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.25, 0.6), max: 0.6, size: rand(1.2, 2.6), col: col || pick(['#fff3b0', '#ffd23f', '#ff9f1c']), kind: 'spark', drag: 3 });
    }
  }

  function explosion(x, y, big) {
    const k = big ? 1.6 : 1;
    for (let i = 0; i < 34 * k; i++) {
      const a = rand(0, Math.PI * 2), v = rand(20, 190) * k;
      part({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.4, 0.9), max: 0.9, size: rand(8, 20) * k, col: pick(['#fff1a8', '#ffd23f', '#ff9f1c', '#ff5400']), kind: 'fire', drag: 2.4 });
    }
    for (let i = 0; i < 18 * k; i++) {
      const a = rand(0, Math.PI * 2), v = rand(10, 90) * k;
      part({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: rand(1, 2), max: 2, size: rand(10, 24) * k, col: pick(['#3a3a3a', '#555', '#2a2a2a']), kind: 'smoke', drag: 1.2 });
    }
    sparks(x, y, 30 * k, 420 * k);
    for (let i = 0; i < 12 * k; i++) {
      const a = rand(0, Math.PI * 2), v = rand(120, 320);
      part({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.6, 1.2), max: 1.2, size: rand(2, 5), col: '#1a1a1a', kind: 'chunk', drag: 1.6, rot: rand(0, 6), vr: rand(-12, 12) });
    }
    part({ x, y, vx: 0, vy: 0, life: 0.5, max: 0.5, size: 90 * k, col: '#fff', kind: 'ring', drag: 0 });
    S.scorch.push({ x, y, r: 30 * k });
  }

  function popup(x, y, text, col, size, sub) {
    S.pops.push({ x, y, text, col: col || '#ffcc4d', size: size || 20, sub, life: 1.1, max: 1.1 });
  }

  function toast(main, sub) {
    if (S.demo) return;
    const el = $('toast');
    el.innerHTML = '';
    el.append(main);
    if (sub) { const s = document.createElement('small'); s.textContent = sub; el.append(s); }
    el.hidden = false;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { el.hidden = true; }, 1950);
  }

  // ---------------------------------------------------------------- crashes
  function crashCar(c, byPlayer) {
    S.cars.splice(S.cars.indexOf(c), 1);
    S.lapDone++;
    const p = S.player;
    const size = c.h / 158;
    if (byPlayer) {
      S.crashed++;
      S.combo++;
      S.maxCombo = Math.max(S.maxCombo, S.combo);
      S.mult = 1 + Math.min(4, Math.floor((S.combo - 1) / 5));
      const pts = c.pts * S.mult * (p.dbl > 0 ? 2 : 1);
      S.score += pts;
      popup(c.x, c.y - c.h / 2, '+' + pts, c.type === 'golden' ? '#ffe066' : (c.pts >= 100 ? '#ffcc4d' : '#ffffff'), c.pts >= 100 ? 26 : 20, S.mult > 1 ? 'x' + S.mult : null);
      if (S.combo % 5 === 0) toast(`STREAK ×${S.mult}`, `${S.combo} cars in a row`);
      audio.crash(size); audio.coin(S.combo);
      vibrate(c.pts >= 100 ? 35 : 18);
      p.bump = 1;
      S.shake = Math.max(S.shake, 5 + size * 7);
      if (c.type === 'golden') { toast('GOLDEN CAR!', '+500 jackpot'); for (let i = 0; i < 30; i++) part({ x: c.x, y: c.y, vx: rand(-160, 160), vy: rand(-220, 60), life: rand(0.6, 1.2), max: 1.2, size: rand(2, 4), col: pick(['#ffe066', '#fff6cf', '#f6c445']), kind: 'spark', drag: 1.5 }); }
    } else {
      explosion(c.x, c.y, false);
      audio.crash(size);
    }
    const dir = Math.sign(c.x - p.x) || (chance(0.5) ? 1 : -1);
    S.wrecks.push({
      sp: c.sp, x: c.x, y: c.y, w: c.w, h: c.h,
      vx: dir * rand(70, 190) * (byPlayer ? 1 : 0.4), vy: byPlayer ? -rand(160, 300) : 0,
      rot: 0, vr: dir * rand(3, 8), t: 0, smoke: 0,
    });
    sparks(c.x, c.y + c.h / 2 - 6, 22, 300);
    for (let i = 0; i < 10; i++) part({ x: c.x + rand(-c.w / 2, c.w / 2), y: c.y + rand(-c.h / 3, c.h / 3), vx: rand(-140, 140), vy: rand(-200, 40), life: rand(0.4, 0.8), max: 0.8, size: rand(1.5, 3), col: '#cfe8ff', kind: 'glass', drag: 2 });
    for (let i = 0; i < 6; i++) part({ x: c.x, y: c.y, vx: rand(-160, 160), vy: rand(-220, 60), life: rand(0.5, 1), max: 1, size: rand(2.5, 5), col: c.col, kind: 'chunk', drag: 2, rot: rand(0, 6), vr: rand(-10, 10) });
  }

  function hitHazard(h) {
    S.hazards.splice(S.hazards.indexOf(h), 1);
    const p = S.player;
    explosion(h.x, h.y, true);
    if (S.god) return;
    if (p.shield > 0) {
      p.shield = 0;
      audio.explode(); audio.shieldPop();
      S.shake = 16; S.flash = 0.5;
      vibrate([40, 30, 60]);
      toast('SHIELD SAVED YOU', 'Next one counts');
      return;
    }
    killPlayer(h);
  }

  function killPlayer(h) {
    const p = S.player;
    p.alive = false;
    p.spin = (Math.sign(p.x - h.x) || 1) * rand(5, 8);
    p.vx = (Math.sign(p.x - h.x) || 1) * 120;
    S.cause = h.kind;
    S.causeLoc = S.propLoc;
    S.shake = 26; S.flash = 1;
    S.targetSpeed = 0;
    S.deathT = 0;
    audio.explode(); audio.stopEngine();
    vibrate([90, 50, 260]);
    explosion(p.x, p.y - 20, true);
    if (S.demo) { setTimeout(() => { if (state === 'title') newRun(true); }, 1600); return; }
    state = 'dying';
  }

  // ---------------------------------------------------------------- laps & locations
  function nextLocation() {
    if (!S.queue.length) S.queue = JC.shuffle(JC.LOCATIONS.filter(l => l !== S.tileLoc));
    return S.queue.shift();
  }

  function completeLap() {
    const bonus = 100 * S.lap;
    if (!S.demo) {
      S.score += bonus;
      popup(W / 2, S.player.y - 150, `LAP ${S.lap} CLEAR`, '#ffffff', 24, '+' + bonus);
      audio.lap(); vibrate(30);
    }
    S.lap++;
    S.lapTarget = S.demo ? randi(8, 10) : randi(20, 25);
    S.lapSpawned = 0; S.lapDone = 0;
    S.targetSpeed = BASE_SPEED * (S.demo ? 1.25 : Math.min(MAX_SPEED_MUL, 1 + 0.09 * (S.lap - 1)));
    S.tileLoc = nextLocation();
    S.pendingSeam = true;
    S.lapPause = 2.4;
    evict([S.propLoc, S.tileLoc]);
  }

  function enterLocation() {
    const loc = S.tileLoc;
    S.propLoc = loc;
    if (!S.visited.includes(loc)) S.visited.push(loc);
    S.nextLandmark = rand(220, 480);
    S.nextSign = rand(1300, 2000);
    setWeather(loc);
    if (!S.demo) showBanner(loc, S.lap);
  }

  function setWeather(loc) {
    S.weather = loc.weather || null;
    S.wx = [];
    const n = S.weather === 'rain' ? 110 : S.weather === 'snow' ? 90 : S.weather === 'sand' ? 40 : 0;
    for (let i = 0; i < n; i++) S.wx.push(newWx(true));
  }
  function newWx(anywhere) {
    const y = anywhere ? rand(-20, H) : rand(-60, -10);
    if (S.weather === 'rain') return { x: rand(-40, W), y, l: rand(14, 26), v: rand(900, 1200) };
    if (S.weather === 'snow') return { x: rand(0, W), y, r: rand(1.2, 3.2), v: rand(60, 140), ph: rand(0, 6) };
    return { x: anywhere ? rand(0, W) : -60, y: rand(0, H), l: rand(30, 80), v: rand(200, 420) };
  }

  // ---------------------------------------------------------------- player control
  function moveLane(dir) {
    if (!S || !S.player.alive) return;
    const p = S.player;
    const to = clamp(p.lane + dir, 0, 4);
    if (to === p.lane) return;
    p.lane = to;
    if (!S.demo) { audio.whoosh(); S.hintT = Math.min(S.hintT, 0.6); }
  }

  function aiDrive(dt) {
    S.aiCool -= dt;
    if (S.aiCool > 0 || !S.player.alive) return;
    const p = S.player;
    const danger = (l, range) => S.hazards.some(h => h.lane === l && h.y < p.y + 70 && h.y > p.y - range);
    let bestL = p.lane, bestS = -1e9;
    for (let l = 0; l < 5; l++) {
      let sc = -Math.abs(l - p.lane) * 6;
      if (danger(l, 520)) sc -= 1000;
      for (const c of S.cars) if (c.lane === l && c.y < p.y && c.y > p.y - 650) sc += 25 + c.pts * 0.4;
      if (sc > bestS) { bestS = sc; bestL = l; }
    }
    if (bestL !== p.lane) {
      const step = Math.sign(bestL - p.lane);
      if (!danger(p.lane + step, 160)) moveLane(step);
    }
    S.aiCool = rand(0.14, 0.24);
  }

  // ---------------------------------------------------------------- update
  function update(dt) {
    S.t += dt;
    const p = S.player;
    S.speed += (S.targetSpeed - S.speed) * Math.min(1, dt * (p.alive ? 0.8 : 1.6));
    const dy = S.speed * dt;
    if (p.alive) S.topKmh = Math.max(S.topKmh, S.speed * KMH);

    updateDayNight(dt);

    // ground tiles
    for (const t of S.tiles) t.y += dy;
    S.tiles = S.tiles.filter(t => t.y < H + 1);
    let top = Infinity;
    for (const t of S.tiles) top = Math.min(top, t.y);
    while (top > -SEG) {
      top -= SEG;
      if (S.pendingSeam) {
        S.pendingSeam = false;
        S.seamY = top + SEG;
        addOverhead('welcome', S.seamY, { loc: S.tileLoc, lap: S.lap });
      }
      S.tiles.push({ y: top, loc: S.tileLoc, v: randi(0, TILE_VARIANTS - 1) });
    }
    // city far below a flyover, scrolling slower for depth
    const bdy = dy * 0.55;
    for (const b of S.below) b.y += bdy;
    S.below = S.below.filter(b => b.y < H + 1);
    let btop = Infinity;
    for (const b of S.below) btop = Math.min(btop, b.y);
    while (btop > -SEG) { btop -= SEG; S.below.push({ y: btop, v: randi(0, 2) }); }

    if (S.seamY !== null) {
      S.seamY += dy;
      if (S.seamY >= 0) { S.seamY = null; enterLocation(); }
    }

    scrollProps(dy);
    spawnProps(dy);
    for (const o of S.over) o.y += dy;
    S.over = S.over.filter(o => o.y - 120 < H);
    for (const s of S.scorch) s.y += dy;
    S.scorch = S.scorch.filter(s => s.y - s.r < H);

    // overhead signage for the current place
    if (S.seamY === null && !S.pendingSeam) {
      S.nextSign -= dy;
      if (S.nextSign <= 0) {
        const names = JC.shuffle(S.propLoc.signs);
        addOverhead('dir', -70, { loc: S.propLoc, a: names[0], b: names[1] || names[0] });
        S.nextSign = rand(1800, 2800);
      }
      if (S.propLoc.style === 'himalaya') {
        S.nextFlags -= dy;
        if (S.nextFlags <= 0) { addOverhead('flags', -50, { seed: randi(1, 4) }); S.nextFlags = rand(420, 800); }
      }
    }

    // traffic spawning
    if (S.lapPause > 0) S.lapPause -= dt;
    else if (p.alive) {
      S.rowGap -= dy;
      if (S.rowGap <= 0) spawnRow();
    }

    updatePlayer(dt);
    if (S.demo) aiDrive(dt);
    updateTraffic(dt, dy);
    if (p.alive) collide();
    updateEffects(dt, dy);

    if (S.lapPause <= 0 && S.lapSpawned >= S.lapTarget && S.lapDone >= S.lapTarget && p.alive) completeLap();

    if (!S.demo) {
      if (S.hintT > 0) { S.hintT -= dt; $('hint').hidden = S.hintT <= 0; }
      audio.engineSpeed(S.speed * KMH, Math.min(1, Math.abs(p.vx) / 900));
      updateHUD();
    }
  }

  function updateDayNight(dt) {
    const d = S.dn;
    d.t -= dt;
    const TR = 5;
    if (d.phase === 'day' && d.t <= 0) { d.phase = 'toNight'; d.t = TR; toast('NIGHT RIDE', 'Traffic glows neon after dark'); }
    else if (d.phase === 'toNight') { d.n = clamp(1 - d.t / TR, 0, 1); if (d.t <= 0) { d.phase = 'night'; d.n = 1; d.t = S.demo ? rand(10, 14) : rand(22, 32); } }
    else if (d.phase === 'night' && d.t <= 0) { d.phase = 'toDay'; d.t = TR; toast('SUNRISE', 'Back to daylight'); }
    else if (d.phase === 'toDay') { d.n = clamp(d.t / TR, 0, 1); if (d.t <= 0) { d.phase = 'day'; d.n = 0; d.t = S.demo ? rand(12, 16) : rand(30, 45); } }
    if (!S.demo && (S.t % 0.5) < dt) audio.setNight(d.n);
  }

  function updatePlayer(dt) {
    const p = S.player;
    if (p.alive) {
      const tx = laneX(p.lane);
      const k = 1 - Math.exp(-dt * (14 + S.speed / 60));
      const nx = lerp(p.x, tx, k);
      p.vx = (nx - p.x) / Math.max(dt, 1e-4);
      p.x = nx;
      p.tilt = lerp(p.tilt, clamp(p.vx / 2400, -0.22, 0.22), 1 - Math.exp(-dt * 18));
      p.bump = Math.max(0, p.bump - dt * 5);
      if (p.shield > 0) p.shield = Math.max(0, p.shield - dt);
      if (p.dbl > 0) p.dbl = Math.max(0, p.dbl - dt);
      // exhaust puffs
      if (Math.random() < dt * 14) part({ x: p.x + rand(-6, 6), y: p.y + 52, vx: rand(-10, 10), vy: rand(40, 90), life: 0.5, max: 0.5, size: rand(3, 6), col: '#9a9a9a', kind: 'puff', drag: 1 });
    } else {
      p.rot += p.spin * dt;
      p.spin *= Math.exp(-dt * 1.5);
      p.x += p.vx * dt; p.vx *= Math.exp(-dt * 2);
      p.burnt = Math.min(1, p.burnt + dt * 2);
      if (Math.random() < dt * 30) part({ x: p.x + rand(-14, 14), y: p.y + rand(-30, 30), vx: rand(-20, 20), vy: rand(-80, -30), life: rand(0.6, 1.2), max: 1.2, size: rand(6, 14), col: pick(['#ff9f1c', '#ffd23f', '#ff5400']), kind: 'fire', drag: 1 });
      if (Math.random() < dt * 18) part({ x: p.x + rand(-10, 10), y: p.y + rand(-20, 20), vx: rand(-20, 20), vy: rand(-60, -20), life: rand(1, 2), max: 2, size: rand(10, 20), col: '#333', kind: 'smoke', drag: 0.8 });
    }
  }

  function updateTraffic(dt, dy) {
    const p = S.player;
    for (let i = S.cars.length - 1; i >= 0; i--) {
      const c = S.cars[i];
      c.y += S.speed * (1 - c.fwd) * dt;
      // later laps: traffic changes lanes (with indicators)
      if (S.lap >= 3 || S.demo) {
        c.switchT -= dt;
        if (c.switchT <= 0 && c.blink <= 0 && c.y > 40 && c.y < p.y - 260) {
          const to = c.lane + (chance(0.5) ? 1 : -1);
          if (to >= 0 && to <= 4 && !S.cars.some(o => o !== c && o.lane === to && Math.abs(o.y - c.y) < (o.h + c.h) / 2 + 30)) {
            c.blink = 0.7; c.toLane = to;
          }
          c.switchT = rand(3, 7);
        }
        if (c.blink > 0) {
          c.blink -= dt;
          if (c.blink <= 0) { c.lane = c.toLane; c.tx = laneX(c.lane); }
        }
      }
      c.x = lerp(c.x, c.tx, 1 - Math.exp(-dt * 4));
      if (c.type === 'golden' && Math.random() < dt * 20) part({ x: c.x + rand(-18, 18), y: c.y + rand(-30, 30), vx: 0, vy: rand(-30, 30), life: 0.5, max: 0.5, size: rand(1.5, 3), col: '#fff6cf', kind: 'spark', drag: 1 });
      if (c.y - c.h / 2 > H) {
        S.cars.splice(i, 1);
        S.lapDone++;
        if (p.alive && S.combo > 0 && !S.demo) { if (S.combo >= 5) toast('STREAK LOST', 'A car got past you'); }
        S.combo = 0; S.mult = 1;
      }
    }
    for (let i = S.hazards.length - 1; i >= 0; i--) {
      const h = S.hazards[i];
      h.y += dy;
      if (Math.random() < dt * 16) {
        const sp = JC.HAZARDS[h.kind].spark;
        part({ x: h.x - h.w / 2 + sp[0], y: h.y - h.h / 2 + sp[1], vx: rand(-40, 40), vy: rand(-60, 10), life: rand(0.2, 0.4), max: 0.4, size: rand(1, 2), col: pick(['#fff3b0', '#ffae00']), kind: 'spark', drag: 2 });
      }
      if (h.y - h.h > H) S.hazards.splice(i, 1);
    }
    for (let i = S.powers.length - 1; i >= 0; i--) {
      const w = S.powers[i];
      w.y += dy; w.phase += dt;
      if (w.y - 40 > H) S.powers.splice(i, 1);
    }
    // cars that drive into bombs blow up
    for (const h of S.hazards.slice()) {
      for (const c of S.cars) {
        if (Math.abs(c.x - h.x) < c.w / 2 + 10 && Math.abs(c.y - h.y) < c.h / 2 + 10) {
          S.hazards.splice(S.hazards.indexOf(h), 1);
          crashCar(c, false);
          break;
        }
      }
    }
  }

  function collide() {
    const p = S.player;
    const pw = 23, ph = 47;
    for (const c of S.cars.slice()) {
      if (Math.abs(c.x - p.x) < pw + c.w / 2 - 4 && Math.abs(c.y - p.y) < ph + c.h / 2 - 4) crashCar(c, true);
    }
    for (const h of S.hazards.slice()) {
      const dx = Math.max(Math.abs(h.x - p.x) - (pw - 3), 0), dyy = Math.max(Math.abs(h.y - p.y) - (ph - 4), 0);
      if (dx * dx + dyy * dyy < 13 * 13) { hitHazard(h); if (!p.alive) return; }
    }
    for (const w of S.powers.slice()) {
      if (Math.abs(w.x - p.x) < pw + 16 && Math.abs(w.y - p.y) < ph + 16) {
        S.powers.splice(S.powers.indexOf(w), 1);
        audio.power(); vibrate(20);
        if (w.kind === 'shield') { p.shield = 12; toast('SHIELD ON', 'Survives one bomb for 12 s'); }
        else { p.dbl = 10; toast('2× POINTS', 'Every crash pays double for 10 s'); }
        sparks(w.x, w.y, 24, 240, JC.POWERUPS[w.kind].color);
      }
    }
  }

  function updateEffects(dt, dy) {
    for (let i = S.parts.length - 1; i >= 0; i--) {
      const q = S.parts[i];
      q.life -= dt;
      if (q.life <= 0) { S.parts.splice(i, 1); continue; }
      const dr = Math.exp(-dt * q.drag);
      q.vx *= dr; q.vy *= dr;
      q.x += q.vx * dt; q.y += q.vy * dt + (q.kind === 'puff' || q.kind === 'chunk' || q.kind === 'glass' ? dy : dy * 0.85);
      if (q.vr) q.rot += q.vr * dt;
    }
    for (let i = S.wrecks.length - 1; i >= 0; i--) {
      const w = S.wrecks[i];
      w.t += dt;
      w.vy += (S.speed - w.vy) * Math.min(1, dt * 1.8);
      w.vx *= Math.exp(-dt * 2.2); w.vr *= Math.exp(-dt * 1.8);
      w.x += w.vx * dt; w.y += w.vy * dt; w.rot += w.vr * dt;
      w.smoke -= dt;
      if (w.smoke <= 0 && w.t < 2.5) { w.smoke = 0.08; part({ x: w.x + rand(-8, 8), y: w.y + rand(-10, 10), vx: rand(-15, 15), vy: rand(-50, -20), life: rand(0.6, 1.1), max: 1.1, size: rand(6, 12), col: '#4a4a4a', kind: 'smoke', drag: 0.8 }); }
      if (w.y - w.h > H || w.x < -80 || w.x > W + 80) S.wrecks.splice(i, 1);
    }
    for (let i = S.pops.length - 1; i >= 0; i--) {
      const q = S.pops[i];
      q.life -= dt; q.y -= 50 * dt;
      if (q.life <= 0) S.pops.splice(i, 1);
    }
    S.shake = Math.max(0, S.shake - dt * 40);
    S.flash = Math.max(0, S.flash - dt * 2.2);

    // weather
    if (S.weather) {
      for (const w of S.wx) {
        if (S.weather === 'rain') { w.y += w.v * dt; w.x += w.v * 0.18 * dt; if (w.y > H + 20) Object.assign(w, newWx(false)); }
        else if (S.weather === 'snow') { w.y += (w.v + S.speed * 0.25) * dt; w.ph += dt * 2; w.x += Math.sin(w.ph) * 20 * dt; if (w.y > H + 10) Object.assign(w, newWx(false)); }
        else { w.x += w.v * dt; w.y += dy * 0.3; if (w.x > W + 80 || w.y > H) Object.assign(w, newWx(false)); }
      }
    }
    // sun glints on water
    for (let budget = dt * 22; budget > 0; budget--) {
      if (budget < 1 && Math.random() > budget) break;
      const y = rand(0, H);
      const tile = S.tiles.find(t => y >= t.y && y < t.y + SEG);
      const spans = tile && JC.waterSpans(tile.loc);
      if (!spans) continue;
      const s = pick(spans);
      S.glints.push({ x: rand(s[0], s[1]), y, life: 0.6, max: 0.6 });
    }
    for (let i = S.glints.length - 1; i >= 0; i--) { const g = S.glints[i]; g.life -= dt; g.y += dy; if (g.life <= 0) S.glints.splice(i, 1); }

    if (state === 'dying') {
      S.deathT += dt;
      if (S.deathT > 1.9) gameOver();
    }
  }

  // ---------------------------------------------------------------- render
  function drawDN(pair, x, y, n, rot, sc) {
    const dayA = n < 0.6 ? 1 : 1 - (n - 0.6) / 0.4;
    if (dayA > 0.01) { ctx.globalAlpha = dayA; JC.drawC(ctx, pair.day, x, y, rot, sc); }
    if (n > 0.01) { ctx.globalAlpha = n; JC.drawC(ctx, pair.night, x, y, rot, sc); }
    ctx.globalAlpha = 1;
  }
  function drawProp(p, sp) {
    ctx.drawImage(sp.c, p.x - p.pad, p.y - p.h - p.pad, p.w + p.pad * 2, p.h + p.pad * 2);
  }

  function render() {
    const s = JC.R.scale;
    const n = JC.ease(S.dn.n);
    const t = S.t;
    const sx = S.shake ? rand(-1, 1) * S.shake : 0, sy = S.shake ? rand(-1, 1) * S.shake : 0;
    ctx.setTransform(s, 0, 0, s, sx * s, sy * s);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    // city below the flyover
    const flyVisible = S.tiles.some(tl => tl.loc.terrain === 'flyover');
    if (flyVisible) {
      const bl = S.tiles.find(tl => tl.loc.terrain === 'flyover').loc;
      for (const b of S.below) ctx.drawImage(belowSprite(bl, b.v).c, 0, b.y, W, SEG + 0.6);
      ctx.fillStyle = 'rgba(10,16,30,0.28)'; ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = '#1b1d22'; ctx.fillRect(0, 0, W, H);
    }

    for (const tl of S.tiles) ctx.drawImage(tileSprite(tl.loc, tl.v).c, 0, tl.y, W, SEG + 0.6);
    if (flyVisible) { // shadow of the deck on the city below
      for (const tl of S.tiles) if (tl.loc.terrain === 'flyover') {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(ROAD_X - 30, tl.y, 18, SEG + 0.6); ctx.fillRect(RX2 + 12, tl.y, 22, SEG + 0.6);
      }
    }

    // scorch marks
    for (const sc of S.scorch) {
      const g = ctx.createRadialGradient(sc.x, sc.y, 2, sc.x, sc.y, sc.r);
      g.addColorStop(0, 'rgba(10,8,6,0.75)'); g.addColorStop(1, 'rgba(10,8,6,0)');
      ctx.fillStyle = g; ctx.fillRect(sc.x - sc.r, sc.y - sc.r, sc.r * 2, sc.r * 2);
    }
    // overhead shadows on the road
    for (const o of S.over) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(ROAD_X - 20, o.y + 18, ROAD_W + 40, 16); }

    // roadside props, far to near
    S.props.sort((a, b) => a.y - b.y);
    for (const p of S.props) drawProp(p, p.day);

    // shadows under traffic (daylight only)
    if (n < 0.98) {
      ctx.globalAlpha = 1 - n;
      for (const c of S.cars) JC.drawC(ctx, JC.shadowSprite(c.w, c.h), c.x + 4, c.y + 6);
      for (const h of S.hazards) JC.drawC(ctx, JC.shadowSprite(30, 30), h.x + 3, h.y + 8);
      if (S.player.alive) JC.drawC(ctx, JC.shadowSprite(JC.HUMMER.w, JC.HUMMER.h), S.player.x + 5, S.player.y + 7, S.player.tilt);
      ctx.globalAlpha = 1;
    }

    // darkness, with a sunset tint while it changes
    if (n > 0.002) { ctx.fillStyle = `rgba(5,9,32,${0.72 * n})`; ctx.fillRect(-20, -20, W + 40, H + 40); }
    const dusk = (S.dn.phase === 'toNight' || S.dn.phase === 'toDay') ? Math.sin(Math.PI * S.dn.n) : 0;
    if (dusk > 0.01) { ctx.fillStyle = `rgba(255,110,40,${0.2 * dusk})`; ctx.fillRect(-20, -20, W + 40, H + 40); }

    // lights (additive)
    ctx.globalCompositeOperation = 'lighter';
    if (n > 0.01) {
      ctx.globalAlpha = n;
      if (flyVisible) { // city lights below show only beside the deck, never through it
        ctx.save();
        ctx.beginPath();
        for (const tl of S.tiles) if (tl.loc.terrain === 'flyover') {
          ctx.rect(0, tl.y, ROAD_X - 12, SEG + 0.6); ctx.rect(RX2 + 12, tl.y, W - RX2 - 12, SEG + 0.6);
        }
        ctx.clip();
        for (const b of S.below) ctx.drawImage(belowGlow(b.v).c, 0, b.y, W, SEG);
        ctx.restore();
      }
      const pool = JC.poolSprite();
      for (const p of S.props) {
        if (p.glow) drawProp(p, p.glow);
        if (p.pool) ctx.drawImage(pool.c, p.pool.x - 50, p.y - 38, 100, 70);
      }
      if (S.player.alive) {
        const beam = JC.beamSprite();
        ctx.save(); ctx.translate(S.player.x, S.player.y - 50); ctx.rotate(S.player.tilt);
        ctx.drawImage(beam.c, -100, -300, 200, 300); ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    for (const g of S.glints) {
      const a = Math.sin(Math.PI * (g.life / g.max));
      ctx.fillStyle = `rgba(255,255,255,${0.75 * a * (1 - n * 0.6)})`;
      ctx.fillRect(g.x - 2, g.y - 0.5, 4, 1); ctx.fillRect(g.x - 0.5, g.y - 2, 1, 4);
    }
    ctx.globalCompositeOperation = 'source-over';

    // hazards and pick-ups
    const danger = JC.dangerSprite();
    for (const h of S.hazards) {
      const pulse = 0.85 + 0.2 * Math.sin(t * 9 + h.phase);
      ctx.globalAlpha = 0.55 + 0.35 * n;
      JC.drawC(ctx, danger, h.x, h.y + 4, 0, pulse);
      ctx.globalAlpha = 1;
      drawDN(h.sp, h.x, h.y, n, Math.sin(t * 3 + h.phase) * 0.06);
      const sp = JC.HAZARDS[h.kind].spark;
      const fx = h.x - h.w / 2 + sp[0], fy = h.y - h.h / 2 + sp[1];
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,${180 + Math.random() * 70 | 0},60,${0.6 + Math.random() * 0.4})`;
      JC.circle(ctx, fx, fy, 2.5 + Math.random() * 2.5); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    for (const w of S.powers) drawDN(w.sp, w.x, w.y + Math.sin(w.phase * 4) * 3, n, 0, 1 + Math.sin(w.phase * 6) * 0.06);

    // traffic
    for (const c of S.cars) {
      drawDN(c.sp, c.x, c.y, n, (c.tx - c.x) * 0.006);
      if (c.blink > 0 && Math.floor(t * 6) % 2 === 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,170,0,0.95)';
        const bx = c.toLane > c.lane ? c.x + c.w / 2 - 3 : c.x - c.w / 2 + 3;
        JC.circle(ctx, bx, c.y - c.h / 2 + 4, 3.2); ctx.fill(); JC.circle(ctx, bx, c.y + c.h / 2 - 4, 3.2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      if (c.type === 'police') {
        ctx.globalCompositeOperation = 'lighter';
        const on = Math.floor(t * 7) % 2;
        const g = ctx.createRadialGradient(c.x + (on ? 6 : -6), c.y - c.h * 0.02, 0, c.x + (on ? 6 : -6), c.y, 22);
        g.addColorStop(0, on ? 'rgba(60,120,255,0.9)' : 'rgba(255,40,60,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(c.x - 30, c.y - 24, 60, 48);
        ctx.globalCompositeOperation = 'source-over';
      }
      JC.drawC(ctx, JC.badgeSprite(c.pts, n > 0.5), c.x, c.y + (c.h > 120 ? -c.h * 0.18 : 2));
    }

    // wrecks tumbling away
    for (const w of S.wrecks) {
      const air = w.t < 0.55 ? Math.sin(Math.PI * w.t / 0.55) : 0;
      const sc = 1 + air * 0.28;
      ctx.save();
      drawDN(w.sp, w.x, w.y - air * 8, n, w.rot, sc);
      ctx.fillStyle = `rgba(20,14,10,${Math.min(0.55, w.t * 0.8)})`;
      ctx.translate(w.x, w.y - air * 8); ctx.rotate(w.rot); ctx.scale(sc, sc);
      JC.rr(ctx, -w.w / 2 + 2, -w.h / 2 + 2, w.w - 4, w.h - 4, 7); ctx.fill();
      ctx.restore();
    }

    drawPlayer(n, t);

    // particles
    for (const q of S.parts) {
      const a = clamp(q.life / q.max, 0, 1);
      if (q.kind === 'smoke' || q.kind === 'puff') {
        ctx.globalAlpha = a * (q.kind === 'puff' ? 0.25 : 0.55);
        ctx.fillStyle = q.col;
        JC.circle(ctx, q.x, q.y, q.size * (1.6 - a * 0.6)); ctx.fill();
      }
    }
    for (const q of S.parts) {
      const a = clamp(q.life / q.max, 0, 1);
      if (q.kind === 'chunk' || q.kind === 'glass') {
        ctx.globalAlpha = a; ctx.fillStyle = q.col;
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot || 0); ctx.fillRect(-q.size / 2, -q.size / 3, q.size, q.size * 0.66); ctx.restore();
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const q of S.parts) {
      const a = clamp(q.life / q.max, 0, 1);
      if (q.kind === 'spark') {
        ctx.globalAlpha = a; ctx.strokeStyle = q.col; ctx.lineWidth = q.size;
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 0.03, q.y - q.vy * 0.03); ctx.stroke();
      } else if (q.kind === 'fire') {
        ctx.globalAlpha = a * 0.8; ctx.fillStyle = q.col;
        JC.circle(ctx, q.x, q.y, q.size * (0.5 + (1 - a) * 0.8)); ctx.fill();
      } else if (q.kind === 'ring') {
        ctx.globalAlpha = a * 0.7; ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 4 * a + 1;
        JC.circle(ctx, q.x, q.y, q.size * (1 - a) + 10); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // overhead gantries and prayer flags
    for (const o of S.over) {
      let pair;
      if (o.kind === 'welcome') pair = { day: JC.makeWelcomeGantry(o.loc, o.lap, false), night: JC.makeWelcomeGantry(o.loc, o.lap, true) };
      else if (o.kind === 'dir') pair = { day: JC.makeDirectionGantry(o.loc, o.a, o.b, false), night: JC.makeDirectionGantry(o.loc, o.a, o.b, true) };
      else { const f = JC.makePrayerFlags(o.seed); pair = { day: f, night: f }; }
      const sp = pair.day;
      const y0 = o.y - sp.h + 30;
      ctx.drawImage(sp.c, -sp.pad, y0 - sp.pad, sp.w, sp.h);
      if (n > 0.01 && pair.night !== pair.day) { ctx.globalAlpha = n; ctx.drawImage(pair.night.c, -sp.pad, y0 - sp.pad, sp.w, sp.h); ctx.globalAlpha = 1; }
      else if (n > 0.01) { ctx.fillStyle = `rgba(5,9,32,${0.55 * n})`; ctx.fillRect(0, y0, W, sp.h - sp.pad * 2); }
    }

    // weather
    if (S.weather === 'rain') {
      ctx.strokeStyle = n > 0.5 ? 'rgba(170,200,255,0.35)' : 'rgba(200,215,235,0.45)'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const w of S.wx) { ctx.moveTo(w.x, w.y); ctx.lineTo(w.x - w.l * 0.18, w.y - w.l); }
      ctx.stroke();
    } else if (S.weather === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const w of S.wx) { JC.circle(ctx, w.x, w.y, w.r); ctx.fill(); }
    } else if (S.weather === 'sand') {
      ctx.strokeStyle = 'rgba(240,215,160,0.35)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const w of S.wx) { ctx.moveTo(w.x, w.y); ctx.lineTo(w.x - w.l, w.y + 3); }
      ctx.stroke();
    }

    // speed streaks at high speed
    const fast = (S.speed / BASE_SPEED - 1.5);
    if (fast > 0 && S.player.alive) {
      ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.25, fast * 0.3)})`; ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const x = (i % 2 ? RX2 + 10 + (i * 37) % 60 : 10 + (i * 53) % 60);
        const y = ((t * S.speed * 1.4 + i * 211) % (H + 200)) - 100;
        ctx.moveTo(x, y); ctx.lineTo(x, y + 60 + fast * 40);
      }
      ctx.stroke();
    }

    // score popups
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const q of S.pops) {
      const a = clamp(q.life / q.max, 0, 1);
      const sc = q.life > q.max - 0.15 ? 1 + (q.life - (q.max - 0.15)) * 4 : 1;
      ctx.globalAlpha = Math.min(1, a * 1.6);
      ctx.font = `${Math.round(q.size * sc)}px ${JC.FONT_DISPLAY}`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(q.text, q.x, q.y);
      ctx.fillStyle = q.col; ctx.fillText(q.text, q.x, q.y);
      if (q.sub) {
        ctx.font = `${Math.round(q.size * 0.62)}px ${JC.FONT_DISPLAY}`;
        ctx.strokeText(q.sub, q.x, q.y + q.size * 0.85); ctx.fillStyle = '#ffd400'; ctx.fillText(q.sub, q.x, q.y + q.size * 0.85);
      }
    }
    ctx.globalAlpha = 1;

    // vignette at night, white flash on explosions
    if (n > 0.05) {
      const g = ctx.createRadialGradient(W / 2, H * 0.6, H * 0.3, W / 2, H * 0.6, H * 0.85);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,10,${0.45 * n})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (S.flash > 0) { ctx.fillStyle = `rgba(255,244,214,${S.flash * 0.85})`; ctx.fillRect(-20, -20, W + 40, H + 40); }
  }

  function drawPlayer(n, t) {
    const p = S.player;
    const hs = JC.hummerSprites();
    const y = p.y + p.bump * 3;
    const rot = p.alive ? p.tilt : p.rot;
    if (n > 0.01 && p.alive) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = n * (0.75 + 0.15 * Math.sin(t * 5));
      JC.drawC(ctx, hs.under, p.x, y, rot);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    if (p.dbl > 0) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 10);
      const g = ctx.createRadialGradient(p.x, y, 10, p.x, y, 70);
      g.addColorStop(0, 'rgba(255,204,77,0.6)'); g.addColorStop(1, 'rgba(255,204,77,0)');
      ctx.fillStyle = g; ctx.fillRect(p.x - 70, y - 70, 140, 140);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    JC.drawC(ctx, hs.day, p.x, y, rot);
    if (n > 0.01) { ctx.globalAlpha = n; JC.drawC(ctx, hs.night, p.x, y, rot); ctx.globalAlpha = 1; }
    if (p.burnt > 0) {
      ctx.save(); ctx.translate(p.x, y); ctx.rotate(rot);
      ctx.fillStyle = `rgba(15,8,4,${0.6 * p.burnt})`; JC.rr(ctx, -26, -50, 52, 100, 8); ctx.fill();
      ctx.restore();
    }
    if (p.shield > 0) {
      const blink = p.shield < 3 ? (Math.floor(t * 8) % 2 ? 0.3 : 1) : 1;
      ctx.globalAlpha = blink * (0.8 + 0.2 * Math.sin(t * 6));
      JC.drawC(ctx, JC.bubbleSprite(), p.x, y, 0, 1 + Math.sin(t * 4) * 0.03);
      ctx.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- HUD
  function setText(id, v) {
    const c = S.hudCache;
    if (c[id] === v) return;
    c[id] = v;
    $(id).textContent = v;
  }
  function updateHUD() {
    const p = S.player;
    setText('hud-score', JC.fmt(S.score));
    setText('hud-best', JC.fmt(Math.max(best, S.score)));
    setText('hud-lap', String(S.lap));
    setText('hud-cars', String(Math.min(S.lapDone, S.lapTarget)));
    setText('hud-target', String(S.lapTarget));
    setText('hud-speed', String(Math.round(S.speed * KMH)));
    const w = Math.round(100 * Math.min(1, S.lapDone / S.lapTarget)) + '%';
    if (S.hudCache.bar !== w) { S.hudCache.bar = w; $('hud-bar').style.width = w; }
    if (S.hudCache.loc !== S.propLoc.id) {
      S.hudCache.loc = S.propLoc.id;
      $('hud-flag').src = JC.flagURL(S.propLoc.flag);
      $('hud-city').textContent = S.propLoc.city;
      $('hud-country').textContent = SHORT_COUNTRY[S.propLoc.country] || S.propLoc.country;
    }
    const comboOn = S.mult > 1 || S.combo >= 3;
    $('hud-combo').hidden = !comboOn;
    if (comboOn) {
      const m = '×' + S.mult;
      if (S.hudCache.mult !== m) { S.hudCache.mult = m; const el = $('hud-combo'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
      setText('hud-mult', m);
      setText('hud-streak', S.combo + ' STREAK');
    }
    const pw = (p.shield > 0 ? `<span class="power shield">SHIELD ${Math.ceil(p.shield)}s</span>` : '') +
      (p.dbl > 0 ? `<span class="power double">2× ${Math.ceil(p.dbl)}s</span>` : '');
    if (S.hudCache.pw !== pw) { S.hudCache.pw = pw; $('hud-powers').innerHTML = pw; }
  }

  function showBanner(loc, lap) {
    const b = $('banner');
    $('bn-lap').textContent = 'LAP ' + lap;
    $('bn-flag').src = JC.flagURL(loc.flag);
    $('bn-city').textContent = loc.city;
    $('bn-country').textContent = loc.country;
    $('bn-tag').textContent = loc.tagline;
    $('bn-landmark').src = JC.landmarkURL(loc.landmark);
    $('bn-landmark').alt = JC.LANDMARK_NAMES[loc.landmark] || '';
    b.hidden = false;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(showBanner.t);
    showBanner.t = setTimeout(() => { b.hidden = true; }, 3700);
  }

  // ---------------------------------------------------------------- screens & flow
  function show(id) {
    ['screen-title', 'screen-pause', 'screen-over'].forEach(s => { $(s).hidden = s !== id; });
  }

  function goTitle() {
    state = 'title';
    audio.stopEngine();
    newRun(true);
    show('screen-title');
    $('hud').hidden = true; $('hint').hidden = true; $('banner').hidden = true; $('toast').hidden = true;
    $('title-best').textContent = JC.fmt(best);
    syncToggles();
  }

  function startGame() {
    audio.init();
    audio.click();
    newRun(false);
    state = 'playing';
    show(null);
    $('hud').hidden = false;
    $('hint').hidden = false;
    audio.startEngine();
    audio.startMusic();
    audio.setNight(0);
    showBanner(S.propLoc, 1);
    vibrate(20);
  }

  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    $('pause-where').innerHTML = '';
    $('pause-where').append(`Lap ${S.lap} in `, Object.assign(document.createElement('b'), { textContent: `${S.propLoc.city}, ${S.propLoc.country}` }));
    show('screen-pause');
    syncToggles();
    audio.suspend();
  }
  function resume() {
    if (state !== 'paused') return;
    state = 'playing';
    show(null);
    audio.resume();
    lastT = performance.now();
  }

  function gameOver() {
    state = 'over';
    const isBest = S.score > best;
    if (isBest) { best = S.score; JC.store.set('best', best); }
    const what = S.cause === 'bomb' ? 'a bomb' : 'dynamite';
    const where = S.causeLoc;
    $('over-cause').innerHTML = '';
    $('over-cause').append(`You hit ${what} in `, Object.assign(document.createElement('b'), { textContent: `${where.city}, ${where.country}` }), '.');
    $('over-score').textContent = JC.fmt(S.score);
    $('over-new').hidden = !isBest || S.score === 0;
    $('st-laps').textContent = S.lap;
    $('st-cars').textContent = S.crashed;
    $('st-combo').textContent = S.maxCombo;
    $('st-speed').textContent = Math.round(S.topKmh) + ' km/h';
    const flags = $('st-flags');
    flags.innerHTML = '';
    S.visited.forEach(l => {
      const f = document.createElement('figure');
      const img = document.createElement('img'); img.src = JC.flagURL(l.flag); img.alt = '';
      f.append(img, l.city);
      flags.append(f);
    });
    $('hud').hidden = true; $('hint').hidden = true;
    show('screen-over');
    audio.stopMusic();
  }

  function syncToggles() {
    document.querySelectorAll('.toggle').forEach(b => {
      const k = b.dataset.toggle;
      const on = k === 'sound' ? audio.soundOn : k === 'music' ? audio.musicOn : vibeOn;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  // ---------------------------------------------------------------- input
  let ptr = null;
  app.addEventListener('pointerdown', e => {
    if (state !== 'playing' || e.target.closest('button, .screen')) return;
    ptr = { id: e.pointerId, x0: e.clientX, x: e.clientX, moved: false };
  });
  app.addEventListener('pointermove', e => {
    if (!ptr || e.pointerId !== ptr.id || state !== 'playing') return;
    const step = Math.max(26, cssW * 0.085);
    const dx = e.clientX - ptr.x;
    if (Math.abs(dx) >= step) { moveLane(Math.sign(dx)); ptr.x += Math.sign(dx) * step; ptr.moved = true; }
  });
  const endPtr = e => {
    if (!ptr || e.pointerId !== ptr.id) return;
    if (e.type === 'pointerup' && state === 'playing' && !ptr.moved && Math.abs(e.clientX - ptr.x0) < 14) {
      const r = canvas.getBoundingClientRect();
      moveLane(e.clientX < r.left + r.width / 2 ? -1 : 1);
    }
    ptr = null;
  };
  app.addEventListener('pointerup', endPtr);
  app.addEventListener('pointercancel', endPtr);

  window.addEventListener('keydown', e => {
    const k = e.key;
    if (state === 'playing') {
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') { moveLane(-1); e.preventDefault(); }
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') { moveLane(1); e.preventDefault(); }
      else if (k === 'p' || k === 'P' || k === 'Escape') pause();
    } else if (state === 'paused' && (k === 'p' || k === 'P' || k === 'Escape' || k === ' ')) resume();
    else if ((state === 'title' || state === 'over') && (k === ' ' || k === 'Enter') && !e.target.closest('button')) { e.preventDefault(); startGame(); }
  });

  $('btn-start').addEventListener('click', startGame);
  $('btn-again').addEventListener('click', startGame);
  $('btn-home').addEventListener('click', () => { audio.click(); goTitle(); });
  $('btn-pause').addEventListener('click', () => { audio.click(); pause(); });
  $('btn-resume').addEventListener('click', () => { audio.click(); resume(); });
  $('btn-quit').addEventListener('click', () => { audio.click(); audio.resume(); audio.stopMusic(); goTitle(); });
  document.querySelectorAll('.toggle').forEach(b => b.addEventListener('click', () => {
    audio.init();
    const k = b.dataset.toggle;
    if (k === 'sound') audio.setSound(!audio.soundOn);
    else if (k === 'music') audio.setMusic(!audio.musicOn);
    else { vibeOn = !vibeOn; JC.store.set('vibe', vibeOn); vibrate(25); }
    syncToggles();
    audio.click();
  }));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); audio.suspend(); }
    else if (state !== 'paused') audio.resume();
  });
  window.addEventListener('resize', resize);

  // Hooks for the Android wrapper: hardware back button and app pause.
  window.JCBack = () => {
    if (state === 'playing') { pause(); return 'handled'; }
    if (state === 'paused') { resume(); return 'handled'; }
    if (state === 'over' || state === 'dying') { goTitle(); return 'handled'; }
    return 'exit';
  };
  window.JCPause = () => { pause(); audio.suspend(); };

  // ---------------------------------------------------------------- main loop
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05, (now - lastT) / 1000 || 0);
    lastT = now;
    if (!S || state === 'boot') return;
    if (state === 'paused') { render(); return; }
    if (state === 'dying') dt *= S.deathT < 0.9 ? 0.35 : 0.8;
    if (state === 'over') dt *= 0.5;
    update(dt);
    render();
  }

  // Wait for the bundled fonts so text baked into sprites uses them.
  function boot() {
    resize();
    const fonts = document.fonts
      ? Promise.all([`20px ${JC.FONT_DISPLAY}`, `900 20px ${JC.FONT_SIGN}`, `700 12px ${JC.FONT_MONO}`].map(f => document.fonts.load(f).catch(() => null)))
      : Promise.resolve();
    Promise.race([fonts, new Promise(r => setTimeout(r, 1500))]).then(() => {
      JC.cache.clear();
      goTitle();
      lastT = performance.now();
    });
    requestAnimationFrame(frame);
  }
  JC.game = { start: startGame, pause, resume, get state() { return state; }, get run() { return S; }, moveLane };
  // Test hooks (used by the screenshot checks; harmless in play).
  JC.game.debug = {
    loc(id) {
      const l = JC.locById(id);
      S.tileLoc = S.propLoc = l;
      S.tiles.forEach(t => { t.loc = l; });
      S.props = []; S.zones = { L: { outer: 0, inner: 0 }, R: { outer: 0, inner: 0 } };
      S.nextLandmark = 120;
      for (let i = 0; i < (H + 60) / 24; i++) { scrollProps(24); spawnProps(24); }
      setWeather(l);
      S.hudCache = {};
    },
    night(v) { S.dn.n = v; S.dn.phase = v >= 1 ? 'night' : 'day'; S.dn.t = 999; },
    god() { S.god = true; },
    // Fast-forward the simulation (no rendering) — used to measure lap pacing.
    step(seconds, dt = 1 / 60) { for (let t = 0; t < seconds && S; t += dt) update(dt); },
  };
  boot();
})();
