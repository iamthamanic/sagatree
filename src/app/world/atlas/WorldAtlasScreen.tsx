/**
 * WorldAtlasScreen — full-page Library entry for Welt → Karte (#702).
 * Location: src/app/world/atlas/WorldAtlasScreen.tsx
 */
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { API_AUTH_REQUIRED_DE } from '../../../lib/authenticatedUser';
import { Button } from '../../../shared/ui/button';
import { worldProfileService } from '../../../infrastructure/world/world-profile-service';
import { WorldAtlasWorkbench } from './WorldAtlasWorkbench';

export type WorldAtlasScreenProps = {
  readonly worldPublicId: string;
  readonly onBack: () => void;
};

export function WorldAtlasScreen({ worldPublicId, onBack }: WorldAtlasScreenProps) {
  const { hasJwtSession, ensureJwtSession, isLoading: authLoading } = useAuth();
  const [worldProfileId, setWorldProfileId] = useState<string | null>(null);
  const [worldName, setWorldName] = useState<string>('Welt');
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reconnectBusy, setReconnectBusy] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!hasJwtSession) {
      let cancelled = false;
      void (async () => {
        const ok = await ensureJwtSession();
        if (cancelled) return;
        if (!ok) {
          setLoading(false);
          setError(API_AUTH_REQUIRED_DE);
          setWorldProfileId(null);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const profile = await worldProfileService.getByPublicId(worldPublicId);
        if (cancelled) return;
        if (!profile) {
          setError('Weltprofil nicht gefunden.');
          setWorldProfileId(null);
          return;
        }
        setWorldProfileId(profile.id);
        setWorldName(profile.name || 'Welt');
        setCanEdit(true);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Welt konnte nicht geladen werden.');
        setWorldProfileId(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [worldPublicId, hasJwtSession, authLoading, ensureJwtSession]);

  if (loading || authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Weltatlas wird vorbereitet…
      </div>
    );
  }

  if (error || !worldProfileId) {
    return (
      <div className="space-y-3 p-4" role="alert">
        <p className="text-sm text-destructive">{error ?? 'Welt nicht verfügbar.'}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={reconnectBusy}
            onClick={() => {
              setReconnectBusy(true);
              void ensureJwtSession()
                .then((ok) => {
                  if (!ok) setError(API_AUTH_REQUIRED_DE);
                })
                .finally(() => setReconnectBusy(false));
            }}
          >
            API verbinden
          </Button>
          <button type="button" className="min-h-11 text-sm text-primary underline" onClick={onBack}>
            Zurück zur Bibliothek
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-0 w-full min-w-0 flex-col p-3 sm:p-4">
      <WorldAtlasWorkbench
        worldProfileId={worldProfileId}
        canEdit={canEdit}
        title={`Karte · ${worldName}`}
        onBack={onBack}
      />
    </div>
  );
}
