/* Roadside props: buildings, trees, lamps, boats, villas… drawn in a 3/4 view, plus their night lights. */
'use strict';

(function () {
  const { shade, rrPath, glow } = JC;

  JC.STYLES = {
    nyc: { walls: ['#8b5a44', '#a0694f', '#6e4b3a', '#c9c2b6', '#9a8f84'], glass: ['#5b7a99', '#7f9bb3', '#46617d'], glassChance: 0.45, fh: [70, 190], rd: [26, 40], roof: ['#55575c', '#6a6c70'], items: ['watertower', 'ac', 'ac', 'vent'], lit: ['#ffd27a', '#fff1c1'], shop: true, awnings: ['#0b3d91', '#9b1c1c', '#14532d'] },
    paris: { walls: ['#e8dcc4', '#ddd0b4', '#efe6d2', '#e3d6bd'], glassChance: 0, fh: [60, 85], rd: [24, 32], roof: ['#6d7c8c', '#7d8b99'], mansard: true, items: ['chimney', 'chimney', 'chimney'], lit: ['#ffcf73'], shop: true, balcony: true, awnings: ['#9b1c1c', '#1c3f9b', '#245c2c', '#6b2a5c'], trees: true },
    london: { walls: ['#9c4a3a', '#b5654c', '#8a3f30', '#e9e3d6'], glassChance: 0.1, glass: ['#7a8a99'], fh: [50, 95], rd: [24, 34], roof: ['#4b5058', '#5a5f66'], items: ['chimney', 'chimney', 'ac'], lit: ['#ffd27a'], shop: true, sash: true, awnings: ['#14532d', '#7a1f1f', '#1f2f5a'], trees: true },
    india: { walls: ['#f4a7b9', '#f9d56e', '#7fd1c7', '#f6f1e7', '#c3e88d', '#ffb38a', '#b8c0ff'], glassChance: 0.08, glass: ['#7fa7c4'], fh: [40, 90], rd: [24, 36], roof: ['#cfc7b8', '#bdb5a6'], items: ['tank', 'tank', 'dish', 'laundry'], lit: ['#ffe9a8', '#b8f7ff'], shop: true, awnings: ['#e63946', '#2a9d8f', '#f4a261', '#3a86ff'], trees: true },
    thai: { walls: ['#f2e8cf', '#e9c46a', '#a8dadc', '#f4a261', '#fefae0'], glassChance: 0.15, glass: ['#8fb3c9'], fh: [40, 95], rd: [24, 34], roof: ['#b7b0a2'], items: ['tank', 'ac', 'ac'], lit: ['#ffd27a', '#ff7ad9', '#7af5ff'], shop: true, awnings: ['#e63946', '#ffb703', '#2a9d8f'], neonSigns: true },
    lagos: { walls: ['#f6bd60', '#84a59d', '#f28482', '#f5cac3', '#e9edc9'], glassChance: 0.15, glass: ['#7fa7c4'], fh: [40, 90], rd: [24, 34], roof: ['#a39e93'], items: ['tank', 'tank', 'dish'], lit: ['#ffe9a8'], shop: true, awnings: ['#1f8a3b', '#e63946', '#ffb703'] },
    dubai: { walls: ['#e9dcc3', '#d8c7a6'], glass: ['#9fc3d9', '#c9b79c', '#7fa7c4', '#d8e2ea'], glassChance: 0.85, fh: [110, 230], rd: [30, 44], roof: ['#c7c1b4'], items: ['helipad', 'ac', 'antenna'], lit: ['#cfe8ff', '#ffe2a8'] },
    sg: { walls: ['#f0f0ea', '#dfe7e2'], glass: ['#7fb3c8', '#9ad1d4', '#6c8ea4'], glassChance: 0.8, fh: [100, 210], rd: [30, 44], roof: ['#9fb39a'], items: ['garden', 'ac', 'helipad'], lit: ['#d4f1ff', '#fff1c1'] },
    shanghai: { walls: ['#d9d9d9'], glass: ['#6f8fb3', '#4f6f99', '#9db7d5', '#7d8fa8'], glassChance: 0.9, fh: [110, 230], rd: [30, 44], roof: ['#6b6f78'], items: ['ac', 'antenna', 'helipad'], lit: ['#7af5ff', '#ff7ad9', '#ffe27a'] },
  };

  // ---------- roof furniture (seen from above) ----------
  function roofItem(g, kind, x, y, r) {
    switch (kind) {
      case 'ac':
        g.fillStyle = '#9aa0a8'; g.fillRect(x - 5, y - 4, 10, 8);
        g.fillStyle = '#5d636b'; JC.circle(g, x, y, 2.6); g.fill(); break;
      case 'vent':
        g.fillStyle = '#7d828a'; JC.circle(g, x, y, 3); g.fill();
        g.fillStyle = '#3d4249'; JC.circle(g, x, y, 1.6); g.fill(); break;
      case 'tank': // black rooftop water tank
        g.fillStyle = '#121214'; JC.circle(g, x, y, 5); g.fill();
        g.strokeStyle = '#2c2c30'; g.lineWidth = 0.8; JC.circle(g, x, y, 3.2); g.stroke();
        g.fillStyle = '#2f2f33'; JC.circle(g, x, y, 1.3); g.fill(); break;
      case 'watertower': // NYC wooden water tower
        g.fillStyle = 'rgba(0,0,0,0.3)'; JC.circle(g, x + 3, y + 3, 7); g.fill();
        g.fillStyle = '#7a5235'; JC.circle(g, x, y, 7); g.fill();
        g.fillStyle = '#4f3524'; JC.circle(g, x, y, 4); g.fill();
        g.fillStyle = '#2f2016'; JC.circle(g, x, y, 1.4); g.fill(); break;
      case 'chimney':
        g.fillStyle = '#8a4a3a'; g.fillRect(x - 3, y - 4, 7, 8);
        g.fillStyle = '#2b2b2b'; g.fillRect(x - 2, y - 3, 2, 2); g.fillRect(x + 1, y - 3, 2, 2); break;
      case 'dish':
        g.fillStyle = '#e8e8e8'; JC.circle(g, x, y, 3.2); g.fill();
        g.fillStyle = '#b0b0b0'; JC.circle(g, x, y, 1); g.fill(); break;
      case 'helipad':
        g.fillStyle = '#3a3d44'; JC.circle(g, x, y, 11); g.fill();
        g.strokeStyle = '#f2f2f2'; g.lineWidth = 1; JC.circle(g, x, y, 9); g.stroke();
        g.fillStyle = '#ffd400'; g.font = `900 10px ${JC.FONT_SIGN}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('H', x, y + 1); break;
      case 'garden':
        g.fillStyle = '#5a8f3c'; g.fillRect(x - 10, y - 6, 20, 12);
        g.fillStyle = '#3f7a2a'; JC.circle(g, x - 5, y, 4); g.fill(); JC.circle(g, x + 4, y - 1, 5); g.fill(); break;
      case 'antenna':
        g.fillStyle = '#c0c4ca'; g.fillRect(x - 1, y - 6, 2, 12);
        g.fillStyle = '#e01b2a'; JC.circle(g, x, y - 6, 1.6); g.fill(); break;
      case 'laundry':
        g.strokeStyle = '#888'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x - 10, y); g.lineTo(x + 10, y); g.stroke();
        ['#e63946', '#f4c430', '#3a86ff', '#ffffff'].forEach((c, i) => { g.fillStyle = c; g.fillRect(x - 9 + i * 5, y, 3.5, 4); });
        break;
    }
  }

  // ---------- buildings (roof on top, front facade below) ----------
  JC.makeBuilding = (loc, side, r) => {
    const st = JC.STYLES[loc.style] || JC.STYLES.nyc;
    const glassy = st.glass && r() < st.glassChance;
    const w = Math.round(r.range(78, 112));
    const fh = Math.round(r.range(st.fh[0], glassy ? st.fh[1] : Math.min(st.fh[1], 120)));
    const rd = Math.round(r.range(st.rd[0], st.rd[1]));
    const h = rd + fh;
    const wall = glassy ? r.pick(st.glass) : r.pick(st.walls);
    const roofCol = r.pick(st.roof);
    const pad = 6;
    const near = side === 'L' ? w - 34 : 34;          // x nearest the road — keep detail there
    const windows = [];

    const day = JC.sprite(w, h, g => {
      // roof
      const rg = g.createLinearGradient(0, 0, 0, rd);
      rg.addColorStop(0, shade(roofCol, 0.08)); rg.addColorStop(1, shade(roofCol, -0.1));
      g.fillStyle = rg; g.fillRect(0, 0, w, rd);
      g.strokeStyle = shade(roofCol, 0.25); g.lineWidth = 1.5; g.strokeRect(1.5, 1.5, w - 3, rd - 3);
      const items = 1 + Math.floor(r() * 3);
      for (let i = 0; i < items; i++) {
        roofItem(g, r.pick(st.items), JC.clamp(near + r.range(-22, 22), 10, w - 10), r.range(10, rd - 10), r);
      }
      // facade
      const fy = rd;
      if (glassy) {
        const gg = g.createLinearGradient(0, fy, w, fy + fh);
        gg.addColorStop(0, shade(wall, 0.25)); gg.addColorStop(0.5, wall); gg.addColorStop(1, shade(wall, -0.3));
        g.fillStyle = gg; g.fillRect(0, fy, w, fh);
        g.fillStyle = 'rgba(255,255,255,0.16)';
        for (let y = fy + 6; y < fy + fh; y += 7) g.fillRect(0, y, w, 1);
        g.fillStyle = 'rgba(0,0,0,0.13)';
        for (let x = 4; x < w; x += 9) g.fillRect(x, fy, 1, fh);
        g.fillStyle = 'rgba(255,255,255,0.12)';
        JC.poly(g, [w * 0.15, fy, w * 0.45, fy, w * 0.1, fy + fh, -w * 0.2, fy + fh]); g.fill();
        for (let y = fy + 3; y < fy + fh - 4; y += 7) {
          for (let x = 2; x < w - 6; x += 9) windows.push([x + 1, y, 7, 4]);
        }
      } else {
        const wg = g.createLinearGradient(0, fy, 0, fy + fh);
        wg.addColorStop(0, shade(wall, 0.06)); wg.addColorStop(1, shade(wall, -0.14));
        g.fillStyle = wg; g.fillRect(0, fy, w, fh);
        let top = fy + 6;
        if (st.mansard) { // zinc mansard band with dormers
          g.fillStyle = roofCol; g.fillRect(0, fy, w, 13);
          g.fillStyle = shade(roofCol, -0.25); g.fillRect(0, fy + 12, w, 1.5);
          for (let x = 8; x < w - 8; x += 15) { g.fillStyle = '#f2ece0'; g.fillRect(x, fy + 3, 7, 8); g.fillStyle = '#39414d'; g.fillRect(x + 1.5, fy + 5, 4, 6); }
          top = fy + 18;
        }
        g.fillStyle = shade(wall, 0.2); g.fillRect(0, fy, w, 2); // cornice
        const shopH = st.shop ? 18 : 0;
        const cols = Math.floor((w - 8) / 13);
        const x0 = (w - cols * 13) / 2 + 3;
        for (let y = top; y < fy + fh - shopH - 12; y += 16) {
          for (let c = 0; c < cols; c++) {
            const x = x0 + c * 13;
            if (st.sash) { g.fillStyle = '#f2efe8'; g.fillRect(x - 1, y - 1, 9, 12); }
            g.fillStyle = '#2b3442'; g.fillRect(x, y, 7, 10);
            g.fillStyle = 'rgba(160,190,220,0.35)'; g.fillRect(x, y, 7, 3);
            if (st.balcony) { g.fillStyle = '#2a2a2a'; g.fillRect(x - 2, y + 10, 11, 1.5); }
            windows.push([x, y, 7, 10]);
          }
        }
        if (st.shop) { // ground-floor shopfronts with awnings
          const sy = fy + fh - shopH;
          g.fillStyle = shade(wall, -0.3); g.fillRect(0, sy, w, shopH);
          g.fillStyle = '#26303d'; g.fillRect(4, sy + 6, w - 8, shopH - 7);
          g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(4, sy + 6, w - 8, 2);
          const aw = r.pick(st.awnings);
          for (let x = 0; x < w; x += 6) { g.fillStyle = (x / 6) % 2 ? aw : '#f4f1ea'; g.fillRect(x, sy, 6, 5); }
          windows.push([4, sy + 6, w - 8, shopH - 7, 'shop']);
        }
      }
      // side shading so the block reads as a volume
      const sg = g.createLinearGradient(0, 0, w, 0);
      if (side === 'L') { sg.addColorStop(0, 'rgba(0,0,0,0.25)'); sg.addColorStop(0.3, 'rgba(0,0,0,0)'); }
      else { sg.addColorStop(0.7, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.25)'); }
      g.fillStyle = sg; g.fillRect(0, fy, w, fh);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, h - 2, w, 2);
    }, pad);

    const glowSp = JC.sprite(w, h, g => {
      windows.forEach(([x, y, ww, hh, kind]) => {
        if (kind === 'shop') {
          const c = r.pick(st.lit);
          g.save(); glow(g, c, 8); g.fillStyle = JC.alpha(c, 0.85); g.fillRect(x, y, ww, hh); g.restore();
          if (st.neonSigns || r() < 0.4) {
            const nc = r.pick(['#ff3df2', '#3dfcff', '#ffe23d', '#7dff3d']);
            g.save(); glow(g, nc, 8); g.fillStyle = nc; g.fillRect(x + ww * 0.2, y - 9, ww * 0.6, 3); g.restore();
          }
          return;
        }
        if (r() < (glassy ? 0.35 : 0.5)) {
          const c = r.pick(st.lit);
          g.save(); glow(g, c, 5); g.fillStyle = c; g.fillRect(x, y, ww, hh); g.restore();
        }
      });
      // aircraft beacon on tall towers
      if (fh > 150) { g.save(); glow(g, '#ff2a2a', 8); g.fillStyle = '#ff4040'; JC.circle(g, near, 6, 2.5); g.fill(); g.restore(); }
    }, pad);

    return { day, glow: glowSp, w, h, pad, gap: rd, fh };
  };

  // ---------- greenery ----------
  JC.makeTree = (r, col) => {
    const w = 34, h = 44;
    const base = col || r.pick(['#3f7a2a', '#4c8a32', '#2f6b2a', '#5a8f3c']);
    return {
      day: JC.sprite(w, h, g => {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(w / 2 + 3, h - 3, 13, 4, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#5b3a24'; g.fillRect(w / 2 - 2, h - 16, 4, 14);
        [[0, -4, 11], [-7, 2, 9], [7, 2, 9], [0, 6, 10]].forEach(([dx, dy, rr], i) => {
          const cx = w / 2 + dx, cy = 16 + dy;
          const gr = g.createRadialGradient(cx - 3, cy - 4, 1, cx, cy, rr);
          gr.addColorStop(0, shade(base, 0.25)); gr.addColorStop(1, shade(base, -0.25 - i * 0.03));
          g.fillStyle = gr; JC.circle(g, cx, cy, rr); g.fill();
        });
      }, 4), w, h, pad: 4,
    };
  };

  JC.makePalm = (r, side) => {
    const w = 52, h = 64;
    const lean = (side === 'L' ? 1 : -1) * r.range(4, 10);
    return {
      day: JC.sprite(w, h, g => {
        g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(w / 2 + lean + 6, h - 3, 16, 5, 0, 0, Math.PI * 2); g.fill();
        const tx = w / 2 + lean, ty = 18;
        g.strokeStyle = '#8a6a43'; g.lineWidth = 4; g.lineCap = 'round';
        g.beginPath(); g.moveTo(w / 2, h - 3); g.quadraticCurveTo(w / 2 + lean * 0.2, h * 0.55, tx, ty); g.stroke();
        g.strokeStyle = '#6b5234'; g.lineWidth = 1;
        for (let i = 1; i < 8; i++) {
          const t = i / 8, x = JC.lerp(w / 2, tx, t * t), y = JC.lerp(h - 3, ty, t);
          g.beginPath(); g.moveTo(x - 2, y); g.lineTo(x + 2, y); g.stroke();
        }
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.3;
          const len = r.range(17, 23);
          const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.7 + 4;
          g.fillStyle = i % 2 ? '#3f8f3a' : '#2f7a2e';
          g.beginPath(); g.moveTo(tx, ty);
          g.quadraticCurveTo(tx + Math.cos(a - 0.35) * len * 0.6, ty + Math.sin(a - 0.35) * len * 0.5 - 4, ex, ey);
          g.quadraticCurveTo(tx + Math.cos(a + 0.35) * len * 0.6, ty + Math.sin(a + 0.35) * len * 0.5, tx, ty);
          g.fill();
        }
        g.fillStyle = '#6b4a2a'; JC.circle(g, tx - 2, ty + 2, 2.2); g.fill(); JC.circle(g, tx + 2, ty + 3, 2.2); g.fill();
      }, 4), w, h, pad: 4,
    };
  };

  JC.makePine = (r, snow) => {
    const w = 30, h = 52;
    const col = r.pick(['#1f5a3a', '#24603f', '#2b6b44']);
    return {
      day: JC.sprite(w, h, g => {
        g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(w / 2 + 4, h - 3, 11, 4, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#4a3322'; g.fillRect(w / 2 - 2, h - 10, 4, 8);
        [[h - 10, 14], [h - 22, 11.5], [h - 33, 9], [h - 43, 6]].forEach(([by, hw], i) => {
          JC.poly(g, [w / 2, by - 15, w / 2 + hw, by, w / 2 - hw, by]);
          g.fillStyle = shade(col, i * 0.05); g.fill();
          g.fillStyle = 'rgba(0,0,0,0.18)'; JC.poly(g, [w / 2, by - 15, w / 2 + hw, by, w / 2, by]); g.fill();
          if (snow) { g.fillStyle = 'rgba(250,252,255,0.92)'; JC.poly(g, [w / 2, by - 15, w / 2 + hw * 0.45, by - 9, w / 2 - hw * 0.45, by - 9]); g.fill(); }
        });
      }, 4), w, h, pad: 4,
    };
  };

  JC.makeRock = (r, col) => {
    const w = r.range(22, 38), h = w * 0.7;
    col = col || '#8a8378';
    return {
      day: JC.sprite(w, h, g => {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(w / 2 + 3, h - 3, w / 2, 4, 0, 0, Math.PI * 2); g.fill();
        JC.poly(g, [2, h - 3, w * 0.15, h * 0.35, w * 0.45, 2, w * 0.8, h * 0.2, w - 2, h - 3]);
        const gr = g.createLinearGradient(0, 0, w, h);
        gr.addColorStop(0, shade(col, 0.2)); gr.addColorStop(1, shade(col, -0.3));
        g.fillStyle = gr; g.fill();
      }, 4), w, h, pad: 4,
    };
  };

  // ---------- street lamp, arm reaching over the road ----------
  JC.makeLamp = side => {
    const w = 30, h = 64, pad = 14;
    const L = side === 'L';
    const poleX = L ? 3 : w - 3, headX = L ? w - 4 : 4;
    const day = JC.sprite(w, h, g => {
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(poleX + 3, h - 2, 4, 2, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#5c6670'; g.lineWidth = 2.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(poleX, h - 2); g.lineTo(poleX, 8); g.quadraticCurveTo(poleX, 3, L ? poleX + 6 : poleX - 6, 3); g.lineTo(headX, 3); g.stroke();
      g.fillStyle = '#3a4048'; g.fillRect(headX - 5, 1, 10, 5);
      g.fillStyle = '#fff3c4'; g.fillRect(headX - 4, 5, 8, 1.6);
    }, pad);
    const glowSp = JC.sprite(w, h, g => {
      const gr = g.createRadialGradient(headX, 5, 0, headX, 5, 13);
      gr.addColorStop(0, 'rgba(255,240,190,1)'); gr.addColorStop(1, 'rgba(255,220,150,0)');
      g.fillStyle = gr; g.fillRect(headX - 14, -9, 28, 28);
    }, pad);
    return { day, glow: glowSp, w, h, pad, pool: { dx: headX, dy: -4, r: 46 } };
  };

  // Warm pool of light cast on the road by a lamp.
  JC.poolSprite = () => JC.cached('pool', () => JC.sprite(100, 70, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,214,140,0.42)'); gr.addColorStop(1, 'rgba(255,214,140,0)');
    g.save(); g.scale(1, h / w); g.fillStyle = gr; g.fillRect(0, 0, w, w); g.restore();
  }));

  // ---------- on the water (seen from above) ----------
  JC.makeBoat = (r, kind) => {
    const kinds = {
      speed: { w: 16, h: 40, hull: '#f4f4f4', deck: '#2a6f97' },
      yacht: { w: 22, h: 56, hull: '#fafafa', deck: '#d9c7a1' },
      longtail: { w: 12, h: 44, hull: '#8a5a2b', deck: '#c99a5b' },
      ferry: { w: 24, h: 62, hull: '#1f7a3a', deck: '#f2c200' },
      cargo: { w: 30, h: 120, hull: '#7a1f1f', deck: '#3b3f46' },
      jetski: { w: 9, h: 18, hull: r.pick(['#ff3b30', '#ffd60a', '#0a84ff']), deck: '#222' },
    };
    const k = kinds[kind];
    const wake = 40;
    const w = k.w + 24, h = k.h + wake;
    return {
      day: JC.sprite(w, h, g => {
        const cx = w / 2;
        // foamy V-shaped wake trailing behind (boats head up-screen), fading out
        const wg = g.createLinearGradient(0, k.h * 0.5, 0, h);
        wg.addColorStop(0, 'rgba(255,255,255,0.75)'); wg.addColorStop(1, 'rgba(255,255,255,0)');
        g.strokeStyle = wg; g.lineWidth = 1.6; g.lineCap = 'round';
        g.beginPath();
        g.moveTo(cx - k.w / 2 + 1, k.h * 0.55); g.quadraticCurveTo(cx - k.w / 2 - 4, k.h + wake * 0.3, cx - k.w / 2 - 12, h);
        g.moveTo(cx + k.w / 2 - 1, k.h * 0.55); g.quadraticCurveTo(cx + k.w / 2 + 4, k.h + wake * 0.3, cx + k.w / 2 + 12, h);
        g.stroke();
        g.fillStyle = wg; g.beginPath(); g.moveTo(cx - k.w / 2 + 3, k.h - 3); g.lineTo(cx + k.w / 2 - 3, k.h - 3); g.lineTo(cx + 4, h - 6); g.lineTo(cx - 4, h - 6); g.closePath();
        g.globalAlpha = 0.45; g.fill(); g.globalAlpha = 1;
        const hull = new Path2D();
        hull.moveTo(cx, 0); hull.quadraticCurveTo(cx + k.w / 2, k.h * 0.18, cx + k.w / 2, k.h * 0.4);
        hull.lineTo(cx + k.w / 2, k.h - 3); hull.lineTo(cx - k.w / 2, k.h - 3); hull.lineTo(cx - k.w / 2, k.h * 0.4);
        hull.quadraticCurveTo(cx - k.w / 2, k.h * 0.18, cx, 0); hull.closePath();
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.save(); g.translate(3, 3); g.fill(hull); g.restore();
        g.fillStyle = k.hull; g.fill(hull);
        if (kind === 'cargo') {
          const cc = ['#e63946', '#1d4ed8', '#f4c430', '#2a9d8f', '#ff7b00', '#7b2cbf'];
          for (let y = 22; y < k.h - 22; y += 9) for (let x = -1; x <= 1; x++) { g.fillStyle = r.pick(cc); g.fillRect(cx + x * 8 - 3.5, y, 7, 8); }
          g.fillStyle = '#f2f2f2'; g.fillRect(cx - 10, k.h - 20, 20, 12);
        } else {
          g.fillStyle = k.deck; JC.rr(g, cx - k.w / 2 + 3, k.h * 0.35, k.w - 6, k.h * 0.45, 3); g.fill();
          g.fillStyle = 'rgba(30,50,70,0.8)'; g.fillRect(cx - k.w / 2 + 4, k.h * 0.3, k.w - 8, 3);
        }
      }, 2), w, h, pad: 2,
    };
  };

  JC.makeIsland = r => {
    const w = 70, h = 54;
    return {
      day: JC.sprite(w, h, g => {
        g.fillStyle = 'rgba(140,240,225,0.6)'; g.beginPath(); g.ellipse(w / 2, h / 2 + 6, w / 2, h / 2 - 6, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#f3e3b5'; g.beginPath(); g.ellipse(w / 2, h / 2 + 6, w / 2 - 9, h / 2 - 14, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#3f8f3a'; g.beginPath(); g.ellipse(w / 2 + 2, h / 2 + 4, 12, 7, 0, 0, Math.PI * 2); g.fill();
        [[-6, 0], [7, -2]].forEach(([dx, dy]) => {
          const tx = w / 2 + dx, ty = h / 2 - 8 + dy;
          g.strokeStyle = '#8a6a43'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(tx, ty + 14); g.lineTo(tx, ty); g.stroke();
          for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2;
            g.strokeStyle = '#2f7a2e'; g.lineWidth = 3;
            g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + Math.cos(a) * 10, ty + Math.sin(a) * 7); g.stroke();
          }
        });
      }, 2), w, h, pad: 2,
    };
  };

  // Maldivian overwater villas on a boardwalk.
  JC.makeVillas = (r, side) => {
    const w = 84, h = 70;
    return {
      day: JC.sprite(w, h, g => {
        g.fillStyle = 'rgba(160,250,240,0.35)'; g.fillRect(0, 0, w, h);
        const bx = side === 'L' ? w - 12 : 6;
        g.fillStyle = '#b48a5a'; g.fillRect(bx, 0, 6, h);
        g.fillStyle = 'rgba(0,0,0,0.15)';
        for (let y = 0; y < h; y += 4) g.fillRect(bx, y, 6, 1);
        [12, 46].forEach(vy => {
          const vx = side === 'L' ? bx - 34 : bx + 12;
          g.fillStyle = '#b48a5a'; g.fillRect(side === 'L' ? vx + 26 : bx + 6, vy + 10, 8, 4);
          g.fillStyle = 'rgba(0,30,40,0.3)'; g.fillRect(vx + 3, vy + 3, 26, 20);
          g.fillStyle = '#c9a26b'; g.fillRect(vx, vy, 26, 20);
          g.fillStyle = '#a07a45'; JC.poly(g, [vx, vy, vx + 26, vy, vx + 19, vy + 10, vx + 7, vy + 10]); g.fill();
          g.strokeStyle = '#7d5a2c'; g.lineWidth = 0.8;
          g.beginPath(); g.moveTo(vx + 7, vy + 10); g.lineTo(vx + 19, vy + 10); g.stroke();
          g.fillStyle = '#3fd0e0'; g.fillRect(vx + 4, vy + 21, 10, 5);
        });
      }, 2), w, h, pad: 2,
    };
  };

  JC.makeBuoy = () => {
    const w = 10, h = 10;
    return {
      day: JC.sprite(w, h, g => {
        g.fillStyle = 'rgba(255,255,255,0.5)'; JC.circle(g, 5, 6, 5); g.fill();
        g.fillStyle = '#e63946'; JC.circle(g, 5, 5, 3.5); g.fill();
        g.fillStyle = '#fff'; g.fillRect(2, 4, 6, 2);
      }, 2), w, h, pad: 2,
    };
  };

  // ---------- desert & outback ----------
  JC.makeCamel = (r, side) => {
    const w = 36, h = 30;
    const flip = side === 'R';
    return {
      day: JC.sprite(w, h, g => {
        if (flip) { g.translate(w, 0); g.scale(-1, 1); }
        g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(w / 2 + 3, h - 2, 14, 3, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#9a6b3c'; g.lineWidth = 2.4; g.lineCap = 'round';
        [8, 12, 22, 26].forEach(x => { g.beginPath(); g.moveTo(x, 16); g.lineTo(x, h - 2); g.stroke(); });
        g.fillStyle = '#b5824d';
        g.beginPath(); g.ellipse(17, 14, 12, 6, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(15, 8, 6, 5, 0, 0, Math.PI * 2); g.fill();
        g.lineWidth = 3; g.strokeStyle = '#b5824d';
        g.beginPath(); g.moveTo(27, 13); g.quadraticCurveTo(32, 8, 31, 3); g.stroke();
        g.fillStyle = '#a57444'; g.beginPath(); g.ellipse(33, 3, 3.5, 2, 0.2, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#c0392b'; g.fillRect(12, 6, 7, 3);
      }, 2), w, h, pad: 2,
    };
  };

  JC.makeTermiteMound = () => {
    const w = 16, h = 26;
    return {
      day: JC.sprite(w, h, g => {
        g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(w / 2 + 3, h - 2, 7, 2.5, 0, 0, Math.PI * 2); g.fill();
        const gr = g.createLinearGradient(0, 0, w, 0);
        gr.addColorStop(0, '#d2794a'); gr.addColorStop(1, '#8e3f1d');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(2, h - 2); g.quadraticCurveTo(3, 4, w / 2, 1); g.quadraticCurveTo(w - 3, 4, w - 2, h - 2); g.closePath(); g.fill();
      }, 2), w, h, pad: 2,
    };
  };

  JC.makeSpinifex = r => {
    const w = 22, h = 14;
    return {
      day: JC.sprite(w, h, g => {
        g.strokeStyle = r.pick(['#a3a34a', '#8f9a3d', '#b5a85a']); g.lineWidth = 1;
        for (let i = 0; i < 18; i++) {
          const a = Math.PI + (i / 17) * Math.PI;
          g.beginPath(); g.moveTo(w / 2, h - 1); g.lineTo(w / 2 + Math.cos(a) * 10, h - 1 + Math.sin(a) * 12); g.stroke();
        }
      }, 2), w, h, pad: 2,
    };
  };

  JC.makeRoadSign = (kind) => { // yellow diamond warning sign on a post
    const w = 20, h = 34;
    return {
      day: JC.sprite(w, h, g => {
        g.fillStyle = '#8a8f96'; g.fillRect(w / 2 - 1, 14, 2, h - 14);
        g.fillStyle = '#111'; JC.poly(g, [w / 2, 0, w, 10, w / 2, 20, 0, 10]); g.fill();
        g.fillStyle = '#ffd400'; JC.poly(g, [w / 2, 1.5, w - 1.5, 10, w / 2, 18.5, 1.5, 10]); g.fill();
        g.fillStyle = '#111';
        if (kind === 'kangaroo') {
          g.beginPath(); g.ellipse(10, 11, 3.2, 2.2, -0.5, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.ellipse(12.8, 7.8, 1.3, 1, 0, 0, Math.PI * 2); g.fill();
          g.fillRect(6, 12, 4, 1); g.fillRect(9, 12.5, 1, 3);
        } else if (kind === 'camel') {
          g.beginPath(); g.ellipse(9.5, 10, 3.5, 1.8, 0, 0, Math.PI * 2); g.fill();
          g.fillRect(7, 11, 1, 4); g.fillRect(11.5, 11, 1, 4); g.fillRect(12.5, 7, 1, 3); g.fillRect(12.5, 7, 2, 1);
        } else {
          g.font = `900 9px ${JC.FONT_SIGN}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', w / 2, 10.5);
        }
      }, 2), w, h, pad: 2,
    };
  };

  // ---------- mountain dwellings ----------
  JC.makeChalet = (r, himalaya) => {
    const w = 54, h = 52;
    return {
      day: JC.sprite(w, h, g => {
        g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(4, h - 4, w - 4, 4);
        // roof seen from above (snowy for the Alps, slate for the Himalaya)
        g.fillStyle = himalaya ? '#6b7280' : '#f5f8fb'; g.fillRect(0, 0, w, 22);
        g.fillStyle = himalaya ? '#565c66' : '#dfe6ee'; g.fillRect(0, 10, w, 2);
        // facade
        const wall = himalaya ? '#c9b8a0' : '#8a5a33';
        g.fillStyle = wall; g.fillRect(3, 22, w - 6, h - 24);
        g.fillStyle = himalaya ? '#7a4a2a' : '#6b4424';
        for (let y = 26; y < h - 2; y += 6) g.fillRect(3, y, w - 6, 1);
        [10, 32].forEach(x => {
          g.fillStyle = '#f2ece0'; g.fillRect(x - 1, 27, 11, 11);
          g.fillStyle = '#2b3442'; g.fillRect(x, 28, 9, 9);
          if (!himalaya) { g.fillStyle = '#c1121f'; g.fillRect(x - 1, 38, 11, 3); g.fillStyle = '#3f8f3a'; g.fillRect(x, 37, 2, 1.5); g.fillRect(x + 6, 37, 2, 1.5); }
        });
        g.fillStyle = '#4a2e18'; g.fillRect(w / 2 - 4, h - 14, 8, 12);
      }, 4),
      glow: JC.sprite(w, h, g => {
        g.save(); glow(g, '#ffcf73', 8); g.fillStyle = '#ffcf73'; g.fillRect(10, 28, 9, 9); g.fillRect(32, 28, 9, 9); g.restore();
      }, 4),
      w, h, pad: 4,
    };
  };

  JC.makeWatchtower = () => { // Great Wall watchtower
    const w = 58, h = 70;
    return {
      day: JC.sprite(w, h, g => {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(4, h - 4, w - 2, 4);
        g.fillStyle = '#9d907c'; g.fillRect(0, 0, w, 20);
        g.fillStyle = '#857a68';
        for (let x = 0; x < w; x += 8) { g.fillRect(x, 0, 5, 4); g.fillRect(x, 16, 5, 4); }
        const gr = g.createLinearGradient(0, 20, 0, h);
        gr.addColorStop(0, '#a89a83'); gr.addColorStop(1, '#7d705c');
        g.fillStyle = gr; g.fillRect(0, 20, w, h - 22);
        g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 0.8;
        for (let y = 24; y < h; y += 5) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
        g.fillStyle = '#2f2a24';
        [12, 26, 40].forEach(x => { g.beginPath(); g.moveTo(x, 44); g.lineTo(x, 34); g.arc(x + 3, 34, 3, Math.PI, 0); g.lineTo(x + 6, 44); g.fill(); });
      }, 4), w, h, pad: 4,
    };
  };

  // ---------- beach ----------
  JC.makeUmbrella = r => {
    const w = 34, h = 34;
    const cols = r.pick([['#e63946', '#fff'], ['#1d4ed8', '#fff'], ['#ffb703', '#e85d04'], ['#2a9d8f', '#f1faee']]);
    return {
      day: JC.sprite(w, h, g => {
        g.fillStyle = '#fff'; g.fillRect(2, 22, 9, 12); g.fillRect(23, 22, 9, 12);
        g.fillStyle = 'rgba(0,0,0,0.2)'; JC.circle(g, w / 2 + 4, 17, 13); g.fill();
        for (let i = 0; i < 8; i++) {
          g.fillStyle = cols[i % 2];
          g.beginPath(); g.moveTo(w / 2, 14); g.arc(w / 2, 14, 13, (i / 8) * Math.PI * 2, ((i + 1) / 8) * Math.PI * 2); g.closePath(); g.fill();
        }
        g.fillStyle = '#333'; JC.circle(g, w / 2, 14, 1.5); g.fill();
      }, 2), w, h, pad: 2,
    };
  };

  JC.makeHut = r => { // thatched beach bar
    const w = 50, h = 44;
    return {
      day: JC.sprite(w, h, g => {
        g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(4, h - 4, w - 4, 4);
        g.fillStyle = '#c9a26b'; g.fillRect(0, 0, w, 22);
        g.strokeStyle = '#a07a45'; g.lineWidth = 0.8;
        for (let x = 2; x < w; x += 3) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 1, 22); g.stroke(); }
        g.fillStyle = '#8a5a2b'; g.fillRect(4, 22, w - 8, h - 24);
        g.fillStyle = '#2b3442'; g.fillRect(9, 27, w - 18, 7);
        g.fillStyle = r.pick(['#ff4d8d', '#06d6a0', '#ffb703']); g.fillRect(4, 22, w - 8, 3);
      }, 4),
      glow: JC.sprite(w, h, g => { g.save(); glow(g, '#ff7ad9', 8); g.fillStyle = '#ffd27a'; g.fillRect(9, 27, w - 18, 7); g.restore(); }, 4),
      w, h, pad: 4,
    };
  };

  // ---------- overhead structures across the road ----------
  function truss(g, y0, night) {
    const { ROAD_X, ROAD_W } = JC;
    const x0 = ROAD_X - 22, x1 = ROAD_X + ROAD_W + 22;
    g.fillStyle = night ? '#2a3140' : '#7c8794';
    g.fillRect(x0 - 3, y0 - 6, 7, 64); g.fillRect(x1 - 4, y0 - 6, 7, 64);
    g.fillStyle = night ? '#3a4356' : '#a7b1bc';
    g.fillRect(x0, y0, x1 - x0, 3); g.fillRect(x0, y0 + 9, x1 - x0, 3);
    g.strokeStyle = night ? '#3a4356' : '#98a3af'; g.lineWidth = 1;
    g.beginPath();
    for (let x = x0; x < x1; x += 12) { g.moveTo(x, y0 + 1.5); g.lineTo(x + 6, y0 + 10.5); g.lineTo(x + 12, y0 + 1.5); }
    g.stroke();
  }

  function signPanel(g, x, y, w, h, col, night) {
    g.save();
    if (night) glow(g, JC.shade(col, 0.2), 10);
    g.fillStyle = col; JC.rr(g, x, y, w, h, 4); g.fill();
    g.restore();
    g.strokeStyle = '#ffffff'; g.lineWidth = 1.6; JC.rr(g, x + 2.5, y + 2.5, w - 5, h - 5, 3); g.stroke();
  }

  // The "Welcome to …" gantry that marks the start of each lap's new location.
  JC.makeWelcomeGantry = (loc, lap, night) => JC.cached(`welcome:${loc.id}:${lap}:${night ? 1 : 0}`, () => {
    const W = JC.W, h = 92;
    return JC.sprite(W, h, g => {
      truss(g, 4, night);
      const pw = 250, ph = 70, px = (W - pw) / 2, py = 14;
      signPanel(g, px, py, pw, ph, loc.signCol, night);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `800 9px ${JC.FONT_SIGN}`;
      g.fillText(`LAP ${lap}  ·  WELCOME TO`, W / 2, py + 13);
      let size = 26;
      g.font = `900 ${size}px ${JC.FONT_SIGN}`;
      while (g.measureText(loc.city.toUpperCase()).width > pw - 70 && size > 14) { size--; g.font = `900 ${size}px ${JC.FONT_SIGN}`; }
      g.fillText(loc.city.toUpperCase(), W / 2 + 14, py + 36);
      JC.drawFlag(g, loc.flag, px + 14, py + 26, 24, 16);
      g.font = `800 9.5px ${JC.FONT_SIGN}`;
      g.fillText(loc.country.toUpperCase(), W / 2, py + 57);
    }, 8);
  });

  // Ordinary direction signs naming local places.
  JC.makeDirectionGantry = (loc, a, b, night) => JC.cached(`dir:${loc.id}:${a}:${b}:${night ? 1 : 0}`, () => {
    const W = JC.W, h = 62;
    return JC.sprite(W, h, g => {
      truss(g, 4, night);
      const panel = (x, w, text, arrow) => {
        signPanel(g, x, 14, w, 34, loc.signCol, night);
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
        let size = 13;
        g.font = `900 ${size}px ${JC.FONT_SIGN}`;
        while (g.measureText(text).width > w - 30 && size > 7) { size--; g.font = `900 ${size}px ${JC.FONT_SIGN}`; }
        g.fillText(text, x + w / 2 + 6, 32);
        g.font = `900 14px ${JC.FONT_SIGN}`;
        g.fillText(arrow, x + 12, 31);
      };
      panel(JC.ROAD_X + 8, 140, a, '↑');
      panel(JC.ROAD_X + JC.ROAD_W - 148, 140, b, '↗');
    }, 8);
  });

  // Tibetan prayer flags strung across the mountain road.
  JC.makePrayerFlags = (seed) => JC.cached(`prayer:${seed}`, () => {
    const W = JC.W, h = 50, r = JC.rng(seed);
    return JC.sprite(W, h, g => {
      const x0 = JC.ROAD_X - 20, x1 = JC.ROAD_X + JC.ROAD_W + 20;
      g.fillStyle = '#6b5234'; g.fillRect(x0 - 2, 0, 4, 46); g.fillRect(x1 - 2, 0, 4, 46);
      const cols = ['#1e5be0', '#f5f5f5', '#e01e37', '#1f8a3b', '#f4c430'];
      for (let s = 0; s < 2; s++) {
        const sag = 14 + s * 8, y0 = 4 + s * 6;
        g.strokeStyle = 'rgba(80,60,40,0.8)'; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(W / 2, y0 + sag * 2, x1, y0); g.stroke();
        let i = 0;
        for (let x = x0 + 8; x < x1 - 6; x += 11) {
          const t = (x - x0) / (x1 - x0);
          const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (y0 + sag * 2) + t * t * y0;
          g.fillStyle = cols[(i + s * 2) % 5];
          g.save(); g.translate(x, y); g.rotate(r.range(-0.15, 0.15)); g.fillRect(-4, 0, 8, 10); g.restore();
          i++;
        }
      }
    }, 4);
  });
})();
