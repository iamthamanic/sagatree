/**
 * WorldAtlasWorkbench — shared Library + Saga atlas workstation (#702).
 * Location: src/app/world/atlas/WorldAtlasWorkbench.tsx
 *
 * Default: Unified Canvas multi-scale editor (prototype-style shell).
 * Legacy tiles keep tile editor. Place authoring via world_places RPC.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Map as MapIcon,
  Plus,
  Save,
  Upload,
} from 'lucide-react';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../../../shared/ui/sheet';
import {
  buildAtlasPlaceNav,
  buildAtlasWebglNavTree,
  worldNodeKindFromWebglNavUiKind,
  type AtlasPlaceNavItem,
  type AtlasWebglNavTreeStatus,
  type WorldPlaceKind,
  type WorldPlaceMapLinkVm,
  type WorldPlaceVm,
} from '../../../domains/world/places';
import {
  tryNodeKindFromPlaceKind,
  type WorldNodeKind,
} from '../../../domains/world/hierarchy';
import {
  UNLOCATED_MAP_HINT_DE,
  atlasPersistStatusLabelDe,
  extractMapFrameFromGeneratorMeta,
} from '../../../domains/world/atlas';
import { WorldMapEditorScreen } from '../map';
import { WorldPlacesPanel } from '../places/WorldPlacesPanel';
import { useWorldAtlasEditor } from './useWorldAtlasEditor';
import { UnifiedAtlasEditor } from './unified';
import {
  WebglNavTreeActionHost,
  type WebglNavCreateRequest,
} from './WebglNavTreeActionHost';
import { API_AUTH_REQUIRED_DE } from '../../../lib/authenticatedUser';
import { worldAtlasService } from '../../../infrastructure/world/world-atlas-service';
import { worldPlaceService } from '../../../infrastructure/world/world-place-service';

function detailUsageForPlace(kind: WorldPlaceKind) {
  if (kind === 'dungeon') return 'dungeon' as const;
  if (kind === 'building' || kind === 'interior') return 'interior' as const;
  if (kind === 'settlement') return 'footprint' as const;
  return 'battlemap' as const;
}

function mapKindForPlace(kind: WorldPlaceKind) {
  if (kind === 'settlement') return 'settlement' as const;
  if (kind === 'region' || kind === 'area' || kind === 'realm') return 'region' as const;
  return 'scene' as const;
}

export type WorldAtlasWorkbenchProps = {
  readonly worldProfileId: string;
  readonly canEdit: boolean;
  readonly playerView?: boolean;
  /** When set, place list can filter by saga reveal for players. */
  readonly sagaPublicId?: string | null;
  readonly onBack?: () => void;
  readonly title?: string;
};

