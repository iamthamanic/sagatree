/**
 * SagaResourceScreen — Canonical /sagas/** workspace shell (#276 / #489 / #571 / #saga-workspace-ia).
 * Location: src/app/project/SagaResourceScreen.tsx
 *
 * Persistent chrome: SagaHubMetaBar + Übersicht · Welt · Einstellungen on every
 * saga tab (AdaptivePage header). Karte uses viewport min-height so the
 * canvas sits flush under chrome; body stays scrollable.
 */
import { Loader2 } from 'lucide-react';
import { Button } from '../../shared/ui/button';
import { AdaptivePage } from '../../shared/ui/adaptive';
import { Skeleton } from '../../shared/ui/skeleton';
import { buildSessionJoinPath } from '../../domains/session/contracts/session-entry-routing';
import { resolveHubSessionEntryPhase } from '../../domains/session/contracts/session-prepare-recap';
import { resolveSagaPrimaryAction } from '../../domains/project/use-cases/saga-primary-action';
import { resolveSagaWorldSub } from '../../domains/project/contracts/saga-workspace-nav';
import type { SagaEpisodeVm } from '../../domains/project/contracts/saga-overview';
import type { SagaSectionId } from '../shell';
import { pathForSagaList, pathForSagaSection, pathForSessionPhase } from '../shell';
import { SagaCreateForm } from './SagaCreateForm';
import { SagaListPanel } from './SagaListPanel';
import { SagaWorkspaceChrome } from './SagaWorkspaceChrome';
import { SagaWorldSubNav } from './SagaWorldSubNav';
import { SagaVisualStyleSettings } from './SagaVisualStyleSettings';
import { SagaPermissionSettings } from './SagaPermissionSettings';
import { WorldLookPreviewPanel } from './WorldLookPreviewPanel';
import { SagaWorldMapPanel } from './SagaWorldMapPanel';
import { SagaWorkspaceCatalogSection } from './SagaWorkspaceCatalogSection';
import { toast } from 'sonner';
import { sessionService } from '../../infrastructure/session/session-service';
import { useSagaOverview } from './hooks/useSagaOverview';
import { useSagaEnsembleProfiles } from './hooks/useSagaEnsembleProfiles';
import { gmDefaultCharacterPortraitUrl } from '../../domains/character/use-cases/sagatree-native-gm-presence';
import { SagaEpisodeList } from './overview/SagaEpisodeList';
import { SagaEnsembleStrip } from './overview/SagaEnsembleStrip';

type SagaResourceScreenProps = {
  mode: 'list' | 'new' | 'section';
  sagaPublicId?: string | null;
  section?: SagaSectionId;
  onNavigateHome: () => void;
  onNavigate?: (view: string) => void;
};

const SECTION_LABELS: Record<SagaSectionId, string> = {
  overview: 'Übersicht',
  characters: 'Spieler-Charaktere',
  world: 'Welt',
  'npc-creatures': 'NSCs / Kreaturen',
  map: 'Karte',
  items: 'Gegenstände',
  quests: 'Quests',
  lore: 'Lore / Verlauf',
  sessions: 'Sessions',
  settings: 'Einstellungen',
};

const WORLD_CONTENT = new Set<SagaSectionId>([
  'world',
  'map',
  'npc-creatures',
  'items',
  'quests',
  'lore',
]);

const HUB_SECTIONS = new Set<SagaSectionId>(['overview', 'sessions', 'characters']);

