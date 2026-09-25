import type { Day, Profile, Repo } from './github';

export interface Persona {
  title: string;
  tagline: string;
}

export interface Wrapped {
  login: string;
  name: string;
  avatar: string;
  year: number;
  days: Day[];
  total: number;
  activeDays: number;
  longestStreak: number;
  busiestDay: { date: string; count: number } | null;
  busiestWeekday: string;
  bestMonth: string;
  stars: number;
  topRepo: { name: string; stars: number } | null;
  languages: { name: string; share: number }[];
  newRepos: number;
  persona: Persona;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Parse YYYY-MM-DD as a local date so weekdays don't shift across time zones. */
function parseDay(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function todayKey() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

export function computeWrapped(profile: Profile, repos: Repo[], allDays: Day[], year: number): Wrapped {
  const today = todayKey();
  const days = allDays.filter((d) => d.date.startsWith(String(year)) && d.date <= today);

  let total = 0;
  let activeDays = 0;
  let streak = 0;
  let longestStreak = 0;
  let busiestDay: Wrapped['busiestDay'] = null;
  let weekendTotal = 0;
  const byWeekday = Array(7).fill(0);
  const byMonth = Array(12).fill(0);

  for (const d of days) {
    const date = parseDay(d.date);
    total += d.count;
    byWeekday[date.getDay()] += d.count;
    byMonth[date.getMonth()] += d.count;
    if (date.getDay() === 0 || date.getDay() === 6) weekendTotal += d.count;
    if (d.count > 0) {
      activeDays++;
      streak++;
      longestStreak = Math.max(longestStreak, streak);
      if (!busiestDay || d.count > busiestDay.count) busiestDay = { date: d.date, count: d.count };
    } else {
      streak = 0;
    }
  }

  const argmax = (xs: number[]) => xs.indexOf(Math.max(...xs));
  const own = repos.filter((r) => !r.fork);
  const stars = own.reduce((s, r) => s + r.stargazers_count, 0);
  const top = own.reduce<Repo | null>((best, r) => (!best || r.stargazers_count > best.stargazers_count ? r : best), null);

  const langCounts = new Map<string, number>();
  for (const r of own) if (r.language) langCounts.set(r.language, (langCounts.get(r.language) ?? 0) + 1);
  const langTotal = [...langCounts.values()].reduce((a, b) => a + b, 0);
  const languages = [...langCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, n]) => ({ name, share: n / langTotal }));

  const newRepos = own.filter((r) => r.created_at.startsWith(String(year))).length;

  const w = {
    total,
    activeDays,
    longestStreak,
    busiestDay,
    weekendShare: total ? weekendTotal / total : 0,
    languageCount: langCounts.size,
    newRepos,
  };

  return {
    login: profile.login,
    name: profile.name || profile.login,
    avatar: profile.avatar_url,
    year,
    days,
    total,
    activeDays,
    longestStreak,
    busiestDay,
    busiestWeekday: total ? WEEKDAYS[argmax(byWeekday)] : '—',
    bestMonth: total ? MONTHS[argmax(byMonth)] : '—',
    stars,
    topRepo: top && top.stargazers_count > 0 ? { name: top.name, stars: top.stargazers_count } : null,
    languages,
    newRepos,
    persona: pickPersona(w),
  };
}

function pickPersona(w: {
  total: number;
  activeDays: number;
  longestStreak: number;
  busiestDay: { count: number } | null;
  weekendShare: number;
  languageCount: number;
  newRepos: number;
}): Persona {
  const avg = w.activeDays ? w.total / w.activeDays : 0;
  if (w.total === 0) return { title: 'Quiet Strategist', tagline: 'Plotting something big, in silence.' };
  if (w.longestStreak >= 30) return { title: 'Streak Machine', tagline: `${w.longestStreak} days in a row. Rest days are a myth.` };
  if (w.weekendShare >= 0.35) return { title: 'Weekend Warrior', tagline: 'Saturdays are for shipping.' };
  if (w.activeDays >= 200) return { title: 'Relentless Shipper', tagline: 'Shows up. Every. Single. Day.' };
  if (w.languageCount >= 5) return { title: 'Polyglot', tagline: `Fluent in ${w.languageCount} languages, and counting.` };
  if (w.newRepos >= 10) return { title: 'Idea Machine', tagline: `${w.newRepos} new repos. The side projects won.` };
  if (w.busiestDay && avg > 0 && w.busiestDay.count >= avg * 5) return { title: 'Sprint Hero', tagline: 'Goes quiet, then ships everything at once.' };
  return { title: 'Steady Builder', tagline: 'Consistent commits, compounding results.' };
}

export function formatDay(date: string) {
  return parseDay(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function compact(n: number) {
  return n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : n.toLocaleString('en-US');
}
