/**
 * WebglNavTreeActionHost — Dialogs for product WebGL + / archive / reparent (#748).
 * Location: src/app/world/atlas/WebglNavTreeActionHost.tsx
 */
import { useEffect, useMemo, useState } from 'react';
import {
  isAllowedParent,
  requiredParentKind,
  tryNodeKindFromPlaceKind,
  type WorldNodeKind,
} from '../../../domains/world/hierarchy';
import type { WorldPlaceVm } from '../../../domains/world/places';
import { worldPlaceService } from '../../../infrastructure/world/world-place-service';
import { Button } from '../../../shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../shared/ui/dialog';
import { Label } from '../../../shared/ui/label';
import { CreateWorldNodeDialog } from '../places/CreateWorldNodeDialog';

export type WebglNavCreateRequest = {
  readonly childKind: WorldNodeKind;
  readonly parentPlaceId: string | null;
  readonly parentKind: WorldNodeKind | null;
};

export type WebglNavTreeActionHostProps = {
  readonly worldProfileId: string;
  readonly canEdit: boolean;
  readonly places: readonly WorldPlaceVm[];
  readonly createRequest: WebglNavCreateRequest | null;
  readonly onCloseCreate: () => void;
  readonly onCreated: (info: {
    readonly targetPlaceId: string;
    readonly targetMapId: string | null;
  }) => void;
  readonly archivePlaceId: string | null;
  readonly onCloseArchive: () => void;
  readonly onArchived: () => void;
  readonly reparentPlaceId: string | null;
  readonly onCloseReparent: () => void;
  readonly onReparented: () => void;
};

function consequenceSummaryDe(preview: Readonly<Record<string, unknown>>): string {
  const childCount = Number(preview.childCount ?? preview.descendantCount ?? 0);
  const sagaCount = Number(preview.sagaBindingCount ?? preview.sagaBindings ?? 0);
  const parts: string[] = [];
  if (Number.isFinite(childCount) && childCount > 0) {
    parts.push(`${childCount} untergeordnete Elemente`);
  }
  if (Number.isFinite(sagaCount) && sagaCount > 0) {
    parts.push(`${sagaCount} Saga-Verknüpfungen`);
  }
  if (parts.length === 0) return 'Keine zusätzlichen Abhängigkeiten erkannt.';
  return `Betroffen: ${parts.join(', ')}. Saga-Verweise bleiben erhalten; der Knoten wird archiviert.`;
}

