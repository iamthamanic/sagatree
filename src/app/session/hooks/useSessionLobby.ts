/**
 * useSessionLobby — Load membership roster + ephemeral ready broadcast (#491).
 * Location: src/app/session/hooks/useSessionLobby.ts
 *
 * Ready is preflight-only (Realtime via infrastructure channel).
 * Camera/Mic never auto-start — only after explicit gesture helpers.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../lib/auth-context';
import { projectService } from '../../../infrastructure/project/project-service';
import { sessionService } from '../../../infrastructure/session/session-service';
import { characterService } from '../../../infrastructure/character/character-service';
import { userProfileService } from '../../../infrastructure/user-profile/user-profile-service';
import {
  subscribeSessionLobbyReady,
  type SessionLobbySubscription,
} from '../../../infrastructure/session/session-lobby-channel';
import type { SessionRole } from '../../../domains/session/contracts/live-session-access';
import {
  buildLobbyPreflightViewModel,
  detectLobbyLiveActSupport,
  mergeLobbyReadyMap,
  type LobbyLiveActStatus,
  type LobbyMediaDeviceStatus,
  type LobbyPreflightViewModel,
  type LobbyRosterMember,
} from '../../../domains/session/contracts/session-lobby';
import { sagatreeNativeSagaCoverUrlFromDisplayName } from '../../../domains/saga/use-cases/sagatree-native-saga-covers';
import { resolveAccountDisplayName } from '../../../domains/user-profile';

type UseSessionLobbyInput = {
  readonly sagaPublicId: string;
  readonly sessionPublicId: string;
};

export type UseSessionLobbyResult = {
  readonly model: LobbyPreflightViewModel | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly cameraStatus: LobbyMediaDeviceStatus;
  readonly microphoneStatus: LobbyMediaDeviceStatus;
  readonly liveActStatus: LobbyLiveActStatus;
  readonly setReady: (ready: boolean) => void;
  readonly probeCamera: () => Promise<void>;
  readonly probeMicrophone: () => Promise<void>;
  readonly probeLiveAct: () => void;
  readonly refresh: () => Promise<void>;
};

function hasWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

async function probeDevice(
  kind: 'videoinput' | 'audioinput',
): Promise<LobbyMediaDeviceStatus> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return 'unavailable';
  }
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia(
      kind === 'videoinput' ? { video: true, audio: false } : { video: false, audio: true },
    );
    return 'granted';
  } catch (err) {
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'denied';
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'unavailable';
    return 'error';
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
  }
}

export function useSessionLobby(input: UseSessionLobbyInput): UseSessionLobbyResult {
  const { user } = useAuth();
  const [model, setModel] = useState<LobbyPreflightViewModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readyMap, setReadyMap] = useState<Record<string, boolean>>({});
  const [cameraStatus, setCameraStatus] = useState<LobbyMediaDeviceStatus>('idle');
  const [microphoneStatus, setMicrophoneStatus] = useState<LobbyMediaDeviceStatus>('idle');
  const [liveActStatus, setLiveActStatus] = useState<LobbyLiveActStatus>('unknown');
  const readyMapRef = useRef(readyMap);
  readyMapRef.current = readyMap;
  const subRef = useRef<SessionLobbySubscription | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const rebuild = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!user) {
        setError('Anmeldung erforderlich');
        setIsLoading(false);
        return;
      }
      if (!opts?.silent) setIsLoading(true);
      try {
        const { session, project } = await projectService.getSessionByPublicIds(
          input.sagaPublicId,
          input.sessionPublicId,
        );
        sessionIdRef.current = session.id;
        const detail = await sessionService.getSessionById(session.id);
        const selfPlayer = detail.players.find((p) => p.userId === user.id);
        const isGm = detail.gmUserId === user.id;
        // Prefer player seat when a character is bound (GM who joined as player).
        const selfRole: SessionRole = selfPlayer?.characterId
          ? 'player'
          : isGm
            ? 'gamemaster'
            : selfPlayer
              ? 'player'
              : 'viewer';

        if (selfRole === 'viewer' && !selfPlayer && !isGm) {
          setError('Keine Session-Mitgliedschaft für diese Lobby.');
          setModel(null);
          setIsLoading(false);
          return;
        }

        const characterIds = [
          ...new Set(
            detail.players
              .map((p) => p.characterId)
              .filter((id): id is string => typeof id === 'string' && id.length > 0),
          ),
        ];
        const characterMeta = new Map<
          string,
          { name: string; publicId: string | null; portraitUrl: string | null }
        >();
        try {
          const rows = await characterService.getCharacterRosterMetaByIds(characterIds);
          for (const row of rows) {
            characterMeta.set(row.id, {
              name: row.name,
              publicId: row.publicId,
              portraitUrl: row.portraitUrl,
            });
          }
        } catch (err) {
          console.error('Lobby character roster meta batch failed:', err);
        }
        for (const id of characterIds) {
          if (!characterMeta.has(id)) {
            characterMeta.set(id, { name: 'Charakter', publicId: null, portraitUrl: null });
          }
        }

        const rosterUserIds = [
          ...new Set([
            ...detail.players.map((p) => p.userId),
            ...(isGm ? [user.id] : []),
          ]),
        ];
        const accountMeta = new Map<
          string,
          { displayName: string; avatarUrl: string | null }
        >();
        try {
          const profiles = await userProfileService.getProfilesByUserIds(rosterUserIds);
          for (const row of profiles) {
            const label =
              resolveAccountDisplayName({
                profileDisplayName: row.displayName,
                email: row.id === user.id ? user.email : null,
              }) ?? 'Account';
            accountMeta.set(row.id, {
              displayName: label,
              avatarUrl: row.avatarUrl,
            });
          }
        } catch (err) {
          console.error('Lobby account profile batch failed:', err);
        }
        for (const id of rosterUserIds) {
          if (!accountMeta.has(id)) {
            const fallback =
              id === user.id
                ? resolveAccountDisplayName({
                    authDisplayName:
                      typeof user.user_metadata?.display_name === 'string'
                        ? user.user_metadata.display_name
                        : null,
                    authUsername:
                      typeof user.user_metadata?.username === 'string'
                        ? user.user_metadata.username
                        : null,
                    email: user.email ?? null,
                  }) ?? 'Account'
                : 'Account';
            accountMeta.set(id, { displayName: fallback, avatarUrl: null });
          }
        }

        const roster: LobbyRosterMember[] = detail.players.map((p) => {
          const meta = p.characterId ? characterMeta.get(p.characterId) : null;
          const account = accountMeta.get(p.userId) ?? {
            displayName: 'Account',
            avatarUrl: null,
          };
          const role: SessionRole | 'unknown' =
            p.userId === detail.gmUserId ? 'gamemaster' : 'player';
          return {
            userId: p.userId,
            accountDisplayName: account.displayName,
            avatarUrl: account.avatarUrl,
            characterId: p.characterId,
            characterName: meta?.name ?? null,
            characterPublicId: meta?.publicId ?? null,
            role,
            isOnline: p.isOnline,
            isReady: readyMapRef.current[p.userId] === true,
            isSelf: p.userId === user.id,
          };
        });

        if (isGm && !detail.players.some((p) => p.userId === user.id)) {
          const account = accountMeta.get(user.id) ?? {
            displayName: 'Account',
            avatarUrl: null,
          };
          roster.unshift({
            userId: user.id,
            accountDisplayName: account.displayName,
            avatarUrl: account.avatarUrl,
            characterId: null,
            characterName: null,
            characterPublicId: null,
            role: 'gamemaster',
            isOnline: true,
            isReady: readyMapRef.current[user.id] === true,
            isSelf: true,
          });
        }

        const selfMeta = selfPlayer?.characterId
          ? characterMeta.get(selfPlayer.characterId)
          : null;

        const sagaName = project.name ?? null;
        // Native pack cover — tolerates group-run display names ("… · Gruppe").
        const sagaCoverUrl = sagatreeNativeSagaCoverUrlFromDisplayName(sagaName ?? '');

        const next = buildLobbyPreflightViewModel({
          summary: {
            sessionId: session.id,
            sessionPublicId: input.sessionPublicId.trim().toUpperCase(),
            sagaPublicId: input.sagaPublicId.trim().toUpperCase(),
            sessionName: detail.name || session.name || 'Session',
            sagaName,
            sagaCoverUrl,
            status: detail.status,
            code: detail.code,
          },
          selfRole,
          selfUserId: user.id,
          selfCharacterId: selfPlayer?.characterId ?? null,
          selfCharacterName: selfMeta?.name ?? null,
          selfCharacterPublicId: selfMeta?.publicId ?? null,
          characterBindingFinal: Boolean(selfPlayer?.characterId),
          roster,
          cameraStatus,
          microphoneStatus,
          liveActStatus,
        });
        setModel(next);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Lobby konnte nicht geladen werden');
        setModel(null);
      } finally {
        setIsLoading(false);
      }
    },
    [
      user,
      input.sagaPublicId,
      input.sessionPublicId,
      cameraStatus,
      microphoneStatus,
      liveActStatus,
    ],
  );

  useEffect(() => {
    void rebuild();
  }, [rebuild]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void rebuild({ silent: true });
    }, 8000);
    return () => window.clearInterval(id);
  }, [rebuild]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const attach = async () => {
      if (!sessionIdRef.current) {
        try {
          const { session } = await projectService.getSessionByPublicIds(
            input.sagaPublicId,
            input.sessionPublicId,
          );
          sessionIdRef.current = session.id;
        } catch {
          return;
        }
      }
      if (cancelled || !sessionIdRef.current) return;
      try {
        const sub = await subscribeSessionLobbyReady(sessionIdRef.current, (payload) => {
          setReadyMap((prev) => mergeLobbyReadyMap(prev, payload.userId, payload.ready));
        });
        if (cancelled) {
          await sub.unsubscribe();
          return;
        }
        subRef.current = sub;
        if (readyMapRef.current[user.id] === true) {
          await sub.sendReady({ userId: user.id, ready: true });
        }
      } catch {
        // Lobby remains usable without realtime ready sync.
      }
    };
    void attach();
    return () => {
      cancelled = true;
      const sub = subRef.current;
      subRef.current = null;
      if (sub) void sub.unsubscribe();
    };
  }, [user, input.sagaPublicId, input.sessionPublicId]);

  useEffect(() => {
    void rebuild({ silent: true });
  }, [readyMap, rebuild]);

  const setReady = useCallback(
    (ready: boolean) => {
      if (!user) return;
      let previous = false;
      setReadyMap((prev) => {
        previous = prev[user.id] === true;
        return mergeLobbyReadyMap(prev, user.id, ready);
      });
      const sub = subRef.current;
      if (!sub) return;
      void sub.sendReady({ userId: user.id, ready }).catch(() => {
        // Reconcile optimistic UI when host publish fails.
        setReadyMap((prev) => mergeLobbyReadyMap(prev, user.id, previous));
      });
    },
    [user],
  );

  const probeCamera = useCallback(async () => {
    setCameraStatus('prompting');
    const next = await probeDevice('videoinput');
    setCameraStatus(next);
  }, []);

  const probeMicrophone = useCallback(async () => {
    setMicrophoneStatus('prompting');
    const next = await probeDevice('audioinput');
    setMicrophoneStatus(next);
  }, []);

  const probeLiveAct = useCallback(() => {
    const next = detectLobbyLiveActSupport({
      hasMediaDevices: typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices),
      hasWebGL: hasWebGL(),
    });
    setLiveActStatus(next);
  }, []);

  return {
    model,
    isLoading,
    error,
    cameraStatus,
    microphoneStatus,
    liveActStatus,
    setReady,
    probeCamera,
    probeMicrophone,
    probeLiveAct,
    refresh: () => rebuild(),
  };
}
