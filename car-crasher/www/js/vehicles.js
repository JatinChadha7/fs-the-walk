/* Vehicle, hazard and pickup sprites — every object has a day look and a neon night look. */
'use strict';

(function () {
  const { rrPath, shade, glow, noGlow } = JC;

  // Traffic catalogue. pts = points for crashing it; fwd = its own forward speed as a share of road speed.
  JC.CAR_TYPES = {
    rickshaw: { w: 34, h: 52, pts: 25, fwd: [0.52, 0.62], label: 'Auto' },
    mini:     { w: 36, h: 58, pts: 10, fwd: [0.5, 0.62] },
    sedan:    { w: 40, h: 74, pts: 20, fwd: [0.45, 0.58] },
    taxi:     { w: 40, h: 76, pts: 30, fwd: [0.45, 0.56] },
    sports:   { w: 40, h: 72, pts: 40, fwd: [0.55, 0.66] },
    suv:      { w: 44, h: 82, pts: 50, fwd: [0.42, 0.54] },
    pickup:   { w: 44, h: 90, pts: 60, fwd: [0.4, 0.52] },
    van:      { w: 44, h: 94, pts: 70, fwd: [0.38, 0.5] },
    police:   { w: 40, h: 76, pts: 80, fwd: [0.5, 0.6] },
    bus:      { w: 50, h: 146, pts: 120, fwd: [0.3, 0.4] },
    truck:    { w: 50, h: 158, pts: 150, fwd: [0.28, 0.38] },
    golden:   { w: 40, h: 72, pts: 500, fwd: [0.6, 0.7] },
  };

  JC.DAY_COLORS = ['#e63946', '#1d4ed8', '#f4c430', '#f1f1ee', '#9aa3ad', '#2a9d8f', '#ff7b00',
    '#7b2cbf', '#06d6a0', '#ff4d8d', '#3a86ff', '#8d6e63', '#c1121f', '#80ed99', '#ffb703'];
  JC.NEON_COLORS = ['#00f0ff', '#ff2bd6', '#39ff14', '#ffea00', '#ff7a00', '#b14cff', '#00ffa3', '#ff3860', '#5d8bff'];

  // ---------- generic painter that works in both day and neon mode ----------
  function painter(g, neon, nc, col) {
    return {
      neon,
      fill(path, style) {
        if (!neon) { g.fillStyle = style; g.fill(path); }
        else { g.fillStyle = 'rgba(6,7,16,0.92)'; g.fill(path); }
      },
      // Main silhouette: solid in day, glowing outline at night.
      body(path, style) {
        if (!neon) { g.fillStyle = style; g.fill(path); return; }
        g.fillStyle = JC.alpha(nc, 0.16); g.fill(path);
        g.save(); glow(g, nc, 10); g.strokeStyle = nc; g.lineWidth = 2.4; g.stroke(path); g.stroke(path); g.restore();
      },
      detail(path, style, lw = 1.2, nAlpha = 0.85) {
        if (!neon) { g.fillStyle = style; g.fill(path); return; }
        g.save(); glow(g, nc, 4); g.strokeStyle = JC.alpha(nc, nAlpha); g.lineWidth = lw; g.stroke(path); g.restore();
      },
      glass(path) {
        if (!neon) {
          const b = path.__b;
          const gr = g.createLinearGradient(0, b ? b[1] : 0, 0, b ? b[3] : 10);
          gr.addColorStop(0, '#1a2433'); gr.addColorStop(1, '#3d4f69');
          g.fillStyle = gr; g.fill(path);
          return;
        }
        g.fillStyle = 'rgba(10,12,24,0.95)'; g.fill(path);
        g.save(); glow(g, nc, 5); g.strokeStyle = JC.alpha(nc, 0.75); g.lineWidth = 1.1; g.stroke(path); g.restore();
      },
      light(path, dayCol, nightCol) {
        if (!neon) { g.fillStyle = dayCol; g.fill(path); return; }
        g.save(); glow(g, nightCol, 9); g.fillStyle = nightCol; g.fill(path); g.fill(path); g.restore();
      },
      line(x1, y1, x2, y2, style, lw = 1) {
        g.save();
        g.strokeStyle = neon ? JC.alpha(nc, 0.6) : style; g.lineWidth = lw;
        if (neon) glow(g, nc, 3);
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
        g.restore();
      },
    };
  }

  const trap = (x1t, x2t, yt, x1b, x2b, yb) => {
    const p = new Path2D();
    p.moveTo(x1t, yt); p.lineTo(x2t, yt); p.lineTo(x2b, yb); p.lineTo(x1b, yb); p.closePath();
    p.__b = [0, yt, 0, yb];
    return p;
  };

  function bodyGradient(g, w, col) {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, shade(col, -0.4));
    gr.addColorStop(0.18, col);
    gr.addColorStop(0.5, shade(col, 0.2));
    gr.addColorStop(0.82, col);
    gr.addColorStop(1, shade(col, -0.4));
    return gr;
  }

  function wheels(g, w, h, neon, nc, spots, ww = 5, wl = 0.16) {
    spots.forEach(fy => {
      [-1.2, w - ww + 1.2].forEach(x => {
        const p = rrPath(x, h * fy, ww, h * wl, 2);
        if (!neon) { g.fillStyle = '#121212'; g.fill(p); }
        else { g.fillStyle = '#05050a'; g.fill(p); g.save(); g.strokeStyle = JC.alpha(nc, 0.5); g.lineWidth = 1; g.stroke(p); g.restore(); }
      });
    });
  }

  function lamps(P, w, h, inset = 3) {
    P.light(rrPath(inset + 1, 0.8, 8, 4, 2), '#fff7cf', '#ffffff');
    P.light(rrPath(w - inset - 9, 0.8, 8, 4, 2), '#fff7cf', '#ffffff');
    P.light(rrPath(inset + 1, h - 4.2, 8, 3.4, 1.5), '#d3161b', '#ff2a3a');
    P.light(rrPath(w - inset - 9, h - 4.2, 8, 3.4, 1.5), '#d3161b', '#ff2a3a');
  }

  // A conventional car: hood, windscreen, roof, rear window, boot.
  function car(g, w, h, col, neon, nc, o) {
    const P = painter(g, neon, nc, col);
    wheels(g, w, h, neon, nc, [0.13, 0.7]);
    const body = rrPath(1.5, 0, w - 3, h, o.rad || 9);
    P.body(body, neon ? null : bodyGradient(g, w, col));
    if (!neon) { // bonnet crease + shine
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fill(rrPath(w * 0.32, 4, w * 0.36, h * o.glassF - 6, 4));
    }
    const gF = trap(5, w - 5, h * o.glassF, 7, w - 7, h * o.roofF);
    P.glass(gF);
    const roof = rrPath(7, h * o.roofF, w - 14, h * (o.roofR - o.roofF), 3);
    P.detail(roof, o.roofCol || shade(col, 0.08), 1);
    const gR = trap(7, w - 7, h * o.roofR, 6, w - 6, h * o.glassR);
    P.glass(gR);
    // side windows
    P.detail(rrPath(4, h * o.roofF + 2, 2.2, h * (o.roofR - o.roofF) - 4, 1), '#25324a', 0.8, 0.5);
    P.detail(rrPath(w - 6.2, h * o.roofF + 2, 2.2, h * (o.roofR - o.roofF) - 4, 1), '#25324a', 0.8, 0.5);
    // mirrors
    P.detail(rrPath(-1, h * o.glassF + 2, 4, 3, 1), shade(col, -0.25), 1);
    P.detail(rrPath(w - 3, h * o.glassF + 2, 4, 3, 1), shade(col, -0.25), 1);
    lamps(P, w, h);
    if (!neon) { // glass glint
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(9, h * o.glassF + 3); g.lineTo(15, h * o.roofF - 1); g.stroke();
    }
    return P;
  }

  const PAINT = {
    mini(g, w, h, col, neon, nc) {
      car(g, w, h, col, neon, nc, { rad: 11, glassF: 0.24, roofF: 0.38, roofR: 0.74, glassR: 0.84, roofCol: neon ? null : '#f4f4f4' });
    },
    sedan(g, w, h, col, neon, nc) {
      car(g, w, h, col, neon, nc, { rad: 9, glassF: 0.26, roofF: 0.4, roofR: 0.68, glassR: 0.79 });
    },
    taxi(g, w, h, col, neon, nc, v) {
      const P = car(g, w, h, col, neon, nc, { rad: 9, glassF: 0.26, roofF: 0.4, roofR: 0.68, glassR: 0.79, roofCol: v && v.roof });
      const sign = rrPath(w / 2 - 8, h * 0.5, 16, 6, 1.5);
      P.light(sign, '#fff6d5', '#ffe066');
      if (!neon) {
        g.fillStyle = '#222'; g.font = `800 4.6px ${JC.FONT_SIGN}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('TAXI', w / 2, h * 0.5 + 3.2);
        if (v && v.checker) { // checker strip along both sides
          for (let i = 0; i < 9; i++) {
            g.fillStyle = i % 2 ? '#111' : '#f4f4f4';
            g.fillRect(1.5, h * 0.3 + i * 4, 2.5, 4); g.fillRect(w - 4, h * 0.3 + i * 4, 2.5, 4);
          }
        }
      }
    },
    sports(g, w, h, col, neon, nc, v) {
      const P = painter(g, neon, nc, col);
      wheels(g, w, h, neon, nc, [0.14, 0.68], 6, 0.17);
      const body = new Path2D();
      body.moveTo(w * 0.28, 0); body.lineTo(w * 0.72, 0);
      body.quadraticCurveTo(w - 1, 2, w - 1, h * 0.2);
      body.lineTo(w - 1.5, h * 0.88); body.quadraticCurveTo(w - 2, h, w * 0.75, h);
      body.lineTo(w * 0.25, h); body.quadraticCurveTo(2, h, 1.5, h * 0.88);
      body.lineTo(1, h * 0.2); body.quadraticCurveTo(1, 2, w * 0.28, 0); body.closePath();
      const fillStyle = neon ? null : (v && v.gold ? goldGradient(g, w, h) : bodyGradient(g, w, col));
      P.body(body, fillStyle);
      if (!neon) {
        g.fillStyle = v && v.gold ? 'rgba(120,70,0,0.55)' : 'rgba(255,255,255,0.85)';
        g.fillRect(w / 2 - 5, 0, 3, h); g.fillRect(w / 2 + 2, 0, 3, h);
      } else {
        P.line(w / 2 - 3.5, 3, w / 2 - 3.5, h - 3, null, 1); P.line(w / 2 + 3.5, 3, w / 2 + 3.5, h - 3, null, 1);
      }
      P.glass(trap(6, w - 6, h * 0.34, 8, w - 8, h * 0.47));
      P.detail(rrPath(8, h * 0.47, w - 16, h * 0.14, 3), neon ? null : (v && v.gold ? '#ffe9a8' : shade(col, 0.05)), 1);
      P.glass(trap(8, w - 8, h * 0.61, 7, w - 7, h * 0.7));
      P.detail(rrPath(1, h * 0.9, w - 2, 4, 1.5), '#111', 1.4); // spoiler
      lamps(P, w, h, 4);
    },
    suv(g, w, h, col, neon, nc) {
      const P = car(g, w, h, col, neon, nc, { rad: 7, glassF: 0.22, roofF: 0.33, roofR: 0.8, glassR: 0.87 });
      P.line(8, h * 0.36, 8, h * 0.78, 'rgba(0,0,0,0.45)', 1.6);
      P.line(w - 8, h * 0.36, w - 8, h * 0.78, 'rgba(0,0,0,0.45)', 1.6);
    },
    pickup(g, w, h, col, neon, nc) {
      const P = painter(g, neon, nc, col);
      wheels(g, w, h, neon, nc, [0.12, 0.72], 5.5, 0.15);
      P.body(rrPath(1.5, 0, w - 3, h, 7), neon ? null : bodyGradient(g, w, col));
      P.glass(trap(5, w - 5, h * 0.24, 7, w - 7, h * 0.34));
      P.detail(rrPath(7, h * 0.34, w - 14, h * 0.16, 3), neon ? null : shade(col, 0.08), 1);
      P.glass(trap(7, w - 7, h * 0.5, 7, w - 7, h * 0.54));
      const bed = rrPath(5, h * 0.58, w - 10, h * 0.38, 2);
      P.detail(bed, '#2b2b2b', 1.2);
      for (let i = 1; i < 4; i++) P.line(5 + (w - 10) * i / 4, h * 0.6, 5 + (w - 10) * i / 4, h * 0.94, 'rgba(255,255,255,0.12)', 1);
      P.detail(rrPath(-1, h * 0.25, 4, 3, 1), '#222', 1); P.detail(rrPath(w - 3, h * 0.25, 4, 3, 1), '#222', 1);
      lamps(P, w, h);
    },
    van(g, w, h, col, neon, nc, v) {
      const P = painter(g, neon, nc, col);
      wheels(g, w, h, neon, nc, [0.1, 0.76], 5.5, 0.13);
      P.body(rrPath(1.5, 0, w - 3, h, 8), neon ? null : bodyGradient(g, w, col));
      P.glass(trap(5, w - 5, h * 0.08, 6, w - 6, h * 0.19));
      P.detail(rrPath(6, h * 0.2, w - 12, h * 0.77, 4), neon ? null : shade(col, 0.1), 1);
      if (v && v.stripes) { // Lagos danfo: black bands along the yellow body
        P.detail(rrPath(1.5, h * 0.22, 4, h * 0.74, 1), '#111', 1);
        P.detail(rrPath(w - 5.5, h * 0.22, 4, h * 0.74, 1), '#111', 1);
      }
      if (v && v.rack) { // roof rack piled with luggage
        P.detail(rrPath(9, h * 0.3, w - 18, h * 0.42, 2), 'rgba(40,30,20,0.55)', 1);
        if (!neon) {
          const lug = ['#8d5524', '#2a6f97', '#c44536', '#e9c46a', '#3a5a40'];
          for (let i = 0; i < 5; i++) { g.fillStyle = lug[i]; JC.rr(g, 11 + (i % 2) * 11, h * 0.32 + i * 7, 10, 6, 1.5); g.fill(); }
        }
      } else {
        P.detail(rrPath(w / 2 - 7, h * 0.45, 14, 10, 2), neon ? null : shade(col, -0.15), 1);
      }
      lamps(P, w, h);
    },
    police(g, w, h, col, neon, nc) {
      const P = car(g, w, h, '#f2f4f7', neon, nc, { rad: 9, glassF: 0.26, roofF: 0.4, roofR: 0.68, glassR: 0.79 });
      if (!neon) {
        g.fillStyle = '#16233f'; g.fill(rrPath(1.5, 0, w - 3, h * 0.2, 9)); g.fill(rrPath(1.5, h * 0.84, w - 3, h * 0.16, 7));
      }
      P.light(rrPath(8, h * 0.48, (w - 16) / 2, 5, 1.5), '#e01e37', '#ff2a4a');
      P.light(rrPath(w / 2, h * 0.48, (w - 16) / 2, 5, 1.5), '#1e5be0', '#2f7bff');
    },
    bus(g, w, h, col, neon, nc, v) {
      const P = painter(g, neon, nc, col);
      wheels(g, w, h, neon, nc, [0.1, 0.72, 0.81], 6, 0.08);
      P.body(rrPath(1.5, 0, w - 3, h, 6), neon ? null : bodyGradient(g, w, col));
      P.glass(trap(4, w - 4, 2, 4, w - 4, h * 0.05));
      // window bands along both sides (top deck for a double-decker)
      P.detail(rrPath(2.5, h * 0.07, 3.5, h * 0.88, 1.5), '#26344b', 1, 0.6);
      P.detail(rrPath(w - 6, h * 0.07, 3.5, h * 0.88, 1.5), '#26344b', 1, 0.6);
      P.detail(rrPath(8, h * 0.07, w - 16, h * 0.9, 3), neon ? null : (v && v.roof) || shade(col, 0.15), 1);
      P.detail(rrPath(w / 2 - 9, h * 0.22, 18, 16, 2), '#c9ced6', 1);
      P.detail(rrPath(w / 2 - 9, h * 0.62, 18, 16, 2), '#c9ced6', 1);
      P.detail(rrPath(w / 2 - 6, h * 0.44, 12, 9, 1), shade(col, -0.2), 1);
      if (v && v.decker && !neon) {
        g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = `900 7px ${JC.FONT_SIGN}`; g.textAlign = 'center';
        g.save(); g.translate(w / 2, h * 0.47); g.rotate(-Math.PI / 2); g.fillText('LONDON', 0, 2.5); g.restore();
      }
      lamps(P, w, h);
    },
    truck(g, w, h, col, neon, nc, v) {
      const P = painter(g, neon, nc, col);
      wheels(g, w, h, neon, nc, [0.06, 0.62, 0.72, 0.82], 6, 0.07);
      const trailer = rrPath(1, h * 0.25, w - 2, h * 0.75, 3);
      const tcol = (v && v.trailer) || '#e9ecef';
      P.body(trailer, neon ? null : bodyGradient(g, w, tcol));
      if (!neon) {
        g.fillStyle = col; g.fillRect(1, h * 0.25, w - 2, 4);
        g.fillStyle = 'rgba(0,0,0,0.12)';
        for (let i = 0; i < 8; i++) g.fillRect(1, h * 0.3 + i * h * 0.085, w - 2, 1);
        g.save(); g.translate(w / 2, h * 0.62); g.rotate(-Math.PI / 2);
        g.fillStyle = shade(col, -0.1); g.font = `900 10px ${JC.FONT_SIGN}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText((v && v.logo) || 'CARGO', 0, 0); g.restore();
      } else {
        for (let i = 1; i < 6; i++) P.line(5, h * 0.25 + i * h * 0.12, w - 5, h * 0.25 + i * h * 0.12, null, 0.8);
      }
      const cab = rrPath(3, 0, w - 6, h * 0.22, 6);
      P.body(cab, neon ? null : bodyGradient(g, w, col));
      P.glass(trap(6, w - 6, h * 0.06, 7, w - 7, h * 0.11));
      P.detail(rrPath(8, h * 0.115, w - 16, h * 0.09, 2), neon ? null : shade(col, 0.12), 1);
      P.detail(rrPath(0, h * 0.07, 4, 4, 1), '#222', 1); P.detail(rrPath(w - 4, h * 0.07, 4, 4, 1), '#222', 1);
      P.light(rrPath(5, 0.6, 9, 4, 2), '#fff7cf', '#ffffff'); P.light(rrPath(w - 14, 0.6, 9, 4, 2), '#fff7cf', '#ffffff');
      P.light(rrPath(4, h - 4, 8, 3.4, 1.5), '#d3161b', '#ff2a3a'); P.light(rrPath(w - 12, h - 4, 8, 3.4, 1.5), '#d3161b', '#ff2a3a');
    },
    rickshaw(g, w, h, col, neon, nc, v) {
      const P = painter(g, neon, nc, col);
      // single front wheel, two rear wheels
      const fw = rrPath(w / 2 - 2.5, -1, 5, 9, 2);
      if (!neon) { g.fillStyle = '#111'; g.fill(fw); }
      wheels(g, w, h, neon, nc, [0.66], 5, 0.2);
      const body = new Path2D();
      body.moveTo(w * 0.36, 2); body.lineTo(w * 0.64, 2);
      body.quadraticCurveTo(w - 1, h * 0.25, w - 1.5, h * 0.55);
      body.lineTo(w - 1.5, h * 0.92); body.quadraticCurveTo(w - 2, h, w * 0.8, h);
      body.lineTo(w * 0.2, h); body.quadraticCurveTo(2, h, 1.5, h * 0.92);
      body.lineTo(1.5, h * 0.55); body.quadraticCurveTo(1, h * 0.25, w * 0.36, 2); body.closePath();
      P.body(body, neon ? null : bodyGradient(g, w, col));
      const canopy = rrPath(3.5, h * 0.3, w - 7, h * 0.66, 6);
      P.detail(canopy, neon ? null : (v && v.canopy) || '#f4c430', 1.2);
      if (!neon) {
        g.fillStyle = 'rgba(0,0,0,0.12)';
        for (let i = 1; i < 4; i++) g.fillRect(3.5, h * 0.3 + i * h * 0.16, w - 7, 1);
      }
      P.glass(trap(w * 0.3, w * 0.7, h * 0.14, w * 0.22, w * 0.78, h * 0.28));
      P.light(rrPath(w / 2 - 3, 3, 6, 3.5, 1.5), '#fff7cf', '#ffffff');
      P.light(rrPath(4, h - 3.5, 6, 3, 1), '#d3161b', '#ff2a3a'); P.light(rrPath(w - 10, h - 3.5, 6, 3, 1), '#d3161b', '#ff2a3a');
    },
  };
  PAINT.golden = (g, w, h, col, neon, nc) => PAINT.sports(g, w, h, '#f6c445', neon, nc, { gold: true });

  function goldGradient(g, w, h) {
    const gr = g.createLinearGradient(0, 0, w, h * 0.4);
    gr.addColorStop(0, '#8a5a00'); gr.addColorStop(0.3, '#ffe27a'); gr.addColorStop(0.5, '#fff6cf');
    gr.addColorStop(0.7, '#f6c445'); gr.addColorStop(1, '#8a5a00');
    return gr;
  }

  JC.carSprite = (type, col, neonCol, variant) => {
    const t = JC.CAR_TYPES[type];
    const vk = variant ? JSON.stringify(variant) : '';
    const day = JC.cached(`car:${type}:${col}:${vk}`, () =>
      JC.sprite(t.w, t.h, (g, w, h) => PAINT[type](g, w, h, col, false, null, variant), 3));
    const night = JC.cached(`carN:${type}:${neonCol}:${vk}`, () =>
      JC.sprite(t.w, t.h, (g, w, h) => PAINT[type](g, w, h, col, true, neonCol, variant), 12));
    return { day, night };
  };

  // Soft drop shadow under a vehicle.
  JC.shadowSprite = (w, h) => JC.cached(`shadow:${w}:${h}`, () =>
    JC.sprite(w, h, (g) => {
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 7 * JC.R.scale;
      g.shadowOffsetX = 1000 * JC.R.scale;
      g.fillStyle = '#000';
      g.fill(rrPath(-1000 + 2, 2, w - 4, h - 4, 8));
      g.restore();
    }, 10));

  // ---------- the player's black Hummer with JC on the roof ----------
  function paintHummer(g, w, h, neon) {
    const gold = '#ffcc4d';
    const cyan = '#22e6ff';
    // tyres
    [[0, 10], [w - 13, 10], [0, h - 32], [w - 13, h - 32]].forEach(([x, y]) => {
      const p = rrPath(x, y, 13, 25, 3.5);
      g.fillStyle = '#0b0b0b'; g.fill(p);
      g.fillStyle = '#262626';
      for (let i = 0; i < 6; i++) g.fillRect(x + 1, y + 2 + i * 4, 11, 1.4);
      if (neon) { g.save(); glow(g, cyan, 6); g.strokeStyle = JC.alpha(cyan, 0.7); g.lineWidth = 1; g.stroke(p); g.restore(); }
    });
    const bx = 5, bw = w - 10;
    const body = rrPath(bx, 2, bw, h - 4, 7);
    const gr = g.createLinearGradient(bx, 0, bx + bw, 0);
    gr.addColorStop(0, '#050506'); gr.addColorStop(0.15, '#16171b'); gr.addColorStop(0.5, '#2a2c33');
    gr.addColorStop(0.85, '#16171b'); gr.addColorStop(1, '#050506');
    g.fillStyle = gr; g.fill(body);
    if (neon) { g.save(); glow(g, cyan, 12); g.strokeStyle = cyan; g.lineWidth = 2; g.stroke(body); g.restore(); }
    // front bumper + grille slots
    g.fillStyle = '#0a0a0a'; g.fill(rrPath(bx - 1, 0, bw + 2, 7, 3));
    g.fillStyle = '#3a3d44';
    for (let i = 0; i < 7; i++) g.fillRect(w / 2 - 13 + i * 4, 2, 2, 3.5);
    // headlights + amber indicators
    const hl = neon ? '#ffffff' : '#e9f3ff';
    g.save(); if (neon) glow(g, '#ffffff', 10);
    g.fillStyle = hl; g.fill(rrPath(bx + 2, 1.5, 8, 4.5, 1.5)); g.fill(rrPath(bx + bw - 10, 1.5, 8, 4.5, 1.5));
    g.restore();
    g.fillStyle = '#ffa31a'; g.fillRect(bx + 11, 2.5, 3, 3); g.fillRect(bx + bw - 14, 2.5, 3, 3);
    // bonnet with raised centre section and vents
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fill(rrPath(w / 2 - 10, 9, 20, 22, 3));
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(w / 2 - 10, 9); g.lineTo(w / 2 - 10, 31); g.moveTo(w / 2 + 10, 9); g.lineTo(w / 2 + 10, 31); g.stroke();
    g.fillStyle = '#060607';
    for (let i = 0; i < 4; i++) { g.fillRect(bx + 4, 12 + i * 4, 6, 1.6); g.fillRect(bx + bw - 10, 12 + i * 4, 6, 1.6); }
    // gloss streak
    const sh = g.createLinearGradient(0, 8, 0, 34);
    sh.addColorStop(0, 'rgba(255,255,255,0.0)'); sh.addColorStop(0.5, 'rgba(255,255,255,0.14)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sh; g.fillRect(bx + 12, 8, 6, 26);
    // windscreen
    const ws = trap(bx + 3, bx + bw - 3, 34, bx + 5, bx + bw - 5, 45);
    const wg = g.createLinearGradient(0, 34, 0, 45);
    wg.addColorStop(0, '#0e1520'); wg.addColorStop(1, '#2c3d57');
    g.fillStyle = wg; g.fill(ws);
    g.strokeStyle = 'rgba(160,200,255,0.35)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(bx + 9, 36); g.lineTo(bx + 15, 44); g.stroke();
    // mirrors
    g.fillStyle = '#0d0d0f'; g.fill(rrPath(-1, 36, 7, 5, 1.5)); g.fill(rrPath(w - 6, 36, 7, 5, 1.5));
    // roof with rails
    const roofY = 46, roofH = h - 46 - 16;
    const roof = rrPath(bx + 4, roofY, bw - 8, roofH, 4);
    const rg = g.createLinearGradient(0, roofY, 0, roofY + roofH);
    rg.addColorStop(0, '#1b1c21'); rg.addColorStop(1, '#101114');
    g.fillStyle = rg; g.fill(roof);
    g.fillStyle = '#4a4e57';
    g.fillRect(bx + 4, roofY + 2, 2, roofH - 4); g.fillRect(bx + bw - 6, roofY + 2, 2, roofH - 4);
    // roof marker lights (H2 style)
    g.save(); glow(g, '#ffb020', neon ? 10 : 4);
    g.fillStyle = '#ffb020';
    for (let i = 0; i < 5; i++) g.fillRect(w / 2 - 12 + i * 5.5, roofY + 2.5, 3, 2.2);
    g.restore();
    // JC lettering
    g.save();
    g.translate(w / 2, roofY + roofH / 2 + 2);
    // as big as the body allows: the letters span the whole roof, rails included
    let jcSize = 40;
    g.font = `${jcSize}px ${JC.FONT_DISPLAY}`;
    while (g.measureText('JC').width > bw + 2 && jcSize > 20) { jcSize--; g.font = `${jcSize}px ${JC.FONT_DISPLAY}`; }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (neon) glow(g, gold, 14);
    const tg = g.createLinearGradient(0, -jcSize * 0.45, 0, jcSize * 0.45);
    tg.addColorStop(0, '#fff2b3'); tg.addColorStop(0.45, gold); tg.addColorStop(1, '#b07a12');
    g.lineJoin = 'round';
    g.lineWidth = 3.2; g.strokeStyle = '#000'; g.strokeText('JC', 0, 0);
    g.fillStyle = tg; g.fillText('JC', 0, 0);
    if (neon) g.fillText('JC', 0, 0);
    g.restore();
    // rear window + tail lights + rear-mounted spare
    g.fillStyle = '#1d2738'; g.fill(trap(bx + 6, bx + bw - 6, h - 16, bx + 5, bx + bw - 5, h - 10));
    g.save(); glow(g, '#ff2a3a', neon ? 10 : 3);
    g.fillStyle = '#e01b2a'; g.fill(rrPath(bx + 1, h - 6, 7, 3.5, 1)); g.fill(rrPath(bx + bw - 8, h - 6, 7, 3.5, 1));
    g.restore();
    g.fillStyle = '#0b0b0b'; g.fill(rrPath(w / 2 - 9, h - 5, 18, 6, 2.5));
    g.fillStyle = '#30333a'; g.fillRect(w / 2 - 3, h - 3, 6, 2);
  }

  JC.HUMMER = { w: 56, h: 104 };
  JC.hummerSprites = () => ({
    day: JC.cached('hummer', () => JC.sprite(JC.HUMMER.w, JC.HUMMER.h, (g, w, h) => paintHummer(g, w, h, false), 4)),
    night: JC.cached('hummerN', () => JC.sprite(JC.HUMMER.w, JC.HUMMER.h, (g, w, h) => paintHummer(g, w, h, true), 16)),
    under: JC.cached('underglow', () => JC.sprite(70, 118, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, h / 2);
      gr.addColorStop(0, 'rgba(34,230,255,0.55)'); gr.addColorStop(1, 'rgba(34,230,255,0)');
      g.fillStyle = gr; g.save(); g.scale(1, 1); g.fillRect(0, 0, w, h); g.restore();
    }, 0)),
  });

  // Headlight beams projected ahead of a vehicle (drawn additively at night).
  JC.beamSprite = () => JC.cached('beam', () => JC.sprite(200, 300, (g, w, h) => {
    [[w / 2 - 14], [w / 2 + 14]].forEach(([x]) => {
      const gr = g.createRadialGradient(x, h, 4, x, h, h);
      gr.addColorStop(0, 'rgba(255,246,214,0.55)');
      gr.addColorStop(0.5, 'rgba(255,240,200,0.18)');
      gr.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(x - 4, h); g.lineTo(x - 70, 0); g.lineTo(x + 70, 0); g.lineTo(x + 4, h); g.closePath(); g.fill();
    });
  }, 0));

  // ---------- hazards ----------
  function paintBomb(g, w, h, neon) {
    const cx = w / 2, cy = h / 2 + 4, r = 15;
    const red = '#ff3b2f';
    if (!neon) {
      const gr = g.createRadialGradient(cx - 5, cy - 6, 2, cx, cy, r);
      gr.addColorStop(0, '#5b5f6a'); gr.addColorStop(0.35, '#22242a'); gr.addColorStop(1, '#050507');
      g.fillStyle = gr; JC.circle(g, cx, cy, r); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; JC.circle(g, cx - 6, cy - 6, 3.5); g.fill();
    } else {
      g.fillStyle = 'rgba(30,4,4,0.95)'; JC.circle(g, cx, cy, r); g.fill();
      g.save(); glow(g, red, 14); g.strokeStyle = red; g.lineWidth = 2.6; JC.circle(g, cx, cy, r); g.stroke(); g.stroke(); g.restore();
    }
    // skull warning mark
    g.save(); if (neon) glow(g, red, 6);
    g.fillStyle = neon ? red : '#e9e9e9';
    JC.circle(g, cx, cy - 1, 5.5); g.fill(); g.fillRect(cx - 3.5, cy + 2.5, 7, 4);
    g.fillStyle = neon ? '#1a0303' : '#111';
    JC.circle(g, cx - 2.2, cy - 1.2, 1.6); g.fill(); JC.circle(g, cx + 2.2, cy - 1.2, 1.6); g.fill();
    g.fillRect(cx - 0.6, cy + 2.6, 1.2, 3);
    g.restore();
    // cap + fuse
    g.fillStyle = neon ? '#3a0a0a' : '#6c717c';
    g.fillRect(cx - 5, cy - r - 3, 10, 5);
    g.save(); if (neon) glow(g, '#ffae00', 6);
    g.strokeStyle = neon ? '#ffae00' : '#c9a36a'; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, cy - r - 3); g.quadraticCurveTo(cx + 7, cy - r - 9, cx + 10, cy - r - 6); g.stroke();
    g.restore();
  }

  function paintDynamite(g, w, h, neon) {
    const red = '#ff2d55';
    for (let i = 0; i < 3; i++) {
      const x = 3 + i * 11.5, p = rrPath(x, 10, 11, 32, 4);
      if (!neon) {
        const gr = g.createLinearGradient(x, 0, x + 11, 0);
        gr.addColorStop(0, '#7d0d12'); gr.addColorStop(0.4, '#e3262d'); gr.addColorStop(1, '#7d0d12');
        g.fillStyle = gr; g.fill(p);
        g.fillStyle = '#f2d6b3'; g.fill(rrPath(x + 1.5, 10.5, 8, 3, 1.5));
      } else {
        g.fillStyle = 'rgba(30,2,10,0.95)'; g.fill(p);
        g.save(); glow(g, red, 10); g.strokeStyle = red; g.lineWidth = 2; g.stroke(p); g.restore();
      }
    }
    // tape band
    g.fillStyle = neon ? 'rgba(255,220,0,0.9)' : '#1c1c1c';
    g.save(); if (neon) glow(g, '#ffd400', 8);
    g.fillRect(2, 26, w - 4, 6);
    g.restore();
    g.fillStyle = neon ? '#200' : '#f4c430';
    g.font = `900 5.5px ${JC.FONT_SIGN}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('TNT', w / 2, 29.4);
    // fuse
    g.save(); if (neon) glow(g, '#ffae00', 6);
    g.strokeStyle = neon ? '#ffae00' : '#3b3b3b'; g.lineWidth = 1.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(w / 2, 10); g.bezierCurveTo(w / 2 + 2, 4, w / 2 + 8, 6, w / 2 + 10, 1); g.stroke();
    g.restore();
  }

  JC.HAZARDS = {
    bomb: { w: 36, h: 40, paint: paintBomb, spark: [28, 3] },
    dynamite: { w: 40, h: 44, paint: paintDynamite, spark: [30, 1] },
  };
  JC.hazardSprite = kind => {
    const t = JC.HAZARDS[kind];
    return {
      day: JC.cached(`hz:${kind}`, () => JC.sprite(t.w, t.h, (g, w, h) => t.paint(g, w, h, false), 4)),
      night: JC.cached(`hzN:${kind}`, () => JC.sprite(t.w, t.h, (g, w, h) => t.paint(g, w, h, true), 16)),
    };
  };

  // Pulsing red danger ring drawn under hazards.
  JC.dangerSprite = () => JC.cached('danger', () => JC.sprite(70, 70, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,40,40,0.0)'); gr.addColorStop(0.6, 'rgba(255,40,40,0.35)'); gr.addColorStop(1, 'rgba(255,40,40,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }));

  // ---------- pickups ----------
  JC.POWERUPS = {
    shield: { w: 40, h: 40, color: '#3fb6ff', label: 'SHIELD' },
    double: { w: 40, h: 40, color: '#ffc93c', label: '2X POINTS' },
  };
  function paintPower(g, w, h, kind, neon) {
    const t = JC.POWERUPS[kind];
    const cx = w / 2, cy = h / 2;
    g.save();
    glow(g, t.color, neon ? 16 : 8);
    const gr = g.createRadialGradient(cx - 5, cy - 6, 2, cx, cy, 18);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, t.color); gr.addColorStop(1, JC.shade(t.color, -0.45));
    g.fillStyle = gr;
    if (kind === 'shield') {
      JC.poly(g, [cx, cy - 18, cx + 15, cy - 11, cx + 13, cy + 6, cx, cy + 18, cx - 13, cy + 6, cx - 15, cy - 11]);
    } else JC.circle(g, cx, cy, 17);
    g.fill();
    noGlow(g);
    g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.85)'; g.stroke();
    g.fillStyle = '#fff';
    g.font = `${kind === 'shield' ? 13 : 12}px ${JC.FONT_DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 3; g.strokeStyle = JC.shade(t.color, -0.55);
    const txt = kind === 'shield' ? '✚' : '2X';
    g.strokeText(txt, cx, cy + 1); g.fillText(txt, cx, cy + 1);
    g.restore();
  }
  JC.powerSprite = kind => {
    const t = JC.POWERUPS[kind];
    return {
      day: JC.cached(`pw:${kind}`, () => JC.sprite(t.w, t.h, (g, w, h) => paintPower(g, w, h, kind, false), 10)),
      night: JC.cached(`pwN:${kind}`, () => JC.sprite(t.w, t.h, (g, w, h) => paintPower(g, w, h, kind, true), 16)),
    };
  };

  // Shield bubble around the Hummer.
  JC.bubbleSprite = () => JC.cached('bubble', () => JC.sprite(96, 140, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w * 0.72);
    gr.addColorStop(0, 'rgba(63,182,255,0)'); gr.addColorStop(0.75, 'rgba(63,182,255,0.18)'); gr.addColorStop(1, 'rgba(63,182,255,0.6)');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(160,225,255,0.8)'; g.lineWidth = 1.5; g.stroke();
  }, 4));

  // Points badge shown on each car's roof.
  JC.badgeSprite = (pts, neon) => JC.cached(`badge:${pts}:${neon ? 1 : 0}`, () => {
    const txt = '+' + pts;
    const w = 10 + txt.length * 6.2, h = 14;
    return JC.sprite(w, h, (g) => {
      const big = pts >= 100;
      g.fillStyle = neon ? 'rgba(8,6,20,0.85)' : (big ? '#ffcf3f' : 'rgba(10,12,20,0.78)');
      JC.rr(g, 0, 0, w, h, 7); g.fill();
      if (neon) { g.save(); glow(g, '#ffe066', 6); g.strokeStyle = '#ffe066'; g.lineWidth = 1.2; g.stroke(); g.restore(); }
      g.fillStyle = neon ? '#ffe066' : (big ? '#1b1300' : '#ffffff');
      g.font = `700 10px ${JC.FONT_MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(txt, w / 2, h / 2 + 1);
    }, 6);
  });
})();
