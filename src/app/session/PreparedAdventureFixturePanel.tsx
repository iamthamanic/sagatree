/**
 * PreparedAdventureFixturePanel — One-click player-test adventure prepare (#302).
 * Location: src/app/session/PreparedAdventureFixturePanel.tsx
 * Lists fixture pregens/NPCs/beats and spawns NPC instances for a selected project (GM).
 */
import { useEffect, useState } from 'react';
import {
  CircleNotch,
  Sparkle,
  UserPlus
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from '../../shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../shared/ui/card';
import { Label } from '../../shared/ui/label';
import {
  assertPreparedAdventureFixtureIntegrity,
  getPreparedAdventureFixture,
  listPreparedAdventureNpcSpawnPlan,
  listPreparedAdventurePregens,
  VOICE_VIDEO_EXTERNAL_NOTE,
  type PreparedAdventurePregenDescriptor,
} from '../../domains/session/contracts/prepared-adventure-fixture';
import { projectService } from '../../infrastructure/project/project-service';
import { spawnNpcCreatureInstance } from '../../infrastructure/npc-creature/npc-creature-service';
import { useProjectSummaries } from '../project';
import { useWorldProfiles } from '../world';
import { setCharacterEditorBootstrap } from '../character';

type PreparedAdventureFixturePanelProps = {
  /** Prefill project when opened from a saga context. */
  initialProjectId?: string | null;
  onNavigateToCharacterEditor?: () => void;
};

export function PreparedAdventureFixturePanel({
  initialProjectId = null,
  onNavigateToCharacterEditor,
}: PreparedAdventureFixturePanelProps) {
  const fixture = getPreparedAdventureFixture();
  const pregens = listPreparedAdventurePregens();
  const npcPlan = listPreparedAdventureNpcSpawnPlan();
  const { projects } = useProjectSummaries({ enabled: true });
  const { worlds } = useWorldProfiles({ enabled: true });
  const gmProjects = projects.filter(
    (project) => project.status === 'active' || project.status === 'paused',
  );
  const [projectId, setProjectId] = useState(initialProjectId ?? '');
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    if (initialProjectId) setProjectId(initialProjectId);
  }, [initialProjectId]);

  const selectedProject =
    gmProjects.find((project) => project.id === projectId) ?? null;

  const handleAdoptPregen = (pregen: PreparedAdventurePregenDescriptor) => {
    setCharacterEditorBootstrap({
      kind: 'fixture-seed',
      characterName: pregen.displayName,
      level: pregen.level,
      classLabel: pregen.classLabel,
    });
    toast.success(`${pregen.displayName} (Stufe ${pregen.level}) — Editor öffnen.`);
    onNavigateToCharacterEditor?.();
  };

  const handlePrepare = async () => {
    if (!projectId) {
      toast.error('Bitte wähle ein Abenteuer (Projekt) aus.');
      return;
    }
    setPreparing(true);
    try {
      assertPreparedAdventureFixtureIntegrity(fixture);

      let project = await projectService.getProjectById(projectId);
      if (!project.worldProfileId) {
        const fallbackWorld = worlds[0] ?? null;
        if (!fallbackWorld) {
          toast.error(
            'Kein Weltprofil gefunden. Lege zuerst ein Weltprofil an und binde es beim Projekterstellen.',
          );
          return;
        }
        project = await projectService.updateProjectWorldProfile(projectId, fallbackWorld.id);
        toast.message(`Weltprofil „${fallbackWorld.name}“ an Abenteuer gebunden.`);
      }

      const activeMemberUserIds = project.members
        .filter((member) => member.status === 'active')
        .map((member) => member.userId);

      let spawned = 0;
      for (const entry of npcPlan) {
        await spawnNpcCreatureInstance({
          projectId,
          definitionId: entry.definitionId,
          instanceKind: entry.instanceKind,
          displayName: entry.displayName,
          activeMemberUserIds,
        });
        spawned += 1;
      }

      toast.success(
        `Player-Test-Abenteuer vorbereitet: ${spawned} NSC-Instanzen für „${project.name}“.`,
      );
    } catch (err) {
      console.error('Prepare fixture failed:', err);
      toast.error(
        err instanceof Error ? err.message : 'Abenteuer konnte nicht vorbereitet werden.',
      );
    } finally {
      setPreparing(false);
    }
  };

  return (
    <Card data-prepared-adventure-fixture="v1" data-dev-only-fixture="true">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <Sparkle className="size-5" aria-hidden="true" />
          DEV · {fixture.adventureName}
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Expliziter Developer-/Player-Test-Kontext — nicht Teil der normalen Session-Erstellung.{' '}
          {fixture.adventureDescription}
          {' '}
          Pack:
          {' '}
          {fixture.worldModulePackId}
          {' '}
          · Stufe
          {' '}
          {fixture.level}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground" data-voice-video-note>
          {VOICE_VIDEO_EXTERNAL_NOTE}
        </p>

        <div className="space-y-2">
          <Label htmlFor="fixture-project">Abenteuer für Vorbereitung</Label>
          <select
            id="fixture-project"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            disabled={preparing}
            data-fixture-project-select
          >
            <option value="">Projekt wählen</option>
            {gmProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
                {project.worldProfileId ? '' : ' (ohne Weltprofil)'}
              </option>
            ))}
          </select>
          {selectedProject?.worldProfileId ? (
            <p className="text-xs text-muted-foreground">Weltprofil gebunden.</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Ohne Weltprofil wird beim Vorbereiten dein erstes Weltprofil gebunden (falls vorhanden).
            </p>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Pregens ({pregens.length})</h3>
          <ul className="space-y-2" data-fixture-pregens>
            {pregens.map((pregen) => (
              <li
                key={pregen.id}
                className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{pregen.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {pregen.classLabel}
                    {' '}
                    · Stufe
                    {' '}
                    {pregen.level}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 min-h-10"
                  onClick={() => handleAdoptPregen(pregen)}
                  data-fixture-adopt-pregen={pregen.id}
                >
                  <UserPlus className="mr-2 size-4" aria-hidden="true" />
                  Als Charakter übernehmen
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">NSC-Plan ({npcPlan.length})</h3>
          <ul className="list-inside list-disc text-xs text-muted-foreground" data-fixture-npc-plan>
            {npcPlan.map((entry) => (
              <li key={entry.id}>
                {entry.displayName}
                {' '}
                (
                {entry.definitionId}
                ,
                {' '}
                {entry.role}
                )
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Beats ({fixture.beats.length})</h3>
          <ol className="list-inside list-decimal text-xs text-muted-foreground" data-fixture-beats>
            {fixture.beats.map((beat) => (
              <li key={beat.id}>
                {beat.title}
                {' '}
                (
                {beat.kind}
                {beat.scenePresetId ? ` · ${beat.scenePresetId}` : ''}
                )
              </li>
            ))}
          </ol>
        </div>

        <Button
          type="button"
          className="w-full h-11 min-h-11"
          onClick={() => void handlePrepare()}
          disabled={preparing || !projectId}
          data-fixture-prepare
        >
          {preparing ? (
            <>
              <CircleNotch className="mr-2 size-4 animate-spin" aria-hidden="true" />
              Bereite vor…
            </>
          ) : (
            'Player-Test-Abenteuer vorbereiten'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
