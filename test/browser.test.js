// Pārlūka pārbaude: node test/browser.test.js [track] [w] [h] [dsf]
const { chromium } = require('playwright');
const path = require('path');
const track = +(process.argv[2] || 0), W = +(process.argv[3] || 390), Hh = +(process.argv[4] || 844), DSF = +(process.argv[5] || 2);
const out = path.join(__dirname, 'shots'); require('fs').mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: W, height: Hh }, deviceScaleFactor: DSF, hasTouch: true, isMobile: W < 600 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'dist', 'test.html'));
  await p.waitForFunction(() => window.__game && window.__game.state() === 'menu', null, { timeout: 30000 });
  await p.evaluate(t => { window.__game.q.adapt = false; if (t) window.__game.track(t); }, track);
  await p.waitForTimeout(1500);
  const tag = `t${track}-${W}x${Hh}`;
  await p.screenshot({ path: `${out}/${tag}-menu.png` });
  await p.click('#btnGarage'); await p.waitForTimeout(800);
  await p.click('#carNext'); await p.waitForTimeout(700);
  await p.screenshot({ path: `${out}/${tag}-garage.png` });
  await p.click('#btnBack'); await p.waitForTimeout(300);
  await p.click('#btnPlay');
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `${out}/${tag}-count.png` });
  await p.waitForFunction(() => window.__game.state() === 'race', null, { timeout: 60000 });
  await p.evaluate(() => window.__game.auto(true));
  const t0 = Date.now(); let shots = 0;
  const marks = [5, 11, 17, 24];
  while (shots < marks.length) {
    const rt = await p.evaluate(() => window.__game.race().t);
    if (rt >= marks[shots]) { await p.screenshot({ path: `${out}/${tag}-race${shots}.png` }); shots++; }
    await p.waitForTimeout(250);
    if (Date.now() - t0 > 240000) break;
  }
  const info = await p.evaluate(() => { const i = window.__game.info(), r = window.__game.race(); return { calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, tex: i.memory.textures, progs: i.programs.length, t: r.t, s: r.c.s, sp: r.c.sp, walls: 0 }; });
  console.log('renderer', JSON.stringify(info), 'wall-clock', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  await p.evaluate(() => window.__game.results());
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/${tag}-results.png` });
  const st = await p.evaluate(() => ({ state: window.__game.state(), save: window.__game.save }));
  console.log('end', JSON.stringify(st));
  console.log(errs.length ? 'CONSOLE:\n' + errs.join('\n') : 'console clean');
  await b.close();
})().catch(e => { console.error('TEST ERR', e); process.exit(1); });
