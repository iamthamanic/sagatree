# Infrastructure contract: session

**Status: SPEC; current branch source verified.** Implementation issue: **#810**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-session.json](source-contracts/infra-session.json) (SHA-256 `478ae17bd801fdccf66a043e07ded7b536341ba63660021a6f3e30b360fec9aa`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Facade behavior and authorization boundary

Lifecycle/invites/recap/runtime use12 RPCs and2 Edge calls. Runtime loads authoritative snapshot before subscribing to sessions*,session_players* and session_events INSERT; each event refetches snapshot, resync is explicit. Lobby session-lobby:{id} uses ephemeral broadcast event ready with caller userId and boolean; it does not use postgres_changes. Media token adapter normalizes degraded errors. LiveKitRoomFactory is injected; absent factory fails closed, default presence lists local identity only, publishData uses unreliable transport.

RPC/Edge derive session authority server-side. Runtime snapshot call precedes subscription; lobby ready has no membership check in this adapter and supplied userId is untrusted UI state, never gameplay authorization. Viewer publish gates and identity checks belong to media-plane domain/valid token, not arbitrary broadcast claims.

The adapter establishes request/filter behavior. Server permission and rollback guarantees require the linked effective SQL/RLS contracts and backend fixtures; a source-only adapter review does not prove a live RLS policy.

## Complete backend inventory

RPCs (0): none.

Tables (0): none.

Storage buckets (0): none.

Edge invokes (0): none.

Realtime call sites: 0. Direct fetch sites: 0. Explicit auth/helper sites: 1.

## Complete implementation dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| auth | `authenticated account/session transport` | #793 |  |

## Acceptance and negative tests (required, not executed)

- All12 exact RPC variants and2 Edge invokes preserve argument/error/decoder contracts; wrong user/GM/foreign session cannot mutate runtime.
- Runtime event subscriptions use exact table/event/session filters and removeChannel on unsubscribe; explicit resync reloads authoritative state. Snapshot-before-subscribe gap and overlapping fetch ordering require an explicit successor consistency fixture.
- Lobby ready is ephemeral broadcast with exacttopic/event/payload; spoofed ready userId cannot authorize gameplay.
- Media missing factory/token/server becomes degraded without blocking gameplay; viewer publication denied by media-plane access; local-only presence and reliable:false data behavior remain explicit.

## Observed source defects and explicit successor decisions

- Lobby broadcasts accept caller userId without identity binding; ready must remain non-authoritative.
- Runtime has a snapshot/subscription gap and overlapping refreshes have no explicit revision ordering or catch; initial code does not guarantee automatic gap-free reconnect.
- LiveKit adapter requires injected roomFactory, reports only local participant presence and optional SDK methods can be absent; token issuance alone is not live media verification.

## All backend calls, arguments, filters and result handling

### auth-helper: session identity

`src/infrastructure/session/live-session-access.resolver.ts:34` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/session/live-session-access.resolver.ts:31`; complete request/default/result/error logic is in the declarations below and the snapshot.
### provider-sdk: input.url

`src/infrastructure/session/media/livekit-media-plane-adapter.ts:67` — dynamic-expression.

Exact call/query chain:
```ts
this.room.connect(input.url, input.token)
```

Enclosing operation: `src/infrastructure/session/media/livekit-media-plane-adapter.ts:51`; complete request/default/result/error logic is in the declarations below and the snapshot.
### provider-sdk: session identity

`src/infrastructure/session/media/livekit-media-plane-adapter.ts:80` — dynamic-expression.

Exact call/query chain:
```ts
this.room?.disconnect()
```

Enclosing operation: `src/infrastructure/session/media/livekit-media-plane-adapter.ts:77`; complete request/default/result/error logic is in the declarations below and the snapshot.
### provider-sdk: true

`src/infrastructure/session/media/livekit-media-plane-adapter.ts:99` — dynamic-expression.

Exact call/query chain:
```ts
local?.setCameraEnabled?.(true)
```

Enclosing operation: `src/infrastructure/session/media/livekit-media-plane-adapter.ts:91`; complete request/default/result/error logic is in the declarations below and the snapshot.
### provider-sdk: true

`src/infrastructure/session/media/livekit-media-plane-adapter.ts:101` — dynamic-expression.

Exact call/query chain:
```ts
local?.setMicrophoneEnabled?.(true)
```

Enclosing operation: `src/infrastructure/session/media/livekit-media-plane-adapter.ts:91`; complete request/default/result/error logic is in the declarations below and the snapshot.
### provider-sdk: false

`src/infrastructure/session/media/livekit-media-plane-adapter.ts:112` — dynamic-expression.

Exact call/query chain:
```ts
local?.setCameraEnabled?.(false)
```

Enclosing operation: `src/infrastructure/session/media/livekit-media-plane-adapter.ts:109`; complete request/default/result/error logic is in the declarations below and the snapshot.
### provider-sdk: false

`src/infrastructure/session/media/livekit-media-plane-adapter.ts:113` — dynamic-expression.

Exact call/query chain:
```ts
local?.setMicrophoneEnabled?.(false)
```

Enclosing operation: `src/infrastructure/session/media/livekit-media-plane-adapter.ts:109`; complete request/default/result/error logic is in the declarations below and the snapshot.
### provider-sdk: bytes

`src/infrastructure/session/media/livekit-media-plane-adapter.ts:145` — dynamic-expression.

Exact call/query chain:
```ts
this.room.localParticipant.publishData(bytes, {
      reliable: false,
      topic,
    })
