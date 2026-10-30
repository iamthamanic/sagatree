# Infrastructure contract: session

**Status: SPEC; current branch source verified.** Implementation issue: **#810**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-session.json](source-contracts/infra-session.json) (SHA-256 `b50e83b67e10a09c245c91be17f1075f58648bb8ee82f94874de43e27c15d72d`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Facade behavior and authorization boundary

Lifecycle/invites/recap/runtime use12 RPCs and2 Edge calls. Runtime loads authoritative snapshot before subscribing to sessions*,session_players* and session_events INSERT; each event refetches snapshot, resync is explicit. Lobby session-lobby:{id} uses ephemeral broadcast event ready with caller userId and boolean; it does not use postgres_changes. Media token adapter normalizes degraded errors. LiveKitRoomFactory is injected; absent factory fails closed, default presence lists local identity only, publishData uses unreliable transport.

RPC/Edge derive session authority server-side. Runtime snapshot call precedes subscription; lobby ready has no membership check in this adapter and supplied userId is untrusted UI state, never gameplay authorization. Viewer publish gates and identity checks belong to media-plane domain/valid token, not arbitrary broadcast claims.

The adapter establishes request/filter behavior. Server permission and rollback guarantees require the linked effective SQL/RLS contracts and backend fixtures; a source-only adapter review does not prove a live RLS policy.

## Complete backend inventory

RPCs (12): `apply_session_runtime_command`, `create_play_session`, `create_session_invite`, `get_session_recap`, `get_session_runtime_snapshot`, `join_session_by_code`, `leave_play_session`, `resolve_session_invite`, `revoke_session_invite`, `save_session_recap_summary`, `set_session_player_presence`, `set_session_status`.

Tables (3): `projects`, `session_players`, `sessions`.

Storage buckets (0): none.

Edge invokes (2): `session-media-token`, `session-recap`.

Realtime call sites: 11. Direct fetch sites: 0. Explicit auth/helper sites: 3.

## Complete implementation dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| rpc | `apply_session_runtime_command` | #814 | RPC-SESSION-RUNTIME |
| rpc | `create_play_session` | #814 | RPC-SESSION-LIFECYCLE |
| rpc | `create_session_invite` | #814 | RPC-SESSION-ACCESS |
| rpc | `get_session_recap` | #814 | RPC-SESSION-RECAP |
| rpc | `get_session_runtime_snapshot` | #814 | RPC-SESSION-RUNTIME |
| rpc | `join_session_by_code` | #814 | RPC-SESSION-ACCESS |
| rpc | `leave_play_session` | #814 | RPC-SESSION-ACCESS |
| rpc | `resolve_session_invite` | #814 | RPC-SESSION-ACCESS |
| rpc | `revoke_session_invite` | #814 | RPC-SESSION-ACCESS |
| rpc | `save_session_recap_summary` | #814 | RPC-SESSION-RECAP |
| rpc | `set_session_player_presence` | #814 | RPC-SESSION-RUNTIME |
| rpc | `set_session_status` | #814 | RPC-SESSION-LIFECYCLE |
| edge | `session-media-token` | #836 |  |
| edge | `session-recap` | #837 |  |
| table | `projects` | #791 | Policy #792 |
| table | `session_players` | #791 | Policy #792 |
| table | `sessions` | #791 | Policy #792 |
| realtime | `postgres_changes channels and cleanup` | #796 |  |
| auth | `authenticated account/session transport` | #793 |  |

## Acceptance and negative tests (required, not executed)

- All12 exact RPC variants and2 Edge invokes preserve argument/error/decoder contracts; wrong user/GM/foreign session cannot mutate runtime.
- Runtime event subscriptions use exact table/event/session filters and removeChannel on unsubscribe; explicit resync reloads authoritative state. Snapshot-before-subscribe gap and overlapping fetch ordering require an explicit successor consistency fixture.
- Lobby ready is ephemeral broadcast with exacttopic/event/payload; spoofed ready userId cannot authorize gameplay.
- Media missing factory/token/server becomes degraded without blocking gameplay; viewer publication denied by media-plane access; local-only presence and reliable:false data behavior remain explicit.
- Contract fixture for apply_session_runtime_command: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for create_play_session: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for create_session_invite: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for get_session_recap: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for get_session_runtime_snapshot: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for join_session_by_code: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for leave_play_session: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for resolve_session_invite: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for revoke_session_invite: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for save_session_recap_summary: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for set_session_player_presence: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for set_session_status: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.

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
### edge: session-media-token

`src/infrastructure/session/media/media-token-client.ts:39` — literal-or-constant.

Exact call/query chain:
```ts
supabase.functions.invoke('session-media-token', {
      body: { sessionId },
    })
```

Enclosing operation: `src/infrastructure/session/media/media-token-client.ts:25`; complete request/default/result/error logic is in the declarations below and the snapshot.
### realtime-subscription: broadcast

`src/infrastructure/session/session-lobby-channel.ts:30` — literal-or-constant.

Exact call/query chain:
```ts
supabase
    .channel(topic)
    .on('broadcast', { event: 'ready' }, ({ payload }) => {
      if (disposed) return;
      const userId = typeof payload?.userId === 'string' ? payload.userId : null;
      if (!userId) return;
      onReady({ userId, ready: payload?.ready === true });
    })
```

