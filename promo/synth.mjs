// Synthesizes a 15s, 120 BPM track synced to the visual timeline -> music.wav
import { writeFileSync } from 'node:fs';

const SR = 48000, DUR = 15.0, N = Math.round(SR * DUR);
const bus = () => [new Float32Array(N), new Float32Array(N)];
const drums = bus(), bass = bus(), music = bus(), fx = bus(), verbSend = bus(), delaySend = bus();

let seed = 1234567;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const noise = () => rnd() * 2 - 1;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

function add(b, i, l, r) { if (i >= 0 && i < N) { b[0][i] += l; b[1][i] += r; } }
function panLR(p) { const a = (p + 1) * Math.PI / 4; return [Math.cos(a), Math.sin(a)]; }

// biquad
function biquad(type, f, q) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, b0, b1, b2, a1, a2;
  const set = (f, q) => {
    f = clamp(f, 20, SR * 0.45);
    const w = 2 * Math.PI * f / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
    let B0, B1, B2; const A0 = 1 + al;
    if (type === 'lp') { B0 = (1 - cs) / 2; B1 = 1 - cs; B2 = B0; }
    else if (type === 'hp') { B0 = (1 + cs) / 2; B1 = -(1 + cs); B2 = B0; }
    else { B0 = al; B1 = 0; B2 = -al; }
    b0 = B0 / A0; b1 = B1 / A0; b2 = B2 / A0; a1 = -2 * cs / A0; a2 = (1 - al) / A0;
  };
  set(f, q);
  const fn = (x) => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  fn.set = set;
  return fn;
}

