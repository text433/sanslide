/* SĀNSLĪDE — spēles cilpa, kamera, ievade, skaņa, HUD un izvēlnes */
(function () {
  'use strict';
  var T = window.THREE, S = window.SIM, G = window.GFX;
  function $(id) { return document.getElementById(id); }
  var app = $('app');
  function fatal(msg) { $('bootMsg').textContent = msg; app.dataset.state = 'boot'; }
  if (!T || !G) { fatal('Neizdevās ielādēt 3D bibliotēku. Pārbaudi interneta savienojumu un atver lapu vēlreiz.'); return; }

  /* ---------- saglabātais progress ---------- */
  var SAVE_KEY = 'sanslide.v1';
  var save = { coins: 0, trophies: 0, owned: ['street'], car: 'street', track: 0, best: {}, sound: true, lowGfx: false, tut: false, races: 0 };
  function mergeSave(j) { if (j && typeof j === 'object') Object.keys(save).forEach(function (k) { if (k in j) save[k] = j[k]; }); }
  function store() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* bez krātuves spēle strādā tāpat */ } }
  try { mergeSave(JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')); } catch (e) { /* tukšs sākums */ }
  var LEAGUES = [{ n: 'Bronza', at: 0 }, { n: 'Sudrabs', at: 120 }, { n: 'Zelts', at: 300 }, { n: 'Platīns', at: 550 }, { n: 'Leģenda', at: 850 }];
  function leagueOf(t) { var i = 0; while (i < LEAGUES.length - 1 && t >= LEAGUES[i + 1].at) i++; return i; }
  var RIVALS = ['Nakts_Reiss', 'Asfalta Vilks', 'Turbo Jānis', 'Sānis_22', 'Līkumu Laura', 'Dūmu Dāvis', 'Kanjona Kate', 'Slīdošais Olis', 'Riepu Rūdis', 'Ķiršu Krista'];
  function carStats(id) { for (var i = 0; i < S.CARS.length; i++) if (S.CARS[i].id === id) return S.CARS[i]; return S.CARS[0]; }
  function fmtTime(t) { var m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }
  function fmtNum(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

  /* ---------- renderētājs un aina ---------- */
  var canvas = $('gl'), renderer;
  try { renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { fatal('Šis pārlūks neatbalsta WebGL, tāpēc spēli nevar palaist.'); return; }
  var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var Q = { dpr: Math.min(window.devicePixelRatio || 1, 2), shadows: true, step: 0, adapt: true };
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  var scene = new T.Scene(); scene.fog = new T.Fog(0xffffff, 90, 300); scene.background = new T.Color(0xffffff);
  var camera = new T.PerspectiveCamera(55, 1, 2, 900);
  var hemi = new T.HemisphereLight(0xffffff, 0x888888, 0.64), sun = new T.DirectionalLight(0xffffff, 0.52);
  sun.castShadow = true; sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048); sun.shadow.bias = -0.0009; sun.shadow.normalBias = 0.45;
  scene.add(hemi); scene.add(sun); scene.add(sun.target);
  var SUN = new T.Vector3(-0.52, -1, 0.44).normalize();
  var sR = new T.Vector3().crossVectors(new T.Vector3(0, 1, 0), SUN.clone().negate()).normalize();
  var sU = new T.Vector3().crossVectors(SUN.clone().negate(), sR).normalize();
  var tv = new T.Vector3();
  function fitShadow(cx, cz, ext) {
    var sc = sun.shadow.camera;
    if (sc.right !== ext) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 430; sc.updateProjectionMatrix(); }
    var tex = 2 * ext / sun.shadow.mapSize.x;
    tv.set(cx, 0, cz);
    var r = Math.round(tv.dot(sR) / tex) * tex, u = Math.round(tv.dot(sU) / tex) * tex, l = tv.dot(SUN);
    sun.target.position.set(sR.x * r + sU.x * u + SUN.x * l, sR.y * r + sU.y * u + SUN.y * l, sR.z * r + sU.z * u + SUN.z * l);
    sun.position.copy(sun.target.position).addScaledVector(SUN, -210);
    sun.target.updateMatrixWorld();
  }
  function applyQuality() {
    renderer.setPixelRatio(Q.dpr);
    var on = Q.shadows && !save.lowGfx;
    if (renderer.shadowMap.enabled !== on) { renderer.shadowMap.enabled = on; sun.castShadow = on; scene.traverse(function (o) { if (o.material) o.material.needsUpdate = true; }); }
    resize();
  }
  function resize() {
    var w = app.clientWidth || window.innerWidth, h = app.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  var smoke = G.makeSmoke(170), sparks = G.makeSparks(70), marks = new G.Marks(720);
  scene.add(smoke.mesh); scene.add(sparks.mesh); scene.add(marks.mesh);

  /* ---------- stāvoklis ---------- */
  var state = 'boot', prevState = 'race', world = null, race = null, pCar = null, rCar = null, rivalName = '';
  var time = 0, last = 0, acc = 0, H = 1 / 120, timeScale = 1, cdT = 0, cdStage = 0, finT = 0, goT = 0, auto = false;
  var cam = { yaw: 0, tx: 0, tz: 0, shake: 0, kick: 0, orbit: 0.6, px: 0, py: 0, pz: 0 };
  var inp = { key: 0, kl: false, kr: false, touch: 0, id: null, x0: 0, range: 64 };
  var fx = { pSmoke: 0, rSmoke: 0, dust: 0, last: [null, null, null, null] };
  var garageIdx = 0, resultShown = false;
  var TINT = [[0.12, 0.11, 0.14], [1, 0.82, 0.25], [1, 0.4, 0.14], [0.44, 0.89, 1]];
  var SMK = [[1, 1, 1], [1, 0.95, 0.72], [1, 0.8, 0.55], [0.72, 0.94, 1]];

  function setState(s) { state = s; app.dataset.state = s; }

  function loadWorld(idx) {
    if (world) { scene.remove(world.group); world.dispose(); }
    world = G.buildWorld(S.TRACKS[idx], save.lowGfx);
    scene.add(world.group);
    var th = world.theme;
    scene.background.setHex(th.sky); scene.fog.color.setHex(th.sky); scene.fog.near = th.fog[0]; scene.fog.far = th.fog[1];
    hemi.color.setHex(th.hemiSky); hemi.groundColor.setHex(th.hemiGround); hemi.intensity = th.hemiI;
    sun.color.setHex(th.sun); sun.intensity = th.sunI;
    marks.clear(); smoke.clear(); sparks.clear();
  }
  function setPlayerCar(id) {
    if (pCar && pCar.id === id) return;
    if (pCar) { scene.remove(pCar.root); pCar.dispose(); }
    pCar = G.buildCar(id); scene.add(pCar.root);
  }
  function setRival(id, paint) {
    if (rCar) { scene.remove(rCar.root); rCar.dispose(); }
    rCar = G.buildCar(id, paint[0], paint[1]); scene.add(rCar.root);
  }
  function gridPose(d) { var tr = world.tr, p = tr.at(tr.startS - 5); return { x: p.x + Math.cos(p.th) * d, z: p.z - Math.sin(p.th) * d, th: p.th }; }
  function poseCar(v, x, z, th) {
    v.root.position.set(x, 0, z); v.root.rotation.y = th; v.tilt.rotation.set(0, 0, 0);
    v.wheels[0].rotation.y = v.wheels[1].rotation.y = 0; v.flames[0].visible = v.flames[1].visible = false;
  }

  /* ---------- skaņa (sintezēta ar WebAudio) ---------- */
  var AU = { ctx: null };
  function audioInit() {
    if (!save.sound) return;
    try {
      if (!AU.ctx) {
        var C = window.AudioContext || window.webkitAudioContext; if (!C) return;
        var c = AU.ctx = new C(), i;
        AU.master = c.createGain(); AU.master.gain.value = 0.85; AU.master.connect(c.destination);
        AU.eng = c.createGain(); AU.eng.gain.value = 0;
        AU.lp = c.createBiquadFilter(); AU.lp.type = 'lowpass'; AU.lp.frequency.value = 500; AU.lp.Q.value = 3;
        AU.o1 = c.createOscillator(); AU.o1.type = 'sawtooth'; AU.o2 = c.createOscillator(); AU.o2.type = 'square';
        AU.o2g = c.createGain(); AU.o2g.gain.value = 0.3;
        AU.o1.connect(AU.lp); AU.o2.connect(AU.o2g); AU.o2g.connect(AU.lp); AU.lp.connect(AU.eng); AU.eng.connect(AU.master);
        AU.o1.start(); AU.o2.start();
        var len = Math.floor(c.sampleRate * 1.5), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
        for (i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        AU.nbuf = buf;
        AU.ns = c.createBufferSource(); AU.ns.buffer = buf; AU.ns.loop = true;
        AU.bp = c.createBiquadFilter(); AU.bp.type = 'bandpass'; AU.bp.frequency.value = 1700; AU.bp.Q.value = 4.5;
        AU.tire = c.createGain(); AU.tire.gain.value = 0;
        AU.hp = c.createBiquadFilter(); AU.hp.type = 'highpass'; AU.hp.frequency.value = 2600;
        AU.wind = c.createGain(); AU.wind.gain.value = 0;
        AU.ns.connect(AU.bp); AU.bp.connect(AU.tire); AU.tire.connect(AU.master);
        AU.ns.connect(AU.hp); AU.hp.connect(AU.wind); AU.wind.connect(AU.master);
        AU.ns.start();
      }
      if (AU.ctx.state === 'suspended') AU.ctx.resume();
    } catch (e) { AU.ctx = null; }
  }
  function tone(f0, f1, dur, type, vol, delay) {
    if (!AU.ctx || !save.sound) return;
    try {
      var c = AU.ctx, t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
      o.type = type || 'square'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(AU.master); o.start(t); o.stop(t + dur + 0.03);
    } catch (e) { /* skaņa nav obligāta */ }
  }
  function burst(dur, freq, vol, type) {
    if (!AU.ctx || !save.sound) return;
    try {
      var c = AU.ctx, t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = AU.nbuf; f.type = type || 'lowpass'; f.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(AU.master); s.start(t, Math.random()); s.stop(t + dur + 0.03);
    } catch (e) { /* skaņa nav obligāta */ }
  }
  var sfx = {
    click: function () { tone(520, 760, 0.07, 'square', 0.07); },
    beep: function (hi) { tone(hi ? 880 : 440, hi ? 880 : 440, hi ? 0.5 : 0.16, 'square', 0.12); },
    boost: function (lv) { burst(0.55, 1800, 0.22, 'highpass'); tone(260, 900 + lv * 180, 0.38, 'sawtooth', 0.09); },
    hit: function (v) { burst(0.22, 420, 0.5 * v); tone(120, 50, 0.18, 'sine', 0.3 * v); },
    drift: function (lv) { tone(660 + lv * 110, 990 + lv * 160, 0.12, 'triangle', 0.1); },
    win: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, f, 0.22, 'square', 0.1, i * 0.12); }); },
    lose: function () { [392, 330, 262].forEach(function (f, i) { tone(f, f * 0.97, 0.3, 'triangle', 0.12, i * 0.18); }); },
    coin: function () { tone(988, 988, 0.08, 'square', 0.08); tone(1319, 1319, 0.2, 'square', 0.08, 0.08); }
  };
  function audioFrame() {
    if (!AU.ctx) return;
    var c = AU.ctx, t = c.currentTime, live = (state === 'race' || state === 'finish' || state === 'countdown') && save.sound, sp = 0, dr = 0, bo = 0;
    if (race && live) { sp = race.c.sp; dr = race.c.drifting ? S.clamp(Math.abs(race.c.al) * 1.6, 0.25, 1) : 0; bo = race.c.boostT > 0 ? 1 : 0; }
    var gear = Math.min(4, Math.floor(sp / 9.5)), fr = (sp - gear * 9.5) / 9.5;
    var f = state === 'countdown' ? 62 + 26 * Math.abs(Math.sin(time * 5)) : 58 + fr * 62 + gear * 13 + bo * 26;
    AU.o1.frequency.setTargetAtTime(f, t, 0.05); AU.o2.frequency.setTargetAtTime(f * 0.502, t, 0.05);
    AU.lp.frequency.setTargetAtTime(420 + sp * 30 + bo * 500, t, 0.08);
    AU.eng.gain.setTargetAtTime(live ? 0.085 : 0, t, 0.08);
    AU.tire.gain.setTargetAtTime(live ? dr * 0.13 : 0, t, 0.06);
    AU.bp.frequency.setTargetAtTime(1500 + sp * 22, t, 0.1);
    AU.wind.gain.setTargetAtTime(live ? bo * 0.07 + sp * 0.0006 : 0, t, 0.1);
    AU.master.gain.setTargetAtTime(save.sound ? 0.85 : 0, t, 0.05);
  }

  /* ---------- HUD ---------- */
  var el = {};
  ['mCoins', 'mCups', 'mLeague', 'trkName', 'trkMeta', 'mCar', 'gCoins', 'gName', 'gCls', 'sTop', 'sAcc', 'sGrip', 'sDrift', 'btnCar', 'progFill', 'mkRv', 'mkMe',
    'posNum', 'gap', 'time', 'driftLive', 'driftPts', 'driftMul', 'toast', 'count', 'rivalTag', 'hint', 'stick', 'spd', 'nitro', 'vfx',
    'resTitle', 'resSub', 'rTime', 'rDrift', 'rBest', 'rCoins', 'rCups', 'lgNow', 'lgNext', 'lgBar', 'btnSound2', 'btnGfx', 'sndWave', 'btnAgain'].forEach(function (k) { el[k] = $(k); });
  var segs = el.nitro.querySelectorAll('.segs b'), knob = el.stick.firstElementChild, hudC = {};
  function setText(k, v) { if (hudC[k] !== v) { hudC[k] = v; el[k].textContent = v; } }
  function toast(txt, cls) {
    var e = el.toast; e.textContent = txt; e.className = cls || ''; void e.offsetWidth; e.classList.add('show');
  }
  function countPop(txt, go) { var e = el.count; e.textContent = txt; e.className = go ? 'go' : ''; void e.offsetWidth; e.classList.add('pop'); }
  function hitFlash() { if (reduced) return; el.vfx.classList.remove('hit'); void el.vfx.offsetWidth; el.vfx.classList.add('hit'); }

  function refreshMenu() {
    var d = S.TRACKS[save.track], lg = leagueOf(save.trophies), best = save.best[d.id];
    el.mCoins.textContent = fmtNum(save.coins); el.mCups.textContent = fmtNum(save.trophies); el.mLeague.textContent = LEAGUES[lg].n;
    el.trkName.textContent = d.name;
    el.trkMeta.textContent = (world ? ((world.tr.finishS - world.tr.startS) / 1000).toFixed(1).replace('.', ',') + ' km · ' : '') + (best ? 'rekords ' + fmtTime(best) : d.tag);
    el.mCar.textContent = carStats(save.car).name;
    el.sndWave.style.display = save.sound ? '' : 'none';
    el.btnSound2.textContent = 'Skaņa: ' + (save.sound ? 'iesl.' : 'izsl.');
    el.btnGfx.textContent = 'Grafika: ' + (save.lowGfx ? 'viegla' : 'auto');
  }
  function refreshGarage() {
    var st = S.CARS[garageIdx], owned = save.owned.indexOf(st.id) >= 0;
    el.gCoins.textContent = fmtNum(save.coins); el.gName.textContent = st.name; el.gCls.textContent = st.cls;
    el.sTop.style.width = Math.round((st.top - 30) / 9 * 100) + '%';
    el.sAcc.style.width = Math.round((st.accel - 12) / 8.5 * 100) + '%';
    el.sGrip.style.width = Math.round((st.grip - 4.6) / 3 * 100) + '%';
    el.sDrift.style.width = Math.round((3.4 - st.dgrip) / 1.5 * 100) + '%';
    var b = el.btnCar;
    if (owned) { b.textContent = st.id === save.car ? 'Izvēlēta' : 'Izvēlēties'; b.disabled = st.id === save.car; }
    else { b.textContent = save.coins >= st.price ? 'Pirkt · ' + fmtNum(st.price) : 'Maksā ' + fmtNum(st.price) + ' monētas'; b.disabled = save.coins < st.price; }
    b.classList.toggle('long', !owned && save.coins < st.price);
    setPlayerCar(st.id);
    var g = gridPose(-2.8); poseCar(pCar, g.x, g.z, g.th);
  }

  /* ---------- plūsma ---------- */
  function goMenu() {
    race = null; timeScale = 1; app.classList.remove('boosting');
    setPlayerCar(save.car);
    var g = gridPose(-2.8); poseCar(pCar, g.x, g.z, g.th);
    if (rCar) rCar.root.visible = false;
    cam.tx = g.x; cam.tz = g.z; cam.yaw = g.th;
    marks.clear(); smoke.clear(); sparks.clear();
    refreshMenu(); setState('menu');
  }
  function openGarage() {
    garageIdx = Math.max(0, S.CARS.indexOf(carStats(save.car)));
    refreshGarage(); setState('garage');
  }
  function startRace() {
    audioInit();
    var tr = world.tr, st = carStats(save.car);
    var lvl = save.trophies / 650 - (save.races < 2 ? 0.2 : 0);
    race = S.newRace(tr, st, S.aiConfig(lvl), (Math.random() * 1e9) | 0);
    setPlayerCar(save.car);
    var ids = S.CARS.map(function (c) { return c.id; }), paints = G.RIVAL_PAINTS;
    setRival(ids[Math.floor(Math.random() * ids.length)], paints[Math.floor(Math.random() * paints.length)]);
    rCar.root.visible = true;
    rivalName = RIVALS[Math.floor(Math.random() * RIVALS.length)];
    poseCar(pCar, race.c.x, race.c.z, race.c.th); poseCar(rCar, race.a.x, race.a.z, race.a.th);
    cam.tx = race.c.x; cam.tz = race.c.z; cam.yaw = race.c.th; cam.shake = 0; cam.kick = 0;
    marks.clear(); smoke.clear(); sparks.clear(); fx.last = [null, null, null, null];
    inp.touch = 0; inp.key = 0; acc = 0; timeScale = 1; cdT = 0; cdStage = 0; finT = 0; goT = 0; resultShown = false;
    hudC = {}; el.driftLive.classList.remove('on'); el.toast.className = ''; el.count.className = ''; el.nitro.classList.remove('boost');
    el.hint.classList.toggle('on', !save.tut);
    app.classList.remove('boosting');
    updateHud(0);
    setState('countdown');
  }
  function pause() {
    if (state !== 'race' && state !== 'countdown') return;
    prevState = state; releaseTouch(); refreshMenu(); setState('paused');
  }
  function resume() { if (state === 'paused') { last = performance.now(); setState(prevState); } }

  function updateCountdown(dt) {
    cdT += dt;
    var marks3 = [0.5, 1.4, 2.3, 3.2];
    if (cdStage < 4 && cdT >= marks3[cdStage]) {
      if (cdStage < 3) { countPop(String(3 - cdStage)); sfx.beep(false); }
      else { countPop('AIZIET!', true); sfx.beep(true); setState('race'); goT = 0.7; }
      cdStage++;
    }
  }

  function onEvent(e) {
    var c = race.c;
    switch (e.t) {
      case 'boost':
        sfx.boost(e.lv); toast(['', 'NITRO!', 'NITRO ×2!', 'NITRO ×3!'][e.lv], 'ice'); cam.kick = 1; break;
      case 'pad': sfx.boost(1); toast('TURBO!', 'ice'); cam.kick = 1; break;
      case 'drift': sfx.drift(e.lv); break;
      case 'wall':
        sfx.hit(S.clamp(e.v / 16, 0.3, 1)); cam.shake = Math.max(cam.shake, S.clamp(e.v / 14, 0.3, 1)); hitFlash();
        for (var i = 0; i < 12; i++) sparks.spawn(c.x, 0.5, c.z, (Math.random() - 0.5) * 12, 3 + Math.random() * 6, (Math.random() - 0.5) * 12, 0.35 + Math.random() * 0.3, 0.32, 0.1, [1, 0.8 + Math.random() * 0.2, 0.25], 22);
        break;
      case 'bump': sfx.hit(0.45); cam.shake = Math.max(cam.shake, 0.35); break;
      case 'reset': toast('ATPAKAĻ UZ TRASES', 'sun'); break;
      case 'finish':
      case 'aifinish':
        if (state === 'race') { setState('finish'); finT = 0; timeScale = reduced ? 1 : 0.35; releaseTouch(); if (race.winner === 1) { toast('FINIŠS!', 'sun'); sfx.win(); } else sfx.lose(); }
        break;
    }
  }

  function showResults() {
    if (resultShown) return; resultShown = true;
    var c = race.c, tr = race.tr, d = tr.def, win = race.winner === 1;
    var lgBefore = leagueOf(save.trophies), rec = false;
    var coins = win ? 120 + Math.min(140, Math.round(c.total / 60)) : 35 + Math.min(60, Math.round(c.total / 120));
    var cups = win ? 30 : -12;
    if (c.fin >= 0 && (!save.best[d.id] || c.fin < save.best[d.id])) { rec = !!save.best[d.id] || win; save.best[d.id] = Math.round(c.fin * 10) / 10; if (rec) coins += 40; }
    var before = save.trophies;
    save.coins += coins; save.trophies = Math.max(0, save.trophies + cups); save.races++; save.tut = true; cups = save.trophies - before;
    race.over = true;
    store();
    var lg = leagueOf(save.trophies), nx = LEAGUES[Math.min(lg + 1, LEAGUES.length - 1)], at = LEAGUES[lg].at;
    el.resTitle.textContent = win ? 'Uzvara!' : 'Zaudējums'; el.resTitle.className = win ? 'win' : 'lose';
    el.resSub.textContent = win
      ? rivalName + ' palika ' + Math.max(1, Math.round(c.s - race.a.u)) + ' m aiz tevis.' + (lg > lgBefore ? ' Jauna līga: ' + LEAGUES[lg].n + '!' : '')
      : rivalName + ' finišēja ātrāk. Tev līdz finišam pietrūka ' + Math.max(1, Math.round(tr.finishS - c.s)) + ' m.';
    el.rTime.textContent = c.fin >= 0 ? fmtTime(c.fin) + (rec ? ' · rekords' : '') : '—'; el.rTime.className = rec ? 'rec' : '';
    el.rDrift.textContent = fmtNum(c.total); el.rBest.textContent = fmtNum(c.best);
    el.rCoins.textContent = '+' + coins; el.rCups.textContent = (cups >= 0 ? '+' : '−') + Math.abs(cups);
    el.lgNow.textContent = LEAGUES[lg].n + ' · ' + save.trophies;
    el.lgNext.textContent = lg === LEAGUES.length - 1 ? 'augstākā līga' : nx.n + ' · ' + nx.at;
    el.lgBar.style.width = '0%';
    var pct = lg === LEAGUES.length - 1 ? 100 : Math.round((save.trophies - at) / (nx.at - at) * 100);
    setTimeout(function () { el.lgBar.style.width = pct + '%'; }, 30);
    timeScale = 1; app.classList.remove('boosting');
    setState('results'); sfx.coin();
    try { el.btnAgain.focus({ preventScroll: true }); } catch (e) { /* fokuss nav obligāts */ }
  }

  /* ---------- mašīnu un efektu atjaunošana ---------- */
  function wpos(x, z, th, lx, lz, out) { var cs = Math.cos(th), sn = Math.sin(th); out[0] = x + lx * cs + lz * sn; out[1] = z - lx * sn + lz * cs; return out; }
  var w0 = [0, 0], w1 = [0, 0];
  function animCar(v, x, z, th, yaw, sp, wheelYaw, boost, dt) {
    v.root.position.set(x, 0, z); v.root.rotation.y = th;
    var roll = S.clamp(yaw * sp * 0.0034, -0.11, 0.11), pitch = boost ? -0.045 : 0;
    v.tilt.rotation.z += (roll - v.tilt.rotation.z) * Math.min(1, 8 * dt);
    v.tilt.rotation.x += (pitch - v.tilt.rotation.x) * Math.min(1, 6 * dt);
    var spin = sp / v.w.r * dt;
    for (var i = 0; i < 4; i++) v.wheels[i].rotation.x += spin;
    v.wheels[0].rotation.y = v.wheels[1].rotation.y = wheelYaw;
    v.flames[0].visible = v.flames[1].visible = boost;
    if (boost) { var s = 0.9 + Math.random() * 0.9; v.flames[0].scale.set(1, 1, s); v.flames[1].scale.set(1, 1, s * 0.9); }
  }
  function trail(v, slot, x, z, th, on, col, w) {
    for (var k = 0; k < 2; k++) {
      var p = wpos(x, z, th, k ? -v.w.t : v.w.t, v.w.b, k ? w1 : w0), L = fx.last[slot + k];
      if (!on) { fx.last[slot + k] = null; continue; }
      if (!L) { fx.last[slot + k] = [p[0], p[1]]; continue; }
      var dx = p[0] - L[0], dz = p[1] - L[1];
      if (dx * dx + dz * dz > 0.8) { marks.add(L[0], L[1], p[0], p[1], w, col); L[0] = p[0]; L[1] = p[1]; }
    }
  }
  function puff(x, z, th, v, col, big) {
    var side = Math.random() < 0.5 ? -1 : 1, p = wpos(x, z, th, side * v.w.t, v.w.b - 0.2, w0);
    smoke.spawn(p[0], 0.35, p[1], (Math.random() - 0.5) * 2.4, 1 + Math.random() * 1.6, (Math.random() - 0.5) * 2.4, 0.6 + Math.random() * 0.55, 0.5, big ? 2.5 : 1.8, col, 0);
  }
  function updateRaceVisuals(dt) {
    var c = race.c, a = race.a, tr = race.tr, lv = Math.min(3, Math.floor(c.charge + 1e-6)), boost = c.boostT > 0;
    animCar(pCar, c.x, c.z, c.th, c.yaw, c.sp, S.clamp(c.al * 0.8 - c.steer * 0.32, -0.6, 0.6), boost, dt);
    animCar(rCar, a.x, a.z, a.th, a.k * a.sp, a.sp, S.clamp(-a.vis * 0.7, -0.5, 0.5), false, dt);
    var sliding = c.drifting || (Math.abs(c.al) > 0.2 && c.sp > 8), launch = state === 'race' && race.t < 0.9;
    if (sliding || launch) {
      fx.pSmoke += dt * (launch ? 30 : 16 + Math.abs(c.al) * 34);
      while (fx.pSmoke >= 1) { fx.pSmoke--; puff(c.x, c.z, c.th, pCar, SMK[lv], lv >= 2); }
    }
    trail(pCar, 0, c.x, c.z, c.th, sliding && !c.off, TINT[lv], 0.3);
    if (c.off && c.sp > 8) { fx.dust += dt * 14; while (fx.dust >= 1) { fx.dust--; puff(c.x, c.z, c.th, pCar, world.theme.verge, false); } }
    if (a.drifting) { fx.rSmoke += dt * 14; while (fx.rSmoke >= 1) { fx.rSmoke--; puff(a.x, a.z, a.th, rCar, SMK[0], false); } }
    trail(rCar, 2, a.x, a.z, a.th, a.drifting, TINT[0], 0.28);
    if (boost && Math.random() < dt * 40) {
      var p = wpos(c.x, c.z, c.th, (Math.random() - 0.5) * 0.9, pCar.w.b - 1, w0);
      sparks.spawn(p[0], 0.5, p[1], 0, 0.6, 0, 0.3, 0.3, 0.05, [0.5, 0.92, 1], 0);
    }
    app.classList.toggle('boosting', boost && !reduced);
  }

  function updateHud(dt) {
    var c = race.c, a = race.a, tr = race.tr, span = tr.finishS - tr.startS;
    var pm = S.clamp((c.s - tr.startS) / span, 0, 1), pr = S.clamp((a.u - tr.startS) / span, 0, 1);
    el.mkMe.style.left = 'calc(' + pm.toFixed(4) + ' * (100% - 28px))'; el.mkRv.style.left = 'calc(' + pr.toFixed(4) + ' * (100% - 28px))';
    el.progFill.style.width = (pm * 100).toFixed(1) + '%';
    var first = c.s >= a.u, gap = Math.round(c.s - a.u);
    setText('posNum', first ? '1' : '2');
    if (hudC.first !== first) { hudC.first = first; el.posNum.className = first ? '' : 'second'; }
    setText('gap', (gap >= 0 ? '+' : '−') + Math.abs(gap) + ' m');
    setText('time', fmtTime(c.fin >= 0 ? c.fin : race.t));
    setText('spd', String(Math.round(c.sp * 3.6 * 1.55)));
    var boost = c.boostT > 0, i;
    if (hudC.boost !== boost) { hudC.boost = boost; el.nitro.classList.toggle('boost', boost); hudC.bmax = 0; }
    if (boost && c.boostT > (hudC.bmax || 0)) hudC.bmax = c.boostT;
    for (i = 0; i < 3; i++) {
      var f = S.clamp((boost ? c.boostT / hudC.bmax * 3 : c.charge) - i, 0, 1), w = Math.round(f * 100);
      if (hudC['s' + i] !== w) { hudC['s' + i] = w; segs[i].style.width = w + '%'; }
    }
    var live = c.driftTime > 0.3 && c.driftPts > 150;
    if (hudC.live !== live) { hudC.live = live; el.driftLive.classList.toggle('on', live); }
    if (live) { setText('driftPts', fmtNum(c.driftPts)); setText('driftMul', '×' + (1 + Math.min(2, c.driftTime * 0.35)).toFixed(1)); }
    // pretinieka birka virs mašīnas
    tv.set(a.x, 3.1, a.z).project(camera);
    var vis = tv.z < 1 && Math.abs(tv.x) < 0.94 && tv.y < 0.74 && tv.y > -0.8;
    if (vis) {
      el.rivalTag.style.opacity = '1';
      el.rivalTag.style.transform = 'translate(' + ((tv.x * 0.5 + 0.5) * app.clientWidth).toFixed(1) + 'px,' + ((-tv.y * 0.5 + 0.5) * app.clientHeight).toFixed(1) + 'px) translate(-50%,-100%)';
      setText('rivalTag', rivalName);
    } else el.rivalTag.style.opacity = '0';
  }

  /* ---------- kamera ---------- */
  var cPos = new T.Vector3(), cLook = new T.Vector3(), oPos = new T.Vector3(), oLook = new T.Vector3();
  function hTan() { return Math.tan(camera.fov * Math.PI / 360) * camera.aspect; }
  function rigRace(pos, look) {
    var d = S.clamp(13.5 / hTan(), 30, 54), fxx = Math.sin(cam.yaw), fzz = Math.cos(cam.yaw);
    pos.set(cam.tx - fxx * d * 0.62, d * 0.8, cam.tz - fzz * d * 0.62);
    look.set(cam.tx + fxx * d * 0.2, 0.5, cam.tz + fzz * d * 0.2);
  }
  function rigOrbit(pos, look, close) {
    var r = S.clamp((close ? 3.1 : 3.5) / hTan(), 7, 15);
    pos.set(cam.tx + Math.sin(cam.orbit) * r, r * 0.3 + 1.1, cam.tz + Math.cos(cam.orbit) * r);
    look.set(cam.tx, 0.8 - r * (close ? 0.2 : 0.11), cam.tz);
  }
  function updateCamera(dt) {
    var baseFov = 55;
    if (state === 'menu' || state === 'garage' || state === 'boot') {
      cam.orbit += dt * 0.22;
      rigOrbit(cPos, cLook, state === 'garage');
      fitShadow(cam.tx, cam.tz, 22);
    } else if (race) {
      var c = race.c, tr = race.tr, tth = tr.thAt(c.s + 7);
      if (state !== 'paused') {
        cam.yaw += S.wrap(tth - cam.yaw) * Math.min(1, 3.2 * dt);
        cam.tx += (c.x - cam.tx) * Math.min(1, 10 * dt); cam.tz += (c.z - cam.tz) * Math.min(1, 10 * dt);
      }
      rigRace(cPos, cLook);
      if (state === 'countdown' || (state === 'paused' && prevState === 'countdown')) {
        var k = S.clamp(cdT / 2.6, 0, 1); k = k * k * (3 - 2 * k);
        cam.orbit = cam.yaw + Math.PI + 0.9 - k * 0.9;
        rigOrbit(oPos, oLook, false);
        cPos.lerpVectors(oPos, cPos, k); cLook.lerpVectors(oLook, cLook, k);
      } else if (state === 'results') {
        cam.orbit += dt * 0.25; rigOrbit(cPos, cLook, false);
      }
      cam.kick += ((c.boostT > 0 ? 1 : 0) - cam.kick) * Math.min(1, 4 * dt);
      baseFov += cam.kick * 6;
      if (state === 'results') fitShadow(cam.tx, cam.tz, 26); else fitShadow(cam.tx + Math.sin(cam.yaw) * 36, cam.tz + Math.cos(cam.yaw) * 36, 76);
    }
    if (cam.shake > 0.001 && !reduced) {
      cPos.x += (Math.random() - 0.5) * cam.shake * 1.5; cPos.y += (Math.random() - 0.5) * cam.shake * 1.1; cPos.z += (Math.random() - 0.5) * cam.shake * 1.5;
    }
    cam.shake *= Math.exp(-5 * dt);
    if (Math.abs(camera.fov - baseFov) > 0.05) { camera.fov = baseFov; camera.updateProjectionMatrix(); }
    camera.position.copy(cPos); camera.lookAt(cLook);
  }

  /* ---------- ievade ---------- */
  var touchEl = $('touch');
  function releaseTouch() { inp.id = null; inp.touch = 0; el.stick.classList.remove('on'); }
  touchEl.addEventListener('pointerdown', function (e) {
    audioInit();
    if (inp.id !== null || (state !== 'race' && state !== 'countdown')) return;
    inp.id = e.pointerId; inp.x0 = e.clientX; inp.range = S.clamp(window.innerWidth * 0.17, 48, 84); inp.touch = 0;
    try { touchEl.setPointerCapture(e.pointerId); } catch (err) { /* nav kritiski */ }
    el.stick.style.left = e.clientX + 'px'; el.stick.style.top = e.clientY + 'px'; knob.style.transform = 'translateX(0)'; el.stick.classList.add('on');
    e.preventDefault();
  });
  touchEl.addEventListener('pointermove', function (e) {
    if (e.pointerId !== inp.id) return;
    var dx = e.clientX - inp.x0;
    if (Math.abs(dx) > inp.range) { inp.x0 = e.clientX - (dx > 0 ? inp.range : -inp.range); dx = dx > 0 ? inp.range : -inp.range; el.stick.style.left = inp.x0 + 'px'; }
    inp.touch = dx / inp.range; knob.style.transform = 'translateX(' + dx.toFixed(1) + 'px)';
    if (Math.abs(inp.touch) > 0.4 && el.hint.classList.contains('on')) el.hint.classList.remove('on');
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { touchEl.addEventListener(n, function (e) { if (e.pointerId === inp.id) releaseTouch(); }); });
  touchEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('blur', function () { releaseTouch(); inp.kl = inp.kr = false; });
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });
  window.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { inp.kl = true; el.hint.classList.remove('on'); e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { inp.kr = true; el.hint.classList.remove('on'); e.preventDefault(); }
    else if (k === 'Escape' || k === 'p' || k === 'P') { if (state === 'paused') resume(); else pause(); }
    else if ((k === 'Enter' || k === ' ') && !e.repeat && document.activeElement && document.activeElement.tagName !== 'BUTTON') {
      if (state === 'menu') { sfx.click(); startRace(); } else if (state === 'results') { sfx.click(); startRace(); } else if (state === 'paused') resume();
    }
  });
  window.addEventListener('keyup', function (e) {
    var k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') inp.kl = false; else if (k === 'ArrowRight' || k === 'd' || k === 'D') inp.kr = false;
  });
  function steerNow(dt) {
    var kt = (inp.kr ? 1 : 0) - (inp.kl ? 1 : 0);
    inp.key += S.clamp(kt - inp.key, -dt * (kt === 0 ? 9 : 6.5), dt * (kt === 0 ? 9 : 6.5));
    var t = inp.touch, at = Math.abs(t);
    t = at < 0.07 ? 0 : (t > 0 ? 1 : -1) * Math.pow((at - 0.07) / 0.93, 1.15);
    return S.clamp(t + inp.key, -1, 1);
  }

  function on(id, fn) { $(id).addEventListener('click', function (e) { audioInit(); sfx.click(); fn(e); }); }
  on('btnPlay', startRace);
  on('btnGarage', openGarage);
  on('btnBack', goMenu);
  on('trkPrev', function () { save.track = (save.track + S.TRACKS.length - 1) % S.TRACKS.length; store(); loadWorld(save.track); goMenu(); });
  on('trkNext', function () { save.track = (save.track + 1) % S.TRACKS.length; store(); loadWorld(save.track); goMenu(); });
  on('carPrev', function () { garageIdx = (garageIdx + S.CARS.length - 1) % S.CARS.length; refreshGarage(); });
  on('carNext', function () { garageIdx = (garageIdx + 1) % S.CARS.length; refreshGarage(); });
  on('btnCar', function () {
    var st = S.CARS[garageIdx];
    if (save.owned.indexOf(st.id) < 0) { if (save.coins < st.price) return; save.coins -= st.price; save.owned.push(st.id); sfx.coin(); }
    save.car = st.id; store(); refreshGarage();
  });
  function toggleSound() { save.sound = !save.sound; store(); if (save.sound) audioInit(); refreshMenu(); }
  on('btnSound', toggleSound); on('btnSound2', toggleSound);
  on('btnGfx', function () { save.lowGfx = !save.lowGfx; store(); applyQuality(); refreshMenu(); });
  on('btnPause', pause); on('btnResume', resume);
  on('btnRestart', startRace); on('btnAgain', startRace);
  on('btnQuit', goMenu); on('btnMenu', goMenu);

  /* ---------- veiktspēja ---------- */
  var pf = { t: 0, n: 0, cool: 2 };
  function perf(dt) {
    if (state !== 'race' || !Q.adapt) return;
    pf.t += dt; pf.n++;
    if (pf.t < 2) return;
    var avg = pf.t / pf.n; pf.t = 0; pf.n = 0;
    if (pf.cool > 0) { pf.cool--; return; }
    if (avg > 1 / 42 && Q.step < 3) {
      Q.step++;
      if (Q.step === 1) Q.dpr = Math.min(Q.dpr, 1.5); else if (Q.step === 2) Q.shadows = false; else Q.dpr = Math.min(Q.dpr, 1.1);
      applyQuality(); pf.cool = 2;
    }
  }

  /* ---------- galvenā cilpa ---------- */
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000)); last = now;
    if (state !== 'paused') time += dt;
    perf(dt);
    if (state === 'countdown') updateCountdown(dt);
    if (race && (state === 'race' || state === 'finish' || state === 'results')) {
      var st = auto ? S.botSteer(race.c, race.tr) : steerNow(dt), steps = 0;
      acc += dt * timeScale;
      while (acc >= H && steps < 12) { S.stepRace(race, st, H); acc -= H; steps++; }
      if (steps === 12) acc = 0;
      var ev = race.c.ev;
      for (var i = 0; i < ev.length; i++) onEvent(ev[i]);
      ev.length = 0;
      if (state === 'finish') { finT += dt; if (finT > 1.7) showResults(); }
    }
    if (race && state !== 'paused') { updateRaceVisuals(dt * (state === 'countdown' ? 0 : timeScale) || 0.0001); if (state !== 'results') updateHud(dt); }
    if (state !== 'paused') {
      smoke.update(dt * timeScale); sparks.update(dt * timeScale);
      if (world) world.update(dt, time, cam.tx, cam.tz);
    }
    updateCamera(dt);
    audioFrame();
    renderer.render(scene, camera);
  }

  function start(data) {
    mergeSave(data && data.save);
    if (save.owned.indexOf(save.car) < 0) save.car = 'street';
    save.track = S.clamp(save.track | 0, 0, S.TRACKS.length - 1);
    if (save.lowGfx) Q.dpr = Math.min(Q.dpr, 1.5);
    applyQuality();
    loadWorld(save.track);
    goMenu();
    last = performance.now();
    requestAnimationFrame(frame);
  }
  if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(function () { return { save: save }; });
  window.__game = {
    state: function () { return state; }, race: function () { return race; }, info: function () { return renderer.info; }, q: Q, save: save,
    auto: function (b) { auto = b; }, start: startRace, menu: goMenu, track: function (i) { save.track = i; loadWorld(i); goMenu(); }, results: showResults
  };
  if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(start);
  else start((window.claude && window.claude.hot && window.claude.hot.data) || {});
})();