Enclosing operation: `src/infrastructure/session/session-lobby-channel.ts:22`; complete request/default/result/error logic is in the declarations below and the snapshot.
### channel: topic

`src/infrastructure/session/session-lobby-channel.ts:30` — dynamic-expression.

Exact call/query chain:
```ts
supabase
    .channel(topic)
    .on('broadcast', { event: 'ready' }, ({ payload }) => {
      if (disposed) return;
      const userId = typeof payload?.userId === 'string' ? payload.userId : null;
      if (!userId) return;
      onReady({ userId, ready: payload?.ready === true });
    })
```

Enclosing operation: `src/infrastructure/session/session-lobby-channel.ts:22`; complete request/default/result/error logic is in the declarations below and the snapshot.
### realtime-subscribe: (status) => {
      if (status === 'SUBSCRIBED') resolve();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reject(new Error(`Lobby-Kanal: ${status}`));
      }
    }

`src/infrastructure/session/session-lobby-channel.ts:44` — dynamic-expression.

Exact call/query chain:
```ts
channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reject(new Error(`Lobby-Kanal: ${status}`));
      }
    })
```

Enclosing operation: `src/infrastructure/session/session-lobby-channel.ts:39`; complete request/default/result/error logic is in the declarations below and the snapshot.
### realtime-send: {
        type: 'broadcast',
        event: 'ready',
        payload: { userId: payload.userId, ready: payload.ready === true },
      }

`src/infrastructure/session/session-lobby-channel.ts:55` — dynamic-expression.

Exact call/query chain:
```ts
channel.send({
        type: 'broadcast',
        event: 'ready',
        payload: { userId: payload.userId, ready: payload.ready === true },
      })
```

Enclosing operation: `src/infrastructure/session/session-lobby-channel.ts:53`; complete request/default/result/error logic is in the declarations below and the snapshot.
### realtime-cleanup: channel

`src/infrastructure/session/session-lobby-channel.ts:64` — dynamic-expression.

Exact call/query chain:
```ts
supabase.removeChannel(channel)
```

Enclosing operation: `src/infrastructure/session/session-lobby-channel.ts:61`; complete request/default/result/error logic is in the declarations below and the snapshot.
### edge: session-recap

`src/infrastructure/session/session-recap-ai-service.ts:76` — literal-or-constant.

Exact call/query chain:
```ts
supabase.functions.invoke('session-recap', {
      body: { sessionId },
    })
```

Enclosing operation: `src/infrastructure/session/session-recap-ai-service.ts:75`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: save_session_recap_summary

`src/infrastructure/session/session-recap-ai-service.ts:104` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('save_session_recap_summary', {
        p_session_id: sessionId,
        p_summary_text: summaryText,
        p_status: status,
      })
```

Enclosing operation: `src/infrastructure/session/session-recap-ai-service.ts:98`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: get_session_recap

`src/infrastructure/session/session-recap-service.ts:29` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('get_session_recap', { p_session_id: sessionId })
```

Enclosing operation: `src/infrastructure/session/session-recap-service.ts:27`; complete request/default/result/error logic is in the declarations below and the snapshot.
### realtime-subscription: postgres_changes

`src/infrastructure/session/session-runtime-channel.ts:44` — literal-or-constant.

Exact call/query chain:
```ts
supabase
    .channel(topic)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
      () => {
        void refresh();
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'session_players',
        filter: `session_id=eq.${sessionId}`,
      },
      () => {
        void refresh();
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'session_events',
        filter: `session_id=eq.${sessionId}`,
      },
      () => {
        void refresh();
      },
    )
```

Enclosing operation: `src/infrastructure/session/session-runtime-channel.ts:26`; complete request/default/result/error logic is in the declarations below and the snapshot.
### realtime-subscription: postgres_changes

`src/infrastructure/session/session-runtime-channel.ts:44` — literal-or-constant.

Exact call/query chain:
```ts
supabase
    .channel(topic)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
      () => {
        void refresh();
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'session_players',
        filter: `session_id=eq.${sessionId}`,
      },
      () => {
        void refresh();
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'session_events',
        filter: `session_id=eq.${sessionId}`,
      },
      () => {
        void refresh();
      },
    )
```

Enclosing operation: `src/infrastructure/session/session-runtime-channel.ts:26`; complete request/default/result/error logic is in the declarations below and the snapshot.
### realtime-subscription: postgres_changes

`src/infrastructure/session/session-runtime-channel.ts:44` — literal-or-constant.

Exact call/query chain:
```ts
supabase
    .channel(topic)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
      () => {
        void refresh();
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'session_players',
        filter: `session_id=eq.${sessionId}`,
      },
      () => {
        void refresh();
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'session_events',
        filter: `session_id=eq.${sessionId}`,
      },
      () => {
        void refresh();
      },
    )
```

Enclosing operation: `src/infrastructure/session/session-runtime-channel.ts:26`; complete request/default/result/error logic is in the declarations below and the snapshot.
### channel: topic

