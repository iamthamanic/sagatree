/**
 * SessionInviteShareButton — Copy absolute invite URL for a session (#490).
 * Location: src/app/session/SessionInviteShareButton.tsx
 */
import { useState } from 'react';
import {
  Check,
  Link
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from '../../shared/ui/button';
import { buildSessionInviteAbsoluteUrl } from '../../domains/session/contracts/session-invite';
import { sessionService } from '../../infrastructure/session/session-service';

type SessionInviteShareButtonProps = {
  sessionId: string;
  className?: string;
  label?: string;
};

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export function SessionInviteShareButton({
  sessionId,
  className,
  label = 'Einladung kopieren',
}: SessionInviteShareButtonProps) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!sessionId.trim()) {
      toast.error('Session fehlt');
      return;
    }
    setBusy(true);
    try {
      const invite = await sessionService.createSessionInvite(sessionId);
      const origin =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : '';
      if (!origin) {
        throw new Error('Origin nicht verfügbar');
      }
      const url = buildSessionInviteAbsoluteUrl(invite.token, origin);
      await copyText(url);
      setCopied(true);
      toast.success('Einladungslink kopiert', {
        description: 'Spieler öffnen den Link und landen im Session-Beitritt.',
      });
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kopieren fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className={className ?? 'min-h-11 w-full'}
      disabled={busy}
      onClick={() => void handleCopy()}
      data-session-invite-copy
    >
      {copied ? <Check className="mr-2 size-4" /> : <Link className="mr-2 size-4" />}
      {busy ? 'Erzeuge Link…' : label}
    </Button>
  );
}
