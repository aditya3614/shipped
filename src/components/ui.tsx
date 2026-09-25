import type { ReactNode } from 'react';

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

interface SegmentedProps<T extends string | number> {
  options: { value: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
}

export function Segmented<T extends string | number>({ options, value, onChange }: SegmentedProps<T>) {
  const i = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      className="relative grid rounded-lg bg-[#f1eee8] p-1 ring-1 ring-line"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <div
        aria-hidden
        className="absolute bottom-1 left-1 top-1 rounded-md bg-white shadow-[0_1px_2px_rgba(0,0,0,.08),0_2px_8px_-2px_rgba(0,0,0,.08)] transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
        style={{ width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(${i * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          title={o.title}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'relative z-10 h-8 rounded-md px-2 text-[13px] font-medium transition-colors duration-200',
            o.value === value ? 'text-ink' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Pixel "ship it" arrow built from contribution squares. */
export function Logo({ size = 30 }: { size?: number }) {
  const px: [number, number, string][] = [
    [2, 0, '#e8627a'], [3, 0, '#e8627a'], [4, 0, '#b73049'],
    [3, 1, '#b73049'], [4, 1, '#7e1d2c'],
    [2, 2, '#e8627a'], [4, 2, '#7e1d2c'],
    [1, 3, '#b73049'],
    [0, 4, '#5fd38a'],
  ];
  const s = size / 5;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {px.map(([x, y, c]) => (
        <rect key={`${x}-${y}`} x={x * s + 0.6} y={y * s + 0.6} width={s - 1.2} height={s - 1.2} rx={s * 0.22} fill={c} />
      ))}
    </svg>
  );
}

export function XLogo({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition duration-300 ease-[cubic-bezier(.2,.8,.2,1)] active:scale-[.97] disabled:pointer-events-none disabled:opacity-45';

/** Solid crimson, like "Start for free". */
export const buttonPrimary = cn(
  base,
  'btn-shine h-10 bg-crimson px-4 text-[14px] text-white shadow-[0_1px_0_rgba(255,255,255,.18)_inset,0_6px_16px_-8px_rgba(165,42,60,.7)] hover:-translate-y-px hover:bg-crimson-600 hover:shadow-[0_1px_0_rgba(255,255,255,.18)_inset,0_12px_24px_-10px_rgba(165,42,60,.8)]',
);

/** Outlined, like "See how it works". */
export const buttonSecondary = cn(
  base,
  'h-10 border border-line bg-white px-4 text-[14px] text-ink hover:-translate-y-px hover:border-[#d9d4cb] hover:shadow-[0_8px_20px_-12px_rgba(0,0,0,.25)]',
);

export const buttonGhost = cn(base, 'h-10 px-3 text-[14px] text-muted hover:text-ink');
