// Renders the launcher icons from the game's own Hummer sprite.
// Usage: serve car-crasher/www on http://localhost:8765, then: node make-icons.js
// Needs Playwright (Chromium). Writes PNGs into ../res/mipmap-*/ and ../../www/icons/.
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

const RES = path.join(__dirname, '..', 'res');
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(process.env.GAME_URL || 'http://localhost:8765/index.html');
  await page.waitForTimeout(1500);
  for (const [dir, k] of Object.entries(DENSITIES)) {
    const out = await page.evaluate(({ k }) => {
      const make = (size, mode) => {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const g = c.getContext('2d');
        const full = mode === 'legacy' || mode === 'round';
        if (mode === 'maskable') { g.fillStyle = '#14161a'; g.fillRect(0, 0, size, size); }
        if (full) {
          g.save();
          if (mode === 'round') { g.beginPath(); g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); g.clip(); }
          else { JC.rr(g, 0, 0, size, size, size * 0.2); g.clip(); }
          const bg = g.createLinearGradient(0, 0, 0, size);
          bg.addColorStop(0, '#2a2e36'); bg.addColorStop(1, '#101216');
          g.fillStyle = bg; g.fillRect(0, 0, size, size);
          g.fillStyle = 'rgba(255,255,255,0.75)';
          for (const x of [0.24, 0.76]) for (let y = -0.05; y < 1; y += 0.22) g.fillRect(size * x - size * 0.012, size * y, size * 0.024, size * 0.12);
          g.restore();
        }
        // gold burst behind the truck
        const cx = size / 2, cy = size / 2;
        const R = full ? size * 0.46 : size * 0.33;
        const burst = g.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
        burst.addColorStop(0, 'rgba(255,214,90,0.95)'); burst.addColorStop(0.45, 'rgba(255,140,30,0.55)'); burst.addColorStop(1, 'rgba(255,90,0,0)');
        g.fillStyle = burst;
        g.beginPath();
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2, r = i % 2 ? R * 0.55 : R;
          g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        g.closePath(); g.fill();
        // the truck itself, rendered crisply at this size
        const truckH = full ? size * 0.78 : size * 0.56;
        JC.R.scale = truckH / JC.HUMMER.h * 1.1;
        JC.cache.clear();
        const hs = JC.hummerSprites().day;
        const sc = truckH / JC.HUMMER.h;
        g.save();
        g.translate(cx, cy);
        g.rotate(-0.21);
        g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = size * 0.05; g.shadowOffsetY = size * 0.02;
        g.drawImage(hs.c, -hs.w * sc / 2, -hs.h * sc / 2, hs.w * sc, hs.h * sc);
        g.restore();
        return c.toDataURL('image/png');
      };
      window.__jcIcon = make;
      return {
        legacy: make(Math.round(48 * k), 'legacy'),
        round: make(Math.round(48 * k), 'round'),
        fg: make(Math.round(108 * k), 'fg'),
      };
    }, { k });
    const dirPath = path.join(RES, 'mipmap-' + dir);
    fs.mkdirSync(dirPath, { recursive: true });
    const save = (name, url) => fs.writeFileSync(path.join(dirPath, name), Buffer.from(url.split(',')[1], 'base64'));
    save('ic_launcher.png', out.legacy);
    save('ic_launcher_round.png', out.round);
    save('ic_launcher_foreground.png', out.fg);
  }
  // Web app (PWA) icons for installing from the browser.
  const web = await page.evaluate(() => {
    const draw = window.__jcIcon;
    return { a192: draw(192, 'legacy'), a512: draw(512, 'legacy'), m512: draw(512, 'maskable') };
  });
  const webDir = path.join(__dirname, '..', '..', 'www', 'icons');
  fs.mkdirSync(webDir, { recursive: true });
  const saveWeb = (name, url) => fs.writeFileSync(path.join(webDir, name), Buffer.from(url.split(',')[1], 'base64'));
  saveWeb('icon-192.png', web.a192);
  saveWeb('icon-512.png', web.a512);
  saveWeb('icon-maskable-512.png', web.m512);
  // a large copy for the README / store listing
  await browser.close();
  console.log('icons written to', RES);
})();
