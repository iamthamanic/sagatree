/**
 * AiProviderCredentialsEditDialog — Modal to connect / replace / remove a BYOK key.
 * Opened from Bild/3D/Video/Audio provider list via Edit.
 * Location: src/app/profile/AiProviderCredentialsEditDialog.tsx
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
  formatProviderAddedAt,
  type AiProviderCredentialView,
} from '../../domains/ai-providers';
import { aiProviderCredentialsService } from '../../infrastructure/ai/ai-provider-credentials-service';
import { toast } from 'sonner';
import { CircleNotch, ArrowsClockwise, FloppyDisk, Trash } from '@phosphor-icons/react';

export interface AiProviderCredentialsEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: AiProviderCredentialView | null;
  onSaved: (provider: AiProviderCredentialView) => void;
}

export function AiProviderCredentialsEditDialog({
  open,
  onOpenChange,
  provider,
  onSaved,
}: AiProviderCredentialsEditDialogProps) {
  const [draftKey, setDraftKey] = useState('');
  const [busy, setBusy] = useState<'save' | 'refresh' | 'delete' | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setDraftKey('');
    setBusy(null);
  }, [open, provider?.providerId]);

  if (!provider) return null;

  const addedLabel = formatProviderAddedAt(provider.addedAt);
  const creditsLabel =
    typeof provider.meta.credits === 'number'
      ? provider.meta.credits.toLocaleString('de-DE')
      : null;

  async function handleSave() {
    const apiKey = draftKey.trim();
    if (!apiKey) {
      toast.error('Bitte einen API-Key eingeben.');
      return;
    }
    setBusy('save');
    try {
      const updated = await aiProviderCredentialsService.upsert(provider.providerId, apiKey);
      if (!mounted.current) return;
      onSaved(updated);
      setDraftKey('');
      toast.success(
        provider.configured
          ? `${updated.displayName}-Key ersetzt.`
          : `${updated.displayName} verbunden.`,
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.');
    } finally {
      if (mounted.current) setBusy(null);
    }
  }

  async function handleRefresh() {
    setBusy('refresh');
    try {
      const updated = await aiProviderCredentialsService.refresh(provider.providerId);
      if (!mounted.current) return;
      onSaved(updated);
      toast.success('Credits aktualisiert.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Aktualisieren fehlgeschlagen.');
    } finally {
      if (mounted.current) setBusy(null);
    }
  }

  async function handleDelete() {
    setBusy('delete');
    try {
      await aiProviderCredentialsService.delete(provider.providerId);
      if (!mounted.current) return;
      onSaved({
        ...provider,
        configured: false,
        keyHint: null,
        status: null,
        addedAt: null,
        lastValidatedAt: null,
        meta: {},
      });
      toast.success(`${provider.displayName}-Key entfernt.`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Entfernen fehlgeschlagen.');
    } finally {
      if (mounted.current) setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-ai-provider-edit-dialog={provider.providerId}>
        <DialogHeader>
          <DialogTitle>{provider.displayName}</DialogTitle>
          <DialogDescription>
            {provider.configured
              ? 'API-Key ersetzen, Credits prüfen oder Key entfernen.'
              : 'API-Key hinterlegen (serverseitig geprüft und verschlüsselt).'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {provider.docsUrl ? (
            <a
              href={provider.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex text-sm text-primary underline-offset-2 hover:underline"
            >
              Dokumentation öffnen
            </a>
          ) : null}

          {provider.configured ? (
            <div className="space-y-2 rounded-lg border border-foreground/10 bg-muted/20 p-3 text-sm">
              <p className="text-muted-foreground">
                Key:{' '}
                <span className="text-foreground">{provider.keyHint ?? '••••'}</span>
              </p>
              {addedLabel ? (
                <p className="text-muted-foreground">Hinzugefügt: {addedLabel}</p>
              ) : null}
              <p className="text-muted-foreground">
                Credits:{' '}
                <span className="text-foreground">{creditsLabel ?? '—'}</span>
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 gap-1.5"
                  disabled={busy !== null}
                  onClick={() => void handleRefresh()}
                >
                  <ArrowsClockwise
                    className={`size-4 ${busy === 'refresh' ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  Credits aktualisieren
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="min-h-11 gap-1.5"
                  disabled={busy !== null}
                  onClick={() => void handleDelete()}
                >
                  {busy === 'delete' ? (
                    <CircleNotch className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash className="size-4" aria-hidden="true" />
                  )}
                  Key entfernen
                </Button>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor={`ai-key-${provider.providerId}`}>
              {provider.configured ? 'Neuen API-Key' : 'API-Key'}
            </Label>
            <Input
              id={`ai-key-${provider.providerId}`}
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder={provider.configured ? 'Neuen Key einfügen…' : 'msy_…'}
              value={draftKey}
              onChange={(event) => setDraftKey(event.target.value)}
              disabled={busy !== null}
              className="min-h-11"
            />
          </div>

          <Button
            type="button"
            className="min-h-11 w-full gap-1.5 sm:w-auto"
            disabled={busy !== null}
            onClick={() => void handleSave()}
          >
            {busy === 'save' ? (
              <CircleNotch className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FloppyDisk className="size-4" aria-hidden="true" />
            )}
            {provider.configured ? 'Ersetzen & prüfen' : 'Speichern & prüfen'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
