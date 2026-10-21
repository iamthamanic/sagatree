/**
 * AiProviderCredentialsPanel — Settings AI BYOK cards filtered by modality.
 * Location: src/app/profile/AiProviderCredentialsPanel.tsx
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Label } from '../../shared/ui/label';
import { Separator } from '../../shared/ui/separator';
import {
  formatProviderAddedAt,
  settingsAiTabToModality,
  type AiProviderCredentialView,
} from '../../domains/ai-providers';
import { aiProviderCredentialsService } from '../../infrastructure/ai/ai-provider-credentials-service';
import { toast } from 'sonner';
import {
  Key,
  CircleNotch,
  ArrowsClockwise,
  Trash
} from '@phosphor-icons/react';

type AiSubTab = 'bild' | '3d' | 'video' | 'audio';

interface AiProviderCredentialsPanelProps {
  tab: AiSubTab;
}

export function AiProviderCredentialsPanel({ tab }: AiProviderCredentialsPanelProps) {
  const modality = settingsAiTabToModality(tab);
  const [providers, setProviders] = useState<AiProviderCredentialView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyProviderId, setBusyProviderId] = useState<string | null>(null);
  const [draftKeys, setDraftKeys] = useState<Record<string, string>>({});
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const list = await aiProviderCredentialsService.list(modality);
        if (!cancelled && mounted.current) setProviders(list);
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Provider konnten nicht geladen werden.');
          if (mounted.current) setProviders([]);
        }
      } finally {
        if (!cancelled && mounted.current) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modality]);

  async function handleSave(providerId: string) {
    const apiKey = (draftKeys[providerId] ?? '').trim();
    if (!apiKey) {
      toast.error('Bitte einen API-Key eingeben.');
      return;
    }
    setBusyProviderId(providerId);
    try {
      const updated = await aiProviderCredentialsService.upsert(providerId, apiKey);
      setProviders((prev) =>
        prev.map((p) => (p.providerId === providerId ? updated : p)),
      );
      setDraftKeys((prev) => ({ ...prev, [providerId]: '' }));
      toast.success(`${updated.displayName} verbunden.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.');
    } finally {
      setBusyProviderId(null);
    }
  }

  async function handleRefresh(providerId: string) {
    setBusyProviderId(providerId);
    try {
      const updated = await aiProviderCredentialsService.refresh(providerId);
      setProviders((prev) =>
        prev.map((p) => (p.providerId === providerId ? updated : p)),
      );
      toast.success('Credits aktualisiert.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Aktualisieren fehlgeschlagen.');
    } finally {
      setBusyProviderId(null);
    }
  }

  async function handleDelete(providerId: string, displayName: string) {
    setBusyProviderId(providerId);
    try {
      await aiProviderCredentialsService.delete(providerId);
      setProviders((prev) =>
        prev.map((p) =>
          p.providerId === providerId
            ? {
                ...p,
                configured: false,
                keyHint: null,
                status: null,
                addedAt: null,
                lastValidatedAt: null,
                meta: {},
              }
            : p,
        ),
      );
      toast.success(`${displayName}-Key entfernt.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Entfernen fehlgeschlagen.');
    } finally {
      setBusyProviderId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" data-ai-providers-loading>
        <CircleNotch className="size-4 animate-spin" aria-hidden="true" />
        Provider werden geladen…
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-ai-providers-empty>
        Noch keine Provider für diesen Bereich. Später hier verbindbar.
      </p>
    );
  }

  return (
    <div className="space-y-4" data-ai-providers-panel data-ai-modality={modality}>
      {providers.map((provider) => {
        const busy = busyProviderId === provider.providerId;
        const addedLabel = formatProviderAddedAt(provider.addedAt);
        return (
          <div
            key={provider.providerId}
            className="space-y-3 rounded-lg border border-foreground/10 p-4"
            data-ai-provider={provider.providerId}
            data-ai-provider-configured={provider.configured ? 'true' : 'false'}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium md:text-base">
                  <Key className="size-4 text-primary" aria-hidden="true" />
                  {provider.displayName}
                </p>
                <p className="text-xs text-muted-foreground md:text-sm">
                  {provider.configured
                    ? `Verbunden${provider.keyHint ? ` · ${provider.keyHint}` : ''}`
                    : 'API-Key hinterlegen (wird serverseitig geprüft und verschlüsselt gespeichert)'}
                </p>
              </div>
              {provider.docsUrl ? (
                <a
                  href={provider.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary underline-offset-2 hover:underline md:text-sm"
                >
                  Docs
                </a>
              ) : null}
            </div>

            {!provider.configured ? (
              <div className="space-y-2">
                <Label htmlFor={`ai-key-${provider.providerId}`}>API-Key</Label>
                <Input
                  id={`ai-key-${provider.providerId}`}
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="msy_…"
                  value={draftKeys[provider.providerId] ?? ''}
                  onChange={(event) =>
                    setDraftKeys((prev) => ({
                      ...prev,
                      [provider.providerId]: event.target.value,
                    }))
                  }
                  disabled={busy}
                />
                <Button
                  type="button"
                  className="min-h-11 w-full sm:w-auto"
                  disabled={busy}
                  onClick={() => void handleSave(provider.providerId)}
                >
                  {busy ? (
                    <>
                      <CircleNotch className="size-4 animate-spin" aria-hidden="true" />
                      Prüfen…
                    </>
                  ) : (
                    'Speichern & prüfen'
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 space-y-1 text-xs text-muted-foreground md:text-sm">
                    {addedLabel ? <p>Hinzugefügt: {addedLabel}</p> : null}
                    <p>
                      Credits:{' '}
                      {typeof provider.meta.credits === 'number'
                        ? provider.meta.credits.toLocaleString('de-DE')
                        : '—'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 gap-1.5"
                      disabled={busy}
                      onClick={() => void handleRefresh(provider.providerId)}
                    >
                      <ArrowsClockwise className={`size-4 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
                      Credits aktualisieren
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="min-h-11 gap-1.5"
                      disabled={busy}
                      onClick={() => void handleDelete(provider.providerId, provider.displayName)}
                    >
                      <Trash className="size-4" aria-hidden="true" />
                      Key entfernen
                    </Button>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor={`ai-key-replace-${provider.providerId}`}>Key ersetzen</Label>
                  <Input
                    id={`ai-key-replace-${provider.providerId}`}
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Neuen Key einfügen…"
                    value={draftKeys[provider.providerId] ?? ''}
                    onChange={(event) =>
                      setDraftKeys((prev) => ({
                        ...prev,
                        [provider.providerId]: event.target.value,
                      }))
                    }
                    disabled={busy}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={busy}
                    onClick={() => void handleSave(provider.providerId)}
                  >
                    Ersetzen & prüfen
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
