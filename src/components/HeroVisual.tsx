import { useEffect, useRef } from 'react';
import type { MouseEvent, PointerEvent } from 'react';
import { THEMES } from '../lib/themes';
import type { CardTheme } from '../lib/themes';

const VIEW_W = 560;
const VIEW_H = 500;
/** Unfolded sheet size and where it sits; crumpled balls line up underneath. */
const SHEET_W = 520;
const SHEET_H = (SHEET_W * 675) / 1200;
const SHEET_Y = 168;
const BALL_Y = 420;
const BALL_R = 50;
const BALL_GAP = 200;

const GX = 20;
const GY = 12;
const FOCAL = 1000;
const LIGHT = norm([-0.35, -0.5, 0.79]);
const PAPER = [244, 240, 232];

const UNFOLD_MS = 1150;
const CRUMPLE_MS = 800;
const SETTLE_MS = 1600;
/** Share of the timeline over which unfolding ripples from the centre out to the corners. */
const STAGGER = 0.32;

interface Sample {
  theme: string;
  total: string;
  persona: string;
  tagline: string;
  stats: [string, string][];
  seed: number;
}

const SAMPLES: Sample[] = [
  {
    theme: 'crimson',
    total: '3,762',
    persona: 'Streak Machine',
    tagline: '52 days in a row. Rest days are a myth.',
    stats: [['Longest streak', '52d'], ['Active days', '241'], ['Busiest day', 'Mar 14'], ['Favourite day', 'Tue'], ['Stars earned', '1.2k'], ['Top language', 'TypeScript']],
    seed: 11,
  },
  {
    theme: 'mint',
    total: '1,984',
    persona: 'Weekend Warrior',
    tagline: 'Saturdays are for shipping.',
    stats: [['Longest streak', '19d'], ['Active days', '162'], ['Busiest day', 'Jun 8'], ['Favourite day', 'Sat'], ['Stars earned', '418'], ['Top language', 'Rust']],
    seed: 29,
  },
  {
    theme: 'midnight',
    total: '5,210',
    persona: 'Relentless Shipper',
    tagline: 'Shows up. Every. Single. Day.',
    stats: [['Longest streak', '87d'], ['Active days', '308'], ['Busiest day', 'Sep 2'], ['Favourite day', 'Wed'], ['Stars earned', '9.8k'], ['Top language', 'Go']],
    seed: 47,
  },
];

type Vec = [number, number, number];

interface Item {
  sample: Sample;
  theme: CardTheme;
  tex: HTMLCanvasElement;
  /** Per-vertex: crumpled position, wrinkle offsets, flat crease depth and unfold delay. */
  ball: Vec[];
  wobble: Vec[];
  crease: number[];
  delay: number[];
  /** 0 = crumpled ball, 1 = flat sheet; `target` is where it's heading. */
  p: number;
  target: number;
  /** How far the flat sheet's leftover creases have relaxed. */
  settle: number;
  /** Its slot in the row of balls, and where it's drawn: between that slot and the stage. */
  slot: number;
  slotTarget: number;
  x: number;
  y: number;
  hover: number;
  hoverTarget: number;
  spin: number;
}