// ---------------------------------------------------------------- instruments
function kick(t, vel = 1, soft = false) {
  const s0 = Math.round(t * SR), len = Math.round(0.5 * SR);
  let ph = 0;
  const lp = biquad('lp', soft ? 900 : 8000, 0.7);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const f = 44 + (soft ? 90 : 150) * Math.exp(-tt * 30);
    ph += 2 * Math.PI * f / SR;
    let v = Math.sin(ph) * Math.exp(-tt * (soft ? 9 : 6.5));
    if (!soft && i < 240) v += noise() * 0.5 * (1 - i / 240);
    v = Math.tanh(v * 1.6) * 0.95 * vel;
    v = lp(v);
    add(drums, s0 + i, v, v);
  }
}
function clap(t, vel = 1) {
  const s0 = Math.round(t * SR), len = Math.round(0.35 * SR);
  const bp = biquad('bp', 1300, 1.1), hp = biquad('hp', 600, 0.7);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    let env = 0;
    for (const o of [0, 0.011, 0.022]) if (tt >= o) env = Math.max(env, Math.exp(-(tt - o) * 180));
    env = Math.max(env, tt > 0.022 ? 0.55 * Math.exp(-(tt - 0.022) * 16) : 0);
    const v = hp(bp(noise())) * env * 1.4 * vel;
    add(drums, s0 + i, v * 0.9, v);
    add(verbSend, s0 + i, v * 0.35, v * 0.35);
  }
}
function snare(t, vel = 1) {
  const s0 = Math.round(t * SR), len = Math.round(0.2 * SR);
  const bp = biquad('bp', 2200, 0.8);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    ph += 2 * Math.PI * 190 / SR;
    const v = (bp(noise()) * 1.1 * Math.exp(-tt * 28) + Math.sin(ph) * 0.4 * Math.exp(-tt * 40)) * vel;
    add(drums, s0 + i, v, v);
    add(verbSend, s0 + i, v * 0.2, v * 0.2);
  }
}
function hat(t, vel = 1, open = false, pan = 0) {
  const s0 = Math.round(t * SR), len = Math.round((open ? 0.3 : 0.07) * SR);
  const hp = biquad('hp', 7500, 0.8), hp2 = biquad('hp', 9000, 0.7);
  const [l, r] = panLR(pan);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const v = hp2(hp(noise())) * Math.exp(-tt * (open ? 11 : 70)) * 0.5 * vel;
    add(drums, s0 + i, v * l, v * r);
  }
}
function crash(t, vel = 1, dur = 2.2) {
  const s0 = Math.round(t * SR), len = Math.round(dur * SR);
  const hp = biquad('hp', 3500, 0.6), bp = biquad('bp', 6500, 0.5);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const e = Math.exp(-tt * 2.2) * (1 - Math.exp(-tt * 400));
    const a = hp(noise()), b = bp(noise());
    add(fx, s0 + i, (a * 0.35 + b * 0.25) * e * vel, (a * 0.3 + b * 0.3) * e * vel);
    add(verbSend, s0 + i, a * 0.12 * e * vel, a * 0.12 * e * vel);
  }
}
function revCymbal(tEnd, dur = 1.0, vel = 1) {
  const s0 = Math.round((tEnd - dur) * SR), len = Math.round(dur * SR);
  const hp = biquad('hp', 3000, 0.6);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const e = Math.pow(tt / dur, 3.2);
    const v = hp(noise()) * e * 0.45 * vel;
    add(fx, s0 + i, v, v * 0.9);
  }
}
function boom(t, vel = 1, dur = 1.8) {
  const s0 = Math.round(t * SR), len = Math.round(dur * SR);
  let ph = 0;
  const lp = biquad('lp', 400, 0.7);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const f = 30 + 55 * Math.exp(-tt * 6);
    ph += 2 * Math.PI * f / SR;
    let v = Math.sin(ph) * Math.exp(-tt * 2.4) * 1.1;
    v += lp(noise()) * Math.exp(-tt * 9) * 0.9;
    v = Math.tanh(v * 1.4) * vel * 0.85;
    add(fx, s0 + i, v, v);
  }
}
function riser(t0, t1, vel = 1, f0 = 300, f1 = 9000) {
  const s0 = Math.round(t0 * SR), len = Math.round((t1 - t0) * SR);
  const bp = biquad('bp', f0, 2.5);
  let ph = 0, ph2 = 0;
  for (let i = 0; i < len; i++) {
    const p = i / len;
    if (i % 32 === 0) bp.set(f0 * Math.pow(f1 / f0, p * p), 2.5);
    const f = 180 * Math.pow(5, p * p);
    ph += 2 * Math.PI * f / SR; ph2 += 2 * Math.PI * f * 1.005 / SR;
    const saw = ((ph / Math.PI) % 2 - 1) * 0.5 + ((ph2 / Math.PI) % 2 - 1) * 0.5;
    const e = Math.pow(p, 2.2);
    const v = (bp(noise()) * 1.3 + saw * 0.08) * e * vel;
    const [l, r] = panLR(Math.sin(p * 14) * 0.4);
    add(fx, s0 + i, v * l, v * r);
    add(verbSend, s0 + i, v * 0.3, v * 0.3);
  }
}
function whoosh(t0, t1, vel = 1, up = true, panFrom = -0.8, panTo = 0.8) {
  const s0 = Math.round(t0 * SR), len = Math.round((t1 - t0) * SR);
  const bp = biquad('bp', 400, 1.6);
  for (let i = 0; i < len; i++) {
    const p = i / len;
    if (i % 32 === 0) bp.set(up ? 300 * Math.pow(20, p) : 5000 * Math.pow(1 / 12, p), 1.6);
    const e = Math.pow(Math.sin(Math.PI * Math.pow(p, up ? 0.8 : 0.5)), 2);
    const v = bp(noise()) * e * 1.2 * vel;
    const [l, r] = panLR(panFrom + (panTo - panFrom) * p);
    add(fx, s0 + i, v * l, v * r);
    add(verbSend, s0 + i, v * 0.2, v * 0.2);
  }
}
function blip(t, midi, vel = 1, pan = 0, dec = 18) {
  const s0 = Math.round(t * SR), len = Math.round(0.35 * SR);
  const f = mtof(midi);
  const [l, r] = panLR(pan);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const m = Math.sin(2 * Math.PI * f * 2 * tt) * 2.2 * Math.exp(-tt * 30);
    const v = Math.sin(2 * Math.PI * f * tt + m) * Math.exp(-tt * dec) * 0.22 * vel;
    add(music, s0 + i, v * l, v * r);
    add(delaySend, s0 + i, v * 0.45, v * 0.45);
    add(verbSend, s0 + i, v * 0.3, v * 0.3);
  }
}
function bell(t, midi, vel = 1, pan = 0, dur = 3) {
  const s0 = Math.round(t * SR), len = Math.round(dur * SR);
  const f = mtof(midi);
  const [l, r] = panLR(pan);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const m = Math.sin(2 * Math.PI * f * 3.5 * tt) * 3 * Math.exp(-tt * 5);
    const v = Math.sin(2 * Math.PI * f * tt + m) * Math.exp(-tt * 2.2) * 0.14 * vel * (1 - Math.exp(-tt * 800));
    add(music, s0 + i, v * l, v * r);
    add(verbSend, s0 + i, v * 0.6, v * 0.6);
  }
}
function tick(t, vel = 1, pan = 0) {
  const s0 = Math.round(t * SR), len = Math.round(0.02 * SR);
  const hp = biquad('hp', 2500, 0.7);
  const [l, r] = panLR(pan);
  for (let i = 0; i < len; i++) {
    const v = hp(noise()) * Math.exp(-i / SR * 350) * 0.5 * vel;
    add(fx, s0 + i, v * l, v * r);
  }
}
// supersaw voice
function saw(t, dur, midi, vel, opts = {}) {
  const { voices = 5, detune = 0.012, cut0 = 5000, cut1 = 900, cutDecay = 8, att = 0.003, rel = 0.08, busL = music, pan = 0, send = 0.2, dsend = 0 } = opts;
  const s0 = Math.round(t * SR), len = Math.round((dur + rel) * SR);
  const f = mtof(midi);
  const phs = Array.from({ length: voices }, () => rnd() * 2);
  const inc = phs.map((_, k) => 2 * f * (1 + detune * (k - (voices - 1) / 2) / ((voices - 1) / 2 || 1)) / SR);
  const lpL = biquad('lp', cut0, 0.8), lpR = biquad('lp', cut0, 0.8);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    if (i % 32 === 0) { const c = cut1 + (cut0 - cut1) * Math.exp(-tt * cutDecay); lpL.set(c, 0.8); lpR.set(c, 0.8); }
    let l = 0, r = 0;
    for (let k = 0; k < voices; k++) {
      phs[k] += inc[k]; if (phs[k] > 1) phs[k] -= 2;
      const w = (k / (voices - 1 || 1)) * 2 - 1;
      l += phs[k] * (1 - w * 0.6); r += phs[k] * (1 + w * 0.6);
    }
    let env = Math.min(1, tt / att);
    if (tt > dur) env *= Math.max(0, 1 - (tt - dur) / rel);
    const g = env * vel / voices;
    const [pl, pr] = panLR(pan);
    const L = lpL(l * g) * pl, R = lpR(r * g) * pr;
    add(busL, s0 + i, L, R);
    if (send) add(verbSend, s0 + i, L * send, R * send);
    if (dsend) add(delaySend, s0 + i, L * dsend, R * dsend);
  }
}
function bassNote(t, dur, midi, vel = 1) {
  const s0 = Math.round(t * SR), len = Math.round((dur + 0.03) * SR);
  const f = mtof(midi);
  let ph = 0, ph2 = 0;
  const lp = biquad('lp', 600, 1.2);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    if (i % 32 === 0) lp.set(220 + 900 * Math.exp(-tt * 14), 1.2);
    ph += f / SR; ph2 += f / 2 / SR;
    const sawv = (ph % 1) * 2 - 1;
    let env = Math.min(1, tt / 0.004) * (tt > dur ? Math.max(0, 1 - (tt - dur) / 0.03) : 1);
    const v = (lp(sawv) * 0.55 + Math.sin(2 * Math.PI * ph2) * 0.6) * env * vel;
    add(bass, s0 + i, Math.tanh(v * 1.3) * 0.7, Math.tanh(v * 1.3) * 0.7);
  }
}

