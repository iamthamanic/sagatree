/**
 * session-lobby — Preflight Lobby contract between join and live (#491).
 * Location: src/domains/session/contracts/session-lobby.ts
 *
 * Pure domain: roster/ready/media opt-in descriptors. No React/backend clients.
 * Ready is preflight signal only — never gameplay authorization.
 */

import type { SessionRole } from './live-session-access';

export type LobbyMediaDeviceKind = 'camera' | 'microphone';

export type LobbyMediaDeviceStatus =
  | 'idle'
  | 'prompting'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'error';

export type LobbyLiveActStatus =
  | 'unknown'
  | 'unsupported'
  | 'available'
  | 'degraded';

export type LobbyRosterMember = {
  readonly userId: string;
  /** Account display name (primary identity in roster). */
  readonly accountDisplayName: string;
  /** Signed avatar URL when available; null → initials fallback. */
  readonly avatarUrl: string | null;
  readonly characterId: string | null;
  readonly characterName: string | null;
  readonly characterPublicId: string | null;
  readonly role: SessionRole | 'unknown';
  readonly isOnline: boolean;
  readonly isReady: boolean;
  readonly isSelf: boolean;
};

export type LobbySessionSummary = {
  readonly sessionId: string;
  readonly sessionPublicId: string;
  readonly sagaPublicId: string;
  readonly sessionName: string;
  readonly sagaName: string | null;
  /** Public cover asset URL when resolvable (native pack); null → UI fallback. */
  readonly sagaCoverUrl: string | null;
  readonly status: string;
  readonly code: string;
};

export type LobbyPreflightViewModel = {
  readonly summary: LobbySessionSummary;
  readonly selfRole: SessionRole;
  readonly selfCharacterId: string | null;
  readonly selfCharacterName: string | null;
  readonly selfCharacterPublicId: string | null;
  readonly canChangeCharacter: boolean;
  readonly roster: readonly LobbyRosterMember[];
  readonly readyCount: number;
  readonly onlineCount: number;
  readonly cameraStatus: LobbyMediaDeviceStatus;
  readonly microphoneStatus: LobbyMediaDeviceStatus;
  readonly liveActStatus: LobbyLiveActStatus;
  readonly mediaBlocksEnter: false;
  readonly enterCtaLabelDe: string;
  readonly enterDisabledReasonDe: string | null;
};

export type LobbyEnterDecision =
  | {
      readonly kind: 'player-live';
      readonly sagaPublicId: string;
      readonly sessionPublicId: string;
      readonly characterPublicId: string;
    }
  | {
      readonly kind: 'gamemaster-live';
      readonly sagaPublicId: string;
      readonly sessionPublicId: string;
    }
  | {
      readonly kind: 'blocked';
      readonly reasonDe: string;
    };

const MEDIA_STATUS_LABEL_DE: Record<LobbyMediaDeviceStatus, string> = {
  idle: 'Noch nicht geprüft',
  prompting: 'Berechtigung wird angefragt…',
  granted: 'Bereit',
  denied: 'Berechtigung verweigert',
  unavailable: 'Gerät nicht verfügbar',
  error: 'Prüfung fehlgeschlagen',
};

const LIVEACT_STATUS_LABEL_DE: Record<LobbyLiveActStatus, string> = {
  unknown: 'Status unbekannt',
  unsupported: 'LiveAct auf diesem Gerät nicht verfügbar',
  available: 'LiveAct verfügbar (nicht gestartet)',
  degraded: 'LiveAct eingeschränkt',
};

export function lobbyMediaStatusLabelDe(status: LobbyMediaDeviceStatus): string {
  return MEDIA_STATUS_LABEL_DE[status];
}

export function lobbyLiveActStatusLabelDe(status: LobbyLiveActStatus): string {
  return LIVEACT_STATUS_LABEL_DE[status];
}

/**
 * Media failure never blocks entering the authorized live route.
 */
