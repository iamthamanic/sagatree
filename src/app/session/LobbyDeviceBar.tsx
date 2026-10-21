/**
 * LobbyDeviceBar — Meet-style Cam/Live + Microphone controls in the Am Tisch character row.
 * Location: src/app/session/LobbyDeviceBar.tsx
 *
 * Camera/mic only after gesture via useLobbyMediaPreview. Compact preview when active.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import {
  Camera,
  CaretDown,
  Microphone,
  MicrophoneSlash,
  UserCircle,
  VideoCameraSlash
} from '@phosphor-icons/react';
import { cn } from '../../shared/ui/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../../shared/ui/dropdown-menu';
import {
  lobbyLiveActStatusLabelDe,
  lobbyMediaDeviceLabel,
  lobbyMediaStatusLabelDe,
} from '../../domains/session/contracts/session-lobby';
import type { UseLobbyMediaPreviewResult } from './hooks/useLobbyMediaPreview';

/** Seat tile source: camera stream, LiveAct preview, or account profile image. */
export type LobbySeatVideoMode = 'camera' | 'liveact' | 'profile';

type LobbyDeviceBarProps = {
  readonly media: UseLobbyMediaPreviewResult;
  /** When true, preview lives in the Am Tisch self-seat tile instead. */
  readonly hidePreview?: boolean;
  readonly videoMode: LobbySeatVideoMode;
  readonly onVideoModeChange: (mode: LobbySeatVideoMode) => void;
};

/** Local camera feed for seat tile / device bar preview. */
export function LobbyCameraPreview({ stream }: { stream: MediaStream | null }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = stream;
    if (stream) {
      void el.play().catch(() => undefined);
    }
    return () => {
      el.srcObject = null;
    };
  }, [stream]);
  return (
    <video
      ref={videoRef}
      className="h-full w-full object-cover"
      playsInline
      muted
      autoPlay
      data-session-lobby-camera-preview
    />
  );
}

