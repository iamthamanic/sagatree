/**
 * AvatarImportPanel — Import Flow v2: Upload → Analyse → Original behalten (#261).
 * Location: src/app/character/avatar/AvatarImportPanel.tsx
 *
 * Shows anatomy/modularity/family summary in product language; never ticket/provider jargon.
 * On error, does not clear the previous model URL (caller keeps prior avatar).
 */

import { useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import {
  ArrowSquareOut,
  UploadSimple
} from '@phosphor-icons/react';
import {
  AVATAR_IMPORT_GLB_SPEC_HELP_HREF,
  AVATAR_IMPORT_GLB_SPEC_HELP_LABEL_DE,
  earlyCheckAvatarImportFile,
  isImportOriginalFlowStatus,
  type BodyConversionResultV1,
  type ImportAnalysisSummaryV1,
  type ImportOriginalFlowStatus,
  type ImportOriginalKeepSeedV1,
} from '../../../domains/character/avatar';
import {
  avatarImportLimits,
  keepOriginalImportedAvatar,
  uploadAndAnalyzeCharacterAvatarModel,
  type AvatarImportDraftV2,
} from '../../../infrastructure/character/avatar/character-avatar-import-service';
import { Button } from '../../../shared/ui/button';
import { AvatarBodyConversionPanel } from './AvatarBodyConversionPanel';
import { AvatarCustomCreatureGuidance } from './AvatarCustomCreatureGuidance';

interface AvatarImportPanelProps {
  characterId?: string | null;
  /** Called only after user confirms „Original behalten“. */
  onKeepOriginal: (seed: ImportOriginalKeepSeedV1) => void;
  /** Optional conversion onto canonical body family (#263). */
  onConverted?: (result: BodyConversionResultV1) => void;
}

const STATUS_LABEL: Record<ImportOriginalFlowStatus, string> = {
  idle: 'Bereit für Import',
  validating: 'Datei wird geprüft …',
  uploading: 'Upload läuft …',
  analyzing: 'Modell wird analysiert …',
  'ready-humanoid': 'Humanoid erkannt',
  'ready-custom': 'Eigener Körper',
  limited: 'Eingeschränkt nutzbar',
  failed: 'Import fehlgeschlagen',
};

function toFlowStatus(value: string): ImportOriginalFlowStatus {
  return isImportOriginalFlowStatus(value) ? value : 'analyzing';
}

export function AvatarImportPanel({
  characterId,
  onKeepOriginal,
  onConverted,
}: AvatarImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<ImportOriginalFlowStatus>('idle');
  const [message, setMessage] = useState('VRM oder GLB auswählen — max. 150 MB.');
  const [dragOver, setDragOver] = useState(false);
  const [draft, setDraft] = useState<AvatarImportDraftV2 | null>(null);
  const [keeping, setKeeping] = useState(false);
  const busy =
    status === 'validating' ||
    status === 'uploading' ||
    status === 'analyzing' ||
    keeping;
  const limits = avatarImportLimits();
  const summary: ImportAnalysisSummaryV1 | null = draft?.summary ?? null;
  const showKeep = Boolean(summary?.canKeepOriginal);

  const runImport = async (file: File) => {
    const early = earlyCheckAvatarImportFile({ fileName: file.name, byteSize: file.size });
    if (!early.ok) {
      setStatus('failed');
      setMessage(early.message ?? 'Datei ungültig.');
      setDraft(null);
      return;
    }
    setDraft(null);
    try {
      const next = await uploadAndAnalyzeCharacterAvatarModel(file, {
        characterId,
        onProgress: (progress) => {
          setStatus(toFlowStatus(progress.status));
          setMessage(progress.message);
        },
      });
      setDraft(next);
      setStatus(next.summary.flowStatus);
      setMessage(next.summary.detailDe);
    } catch (error) {
      setStatus('failed');
      setMessage(error instanceof Error ? error.message : 'Import fehlgeschlagen.');
      setDraft(null);
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void runImport(file);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void runImport(file);
  };

  const onKeepClick = async () => {
    if (!draft || !draft.summary.canKeepOriginal) return;
    setKeeping(true);
    try {
      const seed = await keepOriginalImportedAvatar({
        draft,
        characterId,
      });
      onKeepOriginal(seed);
      setMessage('Originalkörper behalten — gemeinsamer Editor ist bereit.');
    } catch (error) {
      setStatus('failed');
      setMessage(
        error instanceof Error ? error.message : 'Original behalten fehlgeschlagen.',
      );
    } finally {
      setKeeping(false);
    }
  };

  return (
    <div className="space-y-3" data-avatar-import-panel data-avatar-import-flow="v2">
      <div
        data-avatar-import-dropzone
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-lg border border-dashed p-4 transition ${
          dragOver ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'
        }`}
      >
        <p className="text-sm font-medium">3D-Modell importieren</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Eigenes .vrm / .glb hochladen. Nach der Analyse kannst du den Originalkörper behalten —
          ohne erzwungene Konvertierung.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            aria-busy={busy}
            data-avatar-import-cta
            className="min-h-11"
          >
            <UploadSimple className="mr-2 h-4 w-4" aria-hidden />
            3D-Modell importieren
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={limits.accept}
            className="hidden"
            onChange={onFileChange}
          />
          <a
            href={AVATAR_IMPORT_GLB_SPEC_HELP_HREF}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1 text-xs text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            data-avatar-import-glb-help
          >
            <ArrowSquareOut className="h-3.5 w-3.5" aria-hidden />
            {AVATAR_IMPORT_GLB_SPEC_HELP_LABEL_DE}
          </a>
        </div>
      </div>

      <div
        className={`rounded-md border px-3 py-2 text-xs ${
          status === 'failed'
            ? 'border-red-400/40 bg-red-500/10 text-red-950 dark:text-red-100'
            : showKeep
              ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
              : 'border-border bg-background text-muted-foreground'
        }`}
        role="status"
        aria-live="polite"
        data-avatar-import-status={status}
      >
        <span className="font-medium">{STATUS_LABEL[status]}</span>
        <span className="mt-0.5 block">{message}</span>
      </div>

      {summary && summary.flowStatus !== 'failed' ? (
        <section
          className="space-y-2 rounded-lg border border-border bg-muted/20 p-3"
          aria-label="Analyse-Ergebnis"
          data-avatar-import-analysis-summary
        >
          <h3 className="text-sm font-medium">{summary.headlineDe}</h3>
          <p className="text-xs text-muted-foreground">{summary.detailDe}</p>
          <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Anatomie</dt>
              <dd data-avatar-import-anatomy={summary.anatomy}>{summary.anatomyLabelDe}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Modularität</dt>
              <dd data-avatar-import-modularity={summary.modularity}>
                {summary.modularityLabelDe}
                {summary.modularityKindLabelDe
                  ? ` · ${summary.modularityKindLabelDe}`
                  : ''}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Körper-Empfehlung</dt>
              <dd data-avatar-import-family={summary.recommendedFamily}>
                {summary.familyLabelDe}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Fähigkeiten</dt>
              <dd data-avatar-import-capabilities>{summary.capabilitiesLabelDe}</dd>
            </div>
          </dl>
          {summary.limitationsDe.length > 0 ? (
            <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {summary.limitationsDe.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          <AvatarCustomCreatureGuidance summary={summary} />
          {showKeep ? (
            <Button
              type="button"
              disabled={busy}
              onClick={() => void onKeepClick()}
              aria-busy={keeping}
              data-avatar-import-keep-original
              className="min-h-11 w-full sm:w-auto"
            >
              Original behalten
            </Button>
          ) : null}
          {showKeep && draft && onConverted ? (
            <AvatarBodyConversionPanel
              summary={summary}
              keepSeed={draft.keepSeed}
              disabled={busy}
              onConverted={onConverted}
            />
          ) : null}
        </section>
      ) : null}

      {status === 'failed' ? (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          data-avatar-import-retry
          className="min-h-11"
        >
          Andere Datei wählen
        </Button>
      ) : null}
    </div>
  );
}
