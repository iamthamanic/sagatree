/**
 * GitHub Releases adapter for desktop installer discovery (public API, no auth).
 * Location: src/infrastructure/desktop-release/github-desktop-releases.ts
 */
import {
  pickDesktopAssetsByPlatform,
  type DesktopReleaseAsset,
  type DesktopReleaseSnapshot,
} from '../../domains/desktop-release';

export type FetchDesktopReleaseResult =
  | { ok: true; release: DesktopReleaseSnapshot }
  | { ok: false; reason: 'not-found' | 'empty' | 'network' | 'invalid'; detail?: string };

type GitHubReleaseJson = {
  tag_name?: unknown;
  name?: unknown;
  html_url?: unknown;
  published_at?: unknown;
  assets?: unknown;
};

const FETCH_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 5 * 60 * 1000;

let memoryCache:
  | { readonly at: number; readonly repo: string; readonly result: FetchDesktopReleaseResult }
  | null = null;

function defaultRepo(): string {
  const fromEnv = import.meta.env.VITE_DESKTOP_RELEASES_REPO;
  if (typeof fromEnv === 'string' && fromEnv.trim().includes('/')) {
    return fromEnv.trim();
  }
  return 'iamthamanic/sagatree';
}

export function desktopReleasesLatestApiUrl(repo = defaultRepo()): string {
  return `https://api.github.com/repos/${repo}/releases/latest`;
}

export function desktopReleasesPageUrl(repo = defaultRepo()): string {
  return `https://github.com/${repo}/releases`;
}

function isHttpsGithubDownloadUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:'
      && (parsed.hostname === 'github.com' || parsed.hostname.endsWith('.githubusercontent.com'));
  } catch {
    return false;
  }
}

function asAsset(raw: unknown): DesktopReleaseAsset | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as { name?: unknown; browser_download_url?: unknown; size?: unknown };
  if (typeof row.name !== 'string' || !row.name.trim()) return null;
  if (typeof row.browser_download_url !== 'string' || !row.browser_download_url.trim()) {
    return null;
  }
  const url = row.browser_download_url.trim();
  if (!isHttpsGithubDownloadUrl(url)) return null;
  const sizeBytes = typeof row.size === 'number' && Number.isFinite(row.size)
    ? row.size
    : undefined;
  return {
    name: row.name.trim(),
    browserDownloadUrl: url,
    sizeBytes,
  };
}

export function parseGitHubLatestRelease(payload: unknown): FetchDesktopReleaseResult {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, reason: 'invalid', detail: 'payload' };
  }
  const body = payload as GitHubReleaseJson;
  const tagName = typeof body.tag_name === 'string' ? body.tag_name.trim() : '';
  if (!tagName) {
    return { ok: false, reason: 'invalid', detail: 'tag_name' };
  }
  const htmlUrl = typeof body.html_url === 'string' && body.html_url.trim()
    ? body.html_url.trim()
    : desktopReleasesPageUrl();
  if (!isHttpsGithubDownloadUrl(htmlUrl) && !htmlUrl.startsWith('https://github.com/')) {
    return { ok: false, reason: 'invalid', detail: 'html_url' };
  }
  const name = typeof body.name === 'string' && body.name.trim()
    ? body.name.trim()
    : tagName;
  const publishedAt = typeof body.published_at === 'string' ? body.published_at : null;
  const rawAssets = Array.isArray(body.assets) ? body.assets : [];
  const assets = rawAssets
    .map(asAsset)
    .filter((a): a is DesktopReleaseAsset => Boolean(a));
  const assetsByPlatform = pickDesktopAssetsByPlatform(assets);
  const hasAny = Boolean(
    assetsByPlatform.macos || assetsByPlatform.windows || assetsByPlatform.linux,
  );
  if (!hasAny) {
    return { ok: false, reason: 'empty', detail: tagName };
  }
  return {
    ok: true,
    release: {
      tagName,
      name,
      htmlUrl,
      publishedAt,
      assetsByPlatform,
    },
  };
}

function mergeAbortSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener('abort', onAbort, { once: true });
  }
  return controller.signal;
}

export async function fetchLatestDesktopRelease(
  init?: { signal?: AbortSignal; repo?: string; bypassCache?: boolean },
): Promise<FetchDesktopReleaseResult> {
  const repo = init?.repo ?? defaultRepo();
  const now = Date.now();
  if (
    !init?.bypassCache
    && memoryCache
    && memoryCache.repo === repo
    && now - memoryCache.at < CACHE_TTL_MS
  ) {
    return memoryCache.result;
  }

  const url = desktopReleasesLatestApiUrl(repo);
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), FETCH_TIMEOUT_MS);
  const signal = init?.signal
    ? mergeAbortSignals([init.signal, timeout.signal])
    : timeout.signal;

  try {
    const response = await fetch(url, {
      signal,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (response.status === 404) {
      const result: FetchDesktopReleaseResult = { ok: false, reason: 'not-found' };
      memoryCache = { at: now, repo, result };
      return result;
    }
    if (response.status === 403 || response.status === 429) {
      const result: FetchDesktopReleaseResult = {
        ok: false,
        reason: 'network',
        detail: `HTTP ${response.status}`,
      };
      // Short negative cache so remounts don't burn the remaining rate limit.
      memoryCache = { at: now, repo, result };
      return result;
    }
    if (!response.ok) {
      return {
        ok: false,
        reason: 'network',
        detail: `HTTP ${response.status}`,
      };
    }
    const payload: unknown = await response.json();
    const result = parseGitHubLatestRelease(payload);
    memoryCache = { at: now, repo, result };
    return result;
  } catch (err) {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      return { ok: false, reason: 'network', detail: 'aborted' };
    }
    return {
      ok: false,
      reason: 'network',
      detail: err instanceof Error ? err.message : 'fetch failed',
    };
  } finally {
    clearTimeout(timer);
  }
}
