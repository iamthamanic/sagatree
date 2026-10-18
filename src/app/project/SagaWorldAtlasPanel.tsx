/**
 * SagaWorldAtlasPanel — Welt → Orte: shared Unified Atlas + Orte/Lore sheet.
 * Location: src/app/project/SagaWorldAtlasPanel.tsx
 *
 * Same WorldAtlasWorkbench as Library / Welt→Karte (no legacy tile editor).
 * Orte/Lore bindings stay in a side Sheet for reveal control.
 */
import { useEffect, useState } from 'react';
import { Loader2, Map as MapIcon, MapPin } from 'lucide-react';
import { Button } from '../../shared/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../shared/ui/sheet';
import { WorldAtlasWorkbench } from '../world';
import { pathForLibraryTab } from '../shell';
import {
  hasSagaPermission,
  revealLabelDe,
} from '../../domains/saga/permissions';
import {
  sagaPermissionService,
  type SagaAssetBindingVm,
  type SagaMyPermissionsVm,
} from '../../infrastructure/project/saga-permission-service';
import { projectService } from '../../infrastructure/project/project-service';
import { SagaBindingRevealControl } from './SagaBindingRevealControl';
import { useSagaOverview } from './hooks/useSagaOverview';

export type SagaWorldAtlasPanelProps = {
  sagaPublicId: string;
  onNavigate?: (path: string) => void;
};