export function SagaResourceScreen({
  mode,
  sagaPublicId,
  section = 'overview',
  onNavigateHome,
  onNavigate,
}: SagaResourceScreenProps) {
  const navigate = (view: string) => {
    if (onNavigate) {
      onNavigate(view);
      return;
    }
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', view.startsWith('/') ? view : `/${view}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  if (mode === 'list') {
    return (
      <AdaptivePage data-au-surface="saga-list" className="h-full w-full">
        <SagaListPanel onNavigate={navigate} onNavigateHome={onNavigateHome} />
      </AdaptivePage>
    );
  }

  if (mode === 'new') {
    return (
      <AdaptivePage data-au-surface="saga-new" className="h-full w-full">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-6" data-saga-new>
          <h1 className="text-2xl font-semibold text-foreground">Neue Saga</h1>
          <p className="text-sm text-muted-foreground">
            Nach dem Erstellen öffnet sich die Saga-Übersicht. Die Public ID (SA-XXXXX) wird
            serverseitig vergeben.
          </p>
          <SagaCreateForm
            onCancel={() => navigate(pathForSagaList())}
            onCreated={(publicId) => navigate(pathForSagaSection(publicId, 'overview'))}
          />
        </div>
      </AdaptivePage>
    );
  }

  const id = sagaPublicId?.trim() || null;

  if (!id) {
    return (
      <AdaptivePage data-au-surface="saga-section" className="h-full w-full">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
          <p className="text-sm text-destructive" role="alert">
            Diese Saga-URL ist ungültig oder die Saga existiert nicht.
          </p>
          <Button type="button" variant="ghost" className="min-h-11 self-start" onClick={onNavigateHome}>
            Zurück
          </Button>
        </div>
      </AdaptivePage>
    );
  }

  if (section === 'settings') {
    return (
      <SagaWorkspaceChrome
        sagaPublicId={id}
        section={section}
        onNavigate={navigate}
        onNavigateHome={onNavigateHome}
        contentClassName="mx-auto flex max-w-3xl flex-col gap-6"
      >
        <SagaVisualStyleSettings sagaPublicId={id} onNavigate={onNavigate} />
        <WorldLookPreviewPanel sagaPublicId={id} onNavigate={onNavigate} />
        <SagaPermissionSettings sagaPublicId={id} />
      </SagaWorkspaceChrome>
    );
  }

  if (WORLD_CONTENT.has(section)) {
    return (
      <SagaWorldShell
        sagaPublicId={id}
        section={section}
        onNavigate={navigate}
        onNavigateHome={onNavigateHome}
      />
    );
  }

  if (HUB_SECTIONS.has(section)) {
    return (
      <SagaOverviewSection
        sagaPublicId={id}
        section={section}
        onNavigate={navigate}
        onNavigateHome={onNavigateHome}
      />
    );
  }

  return (
    <SagaWorkspaceChrome
      sagaPublicId={id}
      section={section}
      onNavigate={navigate}
      onNavigateHome={onNavigateHome}
    >
      <p className="text-sm text-muted-foreground" data-saga-section-unavailable>
        {`Bereich „${SECTION_LABELS[section]}“ ist noch nicht verfügbar.`}
      </p>
    </SagaWorkspaceChrome>
  );
}

/**
 * Welt shell — persistent chrome + subtabs.
 * Map/Orte claim remaining viewport height (no drop); page body still scrolls.
 */
function SagaWorldShell({
  sagaPublicId,
  section,
  onNavigate,
  onNavigateHome,
}: {
  sagaPublicId: string;
  section: SagaSectionId;
  onNavigate: (view: string) => void;
  onNavigateHome: () => void;
}) {
  const sub = resolveSagaWorldSub(section) ?? 'map';
  const isMap = sub === 'map' || sub === 'places';

  return (
    <SagaWorkspaceChrome
      sagaPublicId={sagaPublicId}
      section={section}
      onNavigate={onNavigate}
      onNavigateHome={onNavigateHome}
      fillBody={isMap}
      worldSubNav={
        <SagaWorldSubNav
          sagaPublicId={sagaPublicId}
          active={section}
          onNavigate={onNavigate}
        />
      }
    >
      <div
        className={isMap ? 'flex min-h-0 min-w-0 flex-1 flex-col' : 'min-w-0'}
        data-saga-world-shell
        data-au-content-width="saga-world"
      >
        {isMap ? (
          <SagaWorldMapPanel sagaPublicId={sagaPublicId} onNavigate={onNavigate} />
        ) : (
          <SagaWorkspaceCatalogSection
            sagaPublicId={sagaPublicId}
            section={sub}
            onNavigate={onNavigate}
          />
        )}
      </div>
    </SagaWorkspaceChrome>
  );
}

/**
 * Overview hub — story title as H1, Library tabs, episodes + ensemble (#saga-workspace-ia).
 */
