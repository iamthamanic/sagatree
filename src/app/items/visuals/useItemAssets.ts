/**
 * useItemAssets — reusable item thumbnail (#140/#643) + model3d (#141) UI state.
 * Thumbnail upload: Object URL preview first, then item-thumbnail optimize via service.
 * Network via itemThumbnailService / itemModel3dService only; no backend-client imports.
 * Location: src/app/items/visuals/useItemAssets.ts
 */
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { ItemDefinition } from '../../../domains/character/inventory-v2';
import {
  parseItemModel3dAssetKey,
  parseItemThumbnailAssetKey,
} from '../../../domains/items';
import {
  itemModel3dService,
  type ItemModel3dJobUiStatus,
} from '../../../infrastructure/inventory/item-model3d-service';
import {
  itemThumbnailService,
  type ItemThumbnailJobUiStatus,
} from '../../../infrastructure/inventory/item-thumbnail-service';
import { queuePendingItemAsset, takePendingItemAsset } from './itemAssetPending';

export type ItemAssetsPhase =
  | 'idle'
  | 'uploading'
  | 'confirm-generate'
  | 'starting'
  | 'waiting'
  | 'generating'
  | 'failed';

export interface UseItemAssetsOptions {
  definition: ItemDefinition | null;
  readOnly: boolean;
  onAssetKeyChange: (assetKey: string | undefined) => void;
  /** Auto-create draft before first upload/generate when create has no definition id yet. */
  ensureDraftId?: () => Promise<string | null>;
}

function mapJobToPhase(status: ItemThumbnailJobUiStatus): ItemAssetsPhase {
  if (status === 'waiting') return 'waiting';
  if (status === 'generating') return 'generating';
  if (status === 'failed' || status === 'canceled') return 'failed';
  return 'idle';
}