```

Enclosing operation: `src/infrastructure/session/media/livekit-media-plane-adapter.ts:140`; complete request/default/result/error logic is in the declarations below and the snapshot.
### provider-sdk: dataReceived

`src/infrastructure/session/media/livekit-media-plane-adapter.ts:181` — literal-or-constant.

Exact call/query chain:
```ts
this.room.on('dataReceived', this.dataListener)
```

Enclosing operation: `src/infrastructure/session/media/livekit-media-plane-adapter.ts:161`; complete request/default/result/error logic is in the declarations below and the snapshot.
### provider-sdk: dataReceived

`src/infrastructure/session/media/livekit-media-plane-adapter.ts:186` — literal-or-constant.

Exact call/query chain:
```ts
this.room.off('dataReceived', this.dataListener)
```

Enclosing operation: `src/infrastructure/session/media/livekit-media-plane-adapter.ts:184`; complete request/default/result/error logic is in the declarations below and the snapshot.

## Complete public declarations and facade operation contracts

### src/infrastructure/session/host-session-adapter.ts:15

```ts
export type HostSessionAdapter = HostSessionPorts & {
  readonly transport: 'host';
  readonly ops: typeof HOST_SESSION_OPS;
  readonly rpcNames: typeof HOST_SESSION_RPC_NAMES;
  readonly edgeNames: typeof HOST_SESSION_EDGE_NAMES;
};
```

### src/infrastructure/session/host-session-adapter.ts:26

```ts
export function createHostSessionAdapter(ports: HostSessionPorts): HostSessionAdapter {
  return {
    transport: 'host',
    ops: HOST_SESSION_OPS,
    rpcNames: HOST_SESSION_RPC_NAMES,
    edgeNames: HOST_SESSION_EDGE_NAMES,
    applySessionRuntimeCommand: (actorId, command) =>
      ports.applySessionRuntimeCommand(actorId, command),
    createPlaySession: (actorId, projectId, name) =>
      ports.createPlaySession(actorId, projectId, name),
    createSessionInvite: (actorId, sessionId) => ports.createSessionInvite(actorId, sessionId),
    getSessionRecap: (actorId, sessionId) => ports.getSessionRecap(actorId, sessionId),
    getSessionRuntimeSnapshot: (actorId, sessionId) =>
      ports.getSessionRuntimeSnapshot(actorId, sessionId),
    joinSessionByCode: (actorId, code, characterId) =>
      ports.joinSessionByCode(actorId, code, characterId),
    leavePlaySession: (actorId, sessionId) => ports.leavePlaySession(actorId, sessionId),
    resolveSessionInvite: (actorId, token) => ports.resolveSessionInvite(actorId, token),
    revokeSessionInvite: (actorId, token) => ports.revokeSessionInvite(actorId, token),
    saveSessionRecapSummary: (actorId, sessionId, summaryText, status) =>
      ports.saveSessionRecapSummary(actorId, sessionId, summaryText, status),
    setSessionPlayerPresence: (actorId, sessionId, expectedRevision, idempotencyKey, presence) =>
      ports.setSessionPlayerPresence(
        actorId,
        sessionId,
        expectedRevision,
        idempotencyKey,
        presence,
      ),
    setSessionStatus: (actorId, sessionId, status) =>
      ports.setSessionStatus(actorId, sessionId, status),
  };
}
```

### src/infrastructure/session/host-session-ports.contract.ts:11

```ts
export type HostSessionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };
```

### src/infrastructure/session/host-session-ports.contract.ts:16

```ts
export type HostPlaySessionVm = Readonly<Record<string, unknown>> & {
  readonly sessionId: string;
};
```

### src/infrastructure/session/host-session-ports.contract.ts:20

```ts
export type HostSessionInviteVm = Readonly<Record<string, unknown>>;
```

### src/infrastructure/session/host-session-ports.contract.ts:21

```ts
export type HostSessionRecapVm = Readonly<Record<string, unknown>>;
```

### src/infrastructure/session/host-session-ports.contract.ts:22

```ts
export type HostSessionRuntimeSnapshotVm = Readonly<Record<string, unknown>>;
```

### src/infrastructure/session/host-session-ports.contract.ts:28

```ts
export type HostSessionPorts = {
  readonly applySessionRuntimeCommand: (
    actorId: string,
    command: Readonly<Record<string, unknown>>,
  ) => Promise<HostSessionResult<Readonly<Record<string, unknown>>>>;
  readonly createPlaySession: (
    actorId: string,
    projectId: string,
    name?: string | null,
  ) => Promise<HostSessionResult<HostPlaySessionVm>>;
  readonly createSessionInvite: (
    actorId: string,
    sessionId: string,
  ) => Promise<HostSessionResult<HostSessionInviteVm>>;
  readonly getSessionRecap: (
    actorId: string,
    sessionId: string,
  ) => Promise<HostSessionResult<HostSessionRecapVm>>;
  readonly getSessionRuntimeSnapshot: (
    actorId: string,
    sessionId: string,
  ) => Promise<HostSessionResult<HostSessionRuntimeSnapshotVm>>;
  readonly joinSessionByCode: (
    actorId: string,
    code: string,
    characterId?: string | null,
  ) => Promise<HostSessionResult<HostPlaySessionVm>>;
  readonly leavePlaySession: (
    actorId: string,
    sessionId: string,
  ) => Promise<HostSessionResult<{ readonly sessionId: string }>>;
  readonly resolveSessionInvite: (
    actorId: string,
    token: string,
  ) => Promise<HostSessionResult<HostSessionInviteVm>>;
  readonly revokeSessionInvite: (
    actorId: string,
    token: string,
  ) => Promise<HostSessionResult<{ readonly token: string }>>;
  readonly saveSessionRecapSummary: (
    actorId: string,
    sessionId: string,
    summaryText: string,
    status?: string | null,
  ) => Promise<HostSessionResult<HostSessionRecapVm>>;
  readonly setSessionPlayerPresence: (
    actorId: string,
    sessionId: string,
    expectedRevision: number,
    idempotencyKey: string,
    presence: Readonly<Record<string, unknown>>,
  ) => Promise<HostSessionResult<Readonly<Record<string, unknown>>>>;
  readonly setSessionStatus: (
    actorId: string,
    sessionId: string,
    status: string,
  ) => Promise<HostSessionResult<HostPlaySessionVm>>;
};
```

### src/infrastructure/session/host-session-ports.contract.ts:88

```ts
export const HOST_SESSION_RPC_NAMES = [
  'apply_session_runtime_command',
  'create_play_session',
  'create_session_invite',
  'get_session_recap',
  'get_session_runtime_snapshot',
  'join_session_by_code',
  'leave_play_session',
  'resolve_session_invite',
  'revoke_session_invite',
  'save_session_recap_summary',
  'set_session_player_presence',
  'set_session_status',
] as const;
```

### src/infrastructure/session/host-session-ports.contract.ts:103

```ts
export type HostSessionRpcName = (typeof HOST_SESSION_RPC_NAMES)[number];
```

### src/infrastructure/session/host-session-ports.contract.ts:106

```ts
export const HOST_SESSION_EDGE_NAMES = ['session-media-token', 'session-recap'] as const;
```

### src/infrastructure/session/host-session-ports.contract.ts:108

```ts
export const HOST_SESSION_OPS = [
  'applySessionRuntimeCommand',
  'createPlaySession',
  'createSessionInvite',
  'getSessionRecap',
  'getSessionRuntimeSnapshot',
  'joinSessionByCode',
  'leavePlaySession',
  'resolveSessionInvite',
  'revokeSessionInvite',
  'saveSessionRecapSummary',
  'setSessionPlayerPresence',
  'setSessionStatus',
] as const;
```

### src/infrastructure/session/live-session-access.resolver.ts:18

```ts
export type AuthoritativeSessionMembership = {
  readonly userId: string;
  readonly role: string;
  /** Capabilities column from membership — never from client body. */
  readonly capabilities: readonly string[];
  readonly characterId: string | null;
  readonly allowPlayerDirector?: boolean;
};
```

### src/infrastructure/session/live-session-access.resolver.ts:31

```ts
export async function resolveLiveSessionAccessFromMembership(
  membership: AuthoritativeSessionMembership,
): Promise<LiveSessionAccess> {
  const userId = await getAuthenticatedUserId();
  if (membership.userId !== userId) {
    throw new Error('Session-Mitgliedschaft gehört nicht zum angemeldeten Nutzer.');
  }
  const validated = validateLiveSessionAccess({
    role: membership.role,
    capabilities: membership.capabilities,
    characterId: membership.characterId,
    allowPlayerDirector: membership.allowPlayerDirector === true,
  });
  if (validated.ok === false) {
    throw new Error(validated.message);
  }
  return validated.access;
}
```

### src/infrastructure/session/live-session-access.resolver.ts:54

```ts
export function buildLiveSessionReadModel(
  access: LiveSessionAccess,
  authoritativePayload: Record<string, unknown>,
): Record<string, unknown> {
  return filterPayloadForAccess(access, authoritativePayload);
}
```

### src/infrastructure/session/live-session-access.resolver.ts:65

```ts
export function rejectClientCapabilityElevation(input: {
  authoritativeCapabilities: readonly string[];
  clientClaimedCapabilities: unknown;
}): readonly string[] {
  if (input.clientClaimedCapabilities === undefined || input.clientClaimedCapabilities === null) {
    return input.authoritativeCapabilities;
  }
  // Any client claim is ignored — authoritative wins.
  return input.authoritativeCapabilities;
}
```

### src/infrastructure/session/media/livekit-media-plane-adapter.ts:36

```ts
export type LiveKitRoomFactory = () => Promise<LiveKitRoomLike>;
```

### src/infrastructure/session/media/livekit-media-plane-adapter.ts:38

```ts
export class LiveKitMediaPlaneAdapter implements MediaPlaneAdapter {
  readonly providerId = 'livekit' as const;
  private health: MediaPlaneHealth = 'unavailable';
  private roomId = '';
  private localIdentity: string | null = null;
  private role: MediaPresenceSnapshot['participants'][number]['role'] = 'viewer';
  private published: MediaTrackKind[] = [];
  private room: LiveKitRoomLike | null = null;
  private readonly dataHandlers = new Set<MediaPlaneDataHandler>();
  private dataListener: ((...args: unknown[]) => void) | null = null;

