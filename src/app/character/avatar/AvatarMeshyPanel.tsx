/**
 * AvatarMeshyPanel — "Mit KI erstellen" via provider-agnostic 3D generation (Meshy adapter today).
 * Location: src/app/character/avatar/AvatarMeshyPanel.tsx
 *
 * Mesh geometry: Text = prompt only, Bild = image only (never both for form).
 * Provider + Preset from domain; Advanced settings from capability schema.
 * Cost confirm is a portal modal (no inline button swap) to avoid sticky-panel jitter.
 * Reload-stable job id; explicit retry. 3D-Provider dropdown lists BYOK providers.
 */

import { useEffect, useRef, useState } from 'react';
import {
  CaretDown,
  UploadSimple
} from '@phosphor-icons/react';
import type {
  MeshyAvatarGenerationMode,
  MeshyAvatarJobSnapshot,
  MeshyAvatarJobUiStatus,
  MeshyAvatarPollHealth,
} from '../../../domains/character/avatar/meshy-avatar-job';
import {
  MESHY_AVATAR_IMAGE_MAX_BYTES,
  MESHY_AVATAR_POLL_STALE_MS,
  estimateMeshyAvatarCreditsForSettings,
  monotonicMeshyProgress,
  validateMeshyAvatarImageDataUri,
} from '../../../domains/character/avatar/meshy-avatar-job';
import {
  AVATAR_3D_GENERATION_PROVIDER_IDS,
  defaultPresetForProvider,
  getProviderCapability,
  isAvatar3dGenerationProviderId,
  isPresetDirty,
  presetLabelDe,
  summarizeSettingsDe,
  type Avatar3dGenerationSettings,
  type GenerationPresetId,
} from '../../../domains/character/avatar/generation';
import type { GenerateProductModeId } from '../../../domains/character/avatar';
import {
  fetchMeshyAvatarConfig,
  pollMeshyAvatarJob,
  retryMeshyAvatarJob,
  startMeshyAvatarJob,
  type MeshyAvatarConfig,
} from '../../../infrastructure/character/avatar/character-avatar-meshy-service';
import { aiProviderCredentialsService } from '../../../infrastructure/ai/ai-provider-credentials-service';
import type { AiProviderCredentialView } from '../../../domains/ai-providers';
import { AvatarGenerationAdvancedSettings } from './AvatarGenerationAdvancedSettings';
import { AvatarGenerateProductModeChooser } from './AvatarGenerateProductModeChooser';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../shared/ui/alert-dialog';
import { Button } from '../../../shared/ui/button';
import { Label } from '../../../shared/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select';
import { Textarea } from '../../../shared/ui/textarea';

const STORAGE_KEY = 'sagatree:meshy-avatar-job';

/** Avatar text/image-to-3d backends wired today — others may appear once implemented. */
const AVATAR_3D_GENERATION_PROVIDERS = new Set<string>(AVATAR_3D_GENERATION_PROVIDER_IDS);

export interface MeshyAvatarJobUiState {
  job: MeshyAvatarJobSnapshot | null;
  pollHealth: MeshyAvatarPollHealth;
  /** Monotonic progress for overlay (never decreases for the same job). */
  displayProgress: number;
}

interface AvatarMeshyPanelProps {
  characterId?: string | null;
  onSuccess: (result: {
    modelUrl: string;
    productMode: GenerateProductModeId;
  }) => void;
  /** Preview overlay consumer — cleared on unmount. */
  onJobChange?: (state: MeshyAvatarJobUiState | null) => void;
}

const STATUS_LABEL: Record<MeshyAvatarJobUiStatus, string> = {
  idle: 'Bereit',
  confirming: 'Bitte bestätigen',
  queued: 'In Warteschlange …',
  generating: 'Generiert …',
  rigging: 'Finalisiert Modell …',
  analyzing: 'Strukturanalyse folgt',
  success: 'Fertig',
  failed: 'Fehlgeschlagen',
  'provider-unavailable': 'Provider nicht verfügbar',
};