// ---------------------------------------------------------------- arrangement
const beat = 0.5, s16 = 0.125;
// chords per time [start, end, root(bass midi), tones]
const CH = [
  [0, 4, 33, [57, 60, 64, 67]],   // Am7
  [4, 6, 29, [53, 57, 60, 64]],   // Fmaj7
  [6, 8, 36, [55, 60, 64, 67]],   // C
  [8, 10, 31, [55, 59, 62, 69]],  // G add9
  [10, 12, 33, [57, 60, 64, 71]], // Am add9
  [12, 13, 29, [53, 57, 60, 67]], // F add9
  [13, 14, 31, [55, 59, 62, 67]], // G
  [14, 16, 36, [48, 55, 64, 71, 74]], // Cmaj9 (final)
];
const chordAt = (t) => CH.find((c) => t >= c[0] && t < c[1]);

// Intro: pad swell + heartbeat
for (const c of CH.slice(0, 1)) for (const n of c[3]) saw(0.0, 1.95, n, 0.5, { voices: 6, detune: 0.018, cut0: 1600, cut1: 500, cutDecay: 0.6, att: 1.2, rel: 0.05, send: 0.5 });
for (const t of [0, 0.5, 1.0, 1.5]) kick(t, 0.7, true);
riser(0.6, 2.0, 0.9);
revCymbal(2.0, 1.2, 1.0);
// logo pixels landing: ascending arpeggio on 16ths
[69, 72, 76, 79, 81, 84, 88, 91, 93].forEach((m, i) => blip(1.0 + i * 0.125, m, 0.9 + i * 0.04, (i % 2 ? 0.35 : -0.35), 14));