  constructor(private readonly roomFactory?: LiveKitRoomFactory) {}

  async connect(input: MediaPlaneConnectInput): Promise<void> {
    this.health = 'connecting';
    this.roomId = deriveMediaRoomId(input.sessionId);
    this.localIdentity = input.identity;
    this.role = input.access.role;
    this.published = [];

    if (!this.roomFactory) {
      this.health = 'unavailable';
      throw new Error(
        'LiveKit room factory not configured (media plane degraded).',
      );
    }

    try {
      this.room = await this.roomFactory();
      await this.room.connect(input.url, input.token);
      this.attachDataListener();
      this.health = 'ready';
    } catch (error) {
      this.room = null;
      this.health = 'unavailable';
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.detachDataListener();
      await this.room?.disconnect();
    } finally {
      this.room = null;
      this.health = 'unavailable';
      this.localIdentity = null;
      this.published = [];
      this.roomId = '';
      this.dataHandlers.clear();
    }
  }

  async publish(intents: readonly MediaPublishIntent[]): Promise<void> {
    if (this.health !== 'ready' || !this.room) {
      throw new Error('LiveKit room not ready');
    }
    const local = this.room.localParticipant;
    for (const intent of intents) {
      if (!intent.enabled) continue;
      if (intent.kind === 'camera') {
        await local?.setCameraEnabled?.(true);
      } else if (intent.kind === 'microphone') {
        await local?.setMicrophoneEnabled?.(true);
      }
      if (!this.published.includes(intent.kind)) {
        this.published.push(intent.kind);
      }
    }
  }