function norm(v: Vec): Vec {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Builds the crumpled shape: the sheet's centre faces the viewer and its edges wrap
 * round the back of a lumpy sphere, with every vertex pushed in or out to make creases.
 */
function makeItem(sample: Sample, index: number): Item {
  const rand = rng(sample.seed);
  const ball: Vec[] = [];
  const wobble: Vec[] = [];
  const crease: number[] = [];
  const delay: number[] = [];
  const [ax, ay, az] = [(rand() - 0.5) * 1.4, (rand() - 0.5) * 1.4, rand() * Math.PI * 2];
  const twist = (rand() - 0.5) * 2;

  for (let j = 0; j <= GY; j++) {
    for (let i = 0; i <= GX; i++) {
      const sx = (i / GX) * 2 - 1;
      const sy = (j / GY) * 2 - 1;
      const d = Math.min(1, Math.hypot(sx, sy) / Math.SQRT2);
      const theta = d * Math.PI * 0.92 + (rand() - 0.5) * 0.35;
      const phi = Math.atan2(sy, sx) + twist * d + (rand() - 0.5) * 0.5;
      const r = BALL_R * (0.76 + rand() * 0.42);
      let v: Vec = [Math.sin(theta) * Math.cos(phi) * r, Math.sin(theta) * Math.sin(phi) * r, Math.cos(theta) * r];
      v = rotate(v, ax, ay, az);
      ball.push(v);
      wobble.push([(rand() - 0.5) * 30, (rand() - 0.5) * 30, (rand() - 0.5) * 110]);
      crease.push((rand() - 0.5) * 2);
      delay.push(d * STAGGER);
    }
  }

  const theme = THEMES.find((t) => t.id === sample.theme) ?? THEMES[0];
  return {
    sample,
    theme,
    tex: document.createElement('canvas'),
    ball,
    wobble,
    crease,
    delay,
    p: 0,
    target: 0,
    settle: 0,
    // The first card opens on load, so it starts mid-row with the others either side.
    slot: index ? ballX(index - 1, SAMPLES.length - 1) : VIEW_W / 2,
    slotTarget: index ? ballX(index - 1, SAMPLES.length - 1) : VIEW_W / 2,
    x: index ? ballX(index - 1, SAMPLES.length - 1) : VIEW_W / 2,
    y: BALL_Y,
    hover: 0,
    hoverTarget: 0,
    spin: (rand() - 0.5) * 0.6,
  };
}

function rotate([x, y, z]: Vec, ax: number, ay: number, az: number): Vec {
  let c = Math.cos(ax);
  let s = Math.sin(ax);
  [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(ay);
  s = Math.sin(ay);
  [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(az);
  s = Math.sin(az);
  [x, y] = [x * c - y * s, x * s + y * c];
  return [x, y, z];
}

function ballX(slot: number, count: number) {
  return VIEW_W / 2 + (slot - (count - 1) / 2) * BALL_GAP;
}

/** Decorative hero art: sample cards crumpled into paper balls. Click one to smooth it out. */
export function HeroVisual() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const items = useRef<Item[]>([]);
  const kick = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = VIEW_W * dpr;
    canvas.height = VIEW_H * dpr;

    const list = SAMPLES.map(makeItem);
    items.current = list;
    const paint = () => list.forEach((it) => paintCard(it.tex, it.sample, it.theme, (SHEET_W * dpr) / 1200));
    paint();
    // Repaint once the web fonts are in, so the textures don't keep fallback type.
    document.fonts.ready.then(() => {
      paint();
      kick.current();
    });

    let raf = 0;
    let last = 0;
    const frame = (now: number) => {
      const dt = last ? Math.min(50, now - last) : 16;
      last = now;
      const busy = step(list, dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, VIEW_W, VIEW_H);
      // Flatter sheets draw on top, so the one opening lands over the balls.
      for (const it of [...list].sort((a, b) => a.p - b.p)) drawItem(ctx, it);
      raf = busy ? requestAnimationFrame(frame) : 0;
      if (!busy) last = 0;
    };
    kick.current = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    kick.current();

    const intro = setTimeout(() => open(list[0]), 650);
    return () => {
      clearTimeout(intro);
      cancelAnimationFrame(raf);
    };
  }, []);

  const open = (it: Item | undefined) => {
    const prev = items.current.find((o) => o.target === 1);
    for (const other of items.current) other.target = other === it && other !== prev ? 1 : 0;
    if (prev && it && it !== prev) {
      // Swap: the sheet crumples into the slot the picked ball leaves, so the others stay put.
      prev.slotTarget = it.slotTarget;
    } else {
      const closed = items.current.filter((o) => o.target === 0).sort((a, b) => a.slotTarget - b.slotTarget);
      closed.forEach((o, i) => (o.slotTarget = ballX(i, closed.length)));
    }
    if (reducedMotion()) for (const other of items.current) other.p = other.settle = other.target;
    kick.current();
  };

  const hit = (e: MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * VIEW_W;
    const y = ((e.clientY - r.top) / r.height) * VIEW_H;
    return items.current.find((it) =>
      it.target === 1 ? Math.abs(x - it.x) < SHEET_W / 2 && Math.abs(y - it.y) < SHEET_H / 2 : Math.hypot(x - it.x, y - it.y) < BALL_R * 1.25,
    );
  };

  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const over = hit(e);
    e.currentTarget.style.cursor = over ? 'pointer' : 'default';
    let changed = false;
    for (const it of items.current) {
      const h = it === over && it.target === 0 ? 1 : 0;
      if (it.hoverTarget !== h) changed = true;
      it.hoverTarget = h;
    }
    if (changed) kick.current();
  };

  const onLeave = () => {
    for (const it of items.current) it.hoverTarget = 0;
    kick.current();
  };

  return (
    <div aria-hidden className="relative mx-auto h-[500px] w-[560px] max-w-full select-none">
      <canvas
        ref={canvasRef}
        className="rise h-full w-full"
        style={{ animationDelay: '300ms' }}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        onClick={(e) => open(hit(e))}
      />
    </div>
  );
}

