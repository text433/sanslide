// Trases ģeometrijas pārbaude + bota braucieni līdzsvaram. Lietošana: node test/sim.test.js [--plot]
const SIM = require('../src/sim.js');
const fs = require('fs');
const path = require('path');
const H = 1 / 120;
let fail = 0;

function checkTrack(def) {
  const tr = SIM.buildTrack(def);
  let minGap = Infinity, kmax = 0;
  for (let i = 0; i < tr.n; i += 2) {
    if (Math.abs(tr.k[i]) > kmax) kmax = Math.abs(tr.k[i]);
    for (let j = i + 90; j < tr.n; j += 2) { // > 180 m pa trasi
      const d = Math.hypot(tr.x[i] - tr.x[j], tr.z[i] - tr.z[j]);
      if (d < minGap) minGap = d;
    }
  }
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < tr.n; i++) { minX = Math.min(minX, tr.x[i]); maxX = Math.max(maxX, tr.x[i]); minZ = Math.min(minZ, tr.z[i]); maxZ = Math.max(maxZ, tr.z[i]); }
  console.log(`${def.id}: len ${tr.len} m, race ${(tr.finishS - tr.startS)} m, minR ${(1 / kmax).toFixed(1)} m, minGap ${minGap.toFixed(1)} m, bbox ${(maxX - minX).toFixed(0)}x${(maxZ - minZ).toFixed(0)}`);
  if (minGap < 44) { console.log('  !! trases posmi par tuvu'); fail++; }
  console.log("  pads:", tr.pads.map(p => p.s.toFixed(0) + "@" + p.d).join(" "));
  return tr;
}

function botRun(tr, st, aggr, steerNoise) {
  const c = SIM.newCar(tr, tr.startS - 5, -2.8);
  let t = 0, walls = 0, boosts = 0, offT = 0, maxSp = 0;
  const r = SIM.rng(5);
  while (c.s < tr.finishS && t < 200) {
    let s = SIM.botSteer(c, tr, aggr);
    if (steerNoise) s = SIM.clamp(s + (r() - 0.5) * steerNoise, -1, 1);
    SIM.stepCar(c, s, H, tr, st, 1);
    if (c.slow > 2.2) SIM.resetCar(c, tr);
    for (const e of c.ev) { if (e.t === 'wall') walls++; if (e.t === 'boost') boosts++; }
    c.ev.length = 0;
    if (c.off) offT += H;
    if (c.sp > maxSp) maxSp = c.sp;
    t += H;
  }
  return { t, walls, boosts, offT, maxSp, drift: c.total, best: c.best };
}

function aiRun(tr, level) {
  const a = SIM.newAI(tr, tr.startS - 5, 2.8, SIM.aiConfig(level), 3);
  let t = 0;
  while (a.u < tr.finishS && t < 200) { SIM.stepAI(a, H, tr, a.u, true); t += H; }
  return t;
}

const tracks = SIM.TRACKS.map(checkTrack);
for (const tr of tracks) {
  console.log('--', tr.def.id);
  for (const st of SIM.CARS) {
    const b = botRun(tr, st, 2.6, 0), n = botRun(tr, st, 2.2, 0.5);
    console.log(`  ${st.id.padEnd(8)} bot ${b.t.toFixed(1)}s walls ${b.walls} boosts ${b.boosts} off ${b.offT.toFixed(1)}s max ${b.maxSp.toFixed(1)} drift ${b.drift} | nervozs ${n.t.toFixed(1)}s walls ${n.walls}`);
    if (b.t > 150) { console.log('  !! bots netiek līdz finišam'); fail++; }
  }
  console.log('  AI:', [0, 0.25, 0.5, 0.75, 1].map(l => `L${l}=${aiRun(tr, l).toFixed(1)}s`).join(' '));
}

if (process.argv.includes('--plot')) {
  let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="560" viewBox="0 0 1500 560"><rect width="1500" height="560" fill="#fff"/>';
  tracks.forEach((tr, ti) => {
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (let i = 0; i < tr.n; i++) { minX = Math.min(minX, tr.x[i]); maxX = Math.max(maxX, tr.x[i]); minZ = Math.min(minZ, tr.z[i]); maxZ = Math.max(maxZ, tr.z[i]); }
    const sc = Math.min(460 / (maxX - minX), 500 / (maxZ - minZ));
    const ox = 20 + ti * 500, oy = 30;
    let d = '';
    for (let i = 0; i < tr.n; i++) d += (i ? 'L' : 'M') + (ox + (maxX - tr.x[i]) * sc).toFixed(1) + ' ' + (oy + (maxZ - tr.z[i]) * sc).toFixed(1);
    svg += `<path d="${d}" fill="none" stroke="#333" stroke-width="${(14 * sc).toFixed(1)}" stroke-linejoin="round"/>`;
    svg += `<path d="${d}" fill="none" stroke="#fc0" stroke-width="1"/>`;
    const s = tr.at(tr.startS), f = tr.at(tr.finishS);
    svg += `<circle cx="${ox + (maxX - s.x) * sc}" cy="${oy + (maxZ - s.z) * sc}" r="6" fill="#0a0"/><circle cx="${ox + (maxX - f.x) * sc}" cy="${oy + (maxZ - f.z) * sc}" r="6" fill="#d00"/>`;
    tr.pads.forEach(p => { const q = tr.at(p.s); svg += `<circle cx="${ox + (maxX - q.x) * sc}" cy="${oy + (maxZ - q.z) * sc}" r="4" fill="#0cf"/>`; });
    svg += `<text x="${ox}" y="20" font-size="16">${tr.def.id}</text>`;
  });
  svg += '</svg>';
  fs.writeFileSync(path.join(__dirname, 'tracks.svg'), svg);
  console.log('plot → test/tracks.svg');
}
process.exit(fail ? 1 : 0);
