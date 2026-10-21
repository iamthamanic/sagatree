/**
 * ProjectJoin — Join an existing Saga by invite code (#489).
 * Location: src/app/project/ProjectJoin.tsx
 *
 * Create/open journeys use /sagas and /sagas/new. This surface is join-only.
 * Internal domain remains project-service / projects table.
 */
import { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  SignIn,
  Plus
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../shared/ui/card';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Label } from '../../shared/ui/label';
import { AdaptivePage } from '../../shared/ui/adaptive';
import { pathForSagaNew, pathForSagaSection } from '../shell';
import { projectService } from '../../infrastructure/project/project-service';
import { ENTITY_CACHE_KEYS, entityCache } from '../../lib/entityCache';
import { useProjectSummaries } from './hooks/useProjectSummaries';

interface ProjectJoinProps {
  onBack: () => void;
  onNavigate: (view: string) => void;
}

export function ProjectJoin({ onBack, onNavigate }: ProjectJoinProps) {
  const { projects, isLoading, refreshProjects } = useProjectSummaries({ enabled: true });
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const activeSagas = projects.filter((p) => p.status === 'active');

  const openSaga = (publicId: string | null | undefined) => {
    const id = publicId?.trim();
    if (!id) {
      toast.error('Diese Saga hat keine Public ID.');
      return;
    }
    onNavigate(pathForSagaSection(id, 'overview'));
  };

  const handleJoinSaga = async () => {
    if (!joinCode.trim()) {
      toast.error('Bitte gib einen Beitrittscode ein');
      return;
    }

    setIsJoining(true);
    try {
      const saga = await projectService.joinProject({ code: joinCode.trim() });
      entityCache.invalidate(ENTITY_CACHE_KEYS.projectSummaries);
      void refreshProjects();
      toast.success(`Saga „${saga.name}“ beigetreten!`, { duration: 5000 });
      setJoinCode('');
      const publicId = saga.publicId?.trim();
      if (publicId) {
        onNavigate(pathForSagaSection(publicId, 'overview'));
        return;
      }
      toast.error('Beigetreten, aber ohne Public ID — öffne die Saga über die Liste.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler beim Beitreten');
    } finally {
      setIsJoining(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedCode(code);
      toast.success('Code kopiert!');
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
      toast.info(`Code: ${code}`, {
        duration: 5000,
        description: 'Manuell kopieren (Clipboard API nicht verfügbar)',
      });
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  return (
    <AdaptivePage data-au-surface="saga-join" className="h-full w-full">
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
        <Button variant="ghost" onClick={onBack} className="min-h-11">
          <ArrowLeft className="mr-2 size-4" />
          Zurück
        </Button>

        <div>
          <h1 className="mb-2 text-2xl md:text-3xl">Saga beitreten</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Mit einem Einladungscode einer bestehenden Saga beitreten. Neue Sagas erstellst du unter
            „Saga erstellen“.
          </p>
        </div>

        <Card data-saga-join-panel>
          <CardHeader>
            <CardTitle>Mit Code beitreten</CardTitle>
            <CardDescription>Gib den 6-stelligen Code ein, den dir der Gamemaster geteilt hat.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="saga-join-code">Beitrittscode</Label>
              <Input
                id="saga-join-code"
                className="min-h-11"
                placeholder="ABC123"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleJoinSaga();
                }}
                maxLength={6}
                disabled={isJoining}
                data-saga-join-code
              />
            </div>
            <Button
              onClick={() => void handleJoinSaga()}
              disabled={isJoining}
              className="min-h-11 w-full"
              data-saga-join-submit
            >
              <SignIn className="mr-2 size-4" />
              {isJoining ? 'Trete bei…' : 'Beitreten'}
            </Button>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="min-h-11"
            onClick={() => onNavigate(pathForSagaNew())}
            data-saga-join-create-cta
          >
            <Plus className="mr-2 size-4" />
            Saga erstellen
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Lade deine Sagas…</p>
        ) : null}

        {!isLoading && activeSagas.length > 0 ? (
          <div data-saga-join-list>
            <h2 className="mb-4 text-xl">Deine Sagas</h2>
            <div className="grid gap-4">
              {activeSagas.map((saga) => (
                <Card key={saga.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="truncate">{saga.name}</CardTitle>
                        <CardDescription>
                          {saga.description || 'Keine Beschreibung'}
                          {saga.publicId ? ` · ${saga.publicId}` : ''}
                        </CardDescription>
                      </div>
                      {saga.code ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-11 shrink-0"
                          onClick={() => void handleCopyCode(saga.code)}
                        >
                          {copiedCode === saga.code ? (
                            <Check className="mr-2 size-4" />
                          ) : (
                            <Copy className="mr-2 size-4" />
                          )}
                          {saga.code}
                        </Button>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {saga.memberCount} Mitglieder · {saga.sessionCount} Sessions
                    </span>
                    <Button
                      className="min-h-11"
                      onClick={() => openSaga(saga.publicId)}
                      data-saga-join-open={saga.publicId}
                    >
                      Öffnen
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </AdaptivePage>
  );
}