  async unpublish(kinds: readonly MediaTrackKind[]): Promise<void> {
    const local = this.room?.localParticipant;
    for (const kind of kinds) {
      if (kind === 'camera') await local?.setCameraEnabled?.(false);
      if (kind === 'microphone') await local?.setMicrophoneEnabled?.(false);
    }
    this.published = this.published.filter((k) => !kinds.includes(k));
  }

  getPresence(): MediaPresenceSnapshot {
    return {
      roomId: this.roomId,
      health: this.health,
      localIdentity: this.localIdentity,
      participants:
        this.localIdentity === null
          ? []
          : [
              {
                identity: this.localIdentity,
                role: this.role,
                published: [...this.published],
              },
            ],
    };
  }

  getHealth(): MediaPlaneHealth {
    return this.health;
  }

  async publishData(topic: string, payload: string): Promise<void> {
    if (this.health !== 'ready' || !this.room?.localParticipant?.publishData) {
      throw new Error('LiveKit data publish unavailable');
    }
    const bytes = new TextEncoder().encode(payload);
    await this.room.localParticipant.publishData(bytes, {
      reliable: false,
      topic,
    });
    if (topic === 'liveact-data' && !this.published.includes('liveact-data')) {
      this.published.push('liveact-data');
    }
  }

  subscribeData(handler: MediaPlaneDataHandler): () => void {
    this.dataHandlers.add(handler);
    return () => {
      this.dataHandlers.delete(handler);
    };
  }

  private attachDataListener(): void {
    if (!this.room?.on) return;
    this.detachDataListener();
    this.dataListener = (...args: unknown[]) => {
      const payload = args[0];
      const participant = args[1] as { identity?: string } | undefined;
      const topic =
        typeof args[2] === 'string'
          ? args[2]
          : typeof (args[2] as { topic?: string } | undefined)?.topic === 'string'
            ? (args[2] as { topic: string }).topic
            : 'liveact-data';
      if (!(payload instanceof Uint8Array)) return;
      const publisherIdentity =
        typeof participant?.identity === 'string' ? participant.identity : '';
      if (!publisherIdentity || publisherIdentity === this.localIdentity) return;
      const text = new TextDecoder().decode(payload);
      const message = { topic, payload: text, publisherIdentity };
      for (const handler of this.dataHandlers) handler(message);
    };
    this.room.on('dataReceived', this.dataListener);
  }

