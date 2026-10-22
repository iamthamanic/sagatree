/**
 * SessionJoin — Create/join play sessions via server-issued codes (#296 / #484 adaptive).
 * Location: src/app/session/SessionJoin.tsx
 *
 * Library → Teilnehmen may deep-link with:
 *   /session-join?project_id=<uuid>&saga=<SA-…>&intent=join
 * so the clicked adventure and participant intent are preserved.
 */
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../shared/ui/card';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Label } from '../../shared/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '../../shared/ui/select';
import {
  ArrowLeft,
  Users,
  GameController,
  CircleNotch,
  ClockCounterClockwise
} from '@phosphor-icons/react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../shared/ui/tabs';
import { AdaptiveJourneyColumn, AdaptivePage } from '../../shared/ui/adaptive';
import { useProjectSummaries } from '../project';
import { useCharacterSummaries } from '../character';
import { useSessions } from './hooks/useSessions';
import { SessionPastSessionsPanel } from './SessionPastSessionsPanel';
import { nextEpisodeSessionName } from '../../domains/session/contracts/session-episode-name';
import {
  assertOwnedCharacterId,
  resolveCharacterAssignmentPick,
} from '../../domains/session/contracts/player-character-assignment';
import { toast } from 'sonner';
import { useAuth } from '../../lib/auth-context';

type SessionJoinTab = 'create' | 'join' | 'past';

function parseSessionJoinTab(value: string): SessionJoinTab {
  if (value === 'join' || value === 'past') return value;
  return 'create';
}

export type SessionJoinSurfaceMeta = {
  sagaPublicId: string | null;
  sessionPublicId: string | null;
  characterPublicId?: string | null;
};

interface SessionJoinProps {
  onBack: () => void;
  onJoinAsGM: (sessionId: string, meta?: SessionJoinSurfaceMeta) => void;
  onJoinAsPlayer: (sessionId: string, code: string, meta?: SessionJoinSurfaceMeta) => void;
  onNavigateToCharacterEditor?: () => void;
}

function readSessionJoinSearch() {
  if (typeof window === 'undefined') {
    return { projectId: '', sagaPublicId: '', intentJoin: false };
  }
  const params = new URLSearchParams(window.location.search);
  const intent = (params.get('intent') || '').toLowerCase();
  return {
    projectId: params.get('project_id') || params.get('adventure_id') || '',
    sagaPublicId: (params.get('saga') || params.get('saga_public_id') || '').trim().toUpperCase(),
    intentJoin: intent === 'join' || intent === 'participant' || intent === 'teilnehmen',
  };
}

