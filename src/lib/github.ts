export interface Profile {
  login: string;
  name: string | null;
  avatar_url: string;
  followers: number;
  public_repos: number;
  created_at: string;
}

export interface Repo {
  name: string;
  fork: boolean;
  stargazers_count: number;
  language: string | null;
  created_at: string;
  description: string | null;
}

export interface Day {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export class FetchError extends Error {}

async function getJson<T>(url: string, notFound: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new FetchError('Network error. Check your connection and try again.');
  }
  if (res.status === 404) throw new FetchError(notFound);
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get('x-ratelimit-reset'));
    const mins = reset ? Math.max(1, Math.ceil((reset * 1000 - Date.now()) / 60000)) : null;
    throw new FetchError(`GitHub rate limit hit. Try again${mins ? ` in ~${mins} min` : ' shortly'}.`);
  }
  if (!res.ok) throw new FetchError(`Something went wrong (${res.status}). Try again.`);
  return res.json() as Promise<T>;
}

export function fetchProfile(login: string) {
  return getJson<Profile>(`https://api.github.com/users/${encodeURIComponent(login)}`, `No GitHub user called “${login}”.`);
}

export function fetchRepos(login: string) {
  return getJson<Repo[]>(
    `https://api.github.com/users/${encodeURIComponent(login)}/repos?per_page=100&sort=pushed&type=owner`,
    `Couldn’t load repos for “${login}”.`,
  );
}

/** Daily contribution counts, via a public proxy of GitHub's contribution calendar. */
export async function fetchContributions(login: string, year: number) {
  const data = await getJson<{ contributions: Day[] }>(
    `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(login)}?y=${year}`,
    `Couldn’t load contributions for “${login}”.`,
  );
  return data.contributions;
}