export function useItemAssets({
  definition,
  readOnly,
  onAssetKeyChange,
  ensureDraftId,
}: UseItemAssetsOptions) {
  const definitionId = definition?.id ?? null;
  const canEdit = !readOnly;
  const canMutate =
    canEdit &&
    !!definitionId &&
    (definition?.scope === 'personal' || definition?.scope === 'world');

  const [meshyConfigured, setMeshyConfigured] = useState(false);
  const [phase, setPhase] = useState<ItemAssetsPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [userExtra, setUserExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<number | null>(null);
  const submitLock = useRef(false);
  const ensureDraftIdRef = useRef(ensureDraftId);
  ensureDraftIdRef.current = ensureDraftId;
  const onAssetKeyChangeRef = useRef(onAssetKeyChange);
  onAssetKeyChangeRef.current = onAssetKeyChange;
  const pendingHandledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void itemThumbnailService.getConfig().then((config) => {
      if (!cancelled) setMeshyConfigured(config.meshyConfigured);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (localPreviewUrl) {
      return () => URL.revokeObjectURL(localPreviewUrl);
    }
    return undefined;
  }, [localPreviewUrl]);

  useEffect(() => {
    const key = definition?.assetKey;
    if (!key || !parseItemThumbnailAssetKey(key)) {
      setResolvedUrl(null);
      return;
    }
    let cancelled = false;
    void itemThumbnailService.resolveSignedUrl(key).then((url) => {
      if (!cancelled) setResolvedUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [definition?.assetKey]);

  useEffect(() => {
    if (!definitionId || !canMutate) return;
    let cancelled = false;
    void itemThumbnailService.loadLatestJob(definitionId).then((job) => {
      if (cancelled || !job) return;
      if (job.jobStatus === 'waiting' || job.jobStatus === 'generating') {
        setJobId(job.jobId);
        setPhase(mapJobToPhase(job.jobStatus));
        setProgress(job.progress);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [definitionId, canMutate]);

  useEffect(() => {
    if (!jobId || (phase !== 'waiting' && phase !== 'generating')) {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const tick = async () => {
      try {
        const snap = await itemThumbnailService.pollJob(jobId);
        setProgress(snap.progress);
        if (snap.jobStatus === 'succeeded') {
          setPhase('idle');
          setJobId(null);
          setErrorMessage('');
          if (snap.signedUrl) setResolvedUrl(snap.signedUrl);
          setLocalPreviewUrl(null);
          if (snap.assetKey) onAssetKeyChangeRef.current(snap.assetKey);
          toast.success('Thumbnail generiert');
          return;
        }
        if (snap.jobStatus === 'failed' || snap.jobStatus === 'canceled') {
          setPhase('failed');
          setErrorMessage(snap.errorMessage || 'Generierung fehlgeschlagen');
          setJobId(null);
          return;
        }
        setPhase(mapJobToPhase(snap.jobStatus));
      } catch (error) {
        setPhase('failed');
        setErrorMessage(error instanceof Error ? error.message : 'Statusabfrage fehlgeschlagen');
        setJobId(null);
      }
    };

    void tick();
    pollRef.current = window.setInterval(() => {
      void tick();
    }, 2500);

    return () => {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [jobId, phase]);

  const displayUrl = localPreviewUrl || resolvedUrl;

  const runUpload = async (id: string, file: File) => {
    if (submitLock.current) return;
    submitLock.current = true;
    setBusy(true);
    setErrorMessage('');
    // Immediate local preview before encode/upload (#643).
    const preview = URL.createObjectURL(file);
    setLocalPreviewUrl(preview);
    setPhase('uploading');
    try {
      // item-thumbnail optimizer (WebP-capable) then existing Edge upload; no silent original.
      const result = await itemThumbnailService.uploadThumbnail(id, file);
      setResolvedUrl(result.signedUrl);
      onAssetKeyChangeRef.current(result.assetKey);
      setPhase('idle');
      toast.success('Thumbnail hochgeladen');
    } catch (error) {
      // Keep preview for retry; do not clear resolvedUrl — old asset survives failures (#643).
      setPhase('failed');
      setErrorMessage(error instanceof Error ? error.message : 'Upload fehlgeschlagen');
      toast.error(error instanceof Error ? error.message : 'Upload fehlgeschlagen');
    } finally {
      setBusy(false);
      submitLock.current = false;
    }
  };

  const runUploadRef = useRef(runUpload);
  runUploadRef.current = runUpload;

  useEffect(() => {
    if (!canMutate || !definitionId || pendingHandledRef.current) return;
    const action = takePendingItemAsset(['thumbnail-upload', 'thumbnail-generate']);
    if (!action) return;
    pendingHandledRef.current = true;
    if (action.type === 'thumbnail-upload') {
      void runUploadRef.current(definitionId, action.file);
    } else if (action.type === 'thumbnail-generate') {
      setUserExtra(action.userExtra);
      setPhase('confirm-generate');
      setBusy(false);
    }
  }, [canMutate, definitionId]);

  const uploadFile = async (file: File) => {
    if (!canEdit || submitLock.current) return;
    if (!definitionId) {
      queuePendingItemAsset({ type: 'thumbnail-upload', file });
      setBusy(true);
      setErrorMessage('');
      setLocalPreviewUrl(URL.createObjectURL(file));
      setPhase('uploading');
      const id = (await ensureDraftIdRef.current?.()) ?? null;
      if (!id) {
        takePendingItemAsset(['thumbnail-upload', 'thumbnail-generate']);
        setLocalPreviewUrl(null);
        setBusy(false);
        setPhase('failed');
        setErrorMessage('Entwurf konnte nicht angelegt werden');
        toast.error('Entwurf konnte nicht angelegt werden');
      }
      // Remount / canMutate effect consumes pending upload.
      return;
    }
    if (!canMutate) return;
    await runUpload(definitionId, file);
  };

  const requestGenerate = () => {
    if (!canEdit || !meshyConfigured || busy) return;
    if (!definitionId) {
      queuePendingItemAsset({ type: 'thumbnail-generate', userExtra });
      setBusy(true);
      void (async () => {
        const id = (await ensureDraftIdRef.current?.()) ?? null;
        if (!id) {
          takePendingItemAsset(['thumbnail-upload', 'thumbnail-generate']);
          setBusy(false);
          toast.error('Entwurf konnte nicht angelegt werden');
        }
      })();
      return;
    }
    if (!canMutate) return;
    setPhase('confirm-generate');
  };

  const cancelGenerateConfirm = () => {
    if (phase === 'confirm-generate') setPhase('idle');
  };

  const confirmGenerate = async () => {
    if (!canMutate || !definitionId || submitLock.current || !meshyConfigured) return;
    submitLock.current = true;
    setBusy(true);
    setErrorMessage('');
    setPhase('starting');
    try {
      const snap = await itemThumbnailService.startGenerate(definitionId, userExtra);
      setJobId(snap.jobId);
      setProgress(snap.progress);
      setPhase(mapJobToPhase(snap.jobStatus));
    } catch (error) {
      setPhase('failed');
      setErrorMessage(error instanceof Error ? error.message : 'Generierung fehlgeschlagen');
      toast.error(error instanceof Error ? error.message : 'Generierung fehlgeschlagen');
    } finally {
      setBusy(false);
      submitLock.current = false;
    }
  };

  const retryGenerate = async () => {
    setPhase('idle');
    await confirmGenerate();
  };

  const removeThumbnail = async () => {
    if (!canMutate || !definitionId || submitLock.current) return;
    const confirmed = window.confirm('Thumbnail entfernen? Das Item bleibt ohne Bild gültig.');
    if (!confirmed) return;
    submitLock.current = true;
    setBusy(true);
    try {
      await itemThumbnailService.removeThumbnail(definitionId);
      setResolvedUrl(null);
      setLocalPreviewUrl(null);
      onAssetKeyChangeRef.current(undefined);
      setPhase('idle');
      toast.success('Thumbnail entfernt');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Entfernen fehlgeschlagen');
    } finally {
      setBusy(false);
      submitLock.current = false;
    }
  };

  return {
    canEdit,
    canMutate,
    meshyConfigured,
    phase,
    progress,
    errorMessage,
    displayUrl,
    userExtra,
    setUserExtra,
    busy,
    uploadFile,
    requestGenerate,
    cancelGenerateConfirm,
    confirmGenerate,
    retryGenerate,
    removeThumbnail,
    hasAsset: Boolean(definition?.assetKey && parseItemThumbnailAssetKey(definition.assetKey)),
  };
}

export type ItemModel3dPhase =
  | 'idle'
  | 'uploading'
  | 'confirm-generate'
  | 'starting'
  | 'waiting'
  | 'generating'
  | 'failed';

export interface UseItemModel3dAssetsOptions {
  definition: ItemDefinition | null;
  readOnly: boolean;
  onModel3dChange: (model3d: string | undefined) => void;
  ensureDraftId?: () => Promise<string | null>;
}

function mapModel3dJobToPhase(status: ItemModel3dJobUiStatus): ItemModel3dPhase {
  if (status === 'waiting') return 'waiting';
  if (status === 'generating') return 'generating';
  if (status === 'failed' || status === 'canceled') return 'failed';
  return 'idle';
}

/** Sibling export in the same module — extends useItemAssets surface for #141. */
export function useItemModel3dAssets({
  definition,
  readOnly,
  onModel3dChange,
  ensureDraftId,
}: UseItemModel3dAssetsOptions) {
  const definitionId = definition?.id ?? null;
  const canEdit = !readOnly;
  const canMutate =
    canEdit &&
    !!definitionId &&
    (definition?.scope === 'personal' || definition?.scope === 'world');

  const hasThumbnail = Boolean(
    definition?.assetKey && parseItemThumbnailAssetKey(definition.assetKey),
  );

  const [meshyConfigured, setMeshyConfigured] = useState(false);
  const [phase, setPhase] = useState<ItemModel3dPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<number | null>(null);
  const submitLock = useRef(false);
  const ensureDraftIdRef = useRef(ensureDraftId);
  ensureDraftIdRef.current = ensureDraftId;
  const onModel3dChangeRef = useRef(onModel3dChange);
  onModel3dChangeRef.current = onModel3dChange;
  const pendingHandledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void itemModel3dService.getConfig().then((config) => {
      if (!cancelled) setMeshyConfigured(config.meshyConfigured);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const key = definition?.model3d;
    if (!key || !parseItemModel3dAssetKey(key)) {
      setResolvedUrl(null);
      return;
    }
    let cancelled = false;
    void itemModel3dService.resolveSignedUrl(key).then((url) => {
      if (!cancelled) setResolvedUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [definition?.model3d]);

  useEffect(() => {
    if (!definitionId || !canMutate) return;
    let cancelled = false;
    void itemModel3dService.loadLatestJob(definitionId).then((job) => {
      if (cancelled || !job) return;
      if (job.jobStatus === 'waiting' || job.jobStatus === 'generating') {
        setJobId(job.jobId);
        setPhase(mapModel3dJobToPhase(job.jobStatus));
        setProgress(job.progress);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [definitionId, canMutate]);

  useEffect(() => {
    if (!jobId || (phase !== 'waiting' && phase !== 'generating')) {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const tick = async () => {
      try {
        const snap = await itemModel3dService.pollJob(jobId);
        setProgress(snap.progress);
        if (snap.jobStatus === 'succeeded') {
          setPhase('idle');
          setJobId(null);
          setErrorMessage('');
          if (snap.signedUrl) setResolvedUrl(snap.signedUrl);
          if (snap.model3d) onModel3dChangeRef.current(snap.model3d);
          toast.success('3D-Modell generiert');
          return;
        }
        if (snap.jobStatus === 'failed' || snap.jobStatus === 'canceled') {
          setPhase('failed');
          setErrorMessage(snap.errorMessage || 'Generierung fehlgeschlagen');
          setJobId(null);
          return;
        }
        setPhase(mapModel3dJobToPhase(snap.jobStatus));
      } catch (error) {
        setPhase('failed');
        setErrorMessage(error instanceof Error ? error.message : 'Statusabfrage fehlgeschlagen');
        setJobId(null);
      }
    };

    void tick();
    pollRef.current = window.setInterval(() => {
      void tick();
    }, 2500);

    return () => {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [jobId, phase]);

  const runUpload = async (id: string, file: File) => {
    if (submitLock.current) return;
    submitLock.current = true;
    setBusy(true);
    setErrorMessage('');
    setPhase('uploading');
    try {
      const result = await itemModel3dService.uploadModel(id, file);
      setResolvedUrl(result.signedUrl);
      onModel3dChangeRef.current(result.model3d);
      setPhase('idle');
      toast.success('3D-Modell hochgeladen');
    } catch (error) {
      setPhase('failed');
      setErrorMessage(error instanceof Error ? error.message : 'Upload fehlgeschlagen');
      toast.error(error instanceof Error ? error.message : 'Upload fehlgeschlagen');
    } finally {
      setBusy(false);
      submitLock.current = false;
    }
  };

  const runUploadRef = useRef(runUpload);
  runUploadRef.current = runUpload;

  useEffect(() => {
    if (!canMutate || !definitionId || pendingHandledRef.current) return;
    const action = takePendingItemAsset(['model3d-upload', 'model3d-generate']);
    if (!action) return;
    pendingHandledRef.current = true;
    if (action.type === 'model3d-upload') {
      void runUploadRef.current(definitionId, action.file);
    } else if (action.type === 'model3d-generate') {
      setPhase('confirm-generate');
      setBusy(false);
    }
  }, [canMutate, definitionId]);

  const uploadFile = async (file: File) => {
    if (!canEdit || submitLock.current) return;
    if (!definitionId) {
      queuePendingItemAsset({ type: 'model3d-upload', file });
      setBusy(true);
      setErrorMessage('');
      setPhase('uploading');
      const id = (await ensureDraftIdRef.current?.()) ?? null;
      if (!id) {
        takePendingItemAsset(['model3d-upload', 'model3d-generate']);
        setBusy(false);
        setPhase('failed');
        setErrorMessage('Entwurf konnte nicht angelegt werden');
        toast.error('Entwurf konnte nicht angelegt werden');
      }
      return;
    }
    if (!canMutate) return;
    await runUpload(definitionId, file);
  };

  const requestGenerate = () => {
    if (!canEdit || !meshyConfigured || !hasThumbnail || busy) return;
    if (!definitionId) {
      queuePendingItemAsset({ type: 'model3d-generate' });
      setBusy(true);
      void (async () => {
        const id = (await ensureDraftIdRef.current?.()) ?? null;
        if (!id) {
          takePendingItemAsset(['model3d-upload', 'model3d-generate']);
          setBusy(false);
          toast.error('Entwurf konnte nicht angelegt werden');
        }
      })();
      return;
    }
    if (!canMutate) return;
    setPhase('confirm-generate');
  };

  const cancelGenerateConfirm = () => {
    if (phase === 'confirm-generate') setPhase('idle');
  };

  const confirmGenerate = async () => {
    if (!canMutate || !definitionId || submitLock.current || !meshyConfigured || !hasThumbnail) {
      return;
    }
    submitLock.current = true;
    setBusy(true);
    setErrorMessage('');
    setPhase('starting');
    try {
      const snap = await itemModel3dService.startGenerate(definitionId);
      setJobId(snap.jobId);
      setProgress(snap.progress);
      setPhase(mapModel3dJobToPhase(snap.jobStatus));
    } catch (error) {
      setPhase('failed');
      setErrorMessage(error instanceof Error ? error.message : 'Generierung fehlgeschlagen');
      toast.error(error instanceof Error ? error.message : 'Generierung fehlgeschlagen');
    } finally {
      setBusy(false);
      submitLock.current = false;
    }
  };

  const retryGenerate = async () => {
    setPhase('idle');
    await confirmGenerate();
  };

  const removeModel = async () => {
    if (!canMutate || !definitionId || submitLock.current) return;
    const confirmed = window.confirm('3D-Modell entfernen? Das Item bleibt ohne 3D gültig.');
    if (!confirmed) return;
    submitLock.current = true;
    setBusy(true);
    try {
      await itemModel3dService.removeModel(definitionId);
      setResolvedUrl(null);
      onModel3dChangeRef.current(undefined);
      setPhase('idle');
      toast.success('3D-Modell entfernt');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Entfernen fehlgeschlagen');
    } finally {
      setBusy(false);
      submitLock.current = false;
    }
  };

  return {
    canEdit,
    canMutate,
    meshyConfigured,
    hasThumbnail,
    phase,
    progress,
    errorMessage,
    previewUrl: resolvedUrl,
    busy,
    uploadFile,
    requestGenerate,
    cancelGenerateConfirm,
    confirmGenerate,
    retryGenerate,
    removeModel,
    hasModel: Boolean(definition?.model3d && parseItemModel3dAssetKey(definition.model3d)),
  };
}