export function WorldAtlasWorkbench({
  worldProfileId,
  canEdit,
  playerView = false,
  sagaPublicId = null,
  onBack,
  title = 'Weltatlas',
}: WorldAtlasWorkbenchProps) {
  const editor = useWorldAtlasEditor({ worldProfileId, canEdit, playerView });
  const fileRef = useRef<HTMLInputElement>(null);
  const [childTitle, setChildTitle] = useState('Detailkarte');
  const [hierarchyOpen, setHierarchyOpen] = useState(false);
  const [mapsRailExpanded, setMapsRailExpanded] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [placeNav, setPlaceNav] = useState<readonly AtlasPlaceNavItem[]>([]);
  const [worldPlaces, setWorldPlaces] = useState<readonly WorldPlaceVm[]>([]);
  const [worldLinks, setWorldLinks] = useState<readonly WorldPlaceMapLinkVm[]>([]);
  const [placeNavStatus, setPlaceNavStatus] = useState<AtlasWebglNavTreeStatus>('loading');
  const [placeNavError, setPlaceNavError] = useState<string | undefined>(undefined);
  const [placeNavTick, setPlaceNavTick] = useState(0);
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);
  const [webglCreateRequest, setWebglCreateRequest] = useState<WebglNavCreateRequest | null>(
    null,
  );
  const [webglArchivePlaceId, setWebglArchivePlaceId] = useState<string | null>(null);
  const [webglReparentPlaceId, setWebglReparentPlaceId] = useState<string | null>(null);
  const [webglActionError, setWebglActionError] = useState<string | null>(null);

  const showLegacyTiles = editor.map?.kind === 'legacy_tiles';
  const showUnified = Boolean(editor.map && !showLegacyTiles);
  /** Exact HTML 3D prototype mount (not flat Canvas2D). */
  const protoExact = showUnified && editor.canvasDoc.demoSeed === false;
  const activeMapFrame = editor.map
    ? extractMapFrameFromGeneratorMeta(editor.map.generatorMeta)
    : null;
  const mapUnlocated = activeMapFrame?.status === 'unlocated' && !activeMapFrame.parentAnchor;
  /**
   * Boot: map not ready yet — ocean placeholder, no prototype title/rail chrome.
   * loading starts true when worldProfileId is set (see useWorldAtlasEditor) so the first
   * React commit never paints non-protoExact chrome before useEffect runs.
   */
  const atlasBooting =
    !editor.map &&
    !editor.error &&
    Boolean(worldProfileId.trim()) &&
    (editor.loading || editor.summaries.length > 0);
  const layoutExact = protoExact || atlasBooting;

  const worldPrimaryMapId = useMemo(() => {
    const worldSummary = editor.summaries.find((s) => s.kind === 'world');
    return worldSummary?.id ?? editor.summaries[0]?.id ?? null;
  }, [editor.summaries]);

  const webglNavTree = useMemo(
    () =>
      buildAtlasWebglNavTree({
        worldProfileId,
        worldLabel: title,
        worldPrimaryMapId,
        places: worldPlaces,
        links: worldLinks,
        status: placeNavStatus,
        errorMessage: placeNavError,
      }),
    [
      worldProfileId,
      title,
      worldPrimaryMapId,
      worldPlaces,
      worldLinks,
      placeNavStatus,
      placeNavError,
    ],
  );

  const reloadPlaceNav = useCallback(async () => {
    const id = worldProfileId.trim();
    if (!id) {
      setPlaceNav([]);
      setWorldPlaces([]);
      setWorldLinks([]);
      setPlaceNavStatus('empty');
      setPlaceNavError(undefined);
      return;
    }
    setPlaceNavStatus('loading');
    setPlaceNavError(undefined);
    try {
      const listOpts = { playerView, sagaPublicId };
      const [places, links] = await Promise.all([
        worldPlaceService.listPlaces(id, listOpts),
        worldPlaceService.listMapLinks(id, listOpts),
      ]);
      setWorldPlaces(places);
      setWorldLinks(links);
      setPlaceNav(buildAtlasPlaceNav(places, links));
      setPlaceNavStatus(places.some((p) => p.status !== 'archived') ? 'ready' : 'empty');
    } catch (err) {
      console.warn('[atlas] place nav:', err);
      setPlaceNav([]);
      setWorldPlaces([]);
      setWorldLinks([]);
      setPlaceNavStatus('error');
      setPlaceNavError(
        err instanceof Error ? err.message : 'Weltstruktur konnte nicht geladen werden.',
      );
    }
  }, [worldProfileId, playerView, sagaPublicId]);

  useEffect(() => {
    void reloadPlaceNav();
  }, [reloadPlaceNav, placeNavTick, editor.map?.id]);

  // Keep WebGL nav highlight in sync with the active primary map.
  useEffect(() => {
    const mapId = editor.activeMapId;
    if (!mapId) return;
    const match = worldPlaces.find(
      (p) =>
        p.status !== 'archived' &&
        worldLinks.some((l) => l.placeId === p.id && l.mapId === mapId && l.usage === 'primary'),
    );
    if (match) {
      setActivePlaceId(match.id);
      return;
    }
    if (mapId === worldPrimaryMapId) {
      setActivePlaceId(null);
    }
  }, [editor.activeMapId, worldPlaces, worldLinks, worldPrimaryMapId]);

  // Debounced autosave for controlled WebGL / canvas dirty (#721 / #751).
  useEffect(() => {
    if (!canEdit || !editor.map || !editor.dirtyCanvas || editor.saving) return;
    if (editor.persistStatus === 'conflict') return;
    const timer = window.setTimeout(() => {
      void editor.saveCanvas().catch(() => {
        /* error surfaced on editor.error */
      });
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [
    canEdit,
    editor.map,
    editor.dirtyCanvas,
    editor.saving,
    editor.persistStatus,
    editor.webglRuntime,
    editor.canvasDoc,
    editor.saveCanvas,
  ]);

  // Warn before discarding a dirty draft (browser close / refresh).
  useEffect(() => {
    if (!canEdit || !editor.dirtyCanvas) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [canEdit, editor.dirtyCanvas]);

  const handleCreateDetailMap = async (place: WorldPlaceVm) => {
    if (!canEdit) return;
    const created = await editor.createChildMap(`${place.name} (Detail)`, {
      kind: mapKindForPlace(place.kind),
      generatorMeta: {
        placeId: place.id,
        placeSeedKey: place.seedKey,
        detailMissing: false,
      },
    });
    if (!created) return;
    try {
      await worldPlaceService.linkMap({
        worldProfileId,
        placeId: place.id,
        mapId: created.id,
        usage: detailUsageForPlace(place.kind),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreatePlaceFromAtlas = async (input: {
    readonly name: string;
    readonly placeKind: WorldPlaceKind;
    readonly seedKey: string;
    readonly x: number;
    readonly y: number;
  }) => {
    if (!canEdit) return;
    const place = await worldPlaceService.upsertPlace({
      worldProfileId,
      kind: input.placeKind,
      name: input.name,
      seedKey: input.seedKey,
      description: `Atlas-Anker X=${Math.round(input.x)} Y=${Math.round(input.y)}`,
      status: 'draft',
    });
    if (editor.map?.id) {
      try {
        await worldPlaceService.linkMap({
          worldProfileId,
          placeId: place.id,
          mapId: editor.map.id,
          usage:
            input.placeKind === 'settlement'
              ? 'overview'
              : input.placeKind === 'building'
                ? 'footprint'
                : 'overview',
          anchor: { x: input.x, y: input.y, source: 'unified-atlas' },
        });
      } catch (err) {
        console.warn('[atlas] place map link:', err);
      }
    }
    setPlaceNavTick((n) => n + 1);
  };

  const hierarchyList = (
    <ul className="space-y-1" data-world-atlas-hierarchy>
      {editor.summaries.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className={`flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm ${
              item.id === editor.activeMapId
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            }`}
            onClick={() => {
              editor.setActiveMapId(item.id);
              setHierarchyOpen(false);
              setMapsRailExpanded(false);
            }}
          >
            <span className="truncate">{item.title}</span>
            <span className="ml-auto shrink-0 text-xs opacity-70">{item.kind}</span>
          </button>
        </li>
      ))}
      {editor.summaries.length === 0 && (
        <li className="px-3 py-2 text-sm text-muted-foreground">Noch keine Karten.</li>
      )}
    </ul>
  );

  const metaPanel = (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Eigenschaften
        </p>
        {editor.map ? (
          <dl className="mt-2 space-y-1 text-sm">
            <div>
              <dt className="text-muted-foreground">Titel</dt>
              <dd className="font-medium">{editor.map.title}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Typ</dt>
              <dd>{editor.map.kind}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Revision</dt>
              <dd>{editor.map.revision}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Keine Auswahl.</p>
        )}
      </div>

      {canEdit ? (
        <div className="space-y-2 border-t border-border pt-3">
          <Label htmlFor="atlas-child-title">Detailkarte anlegen</Label>
          <Input
            id="atlas-child-title"
            className="min-h-11"
            value={childTitle}
            onChange={(e) => setChildTitle(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            disabled={editor.saving || !editor.map}
            onClick={() => void editor.createChildMap(childTitle)}
          >
            <Plus className="size-4" aria-hidden />
            Detailkarte verknüpfen
          </Button>
        </div>
      ) : null}

      {canEdit ? (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-sm font-medium">Azgaar Fantasy Map</p>
          <p className="text-xs text-muted-foreground">
            Speichert die native <code>.map</code>-Datei in Storage. Zum Weiterbearbeiten
            herunterladen und erneut importieren.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".map,.zip,application/octet-stream"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void editor.importAzgaarMap(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            disabled={editor.saving || !editor.map}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-4" aria-hidden />
            .map importieren
          </Button>
          {editor.map?.azgaarMapStoragePath ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full"
              onClick={() => {
                void worldAtlasService
                  .createSignedUrl(editor.map!.azgaarMapStoragePath!)
                  .then((url) => {
                    window.open(url, '_blank', 'noopener,noreferrer');
                  })
                  .catch((err: unknown) => {
                    console.error(err);
                  });
              }}
            >
              <Download className="size-4" aria-hidden />
              .map herunterladen
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      className={`@container/main relative flex h-full min-h-0 w-full min-w-0 flex-col ${
        layoutExact ? 'gap-0' : 'gap-3'
      }`}
      data-world-atlas-workbench
      data-atlas-booting={atlasBooting ? 'true' : undefined}
      data-atlas-controlled-store={protoExact ? 'true' : undefined}
    >
      {/* Skip title/rail chrome while booting — avoids <1s menu flash before 3D map. */}
      {(!protoExact && !atlasBooting) || onBack ? (
        <header
          className={`flex flex-wrap items-center gap-2 ${
            protoExact ? 'pb-2' : 'border-b border-border pb-3'
          }`}
          data-atlas-prototype-bar
        >
          {onBack ? (
            <Button type="button" variant="outline" className="min-h-11" onClick={onBack}>
              Zurück
            </Button>
          ) : null}
          {!protoExact && !atlasBooting ? (
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold leading-tight text-foreground">
                {editor.map?.title?.trim() || title}
              </h1>
              <p
                className="truncate text-xs text-muted-foreground"
                data-atlas-persist-status={editor.persistStatus}
              >
                {atlasPersistStatusLabelDe(editor.persistStatus)}
              </p>
            </div>
          ) : null}
          {!showUnified && !atlasBooting ? (
            <Sheet open={hierarchyOpen} onOpenChange={setHierarchyOpen}>
              <SheetTrigger asChild>
                <Button type="button" variant="outline" className="min-h-11 @[48rem]:hidden">
                  <MapIcon className="size-4" aria-hidden />
                  Karten
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[min(100%,20rem)]">
                <SheetHeader>
                  <SheetTitle>Kartenhierarchie</SheetTitle>
                </SheetHeader>
                <div className="mt-4">{hierarchyList}</div>
              </SheetContent>
            </Sheet>
          ) : null}
          {showUnified && !protoExact ? (
            <Sheet open={toolsOpen} onOpenChange={setToolsOpen}>
              <SheetTrigger asChild>
                <Button type="button" variant="outline" className="min-h-11 @[64rem]:hidden">
                  Meta
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[min(100%,20rem)]">
                <SheetHeader>
                  <SheetTitle>Atlas</SheetTitle>
                </SheetHeader>
                <div className="mt-4">{metaPanel}</div>
              </SheetContent>
            </Sheet>
          ) : null}
          {canEdit && editor.map && showUnified && !protoExact ? (
            <Button
              type="button"
              className="min-h-11"
              disabled={editor.saving || !editor.dirtyCanvas}
              onClick={() => {
                void editor.saveCanvas();
              }}
            >
              {editor.saving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Save className="size-4" aria-hidden />
              )}
              Speichern
            </Button>
          ) : null}
          {canEdit &&
          editor.map &&
          showUnified &&
          protoExact &&
          editor.dirtyCanvas &&
          editor.persistStatus !== 'conflict' ? (
            <Button
              type="button"
              className="min-h-11"
              data-atlas-explicit-save
              disabled={editor.saving}
              onClick={() => {
                void editor.saveCanvas();
              }}
            >
              {editor.saving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Save className="size-4" aria-hidden />
              )}
              Speichern
            </Button>
          ) : null}
        </header>
      ) : null}

      {canEdit &&
      editor.map &&
      showUnified &&
      protoExact &&
      editor.dirtyCanvas &&
      editor.persistStatus !== 'conflict' &&
      !onBack &&
      !atlasBooting ? (
        <div className="pointer-events-none absolute bottom-4 left-4 z-[4]">
          <Button
            type="button"
            className="pointer-events-auto min-h-11 shadow-lg"
            data-atlas-explicit-save
            disabled={editor.saving}
            onClick={() => {
              void editor.saveCanvas();
            }}
          >
            {editor.saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            Speichern
          </Button>
        </div>
      ) : null}

      {canEdit && editor.persistStatus === 'conflict' && !atlasBooting ? (
        <div
          className="absolute bottom-4 left-4 z-[5] max-w-md rounded-lg border border-amber-500/50 bg-card/95 p-3 shadow-lg"
          role="alert"
          data-atlas-revision-conflict
        >
          <p className="text-sm font-medium text-foreground">
            Revisionskonflikt — die Karte wurde inzwischen geändert.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {editor.error ??
              'Lokal speichern würde fremde Änderungen überschreiben. Neu laden oder erneut versuchen.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              data-atlas-conflict-reload
              disabled={editor.loading || editor.saving}
              onClick={() => {
                void editor.reloadActiveMap();
              }}
            >
              Neu laden
            </Button>
            <Button
              type="button"
              className="min-h-11"
              data-atlas-conflict-retry
              disabled={editor.saving}
              onClick={() => {
                void editor.saveCanvas().catch(() => {
                  /* error stays on editor.error */
                });
              }}
            >
              {editor.saving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                'Erneut speichern'
              )}
            </Button>
          </div>
        </div>
      ) : null}

      {mapUnlocated && showUnified && !atlasBooting ? (
        <div
          className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
          data-atlas-unlocated-hint
          role="status"
        >
          {UNLOCATED_MAP_HINT_DE}
          {canEdit ? ' — Verorte den Ausschnitt auf der Elternkarte, bevor Zoom dorthin wechselt.' : null}
        </div>
      ) : null}

      {editor.error ? (
        <div
          className="space-y-2 rounded-lg border border-destructive bg-destructive/10 p-3"
          role="alert"
        >
          <p className="text-sm text-destructive">{editor.error}</p>
          {editor.error === API_AUTH_REQUIRED_DE || editor.error.includes('API-Anmeldung') ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              data-atlas-api-reconnect
              disabled={editor.loading}
              onClick={() => {
                void editor.reloadList();
              }}
            >
              {editor.loading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              API verbinden
            </Button>
          ) : null}
        </div>
      ) : null}

      {editor.breadcrumb.length > 1 ? (
        <nav
          className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
          aria-label="Kartennavigation"
          data-world-atlas-breadcrumb
        >
          {editor.breadcrumb.map((crumb, index) => (
            <span key={crumb.id} className="inline-flex items-center gap-1">
              {index > 0 ? <ChevronRight className="size-3.5 shrink-0" aria-hidden /> : null}
              <button
                type="button"
                className="min-h-11 rounded px-1 text-foreground underline-offset-2 hover:underline"
                onClick={() => editor.setActiveMapId(crumb.id)}
              >
                {crumb.title}
              </button>
            </span>
          ))}
        </nav>
      ) : null}

      <div
        className={
          layoutExact
            ? 'grid min-h-0 flex-1 grid-cols-1'
            : showUnified
              ? 'grid min-h-0 flex-1 gap-3 @[64rem]:grid-cols-[minmax(0,1fr)_14rem]'
              : 'grid min-h-0 flex-1 gap-3 @[48rem]:grid-cols-[14rem_minmax(0,1fr)_16rem]'
        }
      >
        {!showUnified && !atlasBooting ? (
          <aside className="hidden min-h-0 overflow-auto rounded-lg border border-border p-2 @[48rem]:block">
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Hierarchie
            </p>
            {hierarchyList}
          </aside>
        ) : null}

        <section
          className={`relative min-w-0 overflow-hidden ${
            layoutExact ? 'min-h-0 h-full flex-1' : 'min-h-[24rem]'
          }`}
          data-atlas-proto-exact={protoExact ? 'true' : undefined}
        >
          {atlasBooting ? (
            <div
              className="h-full min-h-0 w-full flex-1"
              style={{ background: '#123e4a' }}
              data-atlas-boot-placeholder
              role="status"
              aria-busy="true"
              aria-label="Atlas wird geladen"
            />
          ) : showLegacyTiles && editor.map ? (
            <div className="flex h-full min-h-0 flex-col gap-2" data-world-atlas-legacy-tiles>
              <p className="text-sm text-muted-foreground">
                Legacy-Kachelkarte — bestehende Pins und Terrain bleiben erhalten. Für den Unified
                Atlas die Karte „Weltkarte (Unified)“ in der Hierarchie wählen.
              </p>
              <div className="min-h-0 flex-1 overflow-auto">
                {canEdit ? (
                  <WorldMapEditorScreen worldProfileId={worldProfileId} embedded />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Ansicht nur für Bearbeiter mit Kachel-Editor.
                  </p>
                )}
              </div>
            </div>
          ) : showUnified && editor.map ? (
            <UnifiedAtlasEditor
              key={`${editor.map.id}:${editor.map.revision}`}
              mapKey={`${editor.map.id}:${editor.map.revision}`}
              doc={editor.canvasDoc}
              canEdit={canEdit}
              onDocChange={editor.updateCanvasDoc}
              webglRuntime={editor.webglRuntime}
              onWebglRuntimeChange={editor.updateWebglRuntime}
              dungeonMeta={editor.dungeonMeta}
              onDungeonMetaChange={editor.updateDungeonMeta}
              placeNav={placeNav}
              webglNavTree={protoExact ? webglNavTree : null}
              activePlaceId={activePlaceId}
              onWebglNavSelect={(payload) => {
                if (payload.worldRoot) {
                  setActivePlaceId(null);
                } else {
                  setActivePlaceId(payload.placeId);
                }
                if (payload.mapId) {
                  editor.setActiveMapId(payload.mapId);
                }
              }}
              onWebglNavRename={
                canEdit
                  ? async ({ placeId, label }) => {
                      try {
                        setWebglActionError(null);
                        await worldPlaceService.renameNode({
                          worldProfileId,
                          placeId,
                          name: label,
                        });
                        setPlaceNavTick((t) => t + 1);
                      } catch (err) {
                        console.error('[atlas] rename from WebGL nav:', err);
                        setWebglActionError(
                          err instanceof Error ? err.message : 'Umbenennen fehlgeschlagen.',
                        );
                      }
                    }
                  : undefined
              }
              onWebglNavAdd={
                canEdit
                  ? ({ uiKind, parentId }) => {
                      const childKind = worldNodeKindFromWebglNavUiKind(uiKind);
                      if (!childKind) {
                        setWebglActionError('Dieser Typ kann hier nicht angelegt werden.');
                        return;
                      }
                      const worldRootId =
                        webglNavTree?.worldId ?? `world:${worldProfileId.trim()}`;
                      let parentPlaceId: string | null = null;
                      let parentKind: WorldNodeKind | null = null;
                      if (parentId && parentId !== worldRootId && parentId !== 'atlas') {
                        parentPlaceId = parentId;
                        parentKind =
                          tryNodeKindFromPlaceKind(
                            worldPlaces.find((p) => p.id === parentId)?.kind ?? '',
                          ) ?? null;
                      }
                      setWebglActionError(null);
                      setWebglCreateRequest({ childKind, parentPlaceId, parentKind });
                    }
                  : undefined
              }
              onWebglNavDuplicate={
                canEdit
                  ? ({ placeId }) => {
                      setWebglActionError(null);
                      void worldPlaceService
                        .duplicateNode({ worldProfileId, placeId, deep: false })
                        .then((result) => {
                          setPlaceNavTick((t) => t + 1);
                          const newPlaceId = String(result.targetPlaceId ?? result.placeId ?? '');
                          const newMapId =
                            result.targetMapId == null && result.primaryMapId == null
                              ? null
                              : String(result.targetMapId ?? result.primaryMapId);
                          if (newPlaceId) setActivePlaceId(newPlaceId);
                          if (newMapId) editor.setActiveMapId(newMapId);
                        })
                        .catch((err) => {
                          console.error('[atlas] duplicate from WebGL nav:', err);
                          setWebglActionError(
                            err instanceof Error ? err.message : 'Duplizieren fehlgeschlagen.',
                          );
                        });
                    }
                  : undefined
              }
              onWebglNavArchive={
                canEdit
                  ? ({ placeId }) => {
                      setWebglActionError(null);
                      setWebglArchivePlaceId(placeId);
                    }
                  : undefined
              }
              onWebglNavReparent={
                canEdit
                  ? ({ placeId }) => {
                      setWebglActionError(null);
                      setWebglReparentPlaceId(placeId);
                    }
                  : undefined
              }
              activeNodeKind={
                tryNodeKindFromPlaceKind(
                  placeNav.find((p) => p.mapId === editor.activeMapId)?.kind ??
                    worldPlaces.find((p) => p.id === activePlaceId)?.kind ??
                    '',
                )
              }
              canvasLeftRail={
                  <div
                    className="absolute left-3 top-3 z-[2] flex max-h-[min(75%,32rem)] flex-col gap-1 overflow-hidden rounded-lg border border-border bg-card/95 p-1 shadow"
                    data-unified-chrome
                    data-atlas-maps-rail
                    data-atlas-maps-expanded={mapsRailExpanded ? 'true' : 'false'}
                    role="navigation"
                    aria-label={placeNav.length > 0 ? 'Weltstruktur' : 'Karten'}
                  >
                    <button
                      type="button"
                      className="flex min-h-11 min-w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md hover:bg-muted"
                      aria-expanded={mapsRailExpanded}
                      aria-controls="atlas-maps-rail-list"
                      data-atlas-maps-toggle
                      title={mapsRailExpanded ? 'Weltstruktur einklappen' : 'Weltstruktur ausklappen'}
                      onClick={() => setMapsRailExpanded((v) => !v)}
                    >
                      <MapIcon className="size-4" aria-hidden />
                      <ChevronDown
                        className={`size-3.5 text-muted-foreground transition-transform duration-300 ease-in-out motion-reduce:transition-none ${
                          mapsRailExpanded ? 'rotate-180' : 'rotate-0'
                        }`}
                        aria-hidden
                      />
                      <span className="sr-only">
                        {mapsRailExpanded ? 'Weltstruktur einklappen' : 'Weltstruktur ausklappen'}
                      </span>
                    </button>
                    <div
                      id="atlas-maps-rail-list"
                      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none ${
                        mapsRailExpanded
                          ? 'grid-rows-[1fr] opacity-100'
                          : 'pointer-events-none grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div
                          className={`flex w-[11rem] flex-col gap-1 border-t border-border pt-1 transition-transform duration-300 ease-in-out motion-reduce:transition-none ${
                            mapsRailExpanded ? 'translate-y-0' : '-translate-y-1'
                          }`}
                        >
                          <p className="px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {placeNav.length > 0 ? 'Weltstruktur' : 'Karten'}
                          </p>
                          <ul
                            className="max-h-[min(60%,24rem)] space-y-0.5 overflow-auto"
                            data-world-atlas-hierarchy
                            data-atlas-weltstruktur={placeNav.length > 0 ? 'true' : 'false'}
                          >
                            {placeNav.length > 0
                              ? placeNav.map((item) => (
                                  <li key={item.placeId}>
                                    <button
                                      type="button"
                                      tabIndex={mapsRailExpanded ? 0 : -1}
                                      className={`flex min-h-11 w-full items-center rounded-md px-2 text-left text-xs font-semibold ${
                                        item.mapId && item.mapId === editor.activeMapId
                                          ? 'bg-primary text-primary-foreground'
                                          : 'hover:bg-muted'
                                      }`}
                                      data-atlas-place-nav={item.placeId}
                                      onClick={() => {
                                        if (item.mapId) {
                                          editor.setActiveMapId(item.mapId);
                                          setMapsRailExpanded(false);
                                        }
                                      }}
                                    >
                                      <span className="truncate">{item.name}</span>
                                      {!item.located ? (
                                        <span className="ml-1 shrink-0 text-[10px] font-normal opacity-80">
                                          unverortet
                                        </span>
                                      ) : null}
                                    </button>
                                  </li>
                                ))
                              : editor.summaries.map((item) => (
                                  <li key={item.id}>
                                    <button
                                      type="button"
                                      tabIndex={mapsRailExpanded ? 0 : -1}
                                      className={`flex min-h-11 w-full items-center rounded-md px-2 text-left text-xs font-semibold ${
                                        item.id === editor.activeMapId
                                          ? 'bg-primary text-primary-foreground'
                                          : 'hover:bg-muted'
                                      }`}
                                      onClick={() => {
                                        editor.setActiveMapId(item.id);
                                        setMapsRailExpanded(false);
                                      }}
                                    >
                                      <span className="truncate">{item.title}</span>
                                    </button>
                                  </li>
                                ))}
                            {placeNav.length === 0 && editor.summaries.length === 0 ? (
                              <li className="px-2 py-2 text-xs text-muted-foreground">Keine Karte.</li>
                            ) : null}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
              }
              onCreatePlace={
                canEdit
                  ? async (input) => {
                      await handleCreatePlaceFromAtlas({
                        name: input.name,
                        placeKind: input.placeKind,
                        seedKey: input.seedKey,
                        x: input.x,
                        y: input.y,
                      });
                    }
                  : undefined
              }
            />
          ) : (
            <div className="flex h-full min-h-[24rem] items-center justify-center text-sm text-muted-foreground">
              Keine Karte ausgewählt.
            </div>
          )}
        </section>

        <aside
          className={`min-h-0 space-y-4 overflow-auto rounded-lg border border-border p-3 ${
            protoExact
              ? 'hidden'
              : showUnified
                ? 'hidden @[64rem]:block'
                : 'hidden @[48rem]:block'
          }`}
        >
          {!showUnified ? (
            <>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Gespeicherte Karten
              </p>
              {hierarchyList}
            </>
          ) : null}
          <WorldPlacesPanel
            worldProfileId={worldProfileId}
            canEdit={canEdit}
            playerView={playerView}
            sagaPublicId={sagaPublicId}
            activeMapId={editor.activeMapId}
            onOpenMap={(mapId) => editor.setActiveMapId(mapId)}
            onCreateDetailMap={canEdit ? handleCreateDetailMap : undefined}
            onCreatedNode={(info) => {
              setPlaceNavTick((n) => n + 1);
              if (info.targetMapId) editor.setActiveMapId(info.targetMapId);
            }}
          />
          {metaPanel}
        </aside>
      </div>

      {showUnified && !protoExact ? (
        <aside className="hidden rounded-lg border border-border p-2 @[48rem]:block @[64rem]:hidden">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Gespeicherte Karten
          </p>
          <p className="mb-2 px-2 text-[11px] text-muted-foreground">
            Persistierte DB-Karten (Demo-Eldoria ist nicht kanonisch).
          </p>
          {hierarchyList}
          <div className="mt-3 border-t border-border pt-2">
            <WorldPlacesPanel
              worldProfileId={worldProfileId}
              canEdit={canEdit}
              playerView={playerView}
              sagaPublicId={sagaPublicId}
              activeMapId={editor.activeMapId}
              onOpenMap={(mapId) => editor.setActiveMapId(mapId)}
              onCreateDetailMap={canEdit ? handleCreateDetailMap : undefined}
              onCreatedNode={(info) => {
                setPlaceNavTick((n) => n + 1);
                if (info.targetMapId) editor.setActiveMapId(info.targetMapId);
              }}
            />
          </div>
        </aside>
      ) : null}

      {webglActionError ? (
        <p
          className="mx-3 mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
          data-webgl-nav-action-error
        >
          {webglActionError}
        </p>
      ) : null}

      <WebglNavTreeActionHost
        worldProfileId={worldProfileId}
        canEdit={canEdit}
        places={worldPlaces}
        createRequest={webglCreateRequest}
        onCloseCreate={() => setWebglCreateRequest(null)}
        onCreated={(info) => {
          setWebglCreateRequest(null);
          setPlaceNavTick((t) => t + 1);
          setActivePlaceId(info.targetPlaceId);
          if (info.targetMapId) editor.setActiveMapId(info.targetMapId);
        }}
        archivePlaceId={webglArchivePlaceId}
        onCloseArchive={() => setWebglArchivePlaceId(null)}
        onArchived={() => {
          setPlaceNavTick((t) => t + 1);
          if (activePlaceId === webglArchivePlaceId) setActivePlaceId(null);
        }}
        reparentPlaceId={webglReparentPlaceId}
        onCloseReparent={() => setWebglReparentPlaceId(null)}
        onReparented={() => setPlaceNavTick((t) => t + 1)}
      />
    </div>
  );
}
