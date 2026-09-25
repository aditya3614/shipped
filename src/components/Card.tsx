import { forwardRef, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Day } from '../lib/github';
import { compact, formatDay } from '../lib/stats';
import type { Wrapped } from '../lib/stats';
import type { CardTheme } from '../lib/themes';
import { Logo, XLogo } from './ui';

export const CARD_W = 1200;
export const CARD_H = 675;
const INSET = 28;

interface Props {
  w: Wrapped;
  theme: CardTheme;
  xHandle: string;
}

/**
 * The shareable 1200×675 card (X's large-image size), exported to PNG as-is.
 * Depth layers are siblings, not nested in the glass slab, so the 3D tilt
 * isn't flattened by the slab's backdrop blur.
 */
export const Card = forwardRef<HTMLDivElement, Props>(function Card({ w, theme, xHandle }, ref) {
  const lang = w.languages[0];
  const handle = xHandle.replace(/^@/, '').trim();
  // Drop intro animations once they've played, so export (which freezes animations) can't restart them.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div ref={ref} className="relative" style={{ width: CARD_W, height: CARD_H, color: 'var(--fg)', ...(theme.vars as CSSProperties) }}>
      <div className="card-bg absolute inset-0 overflow-hidden rounded-[36px]" style={{ background: theme.bg }}>
        <div aria-hidden className="card-grain absolute inset-0" />
      </div>

      <div className="glass-panel depth-1 absolute rounded-[26px]" style={{ inset: INSET }} />

      <div className="absolute flex flex-col px-10 pb-8 pt-9" style={{ inset: INSET }}>
        <header className="depth-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={w.avatar} alt="" crossOrigin="anonymous" className="h-14 w-14 rounded-2xl object-cover shadow-[0_8px_20px_-8px_rgba(0,0,0,.5)] ring-2 ring-white/40" />
            <div>
              <div className="text-[22px] font-semibold leading-tight tracking-[-0.01em]">{w.name}</div>
              <div className="text-[15px]" style={{ color: 'var(--fg-muted)' }}>
                @{w.login} on GitHub
              </div>
            </div>
          </div>
          <div className="glass-panel flex items-center gap-2.5 rounded-full py-2 pl-3 pr-4">
            <Logo size={24} />
            <span className="text-[17px] font-semibold tracking-[-0.01em]">Shipped</span>
            <span className="font-serif text-[22px] italic leading-none" style={{ color: theme.accent }}>
              ’{String(w.year).slice(2)}
            </span>
          </div>
        </header>

        <div className="mt-7 flex gap-9">
          <div className="depth-2 w-[470px] shrink-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--fg-muted)' }}>
              Contributions in {w.year}
            </div>
            <div className="mt-4 font-serif font-normal leading-[0.92] tracking-[-0.035em] tabular-nums" style={{ fontSize: w.total >= 10000 ? 118 : 136 }}>
              <CountUp value={w.total} />
            </div>
            <div className="mt-4 font-serif text-[32px] leading-tight tracking-[-0.015em]">
              The{' '}
              <span className="italic" style={{ color: theme.accent }}>
                {w.persona.title}
              </span>
            </div>
            <div className="mt-1 text-[16px]" style={{ color: 'var(--fg-muted)' }}>
              {w.persona.tagline}
            </div>
          </div>

          <div className="grid flex-1 grid-cols-3 gap-3 self-start">
            <Stat label="Longest streak" value={`${w.longestStreak}d`} sub={w.longestStreak === 1 ? '1 day' : `${w.longestStreak} days in a row`} />
            <Stat label="Active days" value={String(w.activeDays)} sub={`of ${w.days.length} so far`} />
            <Stat label="Busiest day" value={w.busiestDay ? formatDay(w.busiestDay.date) : '—'} sub={w.busiestDay ? `${w.busiestDay.count} contributions` : 'Rest year'} />
            <Stat label="Favourite day" value={w.busiestWeekday.slice(0, 3)} sub={w.busiestWeekday === '—' ? '' : `${w.busiestWeekday}s hit different`} />
            <Stat label="Stars earned" value={compact(w.stars)} sub={w.topRepo ? `★ ${w.topRepo.name}` : 'All-time, own repos'} />
            <Stat label="Top language" value={lang ? lang.name : '—'} sub={lang ? `${Math.round(lang.share * 100)}% of repos` : 'No public repos'} small={!!lang && lang.name.length > 9} />
          </div>
        </div>

        <div className="depth-2 mt-auto flex items-end justify-between gap-6">
          <Heatmap days={w.days} year={w.year} levels={theme.levels} animate={!settled} />
          <div className="flex shrink-0 flex-col items-end gap-1.5 pb-0.5 text-[13px]" style={{ color: 'var(--fg-faint)' }}>
            {handle && (
              <span className="flex items-center gap-1.5" style={{ color: 'var(--fg)' }}>
                <XLogo size={12} />@{handle}
              </span>
            )}
            <span>{w.bestMonth !== '—' ? `Peak · ${w.bestMonth.slice(0, 3)}` : ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
});

function Stat({ label, value, sub, small }: { label: string; value: string; sub: string; small?: boolean }) {
  return (
    <div className="glass-panel depth-3 rounded-2xl px-4 pb-3 pt-3">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--fg-muted)' }}>
        {label}
      </div>
      <div className={small ? 'mt-1.5 truncate font-serif text-[23px] leading-[34px] tracking-[-0.01em]' : 'mt-1 truncate font-serif text-[34px] leading-[38px] tracking-[-0.02em]'}>
        {value}
      </div>
      <div className="mt-0.5 truncate text-[12px]" style={{ color: 'var(--fg-faint)' }}>
        {sub || ' '}
      </div>
    </div>
  );
}