`src/infrastructure/session/session-runtime-channel.ts:44` — dynamic-expression.

Exact call/query chain:
```ts
supabase
    .channel(topic)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
      () => {
        void refresh();
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'session_players',
        filter: `session_id=eq.${sessionId}`,
      },
      () => {
        void refresh();
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'session_events',
        filter: `session_id=eq.${sessionId}`,
      },
      () => {
        void refresh();
      },
    )
```

Enclosing operation: `src/infrastructure/session/session-runtime-channel.ts:26`; complete request/default/result/error logic is in the declarations below and the snapshot.
### realtime-subscribe: (status) => {
      if (status === 'SUBSCRIBED') resolve();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reject(new Error(`Realtime-Subscribe fehlgeschlagen: ${status}`));
      }
    }

`src/infrastructure/session/session-runtime-channel.ts:83` — dynamic-expression.

Exact call/query chain:
```ts
channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reject(new Error(`Realtime-Subscribe fehlgeschlagen: ${status}`));
      }
    })
```

Enclosing operation: `src/infrastructure/session/session-runtime-channel.ts:78`; complete request/default/result/error logic is in the declarations below and the snapshot.
### realtime-cleanup: channel

`src/infrastructure/session/session-runtime-channel.ts:97` — dynamic-expression.

Exact call/query chain:
```ts
supabase.removeChannel(channel)
```

Enclosing operation: `src/infrastructure/session/session-runtime-channel.ts:94`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: get_session_runtime_snapshot

`src/infrastructure/session/session-runtime-service.ts:90` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('get_session_runtime_snapshot', {
      p_session_id: sessionId,
    })
```

Enclosing operation: `src/infrastructure/session/session-runtime-service.ts:89`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: apply_session_runtime_command

`src/infrastructure/session/session-runtime-service.ts:107` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('apply_session_runtime_command', {
      p_session_id: input.sessionId,
      p_expected_revision: input.expectedRevision,
      p_kind: kind,
      p_payload: input.payload ?? {},
      p_idempotency_key: input.idempotencyKey ?? null,
    })
```

Enclosing operation: `src/infrastructure/session/session-runtime-service.ts:99`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: set_session_player_presence

`src/infrastructure/session/session-runtime-service.ts:133` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('set_session_player_presence', {
      p_session_id: sessionId,
      p_is_online: isOnline,
      p_expected_revision: expectedRevision ?? null,
    })
```

Enclosing operation: `src/infrastructure/session/session-runtime-service.ts:128`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth: session identity

`src/infrastructure/session/session-service.ts:67` — dynamic-expression.

Exact call/query chain:
```ts
supabase.auth.getSession()
```

Enclosing operation: `src/infrastructure/session/session-service.ts:64`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth: session identity

`src/infrastructure/session/session-service.ts:72` — dynamic-expression.

Exact call/query chain:
```ts
supabase.auth.getUser()
```

Enclosing operation: `src/infrastructure/session/session-service.ts:64`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: projects

`src/infrastructure/session/session-service.ts:84` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('projects')
      .select('gm_user_id')
      .eq('id', projectId)
      .maybeSingle()
```

Enclosing operation: `src/infrastructure/session/session-service.ts:82`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: session_players

`src/infrastructure/session/session-service.ts:142` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(this.playersTableName)
      .select('*')
      .eq('session_id', sessionId)
```

Enclosing operation: `src/infrastructure/session/session-service.ts:141`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: create_play_session

`src/infrastructure/session/session-service.ts:162` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('create_play_session', {
      p_project_id: projectId,
      p_name: payload.name,
    })
```

Enclosing operation: `src/infrastructure/session/session-service.ts:154`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: join_session_by_code

`src/infrastructure/session/session-service.ts:180` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('join_session_by_code', {
      p_code: code,
      p_character_id: payload.character_id ?? null,
    })
```

Enclosing operation: `src/infrastructure/session/session-service.ts:175`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: sessions

`src/infrastructure/session/session-service.ts:195` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(this.tableName)
      .select(SESSION_SAFE_COLUMNS)
      .eq('id', id)
      .single()
```

Enclosing operation: `src/infrastructure/session/session-service.ts:194`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: projects

`src/infrastructure/session/session-service.ts:213` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('projects')
      .select('id')
      .eq('gm_user_id', user.id)
```

Enclosing operation: `src/infrastructure/session/session-service.ts:210`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: sessions

`src/infrastructure/session/session-service.ts:226` — literal-or-constant.

Exact call/query chain:
```ts
supabase
        .from(this.tableName)
        .select(SESSION_SAFE_COLUMNS)
        .in('project_id', gmProjectIds)
        .neq('status', 'completed')
        .order('created_at', { ascending: false })
```

Enclosing operation: `src/infrastructure/session/session-service.ts:210`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: session_players

`src/infrastructure/session/session-service.ts:238` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(this.playersTableName)
      .select(`*, sessions!inner(${SESSION_SAFE_COLUMNS})`)
      .eq('user_id', user.id)
```

Enclosing operation: `src/infrastructure/session/session-service.ts:210`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: set_session_status