// Impacts
for (const [t, v] of [[2.0, 1.0], [6.0, 0.7], [8.0, 0.6]]) { boom(t, v); crash(t, v); }
// Stabs on the big hits
for (const n of [57, 60, 64, 69, 72]) saw(2.0, 0.35, n, 0.7, { cut0: 9000, cut1: 1500, cutDecay: 5, rel: 0.6, send: 0.5 });

// Drums groove 2.0 - 13.0 (build breaks at 5.5-6.0)
for (let t = 2.0; t < 13.0 - 1e-6; t += s16) {
  const k = Math.round((t - 2.0) / s16);
  const inBreak = t >= 5.5 && t < 6.0;
  if (k % 4 === 0 && !inBreak) kick(t, 1);
  if (k % 8 === 4 && !inBreak) clap(t, 0.9);
  if (!inBreak) {
    if (k % 4 === 2) hat(t, 0.85, true, 0.2);
    else hat(t, [0.5, 0.25, 0, 0.35][k % 4], false, -0.25);
  }
}
// snare rolls
for (let t = 5.5; t < 6.0; t += 1 / 16) snare(t, 0.25 + (t - 5.5) * 1.4);
for (let t = 13.0; t < 14.0 - 1e-6;) { const p = (t - 13.0); snare(t, 0.2 + p * 0.75); t += p < 0.5 ? 0.125 : p < 0.75 ? 0.0625 : 0.03125; }
for (let t = 12.0; t < 13.0; t += beat) kick(t, 0.9);
riser(5.4, 6.0, 0.6); revCymbal(6.0, 0.6, 0.8);
riser(7.3, 8.0, 0.5, 400, 7000); revCymbal(8.0, 0.5, 0.6);
riser(12.9, 14.0, 1.0); revCymbal(14.0, 1.2, 1.1);