function SagaOverviewSection({
  sagaPublicId,
  section,
  onNavigate,
  onNavigateHome,
}: {
  sagaPublicId: string;
  section: SagaSectionId;
  onNavigate: (view: string) => void;
  onNavigateHome: () => void;
}) {
  const { model, isLoading, error, refresh } = useSagaOverview({ sagaPublicId });
  const ensembleMembers = useSagaEnsembleProfiles(model?.ensemble ?? []);
  const showCharacterCatalog = section === 'characters';

  const openEpisode = (episode: SagaEpisodeVm) => {
    const phase = resolveHubSessionEntryPhase(episode.status);
    onNavigate(pathForSessionPhase(sagaPublicId, episode.sessionPublicId, phase));
  };

  const deleteEpisode = async (episode: SagaEpisodeVm) => {
    if (!model?.isGm && model?.selfRole !== 'gamemaster') {
      toast.error('Nur der Gamemaster kann Sessions löschen.');
      return;
    }
    const title = episode.name?.trim() || `Session ${episode.sessionNumber}`;
    if (
      !window.confirm(
        `Möchtest du die Session „${title}“ (${episode.sessionPublicId}) wirklich löschen?`,
      )
    ) {
      return;
    }
    try {
      await sessionService.deleteSession(episode.sessionId);
      toast.success('Session gelöscht');
      await refresh({ force: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen');
    }
  };

  const runPrimary = () => {
    if (!model) return;
    const action = resolveSagaPrimaryAction(model, model.selfRole);
    if (action.kind === 'wait') return;
    if (action.kind === 'host-session') {
      onNavigate(
        buildSessionJoinPath({
          sagaPublicId,
          projectId: model.projectId,
          intent: 'create',
        }),
      );
      return;
    }
    if (action.sessionPublicId) {
      const episode = model.episodes.find((e) => e.sessionPublicId === action.sessionPublicId);
      const phase = episode
        ? resolveHubSessionEntryPhase(episode.status)
        : 'lobby';
      onNavigate(pathForSessionPhase(sagaPublicId, action.sessionPublicId, phase));
    }
  };

  return (
    <SagaWorkspaceChrome
      sagaPublicId={sagaPublicId}
      section={section}
      onNavigate={onNavigate}
      onNavigateHome={onNavigateHome}
      data-saga-hub
    >
      {error ? (
        <div className="space-y-3" role="alert" data-saga-overview-error>
          <p className="text-sm text-destructive">{error}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                void refresh({ force: true });
              }}
            >
              Erneut laden
            </Button>
            <Button type="button" variant="ghost" className="min-h-11" onClick={onNavigateHome}>
              Zurück zur Liste
            </Button>
          </div>
        </div>
      ) : null}

      {!error && isLoading && !model ? (
        <div className="space-y-4" data-saga-overview-loading aria-busy="true">
          <Skeleton className="h-[min(70vh,28rem)] w-full" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Übersicht wird geladen…
          </div>
        </div>
      ) : null}

      {!error && model && !showCharacterCatalog ? (
        <div
          className="mt-1 flex min-h-0 w-full min-w-0 flex-col gap-3"
          data-saga-hub-overview-panels
        >
          <div className="flex min-h-0 min-w-0 flex-col" data-saga-hub-sessions-panel>
            <SagaEpisodeList
              episodes={model.episodes}
              sagaTitle={model.title}
              onOpenEpisode={openEpisode}
              canDeleteEpisodes={model.isGm || model.selfRole === 'gamemaster'}
              onDeleteEpisode={deleteEpisode}
              primaryAction={resolveSagaPrimaryAction(model, model.selfRole)}
              onPrimary={runPrimary}
            />
          </div>
          <div
            className="flex max-h-[min(70vh,28rem)] min-h-0 min-w-0 flex-col"
            data-saga-hub-ensemble
          >
            <SagaEnsembleStrip
              ensemble={ensembleMembers}
              gmWorldPortraitUrl={gmDefaultCharacterPortraitUrl()}
              onManageCharacters={() =>
                onNavigate(pathForSagaSection(sagaPublicId, 'characters'))
              }
            />
          </div>
        </div>
      ) : null}

      {showCharacterCatalog ? (
        <div className="space-y-3" data-saga-hub-character-catalog>
          <SagaWorkspaceCatalogSection
            sagaPublicId={sagaPublicId}
            section="characters"
            onNavigate={onNavigate}
          />
        </div>
      ) : null}
    </SagaWorkspaceChrome>
  );
}
