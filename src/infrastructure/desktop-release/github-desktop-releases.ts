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

function asAsset(raw: unknown): DesktopReleaseAsset | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as { name?: unknown; browser_download_url?: unknown; size?: unknown };
  if (typeof row.name !== 'string' || !row.name.trim()) return null;
  if (typeof row.browser_download_url !== 'string' || !row.browser_download_url.trim()) {
    return null;
  }
  const sizeBytes = typeof row.size === 'number' && Number.isFinite(row.size)
    ? row.size
    : undefined;
  return {
    name: row.name.trim(),
    browserDownloadUrl: row.browser_download_url.trim(),
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

export async function fetchLatestDesktopRelease(
  init?: { signal?: AbortSignal; repo?: string },
): Promise<FetchDesktopReleaseResult> {
  const repo = init?.repo ?? defaultRepo();
  const url = desktopReleasesLatestApiUrl(repo);
  try {
    const response = await fetch(url, {
      signal: init?.signal,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (response.status === 404) {
      return { ok: false, reason: 'not-found' };
    }
    if (!response.ok) {
      return {
        ok: false,
        reason: 'network',
        detail: `HTTP ${response.status}`,
      };
    }
    const payload: unknown = await response.json();
    return parseGitHubLatestRelease(payload);
  } catch (err) {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      return { ok: false, reason: 'network', detail: 'aborted' };
    }
    return {
      ok: false,
      reason: 'network',
      detail: err instanceof Error ? err.message : 'fetch failed',
    };
  }
}
