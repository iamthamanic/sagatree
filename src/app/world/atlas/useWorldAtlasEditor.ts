/**
 * useWorldAtlasEditor — load/list/save hierarchical atlas maps (#702 / #751).
 * Location: src/app/world/atlas/useWorldAtlasEditor.ts
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_ATLAS_BOUNDS,
  DORNHAIN_GOLDEN_MAPS,
  DORNHAIN_GOLDEN_PLACES,
  DORNHAIN_WORLD_LAYER_TITLE,
  DORNHAIN_WORLD_MAP_SEED,
  buildDornhainGoldenChildGeneratorMeta,
  buildDornhainUnifiedGeneratorMeta,
  emptyUnifiedCanvasDoc,
  extractWebglRuntimeFromGeneratorMeta,
  type WebglRuntimeState,
  extractDungeonMetaFromGeneratorMeta,
  extractUnifiedCanvasFromGeneratorMeta,
  hydrateCanvasFromLegacyWebgl,
  independentPrimaryBounds,
  ATLAS_AUTOSAVE_DEBOUNCE_MS,
  decideAtlasAutosave,
  isAtlasRevisionConflictMessage,
  isDornhainGoldenRootMap,
  locateChildMapFrame,
  mergeCanonicalAtlasGeometryForPersist,
  mergeDungeonMetaIntoGeneratorMeta,
  mergeMapFrameIntoGeneratorMeta,
  mergeUnifiedCanvasIntoGeneratorMeta,
  normalizeDornhainWorldLayerTitle,
  planDornhainGoldenReset,
  reduceAtlasPersistStatus,
  shouldUpgradeDornhainUnifiedToWorld,
  unlocatedChildMapGeneratorMeta,
  type AtlasPersistStatus,
  type DornhainGoldenResetMode,
  type DungeonGeneratorMeta,
  type UnifiedCanvasDoc,
  type WorldAtlasFeatureCollection,
  type WorldAtlasMapKind,
  type WorldAtlasMapSummary,
  type WorldAtlasMapVm,
} from '../../../domains/world/atlas';
import { useAuth } from '../../../lib/auth-context';
import { API_AUTH_REQUIRED_DE } from '../../../lib/authenticatedUser';
import { isHostLibraryEnabled } from '../../../infrastructure/host/host-library-http';
import { worldAtlasService } from '../../../infrastructure/world/world-atlas-service';
import { worldPlaceService } from '../../../infrastructure/world/world-place-service';

export type UseWorldAtlasEditorOptions = {
  readonly worldProfileId: string | null;
  readonly playerView?: boolean;
  readonly canEdit?: boolean;
  /** Required for player projection — list/get must carry saga context. */
  readonly sagaPublicId?: string | null;
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
  sagaPublicId = null,
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
  /**
   * Bumps only when map content is replaced from outside the editor (load, reload, reset,
   * import). Own autosaves keep it stable so editors are not remounted mid-session.
   */
  const [contentEpoch, setContentEpoch] = useState(0);
  const bumpContentEpoch = useCallback(() => setContentEpoch((n) => n + 1), []);
  const canvasDocRef = useRef(canvasDoc);
  canvasDocRef.current = canvasDoc;
  const webglRuntimeRef = useRef(webglRuntime);
  webglRuntimeRef.current = webglRuntime;
  const dungeonMetaRef = useRef(dungeonMeta);
  dungeonMetaRef.current = dungeonMeta;
  const saveInFlightRef = useRef(false);
  const persistStatusRef = useRef<AtlasPersistStatus>('clean');
  persistStatusRef.current = persistStatus;
  const pendingOpsRef = useRef(0);
  const lastEditAtRef = useRef(0);

  const bumpPersist = useCallback((event: Parameters<typeof reduceAtlasPersistStatus>[1]) => {
    setPersistStatus((prev) => reduceAtlasPersistStatus(prev, event));
  }, []);

  const noteLocalEdit = useCallback(() => {
    pendingOpsRef.current += 1;
    lastEditAtRef.current = Date.now();
    bumpPersist({ type: 'edit' });
  }, [bumpPersist]);

  const reloadList = useCallback(async () => {
    const id = worldProfileId?.trim() ?? '';
    if (!id) {
      setSummaries([]);
      setActiveMapId(null);
      setMap(null);
      return;
    }
    if (authLoading) return;
    // FE-HOST-07: host library uses Better Auth cookies — no GoTrue JWT reconnect.
    if (!isHostLibraryEnabled() && !hasJwtSession) {
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
      const listOpts = { playerView, sagaPublicId };
      let list = canEdit
        ? await worldAtlasService.ensureRoot(id)
        : await worldAtlasService.listMaps(id, listOpts);

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
        list = await worldAtlasService.listMaps(id, listOpts);
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
  }, [worldProfileId, canEdit, playerView, sagaPublicId, hasJwtSession, ensureJwtSession, authLoading]);

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
      .getMap(id, playerView, sagaPublicId)
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
          setWebglRuntime(extractWebglRuntimeFromGeneratorMeta(worldMeta));
          setDirtyCanvas(true);
          setPersistStatus((prev) => reduceAtlasPersistStatus(prev, { type: 'edit' }));
        } else if (titleChanged) {
          const hydrated = hydrateCanvasFromLegacyWebgl(vm.generatorMeta, true);
          setMap({ ...vm, title: nextTitle });
          setCanvasDoc(hydrated.canvas);
          setWebglRuntime(hydrated.runtime);
          setDirtyCanvas(true);
          setPersistStatus((prev) => reduceAtlasPersistStatus(prev, { type: 'edit' }));
        } else {
          const hydrated = hydrateCanvasFromLegacyWebgl(vm.generatorMeta, true);
          setMap(vm);
          setCanvasDoc(hydrated.canvas);
          setWebglRuntime(hydrated.runtime);
          if (hydrated.migrated) {
            setDirtyCanvas(true);
            setPersistStatus((prev) => reduceAtlasPersistStatus(prev, { type: 'edit' }));
          } else {
            setDirtyCanvas(false);
            setPersistStatus((prev) => reduceAtlasPersistStatus(prev, { type: 'reload' }));
          }
        }
        if (upgrade || titleChanged) {
          setSummaries((prev) =>
            prev.map((s) => (s.id === vm.id ? { ...s, title: nextTitle } : s)),
          );
        }
        setDirtyLayers(null);
        setDungeonMeta(extractDungeonMetaFromGeneratorMeta(vm.generatorMeta));
        bumpContentEpoch();
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
  }, [activeMapId, playerView, sagaPublicId, bumpContentEpoch]);

  const updateCanvasDoc = useCallback(
    (next: UnifiedCanvasDoc) => {
      setCanvasDoc(next);
      setDirtyCanvas(true);
      noteLocalEdit();
    },
    [noteLocalEdit],
  );

  const updateDungeonMeta = useCallback(
    (next: DungeonGeneratorMeta | null) => {
      setDungeonMeta(next);
      setDirtyCanvas(true);
      noteLocalEdit();
    },
    [noteLocalEdit],
  );

  const updateWebglRuntime = useCallback(
    (next: WebglRuntimeState | null) => {
      setWebglRuntime(next);
      setDirtyCanvas(true);
      noteLocalEdit();
    },
    [noteLocalEdit],
  );

  const reloadActiveMap = useCallback(async () => {
    const id = activeMapId?.trim();
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const next = await worldAtlasService.getMap(id, playerView, sagaPublicId);
      setMap(next);
      const hydrated = hydrateCanvasFromLegacyWebgl(next.generatorMeta, false);
      setCanvasDoc(hydrated.canvas);
      setWebglRuntime(hydrated.runtime);
      setDungeonMeta(extractDungeonMetaFromGeneratorMeta(next.generatorMeta));
      setDirtyCanvas(hydrated.migrated);
      setDirtyLayers(null);
      bumpContentEpoch();
      bumpPersist({ type: hydrated.migrated ? 'edit' : 'reload' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Karte konnte nicht neu geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [activeMapId, playerView, sagaPublicId, bumpPersist, bumpContentEpoch]);

  const saveCanvas = useCallback(async () => {
    if (!map || !canEdit) return;
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setSaving(true);
    setError(null);
    bumpPersist({ type: 'save_start' });
    const sentDoc = canvasDoc;
    const sentRuntime = webglRuntime;
    const sentDungeon = dungeonMeta;
    try {
      // ATL2-B04: persist geometry only via unifiedCanvas; strip webglRuntimeV3 geometry shadow.
      let generatorMeta = mergeCanonicalAtlasGeometryForPersist(
        map.generatorMeta,
        canvasDoc,
        webglRuntime,
      );
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
      // Edits made while the request was in flight stay dirty for the next autosave.
      const editedDuringSave =
        canvasDocRef.current !== sentDoc ||
        webglRuntimeRef.current !== sentRuntime ||
        dungeonMetaRef.current !== sentDungeon;
      if (!editedDuringSave) {
        const parsed = extractUnifiedCanvasFromGeneratorMeta(next.generatorMeta);
        setCanvasDoc(parsed ?? canvasDoc);
        setWebglRuntime(extractWebglRuntimeFromGeneratorMeta(next.generatorMeta));
        setDungeonMeta(extractDungeonMetaFromGeneratorMeta(next.generatorMeta));
        setDirtyCanvas(false);
      }
      if (!editedDuringSave) {
        pendingOpsRef.current = 0;
      }
      bumpPersist({ type: 'save_ok' });
      if (editedDuringSave) {
        noteLocalEdit();
      }
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
  }, [
    map,
    canEdit,
    canvasDoc,
    dirtyLayers,
    dungeonMeta,
    webglRuntime,
    reloadList,
    bumpPersist,
    noteLocalEdit,
  ]);

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

  /**
   * Persist a parent-space locate rect onto a child primary map (#722 Steps 3+4).
   * Call while the parent map is active; does not invent meters.
   */
  const locateChildOnParent = useCallback(
    async (input: {
      readonly childMapId: string;
      readonly minX: number;
      readonly minY: number;
      readonly maxX: number;
      readonly maxY: number;
      readonly rotationRad?: number;
      readonly metersPerUnit?: number | null;
      /** When set, also upsert an overview pin on the parent map. */
      readonly childPlaceId?: string | null;
    }): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: string }> => {
      if (!map || !canEdit || !worldProfileId) {
        return { ok: false, reason: 'Keine Bearbeitungsrechte oder keine Elternkarte.' };
      }
      const childMapId = input.childMapId.trim();
      if (!childMapId || childMapId === map.id) {
        return { ok: false, reason: 'Kindkarte fehlt oder ist die aktuelle Karte.' };
      }
      const located = locateChildMapFrame({
        parentMapId: map.id,
        minX: input.minX,
        minY: input.minY,
        maxX: input.maxX,
        maxY: input.maxY,
        rotationRad: input.rotationRad,
        metersPerUnit: input.metersPerUnit,
      });
      if (located.ok === false) {
        setError(located.reason);
        return { ok: false, reason: located.reason };
      }
      setSaving(true);
      setError(null);
      try {
        const child = await worldAtlasService.getMap(childMapId, playerView, sagaPublicId);
        if (child.parentMapId && child.parentMapId !== map.id) {
          const reason = 'Kindkarte gehört nicht zur aktuellen Elternkarte.';
          setError(reason);
          return { ok: false, reason };
        }
        const generatorMeta = mergeMapFrameIntoGeneratorMeta(child.generatorMeta, located.frame);
        await worldAtlasService.upsertMap({
          worldProfileId: child.worldProfileId,
          mapId: child.id,
          parentMapId: child.parentMapId ?? map.id,
          kind: child.kind === 'legacy_tiles' ? 'region' : child.kind,
          title: child.title,
          sortOrder: child.sortOrder,
          bounds: child.bounds,
          layers: child.layers,
          basemapStoragePath: child.basemapStoragePath,
          azgaarMapStoragePath: child.azgaarMapStoragePath,
          generatorMeta,
          expectedRevision: child.revision,
        });
        const placeId = input.childPlaceId?.trim();
        if (placeId) {
          await worldPlaceService.linkMap({
            worldProfileId,
            placeId,
            mapId: map.id,
            usage: 'overview',
            anchor: {
              x: located.anchor.centerX,
              y: located.anchor.centerY,
              extentX: located.anchor.extentX,
              extentY: located.anchor.extentY,
            },
          });
        }
        await reloadList();
        return { ok: true };
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'Verorten fehlgeschlagen.';
        setError(reason);
        return { ok: false, reason };
      } finally {
        setSaving(false);
      }
    },
    [map, canEdit, worldProfileId, playerView, sagaPublicId, reloadList],
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
        bumpContentEpoch();
        await reloadList();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Azgaar-Import fehlgeschlagen.');
      } finally {
        setSaving(false);
      }
    },
    [map, canEdit, worldProfileId, dirtyLayers, canvasDoc, reloadList, bumpContentEpoch],
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

  /** Returns false when the user cancels an unsaved-change confirm (ATL2-E03). */
  const setActiveMapIdGuarded = useCallback(
    (nextId: string | null): boolean => {
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
        if (!ok) return false;
      }
      setActiveMapId(nextId);
      if (nextId !== activeMapId) {
        setDirtyCanvas(false);
        bumpPersist({ type: 'reload' });
      }
      return true;
    },
    [activeMapId, dirtyCanvas, bumpPersist],
  );
  const resetToGolden = useCallback(
    async (mode: DornhainGoldenResetMode): Promise<{ readonly noteDe: string | null }> => {
      if (!map || !canEdit) {
        throw new Error('Keine Bearbeitungsrechte für Reset auf Golden.');
      }
      if (
        !isDornhainGoldenRootMap({
          parentMapId: map.parentMapId,
          kind: map.kind,
          generatorMeta: map.generatorMeta,
        })
      ) {
        throw new Error(
          'Reset auf Golden ist nur für die Dornhain-Weltwurzelkarte verfügbar — nicht für Detailkarten oder andere Welten.',
        );
      }
      const plan = planDornhainGoldenReset(mode, { sessionProgressResetAvailable: false });
      setSaving(true);
      setError(null);
      bumpPersist({ type: 'save_start' });
      try {
        const worldRootId = map.parentMapId
          ? (summaries.find((s) => s.kind === 'world')?.id ?? map.id)
          : map.id;

        if (plan.restoreCanvas) {
          const worldMeta = buildDornhainUnifiedGeneratorMeta();
          const worldDoc =
            extractUnifiedCanvasFromGeneratorMeta(worldMeta) ?? emptyUnifiedCanvasDoc(false);
          const rootSummary = summaries.find((s) => s.id === worldRootId) ?? null;
          const rootVm =
            map.id === worldRootId
              ? map
              : await worldAtlasService.getMap(worldRootId, false, sagaPublicId);
          const nextRoot = await worldAtlasService.upsertMap({
            worldProfileId: rootVm.worldProfileId,
            mapId: rootVm.id,
            parentMapId: rootVm.parentMapId,
            kind: rootVm.kind === 'legacy_tiles' ? 'world' : rootVm.kind,
            title:
              normalizeDornhainWorldLayerTitle(rootVm.title) || DORNHAIN_WORLD_LAYER_TITLE,
            sortOrder: rootVm.sortOrder,
            bounds: rootVm.bounds,
            layers: rootVm.layers,
            basemapStoragePath: rootVm.basemapStoragePath,
            azgaarMapStoragePath: rootVm.azgaarMapStoragePath,
            generatorMeta: {
              ...rootVm.generatorMeta,
              ...worldMeta,
              seed: DORNHAIN_WORLD_MAP_SEED,
            },
            expectedRevision: rootVm.revision,
          });
          void rootSummary;

          const listed = await worldAtlasService.listMaps(map.worldProfileId, {
            playerView: false,
            sagaPublicId,
          });
          const mapsBySeed = new Map<string, Awaited<ReturnType<typeof worldAtlasService.getMap>>>();
          mapsBySeed.set(DORNHAIN_WORLD_MAP_SEED, nextRoot);
          for (const summary of listed) {
            if (summary.id === nextRoot.id) continue;
            const vm = await worldAtlasService.getMap(summary.id, false, sagaPublicId);
            const seed = typeof vm.generatorMeta.seed === 'string' ? vm.generatorMeta.seed : null;
            if (seed) mapsBySeed.set(seed, vm);
          }

          for (const childSpec of DORNHAIN_GOLDEN_MAPS) {
            const parentSeed = childSpec.parentMapSeedKey ?? DORNHAIN_WORLD_MAP_SEED;
            const parentVm = mapsBySeed.get(parentSeed);
            if (!parentVm) {
              throw new Error(`Golden-Elternkarte fehlt: ${parentSeed}`);
            }
            const generatorMeta = buildDornhainGoldenChildGeneratorMeta(childSpec, parentVm.id);
            const prev = mapsBySeed.get(childSpec.seedKey) ?? null;
            const saved = await worldAtlasService.upsertMap({
              worldProfileId: map.worldProfileId,
              mapId: prev?.id ?? null,
              parentMapId: parentVm.id,
              kind: childSpec.kind,
              title: childSpec.title,
              sortOrder: prev?.sortOrder ?? 0,
              bounds: prev?.bounds ?? parentVm.bounds,
              layers: prev?.layers ?? { type: 'FeatureCollection', features: [] },
              basemapStoragePath: prev?.basemapStoragePath ?? null,
              azgaarMapStoragePath: prev?.azgaarMapStoragePath ?? null,
              generatorMeta: prev
                ? { ...prev.generatorMeta, ...generatorMeta }
                : generatorMeta,
              expectedRevision: prev?.revision ?? null,
            });
            mapsBySeed.set(childSpec.seedKey, saved);
          }

          if (map.id === nextRoot.id) {
            setMap(nextRoot);
            setCanvasDoc(
              extractUnifiedCanvasFromGeneratorMeta(nextRoot.generatorMeta) ?? worldDoc,
            );
            setWebglRuntime(extractWebglRuntimeFromGeneratorMeta(nextRoot.generatorMeta));
            setDungeonMeta(extractDungeonMetaFromGeneratorMeta(nextRoot.generatorMeta));
          } else {
            await reloadActiveMap();
          }
          setDirtyCanvas(false);
          setDirtyLayers(null);
          bumpContentEpoch();
        }

        if (plan.restoreGoldenPlaces) {
          const existing = await worldPlaceService.listPlaces(map.worldProfileId, {
            playerView: false,
            sagaPublicId,
          });
          const bySeed = new Map(
            existing
              .filter((p) => typeof p.seedKey === 'string' && p.seedKey.length > 0)
              .map((p) => [p.seedKey as string, p]),
          );
          const listedAfter = await worldAtlasService.listMaps(map.worldProfileId, {
            playerView: false,
            sagaPublicId,
          });
          const mapsBySeed = new Map<string, string>();
          mapsBySeed.set(DORNHAIN_WORLD_MAP_SEED, worldRootId);
          for (const summary of listedAfter) {
            const vm = await worldAtlasService.getMap(summary.id, false, sagaPublicId);
            const seed = typeof vm.generatorMeta.seed === 'string' ? vm.generatorMeta.seed : null;
            if (seed) mapsBySeed.set(seed, vm.id);
          }
          for (const spec of DORNHAIN_GOLDEN_PLACES) {
            const parentId = spec.parentSeedKey
              ? (bySeed.get(spec.parentSeedKey)?.id ?? null)
              : null;
            const prev = bySeed.get(spec.seedKey);
            const saved = await worldPlaceService.upsertPlace({
              worldProfileId: map.worldProfileId,
              placeId: prev?.id ?? null,
              parentPlaceId: parentId,
              kind: spec.kind,
              name: spec.name,
              description: spec.description,
              status: 'canonical',
              seedKey: spec.seedKey,
              sortOrder: spec.sortOrder,
            });
            bySeed.set(spec.seedKey, saved);
            const mapSpec = DORNHAIN_GOLDEN_MAPS.find((m) => m.placeSeedKey === spec.seedKey);
            const childMapId = mapSpec ? mapsBySeed.get(mapSpec.seedKey) : null;
            if (childMapId) {
              await worldPlaceService.linkMap({
                worldProfileId: map.worldProfileId,
                placeId: saved.id,
                mapId: childMapId,
                usage: 'primary',
                featureId: saved.id,
                anchor: {},
              });
            }
            if (spec.anchor) {
              const parentMapId = mapSpec?.parentMapSeedKey
                ? (mapsBySeed.get(mapSpec.parentMapSeedKey) ?? worldRootId)
                : worldRootId;
              await worldPlaceService.linkMap({
                worldProfileId: map.worldProfileId,
                placeId: saved.id,
                mapId: parentMapId,
                usage: 'overview',
                featureId: saved.id,
                anchor: { x: spec.anchor.x, y: spec.anchor.y, source: DORNHAIN_WORLD_MAP_SEED },
              });
            }
          }
        }

        bumpPersist({ type: 'save_ok' });
        await reloadList();
        return { noteDe: plan.sessionProgressNoteDe };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Reset auf Golden fehlgeschlagen.';
        const conflict = isAtlasRevisionConflictMessage(message);
        setError(message);
        bumpPersist({ type: 'save_fail', conflict });
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [
      map,
      canEdit,
      sagaPublicId,
      summaries,
      reloadList,
      reloadActiveMap,
      bumpPersist,
      bumpContentEpoch,
    ],
  );

  /** ATL2-C04: contract-driven autosave decision (never save while conflicted). */
  const autosaveDecision = useCallback(() => {
    return decideAtlasAutosave({
      status: persistStatusRef.current,
      pendingOps: pendingOpsRef.current,
      msSinceLastEdit: Math.max(0, Date.now() - lastEditAtRef.current),
    });
  }, []);

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
    locateChildOnParent,
    importAzgaarMap,
    reloadActiveMap,
    breadcrumb,
    reloadList,
    resetToGolden,
    contentEpoch,
    autosaveDecision,
    autosaveDebounceMs: ATLAS_AUTOSAVE_DEBOUNCE_MS,
  };
}
