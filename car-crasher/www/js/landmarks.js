/* Landmarks that rise beside the road in each location (and headline the lap banner). */
'use strict';

(function () {
  const { shade, glow } = JC;

  const lin = (g, x0, y0, x1, y1, stops) => {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    return gr;
  };

  // Each painter: (g, w, h, night) — night=true draws only the lights for the glow layer.
  const LM = {
    liberty: {
      w: 70, h: 176,
      paint(g, w, h, night) {
        const cx = w / 2;
        if (night) {
          g.save(); glow(g, '#ffcf4d', 16); g.fillStyle = '#ffd966';
          g.beginPath(); g.ellipse(cx + 10, 10, 4, 7, 0, 0, Math.PI * 2); g.fill(); g.fill(); g.restore();
          g.fillStyle = 'rgba(180,255,220,0.25)'; g.fillRect(cx - 12, 40, 24, 56);
          return;
        }
        g.fillStyle = '#7d8a7a'; JC.poly(g, [0, h, 6, h - 14, w - 6, h - 14, w, h]); g.fill();
        g.fillStyle = lin(g, 0, 0, w, 0, [[0, '#a99d88'], [0.5, '#d6ccb8'], [1, '#9b8f7a']]);
        g.fillRect(cx - 17, h - 72, 34, 58);
        g.fillStyle = 'rgba(0,0,0,0.15)';
        for (let x = cx - 13; x < cx + 14; x += 6.5) g.fillRect(x, h - 64, 2, 40);
        g.fillStyle = '#c9bfa9'; g.fillRect(cx - 20, h - 76, 40, 6);
        const robe = lin(g, cx - 12, 0, cx + 12, 0, [[0, '#3d7f6c'], [0.5, '#6fb7a0'], [1, '#356f5e']]);
        g.fillStyle = robe;
        JC.poly(g, [cx - 13, h - 76, cx - 7, 50, cx + 7, 50, cx + 12, h - 76]); g.fill();
        g.beginPath(); g.arc(cx, 44, 6, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#5ea28d'; g.lineWidth = 1.6;
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI + (i / 6) * Math.PI;
          g.beginPath(); g.moveTo(cx + Math.cos(a) * 6, 40 + Math.sin(a) * 4); g.lineTo(cx + Math.cos(a) * 12, 40 + Math.sin(a) * 9); g.stroke();
        }
        g.lineWidth = 4.5; g.lineCap = 'round'; g.strokeStyle = '#4d9580';
        g.beginPath(); g.moveTo(cx + 5, 56); g.lineTo(cx + 10, 18); g.stroke();
        g.fillStyle = '#4d9580'; g.fillRect(cx + 8, 12, 4, 8);
        g.fillStyle = '#f2b632'; g.beginPath(); g.ellipse(cx + 10, 9, 3.5, 6, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#3f8471'; g.fillRect(cx - 12, 60, 6, 14);
      },
    },
    eiffel: {
      w: 100, h: 206,
      paint(g, w, h, night) {
        const cx = w / 2;
        const shape = new Path2D();
        shape.moveTo(4, h); shape.quadraticCurveTo(28, h - 70, cx - 9, 92); shape.lineTo(cx - 3, 18); shape.lineTo(cx, 0);
        shape.lineTo(cx + 3, 18); shape.lineTo(cx + 9, 92); shape.quadraticCurveTo(w - 28, h - 70, w - 4, h);
        shape.lineTo(w - 18, h); shape.quadraticCurveTo(cx + 2, h - 62, cx, h - 62); shape.quadraticCurveTo(cx - 2, h - 62, 18, h);
        shape.closePath();
        if (night) {
          g.save(); glow(g, '#ffc94d', 10); g.strokeStyle = 'rgba(255,205,90,0.85)'; g.lineWidth = 1.6; g.stroke(shape); g.restore();
          g.fillStyle = 'rgba(255,214,120,0.35)'; g.fill(shape);
          g.save(); glow(g, '#fff', 6); g.fillStyle = '#fff';
          for (let i = 0; i < 26; i++) { g.fillRect(cx - 30 + Math.random() * 60, 20 + Math.random() * (h - 30), 1.4, 1.4); }
          g.restore();
          g.save(); glow(g, '#fff6d0', 14); g.fillStyle = '#fff6d0'; JC.circle(g, cx, 4, 3); g.fill(); g.restore();
          return;
        }
        g.fillStyle = lin(g, 0, 0, w, 0, [[0, '#5b4330'], [0.5, '#8a6a4a'], [1, '#4f3a29']]);
        g.fill(shape);
        g.save(); g.clip(shape);
        g.strokeStyle = 'rgba(200,170,130,0.45)'; g.lineWidth = 0.8;
        g.beginPath();
        for (let i = -h; i < w + h; i += 6) { g.moveTo(i, 0); g.lineTo(i + h, h); g.moveTo(i + h, 0); g.lineTo(i, h); }
        g.stroke();
        g.restore();
        g.fillStyle = '#4a3726';
        g.fillRect(cx - 30, h - 66, 60, 6); g.fillRect(cx - 15, 92, 30, 5); g.fillRect(cx - 6, 24, 12, 4);
      },
    },
    bigben: {
      w: 56, h: 196,
      paint(g, w, h, night) {
        const cx = w / 2;
        if (night) {
          g.fillStyle = 'rgba(255,200,110,0.3)'; g.fillRect(cx - 14, 60, 28, h - 60);
          g.save(); glow(g, '#fff2c4', 14); g.fillStyle = '#fff4cf'; JC.circle(g, cx, 74, 10); g.fill(); g.restore();
          return;
        }
        g.fillStyle = lin(g, cx - 15, 0, cx + 15, 0, [[0, '#a8854e'], [0.5, '#d9b878'], [1, '#9c7a45']]);
        g.fillRect(cx - 14, 88, 28, h - 88);
        g.fillStyle = 'rgba(0,0,0,0.18)';
        for (let x = cx - 10; x < cx + 12; x += 5) g.fillRect(x, 92, 1.5, h - 96);
        for (let y = 100; y < h; y += 14) g.fillRect(cx - 14, y, 28, 1);
        g.fillStyle = '#d6b574'; g.fillRect(cx - 17, 58, 34, 32);
        g.fillStyle = '#f5ecd5'; JC.circle(g, cx, 74, 11); g.fill();
        g.strokeStyle = '#c9a24a'; g.lineWidth = 1.5; g.stroke();
        g.strokeStyle = '#222'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(cx, 74); g.lineTo(cx, 66); g.moveTo(cx, 74); g.lineTo(cx + 6, 76); g.stroke();
        g.fillStyle = '#c4a466'; g.fillRect(cx - 15, 46, 30, 12);
        g.fillStyle = '#2b2b2b'; for (let x = cx - 11; x < cx + 11; x += 6) g.fillRect(x, 48, 3, 8);
        g.fillStyle = lin(g, cx - 15, 0, cx + 15, 0, [[0, '#2c3a48'], [0.5, '#4f6478'], [1, '#26323e']]);
        JC.poly(g, [cx - 15, 46, cx, 4, cx + 15, 46]); g.fill();
        g.fillStyle = '#d4af37'; g.fillRect(cx - 1, 0, 2, 10); g.fillRect(cx - 15, 44, 30, 2);
      },
    },
    burj: {
      w: 76, h: 290,
      paint(g, w, h, night) {
        const cx = w / 2;
        const steps = [[34, 0], [30, 0.12], [25, 0.26], [20, 0.4], [15, 0.54], [10, 0.66], [6, 0.76], [3, 0.86], [1, 0.96]];
        steps.forEach(([hw, t], i) => {
          const y = h - h * t, top = h - h * (steps[i + 1] ? steps[i + 1][1] : 1);
          if (night) {
            g.save(); glow(g, '#bfe6ff', 8); g.fillStyle = 'rgba(190,230,255,0.55)';
            g.fillRect(cx - 1, top, 2, y - top); g.fillRect(cx - hw * 0.6, top, 1, y - top); g.fillRect(cx + hw * 0.6, top, 1, y - top);
            g.restore();
            return;
          }
          g.fillStyle = lin(g, cx - hw, 0, cx + hw, 0, [[0, '#6e8ca3'], [0.45, '#dbe8f1'], [1, '#5c778c']]);
          g.fillRect(cx - hw, top, hw * 2, y - top);
          g.fillStyle = 'rgba(255,255,255,0.25)';
          for (let yy = top + 3; yy < y; yy += 5) g.fillRect(cx - hw, yy, hw * 2, 0.7);
        });
        if (night) { g.save(); glow(g, '#ff4040', 10); g.fillStyle = '#ff5050'; JC.circle(g, cx, 3, 2.5); g.fill(); g.restore(); }
      },
    },
    mbs: {
      w: 118, h: 150,
      paint(g, w, h, night) {
        const towers = [14, 48, 82];
        if (night) {
          g.save(); glow(g, '#fff1c1', 6); g.fillStyle = 'rgba(255,240,200,0.8)';
          towers.forEach(x => { for (let y = 36; y < h - 6; y += 6) if (Math.random() < 0.6) g.fillRect(x + 3, y, 16, 2); });
          g.restore();
          g.save(); glow(g, '#7af5ff', 12); g.fillStyle = '#7af5ff'; g.fillRect(2, 26, w - 4, 2); g.restore();
          return;
        }
        towers.forEach(x => {
          g.fillStyle = lin(g, x, 0, x + 22, 0, [[0, '#7f97a8'], [0.5, '#d9e4ea'], [1, '#6c8394']]);
          JC.poly(g, [x, h, x + 2, 30, x + 20, 30, x + 22, h]); g.fill();
          g.fillStyle = 'rgba(40,60,80,0.25)';
          for (let y = 34; y < h; y += 6) g.fillRect(x + 2, y, 18, 1);
        });
        g.fillStyle = '#e9eef1';
        g.beginPath(); g.moveTo(0, 22); g.lineTo(w, 22); g.quadraticCurveTo(w + 2, 30, w - 10, 31); g.lineTo(4, 31); g.closePath(); g.fill();
        g.fillStyle = '#56c7e0'; g.fillRect(8, 22, 50, 3);
        g.fillStyle = '#3f8f3a'; for (let x = 64; x < w - 10; x += 7) { JC.circle(g, x, 21, 2.5); g.fill(); }
      },
    },
    taj: {
      w: 124, h: 140,
      paint(g, w, h, night) {
        const cx = w / 2;
        const marble = '#f6f1e8', shadeC = '#d8d0c0';
        if (night) {
          g.fillStyle = 'rgba(255,236,200,0.35)';
          g.beginPath(); g.ellipse(cx, 52, 21, 26, 0, 0, Math.PI * 2); g.fill();
          g.fillRect(cx - 34, 70, 68, 52);
          return;
        }
        g.fillStyle = '#d9cdb5'; g.fillRect(0, h - 14, w, 14);
        g.fillStyle = '#c4b79c'; g.fillRect(0, h - 14, w, 2);
        [6, w - 11].forEach(x => {
          g.fillStyle = lin(g, x, 0, x + 5, 0, [[0, shadeC], [0.5, marble], [1, shadeC]]);
          g.fillRect(x, 40, 5, h - 54);
          g.fillStyle = marble; g.beginPath(); g.arc(x + 2.5, 40, 4.5, Math.PI, 0); g.fill();
          g.fillStyle = shadeC; for (let y = 56; y < h - 14; y += 18) g.fillRect(x - 1, y, 7, 2);
        });
        g.fillStyle = lin(g, cx - 36, 0, cx + 36, 0, [[0, shadeC], [0.5, marble], [1, shadeC]]);
        g.fillRect(cx - 36, 74, 72, h - 88);
        g.fillStyle = '#e9e1d2';
        g.beginPath(); g.moveTo(cx - 11, h - 14); g.lineTo(cx - 11, 92); g.quadraticCurveTo(cx, 80, cx + 11, 92); g.lineTo(cx + 11, h - 14); g.fill();
        g.fillStyle = '#3b3a42';
        g.beginPath(); g.moveTo(cx - 8, h - 14); g.lineTo(cx - 8, 95); g.quadraticCurveTo(cx, 85, cx + 8, 95); g.lineTo(cx + 8, h - 14); g.fill();
        [cx - 26, cx + 20].forEach(x => { g.fillStyle = '#4a4952'; g.fillRect(x, 92, 6, 10); g.fillRect(x, 108, 6, 10); });
        g.fillStyle = lin(g, cx - 22, 0, cx + 22, 0, [[0, shadeC], [0.4, '#ffffff'], [1, shadeC]]);
        g.beginPath(); g.moveTo(cx - 20, 74); g.bezierCurveTo(cx - 30, 44, cx - 6, 34, cx, 22); g.bezierCurveTo(cx + 6, 34, cx + 30, 44, cx + 20, 74); g.closePath(); g.fill();
        g.fillStyle = '#c9a24a'; g.fillRect(cx - 0.8, 10, 1.6, 13); JC.circle(g, cx, 12, 1.6); g.fill();
        [cx - 29, cx + 29].forEach(x => {
          g.fillStyle = marble; g.beginPath(); g.arc(x, 72, 6, Math.PI, 0); g.fill();
          g.fillStyle = shadeC; g.fillRect(x - 6, 72, 12, 3);
        });
      },
    },
    pearl: {
      w: 70, h: 236,
      paint(g, w, h, night) {
        const cx = w / 2;
        const spheres = [[cx, 160, 19], [cx, 74, 12], [cx, 34, 5], [cx - 22, h - 26, 7], [cx + 22, h - 26, 7]];
        if (night) {
          spheres.forEach(([x, y, r]) => { g.save(); glow(g, '#ff4fb4', 14); g.fillStyle = 'rgba(255,90,190,0.85)'; JC.circle(g, x, y, r); g.fill(); g.restore(); });
          g.save(); glow(g, '#7af5ff', 8); g.fillStyle = '#7af5ff'; g.fillRect(cx - 1, 0, 2, 30); g.restore();
          return;
        }
        g.fillStyle = '#c9c6cf';
        [[-24, -6], [24, 6], [0, 0]].forEach(([b, t]) => { JC.poly(g, [cx + b - 3, h, cx + b + 3, h, cx + t + 3, 76, cx + t - 3, 76]); g.fill(); });
        g.fillRect(cx - 3, 30, 6, 46);
        g.fillStyle = '#9b97a3'; g.fillRect(cx - 1, 0, 2, 32);
        spheres.forEach(([x, y, r]) => {
          const gr = g.createRadialGradient(x - r * 0.4, y - r * 0.4, 1, x, y, r);
          gr.addColorStop(0, '#ffc2e2'); gr.addColorStop(0.5, '#d2468f'); gr.addColorStop(1, '#7a1d4f');
          g.fillStyle = gr; JC.circle(g, x, y, r); g.fill();
        });
      },
    },
    opera: {
      w: 124, h: 80,
      paint(g, w, h, night) {
        const shells = [[6, 40, 30, 46], [26, 28, 38, 58], [58, 36, 30, 50], [82, 48, 26, 40], [100, 56, 20, 30]];
        if (night) {
          g.save(); glow(g, '#fff4e0', 10); g.fillStyle = 'rgba(255,244,224,0.55)';
          shells.forEach(([x, y, sw, sh]) => { JC.poly(g, [x, y + sh * 0.7, x + sw, y + sh * 0.7, x + sw * 0.35, y]); g.fill(); });
          g.restore();
          return;
        }
        g.fillStyle = '#c7a982'; g.fillRect(0, h - 22, w, 22);
        g.fillStyle = '#a88c66'; for (let x = 0; x < w; x += 8) g.fillRect(x, h - 22, 4, 3);
        shells.forEach(([x, y, sw, sh]) => {
          const p = new Path2D();
          p.moveTo(x, y + sh * 0.7); p.quadraticCurveTo(x + sw * 0.1, y + sh * 0.1, x + sw * 0.35, y);
          p.quadraticCurveTo(x + sw * 0.9, y + sh * 0.25, x + sw, y + sh * 0.7); p.closePath();
          g.fillStyle = lin(g, x, y, x + sw, y + sh, [[0, '#ffffff'], [0.6, '#eceae3'], [1, '#c9c6bd']]);
          g.fill(p);
          g.strokeStyle = 'rgba(160,150,130,0.6)'; g.lineWidth = 0.7;
          g.save(); g.clip(p);
          for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(x + sw * 0.35, y); g.lineTo(x + (sw * i) / 7, y + sh); g.stroke(); }
          g.restore();
        });
      },
    },
    watarun: {
      w: 90, h: 176,
      paint(g, w, h, night) {
        const prang = (cx, base, height, bw) => {
          const p = new Path2D();
          p.moveTo(cx - bw / 2, base);
          p.bezierCurveTo(cx - bw * 0.55, base - height * 0.5, cx - bw * 0.2, base - height * 0.75, cx - 1.5, base - height);
          p.lineTo(cx + 1.5, base - height);
          p.bezierCurveTo(cx + bw * 0.2, base - height * 0.75, cx + bw * 0.55, base - height * 0.5, cx + bw / 2, base);
          p.closePath();
          return p;
        };
        const parts = [[18, h - 16, 70, 22], [w - 18, h - 16, 70, 22], [w / 2, h - 22, 150, 46]];
        if (night) {
          parts.forEach(([cx, b, ht, bw]) => { g.save(); glow(g, '#ffc94d', 12); g.fillStyle = 'rgba(255,200,90,0.5)'; g.fill(prang(cx, b, ht, bw)); g.restore(); });
          return;
        }
        g.fillStyle = '#d9cfbd'; g.fillRect(0, h - 16, w, 16);
        g.fillStyle = '#c4b8a2'; g.fillRect(8, h - 24, w - 16, 8);
        parts.forEach(([cx, b, ht, bw]) => {
          const p = prang(cx, b, ht, bw);
          g.fillStyle = lin(g, cx - bw / 2, 0, cx + bw / 2, 0, [[0, '#b9ad98'], [0.5, '#f3ede0'], [1, '#a99c86']]);
          g.fill(p);
          g.save(); g.clip(p);
          for (let y = b - 6; y > b - ht; y -= 7) {
            g.fillStyle = 'rgba(120,100,80,0.35)'; g.fillRect(cx - bw, y, bw * 2, 1.2);
            for (let x = cx - bw / 2; x < cx + bw / 2; x += 4) {
              g.fillStyle = ['#e85d04', '#2a9d8f', '#e9c46a', '#3a86ff'][((x + y) | 0) & 3];
              g.fillRect(x, y - 3, 1.4, 1.4);
            }
          }
          g.restore();
          g.fillStyle = '#d4af37'; g.fillRect(cx - 1, b - ht - 6, 2, 8);
        });
      },
    },
    pyramid: {
      w: 128, h: 104,
      paint(g, w, h, night) {
        const big = [[6, h - 4], [62, 8], [122, h - 4]], small = [[70, h - 4], [102, 50], [128, h - 4]];
        if (night) {
          g.fillStyle = 'rgba(255,210,140,0.35)';
          JC.poly(g, [big[0][0], big[0][1], big[1][0], big[1][1], big[1][0] + 8, big[2][1]]); g.fill();
          g.fillStyle = 'rgba(120,170,255,0.25)';
          JC.poly(g, [big[1][0], big[1][1], big[2][0], big[2][1], big[1][0] + 8, big[2][1]]); g.fill();
          return;
        }
        [small, big].forEach(([a, top, b]) => {
          g.fillStyle = '#e8c98a'; JC.poly(g, [a[0], a[1], top[0], top[1], top[0] + 6, a[1]]); g.fill();
          g.fillStyle = '#b48b52'; JC.poly(g, [top[0], top[1], b[0], b[1], top[0] + 6, a[1]]); g.fill();
          g.strokeStyle = 'rgba(110,80,40,0.25)'; g.lineWidth = 0.8;
          for (let t = 0.1; t < 1; t += 0.08) {
            const y = JC.lerp(top[1], a[1], t);
            g.beginPath(); g.moveTo(JC.lerp(top[0], a[0], t), y); g.lineTo(JC.lerp(top[0], b[0], t), y); g.stroke();
          }
        });
        g.fillStyle = '#efe0c0'; JC.poly(g, [56, 22, 62, 8, 68, 22]); g.fill();
      },
    },
    uluru: {
      w: 130, h: 66,
      paint(g, w, h, night) {
        if (night) return;
        const p = new Path2D();
        p.moveTo(0, h); p.bezierCurveTo(4, 18, 20, 8, 46, 8); p.lineTo(96, 6);
        p.bezierCurveTo(118, 8, 128, 26, w, h); p.closePath();
        g.fillStyle = lin(g, 0, 0, 0, h, [[0, '#e0733f'], [0.6, '#b54a22'], [1, '#7d2c10']]);
        g.fill(p);
        g.save(); g.clip(p);
        g.strokeStyle = 'rgba(90,30,10,0.35)'; g.lineWidth = 1.2;
        for (let x = 10; x < w; x += 9) { g.beginPath(); g.moveTo(x, 6); g.quadraticCurveTo(x + 3, h * 0.5, x - 2, h); g.stroke(); }
        g.restore();
      },
    },
    matterhorn: {
      w: 128, h: 176,
      paint(g, w, h, night) {
        if (night) return;
        g.fillStyle = '#6d737d'; JC.poly(g, [0, h, 58, 6, 70, 14, w, h]); g.fill();
        g.fillStyle = '#9aa1ab'; JC.poly(g, [0, h, 58, 6, 52, h]); g.fill();
        g.fillStyle = '#f7fafc'; JC.poly(g, [24, 98, 58, 6, 70, 14, 96, 92, 80, 80, 66, 96, 48, 84]); g.fill();
        g.fillStyle = '#d7e0ea'; JC.poly(g, [58, 6, 70, 14, 96, 92, 80, 80, 66, 96, 60, 50]); g.fill();
      },
    },
    himalaya: {
      w: 130, h: 130,
      paint(g, w, h, night) {
        if (night) {
          g.save(); glow(g, '#ffcf73', 8); g.fillStyle = '#ffcf73'; JC.circle(g, w / 2, h - 30, 3); g.fill(); g.restore();
          return;
        }
        [[0, 30, 70], [40, 0, 130], [80, 24, 130]].forEach(([x0, top, x1], i) => {
          const px = (x0 + x1) / 2;
          g.fillStyle = ['#7a8088', '#6a7078', '#818891'][i]; JC.poly(g, [x0, h - 20, px, top, x1, h - 20]); g.fill();
          g.fillStyle = '#f7fafc'; JC.poly(g, [px - (px - x0) * 0.45, top + (h - top) * 0.4, px, top, px + (x1 - px) * 0.45, top + (h - top) * 0.4, px + 6, top + (h - top) * 0.3, px - 4, top + (h - top) * 0.36]); g.fill();
        });
        const cx = w / 2;
        g.fillStyle = '#f2efe8'; g.fillRect(cx - 14, h - 14, 28, 14);
        g.beginPath(); g.arc(cx, h - 14, 11, Math.PI, 0); g.fill();
        g.fillStyle = '#d4af37'; g.fillRect(cx - 2, h - 38, 4, 14); JC.circle(g, cx, h - 39, 2.5); g.fill();
        const cols = ['#1e5be0', '#f5f5f5', '#e01e37', '#1f8a3b', '#f4c430'];
        for (let i = 0; i < 10; i++) { g.fillStyle = cols[i % 5]; g.fillRect(cx - 40 + i * 4, h - 30 + i * 1.5, 3, 4); g.fillRect(cx + 4 + i * 4, h - 16 - i * 1.5, 3, 4); }
      },
    },
    pylon: {
      w: 70, h: 220,
      paint(g, w, h, night, side) {
        const L = side !== 'R';
        const px = L ? 20 : w - 20;
        const tx = L ? w + 4 : -4;
        if (night) {
          g.save(); glow(g, '#ff3030', 10); g.fillStyle = '#ff4040'; JC.circle(g, px, 4, 2.5); g.fill(); g.restore();
          g.save(); glow(g, '#bfe6ff', 6); g.strokeStyle = 'rgba(200,235,255,0.6)'; g.lineWidth = 0.8;
          for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(px, 26 + i * 6); g.lineTo(tx, 80 + i * 16); g.stroke(); }
          g.restore();
          return;
        }
        g.strokeStyle = 'rgba(230,230,230,0.9)'; g.lineWidth = 0.8;
        for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(px, 26 + i * 6); g.lineTo(tx, 80 + i * 16); g.stroke(); }
        g.fillStyle = lin(g, px - 12, 0, px + 12, 0, [[0, '#9b968c'], [0.5, '#e6e1d6'], [1, '#8d887e']]);
        JC.poly(g, [px - 12, h, px - 3, 90, px - 2, 0, px + 2, 0, px + 3, 90, px + 12, h, px + 6, h, px, 110, px - 6, h]); g.fill();
      },
    },
    seaplane: {
      w: 80, h: 78,
      paint(g, w, h, night) {
        const cx = w / 2;
        if (night) {
          g.save(); glow(g, '#ff3030', 8); g.fillStyle = '#ff4040'; JC.circle(g, 6, 30, 2); g.fill(); g.restore();
          g.save(); glow(g, '#30ff70', 8); g.fillStyle = '#40ff80'; JC.circle(g, w - 6, 30, 2); g.fill(); g.restore();
          return;
        }
        g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.2;
        [26, 34].forEach(r => { g.beginPath(); g.ellipse(cx, 42, r, r * 0.5, 0, 0, Math.PI * 2); g.stroke(); });
        g.fillStyle = 'rgba(0,40,50,0.25)'; g.fillRect(cx - 34, 32, 70, 9); g.fillRect(cx - 2, 10, 8, 62);
        g.fillStyle = 'rgba(0,40,50,0.25)'; g.fillRect(cx - 16, 20, 6, 42); g.fillRect(cx + 14, 20, 6, 42);
        g.fillStyle = '#e9edf0'; JC.rr(g, cx - 18, 16, 6, 42, 3); g.fill(); JC.rr(g, cx + 12, 16, 6, 42, 3); g.fill();
        g.fillStyle = '#9aa3ad'; g.fillRect(cx - 12, 30, 7, 2); g.fillRect(cx + 5, 30, 7, 2);
        g.fillStyle = '#ffffff'; JC.rr(g, cx - 5, 8, 10, 62, 5); g.fill();
        g.fillStyle = '#f7f7f7'; JC.rr(g, cx - 36, 28, 72, 9, 3); g.fill();
        g.fillStyle = '#e01e37'; g.fillRect(cx - 36, 28, 6, 9); g.fillRect(cx + 30, 28, 6, 9);
        g.fillStyle = '#1d4ed8'; g.fillRect(cx - 5, 40, 10, 3);
        g.fillStyle = '#f7f7f7'; JC.rr(g, cx - 14, 64, 28, 6, 2); g.fill();
        g.fillStyle = '#2b3442'; g.fillRect(cx - 3, 18, 6, 8);
        g.fillStyle = '#555'; g.fillRect(cx - 9, 4, 18, 2);
      },
    },
    pattayasign: {
      w: 130, h: 86,
      paint(g, w, h, night) {
        const word = 'PATTAYA CITY';
        const drawWord = () => {
          g.font = `900 13px ${JC.FONT_SIGN}`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(word, w / 2, 40);
        };
        if (night) {
          g.save(); glow(g, '#9be7ff', 10); g.fillStyle = '#e8fbff'; drawWord(); drawWord(); g.restore();
          return;
        }
        g.fillStyle = lin(g, 0, 10, 0, h, [[0, '#5d9a46'], [1, '#2f6b2a']]);
        g.beginPath(); g.moveTo(0, h); g.bezierCurveTo(10, 20, 40, 14, w / 2, 14); g.bezierCurveTo(w - 30, 14, w - 6, 24, w, h); g.closePath(); g.fill();
        g.fillStyle = 'rgba(30,70,30,0.4)';
        for (let i = 0; i < 30; i++) { JC.circle(g, 10 + Math.random() * (w - 20), 30 + Math.random() * (h - 34), 2 + Math.random() * 3); g.fill(); }
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.save(); g.translate(1.5, 1.5); drawWord(); g.restore();
        g.fillStyle = '#ffffff'; drawWord();
      },
    },
  };

  JC.LANDMARK_NAMES = {
    liberty: 'Statue of Liberty', eiffel: 'Eiffel Tower', bigben: 'Big Ben', burj: 'Burj Khalifa',
    mbs: 'Marina Bay Sands', taj: 'Taj Mahal', pearl: 'Oriental Pearl Tower', opera: 'Sydney Opera House',
    watarun: 'Wat Arun', pyramid: 'Pyramids of Giza', uluru: 'Uluru', matterhorn: 'The Matterhorn',
    himalaya: 'The Himalaya', pylon: 'Cable-stayed bridge', seaplane: 'Seaplane lagoon', pattayasign: 'Pattaya City sign',
    watchtower: 'Great Wall watchtower',
  };

  JC.makeLandmark = (id, side) => {
    if (id === 'watchtower') {
      const t = JC.makeWatchtower();
      return t;
    }
    const lm = LM[id];
    if (!lm) return null;
    return JC.cached(`lm:${id}:${side}`, () => ({
      day: JC.sprite(lm.w, lm.h, (g, w, h) => lm.paint(g, w, h, false, side), 6),
      glow: JC.sprite(lm.w, lm.h, (g, w, h) => lm.paint(g, w, h, true, side), 6),
      w: lm.w, h: lm.h, pad: 6,
    }));
  };

  // Landmark illustration for the DOM lap banner (fixed scale, independent of the render scale).
  JC.landmarkURL = id => {
    const lm = id === 'watchtower' ? null : LM[id];
    const c = document.createElement('canvas');
    const w = lm ? lm.w : 58, h = lm ? lm.h : 70;
    const s = Math.min(2.4, 220 / h);
    c.width = Math.ceil(w * s); c.height = Math.ceil(h * s);
    const g = c.getContext('2d');
    g.scale(s, s);
    if (lm) lm.paint(g, w, h, false, 'L');
    else { const t = JC.makeWatchtower(); g.drawImage(t.day.c, -t.pad, -t.pad, t.day.w, t.day.h); }
    return c.toDataURL();
  };
})();