function LocationRows(props: {
  rows: SagaAssetBindingVm[];
  projectId: string | null;
  canReveal: boolean;
  empty: string;
}) {
  if (props.rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{props.empty}</p>;
  }
  return (
    <ul className="space-y-2">
      {props.rows.map((b) => (
        <li
          key={b.id}
          className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {b.label || b.assetId}
            </p>
            <p className="text-xs text-muted-foreground">{revealLabelDe(b.reveal)}</p>
          </div>
          {props.canReveal && props.projectId ? (
            <SagaBindingRevealControl
              projectId={props.projectId}
              bindingId={b.id}
              reveal={b.reveal}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function SagaWorldAtlasPanel({
  sagaPublicId,
  onNavigate,
}: SagaWorldAtlasPanelProps) {
  const { model, isLoading, error } = useSagaOverview({ sagaPublicId });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [locations, setLocations] = useState<SagaAssetBindingVm[]>([]);
  const [lore, setLore] = useState<SagaAssetBindingVm[]>([]);
  const [drawerPerms, setDrawerPerms] = useState<SagaMyPermissionsVm | null>(null);
  const [drawerProjectId, setDrawerProjectId] = useState<string | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  /** Prefer overview; fall back to project row if RPC omit worldProfileId. */
  const [worldProfileId, setWorldProfileId] = useState<string | null>(null);
  const [resolvingWorld, setResolvingWorld] = useState(false);

  const isGm = Boolean(model?.isGm || model?.selfRole === 'gamemaster');

  useEffect(() => {
    const fromOverview = model?.worldProfileId?.trim() || null;
    if (fromOverview) {
      setWorldProfileId(fromOverview);
      setResolvingWorld(false);
      return;
    }
    // Wait for first overview attempt before project fallback (unless it already failed).
    if (isLoading && !model && !error) {
      return;
    }
    let cancelled = false;
    setResolvingWorld(true);
    void projectService
      .getProjectByPublicId(sagaPublicId)
      .then((project) => {
        if (cancelled) return;
        setWorldProfileId(project.worldProfileId?.trim() || null);
      })
      .catch(() => {
        if (!cancelled) setWorldProfileId(null);
      })
      .finally(() => {
        if (!cancelled) setResolvingWorld(false);
      });
    return () => {
      cancelled = true;
    };
  }, [model, sagaPublicId, isLoading, error]);

  useEffect(() => {
    if (!drawerOpen) return;
    let cancelled = false;
    void (async () => {
      try {
        const my = await sagaPermissionService.getMyPermissions(sagaPublicId);
        if (cancelled) return;
        setDrawerPerms(my);
        setDrawerProjectId(my.projectId);
        const [locRows, loreRows] = await Promise.all([
          sagaPermissionService.listBindings(sagaPublicId, 'location'),
          sagaPermissionService.listBindings(sagaPublicId, 'lore'),
        ]);
        if (cancelled) return;
        setLocations(locRows);
        setLore(loreRows);
        setDrawerError(null);
      } catch (err) {
        if (!cancelled) {
          setDrawerError(
            err instanceof Error ? err.message : 'Orte konnten nicht geladen werden',
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [drawerOpen, sagaPublicId]);

  const canReveal =
    Boolean(drawerPerms?.isGm)
    || hasSagaPermission(drawerPerms?.keys, 'saga.secrets.reveal');

  if ((isLoading && !model) || resolvingWorld) {
    return (
      <div
        className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground"
        data-saga-world-atlas
        data-saga-world-atlas-loading
        aria-busy="true"
      >
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Weltkarte wird geladen…
      </div>
    );
  }

  // Soft overview failure: keep resolving via project row when possible.
  if (error && !model && !worldProfileId && !resolvingWorld) {
    return (
      <p
        className="text-sm text-destructive"
        role="alert"
        data-saga-world-atlas
        data-saga-world-atlas-error
      >
        {error}
      </p>
    );
  }

  if (!worldProfileId) {
    return (
      <section
        className="flex w-full min-w-0 flex-col gap-3 rounded-lg border border-border bg-card/40 p-4"
        data-saga-world-atlas
        data-saga-world-atlas-empty
        aria-labelledby="saga-world-atlas-empty-title"
      >
        <div className="flex items-start gap-3">
          <MapIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 space-y-1">
            <h3
              id="saga-world-atlas-empty-title"
              className="text-sm font-semibold text-foreground"
            >
              Noch keine Weltkarte verknüpft
            </h3>
            <p className="text-sm text-muted-foreground">
              Dornhain und andere Starter-Sagas sollten automatisch ein Weltprofil
              haben. Fehlt es, verknüpfe eine Welt in der Bibliothek.
            </p>
          </div>
        </div>
        {onNavigate ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full min-w-0 self-start sm:w-auto"
            data-saga-world-atlas-library
            onClick={() => onNavigate(pathForLibraryTab('worlds'))}
          >
            Zur Bibliothek · Welten
          </Button>
        ) : null}
      </section>
    );
  }

  return (
    <section
      className="flex h-[max(28rem,calc(100dvh-17rem))] w-full min-w-0 flex-col gap-2"
      data-saga-world-atlas
      data-saga-world-atlas-ready
      data-au-surface="journey"
    >
      <div className="flex shrink-0 min-w-0 flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 min-w-0"
          data-saga-world-atlas-orte
          onClick={() => setDrawerOpen(true)}
        >
          <MapPin className="size-4" aria-hidden />
          Orte & Lore
        </Button>
        {isGm ? (
          <p className="text-xs text-muted-foreground" data-saga-world-atlas-gm-hint>
            Als GM kannst du die Unified-Atlas-Karte direkt bearbeiten und speichern.
          </p>
        ) : null}
      </div>

      <div
        className="flex min-h-[24rem] min-w-0 w-full flex-1 flex-col rounded-lg border border-border/60 bg-muted/20 p-2 sm:p-3"
        data-saga-world-atlas-canvas
      >
        <WorldAtlasWorkbench
          worldProfileId={worldProfileId}
          canEdit={isGm}
          playerView={!isGm}
          sagaPublicId={sagaPublicId}
          title="Welt → Orte"
        />
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md"
          data-saga-world-atlas-drawer
        >
          <SheetHeader className="border-b border-border pb-4 pr-10">
            <SheetTitle>Orte & Lore</SheetTitle>
            <SheetDescription>
              Sichtbarkeit steuert, was die Party auf der Karte und in Listen sieht.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-6 p-4">
            {drawerError ? (
              <p className="text-sm text-destructive" role="alert">
                {drawerError}
              </p>
            ) : null}
            <div className="space-y-2" data-saga-world-group="locations">
              <h3 className="text-sm font-semibold text-foreground">Orte</h3>
              <LocationRows
                rows={locations}
                projectId={drawerProjectId}
                canReveal={canReveal}
                empty="Noch keine Orte gebunden."
              />
            </div>
            <div className="space-y-2" data-saga-world-group="lore">
              <h3 className="text-sm font-semibold text-foreground">Lore (Welt)</h3>
              <LocationRows
                rows={lore}
                projectId={drawerProjectId}
                canReveal={canReveal}
                empty="Noch keine Lore-Einträge gebunden."
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
