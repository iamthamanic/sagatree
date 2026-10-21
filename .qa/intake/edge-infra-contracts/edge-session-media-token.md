# Edge contract: session-media-token

**Status: SPEC; current branch source verified.** Implementation issue: **#836**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [edge-session-media-token.json](source-contracts/edge-session-media-token.json) (SHA-256 `39e25e0cfd382658f0435f4997eb6f9caa0e56dfe079a11880d4cc55886ba919`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Exposure and purpose

**allowlisted-worker** — Current branch mount; a successor cutover still requires gates and contract tests.

Mint short-lived LiveKit room JWTs for active project members, with degraded gameplay-preserving responses.

/auth/v1/user identity -> sessions.project_id -> project_members(status=active,user_id=caller). Actual code has no session_players fallback despite its comment. Roles gm->gamemaster and observer->viewer; unsupported role denied. Capabilities are loaded as null/empty, not trusted from client.

## Request variants, fields and defaults

- **body:** {sessionId:string(trimmed,nonempty),ttlSeconds?:number}; no UUID format validation and no action required
- **ttl:** Math.min(300,Math.max(30,Math.floor(value))), default120 for non-number; non-finite numeric values are not separately rejected

## Success and error contracts

- **token:** {ok:true,token:string,url:string,roomId:string,expiresAt:ISO,ttlSeconds:number,grant:{canPublish:boolean,canSubscribe:boolean,receiveOnly:boolean}}
- **claims:** HS256; iss=API key, sub/name='user:'+userId, iat=now, nbf=now-10, exp=now+ttl; video.roomJoin=true, room='sagatree-session-'+sessionId; player/GM publish+subscribe+data; viewer receive-only

- 405 {error:'Method not allowed'}; 400 bad JSON or missing sessionId; 401 unauthorized; 403 no active membership or unsupported role
- Errors except405 are {ok:false,degraded:true,reason:'bad_request'|'unauthorized'|'forbidden'|'media_service_unavailable',message:string}; missing Supabase/service-role/LiveKit config503
- HTTP/storage failures that throw, JSON null and non-finite TTL are not covered by a worker-wide catch; do not claim a universal normalized500

## Side effects and transaction boundaries

- Reads auth/sessions/project_members; signs locally with LIVEKIT_API_SECRET; no DB writes and no outbound LiveKit request

## Quota, environment and transport


```json
{
  "kind": "none",
  "scope": "No worker-specific quota in source"
}
```

Auth/membership fetches have no explicit abort timeout; dispatcher caps worker at300s. Client media adapter treats structured degraded failures as media unavailable while gameplay remains usable.

- `CHARACTER_AI_ALLOWED_ORIGIN`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `LIVEKIT_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

Explicit abort call sites (dynamic values resolve in the linked helper declaration):

None in the reviewed source.

## Exact environment defaults and configuration resolution

### DEFAULT_CORS_METHODS

`supabase/functions/_shared/cors.ts:9`

```ts
DEFAULT_CORS_METHODS = 'GET, POST, PUT, DELETE, OPTIONS'
```

### DEFAULT_CORS_ALLOW_HEADERS

`supabase/functions/_shared/cors.ts:10`

```ts
DEFAULT_CORS_ALLOW_HEADERS =
  'authorization, x-client-info, apikey, content-type'
