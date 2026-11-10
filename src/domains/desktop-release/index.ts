/**
 * Desktop release / download contracts — pure (no React, no fetch).
 * Location: src/domains/desktop-release/index.ts
 */

export type DesktopPlatform = 'macos' | 'windows' | 'linux';

export type DesktopReleaseAsset = {
  name: string;
  browserDownloadUrl: string;
  sizeBytes?: number;
};

export type DesktopReleaseSnapshot = {
  tagName: string;
  name: string;
  htmlUrl: string;
  publishedAt: string | null;
  assetsByPlatform: Record<DesktopPlatform, DesktopReleaseAsset | null>;
};

export type ClientOsGuess = DesktopPlatform | 'unknown';

const PLATFORM_LABEL_DE: Record<DesktopPlatform, string> = {
  macos: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
};

export function desktopPlatformLabelDe(platform: DesktopPlatform): string {
  return PLATFORM_LABEL_DE[platform];
}

export const DESKTOP_PLATFORMS: readonly DesktopPlatform[] = [
  'macos',
  'windows',
  'linux',
] as const;

/** Marketing paths that must render without AuthGate login. */
export function isPublicDownloadPath(pathname: string): boolean {
  const path = pathname.trim().split('?')[0]?.split('#')[0] || '/';
  const normalized = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return normalized === '/download' || normalized === '/get';
}

export function pathForDownload(): string {
  return '/download';
}

/**
 * Classify a GitHub Release asset filename into a desktop installer platform.
 * Updater sidecars (.json / .sig) and unknown names return null.
 */
export function classifyDesktopAssetName(name: string): DesktopPlatform | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  if (n.endsWith('.json') || n.endsWith('.sig') || n.endsWith('.asc')) return null;

  if (
    n.endsWith('.dmg')
    || n.endsWith('.pkg')
    || /(?:^|[^a-z])(darwin|macos|mac-?os)(?:[^a-z]|$)/.test(n)
    || /aarch64-apple|x86_64-apple|universal-apple/.test(n)
  ) {
    return 'macos';
  }

  if (
    n.endsWith('.msi')
    || n.endsWith('.exe')
    || /(?:^|[^a-z])(windows|win32|win64)(?:[^a-z]|$)/.test(n)
  ) {
    return 'windows';
  }

  if (
    n.endsWith('.appimage')
    || n.endsWith('.deb')
    || n.endsWith('.rpm')
    || /(?:^|[^a-z])linux(?:[^a-z]|$)/.test(n)
  ) {
    return 'linux';
  }

  return null;
}

/** Prefer universal installers, then generic dmg/msi/appimage over arch-specific. */
function assetRank(platform: DesktopPlatform, name: string): number {
  const n = name.toLowerCase();
  if (platform === 'macos') {
    if (n.includes('universal') && n.endsWith('.dmg')) return 40;
    if (n.includes('universal')) return 35;
    if (n.endsWith('.dmg')) return 30;
    if (n.endsWith('.pkg')) return 20;
    return 10;
  }
  if (platform === 'windows') {
    if (n.endsWith('.msi')) return 30;
    if (n.endsWith('.exe')) return 20;
    return 10;
  }
  if (n.endsWith('.appimage')) return 30;
  if (n.endsWith('.deb')) return 20;
  if (n.endsWith('.rpm')) return 15;
  return 10;
}

export function pickDesktopAssetsByPlatform(
  assets: readonly DesktopReleaseAsset[],
): Record<DesktopPlatform, DesktopReleaseAsset | null> {
  const best: Record<DesktopPlatform, DesktopReleaseAsset | null> = {
    macos: null,
    windows: null,
    linux: null,
  };
  const ranks: Record<DesktopPlatform, number> = {
    macos: -1,
    windows: -1,
    linux: -1,
  };

  for (const asset of assets) {
    const platform = classifyDesktopAssetName(asset.name);
    if (!platform) continue;
    const rank = assetRank(platform, asset.name);
    if (rank > ranks[platform]) {
      ranks[platform] = rank;
      best[platform] = asset;
    }
  }

  return best;
}

export function guessClientOs(
  userAgent: string,
  options?: { maxTouchPoints?: number },
): ClientOsGuess {
  const ua = userAgent.toLowerCase();
  if (/windows|win32|win64/.test(ua)) return 'windows';
  if (/android/.test(ua)) return 'unknown';
  if (/iphone|ipad|ipod/.test(ua)) return 'unknown';
  // iPadOS desktop-mode UA masquerades as Macintosh; callers pass maxTouchPoints.
  if (/mac os x|macintosh/.test(ua) && (options?.maxTouchPoints ?? 0) > 1) return 'unknown';
  if (/mac os x|macintosh/.test(ua)) return 'macos';
  if (/linux|cros/.test(ua)) return 'linux';
  return 'unknown';
}
