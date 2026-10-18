/**
 * SagaWorldMapPanel — Saga → Welt → Karte entry (#702).
 * Same WorldAtlasWorkbench as Library; no duplicate map rows.
 * Location: src/app/project/SagaWorldMapPanel.tsx
 *
 * Overview RPC is preferred for worldProfileId + GM flag. On cold miss / timeout,
 * fall back to the project row so Karte is not blanked by a hub refresh failure.
 */
import { useEffect, useState } from 'react';
import { Button } from '../../shared/ui/button';
import { projectService } from '../../infrastructure/project/project-service';
import { useSagaOverview } from './hooks/useSagaOverview';
import { WorldAtlasWorkbench } from '../world';
import { pathForLibraryTab } from '../shell';

export type SagaWorldMapPanelProps = {
  readonly sagaPublicId: string;
  readonly onNavigate: (view: string) => void;
};

export function SagaWorldMapPanel({ sagaPublicId, onNavigate }: SagaWorldMapPanelProps) {
  const { model, isLoading, error } = useSagaOverview({ sagaPublicId });
  const [fallbackWorldId, setFallbackWorldId] = useState<string | null>(null);
  const [resolvingFallback, setResolvingFallback] = useState(false);
  const [fallbackError, setFallbackError] = useState<string | null>(null);

  const overviewWorldId = model?.worldProfileId?.trim() || null;
  const worldProfileId = overviewWorldId || fallbackWorldId;
  const canEdit = model?.isGm === true;

  useEffect(() => {
    if (overviewWorldId) {
      setFallbackWorldId(null);
      setFallbackError(null);
      setResolvingFallback(false);
      return;
    }
    // Overview still loading with no cache — wait before project fallback.
    if (isLoading && !model) return;

    let cancelled = false;
    setResolvingFallback(true);
    setFallbackError(null);
    void projectService
      .getProjectByPublicId(sagaPublicId)
      .then((project) => {
        if (cancelled) return;
        setFallbackWorldId(project.worldProfileId?.trim() || null);
      })
      .catch((err) => {
        if (cancelled) return;
        setFallbackWorldId(null);
        setFallbackError(
          err instanceof Error ? err.message : 'Weltprofil konnte nicht geladen werden.',
        );
      })
      .finally(() => {
        if (!cancelled) setResolvingFallback(false);
      });
    return () => {
      cancelled = true;
    };
  }, [overviewWorldId, isLoading, model, sagaPublicId]);

  if ((isLoading && !model && !worldProfileId) || resolvingFallback) {
    return (
      <div
        className="h-full min-h-0 w-full flex-1"
        style={{ background: '#123e4a' }}
        data-saga-world-map-loading
        role="status"
        aria-busy="true"
        aria-label="Weltkarte wird geladen"
      />
    );
  }

  // Only hard-fail when we have neither overview nor project world id.
  if (!worldProfileId && (error || fallbackError)) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-3" role="alert">
        <p className="text-sm text-destructive">{error || fallbackError}</p>
      </div>
    );
  }

  if (!worldProfileId) {
    return (
      <div
        className="space-y-3 rounded-lg border border-dashed border-border p-6"
        data-saga-world-map-empty
      >
        <p className="text-sm text-muted-foreground">
          Diese Saga ist noch mit keiner Welt verknüpft. Lege in der Bibliothek eine Welt an
          oder verknüpfe ein Weltprofil, um den Atlas zu nutzen.
        </p>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => onNavigate(pathForLibraryTab('worlds'))}
        >
          Zur Bibliothek › Welten
        </Button>
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col"
      data-saga-world-map
    >
      <WorldAtlasWorkbench
        worldProfileId={worldProfileId}
        canEdit={canEdit}
        playerView={!canEdit}
        sagaPublicId={sagaPublicId}
        title="Weltkarte"
      />
    </div>
  );
}
