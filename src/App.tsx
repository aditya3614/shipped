import { getFontEmbedCSS, toBlob } from 'html-to-image';
import { ArrowRight, Copy, Download, LoaderCircle, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, PointerEvent, ReactNode, RefObject } from 'react';
import { CARD_H, CARD_W, Card } from './components/Card';
import { HeroVisual } from './components/HeroVisual';
import { Logo, Segmented, XLogo, buttonGhost, buttonPrimary, buttonSecondary, cn } from './components/ui';
import { FetchError, fetchContributions, fetchProfile, fetchRepos } from './lib/github';
import type { Day, Profile, Repo } from './lib/github';
import { computeWrapped } from './lib/stats';
import type { Wrapped } from './lib/stats';
import { THEMES } from './lib/themes';
import type { CardTheme } from './lib/themes';

const THIS_YEAR = new Date().getFullYear();
const EXAMPLES = ['torvalds', 'gaearon', 'sindresorhus'];

interface Loaded {
  profile: Profile;
  repos: Repo[];
  days: Day[];
  year: number;
}

function readParams() {
  const p = new URLSearchParams(location.search);
  const year = Number(p.get('y'));
  return {
    login: p.get('u') ?? '',
    x: p.get('x') ?? '',
    theme: THEMES.some((t) => t.id === p.get('t')) ? p.get('t')! : THEMES[0].id,
    year: year >= 2008 && year <= THIS_YEAR ? year : THIS_YEAR,
  };
}