/** Advances every item one frame; returns whether anything is still moving. */
function step(list: Item[], dt: number) {
  let busy = false;
  for (const it of list) {
    if (it.p !== it.target) {
      const rate = dt / (it.target > it.p ? UNFOLD_MS : CRUMPLE_MS);
      it.p = it.target > it.p ? Math.min(it.target, it.p + rate) : Math.max(it.target, it.p - rate);
      busy = true;
    }
    if (it.p === 1 && it.settle < 1) {
      it.settle = Math.min(1, it.settle + dt / SETTLE_MS);
      busy = true;
    } else if (it.p < 1) it.settle = 0;

    it.slot += (it.slotTarget - it.slot) * (1 - Math.exp(-dt / 160));
    const e = ease(it.p);
    it.x = it.slot + (VIEW_W / 2 - it.slot) * e;
    it.y = BALL_Y + (SHEET_Y - BALL_Y) * e;
    const ht = it.hoverTarget;
    it.hover += (ht - it.hover) * (1 - Math.exp(-dt / 90));
    if (Math.abs(it.slotTarget - it.slot) > 0.3 || Math.abs(ht - it.hover) > 0.01) busy = true;
  }
  return busy;
}

/** Each vertex's position for the item's current progress, centred on the origin. */
function vertices(it: Item): Vec[] {
  const out: Vec[] = [];
  const rest = 1 - ease(it.settle);
  const pop = 1 + it.hover * 0.08;
  for (let j = 0, n = 0; j <= GY; j++) {
    for (let i = 0; i <= GX; i++, n++) {
      const e = ease(clamp((it.p - it.delay[n]) / (1 - STAGGER)));
      const fx = (i / GX - 0.5) * SHEET_W;
      const fy = (j / GY - 0.5) * SHEET_H;
      const fz = it.crease[n] * 9 * rest;
      const b = it.ball[n];
      const w = it.wobble[n];
      const mid = Math.sin(Math.PI * e);
      let x = b[0] * pop + (fx - b[0] * pop) * e + w[0] * mid;
      let y = b[1] * pop + (fy - b[1] * pop) * e + w[1] * mid;
      const z = b[2] * pop + (fz - b[2] * pop) * e + w[2] * mid;
      // The sheet lands with a slight tilt; the ball keeps its own spin.
      const a = it.spin * (1 - e) - 0.035 * e;
      [x, y] = [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
      out.push([x, y, z]);
    }
  }
  return out;
}

function drawItem(ctx: CanvasRenderingContext2D, it: Item) {
  const flat = ease(clamp(it.p));
  drawShadow(ctx, it, flat);

  // Fully smoothed out: draw the card in one go so it's pixel-crisp.
  if (it.p === 1 && it.settle === 1) {
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.rotate(-0.035);
    ctx.drawImage(it.tex, -SHEET_W / 2, -SHEET_H / 2, SHEET_W, SHEET_H);
    ctx.restore();
    return;
  }

  const v = vertices(it);
  const proj = v.map(([x, y, z]) => {
    const s = FOCAL / (FOCAL - z);
    return [it.x + x * s, it.y + y * s] as [number, number];
  });
  const tw = it.tex.width;
  const th = it.tex.height;

  const tris: { a: number; b: number; c: number; z: number }[] = [];
  for (let j = 0; j < GY; j++) {
    for (let i = 0; i < GX; i++) {
      const tl = j * (GX + 1) + i;
      const tr = tl + 1;
      const bl = tl + GX + 1;
      const br = bl + 1;
      tris.push({ a: tl, b: tr, c: bl, z: (v[tl][2] + v[tr][2] + v[bl][2]) / 3 });
      tris.push({ a: tr, b: br, c: bl, z: (v[tr][2] + v[br][2] + v[bl][2]) / 3 });
    }
  }
  tris.sort((p, q) => p.z - q.z);

  const uv = (n: number): [number, number] => [((n % (GX + 1)) / GX) * tw, (Math.floor(n / (GX + 1)) / GY) * th];

  for (const t of tris) {
    const [x0, y0] = proj[t.a];
    const [x1, y1] = proj[t.b];
    const [x2, y2] = proj[t.c];
    const area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
    if (Math.abs(area) < 0.01) continue;
    const front = area > 0;

    let n = cross(sub(v[t.b], v[t.a]), sub(v[t.c], v[t.a]));
    n = norm(front ? n : [-n[0], -n[1], -n[2]]);
    const light = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
    const shade = light - LIGHT[2];

    // Grow each triangle a hair past its edges so neighbours overlap instead of leaving seams.
    const cx = (x0 + x1 + x2) / 3;
    const cy = (y0 + y1 + y2) / 3;
    ctx.beginPath();
    for (const [px, py] of [[x0, y0], [x1, y1], [x2, y2]]) {
      const dx = px - cx;
      const dy = py - cy;
      const l = Math.hypot(dx, dy) || 1;
      ctx.lineTo(px + (dx / l) * 0.6, py + (dy / l) * 0.6);
    }
    ctx.closePath();

    if (!front) {
      const k = 0.86 + shade * 0.75;
      ctx.fillStyle = `rgb(${PAPER.map((c) => Math.round(Math.min(255, c * k))).join(',')})`;
      ctx.fill();
      continue;
    }

    ctx.save();
    ctx.clip();
    const [u0, v0] = uv(t.a);
    const [u1, v1] = uv(t.b);
    const [u2, v2] = uv(t.c);
    const du1 = u1 - u0;
    const dv1 = v1 - v0;
    const du2 = u2 - u0;
    const dv2 = v2 - v0;
    const det = du1 * dv2 - du2 * dv1;
    const dx1 = x1 - x0;
    const dy1 = y1 - y0;
    const dx2 = x2 - x0;
    const dy2 = y2 - y0;
    const a = (dx1 * dv2 - dx2 * dv1) / det;
    const b = (dy1 * dv2 - dy2 * dv1) / det;
    const c = (dx2 * du1 - dx1 * du2) / det;
    const d = (dy2 * du1 - dy1 * du2) / det;
    ctx.transform(a, b, c, d, x0 - a * u0 - c * v0, y0 - b * u0 - d * v0);
    // Only the texture cell under this triangle, padded a pixel, instead of the whole image.
    const sx = Math.max(0, Math.min(u0, u1, u2) - 2);
    const sy = Math.max(0, Math.min(v0, v1, v2) - 2);
    const sw = Math.min(tw - sx, Math.max(u0, u1, u2) - sx + 4);
    const sh = Math.min(th - sy, Math.max(v0, v1, v2) - sy + 4);
    ctx.drawImage(it.tex, sx, sy, sw, sh, sx, sy, sw, sh);
    if (Math.abs(shade) > 0.004) {
      ctx.fillStyle = shade < 0 ? `rgba(20,10,14,${Math.min(0.75, -shade * 0.95)})` : `rgba(255,255,255,${Math.min(0.5, shade * 0.9)})`;
      ctx.fillRect(sx, sy, sw, sh);
    }
    ctx.restore();
  }
}

/** A soft contact shadow under the ball that grows into a lifted-paper shadow as it opens. */
function drawShadow(ctx: CanvasRenderingContext2D, it: Item, flat: number) {
  const rx = BALL_R * (1 - flat) + (SHEET_W / 2) * flat;
  const ry = BALL_R * 0.32 * (1 - flat) + (SHEET_H / 2) * flat;
  const cy = it.y + BALL_R * 0.88 * (1 - flat) + 14 * flat;
  ctx.save();
  ctx.translate(it.x + 6, cy);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.25);
  const alpha = 0.26 - flat * 0.08;
  g.addColorStop(0, `rgba(60,10,22,${alpha})`);
  g.addColorStop(0.7, `rgba(60,10,22,${alpha * 0.55})`);
  g.addColorStop(1, 'rgba(60,10,22,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** A canvas rendition of the 1200×675 share card, used as the paper's printed side. */
function paintCard(canvas: HTMLCanvasElement, s: Sample, theme: CardTheme, scale: number) {
  canvas.width = Math.round(1200 * scale);
  canvas.height = Math.round(675 * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const dark = theme.vars['--fg'] !== '#17161a';
  const fg = theme.vars['--fg'];
  const muted = theme.vars['--fg-muted'];
  const faint = theme.vars['--fg-faint'];
  const stops = [...theme.bg.matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0]);
  const blobs = [...theme.bg.matchAll(/radial-gradient\((\d+)% (\d+)% at (\d+)% (\d+)%, (rgba\([^)]*\))/g)];

  const base = ctx.createLinearGradient(0, 0, 1200, 675);
  stops.forEach((c, i) => base.addColorStop(i / Math.max(1, stops.length - 1), c));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 1200, 675);
  for (const [, w, h, x, y, color] of blobs.reverse()) {
    const cx = (Number(x) / 100) * 1200;
    const cy = (Number(y) / 100) * 675;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale((Number(w) / 100) * 1200, (Number(h) / 100) * 675);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, color);
    g.addColorStop(0.7, color.replace(/[\d.]+\)$/, '0)'));
    ctx.fillStyle = g;
    ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
  }

  const glass = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = dark ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.55)';
    ctx.fill();
    ctx.strokeStyle = theme.vars['--glass-border'];
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };
  const text = (str: string, x: number, y: number, font: string, color: string, spacing = 0, align: CanvasTextAlign = 'left') => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.letterSpacing = `${spacing}px`;
    ctx.fillText(str, x, y);
    return ctx.measureText(str).width;
  };
  const sans = '"Instrument Sans Variable", system-ui, sans-serif';
  const serif = '"Newsreader Variable", Georgia, serif';

  glass(28, 28, 1144, 619, 26);

  ctx.beginPath();
  ctx.roundRect(68, 64, 56, 56, 16);
  ctx.fillStyle = theme.levels[3];
  ctx.fill();
  text('Y', 96, 104, `600 28px ${sans}`, dark ? '#17161a' : '#fff', 0, 'center');
  text('Your Name', 140, 88, `600 22px ${sans}`, fg);
  text('@you on GitHub', 140, 112, `400 15px ${sans}`, muted);

  glass(964, 68, 168, 48, 24);
  text('Shipped', 1012, 99, `600 17px ${sans}`, fg);
  text('’26', 1086, 101, `italic 400 22px ${serif}`, theme.accent);
  const logo = ['#e8627a', '#b73049', '#7e1d2c', '#5fd38a'];
  [[2, 0, 0], [3, 0, 0], [4, 0, 1], [3, 1, 1], [4, 1, 2], [2, 2, 0], [4, 2, 2], [1, 3, 1], [0, 4, 3]].forEach(([x, y, c]) => {
    ctx.fillStyle = logo[c];
    ctx.fillRect(980 + x * 5, 80 + y * 5, 4, 4);
  });

  text(`CONTRIBUTIONS IN 2026`, 68, 172, `600 12px ${sans}`, muted, 2.4);
  text(s.total, 64, 290, `400 136px ${serif}`, fg, -4);
  const w = text('The ', 68, 344, `400 32px ${serif}`, fg, -0.5);
  text(s.persona, 68 + w, 344, `italic 400 32px ${serif}`, theme.accent, -0.5);
  text(s.tagline, 68, 374, `400 16px ${sans}`, muted);

  s.stats.forEach(([label, value], i) => {
    const x = 574 + (i % 3) * 190;
    const y = 150 + Math.floor(i / 3) * 112;
    glass(x, y, 178, 100, 16);
    text(label.toUpperCase(), x + 16, y + 26, `600 10.5px ${sans}`, muted, 1.7);
    text(value, x + 16, y + 66, `400 ${value.length > 6 ? 26 : 34}px ${serif}`, fg, -0.6);
  });

  const rand = rng(s.seed * 7);
  for (let col = 0; col < 53; col++) {
    for (let row = 0; row < 7; row++) {
      const r = rand();
      const level = r < 0.3 ? 0 : r < 0.55 ? 1 : r < 0.78 ? 2 : r < 0.93 ? 3 : 4;
      ctx.beginPath();
      ctx.roundRect(68 + col * 18, 474 + row * 18, 14, 14, 4);
      ctx.fillStyle = theme.levels[level];
      ctx.globalAlpha = col > 43 ? 0.4 : 1;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  ['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'].forEach((m, i) => text(m, 68 + i * 158, 464, `400 11px ${sans}`, faint));
  text('Peak · Oct', 1132, 598, `400 13px ${sans}`, faint, 0, 'right');
}
