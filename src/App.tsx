/**
 * App — composition root: AuthGate, Layout, History routing (#133/#276), lazy views.
 * Location: src/App.tsx
 *
 * App-area imports must go through each area's public barrel (`app/<area>`) or
 * heavy screen entry (`app/<area>/root`) — enforced by architecture-boundary-check.
 */
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { AuthProvider } from './lib/auth-context';
import { ThemeProvider } from './lib/theme-provider';
import { AuthGate, Layout, ViewLoadingFallback, useAppLocation } from './app/shell';
import { DownloadScreen, PublicAppGate } from './app/download';
import { Dashboard } from './app/dashboard';
import { Toaster } from './shared/ui/sonner';
import { NotFoundPlaceholder, ItemWorkbenchScreen } from './app/items';
import { LookCreateScreen, LookEditScreen, takeLookEditorReturnPath } from './app/look';
import { NpcCreatureCreateScreen, NpcCreatureEditorScreen } from './app/npc-creature';
import { SagaResourceScreen } from './app/project';
import { SagaEditorScreen } from './app/saga';
import { SessionResourceScreen } from './app/session';
import { WorldAtlasScreen } from './app/world';
import {
  assertPlayerNotRoutedToGamemaster,
  resolveCanonicalLiveEntry,
} from './domains/session/contracts/session-entry-routing';
import { resolveCanonicalLobbyEntry } from './domains/session/contracts/session-lobby';
import { takeInviteReturnPath } from './domains/session/contracts/session-invite';

const CharacterEditor = lazy(() =>
  import('./app/character/root').then((module) => ({ default: module.CharacterEditor })),
);
const GamemasterPanel = lazy(() =>
  import('./app/session').then((module) => ({ default: module.GamemasterPanel })),
);
const Marketplace = lazy(() =>
  import('./app/marketplace').then((module) => ({ default: module.Marketplace })),
);
const ProjectJoin = lazy(() =>
  import('./app/project').then((module) => ({ default: module.ProjectJoin })),
);
const SessionJoin = lazy(() =>
  import('./app/session').then((module) => ({ default: module.SessionJoin })),
);
const SessionInviteResolve = lazy(() =>
  import('./app/session').then((module) => ({ default: module.SessionInviteResolve })),
);
const Library = lazy(() =>
  import('./app/library/root').then((module) => ({ default: module.Library })),
);
const Profile = lazy(() =>
  import('./app/profile').then((module) => ({ default: module.Profile })),
);
const RulesetsTest = lazy(() =>
  import('./app/rulesets').then((module) => ({ default: module.RulesetsTest })),
);

if (import.meta.env.DEV) {
  void import('./lib/devtrack').then(({ initDevTrack }) => initDevTrack());
}

function LazyView({ children }: { children: ReactNode }) {
  return <Suspense fallback={<ViewLoadingFallback />}>{children}</Suspense>;
}

function CharacterEditorView() {
  // Capture edit / promotion id once per mount so clearing sessionStorage after hydrate
  // does not remount the editor mid-load.
  const [mountKey] = useState(() => {
    if (typeof sessionStorage === 'undefined') return 'new-character';
    const editId = sessionStorage.getItem('sagatree:character-edit-id');
    if (editId) return editId;
    const promotion = sessionStorage.getItem('sagatree:npc-promotion');
    if (promotion) return `npc-promotion:${promotion.length}`;
    return 'new-character';
  });
  return (
    <LazyView>
      <CharacterEditor key={mountKey} />
    </LazyView>
  );
}