// Bass: offbeat 8ths + 16th pickups
for (let t = 2.0; t < 13.5; t += s16) {
  const k = Math.round((t - 2.0) / s16);
  const c = chordAt(t);
  if (t >= 5.5 && t < 6.0) continue;
  if (k % 4 === 2) bassNote(t, 0.2, c[2] + 12, 1);
  else if (k % 8 === 7 && t < 13) bassNote(t, 0.1, c[2] + 24, 0.55);
}
// Pad throughout
for (const c of CH.slice(1, 7)) for (const n of c[3]) saw(c[0], c[1] - c[0] - 0.02, n, 0.2, { voices: 5, detune: 0.02, cut0: 2400, cut1: 1200, cutDecay: 1, att: 0.08, rel: 0.12, send: 0.5 });
// Pluck arpeggio 16ths
const ARP = [0, 1, 2, 3, 4, 3, 2, 1];
for (let t = 2.0; t < 13.9; t += s16) {
  if (t >= 5.5 && t < 6.0) continue;
  const k = Math.round((t - 2.0) / s16);
  const c = chordAt(t);
  const tones = [...c[3].slice(0, 4), c[3][0] + 12].map((m) => m + 12);
  const bright = t > 13 ? 1 + (t - 13) * 2 : 1;
  saw(t, 0.09, tones[ARP[k % 8]], 0.42 * (k % 2 ? 0.75 : 1), { voices: 3, detune: 0.008, cut0: 4200 * bright, cut1: 700, cutDecay: 22, rel: 0.05, pan: k % 2 ? 0.3 : -0.3, send: 0.2, dsend: 0.35 });
}
// Transitions / sfx synced to picture
whoosh(3.1, 3.5, 1.1, true, 0, 0); boom(3.5, 0.35, 0.6);
whoosh(3.92, 4.26, 0.5, true, -0.6, 0.6);
whoosh(4.42, 4.78, 0.5, true, 0.6, -0.6);
whoosh(4.92, 5.3, 0.55, false, 0.3, -0.3);
// period drop
{ const s0 = Math.round(5.05 * SR), len = Math.round(0.22 * SR); let ph = 0; for (let i = 0; i < len; i++) { const p = i / len; ph += 2 * Math.PI * (1400 * Math.pow(0.25, p)) / SR; const v = Math.sin(ph) * 0.18 * (1 - p); add(music, s0 + i, v, v); } }
kick(5.25, 0.8); blip(5.25, 88, 0.9, 0, 10);
whoosh(5.5, 6.0, 1.0, true, 0, 0);
// heatmap sparkle following the wave
{ const pent = [81, 84, 86, 88, 91, 93, 96]; for (let t = 6.0; t < 7.35; t += s16) blip(t, pent[Math.floor(rnd() * pent.length)], 0.35, (t - 6.7) * 1.2, 22); }
whoosh(7.3, 8.0, 0.8, false, 0.5, -0.5);
// card: tiles pop, counter ticks
[76, 79, 81, 84, 86, 88].forEach((m, i) => blip(8.35 + i * 0.125, m, 0.7, -0.5 + i * 0.2, 16));
for (let j = 1; j < 40; j++) { const v = j / 40; const p = -Math.log2(1 - v) / 10; tick(8.12 + 1.4 * p, 0.7 * (1 - v * 0.5), 0.2); }
whoosh(9.35, 10.15, 0.7, true, -0.5, 0.5);
blip(9.2, 81, 0.6, 0, 8); blip(9.2, 88, 0.5, 0, 8);
// theme flips
[10.5, 11.0, 11.5, 12.0].forEach((b, i) => { whoosh(b - 0.19, b + 0.19, 0.8, i % 2 === 0, i % 2 ? 0.7 : -0.7, i % 2 ? -0.7 : 0.7); blip(b, [84, 86, 88, 91][i], 0.55, 0, 12); });
// typing
for (let i = 0; i < 12; i++) tick(11.02 + i * 0.066, 0.45, -0.1);
// click + success chime
tick(12.84, 1.2, 0.3); tick(12.9, 0.8, 0.3);
bell(12.95, 88, 0.8, 0.2, 1.5); bell(13.07, 93, 0.8, -0.2, 1.8);
whoosh(13.3, 13.66, 1.3, true, 0, 0);
whoosh(13.62, 14.0, 0.8, true, -0.4, 0.4);
// FINAL
boom(14.0, 1.1, 1.0); crash(14.0, 1.0, 1.0);
for (const n of CH[7][3]) saw(14.0, 0.9, n, 0.55, { voices: 7, detune: 0.018, cut0: 8000, cut1: 1800, cutDecay: 2.5, rel: 0.1, send: 0.7 });
for (const n of [36, 48]) bassNote(14.0, 0.9, n, 0.9);
kick(14.0, 1.1);
[84, 88, 91, 95].forEach((m, i) => bell(14.0 + i * 0.06, m, 0.9, -0.4 + i * 0.27, 1.0));

// ---------------------------------------------------------------- processing
// sidechain (music + bass) from the main kicks
const duck = new Float32Array(N).fill(1);
const kicks = [];
for (let t = 2.0; t < 13.0; t += beat) if (!(t >= 5.5 && t < 6.0)) kicks.push(t);
for (let t = 12.0; t < 13.0; t += beat) kicks.push(t);
kicks.push(14.0);
for (const kt of kicks) {
  const s0 = Math.round(kt * SR);
  for (let i = 0; i < 0.3 * SR; i++) {
    const tt = i / SR;
    const g = 0.3 + 0.7 * Math.pow(Math.min(1, tt / 0.26), 1.6);
    if (s0 + i < N) duck[s0 + i] = Math.min(duck[s0 + i], g);
  }
}
for (let i = 0; i < N; i++) { for (const b of [music, bass]) { b[0][i] *= duck[i]; b[1][i] *= duck[i]; } }