`src/infrastructure/session/session-service.ts:278` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('set_session_status', {
      p_session_id: id,
      p_status: status,
    })
```

Enclosing operation: `src/infrastructure/session/session-service.ts:271`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: leave_play_session

`src/infrastructure/session/session-service.ts:295` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('leave_play_session', {
      p_session_id: sessionId,
    })
```

Enclosing operation: `src/infrastructure/session/session-service.ts:292`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: sessions

`src/infrastructure/session/session-service.ts:314` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from(this.tableName).delete().eq('id', id)
```

Enclosing operation: `src/infrastructure/session/session-service.ts:307`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: create_session_invite

`src/infrastructure/session/session-service.ts:330` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('create_session_invite', {
      p_session_id: sessionId,
    })
```

Enclosing operation: `src/infrastructure/session/session-service.ts:328`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: resolve_session_invite

`src/infrastructure/session/session-service.ts:352` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('resolve_session_invite', {
      p_token: normalized,
    })
```

Enclosing operation: `src/infrastructure/session/session-service.ts:346`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: revoke_session_invite

`src/infrastructure/session/session-service.ts:367` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('revoke_session_invite', {
      p_token: normalized,
    })
```

Enclosing operation: `src/infrastructure/session/session-service.ts:361`; complete request/default/result/error logic is in the declarations below and the snapshot.

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

### src/infrastructure/session/media/media-token-client.ts:7

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

### src/infrastructure/session/media/media-token-client.ts:16

```ts
export type MediaTokenDegraded = {
  readonly ok: false;
  readonly degraded: true;
  readonly reason: 'media_service_unavailable' | 'forbidden' | 'unauthorized' | 'bad_request';
  readonly message: string;
};
```

### src/infrastructure/session/media/media-token-client.ts:23

```ts
export type MediaTokenResult = MediaTokenSuccess | MediaTokenDegraded;
```

### src/infrastructure/session/media/media-token-client.ts:25

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

  try {
    const { data, error } = await supabase.functions.invoke('session-media-token', {
      body: { sessionId },
    });
    if (error) {
      return {
        ok: false,
        degraded: true,
        reason: 'media_service_unavailable',
        message: error.message || 'Media-Token-Dienst nicht erreichbar.',
      };
    }
    const record = data as Record<string, unknown> | null;
    if (!record || typeof record !== 'object') {
      return {
        ok: false,
        degraded: true,
        reason: 'media_service_unavailable',
        message: 'Leere Media-Token-Antwort.',
      };
    }
    if (record.degraded === true || record.ok === false) {
      const reason =
        record.reason === 'forbidden' ||
        record.reason === 'unauthorized' ||
        record.reason === 'bad_request'
          ? record.reason
          : 'media_service_unavailable';
      return {
        ok: false,
        degraded: true,
        reason,
        message:
          typeof record.message === 'string'
            ? record.message
            : 'Media plane degraded.',
      };
    }
    const token = typeof record.token === 'string' ? record.token : '';
    const url = typeof record.url === 'string' ? record.url : '';
    const roomId = typeof record.roomId === 'string' ? record.roomId : '';
    const expiresAt =
      typeof record.expiresAt === 'string' ? record.expiresAt : '';
    const ttlSeconds =
      typeof record.ttlSeconds === 'number' ? record.ttlSeconds : 0;
    if (!token || !url || !roomId) {
      return {
        ok: false,
        degraded: true,
        reason: 'media_service_unavailable',
        message: 'Media-Token unvollständig.',
      };
    }
    return { ok: true, token, url, roomId, expiresAt, ttlSeconds };
  } catch (error) {
    return {
      ok: false,
      degraded: true,
      reason: 'media_service_unavailable',
      message: error instanceof Error ? error.message : 'Media-Token-Fehler.',
    };
  }
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

### src/infrastructure/session/session-lobby-channel.ts:10

```ts
export type LobbyReadyPayload = {
  readonly userId: string;
  readonly ready: boolean;
};
```

### src/infrastructure/session/session-lobby-channel.ts:15

```ts
export type LobbyReadyListener = (payload: LobbyReadyPayload) => void;
```

### src/infrastructure/session/session-lobby-channel.ts:17

```ts
export type SessionLobbySubscription = {
  sendReady: (payload: LobbyReadyPayload) => Promise<void>;
  unsubscribe: () => Promise<void>;
};
```

### src/infrastructure/session/session-lobby-channel.ts:22

```ts
export async function subscribeSessionLobbyReady(
  sessionId: string,
  onReady: LobbyReadyListener,
): Promise<SessionLobbySubscription> {
  let channel: RealtimeChannel | null = null;
  let disposed = false;

  const topic = `session-lobby:${sessionId}`;
  channel = supabase
    .channel(topic)
    .on('broadcast', { event: 'ready' }, ({ payload }) => {
      if (disposed) return;
      const userId = typeof payload?.userId === 'string' ? payload.userId : null;
      if (!userId) return;
      onReady({ userId, ready: payload?.ready === true });
    });

  await new Promise<void>((resolve, reject) => {
    if (!channel) {
      reject(new Error('Lobby-Kanal fehlt'));
      return;
    }
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reject(new Error(`Lobby-Kanal: ${status}`));
      }
    });
  });

  return {
    sendReady: async (payload) => {
      if (!channel || disposed) return;
      await channel.send({
        type: 'broadcast',
        event: 'ready',
        payload: { userId: payload.userId, ready: payload.ready === true },
      });
    },
    unsubscribe: async () => {
      disposed = true;
      if (channel) {
        await supabase.removeChannel(channel);
        channel = null;
      }
    },
  };
}
```