export function mediaFailureBlocksSessionEnter(
  _camera: LobbyMediaDeviceStatus,
  _microphone: LobbyMediaDeviceStatus,
  _liveAct: LobbyLiveActStatus,
): false {
  return false;
}

export function buildLobbyEnterCtaLabel(role: SessionRole): string {
  if (role === 'gamemaster') return 'Session starten';
  if (role === 'player') return 'Session betreten';
  return 'Live öffnen';
}

export function buildLobbyPreflightViewModel(input: {
  readonly summary: LobbySessionSummary;
  readonly selfRole: SessionRole;
  readonly selfUserId: string;
  readonly selfCharacterId: string | null;
  readonly selfCharacterName: string | null;
  readonly selfCharacterPublicId: string | null;
  /** Membership character not yet final → allow change path back to join. */
  readonly characterBindingFinal: boolean;
  readonly roster: readonly LobbyRosterMember[];
  readonly cameraStatus: LobbyMediaDeviceStatus;
  readonly microphoneStatus: LobbyMediaDeviceStatus;
  readonly liveActStatus: LobbyLiveActStatus;
}): LobbyPreflightViewModel {
  const onlineCount = input.roster.filter((m) => m.isOnline).length;
  const readyCount = input.roster.filter((m) => m.isReady).length;
  const enterCtaLabelDe = buildLobbyEnterCtaLabel(input.selfRole);
  let enterDisabledReasonDe: string | null = null;
  if (input.selfRole === 'player' && !input.selfCharacterPublicId) {
    enterDisabledReasonDe =
      'Kein Charakter gebunden. Bitte Charakter zuweisen oder erstellen.';
  }
  return {
    summary: input.summary,
    selfRole: input.selfRole,
    selfCharacterId: input.selfCharacterId,
    selfCharacterName: input.selfCharacterName,
    selfCharacterPublicId: input.selfCharacterPublicId,
    canChangeCharacter:
      input.selfRole === 'player' &&
      (!input.characterBindingFinal || !input.selfCharacterId),
    roster: input.roster,
    readyCount,
    onlineCount,
    cameraStatus: input.cameraStatus,
    microphoneStatus: input.microphoneStatus,
    liveActStatus: input.liveActStatus,
    mediaBlocksEnter: mediaFailureBlocksSessionEnter(
      input.cameraStatus,
      input.microphoneStatus,
      input.liveActStatus,
    ),
    enterCtaLabelDe,
    enterDisabledReasonDe,
  };
}

/**
 * Decide live entry from lobby CTA. Role from membership — never from URL.
 * GM may start even if players are not ready (explicit acceptance edge case).
 */
export function decideLobbyEnterLive(input: {
  readonly role: SessionRole;
  readonly sagaPublicId: string;
  readonly sessionPublicId: string;
  readonly characterPublicId: string | null;
}): LobbyEnterDecision {
  const saga = input.sagaPublicId.trim().toUpperCase();
  const session = input.sessionPublicId.trim().toUpperCase();
  if (!saga || !session) {
    return {
      kind: 'blocked',
      reasonDe: 'Saga- oder Session-Public-ID fehlt.',
    };
  }
  if (input.role === 'gamemaster') {
    return { kind: 'gamemaster-live', sagaPublicId: saga, sessionPublicId: session };
  }
  if (input.role === 'player') {
    const characterPublicId = input.characterPublicId?.trim().toUpperCase() ?? '';
    if (!characterPublicId) {
      return {
        kind: 'blocked',
        reasonDe: 'Kein Charakter für den Player-Live-Einstieg gebunden.',
      };
    }
    return {
      kind: 'player-live',
      sagaPublicId: saga,
      sessionPublicId: session,
      characterPublicId,
    };
  }
  return {
    kind: 'blocked',
    reasonDe: 'Viewer öffnen die Lobby nicht als Spielstart.',
  };
}