function AppShell() {
  const {
    currentView,
    itemId,
    createTypeSlug,
    lookId,
    sagaDefinitionId,
    npcCreatureDefinitionId,
    search,
    pathname,
    route,
    navigateToView,
    navigateToPath,
    navigateToItem,
    navigateToItemCreateType,
    navigateToLookCreate,
    navigateToLookEdit,
    navigateToNpcCreatureCreate,
    navigateToNpcCreatureEdit,
    navigateToWorldAtlas,
    navigateToSagaDefinitionEdit,
    navigateToSessionLive,
    navigateToSessionPhase,
    worldPublicId,
  } = useAppLocation();

  const handleNavigate = (view: string) => {
    if (view.startsWith('/')) {
      navigateToPath(view);
      return;
    }
    navigateToView(view);
  };

  useEffect(() => {
    const inviteReturn = takeInviteReturnPath();
    if (inviteReturn) {
      navigateToPath(inviteReturn);
    }
  }, [navigateToPath]);

  const layoutView =
    currentView === 'item-create'
    || currentView === 'item-detail'
    || currentView === 'look-create'
    || currentView === 'look-edit'
    || currentView === 'npc-creature-create'
    || currentView === 'npc-creature-edit'
    || currentView === 'world-atlas'
    || currentView === 'saga-list'
    || currentView === 'saga-new'
    || currentView === 'saga-section'
    || currentView === 'saga-definition-create'
    || currentView === 'saga-definition-edit'
    || currentView === 'session-phase'
    || currentView === 'session-live'
    || currentView === 'session-invite'
    || currentView === 'character-public'
      ? (currentView.startsWith('saga') || currentView.startsWith('session')
        ? 'dashboard'
        : currentView === 'character-public'
          ? 'character-editor'
          : 'library')
      : currentView;

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'character-editor':
        return <CharacterEditorView />;
      case 'character-public':
        return <CharacterEditorView />;
      case 'adventure-editor':
        // Compatibility route — canonical navigation is /sagas/:sagaPublicId/**
        return (
          <SagaResourceScreen
            mode="list"
            onNavigateHome={() => handleNavigate('dashboard')}
          />
        );
      case 'gamemaster':
        // Compatibility route — canonical is /sagas/.../live/gamemaster
        return (
          <LazyView>
            <GamemasterPanel />
          </LazyView>
        );
      case 'marketplace':
        return (
          <LazyView>
            <Marketplace />
          </LazyView>
        );
      case 'library':
        return (
          <LazyView>
            <Library
              pathname={pathname}
              onNavigate={handleNavigate}
              onNavigateToItem={navigateToItem}
              onNavigateToLookCreate={navigateToLookCreate}
              onNavigateToLookEdit={navigateToLookEdit}
              onNavigateToNpcCreate={navigateToNpcCreatureCreate}
              onNavigateToNpcEdit={navigateToNpcCreatureEdit}
              onNavigateToCharacterEditor={() => handleNavigate('character-editor')}
            />
          </LazyView>
        );
      case 'profile':
        return (
          <LazyView>
            <Profile />
          </LazyView>
        );
      case 'join':
        return (
          <LazyView>
            <ProjectJoin
              onBack={() => handleNavigate('dashboard')}
              onNavigate={handleNavigate}
            />
          </LazyView>
        );
      case 'session-join':
        return (
          <LazyView>
            <SessionJoin
              onBack={() => handleNavigate('dashboard')}
              onJoinAsGM={(sessionId, meta) => {
                const decision = resolveCanonicalLobbyEntry({
                  role: 'gamemaster',
                  sagaPublicId: meta?.sagaPublicId ?? null,
                  sessionPublicId: meta?.sessionPublicId ?? null,
                });
                if (decision.kind === 'lobby') {
                  navigateToSessionPhase(
                    decision.sagaPublicId,
                    decision.sessionPublicId,
                    'lobby',
                  );
                  return;
                }
                // Fallback: legacy live if lobby IDs incomplete (should be rare)
                const live = resolveCanonicalLiveEntry({
                  role: 'gamemaster',
                  sagaPublicId: meta?.sagaPublicId ?? null,
                  sessionPublicId: meta?.sessionPublicId ?? null,
                });
                if (live.kind === 'live') {
                  navigateToSessionLive(
                    live.sagaPublicId,
                    live.sessionPublicId,
                    live.liveView,
                  );
                  return;
                }
                console.warn(
                  '[app] GM join missing public IDs; staying on session-join',
                  {
                    sessionId,
                    reason:
                      decision.kind === 'unauthorized'
                        ? decision.reason
                        : 'lobby_unavailable',
                  },
                );
              }}
              onJoinAsPlayer={(sessionId, code, meta) => {
                const decision = resolveCanonicalLobbyEntry({
                  role: 'player',
                  sagaPublicId: meta?.sagaPublicId ?? null,
                  sessionPublicId: meta?.sessionPublicId ?? null,
                });
                if (decision.kind === 'lobby') {
                  navigateToSessionPhase(
                    decision.sagaPublicId,
                    decision.sessionPublicId,
                    'lobby',
                  );
                  return;
                }
                const live = resolveCanonicalLiveEntry({
                  role: 'player',
                  sagaPublicId: meta?.sagaPublicId ?? null,
                  sessionPublicId: meta?.sessionPublicId ?? null,
                });
                if (live.kind === 'live') {
                  assertPlayerNotRoutedToGamemaster('player', live.liveView);
                  navigateToSessionLive(
                    live.sagaPublicId,
                    live.sessionPublicId,
                    live.liveView,
                    meta?.characterPublicId ?? undefined,
                  );
                  return;
                }
                console.warn(
                  '[app] player join missing public IDs; staying on session-join',
                  { sessionId, code },
                );
              }}
              onNavigateToCharacterEditor={() => handleNavigate('character-editor')}
            />
          </LazyView>
        );
      case 'session-invite':
        return (
          <LazyView>
            <SessionInviteResolve
              onNavigate={handleNavigate}
              onNavigateHome={() => handleNavigate('dashboard')}
            />
          </LazyView>
        );
      case 'rulesets-test':
        return (
          <LazyView>
            <RulesetsTest />
          </LazyView>
        );
      case 'item-create':
        return (
          <ItemWorkbenchScreen
            key={createTypeSlug ?? 'picker'}
            route="create"
            createTypeSlug={createTypeSlug}
            onBack={() => handleNavigate('library')}
            onNavigateToItem={(id) => navigateToItem(id, { replace: true })}
            onNavigateToCreateType={(slug) => navigateToItemCreateType(slug, { replace: true })}
          />
        );
      case 'item-detail':
        return (
          <ItemWorkbenchScreen
            route="detail"
            itemId={itemId}
            onBack={() => handleNavigate('library')}
            onNavigateToItem={(id) => navigateToItem(id, { replace: true })}
          />
        );
      case 'look-create':
        return (
          <LookCreateScreen
            onBack={() => handleNavigate('library')}
            onCreated={(id) => navigateToLookEdit(id, { replace: true })}
          />
        );
      case 'look-edit':
        return (
          <LookEditScreen
            key={lookId ?? 'missing'}
            lookId={lookId ?? ''}
            onBack={() => {
              const returnPath = takeLookEditorReturnPath();
              handleNavigate(returnPath ?? 'library');
            }}
            onNavigateToLookEdit={(id) => navigateToLookEdit(id, { replace: true })}
          />
        );
      case 'npc-creature-create':
        return (
          <NpcCreatureCreateScreen
            onBack={() => handleNavigate('library')}
            onCreated={(id) => navigateToNpcCreatureEdit(id, { replace: true })}
            onNavigateToCharacterEditor={() => handleNavigate('character-editor')}
          />
        );
      case 'npc-creature-edit':
        return (
          <NpcCreatureEditorScreen
            key={npcCreatureDefinitionId ?? 'missing'}
            definitionId={npcCreatureDefinitionId ?? ''}
            onBack={() => handleNavigate('library')}
          />
        );
      case 'world-atlas':
        return (
          <WorldAtlasScreen
            key={worldPublicId ?? 'missing'}
            worldPublicId={worldPublicId ?? ''}
            onBack={() => handleNavigate('/library/worlds')}
          />
        );
      case 'saga-list':
        return (
          <SagaResourceScreen
            mode="list"
            onNavigateHome={() => handleNavigate('dashboard')}
            onNavigate={handleNavigate}
          />
        );
      case 'saga-new':
        return (
          <SagaResourceScreen
            mode="new"
            onNavigateHome={() => handleNavigate('dashboard')}
            onNavigate={handleNavigate}
          />
        );
      case 'saga-section':
        return (
          <SagaResourceScreen
            mode="section"
            sagaPublicId={route.kind === 'saga-section' ? route.sagaPublicId : null}
            section={route.kind === 'saga-section' ? route.section : 'overview'}
            onNavigateHome={() => handleNavigate('dashboard')}
            onNavigate={handleNavigate}
          />
        );
      case 'saga-definition-create':
        return (
          <SagaEditorScreen
            mode="create"
            sagaId={null}
            onBack={() => handleNavigate('library')}
            onNavigateToEditor={(id) => navigateToSagaDefinitionEdit(id, { replace: true })}
          />
        );
      case 'saga-definition-edit':
        return (
          <SagaEditorScreen
            key={sagaDefinitionId ?? 'missing'}
            mode="edit"
            sagaId={sagaDefinitionId}
            onBack={() => handleNavigate('library')}
            onNavigateToEditor={(id) => navigateToSagaDefinitionEdit(id, { replace: true })}
          />
        );
      case 'session-phase':
        return route.kind === 'session-phase' ? (
          <SessionResourceScreen
            sagaPublicId={route.sagaPublicId}
            sessionPublicId={route.sessionPublicId}
            phase={route.phase}
            onNavigateHome={() => handleNavigate('dashboard')}
            onNavigate={handleNavigate}
          />
        ) : null;
      case 'session-live':
        return route.kind === 'session-live' ? (
          <SessionResourceScreen
            sagaPublicId={route.sagaPublicId}
            sessionPublicId={route.sessionPublicId}
            liveView={route.liveView}
            characterPublicId={route.characterPublicId}
            onNavigateHome={() => handleNavigate('dashboard')}
            onNavigate={handleNavigate}
          />
        ) : null;
      case 'download':
        // Prefer PublicAppGate for unauthenticated visits; keep parity if routed in-shell.
        return <DownloadScreen />;
      case 'not-found':
        return (
          <NotFoundPlaceholder
            attemptedPath={route.kind === 'not-found' ? route.attemptedPath : '/'}
            onHome={() => handleNavigate('dashboard')}
          />
        );
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <Layout currentView={layoutView} onNavigate={handleNavigate}>
      {renderView()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <PublicAppGate>
          <AuthGate>
            <AppShell />
          </AuthGate>
        </PublicAppGate>
        <Toaster />
      </ThemeProvider>
    </AuthProvider>
  );
}
