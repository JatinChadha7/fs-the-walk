/* Country flags drawn on canvas (emoji flags don't render on every phone). */
'use strict';

(function () {
  const star = (g, cx, cy, r, points = 5, inner = 0.4, rot = -Math.PI / 2) => {
    g.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const rr = i % 2 ? r * inner : r;
      const a = rot + (i * Math.PI) / points;
      g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  };

  const bandsH = (g, w, h, cols, weights) => {
    weights = weights || cols.map(() => 1);
    const tot = weights.reduce((a, b) => a + b, 0);
    let y = 0;
    cols.forEach((c, i) => { const hh = (h * weights[i]) / tot; g.fillStyle = c; g.fillRect(0, y, w, hh + 0.5); y += hh; });
  };
  const bandsV = (g, w, h, cols) => {
    cols.forEach((c, i) => { g.fillStyle = c; g.fillRect((w * i) / cols.length, 0, w / cols.length + 0.5, h); });
  };

  const unionJack = (g, w, h) => {
    g.fillStyle = '#012169'; g.fillRect(0, 0, w, h);
    g.save();
    g.beginPath(); g.rect(0, 0, w, h); g.clip();
    g.lineCap = 'butt';
    g.strokeStyle = '#fff'; g.lineWidth = h * 0.2;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke();
    g.strokeStyle = '#C8102E'; g.lineWidth = h * 0.067;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke();
    g.fillStyle = '#fff';
    g.fillRect(w / 2 - h * 0.167, 0, h * 0.333, h); g.fillRect(0, h / 2 - h * 0.167, w, h * 0.333);
    g.fillStyle = '#C8102E';
    g.fillRect(w / 2 - h * 0.1, 0, h * 0.2, h); g.fillRect(0, h / 2 - h * 0.1, w, h * 0.2);
    g.restore();
  };

  const crescent = (g, cx, cy, r, bg, off) => {
    g.fillStyle = '#fff'; JC.circle(g, cx, cy, r); g.fill();
    g.fillStyle = bg; JC.circle(g, cx + r * off, cy, r * 0.85); g.fill();
  };

  const FLAGS = {
    in(g, w, h) {
      bandsH(g, w, h, ['#FF9933', '#FFFFFF', '#138808']);
      const r = h * 0.14;
      g.strokeStyle = '#000080'; g.lineWidth = h * 0.025;
      JC.circle(g, w / 2, h / 2, r); g.stroke();
      g.lineWidth = h * 0.01;
      g.beginPath();
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
      }
      g.stroke();
    },
    us(g, w, h) {
      for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#fff' : '#B22234'; g.fillRect(0, (h * i) / 13, w, h / 13 + 0.5); }
      const cw = w * 0.4, ch = (h * 7) / 13;
      g.fillStyle = '#3C3B6E'; g.fillRect(0, 0, cw, ch);
      g.fillStyle = '#fff';
      for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) {
        star(g, cw * (c + 0.5) / 6, ch * (r + 0.5) / 5, h * 0.028);
      }
    },
    ng(g, w, h) { bandsV(g, w, h, ['#008751', '#FFFFFF', '#008751']); },
    th(g, w, h) { bandsH(g, w, h, ['#A51931', '#F4F5F8', '#2D2A4A', '#F4F5F8', '#A51931'], [1, 1, 2, 1, 1]); },
    cn(g, w, h) {
      g.fillStyle = '#DE2910'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#FFDE00';
      star(g, w * 0.17, h * 0.27, h * 0.15);
      [[0.33, 0.1], [0.4, 0.2], [0.4, 0.35], [0.33, 0.45]].forEach(([x, y]) => star(g, w * x, h * y, h * 0.05));
    },
    fr(g, w, h) { bandsV(g, w, h, ['#0055A4', '#FFFFFF', '#EF4135']); },
    gb(g, w, h) { unionJack(g, w, h); },
    ch(g, w, h) {
      g.fillStyle = '#DA291C'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff';
      const s = h * 0.6, t = s * 0.32;
      g.fillRect(w / 2 - t / 2, h / 2 - s / 2, t, s); g.fillRect(w / 2 - s / 2, h / 2 - t / 2, s, t);
    },
    au(g, w, h) {
      g.fillStyle = '#012169'; g.fillRect(0, 0, w, h);
      g.save(); unionJack(g, w / 2, h / 2); g.restore();
      g.fillStyle = '#fff';
      star(g, w * 0.25, h * 0.75, h * 0.13, 7, 0.45);
      [[0.75, 0.83, 0.07], [0.62, 0.45, 0.07], [0.75, 0.2, 0.07], [0.87, 0.4, 0.07], [0.81, 0.55, 0.04]]
        .forEach(([x, y, r]) => star(g, w * x, h * y, h * r, 7, 0.45));
    },
    sg(g, w, h) {
      bandsH(g, w, h, ['#EF3340', '#FFFFFF']);
      crescent(g, w * 0.22, h * 0.25, h * 0.16, '#EF3340', 0.35);
      g.fillStyle = '#fff';
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        star(g, w * 0.3 + Math.cos(a) * h * 0.08, h * 0.25 + Math.sin(a) * h * 0.08, h * 0.03);
      }
    },
    mv(g, w, h) {
      g.fillStyle = '#D21034'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#007E3A'; g.fillRect(w * 0.25, h * 0.25, w * 0.5, h * 0.5);
      crescent(g, w * 0.47, h * 0.5, h * 0.17, '#007E3A', 0.4);
    },
    ae(g, w, h) {
      bandsH(g, w, h, ['#00732F', '#FFFFFF', '#000000']);
      g.fillStyle = '#FF0000'; g.fillRect(0, 0, w * 0.25, h);
    },
    eg(g, w, h) {
      bandsH(g, w, h, ['#CE1126', '#FFFFFF', '#000000']);
      g.fillStyle = '#C09300';
      JC.poly(g, [w / 2, h * 0.38, w * 0.56, h * 0.47, w * 0.54, h * 0.62, w / 2, h * 0.58, w * 0.46, h * 0.62, w * 0.44, h * 0.47]);
      g.fill();
    },
  };

  // Draw a flag with a subtle cloth sheen and a fine border.
  JC.drawFlag = (g, code, x, y, w, h) => {
    const f = FLAGS[code];
    g.save();
    g.translate(x, y);
    g.beginPath(); g.rect(0, 0, w, h); g.clip();
    if (f) f(g, w, h); else { g.fillStyle = '#888'; g.fillRect(0, 0, w, h); }
    const sheen = g.createLinearGradient(0, 0, w, h);
    sheen.addColorStop(0, 'rgba(255,255,255,0.18)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, 'rgba(0,0,0,0.15)');
    g.fillStyle = sheen; g.fillRect(0, 0, w, h);
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = Math.max(0.5, h * 0.03);
    g.strokeRect(x, y, w, h);
  };

  // Flag as an <img>-ready data URL for the DOM HUD and banners.
  const urlCache = {};
  JC.flagURL = code => {
    if (urlCache[code]) return urlCache[code];
    const c = document.createElement('canvas');
    c.width = 96; c.height = 64;
    JC.drawFlag(c.getContext('2d'), code, 0, 0, 96, 64);
    return (urlCache[code] = c.toDataURL());
  };
  JC.star = star;
})();
