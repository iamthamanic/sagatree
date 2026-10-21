/**
 * CharacterPresetPanel — Einstellungen → Preset: save/release, versions, rename/delete/duplicate, auto toggle, marketplace stub.
 * Location: src/app/character/progression/CharacterPresetPanel.tsx
 */
import { useEffect, useState } from 'react';
import {
  Copy,
  CircleNotch,
  PencilSimple,
  Trash
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import { Switch } from '../../../shared/ui/switch';
import { characterPresetService } from '../../../infrastructure/character/character-preset-service';
import type { CharacterPresetReleaseMode, CharacterPresetSnapshot, CharacterPresetVm } from '../../../domains/character/contracts/character-preset.types';
import type { CharacterRulesetKey } from '../../../domains/rules/sagatree/character-creation';

type CharacterPresetPanelProps = {
  characterId: string | null;
  characterName: string;
  characterLevel: number;
  ruleset: CharacterRulesetKey;
  releaseMode: CharacterPresetReleaseMode;
  onReleaseModeChange: (mode: CharacterPresetReleaseMode) => void;
  /** Returns null when editor validation passes; otherwise German error message. */
  validateForPreset: () => string | null;
  buildSnapshot: () => CharacterPresetSnapshot;
};

export function CharacterPresetPanel({
  characterId,
  characterName,
  characterLevel,
  ruleset,
  releaseMode,
  onReleaseModeChange,
  validateForPreset,
  buildSnapshot,
}: CharacterPresetPanelProps) {
  const [preset, setPreset] = useState<CharacterPresetVm | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  const load = async (id: string) => {
    setLoading(true);
    try {
      const linked = await characterPresetService.getPresetForCharacter(id);
      setPreset(linked);
      setRenameValue(linked?.displayName ?? '');
    } catch (error) {
      console.error('Preset load error:', error);
      setPreset(null);
      toast.error(error instanceof Error ? error.message : 'Preset konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!characterId) {
      setPreset(null);
      return;
    }
    void load(characterId);
  }, [characterId]);

  const assertCore = (): boolean => {
    if (ruleset !== 'sagatree-core') {
      toast.error('Presets sind derzeit nur für SagaTree Core verfügbar.');
      return false;
    }
    return true;
  };

  const handleSaveAsPreset = async () => {
    if (!characterId) {
      toast.error('Speichere den Charakter zuerst.');
      return;
    }
    if (!assertCore()) return;
    const validationError = validateForPreset();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setBusy(true);
    try {
      const snapshot = buildSnapshot();
      const created = await characterPresetService.createPresetFromCharacter({
        displayName: `${characterName.trim() || snapshot.name} Preset`,
        rulesetKey: 'sagatree-core',
        sourceCharacterId: characterId,
        snapshot,
      });
      setPreset(created);
      setRenameValue(created.displayName);
      toast.success(`Preset gespeichert (Level ${snapshot.level}).`);
    } catch (error) {
      console.error('Preset create error:', error);
      toast.error(error instanceof Error ? error.message : 'Preset konnte nicht gespeichert werden.');
    } finally {
      setBusy(false);
    }
  };

  const handleReleaseVersion = async () => {
    if (!characterId || !preset) {
      toast.error('Kein Preset für diesen Charakter.');
      return;
    }
    if (!assertCore()) return;
    const validationError = validateForPreset();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setBusy(true);
    try {
      const snapshot = buildSnapshot();
      const updated = await characterPresetService.releaseVersion({ presetId: preset.id, snapshot });
      setPreset(updated);
      toast.success(`Version Level ${snapshot.level} freigegeben.`);
    } catch (error) {
      console.error('Preset release error:', error);
      toast.error(error instanceof Error ? error.message : 'Version konnte nicht freigegeben werden.');
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async () => {
    if (!preset) return;
    setBusy(true);
    try {
      const updated = await characterPresetService.renamePreset(preset.id, renameValue);
      setPreset(updated);
      setRenaming(false);
      toast.success('Preset umbenannt.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Umbenennen fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const handleDuplicate = async () => {
    if (!preset) return;
    setBusy(true);
    try {
      await characterPresetService.duplicatePreset(preset.id);
      toast.success('Preset dupliziert.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Duplizieren fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!preset) return;
    if (!window.confirm(`Preset „${preset.displayName}“ wirklich löschen?`)) return;
    setBusy(true);
    try {
      await characterPresetService.deletePreset(preset.id);
      setPreset(null);
      setRenameValue('');
      toast.success('Preset gelöscht.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Löschen fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  if (!characterId) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
        Speichere den Charakter zuerst, um ihn als Preset zu speichern oder Versionen freizugeben.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CircleNotch className="h-4 w-4 animate-spin" />
        Lade Preset…
      </div>
    );
  }

  const hasLevelVersion = preset?.versions.some((version) => version.level === characterLevel) ?? false;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="font-semibold">Preset</h3>
        <p className="text-sm text-muted-foreground">
          Speichert einen vollständigen Charakterbogen-Snapshot (inkl. Portrait). Versionen sind append-only als Level&nbsp;N.
        </p>
      </div>

      {preset?.sourceCharacterMissing && (
        <p className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Quellcharakter gelöscht — Preset bleibt nutzbar.
        </p>
      )}

      {!preset ? (
        <Button type="button" onClick={() => void handleSaveAsPreset()} disabled={busy || ruleset !== 'sagatree-core'}>
          {busy ? 'Speichert…' : 'Als Preset speichern'}
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {renaming ? (
              <>
                <Input
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  className="max-w-xs"
                  aria-label="Preset-Anzeigename"
                />
                <Button type="button" size="sm" onClick={() => void handleRename()} disabled={busy}>Speichern</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setRenaming(false); setRenameValue(preset.displayName); }}>Abbrechen</Button>
              </>
            ) : (
              <>
                <p className="text-base font-medium">{preset.displayName}</p>
                <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(true)} aria-label="Preset umbenennen">
                  <PencilSimple className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void handleReleaseVersion()}
              disabled={busy || hasLevelVersion || ruleset !== 'sagatree-core'}
            >
              {busy ? 'Freigabe…' : `Version freigeben (Level ${characterLevel})`}
            </Button>
            <Button type="button" variant="outline" onClick={() => void handleDuplicate()} disabled={busy}>
              <Copy className="mr-2 h-4 w-4" />
              Duplizieren
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={busy}>
              <Trash className="mr-2 h-4 w-4" />
              Löschen
            </Button>
          </div>
          {hasLevelVersion && (
            <p className="text-xs text-muted-foreground">Für Level {characterLevel} existiert bereits eine Version (kein Überschreiben).</p>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">Versionen</p>
            {preset.versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Versionen.</p>
            ) : (
              <ul className="space-y-2">
                {preset.versions.map((version) => (
                  <li
                    key={`${preset.id}-${version.level}-${version.created_at}`}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span>Level {version.level}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(version.created_at).toLocaleDateString('de-DE')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
        <div className="space-y-1">
          <Label htmlFor="preset-auto-release">Auto-Freigabe bei Level-Up</Label>
          <p className="text-xs text-muted-foreground">
            Nach erfolgreichem Speichern, wenn die Stufe gestiegen ist und der Bogen gültig ist — nicht allein bei Stufen-Dropdown.
          </p>
        </div>
        <Switch
          id="preset-auto-release"
          checked={releaseMode === 'auto'}
          onCheckedChange={(checked) => onReleaseModeChange(checked ? 'auto' : 'manual')}
          aria-label="Auto-Freigabe bei Level-Up"
        />
      </div>

      <div className="rounded-lg border border-dashed border-border bg-muted/10 p-4 opacity-70">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">Marketplace</p>
          <Badge variant="outline">Coming soon</Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Veröffentlichen ist noch nicht verfügbar (`published: false`).</p>
        <Button type="button" size="sm" className="mt-3" disabled>
          Veröffentlichen
        </Button>
      </div>
    </div>
  );
}