### src/infrastructure/session/session-recap-ai-service.ts:8

```ts
export type EpisodeSummaryStatus = 'none' | 'draft' | 'approved';
```

### src/infrastructure/session/session-recap-ai-service.ts:10

```ts
export type SessionRecapAiGenerateResult = {
  readonly summaryText: string;
  readonly summaryStatus: EpisodeSummaryStatus;
  readonly provider: string;
  readonly model: string;
};
```

### src/infrastructure/session/session-recap-ai-service.ts:130

```ts
export const sessionRecapAiService = new SessionRecapAiService();
```

### src/infrastructure/session/session-recap-service.ts:12

```ts
export type SessionRecapDto = {
  readonly sessionId: string;
  readonly summaryText: string | null;
  /** #573 — none|draft|approved (players only receive approved text). */
  readonly summaryStatus: 'none' | 'draft' | 'approved';
  readonly highlights: readonly RecapHighlightLine[];
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
};
```

### src/infrastructure/session/session-recap-service.ts:54

```ts
export const sessionRecapService = new SessionRecapService();
```

### src/infrastructure/session/session-runtime-channel.ts:11

```ts
export type SessionRuntimeListener = (state: SessionRuntimeState) => void;
```

### src/infrastructure/session/session-runtime-channel.ts:13

```ts
export interface SessionRuntimeSubscription {
  /** Latest authoritative snapshot after connect or resync. */
  getState: () => SessionRuntimeState | null;
  /** Force snapshot reload + keep channel (reconnect path). */
  resync: () => Promise<SessionRuntimeState>;
  unsubscribe: () => Promise<void>;
}
```

### src/infrastructure/session/session-runtime-channel.ts:26

```ts
export async function subscribeSessionRuntime(
  sessionId: string,
  onChange: SessionRuntimeListener,
): Promise<SessionRuntimeSubscription> {
  let current: SessionRuntimeState | null = await sessionRuntimeService.getSnapshot(sessionId);
  onChange(current);

  let channel: RealtimeChannel | null = null;
  let disposed = false;

  const refresh = async (): Promise<SessionRuntimeState> => {
    const next = await sessionRuntimeService.getSnapshot(sessionId);
    current = next;
    if (!disposed) onChange(next);
    return next;
  };

  const topic = `session-runtime:${sessionId}`;
  channel = supabase
    .channel(topic)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
      () => {
        void refresh();
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'session_players',
        filter: `session_id=eq.${sessionId}`,
      },
      () => {
        void refresh();
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'session_events',
        filter: `session_id=eq.${sessionId}`,
      },
      () => {
        void refresh();
      },
    );

  await new Promise<void>((resolve, reject) => {
    if (!channel) {
      reject(new Error('Realtime-Kanal konnte nicht erstellt werden'));
      return;
    }
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reject(new Error(`Realtime-Subscribe fehlgeschlagen: ${status}`));
      }
    });
  });

  return {
    getState: () => current,
    resync: refresh,
    unsubscribe: async () => {
      disposed = true;
      if (channel) {
        await supabase.removeChannel(channel);
        channel = null;
      }
    },
  };
}
```

### src/infrastructure/session/session-runtime-service.ts:64

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

### src/infrastructure/session/session-runtime-service.ts:152

```ts
export const sessionRuntimeService = new SessionRuntimeService();
```

### src/infrastructure/session/session-service.ts:376

```ts
export const sessionService = new SessionService();
```


## Remaining backend helper operations

### src/infrastructure/session/session-recap-ai-service.ts:75

```ts
async generateDraft(sessionId: string): Promise<SessionRecapAiGenerateResult> {
    const { data, error } = await supabase.functions.invoke('session-recap', {
      body: { sessionId },
    });
    if (error) {
      const serverMessage = await getFunctionErrorMessage(error);
      throw new Error(
        serverMessage ??
          'Zusammenfassung konnte nicht generiert werden. Bitte manuell schreiben.',
      );
    }
    const response = parseFunctionResponse(data);
    if (response.status !== 'ok') {
      throw new Error(response.message);
    }
    return {
      summaryText: response.summaryText,
      summaryStatus: response.summaryStatus === 'approved' ? 'approved' : 'draft',
      provider: response.provider,
      model: response.model,
    };
  }
```

### src/infrastructure/session/session-recap-ai-service.ts:98

