/**
 * SessionInviteResolve — Auth-gated invite deep-link resolve (#490).
 * Location: src/app/session/SessionInviteResolve.tsx
 *
 * Resolves opaque token → canonical session-join or live rejoin; strips invite from URL.
 */
import { useEffect, useState } from 'react';
import {
  CircleNotch
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { AdaptivePage } from '../../shared/ui/adaptive';
import { Button } from '../../shared/ui/button';
import { pathForSessionLive } from '../shell';
import { buildSessionJoinPath } from '../../domains/session/contracts/session-entry-routing';
import {
  decideInvitePostResolveNavigation,
  inviteErrorMessage,
  readInviteTokenFromSearch,
  type SessionInviteErrorCode,
} from '../../domains/session/contracts/session-invite';
import { sessionService } from '../../infrastructure/session/session-service';

type SessionInviteResolveProps = {
  onNavigate: (view: string) => void;
  onNavigateHome: () => void;
};

export function SessionInviteResolve({
  onNavigate,
  onNavigateHome,
}: SessionInviteResolveProps) {
  const [errorCode, setErrorCode] = useState<SessionInviteErrorCode | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const search =
        typeof window !== 'undefined' ? window.location.search : '';
      const token = readInviteTokenFromSearch(search);
      if (!token) {
        if (!cancelled) {
          setErrorCode('missing_token');
          setBusy(false);
        }
        return;
      }
      try {
        const result = await sessionService.resolveSessionInvite(token);
        if (cancelled) return;
        if (result.ok === false) {
          setErrorCode(result.errorCode);
          setBusy(false);
          toast.error(inviteErrorMessage(result.errorCode));
          return;
        }
        const next = decideInvitePostResolveNavigation(result);
        if (next.kind === 'live') {
          onNavigate(
            pathForSessionLive(
              result.sagaPublicId,
              result.sessionPublicId,
              next.liveView,
              next.characterPublicId,
            ),
          );
          return;
        }
        onNavigate(
          buildSessionJoinPath({
            sagaPublicId: result.sagaPublicId,
            projectId: result.projectId,
            intent: 'join',
          }),
        );
      } catch (err) {
        if (!cancelled) {
          setErrorCode('unknown');
          setBusy(false);
          toast.error(err instanceof Error ? err.message : inviteErrorMessage('unknown'));
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [onNavigate]);

  return (
    <AdaptivePage data-au-surface="session-invite" className="h-full w-full">
      <div
        className="mx-auto flex max-w-lg flex-col items-center gap-4 p-6 text-center"
        data-session-invite-resolve
      >
        {busy ? (
          <>
            <CircleNotch className="size-8 animate-spin text-muted-foreground" aria-label="Lädt" />
            <p className="text-sm text-muted-foreground">Einladung wird geprüft…</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Einladung</h1>
            <p className="text-sm text-destructive" role="alert">
              {inviteErrorMessage(errorCode ?? 'unknown')}
            </p>
            <Button
              type="button"
              className="min-h-11"
              onClick={onNavigateHome}
              data-session-invite-back
            >
              Zum Dashboard
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() => onNavigate('/session-join?intent=join')}
            >
              Mit Code beitreten
            </Button>
          </>
        )}
      </div>
    </AdaptivePage>
  );
}
