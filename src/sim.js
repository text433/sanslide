/* SĀNSLĪDE — simulācija (bez DOM un bez Three.js): trases, mašīnas fizika, pretinieks, sacīkste */
(function (root) {
  'use strict';
  var SIM = {};
  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function wrap(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  SIM.clamp = clamp; SIM.lerp = lerp; SIM.wrap = wrap; SIM.rng = rng;

  /* ---------- Trases: taisnes (S) un loki (L/R: grādi, rādiuss) ---------- */
  SIM.TRACKS = [
    { id: 'sniegs', name: 'Sniega pāreja', theme: 'snow', seed: 11, tag: 'Plūstoša, divas matadatas',
      plan: [['S', 110], ['L', 60, 55], ['S', 40], ['R', 110, 40], ['S', 50], ['L', 175, 30], ['S', 70], ['R', 175, 30],
        ['S', 45], ['L', 85, 42], ['S', 30], ['R', 60, 60], ['S', 60], ['R', 130, 36], ['S', 55], ['L', 100, 40], ['S', 170]] },
    { id: 'kanjons', name: 'Kanjona šoseja', theme: 'desert', seed: 23, tag: 'Ātra, gari līkumi',
      plan: [['S', 120], ['R', 45, 90], ['L', 90, 60], ['S', 60], ['R', 140, 45], ['S', 40], ['L', 60, 70], ['R', 60, 70],
        ['S', 80], ['L', 160, 34], ['S', 50], ['R', 100, 50], ['L', 70, 55], ['S', 60], ['R', 150, 38], ['S', 180]] },
    { id: 'kirsi', name: 'Ķiršu serpentīns', theme: 'sakura', seed: 37, tag: 'Tehniska, cieši pagriezieni',
      plan: [['S', 100], ['L', 90, 36], ['R', 180, 27], ['S', 35], ['L', 180, 27], ['S', 35], ['R', 175, 27], ['S', 30],
        ['L', 120, 32], ['S', 40], ['R', 70, 45], ['L', 70, 45], ['S', 30], ['R', 160, 29], ['S', 45], ['L', 95, 36], ['S', 170]] }
  ];

  SIM.buildTrack = function (def) {
    var ds = 2, k = [], i, j;
    def.plan.forEach(function (p) {
      var n, kk;
      if (p[0] === 'S') { n = Math.round(p[1] / ds); kk = 0; }
      else {
        var ang = p[1] * Math.PI / 180;
        n = Math.max(1, Math.round(ang * p[2] / ds));
        kk = (p[0] === 'L' ? 1 : -1) * ang / (n * ds);
      }
      for (i = 0; i < n; i++) k.push(kk);
    });
    // divas kastes filtra kārtas = maigas pārejas starp taisni un loku
    for (var pass = 0; pass < 2; pass++) {
      var out = new Array(k.length), W = 4;
      for (i = 0; i < k.length; i++) {
        var sum = 0;
        for (j = -W; j <= W; j++) { var q = i + j; sum += (q < 0 || q >= k.length) ? 0 : k[q]; }
        out[i] = sum / (2 * W + 1);
      }
      k = out;
    }
    var n = k.length + 1;
    var X = new Float32Array(n), Z = new Float32Array(n), TH = new Float32Array(n), K = new Float32Array(n);
    var th = 0, x = 0, z = 0;
    for (i = 0; i < n; i++) {
      X[i] = x; Z[i] = z; TH[i] = th; K[i] = i < k.length ? k[i] : 0;
      if (i < k.length) {
        var tm = th + k[i] * ds * 0.5;
        x += Math.sin(tm) * ds; z += Math.cos(tm) * ds; th += k[i] * ds;
      }
    }
    var tr = { def: def, ds: ds, n: n, len: (n - 1) * ds, x: X, z: Z, th: TH, k: K, half: 7, shoulder: 4.5 };
    tr.startS = 40; tr.finishS = tr.len - 90;
    // paātrinājuma laukumi: automātiski uz taisnēm
    tr.pads = [];
    var run = 0, lats = [0, -2.6, 2.6, 0], a0 = Math.round((tr.startS + 110) / ds), a1 = Math.round((tr.finishS - 50) / ds);
    for (i = a0; i <= a1; i++) {
      if (Math.abs(K[i]) < 0.004) run++;
      else { if (run * ds >= 16 && tr.pads.length < 4) tr.pads.push({ s: (i - run * 0.55) * ds, d: lats[tr.pads.length], cd: 0 }); run = 0; }
    }
    tr.at = function (s) {
      var f = clamp(s / ds, 0, n - 1.001), a = Math.floor(f), t = f - a;
      return { x: lerp(X[a], X[a + 1], t), z: lerp(Z[a], Z[a + 1], t), th: lerp(TH[a], TH[a + 1], t), k: lerp(K[a], K[a + 1], t) };
    };
    tr.kAt = function (s) { var a = clamp(Math.round(s / ds), 0, n - 1); return K[a]; };
    tr.thAt = function (s) { var f = clamp(s / ds, 0, n - 1.001), a = Math.floor(f); return lerp(TH[a], TH[a + 1], f - a); };
    tr.project = function (px, pz, hint) {
      var lo = 0, hi = n - 1, best = 0, bd = Infinity, a;
      if (hint >= 0) { lo = Math.max(0, hint - 25); hi = Math.min(n - 1, hint + 45); }
      for (a = lo; a <= hi; a++) {
        var dx = px - X[a], dz = pz - Z[a], d2 = dx * dx + dz * dz;
        if (d2 < bd) { bd = d2; best = a; }
      }
      var t = TH[best], ex = px - X[best], ez = pz - Z[best];
      return { i: best, s: best * ds + ex * Math.sin(t) + ez * Math.cos(t), d: ex * Math.cos(t) - ez * Math.sin(t) };
    };
    tr.dist = function (px, pz) {
      var bd = Infinity;
      for (var a = 0; a < n; a++) { var dx = px - X[a], dz = pz - Z[a], d2 = dx * dx + dz * dz; if (d2 < bd) bd = d2; }
      return Math.sqrt(bd);
    };
    return tr;
  };

  /* ---------- Mašīnas ---------- */
  SIM.CARS = [
    { id: 'street', name: 'Vējš', cls: 'Ielas klase', price: 0, top: 33.5, accel: 15, steer: 1.55, grip: 6.5, dgrip: 2.5, scrub: 0.40, off: 0.62, wall: 1, chg: 1 },
    { id: 'muscle', name: 'Pērkons', cls: 'Muskuļu klase', price: 450, top: 35.6, accel: 17.5, steer: 1.44, grip: 5.6, dgrip: 2.1, scrub: 0.45, off: 0.6, wall: 1, chg: 1.12 },
    { id: 'offroad', name: 'Lācis', cls: 'Bezceļa klase', price: 950, top: 34.4, accel: 16.2, steer: 1.62, grip: 7.2, dgrip: 2.9, scrub: 0.37, off: 0.88, wall: 0.55, chg: 0.95 },
    { id: 'super', name: 'Zibens', cls: 'Superklase', price: 2200, top: 38.6, accel: 20, steer: 1.72, grip: 7, dgrip: 2.7, scrub: 0.35, off: 0.6, wall: 1, chg: 1.05 }
  ];

  SIM.newCar = function (tr, s, d) {
    var p = tr.at(s);
    return { x: p.x + Math.cos(p.th) * d, z: p.z - Math.sin(p.th) * d, th: p.th, sp: 0, al: 0, yaw: 0, drift: 0,
      charge: 0, boostT: 0, boostLv: 0, idx: Math.round(s / tr.ds), s: s, d: d, off: false, wallT: 0, endT: 0,
      driftPts: 0, driftTime: 0, best: 0, total: 0, ev: [], padCd: 0, fin: -1, slow: 0, steer: 0 };
  };

  SIM.stepCar = function (c, steer, dt, tr, st, throttle) {
    c.steer = steer;
    var speedF = clamp(c.sp / 9, 0, 1);
    var yawT = -steer * st.steer * speedF * (1 + 0.3 * c.drift) / (1 + c.sp / 110);
    c.yaw += (yawT - c.yaw) * Math.min(1, 9 * dt);
    c.th += c.yaw * dt;
    c.al -= c.yaw * dt;
    var want = (Math.abs(steer) > 0.55 && c.sp > 13) || Math.abs(c.al) > 0.22;
    c.drift += ((want ? 1 : 0) - c.drift) * Math.min(1, (want ? 8 : 3.5) * dt);
    var grip = lerp(st.grip, st.dgrip, c.drift);
    if (c.off) grip *= 0.8;
    c.al *= Math.exp(-grip * dt);
    c.al = clamp(c.al, -1.3, 1.3);

    var boost = c.boostT > 0;
    var top = st.top * (boost ? 1.27 : 1);
    if (c.off) top *= st.off;
    var acc = st.accel * (boost ? 2.3 : 1) * throttle;
    if (c.sp < top) c.sp += acc * (1 - c.sp / top) * dt; else c.sp += (top - c.sp) * 1.8 * dt;
    c.sp -= st.scrub * Math.abs(Math.sin(c.al)) * c.sp * dt;
    if (throttle < 1) c.sp -= (9 + c.sp * 0.35) * (1 - throttle) * dt;
    if (c.sp < 0) c.sp = 0;
    if (c.boostT > 0) c.boostT -= dt;
    if (c.padCd > 0) c.padCd -= dt;

    var va = c.th + c.al;
    c.x += Math.sin(va) * c.sp * dt; c.z += Math.cos(va) * c.sp * dt;

    var pr = tr.project(c.x, c.z, c.idx);
    c.idx = pr.i; c.s = pr.s; c.d = pr.d;
    var ad = Math.abs(c.d);
    c.off = ad > tr.half + 0.4;
    var lim = tr.half + tr.shoulder;
    if (ad > lim) {
      var sgn = c.d > 0 ? 1 : -1, tth = tr.th[c.idx];
      var over = ad - lim;
      c.x -= Math.cos(tth) * over * sgn; c.z += Math.sin(tth) * over * sgn; c.d = lim * sgn;
      var into = Math.sin(wrap(va - tth)) * sgn;
      if (into > 0) {
        var hit = into * c.sp;
        if (c.wallT <= 0 && hit > 3) {
          c.sp *= 1 - Math.min(0.42, into * 0.6) * st.wall;
          c.ev.push({ t: 'wall', v: hit, side: sgn });
          c.charge = 0; c.driftPts = 0; c.driftTime = 0;
        }
        c.th += wrap(tth - c.th) * Math.min(1, 6 * dt);
        c.al = wrap(tth - sgn * 0.05 - c.th);
      }
      c.sp -= c.sp * 0.8 * dt * st.wall;
      c.wallT = 0.3;
    }
    if (c.wallT > 0) c.wallT -= dt;

    // paātrinājuma laukumi
    if (c.padCd <= 0) {
      for (var i = 0; i < tr.pads.length; i++) {
        var p = tr.pads[i];
        if (Math.abs(c.s - p.s) < 3.4 && Math.abs(c.d - p.d) < 2.7) {
          c.boostT = Math.max(c.boostT, 1.15); c.boostLv = Math.max(c.boostLv, 1); c.padCd = 0.8;
          c.ev.push({ t: 'pad', i: i });
        }
      }
    }

    // drifts: lādiņš un punkti
    var drifting = Math.abs(c.al) > 0.2 && c.sp > 10 && !c.off && c.wallT <= 0 && throttle > 0;
    c.drifting = drifting;
    if (drifting) {
      c.endT = 0.16; c.driftTime += dt;
      c.charge = Math.min(3, c.charge + (0.5 + Math.abs(c.al) * 0.95) * dt * st.chg);
      c.driftPts += Math.abs(c.al) * c.sp * dt * 11 * (1 + Math.min(2, c.driftTime * 0.35));
    } else if (c.driftTime > 0) {
      c.endT -= dt;
      if (c.endT <= 0) {
        var lv = Math.floor(c.charge + 1e-6);
        if (lv >= 1 && !c.off && throttle > 0) { c.boostT = Math.max(c.boostT, 0.5 + 0.45 * lv); c.boostLv = lv; c.ev.push({ t: 'boost', lv: lv }); }
        var pts = Math.round(c.driftPts);
        if (pts > 120) { c.total += pts; if (pts > c.best) c.best = pts; c.ev.push({ t: 'drift', pts: pts, lv: lv }); }
        c.charge = 0; c.driftPts = 0; c.driftTime = 0;
      }
    }
    if (c.boostT <= 0) c.boostLv = 0;
    c.slow = c.sp < 3 ? c.slow + dt : 0;
  };

  SIM.resetCar = function (c, tr) {
    var s = clamp(c.s, 4, tr.len - 6), p = tr.at(s);
    c.x = p.x; c.z = p.z; c.th = p.th; c.al = 0; c.yaw = 0; c.sp = 8; c.drift = 0; c.charge = 0; c.driftPts = 0; c.driftTime = 0;
    c.idx = Math.round(s / tr.ds); c.d = 0; c.slow = 0; c.wallT = 0;
  };

  /* autopilots: pēc finiša un līdzsvara testiem */
  SIM.botSteer = function (c, tr, aggr) {
    var L = 9 + c.sp * 0.5, p = tr.at(c.s + L);
    var lat = clamp(p.k * 95, -3.2, 3.2);
    var tx = p.x + Math.cos(p.th) * lat, tz = p.z - Math.sin(p.th) * lat;
    var want = Math.atan2(tx - c.x, tz - c.z);
    var err = wrap(want - (c.th + c.al * 0.45));
    return clamp(-err * (aggr || 2.6), -1, 1);
  };

  /* ---------- Pretinieks: brauc pa trases līniju ar ātruma profilu ---------- */
  SIM.aiConfig = function (level) {
    var L = clamp(level, -0.25, 1);
    return { level: L, top: lerp(29.4, 38.4, L), lat: lerp(22, 43, L), accel: lerp(11, 17, L), brake: 24, rubber: 1 };
  };

  SIM.newAI = function (tr, s, d, cfg, seed) {
    var p = tr.at(s), r = rng(seed || 1);
    return { u: s, lat: d, sp: 0, vis: 0, push: 0, x: p.x + Math.cos(p.th) * d, z: p.z - Math.sin(p.th) * d, th: p.th,
      cfg: cfg, ph: r() * TAU, fin: -1, drifting: false, k: 0 };
  };

  SIM.stepAI = function (a, dt, tr, playerS, go) {
    var cfg = a.cfg, kmax = 0, look = 8 + a.sp * 0.95;
    for (var o = 0; o <= look; o += tr.ds) {
      var kk = Math.abs(tr.kAt(a.u + o)) * (1 - 0.35 * (o / look));
      if (kk > kmax) kmax = kk;
    }
    var vT = Math.min(cfg.top, Math.sqrt(cfg.lat / Math.max(kmax, 1e-4)));
    vT *= 1 + clamp((playerS - a.u) / 300, -0.1, 0.07) * cfg.rubber;
    if (!go) vT = 0;
    var dv = vT - a.sp;
    a.sp += clamp(dv, -(go ? cfg.brake : 13) * dt, cfg.accel * Math.max(0.05, 1 - a.sp / (cfg.top * 1.12)) * dt);
    if (a.sp < 0) a.sp = 0;
    a.u = Math.min(tr.len - 4, a.u + a.sp * dt);
    var p = tr.at(a.u);
    var latT = clamp(p.k * 130, -3.4, 3.4) + Math.sin(a.u * 0.035 + a.ph) * 1.1 + a.push;
    a.push *= Math.exp(-2 * dt);
    a.lat += (clamp(latT, -5.6, 5.6) - a.lat) * Math.min(1, 1.5 * dt);
    var visT = clamp(p.k * a.sp * 0.62, -0.8, 0.8);
    a.vis += (visT - a.vis) * Math.min(1, 4 * dt);
    a.x = p.x + Math.cos(p.th) * a.lat; a.z = p.z - Math.sin(p.th) * a.lat; a.th = p.th + a.vis; a.k = p.k;
    a.drifting = Math.abs(a.vis) > 0.22 && a.sp > 10;
  };

  /* ---------- Sacīkste ---------- */
  SIM.newRace = function (tr, st, aiCfg, seed) {
    tr.pads.forEach(function (p) { p.cd = 0; });
    return { tr: tr, st: st, t: 0, c: SIM.newCar(tr, tr.startS - 5, -2.8), a: SIM.newAI(tr, tr.startS - 5, 2.8, aiCfg, seed),
      winner: 0, bumpCd: 0, over: false };
  };

  SIM.stepRace = function (r, steer, dt) {
    var c = r.c, a = r.a, tr = r.tr;
    r.t += dt;
    var done = c.fin >= 0 || r.over;
    SIM.stepCar(c, done ? SIM.botSteer(c, tr) : steer, dt, tr, r.st, done ? 0 : 1);
    SIM.stepAI(a, dt, tr, c.s, a.fin < 0);
    if (r.bumpCd > 0) r.bumpCd -= dt;
    var dx = c.x - a.x, dz = c.z - a.z, d2 = dx * dx + dz * dz, R = 2.5;
    if (d2 < R * R && d2 > 1e-4) {
      var d = Math.sqrt(d2), push = R - d, p = tr.at(a.u);
      c.x += dx / d * push * 0.7; c.z += dz / d * push * 0.7;
      a.push += (-dx * Math.cos(p.th) + dz * Math.sin(p.th)) / d * push * 1.6;
      a.push = clamp(a.push, -3, 3);
      if (r.bumpCd <= 0) { c.sp *= 0.95; a.sp *= 0.97; r.bumpCd = 0.45; c.ev.push({ t: 'bump' }); }
    }
    if (c.fin < 0 && !r.over && c.s >= tr.finishS) { c.fin = r.t; if (!r.winner) r.winner = 1; c.ev.push({ t: 'finish' }); }
    if (a.fin < 0 && a.u >= tr.finishS) { a.fin = r.t; if (!r.winner) r.winner = 2; c.ev.push({ t: 'aifinish' }); }
    if (c.fin < 0 && c.slow > 2.2 && r.t > 2) { SIM.resetCar(c, tr); c.ev.push({ t: 'reset' }); }
  };

  root.SIM = SIM;
  if (typeof module !== 'undefined' && module.exports) module.exports = SIM;
})(typeof globalThis !== 'undefined' ? globalThis : this);
