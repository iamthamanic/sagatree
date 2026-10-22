/**
 * SessionLobbyScreen — Canonical Player/GM preflight lobby (#491, #678).
 * Location: src/app/session/SessionLobbyScreen.tsx
 *
 * Cover-stage layout (sketch Variant B): thin meta row · 16:9 cover · enter ·
 * Am Tisch seats + Meet-style device bar. Media only after user gesture.
 */
import { useState } from 'react';
import {
  Check,
  Copy
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from '../../shared/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../shared/ui/avatar';
import { AdaptivePage } from '../../shared/ui/adaptive';
import { decideLobbyEnterLive } from '../../domains/session/contracts/session-lobby';
import { buildSessionJoinPath } from '../../domains/session/contracts/session-entry-routing';
import {
  GM_DEFAULT_CHARACTER_ROLE_LABEL,
  GM_PRESENCE_DISPLAY_NAME,
  gmDefaultCharacterPortraitUrl,
} from '../../domains/character/use-cases/sagatree-native-gm-presence';
import { initialsFromDisplayName } from '../../domains/user-profile';
import { useAccountAvatar } from '../shell';
import { pathForSessionLive } from '../shell';
import { useSessionLobby } from './hooks/useSessionLobby';
import { useLobbyMediaPreview } from './hooks/useLobbyMediaPreview';
import {
  LobbyCameraPreview,
  LobbyDeviceBar,
  type LobbySeatVideoMode,
} from './LobbyDeviceBar';
import { SessionInviteShareButton } from './SessionInviteShareButton';

type SessionLobbyScreenProps = {
  sagaPublicId: string;
  sessionPublicId: string;
  onNavigateHome: () => void;
  onNavigate: (path: string) => void;
};

const EMPTY_SEAT_TARGET = 4;

/** Top-right ready/wait chip on Am Tisch seat tiles. */
function LobbySeatReadyBadge({ ready }: { ready: boolean }) {
  return (
    <span
      className={
        ready
          ? 'absolute right-2 top-2 z-10 rounded-md border border-emerald-500/45 bg-emerald-500/20 px-2.5 py-0.5 text-[0.65rem] font-semibold text-emerald-400 shadow-sm'
          : 'absolute right-2 top-2 z-10 animate-pulse rounded-md border border-amber-400/45 bg-amber-400/20 px-2.5 py-0.5 text-[0.65rem] font-semibold text-amber-300 shadow-sm'
      }
      data-lobby-ready={ready ? '1' : '0'}
    >
      {ready ? 'Bereit' : 'Nicht bereit'}
    </span>
  );
}

export function SessionLobbyScreen({
  sagaPublicId,
  sessionPublicId,
  onNavigateHome,
  onNavigate,
}: SessionLobbyScreenProps) {
  const { model, isLoading, error, setReady } = useSessionLobby({
    sagaPublicId,
    sessionPublicId,
  });
  const media = useLobbyMediaPreview({
    selfRole: model?.selfRole ?? null,
    selfCharacterId: model?.selfCharacterId ?? null,
    selfCharacterName: model?.selfCharacterName ?? null,
  });
  const { avatarUrl: accountAvatarUrl } = useAccountAvatar();

  const selfReady = model?.roster.find((m) => m.isSelf)?.isReady === true;
  const [codeCopied, setCodeCopied] = useState(false);
  const [seatVideoMode, setSeatVideoMode] = useState<LobbySeatVideoMode>('profile');

  const handleCopyCode = async () => {
    const code = model?.summary.code?.trim();
    if (!code) {
      toast.error('Kein Session-Code verfügbar');
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCodeCopied(true);
      toast.success('Code kopiert!');
    } catch {
      toast.error('Code konnte nicht kopiert werden');
    }
    window.setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleEnter = () => {
    if (!model) return;
    const decision = decideLobbyEnterLive({
      role: model.selfRole,
      sagaPublicId: model.summary.sagaPublicId,
      sessionPublicId: model.summary.sessionPublicId,
      characterPublicId: model.selfCharacterPublicId,
    });
    if (decision.kind === 'blocked') {
      return;
    }
    if (decision.kind === 'gamemaster-live') {
      onNavigate(
        pathForSessionLive(decision.sagaPublicId, decision.sessionPublicId, 'gamemaster'),
      );
      return;
    }
    onNavigate(
      pathForSessionLive(
        decision.sagaPublicId,
        decision.sessionPublicId,
        'player',
        decision.characterPublicId,
      ),
    );
  };

  const handleChangeCharacter = () => {
    onNavigate(
      buildSessionJoinPath({
        sagaPublicId,
        intent: 'join',
      }),
    );
  };

  const characterLabel =
    model?.selfRole === 'gamemaster'
      ? `${GM_PRESENCE_DISPLAY_NAME} · ${GM_DEFAULT_CHARACTER_ROLE_LABEL}`
      : (model?.selfCharacterName ?? 'Nicht zugewiesen');
  const gmPresencePortraitUrl = gmDefaultCharacterPortraitUrl();

  const emptySeatCount = model
    ? Math.max(0, EMPTY_SEAT_TARGET - model.roster.length)
    : 0;

  return (
    <AdaptivePage data-au-surface="session-lobby" className="h-full w-full">
      <div
        className="mx-auto flex h-full w-full min-w-0 max-w-3xl flex-col gap-0 overflow-y-auto p-3 sm:p-5"
        data-session-lobby="v1"
        data-session-lobby-layout="cover-stage"
      >
        {isLoading && !model ? (
          <p className="mb-2 text-sm text-muted-foreground">Lobby wird geladen…</p>
        ) : null}

        {error ? (
          <p className="mb-2 text-sm text-destructive" role="alert" data-session-lobby-error>
            {error}
          </p>
        ) : null}

        {model ? (
          <>
            {/* Meta: Titel + 16:9-Cover · Code-Box mit Aktionen (kein Overflow) */}
            <div
              className="grid min-w-0 grid-cols-1 items-stretch gap-2 pb-1 sm:grid-cols-[minmax(0,1fr)_auto]"
              data-session-lobby-cover-meta
            >
              <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card/80 px-3 py-2">
                <div className="min-w-0 flex-1">
                  {model.summary.sagaName ? (
                    <p className="truncate text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                      {model.summary.sagaName}
                    </p>
                  ) : (
                    <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                      Session-Lobby
                    </p>
                  )}
                  <h1 className="truncate text-sm font-semibold leading-tight text-foreground sm:text-base">
                    {model.summary.sessionName ?? 'Lobby'}
                  </h1>
                </div>
                <div
                  className="relative aspect-video h-12 w-auto shrink-0 overflow-hidden rounded-md border border-border bg-muted sm:h-14"
                  data-session-lobby-saga-cover-frame
                  data-session-lobby-join-hero
                >
                  {model.summary.sagaCoverUrl ? (
                    <img
                      src={model.summary.sagaCoverUrl}
                      alt={
                        model.summary.sagaName
                          ? `Saga-Cover: ${model.summary.sagaName}`
                          : 'Saga-Cover'
                      }
                      className="absolute inset-0 size-full object-cover object-center"
                      data-session-lobby-saga-cover
                    />
                  ) : (
                    <div
                      className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-card text-sm font-semibold text-muted-foreground"
                      data-session-lobby-saga-cover-fallback
                      aria-hidden
                    >
                      {(model.summary.sagaName ?? model.summary.sessionName ?? 'Saga').slice(0, 1)}
                    </div>
                  )}
                </div>
              </div>

              <section
                className="flex h-full min-w-0 items-center gap-2 self-stretch rounded-lg border border-border bg-card/80 px-2.5 py-2"
                data-session-lobby-join-code
                aria-label="Session-Code und Aktionen"
              >
                {model.summary.code ? (
                  <p
                    className="min-w-0 flex-1 truncate text-center font-mono text-sm tracking-[0.14em] text-foreground"
                    data-session-lobby-code
                    translate="no"
                  >
                    {model.summary.code}
                  </p>
                ) : (
                  <span className="sr-only">Kein Session-Code</span>
                )}
                <div className="flex shrink-0 items-center gap-1">
                  {model.summary.code ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-7 shrink-0 rounded-md"
                        onClick={() => void handleCopyCode()}
                        aria-label="Session-Code kopieren"
                        data-session-lobby-copy-code
                      >
                        {codeCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      </Button>
                      <SessionInviteShareButton
                        sessionId={model.summary.sessionId}
                        label="Link"
                        className="h-7 min-h-7 shrink-0 px-2 text-[0.65rem] font-semibold"
                      />
                    </>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 min-h-11 shrink-0 px-3 text-xs font-semibold sm:text-sm"
                    onClick={onNavigateHome}
                    data-session-lobby-leave
                  >
                    Verlassen
                  </Button>
                </div>
              </section>
            </div>

            {/* Am Tisch takes the former full-bleed cover slot */}
            <section
              className="mt-1 min-w-0 shrink-0 rounded-lg border border-border bg-card/40 p-3 sm:p-4"
              data-session-lobby-roster
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium">Am Tisch</h2>
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-primary">
                    {model.readyCount} / {Math.max(model.roster.length, EMPTY_SEAT_TARGET)}
                  </span>{' '}
                  bereit
                  {model.roster.some((m) => !m.isReady)
                    ? ` · ${model.roster.find((m) => !m.isReady)?.accountDisplayName ?? 'jemand'} fehlt`
                    : null}
                </p>
              </div>

              <ul className="mt-3 grid grid-cols-2 gap-2 @[40rem]/main:grid-cols-4">
                {model.roster.map((member) => {
                  const displayName = member.isSelf
                    ? (member.characterName ?? member.accountDisplayName)
                    : member.accountDisplayName;
                  const roleLabel =
                    member.role === 'gamemaster'
                      ? 'Gamemaster'
                      : member.isSelf
                        ? 'du'
                        : (member.characterName ?? 'Player');
                  const cameraActive =
                    member.isSelf &&
                    seatVideoMode === 'camera' &&
                    media.cameraStatus === 'granted' &&
                    media.cameraStream != null;
                  const liveActActive =
                    member.isSelf &&
                    seatVideoMode === 'liveact' &&
                    media.liveActActive &&
                    media.liveActPreview != null;
                  const profileActive =
                    member.isSelf &&
                    (seatVideoMode === 'profile' || (!cameraActive && !liveActActive));
                  const isGmSeat = member.role === 'gamemaster';
                  const selfAvatarUrl = isGmSeat
                    ? gmPresencePortraitUrl
                    : member.isSelf
                      ? accountAvatarUrl || member.avatarUrl
                      : member.avatarUrl;
                  // 4-col × 16:9 was ~90px tall — portrait tile + min-height for overlays
                  const seatShell =
                    'relative min-h-[13.5rem] aspect-[4/5] min-w-0 overflow-hidden rounded-md';

                  if (member.isSelf) {
                    return (
                      <li
                        key={member.userId}
                        className={`${seatShell} border border-primary/50 bg-muted`}
                        data-session-lobby-member="self"
                      >
                        {cameraActive ? (
                          <div className="absolute inset-0" data-session-lobby-device-preview>
                            <LobbyCameraPreview stream={media.cameraStream} />
                          </div>
                        ) : liveActActive && media.liveActPreview?.imageUrl ? (
                          <img
                            src={media.liveActPreview.imageUrl}
                            alt={media.liveActPreview.name}
                            className="absolute inset-0 h-full w-full object-cover"
                            data-session-lobby-liveact-preview
                          />
                        ) : liveActActive && media.liveActPreview ? (
                          <div
                            className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-muted px-2 pb-14 pt-12 text-center"
                            data-session-lobby-liveact-preview
                          >
                            <span className="text-2xl font-semibold text-muted-foreground">
                              {media.liveActPreview.name.slice(0, 1).toUpperCase()}
                            </span>
                            <span className="line-clamp-2 text-xs text-muted-foreground">
                              {media.liveActPreview.name}
                            </span>
                          </div>
                        ) : profileActive && selfAvatarUrl ? (
                          <img
                            src={selfAvatarUrl}
                            alt={
                              isGmSeat
                                ? `Gamemaster-Präsenz`
                                : `Profilbild von ${member.accountDisplayName}`
                            }
                            className="absolute inset-0 h-full w-full object-cover"
                            data-lobby-member-avatar
                            data-session-lobby-profile-preview
                            data-session-lobby-gm-presence={isGmSeat ? '1' : undefined}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center pb-14 pt-12">
                            <Avatar
                              className={
                                member.isReady
                                  ? 'size-14 shrink-0 rounded-md ring-2 ring-emerald-500/70 ring-offset-2 ring-offset-background'
                                  : 'size-14 shrink-0 rounded-md ring-2 ring-amber-400/60 ring-offset-2 ring-offset-background'
                              }
                              data-lobby-member-avatar
                            >
                              {selfAvatarUrl ? (
                                <AvatarImage
                                  src={selfAvatarUrl}
                                  alt={`Avatar von ${member.accountDisplayName}`}
                                />
                              ) : null}
                              <AvatarFallback
                                className="rounded-md"
                                aria-hidden={Boolean(selfAvatarUrl)}
                              >
                                {initialsFromDisplayName(member.accountDisplayName)}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                        )}

                        <div
                          className="absolute left-2 top-2 z-10 min-w-0 max-w-[calc(100%-5.5rem)] rounded-md border border-border/80 bg-background/90 px-2 py-1 text-left shadow-sm"
                          data-session-lobby-seat-identity
                        >
                          <p
                            className="truncate text-sm font-medium leading-tight"
                            data-lobby-account-name
                          >
                            {displayName}
                          </p>
                          <p className="truncate text-[0.7rem] text-muted-foreground">
                            {roleLabel}
                          </p>
                        </div>

                        <LobbySeatReadyBadge ready={member.isReady} />

                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/95 to-transparent" />

                        <div className="absolute inset-x-0 bottom-0 flex justify-center p-2">
                          <Button
                            type="button"
                            variant={selfReady ? 'secondary' : 'default'}
                            size="sm"
                            className="pointer-events-auto h-7 min-h-7 shrink-0 px-2.5 text-xs"
                            onClick={() => setReady(!selfReady)}
                            data-session-lobby-ready-toggle
                          >
                            {selfReady ? 'Nicht bereit' : 'Bereit machen'}
                          </Button>
                        </div>

                        <span className="sr-only" data-lobby-online={member.isOnline ? '1' : '0'}>
                          {member.isOnline ? 'Online' : 'Offline'}
                        </span>
                        <span className="sr-only" data-lobby-user-id title={member.userId}>
                          {member.userId}
                        </span>
                        <span className="sr-only" data-session-lobby-character>
                          Charakter: {characterLabel}
                        </span>
                      </li>
                    );
                  }

                  const peerSeatImageUrl = isGmSeat
                    ? gmPresencePortraitUrl
                    : member.avatarUrl;

                  return (
                    <li
                      key={member.userId}
                      className={`${seatShell} border border-border/60 bg-background/40`}
                      data-session-lobby-member="peer"
                    >
                      {peerSeatImageUrl ? (
                        <img
                          src={peerSeatImageUrl}
                          alt={
                            isGmSeat
                              ? `Gamemaster-Präsenz`
                              : `Profilbild von ${member.accountDisplayName}`
                          }
                          className="absolute inset-0 h-full w-full object-cover"
                          data-lobby-member-avatar
                          data-session-lobby-gm-presence={isGmSeat ? '1' : undefined}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center px-2 pt-10 pb-2">
                          <Avatar
                            className={
                              member.isReady
                                ? 'size-11 shrink-0 rounded-md ring-2 ring-emerald-500/70 ring-offset-2 ring-offset-background'
                                : 'size-11 shrink-0 rounded-md ring-2 ring-amber-400/60 ring-offset-2 ring-offset-background'
                            }
                            data-lobby-member-avatar
                          >
                            <AvatarFallback className="rounded-md">
                              {initialsFromDisplayName(member.accountDisplayName)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      )}
                      <div
                        className="absolute left-2 top-2 z-10 min-w-0 max-w-[calc(100%-5.5rem)] rounded-md border border-border/70 bg-background/90 px-2 py-1 text-left shadow-sm"
                        data-session-lobby-seat-identity
                      >
                        <p className="truncate text-sm font-medium" data-lobby-account-name>
                          {displayName}
                        </p>
                        <p className="truncate text-[0.7rem] text-muted-foreground">{roleLabel}</p>
                      </div>
                      <LobbySeatReadyBadge ready={member.isReady} />
                      <span className="sr-only" data-lobby-online={member.isOnline ? '1' : '0'}>
                        {member.isOnline ? 'Online' : 'Offline'}
                      </span>
                      <span className="sr-only" data-lobby-user-id title={member.userId}>
                        {member.userId}
                      </span>
                    </li>
                  );
                })}
                {Array.from({ length: emptySeatCount }, (_, i) => (
                  <li
                    key={`empty-${i}`}
                    className="flex min-h-[13.5rem] aspect-[4/5] min-w-0 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border/70 px-2 py-3 text-muted-foreground"
                    data-session-lobby-seat-empty
                  >
                    <span className="text-xl leading-none">+</span>
                    <span className="text-sm">Offen</span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex min-w-0 flex-col gap-2.5 border-t border-border pt-3">
                {model.canChangeCharacter ? (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={handleChangeCharacter}
                      data-session-lobby-change-character
                    >
                      Charakter ändern
                    </Button>
                  </div>
                ) : null}

                <LobbyDeviceBar
                  media={media}
                  hidePreview
                  videoMode={seatVideoMode}
                  onVideoModeChange={setSeatVideoMode}
                />
              </div>

              {model.enterDisabledReasonDe ? (
                <p className="mt-2 text-sm text-destructive" role="status">
                  {model.enterDisabledReasonDe}
                </p>
              ) : null}
            </section>

            <div className="mt-1.5 shrink-0">
              <Button
                type="button"
                className="min-h-11 w-full"
                disabled={Boolean(model.enterDisabledReasonDe)}
                onClick={handleEnter}
                data-session-lobby-enter
                data-session-lobby-enter-mid
              >
                {model.enterCtaLabelDe}
              </Button>
            </div>
          </>
        ) : (
          <section className="rounded-lg border border-border bg-card/40 p-4">
            <div className="mb-3 flex justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-11 min-h-11 shrink-0 px-3"
                onClick={onNavigateHome}
                data-session-lobby-leave
              >
                Verlassen
              </Button>
            </div>
            <LobbyDeviceBar
              media={media}
              videoMode={seatVideoMode}
              onVideoModeChange={setSeatVideoMode}
            />
          </section>
        )}
      </div>
    </AdaptivePage>
  );
}
