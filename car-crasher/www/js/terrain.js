/* Ground tiles: the road surface plus whatever lies either side of it (city, sea, mountain, sand…). */
'use strict';

(function () {
  const { W, ROAD_X, ROAD_W, LANE_W, SEG, shade } = JC;
  const RX2 = ROAD_X + ROAD_W;

  // ---------- road surface ----------
  function road(g, loc, r) {
    const p = loc.pal;
    g.fillStyle = p.asphalt;
    g.fillRect(ROAD_X, 0, ROAD_W, SEG);
    // aggregate speckle
    for (let i = 0; i < 380; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
      g.fillRect(ROAD_X + r() * ROAD_W, 6 + r() * (SEG - 12), 1.2, 1.2);
    }
    // worn tyre tracks in each lane
    for (let l = 0; l < 5; l++) {
      g.fillStyle = 'rgba(0,0,0,0.09)';
      g.fillRect(ROAD_X + l * LANE_W + 12, 0, 9, SEG);
      g.fillRect(ROAD_X + l * LANE_W + LANE_W - 21, 0, 9, SEG);
    }
    // repair patches
    if (r() < 0.5) {
      g.fillStyle = shade(p.asphalt, -0.12);
      const pw = 20 + r() * 40, ph = 14 + r() * 30;
      g.fillRect(ROAD_X + 10 + r() * (ROAD_W - pw - 20), 20 + r() * (SEG - ph - 40), pw, ph);
    }
    if (loc.terrain === 'bridge' || loc.terrain === 'flyover') { // expansion joint
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(ROAD_X, 128, ROAD_W, 2);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(ROAD_X, 130, ROAD_W, 1);
    }
    // lane dashes (period 64 tiles cleanly into 256)
    g.fillStyle = p.line;
    for (let l = 1; l < 5; l++) {
      const x = ROAD_X + l * LANE_W - 2;
      for (let y = 0; y < SEG; y += 64) g.fillRect(x, y + 14, 4, 36);
    }
    // edge lines
    g.fillStyle = p.edge;
    g.fillRect(ROAD_X + 5, 0, 4, SEG);
    g.fillStyle = p.line;
    g.fillRect(RX2 - 9, 0, 4, SEG);
    // soft gutter shading
    let gr = g.createLinearGradient(ROAD_X, 0, ROAD_X + 14, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(ROAD_X, 0, 14, SEG);
    gr = g.createLinearGradient(RX2 - 14, 0, RX2, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = gr; g.fillRect(RX2 - 14, 0, 14, SEG);
  }

  // ---------- sides ----------
  function sidewalk(g, p, x0, x1, curbAtRight) {
    g.fillStyle = p.walk; g.fillRect(x0, 0, x1 - x0, SEG);
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 0.8;
    g.beginPath();
    for (let y = 0; y <= SEG; y += 16) { g.moveTo(x0, y); g.lineTo(x1, y); }
    for (let x = x0 + 8; x < x1; x += 8) { g.moveTo(x, 0); g.lineTo(x, SEG); }
    g.stroke();
    g.fillStyle = p.curb;
    if (curbAtRight) g.fillRect(x1 - 4, 0, 4, SEG); else g.fillRect(x0, 0, 4, SEG);
  }

  function grassTex(g, x0, x1, base, r, n = 70) {
    g.fillStyle = base; g.fillRect(x0, 0, x1 - x0, SEG);
    for (let i = 0; i < n; i++) {
      g.fillStyle = r() < 0.5 ? shade(base, 0.1, 0.6) : shade(base, -0.15, 0.6);
      const s = 2 + r() * 5;
      g.beginPath(); g.arc(x0 + r() * (x1 - x0), 6 + r() * (SEG - 12), s, 0, Math.PI * 2); g.fill();
    }
  }

  function city(g, loc, r) {
    const p = loc.pal;
    grassTex(g, 0, ROAD_X - 18, p.ground, r);
    grassTex(g, RX2 + 18, W, p.ground, r);
    sidewalk(g, p, ROAD_X - 18, ROAD_X, true);
    sidewalk(g, p, RX2, RX2 + 18, false);
    // manhole / drain covers
    for (let i = 0; i < 2; i++) {
      const left = r() < 0.5;
      const x = left ? ROAD_X - 10 : RX2 + 10, y = 30 + r() * (SEG - 60);
      g.fillStyle = 'rgba(40,40,40,0.55)'; JC.circle(g, x, y, 3.2); g.fill();
    }
  }

  function water(g, loc, r, x0, x1, deepAt) {
    const p = loc.pal;
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    if (deepAt === 'left') { gr.addColorStop(0, p.water2); gr.addColorStop(1, p.shallow || p.water); }
    else { gr.addColorStop(0, p.shallow || p.water); gr.addColorStop(1, p.water2); }
    g.fillStyle = gr; g.fillRect(x0, 0, x1 - x0, SEG);
    g.strokeStyle = JC.alpha(p.wave, 0.45); g.lineWidth = 1.2; g.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const x = x0 + 6 + r() * (x1 - x0 - 12), y = 10 + r() * (SEG - 20), l = 4 + r() * 8;
      g.beginPath(); g.moveTo(x - l, y); g.quadraticCurveTo(x, y - 3, x + l, y); g.stroke();
    }
  }

  function bridge(g, loc, r) {
    const p = loc.pal;
    water(g, loc, r, 0, ROAD_X - 10, 'left');
    water(g, loc, r, RX2 + 10, W, 'right');
    // bridge shadow on the water
    g.fillStyle = 'rgba(0,20,40,0.28)';
    g.fillRect(ROAD_X - 22, 0, 12, SEG);
    g.fillRect(RX2 + 10, 0, 6, SEG);
    // concrete parapets with railing posts
    [ROAD_X - 10, RX2].forEach(x => {
      const gr = g.createLinearGradient(x, 0, x + 10, 0);
      gr.addColorStop(0, shade(p.barrier, -0.25)); gr.addColorStop(0.5, p.barrier); gr.addColorStop(1, shade(p.barrier, -0.2));
      g.fillStyle = gr; g.fillRect(x, 0, 10, SEG);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = 0; y < SEG; y += 32) g.fillRect(x + 2, y, 6, 3);
    });
  }

  function mountain(g, loc, r) {
    const p = loc.pal;
    // left: rock face
    g.fillStyle = p.rock; g.fillRect(0, 0, ROAD_X - 12, SEG);
    for (let i = 0; i < 18; i++) {
      const x = r() * (ROAD_X - 20), y = 8 + r() * (SEG - 40), w = 14 + r() * 30, h = 10 + r() * 26;
      g.fillStyle = r() < 0.5 ? shade(p.rock, 0.12) : shade(p.rock, -0.18);
      JC.poly(g, [x, y + h, x + w * 0.2, y, x + w * 0.8, y + h * 0.15, x + w, y + h]);
      g.fill();
    }
    if (p.snow) {
      g.fillStyle = 'rgba(245,248,252,0.85)';
      for (let i = 0; i < 8; i++) { g.beginPath(); g.ellipse(r() * (ROAD_X - 14), 10 + r() * (SEG - 20), 8 + r() * 12, 4 + r() * 6, 0, 0, Math.PI * 2); g.fill(); }
    }
    // ditch + gravel shoulder
    g.fillStyle = shade(p.rock, -0.35); g.fillRect(ROAD_X - 12, 0, 4, SEG);
    g.fillStyle = '#8e8a82'; g.fillRect(ROAD_X - 8, 0, 8, SEG);
    // right: slope (grass or snow) with tufts
    const gr = g.createLinearGradient(RX2, 0, W, 0);
    gr.addColorStop(0, p.ground); gr.addColorStop(1, p.ground2 || shade(p.ground, -0.1));
    g.fillStyle = gr; g.fillRect(RX2, 0, W - RX2, SEG);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = p.snow ? 'rgba(150,170,190,0.35)' : shade(p.ground, -0.2, 0.7);
      JC.circle(g, RX2 + 16 + r() * (W - RX2 - 16), r() * SEG, 1.5 + r() * 2.5); g.fill();
    }
    if (loc.style === 'greatwall') { // the Wall itself, running beside the road
      const x0 = RX2 + 36, x1 = RX2 + 62;
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x0 - 2, 0, x1 - x0 + 10, SEG);
      g.fillStyle = '#a89a83'; g.fillRect(x0, 0, x1 - x0, SEG);
      g.strokeStyle = 'rgba(0,0,0,0.13)'; g.lineWidth = 0.8;
      g.beginPath();
      for (let y = 0; y < SEG; y += 6) { g.moveTo(x0, y); g.lineTo(x1, y); }
      g.stroke();
      g.fillStyle = '#8a7e6a';
      for (let y = 0; y < SEG; y += 8) { g.fillRect(x0 - 4, y, 4, 5); g.fillRect(x1, y, 4, 5); }
    }
    // guard rail
    g.fillStyle = '#7d8590'; g.fillRect(RX2 + 2, 0, 9, SEG);
    g.fillStyle = '#c9d0d8'; g.fillRect(RX2 + 3, 0, 4, SEG);
    g.fillStyle = '#4c535c';
    for (let y = 8; y < SEG; y += 32) g.fillRect(RX2 + 2, y, 9, 4);
  }

  function beach(g, loc, r) {
    const p = loc.pal;
    // left: sandy town side
    g.fillStyle = p.sand; g.fillRect(0, 0, ROAD_X - 16, SEG);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = r() < 0.5 ? shade(p.sand, -0.08) : shade(p.sand, 0.1);
      g.fillRect(r() * (ROAD_X - 16), r() * SEG, 1.5, 1.5);
    }
    sidewalk(g, p, ROAD_X - 16, ROAD_X, true);
    // right: promenade, beach, surf, sea
    sidewalk(g, p, RX2, RX2 + 12, false);
    g.fillStyle = p.sand; g.fillRect(RX2 + 12, 0, 30, SEG);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = shade(p.sand, r() < 0.5 ? -0.08 : 0.1);
      g.fillRect(RX2 + 12 + r() * 30, r() * SEG, 1.5, 1.5);
    }
    g.fillStyle = shade(p.sand, -0.12); g.fillRect(RX2 + 38, 0, 6, SEG);
    water(g, loc, r, RX2 + 44, W, 'right');
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (let y = 0; y < SEG; y += 4) {
      const wob = Math.sin(y * 0.09) * 2 + Math.sin(y * 0.031) * 2;
      g.fillRect(RX2 + 42 + wob, y, 4, 4);
    }
  }

  function desert(g, loc, r) {
    const p = loc.pal;
    [[0, ROAD_X], [RX2, W]].forEach(([x0, x1]) => {
      g.fillStyle = p.sand; g.fillRect(x0, 0, x1 - x0, SEG);
      // dune shading
      for (let i = 0; i < 3; i++) {
        const cx = x0 + r() * (x1 - x0), cy = 40 + r() * (SEG - 80);
        const gr = g.createRadialGradient(cx, cy, 4, cx, cy, 50);
        gr.addColorStop(0, JC.alpha(p.sand2, 0.9)); gr.addColorStop(1, JC.alpha(p.sand2, 0));
        g.fillStyle = gr; g.fillRect(x0, cy - 50, x1 - x0, 100);
      }
      g.strokeStyle = JC.alpha(p.ripple, 0.7); g.lineWidth = 1.2;
      for (let i = 0; i < 14; i++) {
        const y = 8 + r() * (SEG - 16), x = x0 + r() * (x1 - x0 - 20);
        g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 6, y - 3, x + 12, y + 3, x + 20, y); g.stroke();
      }
      for (let i = 0; i < 12; i++) {
        g.fillStyle = shade(p.sand2, -0.25); JC.circle(g, x0 + r() * (x1 - x0), r() * SEG, 1 + r() * 1.8); g.fill();
      }
    });
  }

  function flyover(g, loc) {
    const p = loc.pal;
    // the deck edge and jersey barriers; outside is transparent so the city below shows through
    [ROAD_X - 12, RX2].forEach((x, i) => {
      const gr = g.createLinearGradient(x, 0, x + 12, 0);
      gr.addColorStop(0, shade(p.barrier, i ? -0.1 : -0.3)); gr.addColorStop(0.5, p.barrier); gr.addColorStop(1, shade(p.barrier, i ? -0.3 : -0.1));
      g.fillStyle = gr; g.fillRect(x, 0, 12, SEG);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      for (let y = 0; y < SEG; y += 64) g.fillRect(x, y, 12, 1.5);
    });
  }

  const TERRAIN = { city, bridge, mountain, beach, desert, flyover };

  JC.renderTile = (loc, seed) => {
    const r = JC.rng(seed);
    return JC.sprite(W, SEG, g => {
      TERRAIN[loc.terrain](g, loc, r);
      road(g, loc, r);
      if (loc.terrain === 'desert') { // sand blowing onto the road edges
        g.fillStyle = JC.alpha(loc.pal.sand, 0.8);
        for (let i = 0; i < 6; i++) {
          const left = r() < 0.5;
          g.beginPath();
          g.ellipse(left ? ROAD_X + 2 : RX2 - 2, 20 + r() * (SEG - 40), 6 + r() * 10, 10 + r() * 20, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
    });
  };

  // ---------- the city far below a flyover (drawn with parallax) ----------
  JC.renderBelowTile = (loc, seed) => {
    const r = JC.rng(seed);
    const p = loc.pal;
    const style = JC.STYLES[loc.style] || JC.STYLES.dubai;
    return JC.sprite(W, SEG, g => {
      g.fillStyle = p.below; g.fillRect(0, 0, W, SEG);
      // street grid
      g.fillStyle = p.street;
      [36, 150, 330, 444].forEach(x => g.fillRect(x - 7, 0, 14, SEG));
      g.fillRect(0, 120, W, 14);
      g.fillStyle = 'rgba(255,255,255,0.7)';
      for (let y = 0; y < SEG; y += 20) [36, 150, 330, 444].forEach(x => g.fillRect(x - 0.5, y, 1, 10));
      // tiny cars on the streets
      for (let i = 0; i < 10; i++) {
        g.fillStyle = JC.DAY_COLORS[Math.floor(r() * JC.DAY_COLORS.length)];
        const x = [36, 150, 330, 444][Math.floor(r() * 4)] + (r() < 0.5 ? -4 : 2);
        g.fillRect(x, r() * SEG, 3, 6);
      }
      // rooftops between the streets
      const blocks = [[0, 29], [43, 143], [157, 323], [337, 437], [451, W]];
      blocks.forEach(([x0, x1]) => {
        [[0, 113], [134, SEG]].forEach(([y0, y1]) => {
          let y = y0 + 4;
          while (y < y1 - 14) {
            const h = Math.min(y1 - 4 - y, 22 + r() * 40);
            let x = x0 + 3;
            while (x < x1 - 10) {
              const w = Math.min(x1 - 3 - x, 18 + r() * 40);
              const col = style.glass && r() < 0.6 ? r.pick(style.glass) : r.pick(style.walls || ['#bbb']);
              g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 3, y + 3, w - 2, h - 2);
              g.fillStyle = col; g.fillRect(x, y, w - 2, h - 2);
              g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(x, y, w - 2, 2);
              if (r() < 0.6) { g.fillStyle = 'rgba(80,80,90,0.6)'; g.fillRect(x + 4, y + 4, 5, 4); }
              if (r() < 0.25) { g.fillStyle = '#4f7d3a'; JC.circle(g, x + w / 2, y + h / 2, Math.min(w, h) / 4); g.fill(); }
              x += w + 2;
            }
            y += h + 3;
          }
        });
      });
    });
  };

  // Night lights for the city below: street lamps and tail lights.
  JC.renderBelowGlow = (seed) => {
    const r = JC.rng(seed);
    return JC.sprite(W, SEG, g => {
      [36, 150, 330, 444].forEach(x => {
        for (let y = 6; y < SEG; y += 28) {
          const gr = g.createRadialGradient(x, y, 0, x, y, 9);
          gr.addColorStop(0, 'rgba(255,200,120,0.9)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
          g.fillStyle = gr; g.fillRect(x - 9, y - 9, 18, 18);
        }
        for (let i = 0; i < 4; i++) {
          g.fillStyle = r() < 0.5 ? '#ff3b3b' : '#fff3c4';
          g.fillRect(x + (r() < 0.5 ? -4 : 2), r() * SEG, 2, 2);
        }
      });
      for (let i = 0; i < 70; i++) {
        g.fillStyle = r.pick(['#ffe2a8', '#bfe9ff', '#ff9de2', '#fff']);
        g.globalAlpha = 0.5 + r() * 0.5;
        g.fillRect(r() * W, r() * SEG, 1.6, 1.6);
      }
      g.globalAlpha = 1;
    });
  };

  // Where the water is at a given terrain, for sparkle effects.
  JC.waterSpans = loc => {
    if (loc.terrain === 'bridge') return [[0, ROAD_X - 24], [RX2 + 16, W]];
    if (loc.terrain === 'beach') return [[RX2 + 48, W]];
    return null;
  };
})();
