/**
 * OllamaOrganizeEditDialog — Modal to configure Ollama (Lokal/Cloud, URL, Key, Test, Model).
 * Opened from Organize provider list via Edit. Location: src/app/profile/OllamaOrganizeEditDialog.tsx
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Label } from '../../shared/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../shared/ui/dialog';
import {
  OLLAMA_CLOUD_OPENAI_BASE,
  type OllamaSettingsView,
} from '../../domains/ai-providers';
import { ollamaSettingsService } from '../../infrastructure/ai/ollama-settings-service';
import { toast } from 'sonner';
import { CheckCircle, CircleNotch, FloppyDisk } from '@phosphor-icons/react';

type OllamaUiMode = 'local' | 'cloud';

function modeFromSettings(settings: OllamaSettingsView): OllamaUiMode {
  return settings.useCloud ? 'cloud' : 'local';
}

function applyMode(
  mode: OllamaUiMode,
  prev: OllamaSettingsView,
): Pick<OllamaSettingsView, 'useCloud' | 'baseUrl'> {
  if (mode === 'cloud') {
    return {
      useCloud: true,
      baseUrl: prev.cloudDefaultUrl || OLLAMA_CLOUD_OPENAI_BASE,
    };
  }
  return {
    useCloud: false,
    baseUrl:
      prev.baseUrl.includes('ollama.com') || !prev.baseUrl.trim()
        ? prev.localDefaultUrl || 'http://127.0.0.1:11434'
        : prev.baseUrl,
  };
}

export interface OllamaOrganizeEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: OllamaSettingsView;
  onSaved: (settings: OllamaSettingsView) => void;
}

export function OllamaOrganizeEditDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: OllamaOrganizeEditDialogProps) {
  const [settings, setSettings] = useState<OllamaSettingsView>(initial);
  const [models, setModels] = useState<string[]>(
    initial.model ? [initial.model] : [],
  );
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [connectionOk, setConnectionOk] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setSettings(initial);
      setModels(initial.model ? [initial.model] : []);
      setApiKeyDraft('');
      setConnectionOk(false);
      setTestMessage(null);
      setBusy(null);
    }
    wasOpen.current = open;
  }, [open, initial]);

  const mode = modeFromSettings(settings);
  const modelsUnlocked = connectionOk && models.length > 0;
  const modelOptions =
    settings.model && !models.includes(settings.model)
      ? [settings.model, ...models]
      : models;

  function setMode(next: OllamaUiMode) {
    setSettings({
      ...settings,
      ...applyMode(next, settings),
    });
    setConnectionOk(false);
    setTestMessage(null);
    setModels(settings.model ? [settings.model] : []);
  }

  async function handleTest() {
    if (!settings.baseUrl.trim()) {
      toast.error('Bitte eine Basis-URL eingeben.');
      return;
    }
    if (mode === 'cloud' && !apiKeyDraft.trim() && !settings.hasApiKey) {
      toast.error('Ollama Cloud: API-Key eingeben oder gespeichert haben.');
      return;
    }
    setBusy('test');
    try {
      const result = await ollamaSettingsService.test({
        useCloud: mode === 'cloud',
        baseUrl: settings.baseUrl,
        model: settings.model,
        apiKey: apiKeyDraft || undefined,
      });
      if (mounted.current) {
        setModels(result.models);
        setConnectionOk(true);
        setTestMessage(result.message);
        if (result.models.length > 0 && !result.models.includes(settings.model)) {
          setSettings({ ...settings, model: result.models[0] });
        }
      }
      toast.success(result.message);
    } catch (error) {
      if (mounted.current) {
        setConnectionOk(false);
        setTestMessage(
          error instanceof Error ? error.message : 'Verbindungstest fehlgeschlagen.',
        );
      }
      toast.error(error instanceof Error ? error.message : 'Verbindungstest fehlgeschlagen.');
    } finally {
      setBusy(null);
    }
  }

  async function handleSave() {
    if (!connectionOk) {
      toast.error('Bitte zuerst „Verbindung testen“.');
      return;
    }
    if (!settings.model.trim()) {
      toast.error('Bitte ein Modell wählen.');
      return;
    }
    if (mode === 'cloud' && !apiKeyDraft.trim() && !settings.hasApiKey) {
      toast.error('Ollama Cloud benötigt einen API-Key.');
      return;
    }
    if (!settings.baseUrl.trim()) {
      toast.error('Bitte eine Basis-URL eingeben.');
      return;
    }
    setBusy('save');
    try {
      const result = await ollamaSettingsService.upsert({
        useCloud: mode === 'cloud',
        baseUrl: settings.baseUrl,
        model: settings.model,
        apiKey: apiKeyDraft || undefined,
      });
      if (mounted.current) {
        setSettings(result.settings);
        setApiKeyDraft('');
        setConnectionOk(true);
        if (result.models.length > 0) setModels(result.models);
        onSaved(result.settings);
        onOpenChange(false);
      }
      toast.success('Ollama-Verbindung gespeichert.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(90vh,40rem)] overflow-y-auto sm:max-w-lg"
        data-ollama-organize-edit-dialog
      >
        <DialogHeader>
          <DialogTitle>Ollama bearbeiten</DialogTitle>
          <DialogDescription>
            Lokal oder Cloud verbinden, testen und Modell wählen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Verbindung</Label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ollama Modus">
              <Button
                type="button"
                size="sm"
                variant={mode === 'local' ? 'default' : 'outline'}
                className="h-8 min-h-8 px-2.5 text-xs"
                disabled={busy !== null}
                onClick={() => setMode('local')}
                data-ollama-mode="local"
              >
                Lokal
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === 'cloud' ? 'default' : 'outline'}
                className="h-8 min-h-8 px-2.5 text-xs"
                disabled={busy !== null}
                onClick={() => setMode('cloud')}
                data-ollama-mode="cloud"
              >
                Cloud
              </Button>
            </div>
            <p className="text-[0.7rem] leading-snug text-muted-foreground">
              {mode === 'local'
                ? 'Eigener Ollama-Host (z. B. localhost:11434). Key nur nötig, wenn dein Server einen verlangt.'
                : 'Ollama Cloud: Basis-URL sichtbar und anpassbar (Default ollama.com/v1). API-Key erforderlich.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ollama-edit-base-url" className="text-xs">
              Basis-URL
            </Label>
            <Input
              id="ollama-edit-base-url"
              type="url"
              value={settings.baseUrl}
              onChange={(event) => {
                setSettings({ ...settings, baseUrl: event.target.value });
                setConnectionOk(false);
                setTestMessage(null);
              }}
              placeholder={
                mode === 'cloud'
                  ? settings.cloudDefaultUrl || OLLAMA_CLOUD_OPENAI_BASE
                  : settings.localDefaultUrl || 'http://127.0.0.1:11434'
              }
              autoComplete="off"
              spellCheck={false}
              className="min-h-11 text-sm"
              data-ollama-base-url
            />
            {mode === 'cloud' ? (
              <p className="text-[0.65rem] leading-snug text-muted-foreground">
                Standard: {settings.cloudDefaultUrl || OLLAMA_CLOUD_OPENAI_BASE}
              </p>
            ) : null}
            <Label htmlFor="ollama-edit-api-key" className="text-xs">
              {mode === 'cloud' ? 'API-Key (Ollama Cloud)' : 'API-Key (optional)'}
            </Label>
            <Input
              id="ollama-edit-api-key"
              type="password"
              value={apiKeyDraft}
              onChange={(event) => {
                setApiKeyDraft(event.target.value);
                setConnectionOk(false);
                setTestMessage(null);
              }}
              placeholder={
                settings.hasApiKey
                  ? `Gespeichert ${settings.keyHint ?? ''} — neu setzen oder leer lassen`.trim()
                  : mode === 'cloud'
                    ? 'Key von ollama.com'
                    : 'Leer lassen, wenn kein Auth'
              }
              autoComplete="off"
              className="min-h-11"
              data-ollama-api-key
            />
            {mode === 'cloud' && settings.hasApiKey ? (
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                API-Key hinterlegt
              </p>
            ) : null}
          </div>

          <div className="flex flex-col items-start gap-1 border-t border-border/40 pt-3">
            <Button
              type="button"
              variant="default"
              size="sm"
              className="min-h-11"
              disabled={busy !== null}
              onClick={() => void handleTest()}
              data-ollama-test
            >
              {busy === 'test' ? (
                <>
                  <CircleNotch className="size-4 animate-spin" aria-hidden="true" />
                  Test…
                </>
              ) : (
                'Verbindung testen'
              )}
            </Button>
            <p className="max-w-md text-[0.65rem] leading-snug text-muted-foreground">
              Nach erfolgreichem Test Modell wählen und mit „Verbindung speichern“ übernehmen.
            </p>
          </div>

          {testMessage ? (
            connectionOk ? (
              <div
                className="flex gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/[0.06] px-3 py-2 text-xs"
                data-ollama-test-ok
              >
                <CheckCircle
                  className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                <p>
                  Verbindung in Ordnung — {models.length} Modell(e).{' '}
                  <span className="text-muted-foreground">{testMessage}</span>
                </p>
              </div>
            ) : (
              <div
                className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                data-ollama-test-fail
              >
                {testMessage}
              </div>
            )
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="ollama-edit-model" className="text-xs">
              Modell
            </Label>
            <select
              id="ollama-edit-model"
              className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              value={settings.model}
              disabled={!modelsUnlocked || busy !== null}
              onChange={(event) =>
                setSettings({ ...settings, model: event.target.value })
              }
              data-ollama-model
            >
              {!modelsUnlocked ? (
                <option value={settings.model || ''}>
                  — zuerst Verbindung testen —
                </option>
              ) : (
                modelOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))
              )}
            </select>
          </div>

          <Button
            type="button"
            size="sm"
            className="min-h-11 w-full sm:w-auto"
            disabled={busy !== null || !connectionOk || !settings.model.trim()}
            onClick={() => void handleSave()}
            data-ollama-save
          >
            {busy === 'save' ? (
              <CircleNotch className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FloppyDisk className="size-4" aria-hidden="true" />
            )}
            Verbindung speichern
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