  private detachDataListener(): void {
    if (this.room?.off && this.dataListener) {
      this.room.off('dataReceived', this.dataListener);
    }
    this.dataListener = null;
  }
}
```

### src/infrastructure/session/media/media-plane-adapter.ts:16

```ts
export type MediaPlaneConnectInput = {
  readonly sessionId: string;
  readonly access: LiveSessionAccess;
  readonly identity: string;
  readonly token: string;
  readonly url: string;
};
```

### src/infrastructure/session/media/media-plane-adapter.ts:25

```ts
export type MediaPlaneDataMessage = {
  readonly topic: string;
  readonly payload: string;
  readonly publisherIdentity: string;
};
```

### src/infrastructure/session/media/media-plane-adapter.ts:31

```ts
export type MediaPlaneDataHandler = (message: MediaPlaneDataMessage) => void;
```

### src/infrastructure/session/media/media-plane-adapter.ts:33

```ts
export type MediaPlaneAdapter = {
  readonly providerId: 'livekit' | 'memory' | 'none';
  connect(input: MediaPlaneConnectInput): Promise<void>;
  disconnect(): Promise<void>;
  publish(intents: readonly MediaPublishIntent[]): Promise<void>;
  unpublish(kinds: readonly MediaTrackKind[]): Promise<void>;
  getPresence(): MediaPresenceSnapshot;
  getHealth(): MediaPlaneHealth;
  /** Publish ephemeral UTF-8 data (LiveAct network frames). */
  publishData?(topic: string, payload: string): Promise<void>;
  /** Subscribe to ephemeral data; returns unsubscribe. */
  subscribeData?(handler: MediaPlaneDataHandler): () => void;
};
```

### src/infrastructure/session/media/media-token-client.ts:10

```ts
export type MediaTokenSuccess = {
  readonly ok: true;
  readonly token: string;
  readonly url: string;
  readonly roomId: string;
  readonly expiresAt: string;
  readonly ttlSeconds: number;
};
```

### src/infrastructure/session/media/media-token-client.ts:19

```ts
export type MediaTokenDegraded = {
  readonly ok: false;
  readonly degraded: true;
  readonly reason: 'media_service_unavailable' | 'forbidden' | 'unauthorized' | 'bad_request';
  readonly message: string;
};
```

### src/infrastructure/session/media/media-token-client.ts:26

```ts
export type MediaTokenResult = MediaTokenSuccess | MediaTokenDegraded;
```

### src/infrastructure/session/media/media-token-client.ts:28

```ts
export async function fetchSessionMediaToken(input: {
  sessionId: string;
}): Promise<MediaTokenResult> {
  const sessionId = input.sessionId.trim();
  if (!sessionId) {
    return {
      ok: false,
      degraded: true,
      reason: 'bad_request',
      message: 'sessionId fehlt.',
    };
  }
  if (!isHostLibraryEnabled()) {
    return {
      ok: false,
      degraded: true,
      reason: 'media_service_unavailable',
      message: 'Medien-Dienst nicht erreichbar.',
    };
  }
  return fetchHostSessionMediaToken(sessionId);
}
```

### src/infrastructure/session/media/memory-media-plane-adapter.ts:24

```ts
export class MemoryMediaPlaneAdapter implements MediaPlaneAdapter {
  readonly providerId = 'memory' as const;
  private health: MediaPlaneHealth = 'unavailable';
  private roomId = '';
  private localIdentity: string | null = null;
  private published: MediaTrackKind[] = [];
  private role: MediaPresenceSnapshot['participants'][number]['role'] = 'viewer';
  private unsubData: (() => void) | null = null;
  private readonly localDataHandlers = new Set<MediaPlaneDataHandler>();

  constructor(private readonly bus: MemoryMediaPlaneBus = defaultMemoryMediaPlaneBus) {}

  async connect(input: MediaPlaneConnectInput): Promise<void> {
    if (!input.token || !input.url) {
      this.health = 'unavailable';
      throw new Error('Media token/url missing');
    }
    this.health = 'connecting';
    this.roomId = deriveMediaRoomId(input.sessionId);
    this.localIdentity = input.identity;
    this.role = input.access.role;
    this.published = [];
    this.unsubData?.();
    this.unsubData = this.bus.subscribe(input.identity, (message) => {
      for (const handler of this.localDataHandlers) handler(message);
    });
    this.health = 'ready';
  }

  async disconnect(): Promise<void> {
    this.unsubData?.();
    this.unsubData = null;
    this.localDataHandlers.clear();
    this.health = 'unavailable';
    this.localIdentity = null;
    this.published = [];
    this.roomId = '';
  }

  async publish(intents: readonly MediaPublishIntent[]): Promise<void> {
    if (this.health !== 'ready' && this.health !== 'reconnecting') {
      throw new Error('Media plane not ready');
    }
    for (const intent of intents) {
      if (!intent.enabled) continue;
      if (!this.published.includes(intent.kind)) {
        this.published.push(intent.kind);
      }
    }
  }

  async unpublish(kinds: readonly MediaTrackKind[]): Promise<void> {
    this.published = this.published.filter((k) => !kinds.includes(k));
  }

  async publishData(topic: string, payload: string): Promise<void> {
    if (this.health !== 'ready' || !this.localIdentity) {
      throw new Error('Media plane not ready for data');
    }
    if (!this.published.includes('liveact-data') && topic === 'liveact-data') {
      // Allow data publish when liveact-data intent was published OR topic is liveact-data after explicit enable
      this.published.push('liveact-data');
    }
    this.bus.publish({
      topic,
      payload,
      publisherIdentity: this.localIdentity,
    });
  }

  subscribeData(handler: MediaPlaneDataHandler): () => void {
    this.localDataHandlers.add(handler);
    return () => {
      this.localDataHandlers.delete(handler);
    };
  }

  getPresence(): MediaPresenceSnapshot {
    return {
      roomId: this.roomId,
      health: this.health,
      localIdentity: this.localIdentity,
      participants:
        this.localIdentity === null
          ? []
          : [
              {
                identity: this.localIdentity,
                role: this.role,
                published: [...this.published],
              },
            ],
    };
  }

  getHealth(): MediaPlaneHealth {
    return this.health;
  }

  /** Test helper: simulate reconnect cycle. */
  async simulateReconnect(): Promise<void> {
    this.health = 'reconnecting';
    this.health = 'ready';
  }
}
```

### src/infrastructure/session/media/memory-media-plane-bus.ts:8

```ts
export class MemoryMediaPlaneBus {
  private readonly handlers = new Set<{
    identity: string;
    handler: MediaPlaneDataHandler;
  }>();

  subscribe(identity: string, handler: MediaPlaneDataHandler): () => void {
    const entry = { identity, handler };
    this.handlers.add(entry);
    return () => {
      this.handlers.delete(entry);
    };
  }