```

### readConfiguredOrigin

`supabase/functions/_shared/cors.ts:34`

```ts
function readConfiguredOrigin(envKeys: string[]): string {
  for (const key of envKeys) {
    const value = Deno.env.get(key)?.trim() ?? '';
    if (value) return value;
  }
  return '';
}
```

### CORS_OPTS

`supabase/functions/session-media-token/index.ts:20`

```ts
CORS_OPTS: CorsOptions = {
  methods: 'POST, OPTIONS',
  missingOriginPolicy: 'configured-or-star',
}
```

### DEFAULT_TTL_SECONDS

`supabase/functions/session-media-token/index.ts:25`

```ts
DEFAULT_TTL_SECONDS = 120
```

### readEnv

`supabase/functions/session-media-token/index.ts:40`

```ts
function readEnv(name: string): string {
  return Deno.env.get(name)?.trim() ?? '';
}
```


## Dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| http-host | `authenticated HTTP transport` | #795 |  |
| auth | `account identity` | #793 |  |
| table | `project_members` | #791 | Policy #792 |
| table | `sessions` | #791 | Policy #792 |

## CORS transport

handleOptions returns204. Default methods GET,POST,PUT,DELETE,OPTIONS and headers authorization,x-client-info,apikey,content-type with Vary:Origin. First nonempty envKeys value wins; default CHARACTER_AI_ALLOWED_ORIGIN. Explicit star returns star; matching CSV origin echoed; localhost allowed if unconfigured or opt-in. Unmatched origin omits header unless configured-or-star, which emits configured raw value or star. CORS never supplies account authorization.

```ts
CORS_OPTS: CorsOptions = {
  methods: 'POST, OPTIONS',
  missingOriginPolicy: 'configured-or-star',
}
```


## Acceptance and negative tests (required, not executed)

- Distinct active player/GM/viewer accounts receive only server-derived room/identity/grants; foreign account403 and caller-supplied role/capabilities/room ignored.
- Decode JWT and verify HS256 signature, iss/sub/nbf/iat/exp plus room; TTL omitted120,1->30,999->300.
- No project_members row403 even if legacy session_players fixture exists; inactive member403.
- Missing LIVEKIT_URL/API_KEY/API_SECRET503 degraded and no secret values in response; gameplay state unchanged.
- Record null-body/nonfinite-TTL and network-exception source gaps as required successor input/error tests.

## Observed legacy defects and explicit successor decisions

- No explicit fetch timeout, no worker-wide exception normalization, no finite TTL guard; source verification does not approve those gaps.

## All adapter call sites

### src/infrastructure/session/media/media-token-client.ts:39


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


## Exact ordered operations

### session-media-token:handler

Predicate: `Complete handler with ordered method/auth/body guards`. Source: `supabase/functions/session-media-token/index.ts:111`.


```ts
serve(async (req: Request) => {
  const optionsResponse = handleOptions(req, CORS_OPTS);
  if (optionsResponse) return optionsResponse;

  if (req.method !== 'POST') {
    return json(req, { error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = readEnv('SUPABASE_URL');
  const anonKey = readEnv('SUPABASE_ANON_KEY');
  const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey) {
    return json(
      req,
      {
        ok: false,
        degraded: true,
        reason: 'media_service_unavailable',
        message: 'Supabase config fehlt.',
      },
      503,
    );
  }

  const userId = await getUserId(req, supabaseUrl, anonKey);
  if (!userId) {
    return json(
      req,
      {
        ok: false,
        degraded: true,
        reason: 'unauthorized',
        message: 'Authentifizierung erforderlich.',
      },
      401,
    );
  }

  let body: JsonRecord;
  try {
    body = (await req.json()) as JsonRecord;
  } catch {
    return json(
      req,
      {
        ok: false,
        degraded: true,
        reason: 'bad_request',
        message: 'Ungültiger JSON-Body.',
      },
      400,
    );
  }

  const sessionId =
    typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  if (!sessionId) {
    return json(
      req,
      {
        ok: false,
        degraded: true,
        reason: 'bad_request',
        message: 'sessionId fehlt.',
      },
      400,
    );
  }

  if (!serviceRoleKey) {
    return json(
      req,
      {
        ok: false,
        degraded: true,
        reason: 'media_service_unavailable',
        message: 'Membership lookup nicht konfiguriert.',
      },
      503,
    );
  }

  const membership = await loadMembership({
    supabaseUrl,
    serviceRoleKey,
    sessionId,
    userId,
  });
  if (!membership) {
    return json(
      req,
      {
        ok: false,
        degraded: true,
        reason: 'forbidden',
        message: 'Keine aktive Session-Mitgliedschaft.',
      },
      403,
    );
  }

  const grant = resolveEdgeMediaGrant({
    role: membership.role,
    capabilities: membership.capabilities ?? [],
  });
  if (!grant || !grant.canSubscribe) {
    return json(
      req,
      {
        ok: false,
        degraded: true,
        reason: 'forbidden',
        message: 'Rolle darf Media-Token nicht beziehen.',
      },
      403,
    );
  }

  const apiKey = readEnv('LIVEKIT_API_KEY');
  const apiSecret = readEnv('LIVEKIT_API_SECRET');
  const livekitUrl = readEnv('LIVEKIT_URL');
  if (!apiKey || !apiSecret || !livekitUrl) {
    return json(
      req,
      {
        ok: false,
        degraded: true,
        reason: 'media_service_unavailable',
        message:
          'LiveKit nicht konfiguriert — Session läuft ohne Media Plane weiter.',
      },
      503,
    );
  }

  const ttlRaw =
    typeof body.ttlSeconds === 'number' ? body.ttlSeconds : DEFAULT_TTL_SECONDS;
  const ttlSeconds = Math.min(
    MAX_TTL_SECONDS,
    Math.max(30, Math.floor(ttlRaw)),
  );
  const roomId = deriveMediaRoomId(sessionId);
  const identity = `user:${userId}`;

  const minted = await mintLiveKitAccessToken({
    apiKey,
    apiSecret,
    identity,
    roomName: roomId,
    ttlSeconds,
    grant,
  });

  return json(req, {
    ok: true,
    token: minted.token,
    url: livekitUrl,
    roomId,
    expiresAt: minted.expiresAt,
    ttlSeconds,
    grant: {
      canPublish: grant.canPublish,
      canSubscribe: grant.canSubscribe,
      receiveOnly: grant.receiveOnly,
    },
  });
});
```


## Exact type declarations

### CorsOptions

`supabase/functions/_shared/cors.ts:13`

```ts
export type CorsOptions = {
  /** Override Allow-Methods (e.g. "POST, OPTIONS" for POST-only functions). */
  methods?: string;
  allowHeaders?: string;
  /**
   * Env keys tried in order for the allowlist CSV (or explicit `*`).
   * Default: CHARACTER_AI_ALLOWED_ORIGIN
   */
  envKeys?: string[];
  /** When true (default), include Content-Type: application/json on CORS header bags. */
  includeJsonContentType?: boolean;
  /**
   * When origin does not match allowlist/localhost:
   * - omit (default): do not set Access-Control-Allow-Origin (fail-closed)
   * - configured-or-star: set configured value or `*` (legacy meshy fallback)
   */
  missingOriginPolicy?: 'omit' | 'configured-or-star';
  /** When true, echo localhost even if an allowlist env is set (legacy meshy). */
  allowLocalhostWhenConfigured?: boolean;
};
```

### EdgeSessionRole

`supabase/functions/_shared/session-media-token.ts:9`

```ts
export type EdgeSessionRole = 'player' | 'gamemaster' | 'viewer';
```

### EdgeMediaGrant

`supabase/functions/_shared/session-media-token.ts:11`

```ts
export type EdgeMediaGrant = {
  canPublish: boolean;
  canSubscribe: boolean;
  canPublishData: boolean;
  receiveOnly: boolean;
};
```

### JsonRecord

`supabase/functions/session-media-token/index.ts:28`

```ts
type JsonRecord = Record<string, unknown>;
```

### MembershipRow

`supabase/functions/session-media-token/index.ts:59`

```ts
type MembershipRow = {
  user_id: string;
  role: string;
  capabilities: string[] | null;
  character_id: string | null;
};
```


## Exact validation, defaults and helper behavior

### DEFAULT_CORS_METHODS

`supabase/functions/_shared/cors.ts:9`

```ts
DEFAULT_CORS_METHODS = 'GET, POST, PUT, DELETE, OPTIONS'
```

### DEFAULT_CORS_ALLOW_HEADERS

`supabase/functions/_shared/cors.ts:10`

```ts
DEFAULT_CORS_ALLOW_HEADERS =
  'authorization, x-client-info, apikey, content-type'
```

### CORS_OPTS

`supabase/functions/session-media-token/index.ts:20`

```ts
CORS_OPTS: CorsOptions = {
  methods: 'POST, OPTIONS',
  missingOriginPolicy: 'configured-or-star',
}
```

### DEFAULT_TTL_SECONDS

`supabase/functions/session-media-token/index.ts:25`

```ts
DEFAULT_TTL_SECONDS = 120
```

### MAX_TTL_SECONDS

`supabase/functions/session-media-token/index.ts:26`

```ts
MAX_TTL_SECONDS = 300
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `src/infrastructure/session/media/media-token-client.ts` | `07e4692a4eb42ab86393e808e495383f3c7348d8a2699881dc4590869cc90bd6` |
| `supabase/functions/_shared/cors.ts` | `f8286c91d79fa5fc5cfea2fa47081916523fa7a440f234aecd9a47c6a8cf5b38` |
| `supabase/functions/_shared/edge-dispatcher-allowlist.ts` | `8fab25a3d5e0d2324cba6143517aed98c7f635423b789406a0da4e9bd1f51370` |
| `supabase/functions/_shared/edge-jwt-gate.ts` | `14a871697b051b7fcbee09dbce1dee8bc8ed5ea6a6eca0bec7b2e771b32d0f0c` |
| `supabase/functions/_shared/session-media-token.ts` | `4300bfa0eed6594041bf78d336df005eb2281e3c964adc43edc2c10ca37ffdf4` |
| `supabase/functions/main/index.ts` | `92f3bf56bf3c776e01595d980246079c4a9f8775e417959abea9d7da003bc53e` |
| `supabase/functions/session-media-token/index.ts` | `1417d7b81c85612f03000ebca2f55ff852565a728742c725d0eda7addd0f019c` |