```ts
async saveSummary(
    sessionId: string,
    summaryText: string,
    status: 'draft' | 'approved',
  ): Promise<{ summaryText: string | null; summaryStatus: EpisodeSummaryStatus }> {
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('save_session_recap_summary', {
        p_session_id: sessionId,
        p_summary_text: summaryText,
        p_status: status,
      }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Speichern Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Zusammenfassung konnte nicht gespeichert werden');
    }
    if (!isRecord(data)) {
      return { summaryText, summaryStatus: status };
    }
    return {
      summaryText: typeof data.summaryText === 'string' ? data.summaryText : summaryText,
      summaryStatus:
        data.summaryStatus === 'approved'
          ? 'approved'
          : data.summaryStatus === 'draft'
            ? 'draft'
            : 'none',
    };
  }
```

### src/infrastructure/session/session-recap-service.ts:27

```ts
async getBySessionId(sessionId: string): Promise<SessionRecapDto | null> {
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('get_session_recap', { p_session_id: sessionId }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Recap Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Recap konnte nicht geladen werden');
    }
    if (data == null) return null;
    if (!isRecord(data)) {
      throw new Error('Ungültige Recap-Antwort');
    }
    const statusRaw = typeof data.summaryStatus === 'string' ? data.summaryStatus : 'none';
    const summaryStatus =
      statusRaw === 'approved' || statusRaw === 'draft' ? statusRaw : 'none';
    return {
      sessionId: typeof data.sessionId === 'string' ? data.sessionId : sessionId,
      summaryText: typeof data.summaryText === 'string' ? data.summaryText : null,
      summaryStatus,
      highlights: parsePersistedRecapHighlightLines(data.highlightLines),
      createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
    };
  }
```

### src/infrastructure/session/session-runtime-service.ts:89

```ts
async getSnapshot(sessionId: string): Promise<SessionRuntimeState> {
    const { data, error } = await supabase.rpc('get_session_runtime_snapshot', {
      p_session_id: sessionId,
    });
    if (error || !data) {
      throw new Error(error?.message ?? 'Runtime-Snapshot fehlgeschlagen');
    }
    return mapSnapshotJson(data as SnapshotJson);
  }
```

### src/infrastructure/session/session-runtime-service.ts:99

```ts
async applyCommand(input: {
    sessionId: string;
    expectedRevision: number;
    kind: SessionEventKind | string;
    payload?: Record<string, unknown>;
    idempotencyKey?: string | null;
  }): Promise<SessionRuntimeState> {
    const kind = assertSessionEventKind(input.kind);
    const { data, error } = await supabase.rpc('apply_session_runtime_command', {
      p_session_id: input.sessionId,
      p_expected_revision: input.expectedRevision,
      p_kind: kind,
      p_payload: input.payload ?? {},
      p_idempotency_key: input.idempotencyKey ?? null,
    });

    if (error) {
      if (isStaleRpcError(error.message)) {
        const snap = await this.getSnapshot(input.sessionId);
        throw new StaleRuntimeRevisionError(input.expectedRevision, snap.revision);
      }
      throw new Error(error.message);
    }
    if (!data) {
      throw new Error('Runtime-Befehl lieferte kein Ergebnis');
    }
    return mapSnapshotJson(data as SnapshotJson);
  }
```

### src/infrastructure/session/session-runtime-service.ts:128

```ts
async setPresence(
    sessionId: string,
    isOnline: boolean,
    expectedRevision?: number | null,
  ): Promise<SessionRuntimeState> {
    const { data, error } = await supabase.rpc('set_session_player_presence', {
      p_session_id: sessionId,
      p_is_online: isOnline,
      p_expected_revision: expectedRevision ?? null,
    });
    if (error) {
      if (isStaleRpcError(error.message)) {
        const snap = await this.getSnapshot(sessionId);
        throw new StaleRuntimeRevisionError(expectedRevision ?? -1, snap.revision);
      }
      throw new Error(error.message);
    }
    if (!data) {
      throw new Error('Presence-Update fehlgeschlagen');
    }
    return mapSnapshotJson(data as SnapshotJson);
  }
```

### src/infrastructure/session/session-service.ts:64

```ts
private async requireAuthUser(): Promise<{ id: string }> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.id) return session.user;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) return user;

    if (isLocalAdminSession()) {
      return { id: LOCAL_ADMIN_USER_ID };
    }

    throw new Error('User not authenticated');
  }
```

### src/infrastructure/session/session-service.ts:82

```ts
private async resolveGmUserId(projectId: string | null): Promise<string> {
    if (!projectId) return '';
    const { data, error } = await supabase
      .from('projects')
      .select('gm_user_id')
      .eq('id', projectId)
      .maybeSingle();
    if (error || !data) return '';
    return typeof data.gm_user_id === 'string' ? data.gm_user_id : '';
  }
```

### src/infrastructure/session/session-service.ts:141

```ts
private async loadPlayers(sessionId: string): Promise<SessionPlayerDto[]> {
    const { data, error } = await supabase
      .from(this.playersTableName)
      .select('*')
      .eq('session_id', sessionId);

    if (error) {
      console.error('Failed to load session players:', error);
      return [];
    }
    return (data ?? []) as SessionPlayerDto[];
  }
```

### src/infrastructure/session/session-service.ts:154