export default function App() {
  const initial = useMemo(readParams, []);
  const [login, setLogin] = useState(initial.login);
  const [xHandle, setXHandle] = useState(initial.x);
  const [themeId, setThemeId] = useState(initial.theme);
  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<'copy' | 'download' | 'share' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const fontCss = useRef<Promise<string> | null>(null);
  // Keep the last message rendered while the toast fades out.
  const lastToast = useRef('');
  if (toast) lastToast.current = toast;

  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  const wrapped = useMemo(() => (data ? computeWrapped(data.profile, data.repos, data.days, data.year) : null), [data]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async (name: string, year: number) => {
    const user = name.trim().replace(/^@/, '').replace(/^https?:\/\/github\.com\//, '').split('/')[0];
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [profile, repos, days] = await Promise.all([fetchProfile(user), fetchRepos(user), fetchContributions(user, year)]);
      setLogin(profile.login);
      setData({ profile, repos, days, year });
    } catch (e) {
      setError(e instanceof FetchError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const changeYear = useCallback(
    async (year: number) => {
      if (!data) return;
      try {
        const days = await fetchContributions(data.profile.login, year);
        setData({ ...data, days, year });
      } catch (e) {
        setToast(e instanceof FetchError ? e.message : 'Couldn’t load that year');
      }
    },
    [data],
  );

  // Deep links: ?u=login loads a card straight away.
  useEffect(() => {
    if (initial.login) load(initial.login, initial.year);
  }, [initial, load]);

  // Keep the URL shareable.
  useEffect(() => {
    const p = new URLSearchParams();
    if (data) {
      p.set('u', data.profile.login);
      if (data.year !== THIS_YEAR) p.set('y', String(data.year));
      if (themeId !== THEMES[0].id) p.set('t', themeId);
      if (xHandle.trim()) p.set('x', xHandle.replace(/^@/, '').trim());
    }
    const qs = p.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  }, [data, themeId, xHandle]);

  const renderPng = useCallback(async (): Promise<Blob> => {
    const node = cardRef.current;
    if (!node) throw new Error('No card');
    fontCss.current ??= getFontEmbedCSS(node);
    node.classList.add('exporting');
    try {
      const blob = await toBlob(node, { pixelRatio: 2, fontEmbedCSS: await fontCss.current });
      if (!blob) throw new Error('Export failed');
      return blob;
    } finally {
      node.classList.remove('exporting');
    }
  }, []);

  const copy = useCallback(async () => {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': renderPng() })]);
  }, [renderPng]);

  const onCopy = async () => {
    setBusy('copy');
    try {
      await copy();
      setToast('Card copied to clipboard');
    } catch {
      setToast('Clipboard blocked. Use Download instead');
    } finally {
      setBusy(null);
    }
  };

  const onDownload = async () => {
    if (!wrapped) return;
    setBusy('download');
    try {
      const url = URL.createObjectURL(await renderPng());
      const a = document.createElement('a');
      a.href = url;
      a.download = `shipped-${wrapped.login}-${wrapped.year}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setToast('Saved PNG');
    } catch {
      setToast('Export failed. Try again');
    } finally {
      setBusy(null);
    }
  };

  const onShare = async () => {
    if (!wrapped) return;
    let copied = false;
    setBusy('share');
    try {
      await copy();
      copied = true;
    } catch {
      // Still open the composer; they can download and attach manually.
    } finally {
      setBusy(null);
    }
    const link = `${location.origin}${location.pathname}?u=${wrapped.login}`;
    const text = `My ${wrapped.year} on GitHub: ${wrapped.total.toLocaleString('en-US')} contributions and a ${wrapped.longestStreak}-day streak. Apparently I'm The ${wrapped.persona.title} ✦\n\nWrap yours →`;
    const win = window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`, '_blank', 'noopener');
    if (!win) setToast('Allow pop-ups to open X');
    else setToast(copied ? 'Card copied. Paste it into your post' : 'Download the card to attach it');
  };

  const years = data ? [THIS_YEAR, THIS_YEAR - 1, THIS_YEAR - 2].filter((y) => y >= new Date(data.profile.created_at).getFullYear()) : [];

  return (
    <div className="flex min-h-full flex-col p-2.5 sm:p-5 lg:p-7">
      <div className="sheet flex flex-1 flex-col overflow-hidden rounded-[22px] sm:rounded-[28px]">
        <header className="rise flex h-20 shrink-0 items-center justify-between border-b border-line px-5 sm:px-10 lg:px-14">
          <button type="button" onClick={() => setData(null)} className="flex items-center gap-2.5" aria-label="Shipped home">
            <Logo size={30} />
            <span className="text-[26px] font-semibold tracking-[-0.03em]">Shipped</span>
          </button>
          <a
            href="https://x.com/adityadave89"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[15px] font-medium text-ink/80 transition hover:text-crimson"
          >
            <span className="hidden text-muted sm:inline">made by</span>
            <XLogo size={13} />
            adityadave89
          </a>
        </header>

        <main className="flex flex-1 flex-col justify-center px-5 py-10 sm:px-10 lg:px-14">
          {wrapped ? (
            <Result
              key={`${wrapped.login}-${wrapped.year}`}
              cardRef={cardRef}
              wrapped={wrapped}
              theme={theme}
              themeId={themeId}
              setThemeId={setThemeId}
              xHandle={xHandle}
              setXHandle={setXHandle}
              years={years}
              onYear={changeYear}
              onReset={() => setData(null)}
              onCopy={onCopy}
              onDownload={onDownload}
              onShare={onShare}
              busy={busy}
            />
          ) : (
            <Hero
              login={login}
              setLogin={setLogin}
              loading={loading}
              error={error}
              onSubmit={(e) => {
                e.preventDefault();
                load(login, initial.year);
              }}
              onExample={(u) => {
                setLogin(u);
                load(u, initial.year);
              }}
            />
          )}
        </main>
      </div>

      <div
        role="status"
        aria-live="polite"
        className={cn(
          'pointer-events-none fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-ink px-5 py-3 text-[14px] font-medium text-white shadow-[0_16px_40px_-12px_rgba(90,26,38,.6)] transition duration-500 ease-[cubic-bezier(.2,.8,.2,1)]',
          toast ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-95 opacity-0',
        )}
      >
        {lastToast.current}
      </div>
    </div>
  );
}

interface HeroProps {
  login: string;
  setLogin: (v: string) => void;
  loading: boolean;
  error: string | null;
  onSubmit: (e: FormEvent) => void;
  onExample: (u: string) => void;
}

function Hero({ login, setLogin, loading, error, onSubmit, onExample }: HeroProps) {
  return (
    <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1fr_560px]">
      <div>
        <div className="rise inline-flex items-center gap-2.5 rounded-full bg-blush px-4 py-1.5 ring-1 ring-pink/25" style={{ animationDelay: '60ms' }}>
          <span className="h-2.5 w-2.5 rounded-[3px] bg-pink" />
          <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-crimson">GitHub, wrapped</span>
        </div>

        <h1 className="rise mt-8 font-serif text-[56px] leading-[1.02] tracking-[-0.035em] sm:text-[76px]" style={{ animationDelay: '140ms' }}>
          Your code year,
          <br />
          <span className="text-crimson">beautifully</span>
          <br />
          shipped.
        </h1>

        <p className="rise mt-7 max-w-md text-[18px] leading-relaxed text-muted" style={{ animationDelay: '220ms' }}>
          Turn a year of commits into a card worth posting. Streaks, stars and your coding persona. No sign-in, nothing stored.
        </p>

        <form onSubmit={onSubmit} className="rise mt-10 max-w-lg" style={{ animationDelay: '300ms' }}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex h-12 flex-1 items-center rounded-lg border border-line bg-white pl-4 shadow-[0_1px_2px_rgba(0,0,0,.04)] transition focus-within:border-crimson/50 focus-within:ring-4 focus-within:ring-crimson/10">
              <span className="text-[15px] text-muted">github.com/</span>
              <input
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="username"
                aria-label="GitHub username"
                autoFocus
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent pr-3 text-[15px] text-ink outline-none placeholder:text-muted/50"
              />
            </label>
            <button type="submit" disabled={loading || !login.trim()} className={cn(buttonPrimary, 'h-12! px-6! text-[15px]!')}>
              {loading ? <LoaderCircle size={17} className="spin" /> : null}
              {loading ? 'Wrapping…' : 'Wrap my year'}
              {!loading && <ArrowRight size={17} />}
            </button>
          </div>
          <p className={cn('mt-3 h-5 text-sm font-medium text-crimson transition', error ? 'opacity-100' : 'opacity-0')}>{error}</p>
        </form>

        <div className="rise mt-5 flex flex-wrap items-center gap-3" style={{ animationDelay: '380ms' }}>
          <div className="flex -space-x-2">
            {EXAMPLES.map((u) => (
              <img key={u} src={`https://github.com/${u}.png?size=64`} alt="" className="h-8 w-8 rounded-full border-2 border-cream object-cover grayscale" />
            ))}
          </div>
          <span className="text-[14px] text-muted">
            Try it with{' '}
            {EXAMPLES.map((u, i) => (
              <span key={u}>
                <button type="button" disabled={loading} onClick={() => onExample(u)} className="font-semibold text-ink underline decoration-line decoration-2 underline-offset-4 transition hover:text-crimson hover:decoration-crimson/40">
                  {u}
                </button>
                {i < EXAMPLES.length - 2 ? ', ' : i === EXAMPLES.length - 2 ? ' or ' : ''}
              </span>
            ))}
          </span>
        </div>
      </div>

      <div className="hidden lg:block">
        <HeroVisual />
      </div>
    </div>
  );
}

interface ResultProps {
  cardRef: RefObject<HTMLDivElement | null>;
  wrapped: Wrapped;
  theme: CardTheme;
  themeId: string;
  setThemeId: (id: string) => void;
  xHandle: string;
  setXHandle: (v: string) => void;
  years: number[];
  onYear: (y: number) => void;
  onReset: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onShare: () => void;
  busy: 'copy' | 'download' | 'share' | null;
}

function Result({ cardRef, wrapped, theme, themeId, setThemeId, xHandle, setXHandle, years, onYear, onReset, onCopy, onDownload, onShare, busy }: ResultProps) {
  const icon = (kind: NonNullable<ResultProps['busy']>, idle: ReactNode) => (busy === kind ? <LoaderCircle size={15} className="spin" /> : idle);
  const boxRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    // Fit the card to both the column width and the viewport height, leaving room for the frame, nav and controls.
    const fit = () => setScale(Math.max(0.25, Math.min(1, el.clientWidth / CARD_W, (window.innerHeight - 330) / CARD_H)));
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, []);

  // Tilt toward the cursor. Measured on the untransformed stage so the rotation doesn't feed back into itself.
  const onTilt = (e: PointerEvent<HTMLDivElement>) => {
    const el = tiltRef.current;
    if (!el || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', `${(0.5 - py) * 14}deg`);
    el.style.setProperty('--ry', `${(px - 0.5) * 18}deg`);
    el.style.setProperty('--gx', `${px * 100}%`);
    el.style.setProperty('--gy', `${py * 100}%`);
    el.classList.add('is-tilting');
  };

  const onTiltEnd = () => {
    const el = tiltRef.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.classList.remove('is-tilting');
  };

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-7">
      <div ref={boxRef} className="rise w-full">
        <div className="tilt-stage mx-auto" style={{ width: CARD_W * scale, height: CARD_H * scale }} onPointerMove={onTilt} onPointerLeave={onTiltEnd}>
          <div ref={tiltRef} className="tilt relative h-full w-full">
            <div
              aria-hidden
              className="absolute inset-x-[6%] bottom-[-4%] top-[10%] rounded-[40px] bg-maroon/45 blur-2xl"
              style={{ transform: 'translateZ(-60px)' }}
            />
            <div style={{ width: CARD_W, height: CARD_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <Card ref={cardRef} w={wrapped} theme={theme} xHandle={xHandle} />
            </div>
            <div aria-hidden className="tilt-glare absolute inset-0" style={{ borderRadius: 36 * scale }} />
          </div>
        </div>
      </div>

      <div className="rise flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-3 shadow-[0_10px_30px_-20px_rgba(90,26,38,.35)]" style={{ animationDelay: '150ms' }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 pl-1">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.name}
                aria-label={`${t.name} theme`}
                aria-pressed={t.id === themeId}
                onClick={() => setThemeId(t.id)}
                style={{ background: t.bg }}
                className={cn(
                  'h-8 w-8 rounded-full ring-offset-2 ring-offset-white transition duration-300 hover:-translate-y-0.5',
                  t.id === themeId ? 'ring-2 ring-crimson' : 'ring-1 ring-black/10',
                )}
              />
            ))}
          </div>
          {years.length > 1 && (
            <div style={{ width: years.length * 66 }}>
              <Segmented value={wrapped.year} onChange={onYear} options={years.map((y) => ({ value: y, label: String(y) }))} />
            </div>
          )}
          <label className="flex h-10 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-[14px] transition focus-within:border-crimson/50 focus-within:ring-4 focus-within:ring-crimson/10">
            <XLogo size={12} />
            <span className="text-muted">@</span>
            <input
              value={xHandle}
              onChange={(e) => setXHandle(e.target.value)}
              placeholder="your X handle"
              aria-label="X handle shown on the card"
              spellCheck={false}
              className="w-28 bg-transparent text-ink outline-none placeholder:text-muted/50"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={buttonGhost} onClick={onReset}>
            <RotateCcw size={15} />
            New
          </button>
          <button type="button" className={buttonSecondary} onClick={onCopy} disabled={!!busy}>
            {icon('copy', <Copy size={15} />)}
            Copy
          </button>
          <button type="button" className={buttonSecondary} onClick={onDownload} disabled={!!busy}>
            {icon('download', <Download size={15} />)}
            Download
          </button>
          <button type="button" className={buttonPrimary} onClick={onShare} disabled={!!busy}>
            {icon('share', <XLogo size={13} />)}
            Share on X
          </button>
        </div>
      </div>
    </div>
  );
}