export function SessionJoin({
  onBack,
  onJoinAsGM,
  onJoinAsPlayer,
  onNavigateToCharacterEditor,
}: SessionJoinProps) {
  const initialSearch = readSessionJoinSearch();
  const [sessionCode, setSessionCode] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(initialSearch.projectId);
  const [sagaPublicId, setSagaPublicId] = useState(initialSearch.sagaPublicId);
  const [activeTab, setActiveTab] = useState<SessionJoinTab>(
    initialSearch.intentJoin ? 'join' : 'create',
  );
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('');
  const [sessionName, setSessionName] = useState('');
  const [sessionNameDirty, setSessionNameDirty] = useState(false);

  const { user } = useAuth();
  const { sessions, isLoading: sessionsLoading, createSession, joinSession } = useSessions();
  const { projects } = useProjectSummaries({ enabled: true });
  const { characters, isLoading: charactersLoading } = useCharacterSummaries({ enabled: true });
  const assignable = characters
    .filter((c) => Boolean(c.id) && Boolean(c.publicId))
    .map((c) => ({
      id: c.id,
      publicId: c.publicId ?? null,
      name: c.name || 'Charakter',
    }));
  const pick = resolveCharacterAssignmentPick({ owned: assignable });
  const gmProjects = projects.filter(
    (project) => project.status === 'active' || project.status === 'paused',
  );
  const selectedProject = gmProjects.find((project) => project.id === selectedProjectId) ?? null;
  const sagaNameByProjectId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const project of projects) {
      map[project.id] = project.name;
    }
    return map;
  }, [projects]);
  const suggestedSessionName = useMemo(() => {
    if (!selectedProject) return '';
    const namesForSaga = sessions
      .filter((session) => session.projectId === selectedProject.id)
      .map((session) => session.name);
    return nextEpisodeSessionName(selectedProject.name, namesForSaga);
  }, [selectedProject, sessions]);

  useEffect(() => {
    const next = readSessionJoinSearch();
    if (next.projectId) {
      setSelectedProjectId(next.projectId);
      setSessionNameDirty(false);
    }
    if (next.sagaPublicId) setSagaPublicId(next.sagaPublicId);
    if (next.intentJoin) setActiveTab('join');
  }, []);

  useEffect(() => {
    if (selectedProjectId || gmProjects.length === 0) return;
    const dornhain =
      gmProjects.find((p) => p.sagaOrigin === 'native' && /dornhain/i.test(p.name))
      ?? gmProjects.find((p) => p.sagaOrigin === 'native')
      ?? gmProjects[0];
    setSelectedProjectId(dornhain.id);
    setSessionNameDirty(false);
  }, [gmProjects, selectedProjectId]);

  useEffect(() => {
    if (sessionNameDirty || !suggestedSessionName) return;
    setSessionName(suggestedSessionName);
  }, [suggestedSessionName, sessionNameDirty]);

  useEffect(() => {
    if (!selectedProjectId) return;
    const match = projects.find((project) => project.id === selectedProjectId);
    if (match?.publicId) setSagaPublicId(match.publicId.trim().toUpperCase());
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (pick.kind === 'single') {
      setSelectedCharacterId(pick.character.id);
    } else if (pick.kind === 'choose' && !selectedCharacterId) {
      setSelectedCharacterId(pick.characters[0]?.id ?? '');
    }
  }, [pick, selectedCharacterId]);

  const resolveSurfaceMeta = (session: {
    publicId: string | null;
    projectId: string | null;
  }): SessionJoinSurfaceMeta => {
    // Prefer the session's project — create-form / URL saga selection must not
    // override participant routing for a different joined session (P1).
    const fromSessionProject = session.projectId
      ? projects.find((project) => project.id === session.projectId)?.publicId
      : null;
    return {
      sagaPublicId:
        (fromSessionProject || sagaPublicId || '').trim().toUpperCase() || null,
      sessionPublicId: session.publicId ? session.publicId.trim().toUpperCase() : null,
    };
  };

  const handleCreateSession = async () => {
    if (!selectedProjectId || !selectedProject) {
      toast.error('Bitte wähle eine Saga aus');
      return;
    }
    const nameToCreate =
      sessionName.trim() ||
      suggestedSessionName ||
      nextEpisodeSessionName(selectedProject.name, []);
    if (!nameToCreate.trim()) {
      toast.error('Bitte gib einen Session-Namen ein');
      return;
    }

    setIsCreating(true);
    try {
      const session = await createSession({
        name: nameToCreate,
        project_id: selectedProjectId,
      });

      if (session) {
        toast.success('Session erstellt — Lobby öffnet…');
        // Direct lobby entry: join code lives on the lobby surface (no interstitial).
        onJoinAsGM(session.id, resolveSurfaceMeta(session));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Erstellen der Session';
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  const resolveSelectedCharacter = () => {
    if (pick.kind === 'none') {
      throw new Error(pick.reason);
    }
    const characterId =
      pick.kind === 'single' ? pick.character.id : selectedCharacterId;
    if (!characterId) {
      throw new Error('Bitte wähle einen Charakter');
    }
    assertOwnedCharacterId(
      assignable.map((c) => c.id),
      characterId,
    );
    const option = assignable.find((c) => c.id === characterId);
    if (!option?.publicId) {
      throw new Error('Charakter hat keine Public ID');
    }
    return option;
  };

  const handleJoinSession = async () => {
    if (sessionCode.length < 6) {
      toast.error('Bitte gib einen gültigen 6-stelligen Code ein');
      return;
    }

    setIsJoining(true);
    try {
      const character = resolveSelectedCharacter();
      const session = await joinSession({
        code: sessionCode,
        character_id: character.id,
      });

      if (session) {
        toast.success(`Mit ${character.name} beigetreten!`);
        onJoinAsPlayer(session.id, session.code, {
          ...resolveSurfaceMeta(session),
          characterPublicId: character.publicId,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Session nicht gefunden oder Fehler beim Beitreten';
      toast.error(message);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <AdaptivePage data-au-surface="session-join" className="h-full w-full">
      <AdaptiveJourneyColumn className="space-y-4 md:space-y-6">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="mb-2 min-h-11"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück
        </Button>

        {/* Header */}
        <div>
          <h1 className="text-xl md:text-2xl">Session</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Session hosten, beitreten oder vergangene Episoden öffnen
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(parseSessionJoinTab(v))}
          className="w-full"
        >
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 p-1">
            <TabsTrigger value="create" className="min-h-11 px-2" data-session-join-tab="create">
              <GameController className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Session erstellen</span>
              <span className="sm:hidden">Erstellen</span>
            </TabsTrigger>
            <TabsTrigger value="join" className="min-h-11 px-2" data-session-join-tab="join">
              <Users className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Session beitreten</span>
              <span className="sm:hidden">Beitreten</span>
            </TabsTrigger>
            <TabsTrigger value="past" className="min-h-11 px-2" data-session-join-tab="past">
              <ClockCounterClockwise className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Vergangene Sessions</span>
              <span className="sm:hidden">Vergangen</span>
            </TabsTrigger>
          </TabsList>

          {/* Create Session — success lands in Lobby (code shown there). */}
          <TabsContent value="create" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base md:text-lg">Neue Session erstellen</CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    Nach dem Erstellen öffnet sich die Lobby. Dort teilst du den Session-Code.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="project">Saga *</Label>
                    <Select
                      value={selectedProjectId || undefined}
                      onValueChange={(value) => {
                        setSelectedProjectId(value);
                        setSessionNameDirty(false);
                      }}
                      disabled={isCreating || gmProjects.length === 0}
                    >
                      <SelectTrigger
                        id="project"
                        data-session-join-project
                        data-selected-project={selectedProjectId || ''}
                        className="min-h-11 w-full justify-between gap-3 pr-3 text-sm md:text-base *:data-[slot=select-value]:line-clamp-none"
                        aria-label="Saga wählen"
                      >
                        <SelectValue placeholder="Saga wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {gmProjects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            <SelectItemText>
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate font-medium">{project.name}</span>
                                {project.publicId ? (
                                  <span className="shrink-0 text-muted-foreground">
                                    ({project.publicId})
                                  </span>
                                ) : null}
                              </span>
                            </SelectItemText>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {gmProjects.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Erstelle zuerst eine Saga, um eine Session zu starten.
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="session-name">Session Name</Label>
                    <Input
                      id="session-name"
                      value={sessionName}
                      onChange={(e) => {
                        setSessionNameDirty(true);
                        setSessionName(e.target.value);
                      }}
                      placeholder={suggestedSessionName || 'z.B. Dornhain Saga E001'}
                      className="text-sm md:text-base font-medium"
                      disabled={isCreating || !selectedProjectId}
                      data-session-auto-name
                      aria-describedby="session-name-hint"
                    />
                    <p id="session-name-hint" className="text-xs text-muted-foreground">
                      Vorschlag: Saga-Name + Episode (E001, E002, …) — frei änderbar
                    </p>
                  </div>

                  <Button 
                    className="min-h-11 w-full" 
                    onClick={handleCreateSession}
                    disabled={!sessionName.trim() || !selectedProjectId || isCreating}
                  >
                    {isCreating ? (
                      <>
                        <CircleNotch className="w-4 h-4 mr-2 animate-spin" />
                        Erstelle...
                      </>
                    ) : (
                      'Session erstellen'
                    )}
                  </Button>
                </CardContent>
              </Card>
          </TabsContent>

          {/* Join Session */}
          <TabsContent value="join" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base md:text-lg">Session beitreten</CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Gib den Session-Code ein, den du vom GM erhalten hast
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Session Code</Label>
                  <Input
                    id="code"
                    placeholder="z.B. ABC123"
                    value={sessionCode}
                    onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="text-lg md:text-xl text-center font-mono tracking-wider"
                  />
                  <p className="text-xs text-muted-foreground">
                    6-stelliger Code vom Gamemaster
                  </p>
                </div>

                <div className="space-y-2" data-character-assignment="v1">
                  <Label htmlFor="join-character">Charakter</Label>
                  {charactersLoading ? (
                    <p className="text-xs text-muted-foreground">Charaktere werden geladen…</p>
                  ) : pick.kind === 'none' ? (
                    <div className="space-y-2">
                      <p className="text-sm text-destructive">{pick.reason}</p>
                      {onNavigateToCharacterEditor ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          onClick={onNavigateToCharacterEditor}
                        >
                          Charakter erstellen
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <select
                      id="join-character"
                      className="select select-bordered min-h-11 w-full"
                      value={selectedCharacterId}
                      onChange={(e) => setSelectedCharacterId(e.target.value)}
                      data-character-select
                      disabled={pick.kind === 'single'}
                    >
                      {(pick.kind === 'single'
                        ? [pick.character]
                        : pick.kind === 'choose'
                          ? pick.characters
                          : []
                      ).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <Button 
                  className="min-h-11 w-full" 
                  onClick={handleJoinSession}
                  disabled={
                    sessionCode.length < 6 ||
                    isJoining ||
                    pick.kind === 'none' ||
                    !selectedCharacterId
                  }
                  data-join-with-character
                >
                  {isJoining ? (
                    <>
                      <CircleNotch className="w-4 h-4 mr-2 animate-spin" />
                      Beitrete...
                    </>
                  ) : selectedCharacterId ? (
                    `Mit ${assignable.find((c) => c.id === selectedCharacterId)?.name ?? 'Charakter'} beitreten`
                  ) : (
                    'Als Spieler beitreten'
                  )}
                </Button>
              </CardContent>
            </Card>

          </TabsContent>

          <TabsContent value="past" className="space-y-4">
            <SessionPastSessionsPanel
              sessions={sessions}
              isLoading={sessionsLoading}
              currentUserId={user?.id ?? null}
              sagaNameByProjectId={sagaNameByProjectId}
              onOpenAsGm={(session) => {
                onJoinAsGM(session.id, resolveSurfaceMeta(session));
              }}
              onJoinAsPlayer={(session) => {
                void (async () => {
                  try {
                    const character = resolveSelectedCharacter();
                    const joined = await joinSession({
                      code: session.code,
                      character_id: character.id,
                    });
                    if (!joined) return;
                    onJoinAsPlayer(joined.id, joined.code, {
                      ...resolveSurfaceMeta(joined),
                      characterPublicId: character.publicId,
                    });
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : 'Beitritt fehlgeschlagen',
                    );
                  }
                })();
              }}
            />
          </TabsContent>
        </Tabs>
      </AdaptiveJourneyColumn>
    </AdaptivePage>
  );
}