function DeviceSplit({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex shrink-0 items-stretch overflow-hidden rounded-md border border-border bg-background/40',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function LobbyDeviceBar({
  media,
  hidePreview = false,
  videoMode,
  onVideoModeChange,
}: LobbyDeviceBarProps) {
  const cameraActive = media.cameraStatus === 'granted' && media.cameraStream != null;
  const micActive = media.microphoneStatus === 'granted';
  const levelPct = Math.round(media.microphoneLevel * 100);
  const setMode = (next: LobbySeatVideoMode) => {
    if (next === videoMode) return;
    if (next === 'camera') {
      media.stopLiveAct();
    } else if (next === 'liveact') {
      media.stopCamera();
    } else {
      media.stopCamera();
      media.stopLiveAct();
    }
    onVideoModeChange(next);
  };

  const toggleCameraOrLive = () => {
    if (videoMode === 'profile') return;
    if (videoMode === 'camera') {
      if (cameraActive) {
        media.stopCamera();
      } else {
        void media.startCamera();
      }
      return;
    }
    if (media.liveActActive) {
      media.stopLiveAct();
    } else {
      void media.startLiveAct();
    }
  };

  const toggleMic = () => {
    if (micActive) {
      media.stopMicrophone();
    } else {
      void media.startMicrophone();
    }
  };

  const showPreview =
    (videoMode === 'camera' && cameraActive) ||
    (videoMode === 'liveact' && media.liveActActive && media.liveActPreview != null);

  // Idle = not started yet (slash icons were misleading). Slash only after deny / stop-while-known.
  const cameraFailed =
    media.cameraStatus === 'denied' ||
    media.cameraStatus === 'unavailable' ||
    media.cameraStatus === 'error';
  const micFailed =
    media.microphoneStatus === 'denied' ||
    media.microphoneStatus === 'unavailable' ||
    media.microphoneStatus === 'error';
  const cameraIconOff = cameraFailed;
  const micIconOff = micFailed;

  const idleHint =
    videoMode !== 'profile' &&
    media.cameraStatus === 'idle' &&
    media.microphoneStatus === 'idle'
      ? 'Cam oder Microphone tippen — der Browser fragt dann nach Kamera- und Mikrofon-Zugriff. Ohne Klick gibt es keine Geräte-Liste.'
      : null;
  const cameraHint =
    videoMode === 'camera' && cameraFailed
      ? lobbyMediaStatusLabelDe(media.cameraStatus)
      : media.cameraStatus === 'prompting'
        ? lobbyMediaStatusLabelDe('prompting')
        : null;
  const liveActHint =
    videoMode === 'liveact' && (media.liveActHintDe || media.liveActStatus === 'unsupported')
      ? (media.liveActHintDe ?? lobbyLiveActStatusLabelDe(media.liveActStatus))
      : null;
  const micHint = micFailed
    ? lobbyMediaStatusLabelDe(media.microphoneStatus)
    : media.microphoneStatus === 'prompting'
      ? lobbyMediaStatusLabelDe('prompting')
      : null;

  const openCameraMenu = (open: boolean) => {
    if (!open) return;
    void media.refreshDevices();
    if (media.cameraDevices.length === 0 && media.cameraStatus === 'idle') {
      void media.startCamera();
    }
  };
  const openMicMenu = (open: boolean) => {
    if (!open) return;
    void media.refreshDevices();
    if (media.microphoneDevices.length === 0 && media.microphoneStatus === 'idle') {
      void media.startMicrophone();
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-2" data-session-lobby-media>
      {!hidePreview && showPreview ? (
        <div
          className="aspect-video w-full max-w-xs overflow-hidden rounded-md border border-border bg-muted sm:max-w-sm"
          data-session-lobby-device-preview
        >
          {videoMode === 'camera' && cameraActive ? (
            <LobbyCameraPreview stream={media.cameraStream} />
          ) : media.liveActPreview?.imageUrl ? (
            <img
              src={media.liveActPreview.imageUrl}
              alt={media.liveActPreview.name}
              className="h-full w-full object-cover"
              data-session-lobby-liveact-preview
            />
          ) : media.liveActPreview ? (
            <div
              className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center"
              data-session-lobby-liveact-preview
            >
              <span className="text-2xl font-semibold text-muted-foreground">
                {media.liveActPreview.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="line-clamp-2 text-xs text-muted-foreground">
                {media.liveActPreview.name}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
      {hidePreview || !showPreview ? (
        <>
          {/* Idle markers stay attached for e2e probes regardless of Cam/Live/Profil mode. */}
          {!cameraActive ? (
            <div className="sr-only" data-session-lobby-camera-idle>
              Noch kein Kamerabild
            </div>
          ) : null}
          {videoMode === 'liveact' ? (
            <div className="sr-only" data-session-lobby-liveact-idle>
              Noch keine Vorschau
            </div>
          ) : null}
          {videoMode === 'profile' ? (
            <div className="sr-only" data-session-lobby-profile-idle>
              Profilbild
            </div>
          ) : null}
        </>
      ) : null}

      <div
        className="flex min-w-0 flex-wrap items-center gap-2"
        role="group"
        aria-label="Kamera, LiveAct, Profil und Mikrofon"
        data-session-lobby-device-bar
      >
        <div
          className="inline-flex shrink-0 overflow-hidden rounded-md border border-border bg-background/50"
          role="group"
          aria-label="Kamera, LiveAct oder Profil"
        >
          <button
            type="button"
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 px-2.5 text-xs font-semibold',
              videoMode === 'camera'
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-pressed={videoMode === 'camera'}
            onClick={() => setMode('camera')}
            data-session-lobby-mode-camera
            data-session-lobby-probe-camera
          >
            <Camera className="size-3.5 shrink-0" aria-hidden />
            Cam
          </button>
          <button
            type="button"
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 border-l border-border px-2.5 text-xs font-semibold',
              videoMode === 'liveact'
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-pressed={videoMode === 'liveact'}
            onClick={() => {
              setMode('liveact');
              void media.startLiveAct();
            }}
            data-session-lobby-mode-liveact
            data-session-lobby-probe-liveact
          >
            <UserCircle className="size-3.5 shrink-0" aria-hidden />
            Live
          </button>
          <button
            type="button"
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 border-l border-border px-2.5 text-xs font-semibold',
              videoMode === 'profile'
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-pressed={videoMode === 'profile'}
            onClick={() => setMode('profile')}
            data-session-lobby-mode-profile
          >
            Profil
          </button>
        </div>

        {videoMode !== 'profile' ? (
          <DeviceSplit>
            <button
              type="button"
              className={cn(
                'inline-flex size-11 items-center justify-center',
                videoMode === 'camera' && cameraActive && 'bg-primary/15 text-primary',
                videoMode === 'liveact' && media.liveActActive && 'bg-primary/15 text-primary',
                videoMode === 'camera' && cameraFailed && 'text-destructive',
              )}
              aria-pressed={videoMode === 'camera' ? cameraActive : media.liveActActive}
              aria-label={
                videoMode === 'camera'
                  ? cameraActive
                    ? 'Kamera stoppen'
                    : 'Kamera starten'
                  : media.liveActActive
                    ? 'LiveAct stoppen'
                    : 'LiveAct prüfen'
              }
              disabled={videoMode === 'camera' && media.cameraStatus === 'prompting'}
              onClick={toggleCameraOrLive}
              data-session-lobby-stop-camera={
                videoMode === 'camera' && cameraActive ? true : undefined
              }
              data-session-lobby-stop-liveact={
                videoMode === 'liveact' && media.liveActActive ? true : undefined
              }
              data-lobby-camera-status={videoMode === 'camera' ? media.cameraStatus : undefined}
              data-lobby-liveact-status={
                videoMode === 'liveact' ? media.liveActStatus : undefined
              }
            >
              {videoMode === 'camera' ? (
                cameraIconOff ? (
                  <VideoCameraSlash className="size-4" aria-hidden />
                ) : (
                  <Camera className="size-4" aria-hidden />
                )
              ) : (
                <UserCircle className="size-4" aria-hidden />
              )}
            </button>
            <DropdownMenu onOpenChange={openCameraMenu}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-11 w-6 items-center justify-center border-l border-border text-muted-foreground hover:text-foreground"
                  aria-label={
                    videoMode === 'camera' ? 'Kamera wählen' : 'LiveAct-Quelle wählen'
                  }
                  data-session-lobby-camera-select={videoMode === 'camera' ? true : undefined}
                  data-session-lobby-liveact-select={
                    videoMode === 'liveact' ? true : undefined
                  }
                >
                  <CaretDown className="size-3.5" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[12rem]">
                {videoMode === 'camera' ? (
                  <>
                    <DropdownMenuLabel>Kamera</DropdownMenuLabel>
                    {media.cameraDevices.length === 0 ? (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground">
                        {media.cameraStatus === 'prompting'
                          ? 'Berechtigung wird angefragt…'
                          : cameraFailed
                            ? lobbyMediaStatusLabelDe(media.cameraStatus)
                            : 'Noch keine Geräte — erlaube den Kamerazugriff im Browser-Dialog.'}
                      </p>
                    ) : (
                      <DropdownMenuRadioGroup
                        value={media.selectedCameraId ?? undefined}
                        onValueChange={(id) => void media.selectCamera(id)}
                      >
                        {media.cameraDevices.map((d, i) => (
                          <DropdownMenuRadioItem key={d.deviceId} value={d.deviceId}>
                            {lobbyMediaDeviceLabel(d, i)}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    )}
                  </>
                ) : (
                  <>
                    <DropdownMenuLabel>LiveAct</DropdownMenuLabel>
                    {media.liveActOptions.length === 0 ? (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground">
                        {media.liveActHintDe ??
                          'Zuerst Live tippen, um Quellen zu laden.'}
                      </p>
                    ) : (
                      <DropdownMenuRadioGroup
                        value={media.selectedLiveActOptionId ?? undefined}
                        onValueChange={media.selectLiveActOption}
                      >
                        {media.liveActOptions.map((o) => (
                          <DropdownMenuRadioItem key={o.id} value={o.id}>
                            {o.name}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </DeviceSplit>
        ) : null}

        <DeviceSplit>
          <button
            type="button"
            className={cn(
              'inline-flex size-11 items-center justify-center',
              micActive && 'bg-primary/15 text-primary',
              micFailed && 'text-destructive',
            )}
            aria-pressed={micActive}
            aria-label={micActive ? 'Mikrofon stoppen' : 'Mikrofon starten'}
            disabled={media.microphoneStatus === 'prompting'}
            onClick={toggleMic}
            data-session-lobby-probe-mic
            data-session-lobby-stop-mic={micActive ? true : undefined}
            data-lobby-mic-status={media.microphoneStatus}
          >
            {micIconOff ? (
              <MicrophoneSlash className="size-4" aria-hidden />
            ) : (
              <Microphone className="size-4" aria-hidden />
            )}
          </button>
          <DropdownMenu onOpenChange={openMicMenu}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-11 w-6 items-center justify-center border-l border-border text-muted-foreground hover:text-foreground"
                aria-label="Mikrofon wählen"
                data-session-lobby-mic-select
              >
                <CaretDown className="size-3.5" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[12rem]">
              <DropdownMenuLabel>Mikrofon</DropdownMenuLabel>
              {media.microphoneDevices.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  {media.microphoneStatus === 'prompting'
                    ? 'Berechtigung wird angefragt…'
                    : micFailed
                      ? lobbyMediaStatusLabelDe(media.microphoneStatus)
                      : 'Noch keine Geräte — erlaube den Mikrofonzugriff im Browser-Dialog.'}
                </p>
              ) : (
                <DropdownMenuRadioGroup
                  value={media.selectedMicrophoneId ?? undefined}
                  onValueChange={(id) => void media.selectMicrophone(id)}
                >
                  {media.microphoneDevices.map((d, i) => (
                    <DropdownMenuRadioItem key={d.deviceId} value={d.deviceId}>
                      {lobbyMediaDeviceLabel(d, i)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </DeviceSplit>

        <div
          className="flex h-11 min-w-[4.5rem] max-w-[7.5rem] flex-1 items-end gap-0.5 rounded-md border border-border bg-muted px-1.5 py-1.5"
          data-session-lobby-mic-meter
          role="meter"
          aria-label={`Mikrofonpegel ${levelPct} Prozent`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={levelPct}
        >
          {Array.from({ length: 12 }, (_, i) => {
            const threshold = (i + 1) / 12;
            const on = micActive && media.microphoneLevel >= threshold * 0.85;
            return (
              <div
                key={i}
                className={cn(
                  'min-w-0 flex-1 rounded-sm transition-colors',
                  on ? 'bg-primary' : 'bg-border',
                )}
                style={{ height: `${14 + i * 7}%` }}
              />
            );
          })}
        </div>
      </div>

      {idleHint ? (
        <p className="text-xs text-muted-foreground" role="status" data-session-lobby-media-idle-hint>
          {idleHint}
        </p>
      ) : null}
      {cameraHint ? (
        <p className="text-xs text-muted-foreground" role="status">
          {cameraHint}
        </p>
      ) : null}
      {liveActHint ? (
        <p className="text-xs text-muted-foreground" role="status">
          {liveActHint}
        </p>
      ) : null}
      {micHint ? (
        <p className="text-xs text-muted-foreground" role="status">
          {micHint}
        </p>
      ) : null}
    </div>
  );
}