const CELL = 14;
const GAP = 4;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** GitHub-style calendar for the whole year; days that haven't happened yet are dimmed. */
function Heatmap({ days, year, levels, animate }: { days: Day[]; year: number; levels: CardTheme['levels']; animate: boolean }) {
  const byDate = new Map(days.map((d) => [d.date, d.level]));
  const start = new Date(year, 0, 1);
  const offset = start.getDay();
  const cells: { col: number; row: number; level: number; future: boolean }[] = [];
  const months: { col: number; label: string }[] = [];

  for (let d = new Date(start), i = 0; d.getFullYear() === year; d.setDate(d.getDate() + 1), i++) {
    const key = `${year}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const col = Math.floor((offset + i) / 7);
    if (d.getDate() === 1) months.push({ col, label: MONTH_LABELS[d.getMonth()] });
    const level = byDate.get(key);
    cells.push({ col, row: (offset + i) % 7, level: level ?? 0, future: level === undefined });
  }

  const cols = cells[cells.length - 1].col + 1;
  const width = cols * (CELL + GAP) - GAP;

  return (
    <div style={{ width }}>
      <div className="relative mb-2 h-4 text-[11px]" style={{ color: 'var(--fg-faint)' }}>
        {months.map((m) => (
          <span key={m.label} className="absolute" style={{ left: m.col * (CELL + GAP) }}>
            {m.label}
          </span>
        ))}
      </div>
      <div className="relative" style={{ height: 7 * (CELL + GAP) - GAP }}>
        {cells.map((c, i) => (
          <span
            key={i}
            className={animate ? 'cell-in absolute rounded-[4px]' : 'absolute rounded-[4px]'}
            style={{
              left: c.col * (CELL + GAP),
              top: c.row * (CELL + GAP),
              width: CELL,
              height: CELL,
              background: levels[c.level],
              opacity: c.future ? 0.4 : 1,
              animationDelay: `${300 + c.col * 14 + c.row * 10}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Eased count-up; always settles on the exact value. */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setShown(value);
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 1400);
      setShown(Math.round(value * (1 - Math.pow(2, -10 * p))));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setShown(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{shown.toLocaleString('en-US')}</>;
}