  publish(message: MediaPlaneDataMessage): void {
    for (const entry of this.handlers) {
      if (entry.identity === message.publisherIdentity) continue;
      entry.handler(message);
    }
  }
}
```

### src/infrastructure/session/media/memory-media-plane-bus.ts:31

```ts
export const defaultMemoryMediaPlaneBus = new MemoryMediaPlaneBus();
```

### src/infrastructure/session/media/session-media-plane.ts:25

```ts
export type SessionMediaPlaneOptions = {
  /** Prefer memory adapter (tests). Default: LiveKit with degrade. */
  readonly preferMemory?: boolean;
  readonly adapter?: MediaPlaneAdapter;
  readonly tokenFetcher?: typeof fetchSessionMediaToken;
};
```

### src/infrastructure/session/media/session-media-plane.ts:32

```ts
export class SessionMediaPlane {
  private adapter: MediaPlaneAdapter;
  private status: MediaPlaneStatus = degradedMediaStatus(
    'media_service_unavailable',
    'Media plane noch nicht verbunden.',
  );
  private access: LiveSessionAccess | null = null;
  private readonly tokenFetcher: typeof fetchSessionMediaToken;

  constructor(options: SessionMediaPlaneOptions = {}) {
    this.tokenFetcher = options.tokenFetcher ?? fetchSessionMediaToken;
    if (options.adapter) {
      this.adapter = options.adapter;
    } else if (options.preferMemory === true) {
      this.adapter = new MemoryMediaPlaneAdapter();
    } else {
      this.adapter = new LiveKitMediaPlaneAdapter();
    }
  }

  getStatus(): MediaPlaneStatus {
    return this.status;
  }

  getPresence(): MediaPresenceSnapshot {
    return this.adapter.getPresence();
  }

  /**
   * Connect using membership-derived token. Media outage → degraded, no throw to UI callers
   * unless `throwOnUnavailable` (tests).
   */
  async connect(input: {
    sessionId: string;
    access: LiveSessionAccess;
    identity: string;
    throwOnUnavailable?: boolean;
  }): Promise<MediaPlaneStatus> {
    this.access = input.access;
    if (!canSubscribeMedia(input.access)) {
      this.status = degradedMediaStatus(
        'permission_denied',
        'Keine Media-Berechtigung für diese Rolle.',
      );
      return this.status;
    }

    const tokenResult = await this.tokenFetcher({ sessionId: input.sessionId });
    if (tokenResult.ok === false) {
      this.status = degradedMediaStatus(
        tokenResult.reason === 'forbidden' || tokenResult.reason === 'unauthorized'
          ? 'permission_denied'
          : 'media_service_unavailable',
        tokenResult.message,
      );
      if (input.throwOnUnavailable) {
        throw new Error(tokenResult.message);
      }
      return this.status;
    }

    try {
      await this.adapter.connect({
        sessionId: input.sessionId,
        access: input.access,
        identity: input.identity,
        token: tokenResult.token,
        url: tokenResult.url,
      });
      this.status = readyMediaStatus();
      return this.status;
    } catch (error) {
      this.status = degradedMediaStatus(
        'media_service_unavailable',
        error instanceof Error
          ? error.message
          : 'Media-Verbindung fehlgeschlagen.',
      );
      if (input.throwOnUnavailable) throw error;
      return this.status;
    }
  }

  async disconnect(): Promise<void> {
    await this.adapter.disconnect();
    this.status = degradedMediaStatus(
      'media_service_unavailable',
      'Media plane getrennt.',
    );
    this.access = null;
  }

  /**
   * Publish only intents allowed by current access. Explicit gesture expected by UI.
   */
  async publish(intents: readonly MediaPublishIntent[]): Promise<MediaPlaneStatus> {
    if (!this.access) {
      this.status = degradedMediaStatus(
        'permission_denied',
        'Media plane nicht verbunden.',
      );
      return this.status;
    }
    if (this.status.health !== 'ready' && this.status.health !== 'reconnecting') {
      return this.status;
    }
    const allowed = filterPublishIntentsForAccess(this.access, intents);
    if (allowed.length === 0) {
      this.status = degradedMediaStatus(
        'permission_denied',
        'Publish für diese Rolle nicht erlaubt.',
      );
      return this.status;
    }
    try {
      await this.adapter.publish(allowed);
      this.status = readyMediaStatus();
    } catch (error) {
      this.status = degradedMediaStatus(
        'network',
        error instanceof Error ? error.message : 'Publish fehlgeschlagen.',
      );
    }
    return this.status;
  }

  async unpublish(kinds: readonly MediaTrackKind[]): Promise<void> {
    await this.adapter.unpublish(kinds);
  }

  /**
   * Publish ephemeral LiveAct network JSON when access allows liveact-data (#364).
   */
  async publishLiveActData(payload: string): Promise<boolean> {
    if (!this.access || !canPublishTrack(this.access, 'liveact-data')) {
      return false;
    }
    if (this.status.health !== 'ready' && this.status.health !== 'reconnecting') {
      return false;
    }
    if (typeof this.adapter.publishData !== 'function') {
      return false;
    }
    try {
      await this.adapter.publishData('liveact-data', payload);
      return true;
    } catch {
      return false;
    }
  }