```ts
async createSession(payload: CreateSessionDto): Promise<SessionVm> {
    await this.requireAuthUser();

    const projectId = payload.project_id || payload.adventure_id;
    if (!projectId) {
      throw new Error('project_id ist erforderlich, um eine Session zu erstellen');
    }

    const { data, error } = await supabase.rpc('create_play_session', {
      p_project_id: projectId,
      p_name: payload.name,
    });

    if (error || !data) {
      throw new Error(`Failed to create session: ${error?.message ?? 'unknown'}`);
    }

    const dto = await this.mapRowToDto(data as SessionRow);
    return this.mapToViewModel(dto, []);
  }
```

### src/infrastructure/session/session-service.ts:175

```ts
async joinSession(payload: JoinSessionDto): Promise<SessionVm> {
    await this.requireAuthUser();

    const code = normalizeSessionJoinCode(payload.code);

    const { data, error } = await supabase.rpc('join_session_by_code', {
      p_code: code,
      p_character_id: payload.character_id ?? null,
    });

    if (error || !data) {
      throw new Error(error?.message || 'Session nicht gefunden');
    }

    const dto = await this.mapRowToDto(data as SessionRow);
    const players = await this.loadPlayers(dto.id);
    return this.mapToViewModel(dto, players);
  }
```

### src/infrastructure/session/session-service.ts:194

```ts
async getSessionById(id: string): Promise<SessionVm> {
    const { data: session, error: sessionError } = await supabase
      .from(this.tableName)
      .select(SESSION_SAFE_COLUMNS)
      .eq('id', id)
      .single();

    if (sessionError || !session) {
      throw new Error('Session not found');
    }

    const dto = await this.mapRowToDto(session as unknown as SessionRow);
    const players = await this.loadPlayers(id);
    return this.mapToViewModel(dto, players);
  }
```

### src/infrastructure/session/session-service.ts:210

```ts
async getUserSessions(): Promise<SessionVm[]> {
    const user = await this.requireAuthUser();

    const { data: gmProjects, error: gmProjectsError } = await supabase
      .from('projects')
      .select('id')
      .eq('gm_user_id', user.id);

    if (gmProjectsError) {
      throw new Error(`Failed to fetch GM projects: ${gmProjectsError.message}`);
    }

    const gmProjectIds = (gmProjects ?? []).map((p) => p.id as string);

    let gmSessions: SessionRow[] = [];
    if (gmProjectIds.length > 0) {
      const { data, error } = await supabase
        .from(this.tableName)
        .select(SESSION_SAFE_COLUMNS)
        .in('project_id', gmProjectIds)
        .neq('status', 'completed')
        .order('created_at', { ascending: false });
      if (error) {
        throw new Error(`Failed to fetch GM sessions: ${error.message}`);
      }
      gmSessions = (data ?? []) as unknown as SessionRow[];
    }

    const { data: playerRecords, error: playerError } = await supabase
      .from(this.playersTableName)
      .select(`*, sessions!inner(${SESSION_SAFE_COLUMNS})`)
      .eq('user_id', user.id);

    if (playerError) {
      console.error('Failed to fetch player sessions:', playerError);
    }

    type PlayerSessionJoinRow = { sessions: SessionRow | SessionRow[] | null };
    const playerSessions = ((playerRecords || []) as PlayerSessionJoinRow[])
      .map((record) => record.sessions)
      .flatMap((session) => (Array.isArray(session) ? session : session ? [session] : []))
      .filter((session) => session.status !== 'completed');

    const allSessionIds = new Set<string>();
    const combined: SessionRow[] = [];
    [...gmSessions, ...playerSessions].forEach((session) => {
      if (!allSessionIds.has(session.id)) {
        allSessionIds.add(session.id);
        combined.push(session);
      }
    });

    return Promise.all(
      combined.map(async (session) => {
        const dto = await this.mapRowToDto(session);
        const players = await this.loadPlayers(session.id);
        return this.mapToViewModel(dto, players);
      }),
    );
  }
```

### src/infrastructure/session/session-service.ts:271

```ts
async updateSessionStatus(
    id: string,
    status: PlaySessionStatus,
  ): Promise<SessionVm> {
    const current = await this.getSessionById(id);
    assertPlaySessionStatusTransition(current.status, status);

    const { data, error } = await supabase.rpc('set_session_status', {
      p_session_id: id,
      p_status: status,
    });

    if (error || !data) {
      throw new Error(`Failed to update session: ${error?.message ?? 'unknown'}`);
    }

    const dto = await this.mapRowToDto(data as SessionRow);
    const players = await this.loadPlayers(id);
    return this.mapToViewModel(dto, players);
  }
```

### src/infrastructure/session/session-service.ts:292

```ts
async leaveSession(sessionId: string): Promise<void> {
    await this.requireAuthUser();

    const { error } = await supabase.rpc('leave_play_session', {
      p_session_id: sessionId,
    });

    if (error) {
      throw new Error(`Failed to leave session: ${error.message}`);
    }
  }
```

### src/infrastructure/session/session-service.ts:307

```ts
async deleteSession(sessionId: string): Promise<void> {
    await this.requireAuthUser();
    const id = sessionId.trim();
    if (!id) {
      throw new Error('Session-ID fehlt');
    }

    const { error } = await supabase.from(this.tableName).delete().eq('id', id);

    if (error) {
      throw new Error(
        error.message.includes('row-level security')
          ? 'Nur der Gamemaster kann Sessions löschen.'
          : `Session konnte nicht gelöscht werden: ${error.message}`,
      );
    }
  }
```

