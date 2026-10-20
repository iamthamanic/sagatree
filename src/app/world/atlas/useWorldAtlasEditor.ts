/**
 * useWorldAtlasEditor — load/list/save hierarchical atlas maps (#702 / #751).
 * Location: src/app/world/atlas/useWorldAtlasEditor.ts
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_ATLAS_BOUNDS,
  DORNHAIN_WORLD_LAYER_TITLE,
  buildDornhainUnifiedGeneratorMeta,
  emptyUnifiedCanvasDoc,
  extractWebglRuntimeFromGeneratorMeta,
  mergeWebglRuntimeIntoGeneratorMeta,
  type WebglRuntimeState,
  extractDungeonMetaFromGeneratorMeta,
  extractUnifiedCanvasFromGeneratorMeta,
  independentPrimaryBounds,
  isAtlasRevisionConflictMessage,
  mergeDungeonMetaIntoGeneratorMeta,
  mergeUnifiedCanvasIntoGeneratorMeta,
  normalizeDornhainWorldLayerTitle,
  reduceAtlasPersistStatus,
  shouldUpgradeDornhainUnifiedToWorld,
  unlocatedChildMapGeneratorMeta,
  type AtlasPersistStatus,
  type DungeonGeneratorMeta,
  type UnifiedCanvasDoc,
  type WorldAtlasFeatureCollection,
  type WorldAtlasMapKind,
  type WorldAtlasMapSummary,
  type WorldAtlasMapVm,
} from '../../../domains/world/atlas';
import { useAuth } from '../../../lib/auth-context';
import { API_AUTH_REQUIRED_DE } from '../../../lib/authenticatedUser';
import { worldAtlasService } from '../../../infrastructure/world/world-atlas-service';

export type UseWorldAtlasEditorOptions = {
  readonly worldProfileId: string | null;
  readonly playerView?: boolean;
  readonly canEdit?: boolean;
};

function pickDefaultMapId(list: readonly WorldAtlasMapSummary[], prev: string | null): string | null {
  if (prev && list.some((m) => m.id === prev)) return prev;
  const world = list.find((m) => m.kind === 'world');
  if (world) return world.id;
  const legacy = list.find((m) => m.kind === 'legacy_tiles');
  return legacy?.id ?? list[0]?.id ?? null;
}

export function useWorldAtlasEditor({
  worldProfileId,
  playerView = false,
  canEdit = false,
}: UseWorldAtlasEditorOptions) {
  const { hasJwtSession, ensureJwtSession, isLoading: authLoading } = useAuth();
  const [summaries, setSummaries] = useState<WorldAtlasMapSummary[]>([]);
  const [activeMapId, setActiveMapId] = useState<string | null>(null);
  const [map, setMap] = useState<WorldAtlasMapVm | null>(null);
  // True on first paint when a world id is present — avoids one commit of non-protoExact chrome.
  const [loading, setLoading] = useState(() => Boolean(worldProfileId?.trim()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [persistStatus, setPersistStatus] = useState<AtlasPersistStatus>('clean');
  const [dirtyLayers, setDirtyLayers] = useState<WorldAtlasFeatureCollection | null>(null);
  const [canvasDoc, setCanvasDoc] = useState<UnifiedCanvasDoc>(emptyUnifiedCanvasDoc(true));
  const [webglRuntime, setWebglRuntime] = useState<WebglRuntimeState | null>(null);
  const [dirtyCanvas, setDirtyCanvas] = useState(false);
  const [dungeonMeta, setDungeonMeta] = useState<DungeonGeneratorMeta | null>(null);
  const saveInFlightRef = useRef(false);
  const persistStatusRef = useRef<AtlasPersistStatus>('clean');
  persistStatusRef.current = persistStatus;

  const bumpPersist = useCallback((event: Parameters<typeof reduceAtlasPersistStatus>[1]) => {
    setPersistStatus((prev) => reduceAtlasPersistStatus(prev, event));
  }, []);

  const reloadList = useCallback(async () => {
    const id = worldProfileId?.trim() ?? '';
    if (!id) {
      setSummaries([]);
      setActiveMapId(null);
      setMap(null);
      return;
    }
    if (authLoading) return;
    if (!hasJwtSession) {
      const ok = await ensureJwtSession();
      if (!ok) {
        setError(API_AUTH_REQUIRED_DE);
        setSummaries([]);
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      let list = canEdit
        ? await worldAtlasService.ensureRoot(id)
        : await worldAtlasService.listMaps(id);

      // Ensure a non-legacy world root so Unified Canvas is the default path.
      // Dornhain geometry comes from DB seed (098); here only a blank non-demo canvas.
      if (canEdit && !list.some((m) => m.kind === 'world')) {
        await worldAtlasService.upsertMap({
          worldProfileId: id,
          mapId: null,
          parentMapId: null,
          kind: 'world',
          title: DORNHAIN_WORLD_LAYER_TITLE,
          bounds: DEFAULT_ATLAS_BOUNDS,
          layers: { type: 'FeatureCollection', features: [] },
          generatorMeta: {
            engine: 'unified_canvas',
            unifiedCanvas: emptyUnifiedCanvasDoc(false),
          },
        });
        list = await worldAtlasService.listMaps(id);
      }

      setSummaries(
        list.map((m) =>
          m.kind === 'world' ? { ...m, title: normalizeDornhainWorldLayerTitle(m.title) } : m,
        ),
      );
      setActiveMapId((prev) => pickDefaultMapId(list, prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Atlas konnte nicht geladen werden.');
      setSummaries([]);
    } finally {
      setLoading(false);
    }
  }, [worldProfileId, canEdit, hasJwtSession, ensureJwtSession, authLoading]);

  useEffect(() => {
    void reloadList();
  }, [reloadList]);

  useEffect(() => {
    let cancelled = false;
    const id = activeMapId;
    if (!id) {
      setMap(null);
      setDirtyLayers(null);
      setCanvasDoc(emptyUnifiedCanvasDoc(true));
      setWebglRuntime(null);
      setDirtyCanvas(false);
      setDungeonMeta(null);
      return;
    }
    setLoading(true);
    setError(null);
    void worldAtlasService
      .getMap(id, playerView)
      .then((vm) => {
        if (cancelled) return;
        const parsed = extractUnifiedCanvasFromGeneratorMeta(vm.generatorMeta);
        const upgrade = shouldUpgradeDornhainUnifiedToWorld(vm.generatorMeta, parsed);
        const nextTitle = normalizeDornhainWorldLayerTitle(vm.title);
        const titleChanged = nextTitle !== vm.title;
        if (upgrade) {
          const worldMeta = buildDornhainUnifiedGeneratorMeta();
          const worldDoc =
            extractUnifiedCanvasFromGeneratorMeta(worldMeta) ?? emptyUnifiedCanvasDoc(false);
          setMap({ ...vm, title: nextTitle, generatorMeta: { ...vm.generatorMeta, ...worldMeta } });
          setCanvasDoc(worldDoc);
          setDirtyCanvas(true);
          setPersistStatus((prev) => reduceAtlasPersistStatus(prev, { type: 'edit' }));
        } else if (titleChanged) {
          setMap({ ...vm, title: nextTitle });
          setCanvasDoc(parsed ?? emptyUnifiedCanvasDoc(true));
          setDirtyCanvas(true);
          setPersistStatus((prev) => reduceAtlasPersistStatus(prev, { type: 'edit' }));
        } else {
          setMap(vm);
          setCanvasDoc(parsed ?? emptyUnifiedCanvasDoc(true));
          setDirtyCanvas(false);
          setPersistStatus((prev) => reduceAtlasPersistStatus(prev, { type: 'reload' }));
        }
        if (upgrade || titleChanged) {
          setSummaries((prev) =>
            prev.map((s) => (s.id === vm.id ? { ...s, title: nextTitle } : s)),
          );
        }
        setDirtyLayers(null);
        setWebglRuntime(extractWebglRuntimeFromGeneratorMeta(vm.generatorMeta));
        setDungeonMeta(extractDungeonMetaFromGeneratorMeta(vm.generatorMeta));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Karte konnte nicht geladen werden.');
        setMap(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeMapId, playerView]);

  const updateCanvasDoc = useCallback(
    (next: UnifiedCanvasDoc) => {
      setCanvasDoc(next);
      setDirtyCanvas(true);
      bumpPersist({ type: 'edit' });
    },
    [bumpPersist],
  );

  const updateDungeonMeta = useCallback(
    (next: DungeonGeneratorMeta | null) => {
      setDungeonMeta(next);
      setDirtyCanvas(true);
      bumpPersist({ type: 'edit' });
    },
    [bumpPersist],
  );

  const updateWebglRuntime = useCallback(
    (next: WebglRuntimeState | null) => {
      setWebglRuntime(next);
      setDirtyCanvas(true);
      bumpPersist({ type: 'edit' });
    },
    [bumpPersist],
  );

  const reloadActiveMap = useCallback(async () => {
    const id = activeMapId?.trim();
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const next = await worldAtlasService.getMap(id, playerView);
      setMap(next);
      const parsed = extractUnifiedCanvasFromGeneratorMeta(next.generatorMeta);
      setCanvasDoc(parsed ?? emptyUnifiedCanvasDoc(false));
      setWebglRuntime(extractWebglRuntimeFromGeneratorMeta(next.generatorMeta));
      setDungeonMeta(extractDungeonMetaFromGeneratorMeta(next.generatorMeta));
      setDirtyCanvas(false);
      setDirtyLayers(null);
      bumpPersist({ type: 'reload' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Karte konnte nicht neu geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [activeMapId, playerView, bumpPersist]);

  const saveCanvas = useCallback(async () => {
    if (!map || !canEdit) return;
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setSaving(true);
    setError(null);
    bumpPersist({ type: 'save_start' });
    try {
      let generatorMeta = mergeUnifiedCanvasIntoGeneratorMeta(map.generatorMeta, canvasDoc);
      if (webglRuntime) {
        generatorMeta = mergeWebglRuntimeIntoGeneratorMeta(generatorMeta, webglRuntime);
      }
      if (dungeonMeta) {
        generatorMeta = mergeDungeonMetaIntoGeneratorMeta(generatorMeta, dungeonMeta);
      }
      const next = await worldAtlasService.upsertMap({
        worldProfileId: map.worldProfileId,
        mapId: map.id,
        parentMapId: map.parentMapId,
        kind: map.kind === 'legacy_tiles' ? 'world' : map.kind,
        title: map.title,
        sortOrder: map.sortOrder,
        bounds: map.bounds,
        layers: dirtyLayers ?? map.layers,
        basemapStoragePath: map.basemapStoragePath,
        azgaarMapStoragePath: map.azgaarMapStoragePath,
        generatorMeta,
        expectedRevision: map.revision,
      });
      setMap(next);
      const parsed = extractUnifiedCanvasFromGeneratorMeta(next.generatorMeta);
      setCanvasDoc(parsed ?? canvasDoc);
      setWebglRuntime(extractWebglRuntimeFromGeneratorMeta(next.generatorMeta));
      setDungeonMeta(extractDungeonMetaFromGeneratorMeta(next.generatorMeta));
      setDirtyCanvas(false);
      bumpPersist({ type: 'save_ok' });
      await reloadList();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Speichern fehlgeschlagen.';
      const conflict = isAtlasRevisionConflictMessage(message);
      setError(message);
      bumpPersist({ type: 'save_fail', conflict });
      throw err;
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }, [map, canEdit, canvasDoc, dirtyLayers, dungeonMeta, webglRuntime, reloadList, bumpPersist]);

  const saveLayers = useCallback(
    async (layers: WorldAtlasFeatureCollection) => {
      if (!map || !canEdit) return;
      setSaving(true);
      setError(null);
      try {
        const next = await worldAtlasService.upsertMap({
          worldProfileId: map.worldProfileId,
          mapId: map.id,
          parentMapId: map.parentMapId,
          kind: map.kind,
          title: map.title,
          sortOrder: map.sortOrder,
          bounds: map.bounds,
          layers,
          basemapStoragePath: map.basemapStoragePath,
          azgaarMapStoragePath: map.azgaarMapStoragePath,
          generatorMeta: map.generatorMeta,
          expectedRevision: map.revision,
        });
        setMap(next);
        setDirtyLayers(null);
        await reloadList();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [map, canEdit, reloadList],
  );

  const createChildMap = useCallback(
    async (
      title: string,
      options?: {
        readonly kind?: WorldAtlasMapKind;
        readonly generatorMeta?: Readonly<Record<string, unknown>>;
      },
    ): Promise<WorldAtlasMapVm | null> => {
      if (!map || !canEdit || !worldProfileId) return null;
      setSaving(true);
      setError(null);
      try {
        const kind = options?.kind && options.kind !== 'legacy_tiles' ? options.kind : 'region';
        // #722: own local frame — never clone parent bounds.
        const next = await worldAtlasService.upsertMap({
          worldProfileId,
          mapId: null,
          parentMapId: map.id,
          kind,
          title: title.trim() || 'Detailkarte',
          bounds: independentPrimaryBounds(),
          layers: { type: 'FeatureCollection', features: [] },
          generatorMeta: unlocatedChildMapGeneratorMeta({
            ...(options?.generatorMeta ?? {}),
          }),
        });
        await reloadList();
        setActiveMapId(next.id);
        return next;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Detailkarte fehlgeschlagen.');
        return null;
      } finally {
        setSaving(false);
      }
    },
    [map, canEdit, worldProfileId, reloadList],
  );

  const importAzgaarMap = useCallback(
    async (file: File) => {
      if (!map || !canEdit || !worldProfileId) return;
      setSaving(true);
      setError(null);
      try {
        const path = await worldAtlasService.uploadAzgaarMapFile(worldProfileId, file);
        const generatorMeta = mergeUnifiedCanvasIntoGeneratorMeta(
          { ...map.generatorMeta, engine: 'azgaar', importedAt: new Date().toISOString() },
          canvasDoc,
        );
        const next = await worldAtlasService.upsertMap({
          worldProfileId,
          mapId: map.id,
          parentMapId: map.parentMapId,
          kind: map.kind === 'legacy_tiles' ? 'world' : map.kind,
          title: map.title,
          sortOrder: map.sortOrder,
          bounds: map.bounds,
          layers: dirtyLayers ?? map.layers,
          basemapStoragePath: map.basemapStoragePath,
          azgaarMapStoragePath: path,
          generatorMeta,
          expectedRevision: map.revision,
        });
        setMap(next);
        setDirtyCanvas(false);
        await reloadList();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Azgaar-Import fehlgeschlagen.');
      } finally {
        setSaving(false);
      }
    },
    [map, canEdit, worldProfileId, dirtyLayers, canvasDoc, reloadList],
  );

  const breadcrumb = (() => {
    if (!map) return [] as WorldAtlasMapSummary[];
    const byId = new Map(summaries.map((s) => [s.id, s]));
    const chain: WorldAtlasMapSummary[] = [];
    let cur: WorldAtlasMapSummary | undefined = byId.get(map.id);
    const guard = new Set<string>();
    while (cur && !guard.has(cur.id)) {
      guard.add(cur.id);
      chain.unshift(cur);
      cur = cur.parentMapId ? byId.get(cur.parentMapId) : undefined;
    }
    return chain;
  })();

  const setActiveMapIdGuarded = useCallback(
    (nextId: string | null) => {
      if (
        dirtyCanvas &&
        persistStatusRef.current !== 'clean' &&
        persistStatusRef.current !== 'saved' &&
        nextId !== activeMapId
      ) {
        const ok =
          typeof window === 'undefined'
            ? true
            : window.confirm(
                'Ungespeicherte Änderungen verwerfen und die Karte wechseln?',
              );
        if (!ok) return;
      }
      setActiveMapId(nextId);
      if (nextId !== activeMapId) {
        setDirtyCanvas(false);
        bumpPersist({ type: 'reload' });
      }
    },
    [activeMapId, dirtyCanvas, bumpPersist],
  );

  return {
    summaries,
    activeMapId,
    setActiveMapId: setActiveMapIdGuarded,
    map,
    loading,
    saving,
    error,
    persistStatus,
    dirtyLayers,
    setDirtyLayers,
    canvasDoc,
    updateCanvasDoc,
    webglRuntime,
    updateWebglRuntime,
    dirtyCanvas,
    dungeonMeta,
    updateDungeonMeta,
    saveCanvas,
    saveLayers,
    createChildMap,
    importAzgaarMap,
    reloadActiveMap,
    breadcrumb,
    reloadList,
  };
}