/**
 * After SessionJoin create/join — land in lobby, not live.
 */
export function resolveCanonicalLobbyEntry(input: {
  readonly role: SessionRole | null;
  readonly sagaPublicId: string | null;
  readonly sessionPublicId: string | null;
}):
  | {
      readonly kind: 'lobby';
      readonly sagaPublicId: string;
      readonly sessionPublicId: string;
    }
  | { readonly kind: 'unauthorized'; readonly reason: string } {
  const sagaPublicId = input.sagaPublicId?.trim().toUpperCase() ?? '';
  const sessionPublicId = input.sessionPublicId?.trim().toUpperCase() ?? '';
  if (!sagaPublicId || !sessionPublicId) {
    return {
      kind: 'unauthorized',
      reason: 'Saga- und Session-Public-ID sind für die Lobby erforderlich',
    };
  }
  if (
    input.role !== 'gamemaster' &&
    input.role !== 'player' &&
    input.role !== 'viewer'
  ) {
    return { kind: 'unauthorized', reason: 'Keine autorisierte Session-Rolle' };
  }
  return { kind: 'lobby', sagaPublicId, sessionPublicId };
}

export function pathForSessionLobby(
  sagaPublicId: string,
  sessionPublicId: string,
): string {
  const saga = encodeURIComponent(sagaPublicId.trim().toUpperCase());
  const session = encodeURIComponent(sessionPublicId.trim().toUpperCase());
  return `/sagas/${saga}/sessions/${session}/lobby`;
}

export function mergeLobbyReadyMap(
  current: Readonly<Record<string, boolean>>,
  userId: string,
  ready: boolean,
): Record<string, boolean> {
  return { ...current, [userId]: ready === true };
}

export function detectLobbyLiveActSupport(input: {
  readonly hasMediaDevices: boolean;
  readonly hasWebGL: boolean;
}): LobbyLiveActStatus {
  if (!input.hasMediaDevices) return 'unsupported';
  if (!input.hasWebGL) return 'degraded';
  return 'available';
}

/** Browser media device descriptor for lobby preview (#678) — no stream handles. */
export type LobbyMediaDeviceDescriptor = {
  readonly deviceId: string;
  readonly label: string;
  readonly kind: 'videoinput' | 'audioinput';
};

/** Local-only preferred device ids — never streams/tracks. */
export type LobbyMediaDevicePrefs = {
  readonly cameraDeviceId: string | null;
  readonly microphoneDeviceId: string | null;
};

export const LOBBY_MEDIA_PREFS_STORAGE_KEY = 'sagatree.lobby-media-prefs.v1';

export function parseLobbyMediaDevicePrefs(raw: unknown): LobbyMediaDevicePrefs {
  if (!raw || typeof raw !== 'object') {
    return { cameraDeviceId: null, microphoneDeviceId: null };
  }
  const record = raw as Record<string, unknown>;
  const camera =
    typeof record.cameraDeviceId === 'string' && record.cameraDeviceId.length > 0
      ? record.cameraDeviceId
      : null;
  const microphone =
    typeof record.microphoneDeviceId === 'string' && record.microphoneDeviceId.length > 0
      ? record.microphoneDeviceId
      : null;
  return { cameraDeviceId: camera, microphoneDeviceId: microphone };
}

export function lobbyMediaDeviceLabel(
  device: LobbyMediaDeviceDescriptor,
  index: number,
): string {
  const trimmed = device.label.trim();
  if (trimmed.length > 0) return trimmed;
  if (device.kind === 'videoinput') return `Kamera ${index + 1}`;
  return `Mikrofon ${index + 1}`;
}

/** GM LiveAct preview option — id must come from an authorized catalog, never client-claimed. */
export type LobbyLiveActPreviewOption = {
  readonly id: string;
  readonly name: string;
  readonly imageUrl: string | null;
  readonly kind: 'character' | 'npc';
};