### src/infrastructure/session/session-service.ts:328

```ts
async createSessionInvite(sessionId: string): Promise<SessionInviteCreateResult> {
    await this.requireAuthUser();
    const { data, error } = await supabase.rpc('create_session_invite', {
      p_session_id: sessionId,
    });
    if (error) {
      throw new Error(`Einladung konnte nicht erstellt werden: ${error.message}`);
    }
    const mapped = mapInviteCreatePayload(data);
    if (!mapped) {
      throw new Error('Einladung konnte nicht erstellt werden: ungültige Server-Antwort');
    }
    return mapped;
  }
```

### src/infrastructure/session/session-service.ts:346

```ts
async resolveSessionInvite(token: string): Promise<SessionInviteResolveResult> {
    await this.requireAuthUser();
    const normalized = normalizeInviteToken(token);
    if (!normalized) {
      return { ok: false, errorCode: 'missing_token' };
    }
    const { data, error } = await supabase.rpc('resolve_session_invite', {
      p_token: normalized,
    });
    if (error) {
      throw new Error(`Einladung konnte nicht gelesen werden: ${error.message}`);
    }
    return mapInviteResolvePayload(data);
  }
```

### src/infrastructure/session/session-service.ts:361

```ts
async revokeSessionInvite(token: string): Promise<void> {
    await this.requireAuthUser();
    const normalized = normalizeInviteToken(token);
    if (!normalized) {
      throw new Error('Token fehlt');
    }
    const { error } = await supabase.rpc('revoke_session_invite', {
      p_token: normalized,
    });
    if (error) {
      throw new Error(`Einladung konnte nicht widerrufen werden: ${error.message}`);
    }
  }
```


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
| `src/infrastructure/session/host-session-adapter.ts` | `57c52ff948f0e5169f302c2de0a58e4eabffa35668fb121605533bcddbb3d4fb` |
| `src/infrastructure/session/host-session-ports.contract.ts` | `b7d49eee90da55c7a0acadd765ddb202527fc003789f855ae910425e073f928f` |
| `src/infrastructure/session/live-session-access.resolver.ts` | `88276a0afb9522e2dbb75f98959562ace873f33662ec2dea668428f91a762b9a` |
| `src/infrastructure/session/media/index.ts` | `ba6906bf57e04303b283786671d0ae7e0024949e512d59b3b783289e6ba19155` |
| `src/infrastructure/session/media/livekit-media-plane-adapter.ts` | `ba41c95f3816b79818a9c312c056ec896ac75fd4633dba27954cdcdb797b381d` |
| `src/infrastructure/session/media/media-plane-adapter.ts` | `1dbdf0f7c75c1edc435fb629d5029a1c04806a5a6cbcf9b037ad8a620dcc34cd` |
| `src/infrastructure/session/media/media-token-client.ts` | `07e4692a4eb42ab86393e808e495383f3c7348d8a2699881dc4590869cc90bd6` |
| `src/infrastructure/session/media/memory-media-plane-adapter.ts` | `31fc7cee75c49c1e3af09b784e4a8dad3446bbe5ae5ddd6f7b2c9aee142dc5be` |
| `src/infrastructure/session/media/memory-media-plane-bus.ts` | `1616d229067f513a12c67319aec28649e3a0afdf77779f9071b595dc024ff193` |
| `src/infrastructure/session/media/session-media-plane.ts` | `ce8d3ec690f83745646400443d7870cd96383e341628a2d8f017e2d391fbb225` |
| `src/infrastructure/session/session-lobby-channel.ts` | `16cca2d213514c81493ffa0d9e5def922b0708c38cda7e8eb374b20e1f28b8c9` |
| `src/infrastructure/session/session-recap-ai-service.ts` | `dffb89748b308636c99dee90d2af597de0a0fdbb995359bad085d6f799f5987d` |
| `src/infrastructure/session/session-recap-service.ts` | `30c4a639e8e6daf815eb1cb137744c0513fcb3ed20cbb58f2c0781b928bcb7f9` |
| `src/infrastructure/session/session-runtime-channel.ts` | `fec3f16b9ff82cead9d8433b0b1b4a4038d13c2dd6e7458c4a0c55413c77483c` |
| `src/infrastructure/session/session-runtime-service.ts` | `8169475c50d9fabdba387b0d9f8039f3fc0416c5280df537237efa2dc8deb711` |
| `src/infrastructure/session/session-service.ts` | `d2f1e89fca1ef75c6b6c633ce8e9169801d3394e52912661c07457511ec4fdac` |
| `src/lib/authenticatedUser.ts` | `c822140996ae4d318c19d2ccb5318d77f2ba4d302bdfbcb50a79420a7ef70d74` |
| `src/lib/localAdmin.ts` | `3a28dec23e85f25ed3e70682bc6e7f8c6b55e81dbbefdd1f6a837f68ac80d6b5` |
| `src/lib/networkTimeout.ts` | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `src/lib/supabase.ts` | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