  subscribeLiveActData(handler: MediaPlaneDataHandler): () => void {
    if (typeof this.adapter.subscribeData !== 'function') {
      return () => undefined;
    }
    return this.adapter.subscribeData(handler);
  }

  /**
   * Apply role downgrade: drop forbidden tracks and refresh status.
   */
  async applyAccessDowngrade(access: LiveSessionAccess): Promise<MediaPlaneStatus> {
    this.access = access;
    const presence = this.adapter.getPresence();
    const local = presence.participants.find((p) => p.identity === presence.localIdentity);
    const published = local?.published ?? [];
    const forbidden = published.filter((kind) => !canPublishTrack(access, kind));
    if (forbidden.length > 0) {
      await this.adapter.unpublish(forbidden);
      this.status = degradedMediaStatus(
        'role_downgrade',
        'Publish-Rechte entzogen — Tracks entfernt.',
      );
      if (this.adapter.getHealth() === 'ready') {
        this.status = readyMediaStatus();
      }
    }
    return this.status;
  }
}
```

### src/infrastructure/session/session-lobby-channel.ts:9

```ts
export type LobbyReadyPayload = {
  readonly userId: string;
  readonly ready: boolean;
};
```

### src/infrastructure/session/session-lobby-channel.ts:14

```ts
export type LobbyReadyListener = (payload: LobbyReadyPayload) => void;
```

### src/infrastructure/session/session-lobby-channel.ts:16

```ts
export type SessionLobbySubscription = {
  sendReady: (payload: LobbyReadyPayload) => Promise<void>;
  unsubscribe: () => Promise<void>;
};
```

### src/infrastructure/session/session-lobby-channel.ts:27

```ts
export async function subscribeSessionLobbyReady(
  sessionId: string,
  onReady: LobbyReadyListener,
): Promise<SessionLobbySubscription> {
  assertHost();
  void sessionId;
  let disposed = false;
  return {
    sendReady: async (payload) => {
      if (disposed) return;
      onReady({ userId: payload.userId, ready: payload.ready === true });
    },
    unsubscribe: async () => {
      disposed = true;
    },
  };
}
```

### src/infrastructure/session/session-recap-ai-service.ts:12

```ts
export type EpisodeSummaryStatus = 'none' | 'draft' | 'approved';
```

### src/infrastructure/session/session-recap-ai-service.ts:14

```ts
export type SessionRecapAiGenerateResult = {
  readonly summaryText: string;
  readonly summaryStatus: EpisodeSummaryStatus;
  readonly provider: string;
  readonly model: string;
};
```

### src/infrastructure/session/session-recap-ai-service.ts:54

```ts
export const sessionRecapAiService = new SessionRecapAiService();
```

### src/infrastructure/session/session-recap-service.ts:11

```ts
export type SessionRecapDto = {
  readonly sessionId: string;
  readonly summaryText: string | null;
  readonly summaryStatus: 'none' | 'draft' | 'approved';
  readonly highlights: readonly RecapHighlightLine[];
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
};
```

### src/infrastructure/session/session-recap-service.ts:52

```ts
export const sessionRecapService = new SessionRecapService();
```

### src/infrastructure/session/session-runtime-channel.ts:9

```ts
export type SessionRuntimeListener = (state: SessionRuntimeState) => void;
```

### src/infrastructure/session/session-runtime-channel.ts:11

```ts
export interface SessionRuntimeSubscription {
  getState: () => SessionRuntimeState | null;
  resync: () => Promise<SessionRuntimeState>;
  unsubscribe: () => Promise<void>;
}
```

### src/infrastructure/session/session-runtime-channel.ts:28

```ts
export async function subscribeSessionRuntime(
  sessionId: string,
  onChange: SessionRuntimeListener,
): Promise<SessionRuntimeSubscription> {
  assertHost();
  let current: SessionRuntimeState | null = await sessionRuntimeService.getSnapshot(sessionId);
  onChange(current);

  let disposed = false;
  const pollTimer = setInterval(() => {
    void sessionRuntimeService
      .getSnapshot(sessionId)
      .then((next) => {
        current = next;
        if (!disposed) onChange(next);
      })
      .catch(() => {
        /* keep last good snapshot */
      });
  }, HOST_RUNTIME_POLL_MS);

  const refresh = async (): Promise<SessionRuntimeState> => {
    const next = await sessionRuntimeService.getSnapshot(sessionId);
    current = next;
    if (!disposed) onChange(next);
    return next;
  };

  return {
    getState: () => current,
    resync: refresh,
    unsubscribe: async () => {
      disposed = true;
      clearInterval(pollTimer);
    },
  };
}
```

### src/infrastructure/session/session-runtime-service.ts:72

```ts
export function mapSnapshotJson(data: SnapshotJson): SessionRuntimeState {
  const sessionId = typeof data.sessionId === 'string' ? data.sessionId : '';
  if (!sessionId) {
    throw new Error('Runtime-Snapshot ohne sessionId');
  }
  const revision = typeof data.revision === 'number' ? data.revision : Number(data.revision ?? 0);
  if (!Number.isFinite(revision)) {
    throw new Error('Runtime-Snapshot ohne gültige Revision');
  }
  return {
    sessionId,
    revision,
    status: normalizeRuntimeStatus(typeof data.status === 'string' ? data.status : 'waiting'),
    roster: mapRoster(data.roster),
    gameplay: mapGameplay(data.gameplay),
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
  };
}
```

### src/infrastructure/session/session-runtime-service.ts:151

```ts
export const sessionRuntimeService = new SessionRuntimeService();
```

### src/infrastructure/session/session-service.ts:181

```ts
export const sessionService = new SessionService();
```


## Remaining backend helper operations

All backend operations are included in the public declarations above.

## Verification source manifest

| Path | SHA-256 |
|---|---|
| `src/domains/resource-id/session-routing.ts` | `8a471af964126b08e663785fec8c260762629d673747ec8b72cec0369b963400` |
| `src/domains/session/contracts/live-session-access.ts` | `5c5fea67625237d0ae703e54e07dceb52d1694df8fe7bab6248b13810f4df411` |
| `src/domains/session/contracts/session-invite.ts` | `dac4795822314800fb59ff5e11b56ab8ce808071c43185e99711a92b66c0d4dc` |
| `src/domains/session/contracts/session-lifecycle.ts` | `c70eb365aa31906dc8cd8f7a3cc2c5ed1141b5bab8489a1d56ced8a41c1ce5be` |
| `src/domains/session/contracts/session-prepare-recap.ts` | `14a939d627bc1b7393a8e32c1a9bf9f2b74aab0058416bd6e73a9a59cbcc7c7f` |
| `src/domains/session/contracts/session-runtime.ts` | `c928a253185cf9aa6fac10b380807033d86c0df4120fdc80b223800c626b84e2` |
| `src/domains/session/contracts/session.types.ts` | `3f2056b6b4cb4ef86dbffd4271482131a3bf4714c3329b8827a067acfde29a04` |
| `src/domains/session/media/media-plane-contract.ts` | `7cba204291a86a1159b961048280899541f95c102abad8e2c8f61e7662ba8c1b` |
| `src/infrastructure/host/host-library-http.ts` | `39abb17777de0e744ebe2932789443b9722135bfefc7ae0596f93ec7ef6df8dd` |
| `src/infrastructure/host/host-session-http.ts` | `39b5efefc00297d57c1c4f248953cbbed4d7053e51974cd25a2ed43e368a64eb` |
| `src/infrastructure/session/host-session-adapter.ts` | `57c52ff948f0e5169f302c2de0a58e4eabffa35668fb121605533bcddbb3d4fb` |
| `src/infrastructure/session/host-session-ports.contract.ts` | `b7d49eee90da55c7a0acadd765ddb202527fc003789f855ae910425e073f928f` |
| `src/infrastructure/session/live-session-access.resolver.ts` | `88276a0afb9522e2dbb75f98959562ace873f33662ec2dea668428f91a762b9a` |
| `src/infrastructure/session/media/index.ts` | `ba6906bf57e04303b283786671d0ae7e0024949e512d59b3b783289e6ba19155` |
| `src/infrastructure/session/media/livekit-media-plane-adapter.ts` | `ba41c95f3816b79818a9c312c056ec896ac75fd4633dba27954cdcdb797b381d` |
| `src/infrastructure/session/media/media-plane-adapter.ts` | `1dbdf0f7c75c1edc435fb629d5029a1c04806a5a6cbcf9b037ad8a620dcc34cd` |
| `src/infrastructure/session/media/media-token-client.ts` | `c554cc7bdddcf519de1aba83c9804ff8edf62e75f95c409aebb771fad023c7dd` |
| `src/infrastructure/session/media/memory-media-plane-adapter.ts` | `31fc7cee75c49c1e3af09b784e4a8dad3446bbe5ae5ddd6f7b2c9aee142dc5be` |
| `src/infrastructure/session/media/memory-media-plane-bus.ts` | `1616d229067f513a12c67319aec28649e3a0afdf77779f9071b595dc024ff193` |
| `src/infrastructure/session/media/session-media-plane.ts` | `ce8d3ec690f83745646400443d7870cd96383e341628a2d8f017e2d391fbb225` |
| `src/infrastructure/session/session-lobby-channel.ts` | `3747d80942a4ea3cc19c9add12dd8167f3642895cc57d57f0df494c095f4e5e5` |
| `src/infrastructure/session/session-recap-ai-service.ts` | `b0161e496d5de5ecc1a850a5eb908611396b03b69860fd6e9d93be2f92822960` |
| `src/infrastructure/session/session-recap-service.ts` | `0fb9b8f81980a70e42c578ed1274ad43b6098f2cac6c6cf89cbba5bd0ab934fc` |
| `src/infrastructure/session/session-runtime-channel.ts` | `07b49ed37f61a3e737f58e42b5fea1dd8151c66430014ce1f8fb04e1a85fa69a` |
| `src/infrastructure/session/session-runtime-service.ts` | `49c9781729542abf9ca36d23d26ddf7206bd1247b6f5fe6b7e964f5942cf2961` |
| `src/infrastructure/session/session-service.ts` | `674d30a083283997b85b3f5397276675403bceb5de34832009ee1d1355ffa40a` |
| `src/lib/authenticatedUser.ts` | `5d9deef60efd85a3ecd56e9b55f67ecb2d03c2964c4f9217e6de6842d8e0b403` |
| `src/lib/hostAuthBridge.ts` | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |
| `src/lib/localAdmin.ts` | `103feaea892b0582022557ff81cef61105f3d9ed4eb421a20d8b0b415c2de498` |
| `src/lib/networkTimeout.ts` | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |

