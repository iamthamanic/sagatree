/**
 * SagaPermissionSettings — Settings → Rechte: bundle assignment (#617).
 * Location: src/app/project/SagaPermissionSettings.tsx
 *
 * GM with saga.members.set_bundle assigns Gamemaster / Spieler bundles.
 */
import { useEffect, useState } from 'react';
import {
  CircleNotch
} from '@phosphor-icons/react';
import { useAuth } from '../../lib/auth-context';
import {
  bundleLabelDe,
  hasSagaPermission,
  type SagaBundleId,
} from '../../domains/saga/permissions';
import {
  sagaPermissionService,
  type SagaMemberPermissionStateVm,
  type SagaMyPermissionsVm,
} from '../../infrastructure/project/saga-permission-service';
import { Button } from '../../shared/ui/button';
import { Label } from '../../shared/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../shared/ui/select';

export type SagaPermissionSettingsProps = {
  sagaPublicId: string;
};

export function SagaPermissionSettings({ sagaPublicId }: SagaPermissionSettingsProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [mine, setMine] = useState<SagaMyPermissionsVm | null>(null);
  const [members, setMembers] = useState<SagaMemberPermissionStateVm[]>([]);

  const canSetBundle =
    Boolean(mine?.isGm)
    || hasSagaPermission(mine?.keys, 'saga.members.set_bundle');

  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const perms = await sagaPermissionService.getMyPermissions(sagaPublicId);
        if (cancelled) return;
        setProjectId(perms.projectId);
        setMine(perms);
        if (
          perms.isGm
          || hasSagaPermission(perms.keys, 'saga.members.read')
        ) {
          const list = await sagaPermissionService.listMemberPermissionState(sagaPublicId);
          if (!cancelled) setMembers(list);
        } else if (!cancelled) {
          setMembers([]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Rechte konnten nicht geladen werden');
          setMembers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sagaPublicId, reloadToken]);

  const onBundleChange = async (member: SagaMemberPermissionStateVm, bundleId: SagaBundleId) => {
    if (!projectId || !canSetBundle) return;
    setSavingId(member.memberId);
    setError(null);
    setStatusMessage(null);
    try {
      await sagaPermissionService.setMemberBundle({
        projectId,
        memberId: member.memberId,
        bundleId,
      });
      setStatusMessage(`Bundle „${bundleLabelDe(bundleId)}“ gespeichert.`);
      setReloadToken((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bundle konnte nicht gesetzt werden');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" data-saga-rechte-loading>
        <CircleNotch className="size-4 animate-spin" aria-hidden />
        Rechte werden geladen…
      </div>
    );
  }

  return (
    <section className="space-y-4" data-saga-rechte>
      <div>
        <h2 className="text-lg font-semibold text-foreground">Rechte</h2>
        <p className="text-sm text-muted-foreground">
          Bundles steuern, was Mitglieder in dieser Saga sehen und ändern dürfen. Geheimnisse und
          Bundle-Vergabe bleiben dem Gamemaster vorbehalten.
        </p>
      </div>

      {mine ? (
        <p className="text-sm text-muted-foreground" data-saga-rechte-self>
          Dein Bundle:{' '}
          <span className="font-medium text-foreground">
            {mine.bundleId ? bundleLabelDe(mine.bundleId) : '—'}
          </span>
          {user?.id ? ` · ${mine.keys.length} Rechte` : null}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {statusMessage ? (
        <p className="text-sm text-muted-foreground" role="status">
          {statusMessage}
        </p>
      ) : null}

      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Keine Mitglieder sichtbar oder fehlende Berechtigung zum Lesen der Mitgliederliste.
        </p>
      ) : (
        <ul className="space-y-3" data-saga-rechte-members>
          {members.map((m) => (
            <li
              key={m.memberId}
              className="flex flex-col gap-2 rounded-lg border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{m.userId}</p>
                <p className="text-xs text-muted-foreground">
                  Rolle: {m.role}
                  {m.bundleId ? ` · ${bundleLabelDe(m.bundleId)}` : ''}
                </p>
              </div>
              <div className="flex min-w-[12rem] flex-col gap-1">
                <Label htmlFor={`bundle-${m.memberId}`} className="text-xs">
                  Bundle
                </Label>
                <Select
                  value={m.bundleId ?? undefined}
                  disabled={!canSetBundle || savingId === m.memberId}
                  onValueChange={(value) => {
                    if (value === 'bundle.saga.gm' || value === 'bundle.saga.player') {
                      void onBundleChange(m, value);
                    }
                  }}
                >
                  <SelectTrigger
                    id={`bundle-${m.memberId}`}
                    className="min-h-11"
                    data-saga-rechte-bundle={m.memberId}
                  >
                    <SelectValue placeholder="Bundle wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bundle.saga.gm">Gamemaster</SelectItem>
                    <SelectItem value="bundle.saga.player">Spieler</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!canSetBundle ? (
        <p className="text-xs text-muted-foreground">
          Bundle-Vergabe ist dem Gamemaster vorbehalten.
        </p>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => setReloadToken((n) => n + 1)}
        >
          Aktualisieren
        </Button>
      )}
    </section>
  );
}
