import { useMemo } from 'react';
import { Logo } from './ui';

const COLS = 22;
const ROWS = 18;
const CELL = 20;
const GAP = 4;

const RED = ['#5a1a26', '#5a1a26', '#5a1a26', '#7e1d2c', '#b73049', '#b73049', '#e8627a', '#e8627a', '#f7b6c2', '#3a0f18'];
const GREEN = ['#5fd38a', '#5fd38a', '#5fd38a', '#9be8b5', '#1f5c3a', '#1f5c3a', '#2e7d4f'];
const BARS: [number, string][] = [
  [38, '#e7e4de'], [55, '#a8e2b8'], [44, '#e7e4de'], [72, '#e8627a'], [60, '#e7e4de'],
  [86, '#e8627a'], [66, '#a8e2b8'], [94, '#e8627a'], [78, '#e7e4de'], [100, '#e8627a'],
];

/** Small deterministic PRNG so the art is identical on every render. */
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

function inside(x: number, y: number, cx: number, cy: number, rx: number, ry: number) {
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
}

/** Decorative hero art: a contribution-pixel cluster with a floating stats card. */
export function HeroVisual() {
  const cells = useMemo(() => {
    const rand = rng(7);
    const out: { x: number; y: number; c: string }[] = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const red = Math.min(inside(x, y, 10, 10.5, 9, 6.2), inside(x, y, 7.5, 16.4, 4.4, 1.6));
        const green = inside(x, y, 15.5, 3.2, 5.6, 2.8);
        // Ragged edges: cells near the boundary survive by chance.
        if (green < 1 && rand() > green * 0.3) out.push({ x, y, c: GREEN[Math.floor(rand() * GREEN.length)] });
        else if (red < 1 && rand() > red * 0.25) out.push({ x, y, c: RED[Math.floor(rand() * RED.length)] });
      }
    }
    return out;
  }, []);

  return (
    <div aria-hidden className="relative mx-auto h-[500px] w-[560px] max-w-full select-none">
      <div className="absolute right-0 top-0" style={{ width: COLS * (CELL + GAP), height: ROWS * (CELL + GAP) }}>
        {cells.map((p) => (
          <span
            key={`${p.x}-${p.y}`}
            className="cell-in absolute rounded-[5px]"
            style={{
              left: p.x * (CELL + GAP),
              top: p.y * (CELL + GAP),
              width: CELL,
              height: CELL,
              background: p.c,
              animationDelay: `${200 + (p.x + p.y) * 22}ms`,
            }}
          />
        ))}
      </div>

      <div className="bob absolute right-2 top-[70px] flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[14px] font-semibold shadow-[0_10px_30px_-10px_rgba(90,26,38,.35)] ring-1 ring-line">
        <Logo size={18} />
        Your card is ready
      </div>

      <div className="rise absolute bottom-0 left-0 w-[440px] rounded-xl bg-white p-5 shadow-[0_24px_60px_-24px_rgba(90,26,38,.45)] ring-1 ring-line" style={{ animationDelay: '500ms' }}>
        <div className="flex h-[92px] items-end gap-2.5">
          {BARS.map(([h, c], i) => (
            <span key={i} className="bar-in flex-1 rounded-t-[4px]" style={{ height: `${h}%`, background: c, animationDelay: `${700 + i * 70}ms` }} />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <MiniStat label="Contributions" value="3,762" delta="↑ 24%" up />
          <MiniStat label="Streak" value="52d" delta="↑ 8d" up />
          <MiniStat label="Rest days" value="31" delta="↓ 12" />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, delta, up }: { label: string; value: string; delta: string; up?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{label}</div>
      <div className="font-serif text-[30px] leading-tight tracking-[-0.02em]">{value}</div>
      <div className={up ? 'text-[11px] font-medium text-[#2e9b5b]' : 'text-[11px] font-medium text-crimson'}>{delta}</div>
    </div>
  );
}