// stereo ping-pong delay (dotted 8th)
{
  const d = Math.round(0.375 * SR);
  const [l, r] = delaySend;
  const lp = [biquad('lp', 3500, 0.7), biquad('lp', 3500, 0.7)];
  const bl = new Float32Array(N), br = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const fl = i >= d ? br[i - d] : 0, fr = i >= d ? bl[i - d] : 0;
    bl[i] = l[i] + lp[0](fl) * 0.42; br[i] = r[i] * 0.2 + lp[1](fr) * 0.42;
    music[0][i] += (i >= d ? bl[i - d] : 0) * 0.5 * duck[i];
    music[1][i] += (i >= d ? br[i - d] : 0) * 0.5 * duck[i];
  }
}
// freeverb-style reverb
function freeverb(inL, inR, room = 0.86, damp = 0.35) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((x) => Math.round(x * SR / 44100));
  const alls = [556, 441, 341, 225].map((x) => Math.round(x * SR / 44100));
  const out = [new Float32Array(N), new Float32Array(N)];
  [inL, inR].forEach((inp, ch) => {
    const spread = ch ? 23 : 0;
    const cb = combs.map((n) => ({ buf: new Float32Array(n + spread), i: 0, st: 0 }));
    const ab = alls.map((n) => ({ buf: new Float32Array(n + spread), i: 0 }));
    const o = out[ch];
    for (let s = 0; s < N; s++) {
      const x = inp[s] * 0.015;
      let y = 0;
      for (const c of cb) {
        const v = c.buf[c.i];
        c.st = v * (1 - damp) + c.st * damp;
        c.buf[c.i] = x + c.st * room;
        c.i = (c.i + 1) % c.buf.length;
        y += v;
      }
      for (const a of ab) {
        const v = a.buf[a.i];
        a.buf[a.i] = y + v * 0.5;
        a.i = (a.i + 1) % a.buf.length;
        y = v - y;
      }
      o[s] = y;
    }
  });
  return out;
}
const verb = freeverb(verbSend[0], verbSend[1]);

// mix
const out = [new Float32Array(N), new Float32Array(N)];
const hpL = biquad('hp', 28, 0.7), hpR = biquad('hp', 28, 0.7);
for (let i = 0; i < N; i++) {
  for (let ch = 0; ch < 2; ch++) {
    let v = (drums[ch][i] * 0.7 + bass[ch][i] * 0.72 + music[ch][i] * 1.45 + fx[ch][i] * 0.85 + verb[ch][i] * 3.4) * 0.6;
    out[ch][i] = v;
  }
  out[0][i] = hpL(out[0][i]); out[1][i] = hpR(out[1][i]);
}
// glue: soft clip + normalize, fades
let peak = 0;
for (let ch = 0; ch < 2; ch++) for (let i = 0; i < N; i++) { out[ch][i] = Math.tanh(out[ch][i] * 1.1); peak = Math.max(peak, Math.abs(out[ch][i])); }
const g = 0.93 / peak;
for (let ch = 0; ch < 2; ch++) for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = Math.min(1, t / 0.01) * (t > 14.55 ? Math.max(0, 1 - (t - 14.55) / 0.45) ** 1.5 : 1);
  out[ch][i] *= g * fade;
}
// report bus levels
const rms = (b) => Math.sqrt(b[0].reduce((a, x) => a + x * x, 0) / N);
console.log('rms drums', rms(drums).toFixed(3), 'bass', rms(bass).toFixed(3), 'music', rms(music).toFixed(3), 'fx', rms(fx).toFixed(3), 'verb', (rms(verb) * 3.2).toFixed(3), 'peak', peak.toFixed(3));

// write 16-bit WAV
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(clamp(out[0][i], -1, 1) * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(clamp(out[1][i], -1, 1) * 32767), 46 + i * 4); }
writeFileSync(new URL('./music.wav', import.meta.url), buf);
console.log('wrote music.wav');
