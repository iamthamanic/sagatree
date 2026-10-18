/**
 * SagaWorkspaceChrome — Persistent saga meta bar + top nav for all saga tabs.
 * Location: src/app/project/SagaWorkspaceChrome.tsx
 *
 * Meta bar lives in AdaptivePage `header` (always visible). Body scrolls by default.
 * `fillBody` makes the body a flex fill (no padding/scroll) for full-bleed map.
 */
import type { ReactNode } from 'react';
import { AdaptivePage } from '../../shared/ui/adaptive';
import { Skeleton } from '../../shared/ui/skeleton';
import { sagatreeNativeSagaCoverUrlFromDisplayName } from '../../domains/saga/use-cases/sagatree-native-saga-covers';
import type { SagaSectionId } from '../shell';
import { useSagaOverview } from './hooks/useSagaOverview';
import { SagaHubMetaBar } from './overview/SagaHubMetaBar';
import { SagaWorkspaceNav } from './SagaWorkspaceNav';

export type SagaWorkspaceChromeProps = {
  sagaPublicId: string;
  section: SagaSectionId;
  onNavigate: (view: string) => void;
  onNavigateHome: () => void;
  children: ReactNode;
  /** Welt subtabs (Orte / Karte / …) — under top nav, still in the page header. */
  worldSubNav?: ReactNode;
  /** Extra classes on the inner content wrapper (e.g. narrow Einstellungen column). */
  contentClassName?: string;
  /** Full-bleed body (map): no gutters, fills remaining viewport under header. */
  fillBody?: boolean;
  'data-saga-hub'?: boolean;
};

export function SagaWorkspaceChrome({
  sagaPublicId,
  section,
  onNavigate,
  onNavigateHome,
  children,
  worldSubNav,
  contentClassName,
  fillBody = false,
  'data-saga-hub': dataSagaHub,
}: SagaWorkspaceChromeProps) {
  const { model, isLoading } = useSagaOverview({ sagaPublicId });
  const sagaTitle = model?.title?.trim() || 'Saga';
  const roleLabel =
    model?.isGm || model?.selfRole === 'gamemaster'
      ? 'Gamemaster'
      : model?.selfRole === 'viewer'
        ? 'Beobachter'
        : model
          ? 'Spieler'
          : '—';

  const chrome = (
    <div
      className="@container mx-auto flex w-full max-w-7xl flex-col gap-2"
      data-saga-workspace-sticky-chrome
    >
      {isLoading && !model ? (
        <div className="space-y-2" data-saga-chrome-loading-meta aria-busy="true">
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <SagaHubMetaBar
          sagaTitle={sagaTitle}
          sagaPublicId={sagaPublicId}
          coverUrl={model ? sagatreeNativeSagaCoverUrlFromDisplayName(model.title) : null}
          roleLabel={roleLabel}
          onLeave={onNavigateHome}
        />
      )}
      <SagaWorkspaceNav
        sagaPublicId={sagaPublicId}
        active={section}
        onNavigate={onNavigate}
      />
      {worldSubNav}
    </div>
  );

  return (
    <AdaptivePage
      data-au-surface="saga-section"
      data-saga-workspace-chrome
      data-saga-section={section}
      data-saga-hub={dataSagaHub ? 'true' : undefined}
      data-au-content-width="saga-workspace"
      className="h-full w-full"
      header={chrome}
      bodyClassName={
        fillBody
          ? // Override AdaptivePage gutters (incl. @[40rem]/main:px-6) for full-bleed map.
            'overflow-hidden !p-0 ![padding:0] flex min-h-0 flex-col @[40rem]/main:!px-0'
          : undefined
      }
    >
      <div
        className={
          fillBody
            ? `flex h-full min-h-0 w-full min-w-0 flex-1 flex-col ${contentClassName ?? ''}`.trim()
            : `@container mx-auto flex w-full max-w-7xl flex-col ${contentClassName ?? ''}`.trim()
        }
        data-saga-workspace-body
        data-saga-workspace-fill={fillBody ? 'true' : undefined}
      >
        {children}
      </div>
    </AdaptivePage>
  );
}
