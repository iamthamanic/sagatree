/**
 * Public desktop download landing (Journey) — Mac / Windows / Linux installers.
 * Works without auth; shows "coming soon" until GitHub Releases have assets.
 * Location: src/app/download/DownloadScreen.tsx
 *
 * Surface: Journey · AU-01/02/03/07/09/CONTENT-WIDTH
 */
import { useEffect, useMemo, useState } from 'react';
import {
  AppleLogo,
  ArrowSquareOut,
  CircleNotch,
  Desktop,
  DownloadSimple,
  LinuxLogo,
  WindowsLogo,
} from '@phosphor-icons/react';
import {
  DESKTOP_PLATFORMS,
  desktopPlatformLabelDe,
  guessClientOs,
  pathForDownload,
  type DesktopPlatform,
  type DesktopReleaseSnapshot,
} from '../../domains/desktop-release';
import {
  desktopReleasesPageUrl,
  fetchLatestDesktopRelease,
} from '../../infrastructure/desktop-release/github-desktop-releases';
import { AdaptiveJourneyColumn } from '../../shared/ui/adaptive/AdaptiveJourneyColumn';
import { Button } from '../../shared/ui/button';
import { SagaTreeLogo } from '../shell';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; release: DesktopReleaseSnapshot }
  | { status: 'unavailable'; reason: 'not-found' | 'empty' | 'network' | 'invalid' };

function formatBytes(size?: number): string | null {
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) return null;
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function PlatformIcon({ platform }: { platform: DesktopPlatform }) {
  const className = 'h-6 w-6 shrink-0';
  if (platform === 'macos') return <AppleLogo className={className} aria-hidden weight="regular" />;
  if (platform === 'windows') {
    return <WindowsLogo className={className} aria-hidden weight="regular" />;
  }
  return <LinuxLogo className={className} aria-hidden weight="regular" />;
}

function goLogin() {
  window.history.pushState(null, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function DownloadScreen() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const clientOs = useMemo(
    () =>
      guessClientOs(typeof navigator !== 'undefined' ? navigator.userAgent : '', {
        maxTouchPoints: typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
      }),
    [],
  );
  const releasesPage = desktopReleasesPageUrl();

  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/get') {
      window.history.replaceState(null, '', pathForDownload());
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      const result = await fetchLatestDesktopRelease({ signal: ac.signal });
      if (ac.signal.aborted) return;
      if (result.ok === false) {
        setState({ status: 'unavailable', reason: result.reason });
        return;
      }
      setState({ status: 'ready', release: result.release });
    })();
    return () => ac.abort();
  }, []);

  const statusCopy = (() => {
    if (state.status === 'loading') {
      return 'Installer werden geladen…';
    }
    if (state.status === 'ready') {
      return `Aktuelle Version ${state.release.tagName}`;
    }
    if (state.reason === 'not-found' || state.reason === 'empty') {
      return 'Desktop-Installer erscheinen hier, sobald das erste Release gebaut ist.';
    }
    return 'Releases konnten gerade nicht geladen werden. GitHub Releases bleibt erreichbar.';
  })();

  return (
    <div
      className="relative flex min-h-screen justify-center bg-background px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      data-au-surface="download"
      data-au-pattern="journey"
      data-au-band="phone-tablet-desktop"
    >
      <AdaptiveJourneyColumn className="flex w-full flex-col gap-8 py-8 sm:py-12">
        <header className="space-y-4 text-center">
          <div className="flex justify-center">
            <SagaTreeLogo className="h-20 w-20 sm:h-24 sm:w-24" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-wide text-primary">
              SagaTree
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Desktop herunterladen
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg">
              Installer für macOS, Windows und Linux — ohne Terminal, ohne Setup-Rätsel.
            </p>
          </div>
        </header>

        <section
          className="space-y-3"
          aria-live="polite"
          aria-busy={state.status === 'loading'}
        >
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            {state.status === 'loading' ? (
              <CircleNotch className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Desktop className="h-4 w-4" aria-hidden />
            )}
            <span>{statusCopy}</span>
          </div>

          <ul className="grid gap-3">
            {DESKTOP_PLATFORMS.map((platform) => {
              const asset =
                state.status === 'ready'
                  ? state.release.assetsByPlatform[platform]
                  : null;
              const suggested = clientOs === platform;
              const sizeLabel = formatBytes(asset?.sizeBytes);
              const label = desktopPlatformLabelDe(platform);
              const enabled = Boolean(asset);

              return (
                <li key={platform}>
                  <div
                    className={[
                      'flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between',
                      suggested ? 'ring-2 ring-primary/40' : '',
                    ].join(' ')}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <PlatformIcon platform={platform} />
                      <div className="min-w-0 space-y-1">
                        <p className="font-semibold leading-none">{label}</p>
                        <p className="text-sm text-muted-foreground">
                          {enabled && asset
                            ? `${asset.name}${sizeLabel ? ` · ${sizeLabel}` : ''}`
                            : 'Noch kein Installer in einem öffentlichen Release'}
                        </p>
                        {suggested ? (
                          <p className="text-xs text-primary">Empfohlen für dieses Gerät</p>
                        ) : null}
                      </div>
                    </div>
                    {enabled && asset ? (
                      <Button
                        asChild
                        className="min-h-11 w-full sm:w-auto"
                        aria-label={`${label} Installer herunterladen`}
                      >
                        <a href={asset.browserDownloadUrl} rel="noopener noreferrer">
                          <DownloadSimple className="h-4 w-4" aria-hidden />
                          Download
                        </a>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 w-full sm:w-auto"
                        disabled
                        aria-label={`${label} Installer noch nicht verfügbar`}
                      >
                        Bald verfügbar
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Mobile:</strong> Mitspielen geht im Browser
            gegen einen Host (PC oder Server). Store-Apps (App Store / Play / F-Droid) kommen
            später — hier geht es um die Desktop-Installer.
          </p>
          <p>
            Bestehende Desktop-Installationen erhalten Updates später automatisch über den
            App-Updater, sobald signierte Releases live sind.
          </p>
        </section>

        <footer className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={goLogin}
          >
            Zur Anmeldung
          </Button>
          <Button asChild variant="ghost" className="min-h-11">
            <a href={releasesPage} target="_blank" rel="noopener noreferrer">
              Alle Releases auf GitHub
              <ArrowSquareOut className="h-4 w-4" aria-hidden />
            </a>
          </Button>
        </footer>
      </AdaptiveJourneyColumn>
    </div>
  );
}
