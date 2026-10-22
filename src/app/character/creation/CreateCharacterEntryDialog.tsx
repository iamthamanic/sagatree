/**
 * CreateCharacterEntryDialog — Two-card create chooser: own character vs Vorlage (system + user presets).
 * Location: src/app/character/creation/CreateCharacterEntryDialog.tsx
 */
import { useEffect, useState } from 'react';
import {
  CircleNotch,
  Sparkle,
  UserPlus
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from '../../../shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../shared/ui/dialog';
import { clearCharacterEditorBootstrap, setCharacterEditorBootstrap } from '../shared/characterEditorBootstrap';
import { assertValidSnapshot, characterPresetService } from '../../../infrastructure/character/character-preset-service';
import type { CharacterPresetVm } from '../../../domains/character/contracts/character-preset.types';
import type { SagaTreeStartingTemplateKey } from '../../../domains/rules/sagatree/starting-templates';
import { StartingTemplatePicker } from './StartingTemplatePicker';

type CreateStep = 'chooser' | 'presets' | 'versions';

type CreateCharacterEntryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateToEditor: () => void;
};

export function CreateCharacterEntryDialog({
  open,
  onOpenChange,
  onNavigateToEditor,
}: CreateCharacterEntryDialogProps) {
  const [step, setStep] = useState<CreateStep>('chooser');
  const [loading, setLoading] = useState(false);
  const [presets, setPresets] = useState<CharacterPresetVm[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<CharacterPresetVm | null>(null);

  useEffect(() => {
    if (!open) {
      setStep('chooser');
      setSelectedPreset(null);
      setPresets([]);
      return;
    }
  }, [open]);

  const loadPresets = async () => {
    setLoading(true);
    try {
      const list = await characterPresetService.listUserPresets();
      setPresets(list);
      setStep('presets');
    } catch (error) {
      console.error('Preset list error:', error);
      toast.error(error instanceof Error ? error.message : 'Presets konnten nicht geladen werden.');
      // Still open the presets step so empty/stub UI is reachable (e2e + offline DB).
      setPresets([]);
      setStep('presets');
    } finally {
      setLoading(false);
    }
  };

  const handleOwnCharacter = () => {
    clearCharacterEditorBootstrap();
    onOpenChange(false);
    onNavigateToEditor();
  };

  const handlePresetCard = async () => {
    await loadPresets();
  };

  const handleStartingTemplate = (templateKey: SagaTreeStartingTemplateKey) => {
    setCharacterEditorBootstrap({
      kind: 'starting-template',
      templateKey,
    });
    onOpenChange(false);
    onNavigateToEditor();
  };

  const handleSelectVersion = (preset: CharacterPresetVm, level: number) => {
    const version = preset.versions.find((entry) => entry.level === level);
    if (!version) {
      toast.error('Version nicht gefunden.');
      return;
    }
    try {
      assertValidSnapshot(version.snapshot);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Preset-Version ungültig.');
      return;
    }
    setCharacterEditorBootstrap({
      kind: 'preset-snapshot',
      characterName: preset.displayName.replace(/\s+Preset$/i, '').trim() || version.snapshot.name,
      snapshot: version.snapshot,
    });
    onOpenChange(false);
    onNavigateToEditor();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === 'chooser' && 'Charakter erstellen'}
            {step === 'presets' && 'Vorlage wählen'}
            {step === 'versions' && (selectedPreset?.displayName ?? 'Version wählen')}
          </DialogTitle>
          <DialogDescription>
            {step === 'chooser' && 'Starte mit einem leeren Bogen oder übernehme ein gespeichertes Preset.'}
            {step === 'presets' && 'SagaTree-Starttemplate oder eigenes Preset verwenden.'}
            {step === 'versions' && 'Wähle eine Level-Version — es wird ein neuer Charakter geöffnet.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'chooser' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleOwnCharacter}
              className="flex min-h-[11rem] flex-col items-start justify-between rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <UserPlus className="h-8 w-8 text-primary" aria-hidden />
              <div className="space-y-1">
                <p className="text-lg font-semibold">Eigenen Charakter erstellen</p>
                <p className="text-sm text-muted-foreground">Leerer Editor — wie bisher.</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => void handlePresetCard()}
              disabled={loading}
              className="flex min-h-[11rem] flex-col items-start justify-between rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              {loading ? <CircleNotch className="h-8 w-8 animate-spin text-primary" aria-hidden /> : <Sparkle className="h-8 w-8 text-primary" aria-hidden />}
              <div className="space-y-1">
                <p className="text-lg font-semibold">Vorlage wählen</p>
                <p className="text-sm text-muted-foreground">SagaTree-Starttemplate oder eigenes Preset verwenden.</p>
              </div>
            </button>
          </div>
        )}

        {step === 'presets' && (
          <div className="space-y-4">
            <StartingTemplatePicker onSelect={handleStartingTemplate} />
            <div className="space-y-2">
              <p className="text-sm font-medium">Deine Presets</p>
              {presets.length === 0 ? (
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="w-full rounded-xl border border-dashed border-border bg-muted/20 p-6 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5"
                >
                  Noch keine Presets — speichere einen gültigen Charakter unter Einstellungen → Preset.
                </button>
              ) : (
                <ul className="max-h-64 space-y-2 overflow-y-auto">
                  {presets.map((preset) => (
                    <li key={preset.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPreset(preset);
                          setStep('versions');
                        }}
                        className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary"
                      >
                        <span className="font-medium">{preset.displayName}</span>
                        <span className="text-xs text-muted-foreground">{preset.versions.length} Version{preset.versions.length === 1 ? '' : 'en'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => setStep('chooser')}>Zurück</Button>
            </div>
          </div>
        )}

        {step === 'versions' && selectedPreset && (
          <div className="space-y-4">
            {selectedPreset.sourceCharacterMissing && (
              <p className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                Quellcharakter gelöscht — Preset bleibt nutzbar.
              </p>
            )}
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {selectedPreset.versions.map((version) => (
                <li key={`${selectedPreset.id}-${version.level}-${version.created_at}`}>
                  <button
                    type="button"
                    onClick={() => handleSelectVersion(selectedPreset, version.level)}
                    className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary"
                  >
                    <span className="font-medium">Level {version.level}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(version.created_at).toLocaleDateString('de-DE')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => { setSelectedPreset(null); setStep('presets'); }}>Zurück</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