export function WebglNavTreeActionHost({
  worldProfileId,
  canEdit,
  places,
  createRequest,
  onCloseCreate,
  onCreated,
  archivePlaceId,
  onCloseArchive,
  onArchived,
  reparentPlaceId,
  onCloseReparent,
  onReparented,
}: WebglNavTreeActionHostProps) {
  const [archivePreview, setArchivePreview] = useState<string | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [reparentTarget, setReparentTarget] = useState<string>('');
  const [reparentBusy, setReparentBusy] = useState(false);
  const [reparentError, setReparentError] = useState<string | null>(null);

  const archivePlace = archivePlaceId
    ? places.find((p) => p.id === archivePlaceId) ?? null
    : null;
  const reparentPlace = reparentPlaceId
    ? places.find((p) => p.id === reparentPlaceId) ?? null
    : null;
  const reparentKind = reparentPlace
    ? tryNodeKindFromPlaceKind(reparentPlace.kind)
    : null;

  const reparentCandidates = useMemo(() => {
    if (!reparentPlace || !reparentKind) return [];
    const wantParent = requiredParentKind(reparentKind);
    return places.filter((p) => {
      if (p.id === reparentPlace.id) return false;
      if (p.status === 'archived') return false;
      const kind = tryNodeKindFromPlaceKind(p.kind);
      if (wantParent === null) return false;
      return kind === wantParent && isAllowedParent(reparentKind, kind);
    });
  }, [places, reparentPlace, reparentKind]);

  useEffect(() => {
    if (!archivePlaceId || !canEdit) {
      setArchivePreview(null);
      setArchiveError(null);
      return;
    }
    let cancelled = false;
    setArchiveBusy(true);
    setArchiveError(null);
    void worldPlaceService
      .previewNodeConsequences({ worldProfileId, placeId: archivePlaceId })
      .then((preview) => {
        if (cancelled) return;
        setArchivePreview(consequenceSummaryDe(preview));
      })
      .catch((err) => {
        if (cancelled) return;
        setArchiveError(
          err instanceof Error ? err.message : 'Folgenabschätzung fehlgeschlagen.',
        );
        setArchivePreview(null);
      })
      .finally(() => {
        if (!cancelled) setArchiveBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [archivePlaceId, canEdit, worldProfileId]);

  useEffect(() => {
    setReparentTarget('');
    setReparentError(null);
  }, [reparentPlaceId]);

  return (
    <>
      <Dialog
        open={Boolean(createRequest) && canEdit}
        onOpenChange={(open) => {
          if (!open) onCloseCreate();
        }}
      >
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-md"
          data-webgl-nav-create-dialog
        >
          <DialogHeader>
            <DialogTitle>Element anlegen</DialogTitle>
            <DialogDescription>
              Atomare Anlage mit Vorfahren-Platzhaltern und Primärkarten. Navigation erst nach
              Server-Bestätigung.
            </DialogDescription>
          </DialogHeader>
          {createRequest ? (
            <CreateWorldNodeDialog
              worldProfileId={worldProfileId}
              canEdit={canEdit}
              parentPlaceId={createRequest.parentPlaceId}
              parentKind={createRequest.parentKind}
              defaultChildKind={createRequest.childKind}
              fixedChildKind={createRequest.childKind}
              onClose={onCloseCreate}
              onCreated={onCreated}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(archivePlaceId) && canEdit}
        onOpenChange={(open) => {
          if (!open) onCloseArchive();
        }}
      >
        <DialogContent data-webgl-nav-archive-dialog>
          <DialogHeader>
            <DialogTitle>Knoten archivieren</DialogTitle>
            <DialogDescription>
              {archivePlace
                ? `„${archivePlace.name}“ und Nachfahren werden archiviert (nicht hard-gelöscht).`
                : 'Knoten archivieren'}
            </DialogDescription>
          </DialogHeader>
          {archiveBusy ? (
            <p className="text-sm text-muted-foreground">Folgen werden geprüft…</p>
          ) : null}
          {archivePreview ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
              {archivePreview}
            </p>
          ) : null}
          {archiveError ? (
            <p className="text-sm text-destructive" role="alert">
              {archiveError}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" onClick={onCloseArchive}>
              Abbrechen
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              disabled={archiveBusy || !archivePlaceId}
              onClick={() => {
                if (!archivePlaceId) return;
                setArchiveBusy(true);
                setArchiveError(null);
                void worldPlaceService
                  .archiveNodeSubtree({
                    worldProfileId,
                    placeId: archivePlaceId,
                    confirm: true,
                  })
                  .then(() => {
                    onArchived();
                    onCloseArchive();
                  })
                  .catch((err) => {
                    setArchiveError(
                      err instanceof Error ? err.message : 'Archivieren fehlgeschlagen.',
                    );
                  })
                  .finally(() => setArchiveBusy(false));
              }}
            >
              Archivieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(reparentPlaceId) && canEdit}
        onOpenChange={(open) => {
          if (!open) onCloseReparent();
        }}
      >
        <DialogContent data-webgl-nav-reparent-dialog>
          <DialogHeader>
            <DialogTitle>Knoten verschieben</DialogTitle>
            <DialogDescription>
              {reparentPlace
                ? `Neuen Elternknoten für „${reparentPlace.name}“ wählen. Ungültige Kanten lehnt der Server ab.`
                : 'Knoten verschieben'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="webgl-reparent-parent">Neuer Elternknoten</Label>
            <select
              id="webgl-reparent-parent"
              className="min-h-11 w-full rounded-md border border-border bg-background px-2 text-sm"
              value={reparentTarget}
              disabled={reparentBusy}
              onChange={(e) => setReparentTarget(e.target.value)}
            >
              <option value="">— wählen —</option>
              {reparentCandidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.kind})
                </option>
              ))}
            </select>
          </div>
          {reparentCandidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Kein gültiger Elternknoten in dieser Welt verfügbar.
            </p>
          ) : null}
          {reparentError ? (
            <p className="text-sm text-destructive" role="alert">
              {reparentError}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" onClick={onCloseReparent}>
              Abbrechen
            </Button>
            <Button
              type="button"
              className="min-h-11"
              disabled={reparentBusy || !reparentPlaceId || !reparentTarget}
              onClick={() => {
                if (!reparentPlaceId || !reparentTarget) return;
                setReparentBusy(true);
                setReparentError(null);
                void worldPlaceService
                  .reparentNode({
                    worldProfileId,
                    placeId: reparentPlaceId,
                    newParentPlaceId: reparentTarget,
                    confirmRelocate: true,
                  })
                  .then(() => {
                    onReparented();
                    onCloseReparent();
                  })
                  .catch((err) => {
                    setReparentError(
                      err instanceof Error ? err.message : 'Verschieben fehlgeschlagen.',
                    );
                  })
                  .finally(() => setReparentBusy(false));
              }}
            >
              Verschieben
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
