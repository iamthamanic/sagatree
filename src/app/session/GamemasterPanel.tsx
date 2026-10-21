/**
 * GamemasterPanel — GM vertical slice with production-honest controls (#201/#300/#493).
 * Location: src/app/session/GamemasterPanel.tsx
 *
 * No unmarked demo roster, no no-op primary CTAs. Deferred tools are disabled + labeled.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../shared/ui/card';
import { Button } from '../../shared/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../shared/ui/tabs';
import {
  SpeakerHigh
} from '@phosphor-icons/react';
import { useAuth } from '../../lib/auth-context';
import { useProjectSummaries } from '../project';
import { AdventureNpcCreatureInstancesPanel } from './AdventureNpcCreatureInstancesPanel';
import { SessionAvatarStrip } from './SessionAvatarStrip';
import { PlayerAvatarPanel } from '../character';
import { createCharacterStudioAvatar } from '../../domains/character/use-cases/avatar-presets';
import { SharedSceneGmControls } from './SharedSceneGmControls';
import { ProgramGmControls } from './program/ProgramGmControls';
import { KnowledgeGmControls } from './knowledge/KnowledgeGmControls';
import { KnowledgeFeed } from './knowledge/KnowledgeFeed';
import { CombatEncounterGmPanel } from './CombatEncounterGmPanel';
import { useSharedScenePresentation } from './hooks/useSharedScenePresentation';
import { useProgramPresentation } from './hooks/useProgramPresentation';
import { useSessionKnowledge } from './hooks/useSessionKnowledge';
import { useCombatEncounter } from './hooks/useCombatEncounter';
import { GM_DEFERRED_CONTROL_HINT_DE } from '../../domains/session/contracts/production-ux-integrity';

type GamemasterPanelProps = {
  sagaPublicId?: string | null;
  sessionPublicId?: string | null;
};

export function GamemasterPanel({
  sagaPublicId = null,
  sessionPublicId = null,
}: GamemasterPanelProps) {
  const { user } = useAuth();
  const { projects } = useProjectSummaries({ enabled: true });
  const gmProjects = projects.filter(
    (project) => user !== null && project.gmUserId === user.id,
  );
  const sceneRuntime =
    sagaPublicId && sessionPublicId
      ? { sagaPublicId, sessionPublicId }
      : null;
  const sharedScene = useSharedScenePresentation({
    sagaPublicId: sceneRuntime?.sagaPublicId ?? '',
    sessionPublicId: sceneRuntime?.sessionPublicId ?? '',
  });
  const program = useProgramPresentation({
    sagaPublicId: sceneRuntime?.sagaPublicId ?? '',
    sessionPublicId: sceneRuntime?.sessionPublicId ?? '',
  });
  const knowledge = useSessionKnowledge({
    sagaPublicId: sceneRuntime?.sagaPublicId ?? '',
    sessionPublicId: sceneRuntime?.sessionPublicId ?? '',
    access: { role: 'gamemaster', capabilities: [], characterId: null },
  });
  const combat = useCombatEncounter({
    sagaPublicId: sceneRuntime?.sagaPublicId ?? '',
    sessionPublicId: sceneRuntime?.sessionPublicId ?? '',
  });
  const activeProjectId = gmProjects[0]?.id ?? null;
  const showDevAvatarPreview = import.meta.env.DEV === true;
  const sessionDemoAvatar = showDevAvatarPreview
    ? createCharacterStudioAvatar({
        race: 'human',
        hairStyle: 'short',
        clothing: 'casual',
        hairColor: '#3B2F2F',
        skinTone: '#F5E6D3',
        bodySize: 50,
        height: 50,
      })
    : null;
  const sessionDemoRef = {
    characterId: 'dev-session-player-preview',
    displayName: 'DEV · Avatar-Vorschau',
  };

  const rosterCharacters = combat.roster
    .filter((r) => Boolean(r.characterId || r.userId))
    .slice(0, 8)
    .map((r) => ({
      characterId: r.characterId ?? r.userId,
      displayName: r.characterId
        ? `PC ${r.characterId.slice(0, 8)}`
        : `User ${r.userId.slice(0, 8)}`,
    }));

  return (
    <div className="w-full h-full overflow-y-auto" data-gm-panel="v2" data-au-surface="gamemaster-panel">
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-4 md:space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl">Gamemaster Panel</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Steuere dein Abenteuer über Live-Session-Routen
          </p>
        </div>

        <Card data-gm-storytelling-deferred>
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-lg">Erzählung & KI-Visualisierung</CardTitle>
            <CardDescription className="text-xs md:text-sm">
              {GM_DEFERRED_CONTROL_HINT_DE}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Gemeinsame Szene, Program Output und Knowledge steuerst du im Tab „Szenen“,
              sobald eine Live-Session über die Saga-Route geöffnet ist.
            </p>
            <Button type="button" disabled title={GM_DEFERRED_CONTROL_HINT_DE} data-gm-scene-generate-deferred>
              Szene generieren (nicht verfügbar)
            </Button>
          </CardContent>
        </Card>

        {showDevAvatarPreview && sessionDemoAvatar ? (
          <Card data-gm-dev-avatar-preview>
            <CardHeader className="pb-3">
              <CardTitle className="text-base md:text-lg">DEV · Avatar-Vorschau</CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Nur im Development-Build sichtbar — kein Produktions-Roster.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PlayerAvatarPanel surfaceRef={sessionDemoRef} avatar={sessionDemoAvatar} />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent className="pt-4 md:pt-6">
            <Tabs defaultValue="npcs">
              <TabsList className="grid w-full grid-cols-4 h-auto">
                <TabsTrigger value="npcs" className="text-xs md:text-sm py-2" data-gm-tab-npcs>
                  NPCs
                </TabsTrigger>
                <TabsTrigger value="combat" className="text-xs md:text-sm py-2" data-gm-tab-combat>
                  Kampf
                </TabsTrigger>
                <TabsTrigger value="scenes" className="text-xs md:text-sm py-2" data-gm-tab-scenes>
                  Szenen
                </TabsTrigger>
                <TabsTrigger value="characters" className="text-xs md:text-sm py-2" data-gm-tab-characters>
                  Chars
                </TabsTrigger>
              </TabsList>

              <TabsContent value="npcs" className="space-y-3 md:space-y-4">
                <div>
                  <h4 className="mb-3 text-sm md:text-base">NPCs & Kreaturen im Abenteuer</h4>
                  <AdventureNpcCreatureInstancesPanel gmProjects={gmProjects} />
                </div>
              </TabsContent>

              <TabsContent value="combat" className="space-y-3 md:space-y-4">
                {sceneRuntime ? (
                  <CombatEncounterGmPanel
                    projectId={activeProjectId}
                    roster={combat.roster}
                    encounter={combat.encounter}
                    combatActive={combat.combatActive}
                    isBusy={combat.isBusy || combat.isLoading}
                    error={combat.error}
                    sessionId={combat.sessionId}
                    access={{ role: 'gamemaster', capabilities: [], characterId: null }}
                    onStart={async (participants) =>
                      combat.runCombat({ action: 'start', participants })
                    }
                    onEnd={async () => combat.runCombat({ action: 'end' })}
                    onNextTurn={async () => combat.runCombat({ action: 'nextTurn' })}
                    onDamage={async (participantId, amount, mode) =>
                      combat.applyDamage({ participantId, amount, mode })
                    }
                    onCondition={async (participantId, op, condition) =>
                      combat.applyCondition({ participantId, op, condition })
                    }
                    onSpendAction={async (participantId, slot) =>
                      combat.runCombat({ action: 'spendAction', participantId, slot })
                    }
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Öffne die Live-Session über die Saga-Route, um den Kampf zu steuern.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="scenes" className="space-y-3 md:space-y-4">
                {sceneRuntime ? (
                  <>
                    <SharedSceneGmControls
                      presentation={sharedScene.presentation}
                      isBusy={sharedScene.isPublishing || sharedScene.isLoading}
                      error={sharedScene.error}
                      onPublish={sharedScene.publishScene}
                    />
                    <ProgramGmControls
                      isSwitching={program.isSwitching}
                      onSwitch={program.switchProgram}
                    />
                    <KnowledgeGmControls
                      isBusy={knowledge.isRevealing || knowledge.isLoading}
                      onReveal={knowledge.reveal}
                    />
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Knowledge (GM)</h4>
                      <KnowledgeFeed projection={knowledge.projection} />
                    </div>
                  </>
                ) : (
                  <div>
                    <h4 className="mb-3 text-sm md:text-base">Szenen-Steuerung</h4>
                    <p className="text-sm text-muted-foreground">
                      Öffne die Live-Session über die Saga-Route, um die gemeinsame Szene zu
                      steuern.
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="characters" className="space-y-3 md:space-y-4">
                <div data-gm-characters-roster>
                  <h4 className="mb-3 text-sm md:text-base">Spieler-Charaktere</h4>
                  {rosterCharacters.length > 0 ? (
                    <SessionAvatarStrip characters={rosterCharacters} />
                  ) : (
                    <p className="text-sm text-muted-foreground" data-gm-characters-empty>
                      Keine Spieler-Charaktere geladen. Öffne eine Live-Session mit Roster —
                      Demo-Charaktere werden nicht angezeigt.
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card data-gm-objects-sound-deferred>
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-lg">Objekte & Soundscapes</CardTitle>
            <CardDescription className="text-xs md:text-sm">
              {GM_DEFERRED_CONTROL_HINT_DE}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="mb-2 text-sm font-medium">Objekt-Templates</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                {['Lagerfeuer', 'Schwert', 'Altar', 'Truhe', 'Portal', 'Schatz'].map((obj) => (
                  <Button
                    key={obj}
                    type="button"
                    variant="outline"
                    className="h-16 md:h-20 text-xs md:text-sm"
                    size="sm"
                    disabled
                    title={GM_DEFERRED_CONTROL_HINT_DE}
                    data-gm-object-deferred={obj}
                  >
                    {obj}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-medium">Soundscapes</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                {['Wald', 'Kampf', 'Mystisch', 'Taverne', 'Gewitter', 'Episch'].map((sound) => (
                  <Button
                    key={sound}
                    type="button"
                    variant="outline"
                    className="h-14 md:h-16 flex-col gap-1 md:flex-row md:gap-2"
                    size="sm"
                    disabled
                    title={GM_DEFERRED_CONTROL_HINT_DE}
                    data-gm-sound-deferred={sound}
                  >
                    <SpeakerHigh className="w-4 h-4" />
                    <span className="text-xs md:text-sm">{sound}</span>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
