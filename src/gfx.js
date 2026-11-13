/* SĀNSLĪDE — grafika: low-poly pasaules, mašīnu un efektu būve ar Three.js */
(function (root) {
  'use strict';
  var T = root.THREE, S = root.SIM;
  if (!T || !S) return;
  var GFX = {}, clamp = S.clamp;
  var _col = new T.Color(), _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _v = new T.Vector3(), _s = new T.Vector3(), _p = new T.Vector3();
  var WHITE = [1, 1, 1];

  function rgb(h) { _col.setHex(h); return [_col.r, _col.g, _col.b]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function mul(a, f) { return [a[0] * f, a[1] * f, a[2] * f]; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function M(px, py, pz, rx, ry, rz, sx, sy, sz) {
    _e.set(rx || 0, ry || 0, rz || 0); _q.setFromEuler(_e);
    if (sx === undefined) sx = 1; if (sy === undefined) sy = sx; if (sz === undefined) sz = sx;
    return new T.Matrix4().compose(new T.Vector3(px, py, pz), _q, new T.Vector3(sx, sy, sz));
  }
  GFX.rgb = rgb;

  /* ---------- tīkla būvētājs: plakanas šķautnes, krāsa katram trīsstūrim ---------- */
  function MB() { this.p = []; this.n = []; this.c = []; }
  MB.prototype.tri = function (a, b, c, col) {
    var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (l < 1e-9) { nx = 0; ny = 1; nz = 0; } else { nx /= l; ny /= l; nz /= l; }
    this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    this.c.push(col[0], col[1], col[2], col[0], col[1], col[2], col[0], col[1], col[2]);
  };
  MB.prototype.quad = function (a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, d, col); };
  var BOXF = [[4, 6, 7, 5], [0, 1, 3, 2], [2, 3, 7, 6], [0, 4, 5, 1], [1, 5, 7, 3], [0, 2, 6, 4]];
  MB.prototype.box = function (cx, cy, cz, sx, sy, sz, col, yaw) {
    var cs = Math.cos(yaw || 0), sn = Math.sin(yaw || 0), v = [], i;
    for (i = 0; i < 8; i++) {
      var lx = (i & 4 ? 0.5 : -0.5) * sx, ly = (i & 2 ? 0.5 : -0.5) * sy, lz = (i & 1 ? 0.5 : -0.5) * sz;
      v.push([cx + lx * cs + lz * sn, cy + ly, cz - lx * sn + lz * cs]);
    }
    for (i = 0; i < 6; i++) { var f = BOXF[i]; this.quad(v[f[0]], v[f[1]], v[f[2]], v[f[3]], col); }
    return this;
  };
  MB.prototype.add = function (geo, col, mat) {
    var g = geo.index ? geo.toNonIndexed() : geo, a = g.attributes.position.array, v = [null, null, null], i, j;
    var fn = typeof col === 'function';
    for (i = 0; i < a.length; i += 9) {
      for (j = 0; j < 3; j++) {
        _v.set(a[i + j * 3], a[i + j * 3 + 1], a[i + j * 3 + 2]); if (mat) _v.applyMatrix4(mat);
        v[j] = [_v.x, _v.y, _v.z];
      }
      this.tri(v[0], v[1], v[2], fn ? col((v[0][1] + v[1][1] + v[2][1]) / 3) : col);
    }
    if (g !== geo) g.dispose();
    geo.dispose();
    return this;
  };
  MB.prototype.build = function () {
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(this.p), 3));
    g.setAttribute('normal', new T.BufferAttribute(new Float32Array(this.n), 3));
    g.setAttribute('color', new T.BufferAttribute(new Float32Array(this.c), 3));
    g.computeBoundingSphere();
    return g;
  };
  GFX.MB = MB;

  var matV = new T.MeshLambertMaterial({ vertexColors: true });
  GFX.matV = matV;

  /* ---------- instanču partijas ar telpisku sadalījumu (lai strādātu atsijāšana) ---------- */
  function Batch(geo, cast, recv) { this.geo = geo; this.cast = cast; this.recv = recv; this.it = []; }
  Batch.prototype.add = function (x, y, z, ry, sx, sy, sz, col, rx, rz) { this.it.push([x, y, z, ry || 0, sx, sy, sz, col || WHITE, rx || 0, rz || 0]); };
  Batch.prototype.build = function (group, bin) {
    if (!this.it.length) return;
    var CELL = 210, buckets = {}, self = this, base = this.geo;
    this.it.forEach(function (it) { var k = Math.floor(it[0] / CELL) + ':' + Math.floor(it[2] / CELL); (buckets[k] || (buckets[k] = [])).push(it); });
    if (!base.boundingSphere) base.computeBoundingSphere();
    var gr = base.boundingSphere.radius + base.boundingSphere.center.length();
    Object.keys(buckets).forEach(function (k) {
      var list = buckets[k], g = new T.BufferGeometry(), cx = 0, cy = 0, cz = 0, r = 0, i, it;
      g.setAttribute('position', base.attributes.position);
      g.setAttribute('normal', base.attributes.normal);
      g.setAttribute('color', base.attributes.color);
      for (i = 0; i < list.length; i++) { cx += list[i][0]; cy += list[i][1]; cz += list[i][2]; }
      cx /= list.length; cy /= list.length; cz /= list.length;
      var mesh = new T.InstancedMesh(g, matV, list.length);
      for (i = 0; i < list.length; i++) {
        it = list[i];
        var dx = it[0] - cx, dy = it[1] - cy, dz = it[2] - cz;
        r = Math.max(r, Math.sqrt(dx * dx + dy * dy + dz * dz) + gr * Math.max(it[4], it[5], it[6]));
        _e.set(it[8], it[3], it[9]); _q.setFromEuler(_e);
        _m.compose(_p.set(it[0], it[1], it[2]), _q, _s.set(it[4], it[5], it[6]));
        mesh.setMatrixAt(i, _m);
        mesh.setColorAt(i, _col.setRGB(it[7][0], it[7][1], it[7][2]));
      }
      g.boundingSphere = new T.Sphere(new T.Vector3(cx, cy, cz), r);
      mesh.castShadow = self.cast; mesh.receiveShadow = self.recv;
      mesh.matrixAutoUpdate = false;
      group.add(mesh); bin.push(g);
    });
  };

  /* ---------- tēmas ---------- */
  function pal(a) { return a.map(rgb); }
  var THEMES = {
    snow: { sky: 0x9fd8f6, fog: [95, 300], hemiSky: 0xeef8ff, hemiGround: 0x93a7c9, sun: 0xfff0d8, hemiI: 0.64, sunI: 0.52,
      ground: pal([0xeef3f9, 0xdde7f2]), high: pal([0xffffff, 0xe9f0f8]), steep: pal([0x8d93a5, 0x767c90]), shoulder: pal([0xe6edf5, 0xd8e1ec]),
      verge: rgb(0xcfd6e0), asphalt: rgb(0x474452), steepAt: 0.84, highAt: 9, hillBase: 2.5, hillAmp: 10, farAmp: 16, terrace: 0,
      weather: { n: 300, col: 0xffffff, size: 0.5, fall: 5.5, sway: 1.6, op: 0.95 } },
    desert: { sky: 0xffd591, fog: [110, 340], hemiSky: 0xfff3da, hemiGround: 0xb86a3c, sun: 0xfff2d0, hemiI: 0.62, sunI: 0.56,
      ground: pal([0xecab5c, 0xe29c4e]), high: pal([0xdc7c42, 0xd06c3a]), steep: pal([0xb85530, 0x96412a]), shoulder: pal([0xe3a765, 0xd99858]),
      verge: rgb(0xcf9460), asphalt: rgb(0x4b403f), steepAt: 0.86, highAt: 7, hillBase: 3, hillAmp: 13, farAmp: 24, terrace: 0.7,
      weather: { n: 110, col: 0xffe2b0, size: 0.4, fall: 0.6, sway: 7, op: 0.6 } },
    sakura: { sky: 0xffc9d6, fog: [100, 310], hemiSky: 0xfff4f6, hemiGround: 0x6f9a5a, sun: 0xfff3e0, hemiI: 0.64, sunI: 0.52,
      ground: pal([0x93d260, 0x82c655]), high: pal([0x76b84e, 0x6aab47]), steep: pal([0x93959e, 0x7e808a]), shoulder: pal([0xbcdc74, 0xaed069]),
      verge: rgb(0xc9b684), asphalt: rgb(0x403e4b), steepAt: 0.83, highAt: 8, hillBase: 2.5, hillAmp: 9, farAmp: 15, terrace: 0,
      weather: { n: 220, col: 0xffb7cf, size: 0.7, fall: 2.6, sway: 3.2, op: 0.95 } }
  };
  GFX.THEMES = THEMES;

  /* ---------- rekvizītu ģeometrijas (kopīgas visām trasēm) ---------- */
  var GEO = null;
  function props() {
    if (GEO) return GEO;
    GEO = {};
    var trunk = rgb(0x6f4a33), bark = rgb(0xa35d3a);
    function pine(c1, c2, c3) {
      return new MB()
        .add(new T.CylinderGeometry(0.16, 0.25, 1.3, 5), trunk, M(0, 0.65, 0))
        .add(new T.ConeGeometry(1.6, 2.4, 6), c1, M(0, 2.05, 0))
        .add(new T.ConeGeometry(1.22, 2.0, 6), c2, M(0, 3.25, 0, 0, 0.5, 0))
        .add(new T.ConeGeometry(0.84, 1.75, 6), c3, M(0, 4.4, 0, 0, 1, 0)).build();
    }
    function round(c) {
      return new MB()
        .add(new T.CylinderGeometry(0.17, 0.27, 2.1, 5), trunk, M(0, 1.05, 0))
        .add(new T.IcosahedronGeometry(1.5, 0), c[0], M(0, 3.15, 0, 0.3, 0.2, 0, 1, 0.9, 1))
        .add(new T.IcosahedronGeometry(1.05, 0), c[1], M(0.98, 2.6, 0.3, 0.1, 1, 0.4))
        .add(new T.IcosahedronGeometry(0.9, 0), c[2], M(-0.78, 3.55, -0.35, 0.7, 0.3, 0)).build();
    }
    GEO.pine = pine(rgb(0x2f6f52), rgb(0x378060), rgb(0x41916c));
    GEO.pineSnow = pine(rgb(0x3b7d68), rgb(0xcfe6ec), rgb(0xffffff));
    GEO.pink = round(pal([0xff9fc0, 0xffb7d0, 0xffd0e0]));
    GEO.green = round(pal([0x4fa957, 0x5fb85f, 0x74c86a]));
    GEO.orange = round(pal([0xf08a3c, 0xf6a04a, 0xfbb85c]));
    GEO.bare = new MB()
      .add(new T.CylinderGeometry(0.1, 0.3, 6.4, 5), bark, M(0, 3.2, 0))
      .add(new T.CylinderGeometry(0.05, 0.11, 2.2, 4), bark, M(0.55, 4.6, 0, 0, 0, -0.75))
      .add(new T.CylinderGeometry(0.05, 0.1, 1.9, 4), bark, M(-0.45, 5.3, 0.2, 0.3, 0, 0.7))
      .add(new T.IcosahedronGeometry(0.75, 0), rgb(0xc9703f), M(0, 6.6, 0, 0.4, 0.3, 0, 1, 0.7, 1))
      .add(new T.IcosahedronGeometry(0.5, 0), rgb(0xd9824a), M(1.1, 5.3, 0, 0, 0, 0, 1, 0.7, 1)).build();
    var cg = rgb(0x4f9d50), cg2 = rgb(0x62b05a);
    GEO.cactus = new MB()
      .add(new T.CylinderGeometry(0.4, 0.46, 3.4, 6), cg, M(0, 1.7, 0))
      .add(new T.IcosahedronGeometry(0.42, 0), cg2, M(0, 3.42, 0))
      .add(new T.CylinderGeometry(0.22, 0.22, 0.9, 5), cg, M(0.78, 1.7, 0, 0, 0, Math.PI / 2))
      .add(new T.CylinderGeometry(0.22, 0.24, 1.3, 5), cg2, M(1.1, 2.3, 0))
      .add(new T.CylinderGeometry(0.2, 0.2, 0.8, 5), cg, M(-0.72, 2.2, 0, 0, 0, Math.PI / 2))
      .add(new T.CylinderGeometry(0.2, 0.22, 1.0, 5), cg2, M(-1.0, 2.65, 0)).build();
    GEO.rock = new MB().add(new T.IcosahedronGeometry(1, 0), function (y) { var f = 0.84 + 0.16 * clamp(y + 0.4, 0, 1); return [f, f, f]; }, M(0, 0.25, 0, 0.3, 0.5, 0.2, 1, 0.72, 0.86)).build();
    GEO.blob = new MB().add(new T.IcosahedronGeometry(1, 0), function (y) { var f = 0.88 + 0.12 * clamp(y * 2, 0, 1); return [f, f, f]; }, M(0, 0.15, 0, 0.2, 0.3, 0.1, 1, 0.55, 1)).build();
    GEO.mesa = new MB().add(new T.CylinderGeometry(0.7, 1, 1, 7, 3), function (y) { var b = Math.floor(y * 3.01) % 2 ? 0.86 : 1; return [b, b, b]; }, M(0, 0.5, 0)).build();
    GEO.rail = new MB().box(0, 0, 0, 0.12, 0.32, 2.06, WHITE).build();
    GEO.post = new MB().box(0, 0, 0, 0.15, 0.76, 0.15, WHITE).build();
    function sign(dir) {
      var y = rgb(0xffc928), d = rgb(0x1d1924), mb = new MB();
      mb.box(0, 0.9, 0, 0.13, 1.8, 0.13, rgb(0x8a8f99));
      mb.box(0, 2.15, 0, 1.7, 1.0, 0.1, y);
      for (var i = -1; i <= 1; i++) {
        mb.add(new T.BoxGeometry(0.16, 0.5, 0.05), d, M(i * 0.5 + dir * 0.08, 2.32, -0.07, 0, 0, dir * 0.75));
        mb.add(new T.BoxGeometry(0.16, 0.5, 0.05), d, M(i * 0.5 + dir * 0.08, 1.98, -0.07, 0, 0, -dir * 0.75));
      }
      return mb.build();
    }
    GEO.signL = sign(1); GEO.signR = sign(-1);
    return GEO;
  }

  function makeNoise(seed) {
    var tab = new Float32Array(4096), r = S.rng(seed * 7 + 1), i;
    for (i = 0; i < 4096; i++) tab[i] = r();
    function h(ix, iz) { return tab[((ix * 73856093) ^ (iz * 19349663)) & 4095]; }
    return function (x, z) {
      var ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
      fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
      var a = h(ix, iz), b = h(ix + 1, iz), c = h(ix, iz + 1), d = h(ix + 1, iz + 1);
      return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
    };
  }

  /* ---------- pasaule ---------- */
  GFX.buildWorld = function (def, low) {
    var tr = S.buildTrack(def), th = THEMES[def.theme], rnd = S.rng(def.seed * 101 + 7), G = props();
    var group = new T.Group(), bin = [], mats = [], n = tr.n, half = tr.half, i;
    var lim = half + tr.shoulder, flat = lim + 4.8, noise = makeNoise(def.seed);

    function hgt(x, z, d) {
      if (d <= flat) return -0.04;
      var t = smooth(flat, flat + 30, d), n1 = noise(x * 0.016, z * 0.016), n2 = noise(x * 0.06 + 31, z * 0.06 + 17);
      var h = t * (th.hillBase + n1 * th.hillAmp + n2 * 3.2) + smooth(60, 150, d) * th.farAmp * (0.35 + n1);
      if (th.terrace) { var st = 4.2, q = h / st, f = q - Math.floor(q); h = S.lerp(h, (Math.floor(q) + smooth(0.62, 0.95, f)) * st, th.terrace * t); }
      return h - 0.04;
    }

    /* reljefs */
    (function () {
      var cell = low ? 8 : 6, pad = 125, minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, j, k;
      for (i = 0; i < n; i++) { minX = Math.min(minX, tr.x[i]); maxX = Math.max(maxX, tr.x[i]); minZ = Math.min(minZ, tr.z[i]); maxZ = Math.max(maxZ, tr.z[i]); }
      minX -= pad; maxX += pad; minZ -= pad; maxZ += pad;
      var W = Math.ceil((maxX - minX) / cell) + 1, H = Math.ceil((maxZ - minZ) / cell) + 1;
      var X = new Float32Array(W * H), Y = new Float32Array(W * H), Z = new Float32Array(W * H), D = new Float32Array(W * H);
      for (j = 0; j < H; j++) for (i = 0; i < W; i++) {
        k = j * W + i;
        var x = minX + i * cell + (rnd() - 0.5) * cell * 0.5, z = minZ + j * cell + (rnd() - 0.5) * cell * 0.5, d = tr.dist(x, z);
        X[k] = x; Z[k] = z; D[k] = d; Y[k] = hgt(x, z, d);
      }
      var mb = new MB();
      function P(q) { return [X[q], Y[q], Z[q]]; }
      function face(a, b, c, dAvg) {
        var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        ny = ny / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
        var y = (a[1] + b[1] + c[1]) / 3, r = rnd(), col;
        if (dAvg < flat - 1.5) col = mix(th.shoulder[0], th.shoulder[1], r);
        else if (ny < th.steepAt) col = mix(th.steep[0], th.steep[1], r);
        else if (y > th.highAt) col = mix(th.high[0], th.high[1], r);
        else col = mix(th.ground[0], th.ground[1], r);
        mb.tri(a, b, c, col);
      }
      for (j = 0; j < H - 1; j++) for (i = 0; i < W - 1; i++) {
        var k00 = j * W + i, k10 = k00 + 1, k01 = k00 + W, k11 = k01 + 1;
        if (Math.min(D[k00], D[k10], D[k01], D[k11]) > 190) continue;
        var a = P(k00), b = P(k10), c = P(k01), e = P(k11);
        if ((i + j) & 1) { face(a, c, b, (D[k00] + D[k01] + D[k10]) / 3); face(b, c, e, (D[k10] + D[k01] + D[k11]) / 3); }
        else { face(a, c, e, (D[k00] + D[k01] + D[k11]) / 3); face(a, e, b, (D[k00] + D[k11] + D[k10]) / 3); }
      }
      var g = mb.build(), mesh = new T.Mesh(g, matV);
      mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; group.add(mesh); bin.push(g);
    })();

    /* ceļš, līnijas, apmales, starta un finiša rūtis */
    function pt(q, d, y) { var t = tr.th[q]; return [tr.x[q] + Math.cos(t) * d, y, tr.z[q] - Math.sin(t) * d]; }
    (function () {
      var mb = new MB(), edge = rgb(0xf4f1ea), center = rgb(0xf5c542), red = rgb(0xe8412c), white = rgb(0xf7f4ee), dark = rgb(0x1d1924);
      function strip(q, d0, d1, y, col) { mb.quad(pt(q, d0, y), pt(q + 1, d0, y), pt(q + 1, d1, y), pt(q, d1, y), col); }
      for (i = 0; i < n - 1; i++) {
        strip(i, -half, half, 0.02, mul(th.asphalt, (((i >> 3) & 1) ? 1 : 0.95) * (0.975 + rnd() * 0.05)));
        strip(i, -half - 1.2, -half, 0.01, th.verge); strip(i, half, half + 1.2, 0.01, th.verge);
        strip(i, -half + 0.55, -half + 0.85, 0.05, edge); strip(i, half - 0.85, half - 0.55, 0.05, edge);
        if (i % 6 < 3) strip(i, -0.15, 0.15, 0.05, center);
        if (Math.abs(tr.k[i]) > 0.013) { var c = (i & 1) ? red : white; strip(i, -half - 0.95, -half - 0.02, 0.065, c); strip(i, half + 0.02, half + 0.95, 0.065, c); }
      }
      [tr.startS, tr.finishS].forEach(function (s) {
        var o = tr.at(s), fx = Math.sin(o.th), fz = Math.cos(o.th), lx = Math.cos(o.th), lz = -Math.sin(o.th);
        function q(u, d) { return [o.x + fx * u + lx * d, 0.07, o.z + fz * u + lz * d]; }
        for (var r = 0; r < 2; r++) for (var c = 0; c < 14; c++) {
          var d0 = -half + c, u0 = r * 1.0;
          mb.quad(q(u0, d0), q(u0 + 1, d0), q(u0 + 1, d0 + 1), q(u0, d0 + 1), ((r + c) & 1) ? dark : white);
        }
      });
      var g = mb.build(), mesh = new T.Mesh(g, matV);
      mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; group.add(mesh); bin.push(g);
    })();

    /* barjeras, zīmes, rekvizīti */
    var B = {};
    ['pine', 'pineSnow', 'pink', 'green', 'orange', 'bare', 'cactus', 'rock', 'blob', 'mesa', 'signL', 'signR'].forEach(function (k) { B[k] = new Batch(G[k], true, false); });
    B.rail = new Batch(G.rail, true, false); B.post = new Batch(G.post, false, false);
    (function () {
      var RED = rgb(0xe8412c), WH = rgb(0xf7f4ee), GR = rgb(0xc5cad3), PO = rgb(0x6d7280), side, rl = lim + 0.35;
      for (i = 0; i < n; i++) for (side = -1; side <= 1; side += 2) {
        var k = tr.k[i], t = tr.th[i], x = tr.x[i] + Math.cos(t) * rl * side, z = tr.z[i] - Math.sin(t) * rl * side;
        var curve = Math.abs(k) > 0.011;
        B.rail.add(x, 0.6, z, t, 1, 1, clamp(1 - k * side * rl, 0.45, 1.7), curve ? (((i >> 1) & 1) ? RED : WH) : GR);
        if (!(i & 1)) B.post.add(x, 0.36, z, t, 1, 1, 1, PO);
        if (Math.abs(k) > 0.017 && i % 6 === 0 && k * side < 0) {
          var sx = tr.x[i] + Math.cos(t) * (rl + 1.5) * side, sz = tr.z[i] - Math.sin(t) * (rl + 1.5) * side;
          (k > 0 ? B.signL : B.signR).add(sx, 0, sz, t, 1.15, 1.15, 1.15);
        }
      }
    })();
    (function () {
      var minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, t, tries = low ? 1500 : 2700;
      for (i = 0; i < n; i++) { minX = Math.min(minX, tr.x[i]); maxX = Math.max(maxX, tr.x[i]); minZ = Math.min(minZ, tr.z[i]); maxZ = Math.max(maxZ, tr.z[i]); }
      function tint(a, b) { var f = a + rnd() * (b - a); return [f, f, f]; }
      function col(list) { return mul(rgb(list[Math.floor(rnd() * list.length)]), 0.94 + rnd() * 0.1); }
      var place = {
        snow: function (x, y, z, d) {
          var q = rnd(), s;
          if (q < 0.5) { s = 0.9 + rnd() * 1.0; B.pineSnow.add(x, y, z, rnd() * 6.3, s, s * (0.9 + rnd() * 0.35), s, tint(0.92, 1.05)); }
          else if (q < 0.7) { s = 0.8 + rnd() * 0.7; B.bare.add(x, y, z, rnd() * 6.3, s, s, s, tint(0.9, 1.05)); }
          else if (q < 0.9) { s = 0.9 + rnd() * 2.2; B.rock.add(x, y, z, rnd() * 6.3, s, s * (0.7 + rnd() * 0.6), s, col([0x8d93a5, 0x767c90, 0xa3a9b8])); }
          else { s = 1.4 + rnd() * 1.8; B.blob.add(x, y, z, rnd() * 6.3, s, s, s, tint(0.96, 1.05)); }
        },
        desert: function (x, y, z, d) {
          var q = rnd(), s;
          if (d > 42 && q < 0.16) { s = 7 + rnd() * 9; B.mesa.add(x, y - 1, z, rnd() * 6.3, s, 7 + rnd() * 10, s * (0.7 + rnd() * 0.5), col([0xc9603a, 0xb5522f, 0xd97a45])); }
          else if (q < 0.5) { s = 0.75 + rnd() * 0.75; B.cactus.add(x, y, z, rnd() * 6.3, s, s * (0.9 + rnd() * 0.4), s, tint(0.9, 1.08)); }
          else if (q < 0.8) { s = 0.9 + rnd() * 2.6; B.rock.add(x, y, z, rnd() * 6.3, s, s * (0.7 + rnd() * 0.7), s, col([0xb85530, 0x9f4830, 0xd0703f])); }
          else { s = 0.8 + rnd() * 1.1; B.blob.add(x, y, z, rnd() * 6.3, s, s, s, col([0x8f9a4a, 0xa3a655, 0x7d8a40])); }
        },
        sakura: function (x, y, z, d) {
          var q = rnd(), s;
          if (q < 0.42) { s = 0.9 + rnd() * 0.8; B.pink.add(x, y, z, rnd() * 6.3, s, s, s, tint(0.94, 1.06)); }
          else if (q < 0.66) { s = 0.9 + rnd() * 0.9; B.green.add(x, y, z, rnd() * 6.3, s, s, s, tint(0.9, 1.06)); }
          else if (q < 0.74) { s = 0.9 + rnd() * 0.7; B.orange.add(x, y, z, rnd() * 6.3, s, s, s, tint(0.94, 1.04)); }
          else if (q < 0.84) { s = 0.9 + rnd() * 0.9; B.pine.add(x, y, z, rnd() * 6.3, s, s * 1.1, s, tint(0.92, 1.06)); }
          else if (q < 0.93) { s = 0.8 + rnd() * 1.8; B.rock.add(x, y, z, rnd() * 6.3, s, s * (0.7 + rnd() * 0.5), s, col([0x93959e, 0x7e808a, 0xa9abb3])); }
          else { s = 0.9 + rnd() * 1.1; B.blob.add(x, y, z, rnd() * 6.3, s, s, s, col([0x5fae58, 0x4f9d50, 0x79c26a])); }
        }
      }[def.theme];
      for (t = 0; t < tries; t++) {
        var x = minX - 105 + rnd() * (maxX - minX + 210), z = minZ - 105 + rnd() * (maxZ - minZ + 210), d = tr.dist(x, z);
        if (d < lim + 3.4 || d > 135) continue;
        if (d > 55 && rnd() < 0.55) continue;
        place(x, hgt(x, z, d) - 0.35, z, d);
      }
      // sīkumi ceļa malā aiz barjeras
      var small = { snow: [0xf4f8fc, 0xe2eaf3, 0x8d93a5], desert: [0xb85530, 0xd0703f, 0x8f9a4a], sakura: [0x5fae58, 0x93959e, 0xff9fc0] }[def.theme];
      for (i = 12; i < n - 8; i += 2) {
        if (rnd() > 0.3) continue;
        var sd = rnd() < 0.5 ? -1 : 1, dd = (lim + 1.3 + rnd() * 2.8) * sd, p = pt(i, dd, 0), s2 = 0.3 + rnd() * 0.55;
        (rnd() < 0.5 ? B.rock : B.blob).add(p[0], 0, p[2], rnd() * 6.3, s2, s2, s2, col(small));
      }
    })();
    Object.keys(B).forEach(function (k) { B[k].build(group, bin); });

    /* starta un finiša arkas */
    function gantry(s, label, hex) {
      var mb = new MB(), w = half + 2.4, dark = rgb(0x1d1924), white = rgb(0xf7f4ee), c;
      mb.box(-w, 3.3, 0, 0.6, 6.6, 0.6, dark); mb.box(w, 3.3, 0, 0.6, 6.6, 0.6, dark);
      mb.box(0, 6.9, 0, w * 2 + 0.6, 1.5, 0.7, rgb(hex));
      mb.box(0, 7.72, 0, w * 2 + 0.6, 0.14, 0.9, dark);
      for (c = 0; c < 18; c++) mb.box(-w + (c + 0.5) * (w * 2 / 18), 6.25, -0.36, w * 2 / 18, 0.2, 0.06, (c & 1) ? dark : white);
      var g = mb.build(), mesh = new T.Mesh(g, matV), o = tr.at(s);
      mesh.position.set(o.x, 0, o.z); mesh.rotation.y = o.th; mesh.castShadow = true; group.add(mesh); bin.push(g);
      var cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
      var cx = cv.getContext('2d');
      cx.fillStyle = '#' + ('000000' + hex.toString(16)).slice(-6); cx.fillRect(0, 0, 512, 64);
      cx.fillStyle = '#fff4e6'; cx.font = 'italic 900 50px Kanit, "Arial Black", Impact, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillText(label, 256, 35);
      var tex = new T.CanvasTexture(cv), pm = new T.MeshBasicMaterial({ map: tex }), pg = new T.PlaneGeometry(9, 1.1);
      var plane = new T.Mesh(pg, pm); plane.position.set(0, 6.98, -0.37); plane.rotation.y = Math.PI; mesh.add(plane);
      bin.push(pg); bin.push(tex); mats.push(pm);
    }
    gantry(tr.startS, 'STARTS', 0xff4d1f); gantry(tr.finishS, 'FINIŠS', 0x1d1924);

    /* paātrinājuma laukumi */
    var padMat = new T.MeshBasicMaterial({ color: 0x6fe3ff, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false, fog: false });
    var padGeo = (function () {
      var mb = new MB(), c;
      for (c = 0; c < 3; c++) {
        var z0 = -1.9 + c * 1.25;
        mb.quad([-1.8, 0, z0], [0, 0, z0 + 1.15], [0, 0, z0 + 1.8], [-1.8, 0, z0 + 0.65], WHITE);
        mb.quad([1.8, 0, z0], [1.8, 0, z0 + 0.65], [0, 0, z0 + 1.8], [0, 0, z0 + 1.15], WHITE);
      }
      return mb.build();
    })();
    bin.push(padGeo); mats.push(padMat);
    tr.pads.forEach(function (p) {
      var o = tr.at(p.s), m = new T.Mesh(padGeo, padMat);
      m.position.set(o.x + Math.cos(o.th) * p.d, 0.09, o.z - Math.sin(o.th) * p.d); m.rotation.y = o.th; m.renderOrder = 2; group.add(m);
    });

    /* laikapstākļi: sniegs, ziedlapiņas, putekļi */
    var wx = th.weather, wn = low ? Math.round(wx.n * 0.5) : wx.n, wpos = new Float32Array(wn * 3), wph = new Float32Array(wn);
    for (i = 0; i < wn; i++) { wpos[i * 3] = (rnd() - 0.5) * 90; wpos[i * 3 + 1] = rnd() * 30; wpos[i * 3 + 2] = (rnd() - 0.5) * 110; wph[i] = rnd() * 6.3; }
    var wgeo = new T.BufferGeometry(); wgeo.setAttribute('position', new T.BufferAttribute(wpos, 3));
    var dot = document.createElement('canvas'); dot.width = dot.height = 32;
    var dc = dot.getContext('2d'); dc.fillStyle = '#fff'; dc.beginPath(); dc.arc(16, 16, 13, 0, 6.3); dc.fill();
    var dtex = new T.CanvasTexture(dot);
    var wmat = new T.PointsMaterial({ color: wx.col, size: wx.size, map: dtex, alphaTest: 0.4, transparent: true, opacity: wx.op, depthWrite: false, fog: false });
    var wpts = new T.Points(wgeo, wmat), wLast = [0, 0]; wpts.frustumCulled = false; group.add(wpts);
    bin.push(wgeo); bin.push(dtex); mats.push(wmat);

    return {
      group: group, tr: tr, theme: th, def: def,
      update: function (dt, time, cx, cz) {
        padMat.opacity = 0.62 + 0.36 * Math.sin(time * 7);
        // daļiņas paliek pasaulē: kompensē kameras mērķa nobīdi
        var mx = cx - wLast[0], mz = cz - wLast[1]; wLast[0] = cx; wLast[1] = cz;
        if (Math.abs(mx) > 30 || Math.abs(mz) > 30) { mx = 0; mz = 0; }
        for (var q = 0; q < wn; q++) {
          var o = q * 3;
          wpos[o + 1] -= wx.fall * dt;
          wpos[o] += Math.sin(time * 0.9 + wph[q]) * wx.sway * dt - mx;
          wpos[o + 2] += Math.cos(time * 0.7 + wph[q]) * wx.sway * 0.5 * dt - mz;
          if (wpos[o + 1] < 0) wpos[o + 1] += 30;
          if (wpos[o] < -45) wpos[o] += 90; else if (wpos[o] > 45) wpos[o] -= 90;
          if (wpos[o + 2] < -55) wpos[o + 2] += 110; else if (wpos[o + 2] > 55) wpos[o + 2] -= 110;
        }
        wgeo.attributes.position.needsUpdate = true;
        wpts.position.set(cx, 0, cz);
      },
      dispose: function () { bin.forEach(function (o) { o.dispose(); }); mats.forEach(function (o) { o.dispose(); }); }
    };
  };

  /* ---------- mašīnas ---------- */
  function loft(mb, st, cTop, cSide, cBottom, capRear, capFront) {
    function P(s) { return { A: [s[3], s[1], s[0]], B: [s[4], s[2], s[0]], C: [-s[4], s[2], s[0]], D: [-s[3], s[1], s[0]] }; }
    function pick(c, q) { return Array.isArray(c[0]) ? c[q] : c; }
    for (var i = 0; i < st.length - 1; i++) {
      var a = P(st[i]), b = P(st[i + 1]);
      mb.quad(a.C, b.C, b.B, a.B, pick(cTop, i));
      mb.quad(a.A, a.B, b.B, b.A, pick(cSide, i));
      mb.quad(a.D, b.D, b.C, a.C, pick(cSide, i));
      if (cBottom) mb.quad(a.D, a.A, b.A, b.D, cBottom);
    }
    var f = P(st[0]), l = P(st[st.length - 1]);
    if (capRear) mb.quad(f.D, f.C, f.B, f.A, capRear);
    if (capFront) mb.quad(l.D, l.A, l.B, l.C, capFront);
  }
  // josla uz korpusa augšas starp divām stacijām
  function stripe(mb, st, i, x0, x1, col) {
    var a = st[i], b = st[i + 1], e = 0.014;
    mb.quad([x0, a[2] + e, a[0]], [x0, b[2] + e, b[0]], [x1, b[2] + e, b[0]], [x1, a[2] + e, a[0]], col);
  }

  var MODELS = {
    street: {
      body: [[-2.08, 0.44, 0.80, 0.80, 0.74], [-1.86, 0.30, 0.96, 0.92, 0.86], [-0.55, 0.28, 1.00, 0.95, 0.88], [0.75, 0.28, 0.93, 0.95, 0.88], [1.72, 0.30, 0.80, 0.92, 0.84], [2.10, 0.42, 0.62, 0.80, 0.72]],
      cabin: [[-1.62, 0.96, 0.98, 0.82, 0.76], [-1.00, 0.97, 1.42, 0.84, 0.64], [0.12, 0.95, 1.40, 0.84, 0.64], [0.86, 0.92, 0.94, 0.84, 0.76]],
      wheel: { r: 0.37, w: 0.30, f: 1.30, b: -1.28, t: 0.86 }, paint: 0xff5126, accent: 0xfff4e6
    },
    muscle: {
      body: [[-2.25, 0.46, 0.84, 0.84, 0.78], [-2.0, 0.32, 1.00, 0.96, 0.90], [-0.9, 0.30, 1.02, 0.98, 0.90], [0.5, 0.30, 0.98, 0.98, 0.90], [2.0, 0.32, 0.90, 0.96, 0.88], [2.3, 0.44, 0.72, 0.86, 0.80]],
      cabin: [[-1.78, 0.99, 1.01, 0.84, 0.78], [-1.08, 1.0, 1.40, 0.86, 0.66], [-0.16, 0.99, 1.40, 0.86, 0.66], [0.5, 0.97, 0.99, 0.86, 0.78]],
      wheel: { r: 0.40, w: 0.36, f: 1.45, b: -1.40, t: 0.90 }, paint: 0xffc21f, accent: 0x1d1924
    },
    offroad: {
      body: [[-2.1, 0.64, 1.06, 0.90, 0.86], [-1.95, 0.54, 1.24, 0.98, 0.94], [-0.4, 0.52, 1.26, 1.0, 0.95], [0.9, 0.52, 1.22, 1.0, 0.95], [1.85, 0.54, 1.14, 0.98, 0.92], [2.12, 0.62, 0.94, 0.90, 0.84]],
      cabin: [[-1.92, 1.24, 1.26, 0.90, 0.86], [-1.76, 1.24, 1.80, 0.92, 0.78], [0.15, 1.24, 1.78, 0.92, 0.78], [0.82, 1.22, 1.24, 0.92, 0.86]],
      wheel: { r: 0.50, w: 0.38, f: 1.35, b: -1.32, t: 0.96 }, paint: 0x18a999, accent: 0xfff4e6
    },
    super: {
      body: [[-2.15, 0.36, 0.78, 0.86, 0.80], [-1.9, 0.24, 0.86, 1.0, 0.94], [-0.6, 0.22, 0.84, 1.02, 0.94], [0.6, 0.22, 0.72, 1.0, 0.92], [1.75, 0.24, 0.56, 0.94, 0.84], [2.2, 0.30, 0.42, 0.80, 0.70]],
      cabin: [[-1.3, 0.84, 0.86, 0.78, 0.70], [-0.75, 0.84, 1.14, 0.80, 0.56], [0.05, 0.80, 1.12, 0.80, 0.56], [0.95, 0.70, 0.72, 0.80, 0.70]],
      wheel: { r: 0.38, w: 0.34, f: 1.36, b: -1.30, t: 0.92 }, paint: 0x2f5bff, accent: 0x6fe3ff
    }
  };
  GFX.MODELS = MODELS;
  GFX.RIVAL_PAINTS = [[0xf2f0ea, 0xff2f6d], [0x8a4dff, 0xffd43a], [0x2bd46b, 0x1d1924], [0x2a2632, 0xff4d1f], [0xff7ab8, 0xffffff], [0x7ad3ff, 0x0b2540]];

  var blobTex = null, flameMat = null;
  function shared() {
    if (blobTex) return;
    var c = document.createElement('canvas'); c.width = 64; c.height = 128;
    var x = c.getContext('2d'), g = x.createRadialGradient(32, 64, 4, 32, 64, 60);
    g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(0.55, 'rgba(0,0,0,.42)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.scale(1, 1); x.beginPath(); x.ellipse(32, 64, 30, 60, 0, 0, 6.3); x.fill();
    blobTex = new T.CanvasTexture(c);
    flameMat = new T.MeshBasicMaterial({ color: 0x8fecff, transparent: true, opacity: 0.92, depthWrite: false, fog: false });
  }

  GFX.buildCar = function (id, paintHex, accentHex) {
    shared();
    var d = MODELS[id], mb = new MB(), w = d.wheel, bin = [];
    var paint = rgb(paintHex === undefined ? d.paint : paintHex), accent = rgb(accentHex === undefined ? d.accent : accentHex);
    var paintD = mul(paint, 0.78), dark = rgb(0x1d1924), glass = rgb(0x2a3346), glassL = rgb(0x3f4c66), light = rgb(0xfff3b0), red = rgb(0xff3b30), metal = rgb(0xb9bec8);
    var bd = d.body, cb = d.cabin, L = bd.length - 1, rearZ = bd[0][0], frontZ = bd[L][0];
    loft(mb, bd, paint, paint, dark, paintD, paintD);
    loft(mb, cb, [glassL, paint, glassL], [glass, glass, glass], null, null, null);
    // sliekšņi, spārnu paplašinājumi, spoguļi, lukturi
    var bw = bd[2][3], by = bd[2][1];
    mb.box(bw + 0.01, by + 0.07, 0, 0.07, 0.16, Math.abs(rearZ) + frontZ - 1.6, dark); mb.box(-bw - 0.01, by + 0.07, 0, 0.07, 0.16, Math.abs(rearZ) + frontZ - 1.6, dark);
    [w.f, w.b].forEach(function (z) {
      var fy = w.r * 2 + 0.03, fc = id === 'offroad' ? dark : paintD;
      mb.box(bw + 0.02, fy, z, 0.12, 0.09, w.r * 2 + 0.34, fc); mb.box(-bw - 0.02, fy, z, 0.12, 0.09, w.r * 2 + 0.34, fc);
    });
    var cy = cb[1][1] + 0.08, cz = cb[2][0] + 0.3;
    mb.box(cb[1][3] + 0.1, cy, cz, 0.18, 0.1, 0.13, paint); mb.box(-cb[1][3] - 0.1, cy, cz, 0.18, 0.1, 0.13, paint);
    var hy = (bd[L][1] + bd[L][2]) / 2 + 0.03, hw = bd[L][3];
    mb.box(hw * 0.66, hy, frontZ + 0.02, hw * 0.42, 0.13, 0.08, light); mb.box(-hw * 0.66, hy, frontZ + 0.02, hw * 0.42, 0.13, 0.08, light);
    mb.box(0, bd[L][1] + 0.03, frontZ + 0.03, hw * 1.3, 0.12, 0.1, dark);
    var ty = (bd[0][1] + bd[0][2]) / 2 + 0.06, tw = bd[0][3];
    mb.box(0, bd[0][1] + 0.04, rearZ - 0.02, tw * 1.5, 0.12, 0.1, dark);

    if (id === 'street') {
      mb.box(tw * 0.62, ty, rearZ - 0.02, tw * 0.46, 0.12, 0.07, red); mb.box(-tw * 0.62, ty, rearZ - 0.02, tw * 0.46, 0.12, 0.07, red);
      mb.box(0.5, 1.07, -1.82, 0.06, 0.2, 0.12, dark); mb.box(-0.5, 1.07, -1.82, 0.06, 0.2, 0.12, dark);
      mb.box(0, 1.2, -1.88, 1.56, 0.05, 0.36, accent);
      stripe(mb, bd, 3, -0.2, 0.2, accent); stripe(mb, bd, 4, -0.2, 0.2, accent); stripe(mb, cb, 1, -0.2, 0.2, accent); stripe(mb, bd, 1, -0.2, 0.2, accent);
      mb.box(bw + 0.012, 0.62, 0.05, 0.02, 0.1, 2.3, accent); mb.box(-bw - 0.012, 0.62, 0.05, 0.02, 0.1, 2.3, accent);
    } else if (id === 'muscle') {
      mb.box(tw * 0.6, ty, rearZ - 0.02, tw * 0.5, 0.1, 0.07, red); mb.box(-tw * 0.6, ty, rearZ - 0.02, tw * 0.5, 0.1, 0.07, red);
      mb.box(0, 1.07, 1.15, 0.56, 0.16, 0.8, accent); mb.box(0, 1.08, 1.56, 0.44, 0.1, 0.04, metal);
      mb.box(0, 1.07, -2.08, 1.74, 0.1, 0.3, paint);
      [[-0.42, -0.1], [0.1, 0.42]].forEach(function (s) { [0, 1, 3, 4].forEach(function (q) { stripe(mb, bd, q, s[0], s[1], accent); }); stripe(mb, cb, 1, s[0], s[1], accent); });
      mb.box(bw + 0.03, 0.34, -0.75, 0.1, 0.1, 0.9, metal); mb.box(-bw - 0.03, 0.34, -0.75, 0.1, 0.1, 0.9, metal);
    } else if (id === 'offroad') {
      mb.box(tw * 0.72, ty + 0.1, rearZ - 0.02, 0.16, 0.34, 0.07, red); mb.box(-tw * 0.72, ty + 0.1, rearZ - 0.02, 0.16, 0.34, 0.07, red);
      mb.box(0, 1.87, -0.8, 1.34, 0.05, 1.7, dark);
      [[-0.62, -1.55], [0.62, -1.55], [-0.62, -0.05], [0.62, -0.05]].forEach(function (p) { mb.box(p[0], 1.82, p[1], 0.06, 0.1, 0.06, dark); });
      mb.box(0, 1.9, 0.1, 1.2, 0.13, 0.12, dark);
      for (var q = -2; q <= 2; q++) mb.box(q * 0.24, 1.9, 0.17, 0.16, 0.1, 0.04, light);
      mb.box(0, 0.82, frontZ + 0.14, 1.5, 0.09, 0.09, metal); mb.box(0.5, 0.72, frontZ + 0.12, 0.08, 0.42, 0.08, metal); mb.box(-0.5, 0.72, frontZ + 0.12, 0.08, 0.42, 0.08, metal);
      mb.add(new T.CylinderGeometry(0.42, 0.42, 0.26, 9), dark, M(0, 1.02, rearZ - 0.16, Math.PI / 2, 0, 0));
      mb.add(new T.CylinderGeometry(0.2, 0.2, 0.28, 6), metal, M(0, 1.02, rearZ - 0.17, Math.PI / 2, 0, 0));
      stripe(mb, cb, 1, -0.74, 0.74, accent);
      mb.box(bw + 0.012, 0.9, -0.2, 0.02, 0.12, 2.6, accent); mb.box(-bw - 0.012, 0.9, -0.2, 0.02, 0.12, 2.6, accent);
    } else {
      mb.box(0, ty, rearZ - 0.02, tw * 1.7, 0.07, 0.07, red);
      mb.box(0.62, 1.0, -1.92, 0.07, 0.3, 0.14, dark); mb.box(-0.62, 1.0, -1.92, 0.07, 0.3, 0.14, dark);
      mb.box(0, 1.17, -1.98, 2.04, 0.05, 0.44, accent);
      mb.box(1.02, 1.12, -1.98, 0.05, 0.24, 0.5, dark); mb.box(-1.02, 1.12, -1.98, 0.05, 0.24, 0.5, dark);
      mb.box(bw + 0.02, 0.52, -0.9, 0.08, 0.26, 0.62, dark); mb.box(-bw - 0.02, 0.52, -0.9, 0.08, 0.26, 0.62, dark);
      for (var e = 0; e < 3; e++) mb.box(0, 0.875, -1.62 + e * 0.22, 1.1, 0.03, 0.1, dark);
      stripe(mb, bd, 3, -0.12, 0.12, accent); stripe(mb, bd, 4, -0.12, 0.12, accent);
      mb.box(0, bd[L][1] + 0.0, frontZ + 0.1, hw * 2.1, 0.05, 0.3, dark);
    }
    var geo = mb.build(); bin.push(geo);
    var rootG = new T.Group(), tilt = new T.Group(); rootG.add(tilt);
    var body = new T.Mesh(geo, matV); body.castShadow = true; tilt.add(body);

    var wgeo = new MB()
      .add(new T.CylinderGeometry(w.r, w.r, w.w, 10), rgb(0x1a181e), M(0, 0, 0, 0, 0, Math.PI / 2))
      .add(new T.CylinderGeometry(w.r * 0.58, w.r * 0.58, w.w + 0.03, 6), id === 'muscle' ? rgb(0x2a2632) : metal, M(0, 0, 0, 0, 0, Math.PI / 2))
      .box(0, 0, 0, w.w + 0.05, w.r * 0.9, 0.08, rgb(0x6d7280)).build();
    bin.push(wgeo);
    var wheels = [[w.t, w.f], [-w.t, w.f], [w.t, w.b], [-w.t, w.b]].map(function (p) {
      var m = new T.Mesh(wgeo, matV); m.position.set(p[0], w.r, p[1]); m.rotation.order = 'YXZ'; m.castShadow = true; rootG.add(m); return m;
    });
    var fgeo = new T.ConeGeometry(0.17, 1, 6); fgeo.translate(0, 0.5, 0); fgeo.rotateX(-Math.PI / 2); bin.push(fgeo);
    var flames = [0.42, -0.42].map(function (x) { var m = new T.Mesh(fgeo, flameMat); m.position.set(x, bd[0][1] + 0.12, rearZ - 0.05); m.visible = false; tilt.add(m); return m; });
    var bg = new T.PlaneGeometry(2.7, 5.4); bg.rotateX(-Math.PI / 2); bin.push(bg);
    var bm = new T.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    var blob = new T.Mesh(bg, bm); blob.position.y = 0.08; blob.renderOrder = 1; rootG.add(blob);
    return { root: rootG, tilt: tilt, wheels: wheels, flames: flames, blob: blob, w: w, id: id,
      dispose: function () { bin.forEach(function (g) { g.dispose(); }); bm.dispose(); } };
  };

  /* ---------- daļiņas (dūmi, dzirksteles) ---------- */
  function Parts(geo, mat, max) {
    this.max = max; this.n = 0;
    this.mesh = new T.InstancedMesh(geo, mat, max);
    this.mesh.instanceColor = new T.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.d = new Float32Array(max * 16); // x y z vx vy vz age life s0 s1 rot rv r g b grav
  }
  Parts.prototype.spawn = function (x, y, z, vx, vy, vz, life, s0, s1, col, grav) {
    var i = this.n < this.max ? this.n++ : Math.floor(Math.random() * this.max), o = i * 16, d = this.d;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = vx; d[o + 4] = vy; d[o + 5] = vz; d[o + 6] = 0; d[o + 7] = life;
    d[o + 8] = s0; d[o + 9] = s1; d[o + 10] = Math.random() * 6.3; d[o + 11] = (Math.random() - 0.5) * 4;
    d[o + 12] = col[0]; d[o + 13] = col[1]; d[o + 14] = col[2]; d[o + 15] = grav || 0;
  };
  Parts.prototype.clear = function () { this.n = 0; this.mesh.count = 0; };
  Parts.prototype.update = function (dt) {
    var d = this.d, m = this.mesh.instanceMatrix.array, c = this.mesh.instanceColor.array, i = 0, o, j;
    while (i < this.n) {
      o = i * 16; d[o + 6] += dt;
      if (d[o + 6] >= d[o + 7]) { this.n--; if (i !== this.n) for (j = 0; j < 16; j++) d[o + j] = d[this.n * 16 + j]; continue; }
      d[o + 4] -= d[o + 15] * dt;
      d[o] += d[o + 3] * dt; d[o + 1] += d[o + 4] * dt; d[o + 2] += d[o + 5] * dt;
      if (d[o + 15] && d[o + 1] < 0.1) { d[o + 1] = 0.1; d[o + 4] *= -0.4; }
      d[o + 3] *= 1 - 1.6 * dt; d[o + 5] *= 1 - 1.6 * dt; d[o + 10] += d[o + 11] * dt;
      var t = d[o + 6] / d[o + 7], e = 1 - (1 - t) * (1 - t), s = (d[o + 8] + (d[o + 9] - d[o + 8]) * e) * (t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1);
      var cs = Math.cos(d[o + 10]) * s, sn = Math.sin(d[o + 10]) * s, q = i * 16;
      m[q] = cs; m[q + 1] = 0; m[q + 2] = -sn; m[q + 3] = 0; m[q + 4] = 0; m[q + 5] = s; m[q + 6] = 0; m[q + 7] = 0;
      m[q + 8] = sn; m[q + 9] = 0; m[q + 10] = cs; m[q + 11] = 0; m[q + 12] = d[o]; m[q + 13] = d[o + 1]; m[q + 14] = d[o + 2]; m[q + 15] = 1;
      c[i * 3] = d[o + 12]; c[i * 3 + 1] = d[o + 13]; c[i * 3 + 2] = d[o + 14];
      i++;
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
  };
  GFX.makeSmoke = function (max) {
    var g = new MB().add(new T.IcosahedronGeometry(0.5, 0), WHITE, M(0, 0, 0, 0.4, 0, 0.3)).build();
    return new Parts(g, new T.MeshLambertMaterial({ vertexColors: true }), max);
  };
  GFX.makeSparks = function (max) {
    var g = new MB().box(0, 0, 0, 0.5, 0.5, 0.5, WHITE).build();
    return new Parts(g, new T.MeshBasicMaterial({ vertexColors: true, fog: false }), max);
  };

  /* ---------- riepu pēdas ---------- */
  function Marks(max) {
    var g = new T.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
    this.max = max; this.i = 0;
    this.mesh = new T.InstancedMesh(g, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), max);
    this.mesh.instanceColor = new T.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 1;
    this.clear();
  }
  Marks.prototype.clear = function () { var m = this.mesh.instanceMatrix.array; for (var i = 0; i < m.length; i++) m[i] = 0; this.mesh.instanceMatrix.needsUpdate = true; this.i = 0; };
  Marks.prototype.add = function (x0, z0, x1, z1, w, col) {
    var dx = x1 - x0, dz = z1 - z0, len = Math.sqrt(dx * dx + dz * dz); if (len < 0.01) return;
    var q = this.i * 16, m = this.mesh.instanceMatrix.array, c = this.mesh.instanceColor.array, sx = dx / len, sz = dz / len, L = len + 0.25;
    m[q] = sz * w; m[q + 1] = 0; m[q + 2] = -sx * w; m[q + 3] = 0; m[q + 4] = 0; m[q + 5] = 1; m[q + 6] = 0; m[q + 7] = 0;
    m[q + 8] = sx * L; m[q + 9] = 0; m[q + 10] = sz * L; m[q + 11] = 0; m[q + 12] = (x0 + x1) / 2; m[q + 13] = 0.075; m[q + 14] = (z0 + z1) / 2; m[q + 15] = 1;
    c[this.i * 3] = col[0]; c[this.i * 3 + 1] = col[1]; c[this.i * 3 + 2] = col[2];
    this.i = (this.i + 1) % this.max;
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
  };
  GFX.Marks = Marks;

  root.GFX = GFX;
})(typeof globalThis !== 'undefined' ? globalThis : this);
