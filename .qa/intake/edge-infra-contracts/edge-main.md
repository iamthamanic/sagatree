# Edge contract: main

**Status: SPEC; current branch source verified.** Implementation issue: **#830**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [edge-main.json](source-contracts/edge-main.json) (SHA-256 `7651b123305e43316e15c555b98879ce395c39d9524cce397cbb82e9b06391e5`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Exposure and purpose

**dispatcher** — Preserve exact dispatch boundary until host cutover.

Custom Edge Runtime dispatcher, not a routable worker.

Resolve /functions/v1/<name>/suffix or /<name>/suffix; no name400. Deny every name outside the explicit eight-worker allowlist and reserved main/_shared, including traversal, with404 BEFORE JWT and worker creation. Allowed non-OPTIONS verifies HS256 with JWT_SECRET unless VERIFY_JWT=false|0|no; allowed worker authenticates end-user separately.

## Request variants, fields and defaults

- **transport:** Any HTTP method/body/query forwarded unchanged to allowlisted worker; normalized pathname always /functions/v1/<name>/<suffix>
- **jwt:** Bearer case-insensitive parser, exactly3 token segments, HS256 signature; numeric exp older than now denied; does not require exp, sub, audience or issuer at dispatcher layer

## Success and error contracts

- **proxy:** Exact worker Response forwarded; no body transform
- **options:** Allowed worker OPTIONS204 through shared CORS, unknown/blocked worker OPTIONS404

- 400 {error:'missing function name'};404 {error:'Not found'};500 missing JWT_SECRET;401 missing/invalid/expired/unsupported-algorithm token
- Dispatcher catch500 {error:message} and logs message; cannot assume redacted downstream exception text

## Side effects and transaction boundaries

- Creates EdgeRuntime.userWorkers with servicePath under /home/deno/functions/name,512MiB,300000ms timeout,module cache on,shared import map; forwards environment plus SUPABASE_FUNCTION_SLUG
- No worker starts for blocked/unknown names. main and _shared never become nested workers

## Quota, environment and transport


```json
{
  "kind": "none",
  "scope": "dispatcher has no global quota; workers own quotas"
}
```

Restores prefix after nginx stripping and preserves query/method/body. Eight mounts are ai-provider-credentials, character-avatar-meshy, character-lore, item-model3d, item-thumbnail, look-reference-analysis, session-media-token, session-recap.

- `JWT_SECRET`
- `VERIFY_JWT`

Explicit abort call sites (dynamic values resolve in the linked helper declaration):

None in the reviewed source.

## Exact environment defaults and configuration resolution

### isJwtVerificationEnabled

`supabase/functions/_shared/edge-jwt-gate.ts:25`

```ts
export function isJwtVerificationEnabled(
  env: { get(key: string): string | undefined } = Deno.env,
): boolean {
  const raw = env.get('VERIFY_JWT');
  if (raw === undefined || raw === '') return true;
  const normalized = raw.trim().toLowerCase();
  return normalized !== 'false' && normalized !== '0' && normalized !== 'no';
}
```

### gateEdgeRequestJwt

`supabase/functions/_shared/edge-jwt-gate.ts:92`

```ts
export async function gateEdgeRequestJwt(
  req: Request,
  env: { get(key: string): string | undefined } = Deno.env,
): Promise<Response | null> {
  if (req.method === 'OPTIONS') return null;
  if (!isJwtVerificationEnabled(env)) return null;

  const secret = env.get('JWT_SECRET')?.trim();
  if (!secret) {
    return new Response(JSON.stringify({ error: 'JWT_SECRET not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = extractBearerToken(req.headers.get('Authorization'));
  if (!token) {
    return new Response(JSON.stringify({ error: 'missing Authorization bearer token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const verified = await verifyHs256(token, secret);
  if (!verified.ok) {
    return new Response(JSON.stringify({ error: verified.reason }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return null;
}
```


## Dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| http-host | `authenticated HTTP transport` | #795 |  |
| auth | `account identity` | #793 |  |

## CORS transport

No dispatcher CORS rewrite; allowed OPTIONS forwarded, denied names remain404.

## Acceptance and negative tests (required, not executed)

- Every one of15 unmounted workers, main, _shared,unknown and traversal returns404 before JWT/worker creation for GET/POST/OPTIONS.
- Both supported URL prefixes reach same allowlisted worker with intact suffix/query/method/body.
- Allowed non-OPTIONS rejects absent/wrong/expired/HS512 JWT; no JWT_SECRET500; default JWT verification on; OPTIONS forwards to worker.
- JWT gate acceptance alone never grants end-user authorization: anon/service-role credentials must still fail owner user authentication at worker boundary.
- Preserve512MiB/300s worker resource limits and record existing dispatcher raw-message error behavior.

## Observed legacy defects and explicit successor decisions

- Dispatcher verifies signature and optional exp but not complete JWT claims; worker-side account authentication remains mandatory. Raw exception messages can escape in500 body.

## All adapter call sites

No src/infrastructure caller in the reviewed branch. This does not authorize adding a public mount.

## Exact ordered operations

### main:handler

Predicate: `Complete handler with ordered method/auth/body guards`. Source: `supabase/functions/main/index.ts:56`.


```ts
serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const serviceName = resolveServiceName(url.pathname);

    if (!serviceName) {
      return new Response(JSON.stringify({ error: 'missing function name' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fail closed before JWT / worker create — legacy mounts never start.
    if (!isEdgeDispatcherAllowed(serviceName)) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const jwtDenied = await gateEdgeRequestJwt(req);
    if (jwtDenied) return jwtDenied;

    const servicePath = `/home/deno/functions/${serviceName}`;
    const envVarsObj = {
      ...Deno.env.toObject(),
      SUPABASE_FUNCTION_SLUG: serviceName,
    };
    const envVars = Object.entries(envVarsObj) as Array<[string, string]>;

    const worker = await EdgeRuntime.userWorkers.create({
      servicePath,
      // Avatar Meshy materialize (GLB download/upload) needs headroom; 256MB OOM-kills the container.
      memoryLimitMb: 512,
      workerTimeoutMs: 5 * 60 * 1000,
      noModuleCache: false,
      importMapPath: '/home/deno/import_map.json',
      envVars,
    });

    return await worker.fetch(toWorkerRequest(req, serviceName));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('edge main dispatch failed', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```


## Exact type declarations

### EdgeDispatcherAllowedName

`supabase/functions/_shared/edge-dispatcher-allowlist.ts:21`

```ts
export type EdgeDispatcherAllowedName = (typeof EDGE_DISPATCHER_ALLOWLIST)[number];
```


## Exact validation, defaults and helper behavior

All inline guards are in the ordered handler; remaining imported helpers are complete in the AST snapshot.

## Verification source manifest

| Path | SHA-256 |
|---|---|
| `supabase/functions/_shared/edge-dispatcher-allowlist.ts` | `8fab25a3d5e0d2324cba6143517aed98c7f635423b789406a0da4e9bd1f51370` |
| `supabase/functions/_shared/edge-jwt-gate.ts` | `14a871697b051b7fcbee09dbce1dee8bc8ed5ea6a6eca0bec7b2e771b32d0f0c` |
| `supabase/functions/main/index.ts` | `92f3bf56bf3c776e01595d980246079c4a9f8775e417959abea9d7da003bc53e` |