function loadStoredJobId(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeJobId(jobId: string | null): void {
  try {
    if (!jobId) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, jobId);
  } catch {
    // ignore
  }
}

function readImageFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const mime = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
    if (mime !== 'image/png' && mime !== 'image/jpeg' && mime !== 'image/webp') {
      reject(new Error('Nur PNG, JPEG oder WebP sind erlaubt.'));
      return;
    }
    if (file.size > MESHY_AVATAR_IMAGE_MAX_BYTES) {
      reject(
        new Error(
          `Bild zu groß (max. ${Math.floor(MESHY_AVATAR_IMAGE_MAX_BYTES / (1024 * 1024))} MB).`,
        ),
      );
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Datei konnte nicht gelesen werden.'));
        return;
      }
      const checked = validateMeshyAvatarImageDataUri(result);
      if (!checked.ok) {
        reject(new Error(checked.message ?? 'Bild ungültig.'));
        return;
      }
      resolve(checked.normalized);
    };
    reader.readAsDataURL(file);
  });
}

export function AvatarMeshyPanel({ characterId, onSuccess, onJobChange }: AvatarMeshyPanelProps) {
  const [config, setConfig] = useState<MeshyAvatarConfig | null>(null);
  const [configReady, setConfigReady] = useState(false);
  const [configuredProviders, setConfiguredProviders] = useState<AiProviderCredentialView[]>([]);
  const [providersReady, setProvidersReady] = useState(false);
  const [providersLoadFailed, setProvidersLoadFailed] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [presetId, setPresetId] = useState<GenerationPresetId>('recommended');
  const [settings, setSettings] = useState<Avatar3dGenerationSettings>(
    () => defaultPresetForProvider('meshy').settings,
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [productMode, setProductMode] = useState<GenerateProductModeId>('editable-wardrobe');
  const [mode, setMode] = useState<MeshyAvatarGenerationMode>('text');
  const productModeRef = useRef(productMode);
  productModeRef.current = productMode;
  const [prompt, setPrompt] = useState('');
  const [texturePrompt, setTexturePrompt] = useState('');
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [job, setJob] = useState<MeshyAvatarJobSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [pollHealth, setPollHealth] = useState<MeshyAvatarPollHealth>('idle');
  const [displayProgress, setDisplayProgress] = useState(0);
  const pollRef = useRef<number | null>(null);
  const peakProgressRef = useRef(0);
  const peakJobIdRef = useRef('');
  const lastOkAtRef = useRef(0);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  /** Parent often passes inline lambdas — keep refs so effects do not remount every poll. */
  const onSuccessRef = useRef(onSuccess);
  const onJobChangeRef = useRef(onJobChange);
  const selectedProviderIdRef = useRef(selectedProviderId);
  onSuccessRef.current = onSuccess;
  onJobChangeRef.current = onJobChange;
  selectedProviderIdRef.current = selectedProviderId;

  const applyJobSnapshot = (snapshot: MeshyAvatarJobSnapshot) => {
    if (snapshot.jobId !== peakJobIdRef.current) {
      peakJobIdRef.current = snapshot.jobId;
      peakProgressRef.current = 0;
    }
    const nextDisplay = monotonicMeshyProgress(peakProgressRef.current, snapshot.progress);
    peakProgressRef.current = nextDisplay;
    setDisplayProgress(nextDisplay);
    setJob({ ...snapshot, progress: nextDisplay });
  };

  const markPollOk = () => {
    lastOkAtRef.current = Date.now();
    setPollHealth((prev) => (prev === 'connected' ? prev : 'connected'));
  };

  const markPollError = () => {
    setPollHealth((prev) => (prev === 'offline' ? prev : 'offline'));
  };

  const applyProviderCredits = (updated: AiProviderCredentialView) => {
    setConfiguredProviders((prev) =>
      prev.map((row) => (row.providerId === updated.providerId ? updated : row)),
    );
  };

  /** Live Meshy balance via Edge refresh — fail soft (keep last known credits). */
  const refreshProviderCredits = (providerId: string) => {
    if (!providerId || !AVATAR_3D_GENERATION_PROVIDERS.has(providerId)) return;
    void aiProviderCredentialsService
      .refresh(providerId)
      .then(applyProviderCredits)
      .catch((error) => {
        console.error('Meshy credits refresh failed:', error);
      });
  };

  useEffect(() => {
    onJobChangeRef.current?.(
      job
        ? { job, pollHealth, displayProgress }
        : null,
    );
  }, [job, pollHealth, displayProgress]);

  useEffect(() => {
    return () => {
      onJobChangeRef.current?.(null);
    };
  }, []);

  // Load config / providers / resume once — never re-run when parent callbacks change.
  useEffect(() => {
    let cancelled = false;
    setConfigReady(false);
    setProvidersReady(false);
    setProvidersLoadFailed(false);
    void fetchMeshyAvatarConfig()
      .then((next) => {
        if (!cancelled) setConfig(next);
      })
      .finally(() => {
        if (!cancelled) setConfigReady(true);
      });
    void aiProviderCredentialsService
      .list('3d')
      .then((list) => {
        if (cancelled) return;
        const configured = list.filter((row) => row.configured === true);
        setConfiguredProviders(configured);
        setProvidersLoadFailed(false);
        let nextId = '';
        setSelectedProviderId((prev) => {
          if (prev && configured.some((row) => row.providerId === prev)) {
            nextId = prev;
            return prev;
          }
          const preferred = configured.find((row) => AVATAR_3D_GENERATION_PROVIDERS.has(row.providerId));
          nextId = preferred?.providerId ?? configured[0]?.providerId ?? '';
          return nextId;
        });
        if (nextId) refreshProviderCredits(nextId);
      })
      .catch(() => {
        if (!cancelled) {
          setConfiguredProviders([]);
          setProvidersLoadFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setProvidersReady(true);
      });
    const existing = loadStoredJobId();
    if (existing) {
      void pollMeshyAvatarJob(existing)
        .then((snapshot) => {
          if (cancelled) return;
          applyJobSnapshot(snapshot);
          markPollOk();
          if (snapshot.status === 'success' && snapshot.modelUrl) {
            onSuccessRef.current({ modelUrl: snapshot.modelUrl, productMode: productModeRef.current });
            storeJobId(null);
            refreshProviderCredits(selectedProviderIdRef.current || 'meshy');
          }
        })
        .catch(() => {
          if (cancelled) return;
          markPollError();
          storeJobId(null);
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll only when job identity or terminal→busy transition changes — not on every parent render.
  useEffect(() => {
    if (!job?.jobId) return;
    if (
      job.status === 'success' ||
      job.status === 'failed' ||
      job.status === 'provider-unavailable' ||
      job.status === 'idle'
    ) {
      return;
    }
    const jobId = job.jobId;
    pollRef.current = window.setInterval(() => {
      void pollMeshyAvatarJob(jobId)
        .then((snapshot) => {
          applyJobSnapshot(snapshot);
          markPollOk();
          if (snapshot.status === 'success' && snapshot.modelUrl) {
            onSuccessRef.current({ modelUrl: snapshot.modelUrl, productMode: productModeRef.current });
            storeJobId(null);
            refreshProviderCredits(selectedProviderIdRef.current || 'meshy');
          }
          if (
            snapshot.status === 'failed' ||
            snapshot.status === 'provider-unavailable' ||
            snapshot.status === 'success'
          ) {
            if (pollRef.current) window.clearInterval(pollRef.current);
          }
        })
        .catch(() => {
          markPollError();
        });
    }, 2500);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [job?.jobId, job?.status]);

  // Soft-stale: connected → waiting if no successful poll within threshold.
  useEffect(() => {
    if (!job?.jobId) return;
    if (
      job.status === 'success' ||
      job.status === 'failed' ||
      job.status === 'provider-unavailable' ||
      job.status === 'idle'
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      if (!lastOkAtRef.current) return;
      const age = Date.now() - lastOkAtRef.current;
      if (age >= MESHY_AVATAR_POLL_STALE_MS) {
        setPollHealth((prev) => (prev === 'offline' || prev === 'waiting' ? prev : 'waiting'));
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [job?.jobId, job?.status]);

  const uiStatus: MeshyAvatarJobUiStatus = job?.status ?? 'idle';

  const promptMin = config?.promptMinChars ?? 8;
  const promptMax = config?.promptMaxChars ?? 500;
  const imageMaxMb = Math.floor((config?.imageMaxBytes ?? MESHY_AVATAR_IMAGE_MAX_BYTES) / (1024 * 1024));
  const promptLen = prompt.trim().length;
  const textureLen = texturePrompt.trim().length;
  const promptTooShort = mode === 'text' && promptLen < promptMin;
  const imageReady = Boolean(imageDataUri);
  const providerReady =
    providersReady &&
    Boolean(selectedProviderId) &&
    AVATAR_3D_GENERATION_PROVIDERS.has(selectedProviderId);
  const meshyConfigured = configReady && Boolean(config?.meshyConfigured);
  const edgeReachable = configReady && config?.edgeReachable !== false;
  const canStart =
    configReady &&
    providersReady &&
    providerReady &&
    meshyConfigured &&
    edgeReachable &&
    !providersLoadFailed &&
    (mode === 'text' ? !promptTooShort : imageReady && !imageError);
  const showEdgeDown =
    (configReady && config?.edgeReachable === false) ||
    (providersReady && providersLoadFailed);
  const showNotConfigured =
    providersReady &&
    !providersLoadFailed &&
    edgeReachable &&
    (configuredProviders.length === 0 ||
      (selectedProviderId === 'meshy' && config?.meshyConfigured === false));
  const estimatedCredits = estimateMeshyAvatarCreditsForSettings(mode, settings.textureQuality);
  const balanceCredits = configuredProviders.find((row) => row.providerId === selectedProviderId)
    ?.meta.credits;
  const selectedProviderName =
    configuredProviders.find((row) => row.providerId === selectedProviderId)?.displayName ??
    'Meshy';
  const providerCapability = isAvatar3dGenerationProviderId(selectedProviderId)
    ? getProviderCapability(selectedProviderId)
    : getProviderCapability('meshy');
  const dirty = providerCapability
    ? isPresetDirty(presetId, providerCapability.providerId, settings)
    : true;
  const presetDisplayLabel = presetLabelDe(
    presetId,
    dirty,
    providerCapability?.providerId ?? 'meshy',
  );
  const summaryLines = summarizeSettingsDe(settings);

  const onPickImage = (file: File | undefined) => {
    if (!file) return;
    setImageError(null);
    void readImageFileAsDataUri(file)
      .then((uri) => {
        setImageDataUri(uri);
        setImageName(file.name);
        setImageError(null);
      })
      .catch((error) => {
        setImageDataUri(null);
        setImageName(null);
        setImageError(error instanceof Error ? error.message : 'Bild ungültig.');
      });
  };

  const start = async () => {
    if (!AVATAR_3D_GENERATION_PROVIDERS.has(selectedProviderId)) return;
    setBusy(true);
    setConfirming(false);
    try {
      const nonce = crypto.randomUUID();
      const snapshot = await startMeshyAvatarJob({
        mode,
        prompt: mode === 'text' ? prompt : undefined,
        texturePrompt: mode === 'image' ? texturePrompt : undefined,
        imageDataUri: mode === 'image' ? (imageDataUri ?? undefined) : undefined,
        clientNonce: nonce,
        characterId,
        providerId: isAvatar3dGenerationProviderId(selectedProviderId)
          ? selectedProviderId
          : 'meshy',
        presetId: dirty ? 'custom' : presetId,
        presetVersion: providerCapability?.presets.find((p) => p.id === presetId)?.version ?? 1,
        presetDirty: dirty,
        settings,
      });
      applyJobSnapshot(snapshot);
      markPollOk();
      if (snapshot.jobId) storeJobId(snapshot.jobId);
      if (snapshot.status === 'success' && snapshot.modelUrl) {
        onSuccess({ modelUrl: snapshot.modelUrl, productMode: productModeRef.current });
        storeJobId(null);
        refreshProviderCredits(selectedProviderId);
      }
    } catch (error) {
      applyJobSnapshot({
        jobId: '',
        status: 'failed',
        progress: 0,
        prompt: mode === 'text' ? prompt : texturePrompt || 'Image-to-3D reference',
        idempotencyKey: '',
        errorMessage: error instanceof Error ? error.message : 'Start fehlgeschlagen.',
        rigAnalysisStatus: 'pending',
      });
      markPollError();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="space-y-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs"
      data-avatar-meshy-status={uiStatus}
      data-avatar-meshy-mode={mode}
      data-avatar-generate-product-mode={productMode}
      role="region"
      aria-label="Avatar mit KI erstellen"
    >
      <p className="font-medium">Mit KI erstellen</p>
      <p className="text-muted-foreground">
        Wähle das Ziel — der Provider ist nur die Technik dahinter.
      </p>
      <AvatarGenerateProductModeChooser
        value={productMode}
        disabled={busy || confirming}
        onChange={setProductMode}
      />
      <div className="space-y-1.5">
        <Label htmlFor="avatar-3d-provider" className="text-xs">
          3D-Provider
        </Label>
        <Select
          value={selectedProviderId || undefined}
          onValueChange={(providerId) => {
            setSelectedProviderId(providerId);
            refreshProviderCredits(providerId);
            const cap = getProviderCapability(providerId);
            const preset = cap ? defaultPresetForProvider(providerId) : defaultPresetForProvider('meshy');
            setPresetId(preset.id);
            setSettings({ ...preset.settings });
          }}
          disabled={busy || confirming || !providersReady || configuredProviders.length === 0}
        >
          <SelectTrigger
            id="avatar-3d-provider"
            size="sm"
            className="w-full"
            data-avatar-meshy-provider
            aria-label="3D-Provider wählen"
          >
            <SelectValue
              placeholder={
                !providersReady
                  ? 'Lade Provider …'
                  : configuredProviders.length === 0
                    ? 'Kein Provider mit API-Key'
                    : 'Provider wählen'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {configuredProviders.map((provider) => (
              <SelectItem key={provider.providerId} value={provider.providerId}>
                {provider.displayName}
                {typeof provider.meta.credits === 'number'
                  ? ` · ${provider.meta.credits.toLocaleString('de-DE')} Credits`
                  : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground" data-avatar-meshy-cost-hint>
          {config?.costHintDe ??
            'Externe KI. Es entstehen Provider-Kosten. Kein automatischer Paid-Retry.'}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="avatar-3d-preset" className="text-xs">
          Preset
        </Label>
        <Select
          value={presetId}
          onValueChange={(next) => {
            const id = next as GenerationPresetId;
            setPresetId(id);
            const preset = providerCapability?.presets.find((row) => row.id === id);
            if (preset) setSettings({ ...preset.settings });
          }}
          disabled={busy || confirming || !providerCapability}
        >
          <SelectTrigger
            id="avatar-3d-preset"
            size="sm"
            className="w-full"
            data-avatar-gen-preset
            aria-label="Preset wählen"
          >
            <SelectValue placeholder="Preset wählen" />
          </SelectTrigger>
          <SelectContent>
            {(providerCapability?.presets ?? []).map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {preset.labelDe}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground" data-avatar-gen-preset-label>
          {presetDisplayLabel}
          {providerCapability?.presets.find((p) => p.id === presetId)?.descriptionDe
            ? ` — ${providerCapability.presets.find((p) => p.id === presetId)?.descriptionDe}`
            : ''}
        </p>
      </div>

      <div
        className="space-y-1 rounded-md border border-border/60 bg-background/50 px-2.5 py-2"
        data-avatar-gen-summary
      >
        <p className="text-[11px] font-medium" data-avatar-gen-summary-title>
          {dirty ? `Preset: ${presetDisplayLabel}` : `${presetDisplayLabel} für SagaTree`}
        </p>
        <ul className="list-inside list-disc text-[11px] text-muted-foreground">
          {summaryLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Form steuern</Label>
        <div
          role="radiogroup"
          aria-label="Form steuern"
          className="flex flex-wrap gap-1.5"
          data-avatar-meshy-mode-group
        >
          <Button
            type="button"
            size="sm"
            variant={mode === 'text' ? 'default' : 'outline'}
            role="radio"
            aria-checked={mode === 'text'}
            disabled={busy || confirming}
            data-avatar-meshy-mode-text
            onClick={() => {
              setMode('text');
              setConfirming(false);
            }}
          >
            Text
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'image' ? 'default' : 'outline'}
            role="radio"
            aria-checked={mode === 'image'}
            disabled={busy || confirming || config?.supportsImageTo3d === false}
            data-avatar-meshy-mode-image
            onClick={() => {
              setMode('image');
              setConfirming(false);
            }}
          >
            Bild
          </Button>
        </div>
        <p className="text-muted-foreground" data-avatar-meshy-mode-hint>
          {mode === 'text'
            ? 'Prompt steuert die Form (Mesh). Kein Referenzbild für die Geometrie.'
            : 'Bild steuert die Form. Optionaler Prompt nur für die Textur (Look).'}
        </p>
      </div>

      {mode === 'text' ? (
        <>
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="z. B. erwachsener Elfenkrieger, stilisierter Look …"
            rows={3}
            maxLength={promptMax}
            disabled={busy || confirming || !configReady}
            aria-label="Meshy Prompt"
            data-avatar-meshy-prompt
          />
          <p className="text-muted-foreground" data-avatar-meshy-prompt-hint>
            {promptLen}/{promptMax} Zeichen
            {promptTooShort ? ` · mind. ${promptMin}` : ''}
          </p>
        </>
      ) : (
        <>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,.webp"
            className="hidden"
            data-avatar-meshy-image-file
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              onPickImage(file);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || confirming || !configReady}
              data-avatar-meshy-image-pick
              onClick={() => imageInputRef.current?.click()}
            >
              <UploadSimple className="mr-1.5 h-3.5 w-3.5" />
              {imageReady ? 'Bild ändern' : 'Bild wählen'}
            </Button>
            {imageName ? (
              <span className="truncate text-muted-foreground" data-avatar-meshy-image-name>
                {imageName}
              </span>
            ) : (
              <span className="text-muted-foreground">PNG/JPEG/WebP · max. {imageMaxMb} MB</span>
            )}
          </div>
          {imageReady ? (
            <img
              src={imageDataUri!}
              alt="Referenz für Image-to-3D"
              className="max-h-28 w-auto rounded border border-border object-contain"
              data-avatar-meshy-image-preview
            />
          ) : null}
          {imageError ? (
            <p className="text-amber-700 dark:text-amber-300" data-avatar-meshy-image-error>
              {imageError}
            </p>
          ) : null}
          <Label htmlFor="avatar-meshy-texture-prompt" className="text-xs">
            Textur-Prompt (optional)
          </Label>
          <Textarea
            id="avatar-meshy-texture-prompt"
            value={texturePrompt}
            onChange={(event) => setTexturePrompt(event.target.value)}
            placeholder="z. B. matte Lederrüstung, warme Hauttöne …"
            rows={2}
            maxLength={promptMax}
            disabled={busy || confirming || !configReady}
            aria-label="Meshy Textur-Prompt"
            data-avatar-meshy-texture-prompt
          />
          <p className="text-muted-foreground" data-avatar-meshy-prompt-hint>
            {textureLen}/{promptMax} Zeichen · steuert nur die Oberfläche, nicht die Form
          </p>
        </>
      )}

      <div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-1 text-xs"
          disabled={busy || confirming || !providerCapability}
          data-avatar-gen-advanced-toggle
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          <CaretDown
            className={`mr-1 h-3.5 w-3.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
          />
          Erweiterte Einstellungen
        </Button>
        {advancedOpen && providerCapability ? (
          <AvatarGenerationAdvancedSettings
            capability={providerCapability}
            settings={settings}
            disabled={busy || confirming}
            onChange={setSettings}
          />
        ) : null}
      </div>

      <div className="flex min-h-9 flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={busy || !canStart}
          data-avatar-meshy-start
          onClick={() => {
            setConfirming(true);
            refreshProviderCredits(selectedProviderId);
          }}
        >
          Generieren
        </Button>
        {(job?.status === 'failed' || job?.status === 'provider-unavailable') && job.jobId ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            data-avatar-meshy-retry
            onClick={() => {
              setBusy(true);
              void retryMeshyAvatarJob(job.jobId)
                .then((snapshot) => {
                  applyJobSnapshot(snapshot);
                  markPollOk();
                  if (snapshot.jobId) storeJobId(snapshot.jobId);
                })
                .catch(() => markPollError())
                .finally(() => setBusy(false));
            }}
          >
            Erneut versuchen
          </Button>
        ) : null}
      </div>
      <p className="min-h-[1.25rem] text-muted-foreground tabular-nums" data-avatar-meshy-message role="status">
        {job && job.status !== 'idle'
          ? `${STATUS_LABEL[uiStatus]}${
              displayProgress > 0 ? ` · ${displayProgress}%` : ''
            }${job.errorMessage ? ` — ${job.errorMessage}` : ''}`
          : !configReady || !providersReady
            ? 'Prüfe Meshy-Konfiguration …'
            : `${STATUS_LABEL[uiStatus]}${
                displayProgress > 0 ? ` · ${displayProgress}%` : ''
              }${job?.errorMessage ? ` — ${job.errorMessage}` : ''}`}
      </p>
      {showEdgeDown ? (
        <p
          className="text-amber-700 dark:text-amber-300"
          data-avatar-meshy-edge-down
        >
          KI-Server (Edge) nicht erreichbar — bitte Seite neu laden. Dein API-Key ist davon unabhängig.
        </p>
      ) : null}
      {showNotConfigured ? (
        <p
          className="text-amber-700 dark:text-amber-300"
          data-avatar-meshy-not-configured
        >
          Kein 3D-Provider mit API-Key — bitte unter Einstellungen → KI-Anbieter hinterlegen.
        </p>
      ) : null}
      {providersReady &&
      selectedProviderId &&
      !AVATAR_3D_GENERATION_PROVIDERS.has(selectedProviderId) ? (
        <p className="text-amber-700 dark:text-amber-300" data-avatar-meshy-provider-unsupported>
          Dieser Provider ist für Avatar-Generierung noch nicht angebunden.
        </p>
      ) : null}

      <AlertDialog
        open={confirming}
        onOpenChange={(open) => {
          if (busy) return;
          setConfirming(open);
        }}
      >
        <AlertDialogContent data-avatar-meshy-confirm-modal>
          <AlertDialogHeader>
            <AlertDialogTitle>KI-Generierung starten?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p data-avatar-meshy-confirm-cost>
                  Das kostet dich ca.{' '}
                  <span className="font-semibold text-foreground">{estimatedCredits}</span> Credits
                  ({selectedProviderName}
                  {mode === 'image' ? ', Bild → 3D' : ', Text → 3D Preview'}).
                </p>
                {typeof balanceCredits === 'number' ? (
                  <p data-avatar-meshy-confirm-balance>
                    Verfügbar: {balanceCredits.toLocaleString('de-DE')} Credits.
                  </p>
                ) : null}
                <p>Kein automatischer Paid-Retry. Fortfahren?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy} data-avatar-meshy-confirm-cancel>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              data-avatar-meshy-confirm
              onClick={(event) => {
                event.preventDefault();
                void start();
              }}
            >
              Fortfahren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
