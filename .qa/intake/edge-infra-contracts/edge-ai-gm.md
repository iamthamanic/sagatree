# Edge contract: ai-gm

**Status: SPEC; current branch source verified.** Implementation issue: **#817**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [edge-ai-gm.json](source-contracts/edge-ai-gm.json) (SHA-256 `df1b52d58f8829e11f1051565443b4034f4addc5f92ebc1f2312e9d544ae1f57`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Exposure and purpose

**legacy-unmounted** — Preserve external 404; no automatic host route or public activation.

Historical AI-GM generation worker; currently not on dispatcher allowlist.

External dispatcher returns404 before worker creation. If directly invoked in an isolated fixture, assertSessionMemberAccess runs before persistent user quota and provider/lore fan-out; it does not establish a role-safe projection of caller-supplied NPC IDs/context.

## Request variants, fields and defaults

- **body:** POST {sessionId:string,action:string(1..5000),context?:Partial<SessionContext>,stream?:boolean,ruleset?:'dnd5e'|'pathfinder2e'|'custom',tone?:'serious'|'lighthearted'|'dark'|'heroic'}; actual validation checks string sessionId/action and action max length, not full nested enum types
- **stream:** stream !== false by default; GET URL ending /health only bypasses handler POST path (but remains externally404)

## Success and error contracts

- **stream:** HTTP200 Content-Type:text/event-stream carrying newline-delimited JSON, not SSE data: framing; narrative chunks {type:'narrative',content}, final {type:'complete',narrative,worldStateUpdate:null|object,diceRollsRequired?:array,combatInitiated:boolean}; stream failures {type:'error',error:string}
- **nonStream:** {narrative,worldStateUpdate?:object,diceRollsRequired?:array,combatInitiated:boolean}
- **health:** {status:'ok',provider,model,timestamp}

- External404 always; isolated worker400 validation,401/403 membership,429 quota,503 missing quota config/store,405 method,500 error/message/stack or200 stream error chunk

## Side effects and transaction boundaries

- Quota consume; optional per-NPC GET lorekeeper context then LLM request; extracted world change triggers PUT to sessions worker
- Default lorekeeper and sessions URLs point at blocked workers; failed fetch helpers can drop enrichment/world update. No guarantee that generated response means state persisted

## Quota, environment and transport


```json
{
  "kind": "persistent-rpc",
  "rpc": "consume_ai_gm_rate_limit",
  "scope": "authenticated userId",
  "defaultLimit": 12,
  "maxConfiguredLimit": 60,
  "windowSeconds": 60,
  "env": "AI_GM_RATE_LIMIT",
  "configuredParsing": "parseInt; non-integer result ->12, otherwise clamp1..60 (0/negative become1)"
}
```

Provider and internal service requests lack universal explicit timeouts; streaming Ollama parser currently splits per received chunk, not a cross-chunk line buffer. No retry policy guaranteed.

- `AI_GM_RATE_LIMIT`
- `ANON_KEY`
- `API_EXTERNAL_URL`
- `CHARACTER_AI_ALLOWED_ORIGIN`
- `CHARACTER_AI_API_KEY`
- `CHARACTER_AI_BASE_URL`
- `CHARACTER_AI_MODEL`
- `CHARACTER_AI_PROVIDER`
- `CREDENTIALS_ENCRYPTION_KEY`
- `LOREKEEPER_URL`
- `OLLAMA_HOST`
- `OLLAMA_MODEL`
- `SESSIONS_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

Explicit abort call sites (dynamic values resolve in the linked helper declaration):

- `supabase/functions/_shared/ai-gm-rate-limit.ts:52` — `AbortSignal.timeout(10_000)`
- `supabase/functions/_shared/character-lore-provider.ts:82` — `AbortSignal.timeout(60_000)`
- `supabase/functions/_shared/character-lore-provider.ts:111` — `AbortSignal.timeout(60_000)`
- `supabase/functions/_shared/ollama-llm-resolve.ts:134` — `AbortSignal.timeout(10_000)`
- `supabase/functions/ai-gm/index.ts:134` — `AbortSignal.timeout(10_000)`

## Exact environment defaults and configuration resolution

### resolveCharacterLoreProviderConfig

`supabase/functions/_shared/character-lore-provider.ts:16`

```ts
export function resolveCharacterLoreProviderConfig(): CharacterLoreProviderConfig | null {
  const providerValue = (Deno.env.get('CHARACTER_AI_PROVIDER') || 'ollama').trim();
  if (providerValue !== 'openai-compatible' && providerValue !== 'ollama') return null;

  const model = (Deno.env.get('CHARACTER_AI_MODEL') || Deno.env.get('OLLAMA_MODEL') || '').trim();
  if (!model) return null;

  if (providerValue === 'openai-compatible') {
    const baseUrl = (Deno.env.get('CHARACTER_AI_BASE_URL') || '').trim();
    const apiKey = (Deno.env.get('CHARACTER_AI_API_KEY') || '').trim();
    if (!baseUrl || !apiKey) return null;
    return {
      provider: providerValue,
      baseUrl: trimTrailingSlash(baseUrl),
      model,
      apiKey,
    };
  }

  const baseUrl = (
    Deno.env.get('CHARACTER_AI_BASE_URL') ||
    Deno.env.get('OLLAMA_HOST') ||
    'http://ollama:11434'
  ).trim();

  return {
    provider: providerValue,
    baseUrl: trimTrailingSlash(baseUrl),
    model,
  };
}
```

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

### envDefaultModel

`supabase/functions/_shared/ollama-llm-resolve.ts:58`

```ts
export function envDefaultModel(
  envGet: (key: string) => string | undefined = (k) => Deno.env.get(k),
): string {
  return (envGet('CHARACTER_AI_MODEL') || envGet('OLLAMA_MODEL') || '').trim();
}
```

### buildEnvSettingsView

`supabase/functions/_shared/ollama-llm-resolve.ts:64`

```ts
export function buildEnvSettingsView(
  envGet: (key: string) => string | undefined = (k) => Deno.env.get(k),
): OllamaSettingsView {
  const envConfig = resolveCharacterLoreProviderConfig();
  const localDefault = defaultLocalOllamaBase(envGet);
  const useCloud =
    envConfig?.provider === 'openai-compatible' &&
    trimTrailingSlash(envConfig.baseUrl).toLowerCase().includes('ollama.com');
  return {
    useCloud,
    baseUrl: envConfig?.baseUrl ?? (useCloud ? OLLAMA_CLOUD_OPENAI_BASE : localDefault),
    model: envConfig?.model ?? envDefaultModel(envGet),
    hasApiKey: Boolean(envConfig?.apiKey),
    keyHint: null,
    status: envConfig ? 'active' : null,
    updatedAt: null,
    source: 'env',
    cloudDefaultUrl: OLLAMA_CLOUD_OPENAI_BASE,
    localDefaultUrl: localDefault,
  };
}
```

### loadOllamaSettingsForUser

`supabase/functions/_shared/ollama-llm-resolve.ts:117`

```ts
export async function loadOllamaSettingsForUser(
  config: SupabaseServiceConfig,
  userId: string,
): Promise<OllamaSettingsStored | null> {
  const url =
    `${config.url}/rest/v1/user_ai_provider_credentials` +
    `?user_id=eq.${encodeURIComponent(userId)}` +
    `&provider_id=eq.${encodeURIComponent(OLLAMA_PROVIDER_ID)}` +
    `&status=eq.active` +
    `&select=secret_ciphertext,key_hint,status,meta,updated_at,added_at` +
    `&limit=1`;

  const response = await fetch(url, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`ollama prefs lookup failed: ${response.status}`);
  }

  const body: unknown = await response.json();
  if (!Array.isArray(body) || body.length === 0 || !isRecord(body[0])) return null;

  const row = body[0];
  const meta = isRecord(row.meta) ? row.meta : {};
  const useCloud = meta.useCloud === true;
  const baseUrl =
    typeof meta.baseUrl === 'string' && meta.baseUrl.trim()
      ? meta.baseUrl.trim()
      : useCloud
        ? OLLAMA_CLOUD_OPENAI_BASE
        : defaultLocalOllamaBase();
  const model = typeof meta.model === 'string' ? meta.model.trim() : '';
  const secretCiphertext =
    typeof row.secret_ciphertext === 'string' ? row.secret_ciphertext : '';
  if (!secretCiphertext) return null;

  const encKey = parseCredentialsEncryptionKey(Deno.env.get('CREDENTIALS_ENCRYPTION_KEY'));
  if (!encKey) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY missing');
  }

  let apiKey = '';
  try {
    apiKey = await decryptProviderSecret(secretCiphertext, encKey);
  } catch {
    throw new Error('OLLAMA_SECRET_DECRYPT');
  }

  return {
    useCloud,
    baseUrl,
    model,
    apiKey,
    keyHint: typeof row.key_hint === 'string' ? row.key_hint : '••••',
    status: typeof row.status === 'string' ? row.status : 'active',
    updatedAt:
      typeof row.updated_at === 'string'
        ? row.updated_at
        : typeof row.added_at === 'string'
          ? row.added_at
          : null,
    secretCiphertext,
  };
}
```

### toSettingsView

`supabase/functions/_shared/ollama-llm-resolve.ts:186`

```ts
export function toSettingsView(
  stored: OllamaSettingsStored | null,
  envGet: (key: string) => string | undefined = (k) => Deno.env.get(k),
): OllamaSettingsView {
  const envView = buildEnvSettingsView(envGet);
  if (!stored) return envView;
  return {
    useCloud: stored.useCloud,
    baseUrl: stored.baseUrl,
    model: stored.model,
    hasApiKey: stored.apiKey.trim().length > 0,
    keyHint: stored.apiKey.trim().length > 0 ? stored.keyHint : null,
    status: stored.status,
    updatedAt: stored.updatedAt,
    source: 'user',
    cloudDefaultUrl: OLLAMA_CLOUD_OPENAI_BASE,
    localDefaultUrl: envView.localDefaultUrl,
  };
}
```

### defaultLocalOllamaBase

`supabase/functions/_shared/ollama-url-policy.ts:127`

```ts
export function defaultLocalOllamaBase(
  envGet: (key: string) => string | undefined = (k) => Deno.env.get(k),
): string {
  const fromEnv = (
    envGet('CHARACTER_AI_BASE_URL') ||
    envGet('OLLAMA_HOST') ||
    'http://ollama:11434'
  ).trim();
  const safe = assertSafeOllamaBaseUrl(fromEnv);
  return safe.ok ? safe.baseUrl : 'http://ollama:11434';
}
```

### restBase

`supabase/functions/_shared/session-membership-gate.ts:9`

```ts
function restBase(
  env: { get(key: string): string | undefined } = Deno.env,
): string {
  const raw =
    env.get('SUPABASE_URL') ||
    env.get('API_EXTERNAL_URL') ||
    'http://supabase-kong:8000';
  return raw.replace(/\/$/, '');
}
```

### anonKey

`supabase/functions/_shared/session-membership-gate.ts:19`

```ts
function anonKey(env: { get(key: string): string | undefined } = Deno.env): string {
  return env.get('SUPABASE_ANON_KEY') || env.get('ANON_KEY') || '';
}
```

### CORS_OPTS

`supabase/functions/ai-gm/index.ts:11`

```ts
CORS_OPTS: CorsOptions = {
  missingOriginPolicy: 'configured-or-star',
  methods: 'GET, POST, OPTIONS',
  allowHeaders: 'authorization, x-client-info, apikey, content-type, x-session-id, Content-Type, Authorization, X-Session-Id',
}
```

### OLLAMA_HOST

`supabase/functions/ai-gm/index.ts:89`

```ts
OLLAMA_HOST = Deno.env.get("OLLAMA_HOST") || "http://ollama:11434"
```

### OLLAMA_MODEL

`supabase/functions/ai-gm/index.ts:90`

```ts
OLLAMA_MODEL = Deno.env.get("OLLAMA_MODEL") || "llama3.2"
```

### DEFAULT_AI_GM_RATE_LIMIT

`supabase/functions/ai-gm/index.ts:93`

```ts
DEFAULT_AI_GM_RATE_LIMIT = 12
```

### AI_PROVIDER

`supabase/functions/ai-gm/index.ts:95`

```ts
AI_PROVIDER = (Deno.env.get("CHARACTER_AI_PROVIDER") || "ollama").trim()
```

### AI_MODEL

`supabase/functions/ai-gm/index.ts:96`

```ts
AI_MODEL = (
  Deno.env.get("CHARACTER_AI_MODEL") ||
  Deno.env.get("OLLAMA_MODEL") ||
  "llama3.2"
).trim()
```

### AI_BASE_URL

`supabase/functions/ai-gm/index.ts:101`

```ts
AI_BASE_URL = (
  Deno.env.get("CHARACTER_AI_BASE_URL") ||
  Deno.env.get("OLLAMA_HOST") ||
  "http://ollama:11434"
).replace(/\/+$/, "")
```

### AI_API_KEY

`supabase/functions/ai-gm/index.ts:106`

```ts
AI_API_KEY = (Deno.env.get("CHARACTER_AI_API_KEY") || "").trim()
```

### LOREKEEPER_URL

`supabase/functions/ai-gm/index.ts:107`

```ts
LOREKEEPER_URL = Deno.env.get("LOREKEEPER_URL") || "http://localhost:9998/functions/v1/lorekeeper"
```

### SESSIONS_URL

`supabase/functions/ai-gm/index.ts:108`

```ts
SESSIONS_URL = Deno.env.get("SESSIONS_URL") || "http://localhost:9998/functions/v1/sessions"
```

### resolveOptionalUserId

`supabase/functions/ai-gm/index.ts:126`

```ts
async function resolveOptionalUserId(req: Request): Promise<string | null> {
  const authorization = req.headers.get('Authorization')?.trim()
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim()
  const url = Deno.env.get('SUPABASE_URL')?.trim()
  if (!authorization?.startsWith('Bearer ') || !anonKey || !url) return null
  try {
    const response = await fetch(`${url.replace(/\/+$/, '')}/auth/v1/user`, {
      headers: { Authorization: authorization, apikey: anonKey },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return null
    const body: unknown = await response.json()
    return body && typeof body === 'object' && typeof (body as { id?: unknown }).id === 'string'
      ? (body as { id: string }).id
      : null
  } catch {
    return null
  }
}
```

### resolveGmProvider

`supabase/functions/ai-gm/index.ts:146`

```ts
async function resolveGmProvider(req: Request): Promise<CharacterLoreProviderConfig> {
  const userId = await resolveOptionalUserId(req)
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  const url = Deno.env.get('SUPABASE_URL')?.trim()
  const resolved = await resolveLlmProviderForUser(
    userId && serviceRoleKey && url
      ? { url: url.replace(/\/+$/, ''), serviceRoleKey }
      : null,
    userId,
  )
  return resolved ?? envFallbackProvider()
}
```

### getAiGmRateLimit

`supabase/functions/ai-gm/index.ts:171`

```ts
function getAiGmRateLimit(): number {
  const raw = Number.parseInt(Deno.env.get('AI_GM_RATE_LIMIT') || '', 10)
  if (!Number.isInteger(raw)) return DEFAULT_AI_GM_RATE_LIMIT
  return Math.min(60, Math.max(1, raw))
}
```

### getSupabaseServiceConfig

`supabase/functions/ai-gm/index.ts:177`

```ts
function getSupabaseServiceConfig(): { url: string; serviceRoleKey: string; anonKey: string } | null {
  const url = (
    Deno.env.get('SUPABASE_URL') ||
    Deno.env.get('API_EXTERNAL_URL') ||
    ''
  ).replace(/\/+$/, '')
  const serviceRoleKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim()
  const anonKey = (Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('ANON_KEY') || '').trim()
  if (!url || !serviceRoleKey || !anonKey) return null
  return { url, serviceRoleKey, anonKey }
}
```


## Dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| http-host | `authenticated HTTP transport` | #795 |  |
| edge | `ai-provider-credentials` | #818 |  |
| internal-rpc | `consume_ai_gm_rate_limit` | #817 | quota prerequisite owned by this Edge port |
| table | `project_members` | #791 | Policy #792 |
| table | `sessions` | #791 | Policy #792 |
| table | `user_ai_provider_credentials` | #791 | Policy #792 |

## CORS transport

handleOptions returns204. Default methods GET,POST,PUT,DELETE,OPTIONS and headers authorization,x-client-info,apikey,content-type with Vary:Origin. First nonempty envKeys value wins; default CHARACTER_AI_ALLOWED_ORIGIN. Explicit star returns star; matching CSV origin echoed; localhost allowed if unconfigured or opt-in. Unmatched origin omits header unless configured-or-star, which emits configured raw value or star. CORS never supplies account authorization.

```ts
CORS_OPTS: CorsOptions = {
  missingOriginPolicy: 'configured-or-star',
  methods: 'GET, POST, OPTIONS',
  allowHeaders: 'authorization, x-client-info, apikey, content-type, x-session-id, Content-Type, Authorization, X-Session-Id',
}
```


## Acceptance and negative tests (required, not executed)

- Dispatcher requests for ai-gm return404 for valid/invalid/no JWT, without creating worker.
- Any future enablement requires separate reviewed GM/player projection and explicit replacement for blocked lorekeeper/sessions fan-out.
- Isolated fixture validates action max5000, membership rejection before LLM,13th default quota request429.
- If retained internally, pin NDJSON-under-text/event-stream framing and nonstream metadata shape; chunk-boundary/error/failed state write tests must pass.

## Observed legacy defects and explicit successor decisions

- Unmounted; no public activation authorization. Role-safe NPC context, correct context-index pairing, durable world mutation, stream framing across chunks and error-stack redaction require explicit successor decisions.

## All adapter call sites

No src/infrastructure caller in the reviewed branch. This does not authorize adding a public mount.

## Exact ordered operations

### ai-gm:1

Predicate: `req.method === "GET" && req.url.endsWith('/health')`. Source: `supabase/functions/ai-gm/index.ts:661`.


```ts
{
    return new Response(JSON.stringify({
      status: 'ok',
      provider: AI_PROVIDER,
      model: AI_MODEL || OLLAMA_MODEL,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...headers, "Content-Type": "application/json" },
    })
  }
```

### ai-gm:2

Predicate: `req.method === "POST"`. Source: `supabase/functions/ai-gm/index.ts:673`.


```ts
{
    try {
      const body = await req.json()
      
      // Validate request
      const validation = validateRequest(body)
      if (!validation.valid) {
        return new Response(JSON.stringify({ error: validation.error }), {
          status: 400,
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
      
      const request: GMRequest = body
      const stream = request.stream !== false

      // #607: non-members must not reach Ollama / mutate world state
      const memberDenied = await assertSessionMemberAccess(req, request.sessionId)
      if (memberDenied) {
        return new Response(memberDenied.body, {
          status: memberDenied.status,
          headers: { ...headers, 'Content-Type': 'application/json' },
        })
      }

      // #670: persistent user quota before any LLM / lorekeeper fan-out
      const rateLimited = await enforceAiGmRateLimit(req, headers)
      if (rateLimited) return rateLimited
      
      // Fetch additional NPC context from Lorekeeper
      if (request.context?.npcs) {
        const npcPromises = request.context.npcs
          .filter(npc => npc.id)
          .map(npc => getNPCContext(npc.id))
        
        const npcContexts = await Promise.all(npcPromises)
        
        npcContexts.forEach((context, i) => {
          if (context && request.context?.npcs?.[i]) {
            request.context.npcs[i].memories = context.memories || []
            request.context.npcs[i].relationships = context.relationships || {}
          }
        })
      }
      
      // Build prompt
      const prompt = buildPrompt(request)
      const provider = await resolveGmProvider(req)
      
      // Generate narrative
      if (stream) {
        const encoder = new TextEncoder()
        let fullNarrative = ''
        
        const readableStream = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of generateNarrative(prompt, true, provider)) {
                if (chunk.type === 'narrative' && chunk.content) {
                  fullNarrative += chunk.content
                  controller.enqueue(encoder.encode(JSON.stringify({
                    type: 'narrative',
                    content: chunk.content,
                  }) + '\n'))
                } else if (chunk.type === 'complete') {
                  // Extract structured data from completed narrative
                  const worldUpdate = extractWorldStateUpdates(fullNarrative)
                  const diceRolls = extractDiceRollRequests(fullNarrative)
                  const combat = extractCombatInitiated(fullNarrative)
                  
                  // Update session world state if needed
                  if (worldUpdate && request.sessionId) {
                    await updateSessionWorldState(request.sessionId, worldUpdate)
                  }
                  
                  // Send final metadata
                  controller.enqueue(encoder.encode(JSON.stringify({
                    type: 'complete',
                    narrative: fullNarrative,
                    worldStateUpdate: worldUpdate,
                    diceRollsRequired: diceRolls.length > 0 ? diceRolls : undefined,
                    combatInitiated: combat,
                  }) + '\n'))
                  
                  controller.close()
                }
              }
            } catch (error: unknown) {
              controller.enqueue(encoder.encode(JSON.stringify({
                type: 'error',
                error: (error instanceof Error ? error.message : String(error)),
              }) + '\n'))
              controller.close()
            }
          },
        })
        
        return new Response(readableStream, {
          headers: { ...headers, "Content-Type": "text/event-stream" },
        })
      } else {
        // Non-streaming
        let fullNarrative = ''
        
        for await (const chunk of generateNarrative(prompt, false, provider)) {
          if (chunk.type === 'narrative' && chunk.content) {
            fullNarrative = chunk.content
          }
        }
        
        const worldUpdate = extractWorldStateUpdates(fullNarrative)
        const diceRolls = extractDiceRollRequests(fullNarrative)
        const combat = extractCombatInitiated(fullNarrative)
        
        if (worldUpdate && request.sessionId) {
          await updateSessionWorldState(request.sessionId, worldUpdate)
        }
        
        const response: GMResponse = {
          narrative: fullNarrative,
          worldStateUpdate: worldUpdate || undefined,
          diceRollsRequired: diceRolls.length > 0 ? diceRolls : undefined,
          combatInitiated: combat,
        }
        
        return new Response(JSON.stringify(response), {
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
    } catch (error: unknown) {
      return new Response(JSON.stringify({
        error: "Internal server error",
        message: (error instanceof Error ? error.message : String(error)),
        stack: (error instanceof Error ? error.stack : undefined),
      }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
  }
```


## Exact type declarations

### AiGmRateLimitConfig

`supabase/functions/_shared/ai-gm-rate-limit.ts:8`

```ts
export interface AiGmRateLimitConfig {
  url: string;
  serviceRoleKey: string;
  limit: number;
  windowSeconds: number;
}
```

### FetchLike

`supabase/functions/_shared/ai-gm-rate-limit.ts:15`

```ts
type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;
```

### CharacterLoreRuleset

`supabase/functions/_shared/character-lore-prompt.ts:1`

```ts
export type CharacterLoreRuleset = 'sagatree-core' | 'dnd-5.5e';
```

### CharacterLorePromptContext

`supabase/functions/_shared/character-lore-prompt.ts:3`

```ts
export interface CharacterLorePromptContext {
  ruleset: CharacterLoreRuleset;
  name: string;
  description: string;
  characterClass: string;
  raceOrSpecies: string;
  setting?: string;
  essenceProfile?: string;
  dndBackground?: string;
  level: number;
  attributes: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  abilities: Array<{
    name: string;
    description: string;
    type: 'combat' | 'magic' | 'skill';
    cost: number;
    effect: string;
  }>;
  inventory: Array<{
    name: string;
    description: string;
    type: 'weapon' | 'armor' | 'consumable' | 'misc';
    quantity: number;
  }>;
  appearance: {
    bodySize: number;
    height: number;
    face: string;
    hairStyle: string;
    hairColor: string;
    skinTone: string;
    clothing: string;
    accessory?: string;
  };
  traits: {
    personality: string[];
    ideals: string[];
    bonds: string[];
    flaws: string[];
  };
}
```

### CharacterLoreReferenceContext

`supabase/functions/_shared/character-lore-prompt.ts:52`

```ts
export interface CharacterLoreReferenceContext {
  projectName?: string;
  projectDescription?: string;
  worldName?: string;
  worldSettingType?: string;
  worldLore?: string;
}
```

### CharacterLorePrompt

`supabase/functions/_shared/character-lore-prompt.ts:60`

```ts
export interface CharacterLorePrompt {
  version: string;
  system: string;
  user: string;
}
```

### CharacterLoreProviderName

`supabase/functions/_shared/character-lore-provider.ts:3`

```ts
export type CharacterLoreProviderName = 'openai-compatible' | 'ollama';
```

### CharacterLoreProviderConfig

`supabase/functions/_shared/character-lore-provider.ts:5`

```ts
export interface CharacterLoreProviderConfig {
  provider: CharacterLoreProviderName;
  baseUrl: string;
  model: string;
  apiKey?: string;
}
```

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

### OllamaSettingsView

`supabase/functions/_shared/ollama-llm-resolve.ts:21`

```ts
export interface OllamaSettingsView {
  useCloud: boolean;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  keyHint: string | null;
  status: string | null;
  updatedAt: string | null;
  source: 'user' | 'env';
  cloudDefaultUrl: string;
  localDefaultUrl: string;
}
```

### OllamaSettingsStored

`supabase/functions/_shared/ollama-llm-resolve.ts:34`

```ts
export interface OllamaSettingsStored {
  useCloud: boolean;
  baseUrl: string;
  model: string;
  apiKey: string;
  keyHint: string;
  status: string;
  updatedAt: string | null;
  secretCiphertext: string;
}
```

### SupabaseServiceConfig

`supabase/functions/_shared/ollama-llm-resolve.ts:45`

```ts
export interface SupabaseServiceConfig {
  url: string;
  serviceRoleKey: string;
}
```

### SafeUrlResult

`supabase/functions/_shared/ollama-url-policy.ts:68`

```ts
export type SafeUrlResult =
  | { ok: true; baseUrl: string }
  | { ok: false; message: string };
```

### Character

`supabase/functions/ai-gm/index.ts:27`

```ts
interface Character {
  id: string
  name: string
  race?: string
  class?: string
  level?: number
  hp?: number
  maxHp?: number
  ac?: number
  inventory?: string[]
  conditions?: string[]
}
```

### NPC

`supabase/functions/ai-gm/index.ts:40`

```ts
interface NPC {
  id: string
  name: string
  description?: string
  disposition?: 'friendly' | 'neutral' | 'hostile'
  memories?: string[]
  relationships?: Record<string, string>
}
```

### WorldState

`supabase/functions/ai-gm/index.ts:49`

```ts
interface WorldState {
  location: string
  time?: string
  weather?: string
  activeCombats?: string[]
  activeQuests?: string[]
  exploredLocations?: string[]
}
```

### SessionContext

`supabase/functions/ai-gm/index.ts:58`

```ts
interface SessionContext {
  sessionId: string
  characters: Character[]
  npcs: NPC[]
  worldState: WorldState
  recentEvents: string[]
  ruleset?: string
  tone?: 'serious' | 'lighthearted' | 'dark' | 'heroic'
}
```

### GMRequest

`supabase/functions/ai-gm/index.ts:68`

```ts
interface GMRequest {
  sessionId: string
  action: string
  context?: Partial<SessionContext>
  stream?: boolean
  ruleset?: 'dnd5e' | 'pathfinder2e' | 'custom'
  tone?: 'serious' | 'lighthearted' | 'dark' | 'heroic'
}
```

### GMResponse

`supabase/functions/ai-gm/index.ts:77`

```ts
interface GMResponse {
  narrative: string
  worldStateUpdate?: Partial<WorldState>
  npcUpdates?: Array<{ id: string; memories: string[] }>
  combatInitiated?: boolean
  diceRollsRequired?: Array<{ type: string; dc?: number; description: string }>
}
```


## Exact validation, defaults and helper behavior

### envFallbackProvider

`supabase/functions/ai-gm/index.ts:110`

```ts
function envFallbackProvider(): CharacterLoreProviderConfig {
  if (AI_PROVIDER === 'openai-compatible' && AI_BASE_URL && AI_API_KEY) {
    return {
      provider: 'openai-compatible',
      baseUrl: AI_BASE_URL,
      model: AI_MODEL || OLLAMA_MODEL,
      apiKey: AI_API_KEY,
    }
  }
  return {
    provider: 'ollama',
    baseUrl: AI_BASE_URL || OLLAMA_HOST,
    model: AI_MODEL || OLLAMA_MODEL,
  }
}
```

### resolveOptionalUserId

`supabase/functions/ai-gm/index.ts:126`

```ts
async function resolveOptionalUserId(req: Request): Promise<string | null> {
  const authorization = req.headers.get('Authorization')?.trim()
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim()
  const url = Deno.env.get('SUPABASE_URL')?.trim()
  if (!authorization?.startsWith('Bearer ') || !anonKey || !url) return null
  try {
    const response = await fetch(`${url.replace(/\/+$/, '')}/auth/v1/user`, {
      headers: { Authorization: authorization, apikey: anonKey },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return null
    const body: unknown = await response.json()
    return body && typeof body === 'object' && typeof (body as { id?: unknown }).id === 'string'
      ? (body as { id: string }).id
      : null
  } catch {
    return null
  }
}
```

### resolveGmProvider

`supabase/functions/ai-gm/index.ts:146`

```ts
async function resolveGmProvider(req: Request): Promise<CharacterLoreProviderConfig> {
  const userId = await resolveOptionalUserId(req)
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  const url = Deno.env.get('SUPABASE_URL')?.trim()
  const resolved = await resolveLlmProviderForUser(
    userId && serviceRoleKey && url
      ? { url: url.replace(/\/+$/, ''), serviceRoleKey }
      : null,
    userId,
  )
  return resolved ?? envFallbackProvider()
}
```

### getAiGmRateLimit

`supabase/functions/ai-gm/index.ts:171`

```ts
function getAiGmRateLimit(): number {
  const raw = Number.parseInt(Deno.env.get('AI_GM_RATE_LIMIT') || '', 10)
  if (!Number.isInteger(raw)) return DEFAULT_AI_GM_RATE_LIMIT
  return Math.min(60, Math.max(1, raw))
}
```

### getSupabaseServiceConfig

`supabase/functions/ai-gm/index.ts:177`

```ts
function getSupabaseServiceConfig(): { url: string; serviceRoleKey: string; anonKey: string } | null {
  const url = (
    Deno.env.get('SUPABASE_URL') ||
    Deno.env.get('API_EXTERNAL_URL') ||
    ''
  ).replace(/\/+$/, '')
  const serviceRoleKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim()
  const anonKey = (Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('ANON_KEY') || '').trim()
  if (!url || !serviceRoleKey || !anonKey) return null
  return { url, serviceRoleKey, anonKey }
}
```

### resolveCallerUserId

`supabase/functions/ai-gm/index.ts:190`

```ts
async function resolveCallerUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization')
  if (!auth?.toLowerCase().startsWith('bearer ')) return null
  const config = getSupabaseServiceConfig()
  if (!config) return null
  const userRes = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.anonKey,
      Authorization: auth,
      'Content-Type': 'application/json',
    },
  })
  if (!userRes.ok) return null
  const body = (await userRes.json()) as { id?: string }
  return typeof body.id === 'string' && body.id ? body.id : null
}
```

### enforceAiGmRateLimit

`supabase/functions/ai-gm/index.ts:207`

```ts
async function enforceAiGmRateLimit(req: Request, headers: HeadersInit): Promise<Response | null> {
  const config = getSupabaseServiceConfig()
  if (!config) {
    console.error('AI GM persistent rate limit unavailable: missing service-role configuration')
    return new Response(JSON.stringify({
      error: 'AI Game Master ist vorübergehend nicht verfügbar. Bitte versuche es später erneut.',
    }), {
      status: 503,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  const userId = await resolveCallerUserId(req)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  try {
    const allowed = await consumePersistentAiGmRateLimit(
      {
        url: config.url,
        serviceRoleKey: config.serviceRoleKey,
        limit: getAiGmRateLimit(),
        windowSeconds: AI_GM_RATE_LIMIT_WINDOW_SECONDS,
      },
      userId,
    )
    if (!allowed) {
      return new Response(JSON.stringify({
        error: 'Zu viele AI-GM-Anfragen. Bitte warte kurz und versuche es erneut.',
      }), {
        status: 429,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }
  } catch (error) {
    console.error(
      'AI GM persistent rate limit failed:',
      error instanceof Error ? error.message : 'unknown error',
    )
    return new Response(JSON.stringify({
      error: 'AI Game Master ist vorübergehend nicht verfügbar. Bitte versuche es später erneut.',
    }), {
      status: 503,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  return null
}
```

### validateRequest

`supabase/functions/ai-gm/index.ts:261`

```ts
function validateRequest(body: unknown): { valid: boolean; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: "Invalid request body" }
  }
  
  const request = body as Record<string, unknown>
  
  if (!request.sessionId || typeof request.sessionId !== 'string') {
    return { valid: false, error: "Missing or invalid sessionId" }
  }
  
  if (!request.action || typeof request.action !== 'string') {
    return { valid: false, error: "Missing or invalid action" }
  }
  
  if (request.action.length > 5000) {
    return { valid: false, error: "Action too long (max 5000 characters)" }
  }
  
  return { valid: true }
}
```

### buildCharacterSection

`supabase/functions/ai-gm/index.ts:283`

```ts
function buildCharacterSection(characters: Character[]): string {
  if (!characters || characters.length === 0) return "No characters in party"
  
  return characters.map(c => {
    const parts = [`- ${c.name}`]
    if (c.race || c.class) parts.push(`(${c.race || 'Unknown'} ${c.class || 'Adventurer'})`)
    if (c.level) parts.push(`Level ${c.level}`)
    if (c.hp && c.maxHp) parts.push(`HP: ${c.hp}/${c.maxHp}`)
    if (c.conditions && c.conditions.length > 0) parts.push(`Conditions: ${c.conditions.join(', ')}`)
    return parts.join(' ')
  }).join('\n')
}
```

### buildNPCSection

`supabase/functions/ai-gm/index.ts:296`

```ts
function buildNPCSection(npcs: NPC[]): string {
  if (!npcs || npcs.length === 0) return "No NPCs present"
  
  return npcs.map(n => {
    const parts = [`- ${n.name}`]
    if (n.description) parts.push(`: ${n.description}`)
    if (n.disposition) parts.push(`[${n.disposition}]`)
    if (n.memories && n.memories.length > 0) {
      parts.push(`\n  Recent memories: ${n.memories.slice(-3).join('; ')}`)
    }
    return parts.join('')
  }).join('\n')
}
```

### buildWorldSection

`supabase/functions/ai-gm/index.ts:310`

```ts
function buildWorldSection(worldState: WorldState): string {
  const parts = [`## Current Location: ${worldState.location}`]
  
  if (worldState.time) parts.push(`Time: ${worldState.time}`)
  if (worldState.weather) parts.push(`Weather: ${worldState.weather}`)
  if (worldState.activeCombats && worldState.activeCombats.length > 0) {
    parts.push(`Active Combats: ${worldState.activeCombats.join(', ')}`)
  }
  if (worldState.activeQuests && worldState.activeQuests.length > 0) {
    parts.push(`Active Quests: ${worldState.activeQuests.join(', ')}`)
  }
  if (worldState.exploredLocations && worldState.exploredLocations.length > 0) {
    parts.push(`Explored: ${worldState.exploredLocations.join(', ')}`)
  }
  
  return parts.join('\n')
}
```

### buildRecentEventsSection

`supabase/functions/ai-gm/index.ts:328`

```ts
function buildRecentEventsSection(events: string[]): string {
  if (!events || events.length === 0) return "No recent events"
  
  return events.slice(-5).map((e, i) => `${i + 1}. ${e}`).join('\n')
}
```

### buildPrompt

`supabase/functions/ai-gm/index.ts:334`

```ts
function buildPrompt(request: GMRequest): string {
  const context = request.context || {} as Partial<SessionContext>
  const tone = request.tone || context.tone || 'serious'
  const ruleset = request.ruleset || context.ruleset || 'dnd5e'
  
  const systemPrompt = SYSTEM_PROMPTS[tone] || SYSTEM_PROMPTS.serious
  
  const characterSection = buildCharacterSection(context.characters || [])
  const npcSection = buildNPCSection(context.npcs || [])
  const worldSection = buildWorldSection(context.worldState || { location: 'Unknown' })
  const eventsSection = buildRecentEventsSection(context.recentEvents || [])
  
  return `${systemPrompt}

## Ruleset: ${ruleset.toUpperCase()}

## Session
ID: ${request.sessionId}

${worldSection}

## Party Members
${characterSection}

## NPCs Present
${npcSection}

## Recent Events
${eventsSection}

## Guidelines
- Stay in character as the Dungeon Master
- Describe scenes vividly but concisely
- React to player actions realistically
- Call for dice rolls when appropriate (perception, attack, skill checks)
- Maintain narrative consistency with established facts
- Create opportunities for player agency
- End responses with clear prompts for next actions
- If combat begins, describe it cinematically
- Track and reference NPC memories and relationships

## Player Action
${request.action}

## Dungeon Master Response
`
}
```

### getNPCContext

`supabase/functions/ai-gm/index.ts:386`

```ts
async function getNPCContext(npcId: string): Promise<NPC | null> {
  try {
    const response = await fetch(`${LOREKEEPER_URL}/npc/${npcId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    
    if (!response.ok) return null
    
    const data = await response.json()
    return data as NPC
  } catch {
    return null
  }
}
```

### updateNPCMemory

`supabase/functions/ai-gm/index.ts:402`

```ts
async function updateNPCMemory(npcId: string, memory: string): Promise<void> {
  try {
    await fetch(`${LOREKEEPER_URL}/npc/${npcId}/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: memory, type: 'event' }),
    })
  } catch {
    // Silently fail - not critical
  }
}
```

### updateSessionWorldState

`supabase/functions/ai-gm/index.ts:418`

```ts
async function updateSessionWorldState(sessionId: string, worldState: Partial<WorldState>): Promise<void> {
  try {
    await fetch(`${SESSIONS_URL}/${sessionId}/world-state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worldState }),
    })
  } catch {
    // Silently fail - not critical
  }
}
```

### generateOpenAiCompatibleNarrative

`supabase/functions/ai-gm/index.ts:434`

```ts
async function* generateOpenAiCompatibleNarrative(
  prompt: string,
  stream: boolean,
  provider: CharacterLoreProviderConfig,
): AsyncGenerator<{ type: string; content?: string; done?: boolean }> {
  if (!provider.baseUrl || !provider.apiKey) {
    throw new Error(
      "openai-compatible requires base URL and API key (Settings → AI → Organize or CHARACTER_AI_*)",
    )
  }

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      stream,
      temperature: 0.85,
      messages: [
        {
          role: "system",
          content:
            "You are the SagaTree AI Game Master. Follow the user prompt faithfully.",
        },
        { role: "user", content: prompt },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI-compatible provider error: ${response.status} ${response.statusText}`)
  }

  if (!stream) {
    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) throw new Error("OpenAI-compatible provider returned empty content")
    yield { type: "narrative", content }
    yield { type: "complete", done: true }
    return
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error("No response stream")
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const raw of lines) {
        const line = raw.trim()
        if (!line.startsWith("data:")) continue
        const payload = line.slice(5).trim()
        if (!payload || payload === "[DONE]") continue
        try {
          const chunk = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>
          }
          const content = chunk.choices?.[0]?.delta?.content
          if (content) yield { type: "narrative", content }
        } catch {
          // ignore partial JSON frames
        }
      }
    }
    yield { type: "complete", done: true }
  } finally {
    reader.releaseLock()
  }
}
```

### generateNarrative

`supabase/functions/ai-gm/index.ts:515`

```ts
async function* generateNarrative(
  prompt: string,
  stream: boolean = true,
  provider: CharacterLoreProviderConfig = envFallbackProvider(),
): AsyncGenerator<{ type: string; content?: string; done?: boolean }> {
  if (provider.provider === "openai-compatible") {
    yield* generateOpenAiCompatibleNarrative(prompt, stream, provider)
    return
  }

  const ollamaHost = provider.baseUrl || OLLAMA_HOST
  const response = await fetch(`${ollamaHost}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: provider.model || OLLAMA_MODEL,
      prompt,
      stream,
    }),
  })
  
  if (!response.ok) {
    throw new Error(`Ollama error: ${response.statusText}`)
  }
  
  if (!stream) {
    const data = await response.json()
    yield { type: 'narrative', content: data.response }
    yield { type: 'complete', done: true }
    return
  }
  
  const reader = response.body?.getReader()
  if (!reader) throw new Error("No response stream")
  
  const decoder = new TextDecoder()
  
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const text = decoder.decode(value)
      const lines = text.split('\n').filter(Boolean)
      
      for (const line of lines) {
        try {
          const json = JSON.parse(line)
          if (json.response) {
            yield { type: 'narrative', content: json.response }
          }
          if (json.done) {
            yield { type: 'complete', done: true }
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
```

### extractWorldStateUpdates

`supabase/functions/ai-gm/index.ts:583`

```ts
function extractWorldStateUpdates(narrative: string): Partial<WorldState> | null {
  // Simple extraction - look for location changes, time mentions, etc.
  const locationMatch = narrative.match(/(?:enters?|arrives? at|moves? to|in)\s+(?:the\s+)?([A-Z][a-zA-Z\s']+)/i)
  const timeMatch = narrative.match(/(?:time is now|it's now|hours? pass|morning|evening|night|dawn|dusk)/i)
  
  const updates: Partial<WorldState> = {}
  
  if (locationMatch) {
    updates.location = locationMatch[1].trim()
  }
  
  if (timeMatch) {
    updates.time = timeMatch[0]
  }
  
  return Object.keys(updates).length > 0 ? updates : null
}
```

### extractDiceRollRequests

`supabase/functions/ai-gm/index.ts:601`

```ts
function extractDiceRollRequests(narrative: string): Array<{ type: string; dc?: number; description: string }> {
  const rolls: Array<{ type: string; dc?: number; description: string }> = []
  
  // Look for skill checks
  const skillMatch = narrative.match(/(?:roll|make)\s+(?:a\s+)?(\w+)\s+check(?:\s+DC\s+(\d+))?/i)
  if (skillMatch) {
    rolls.push({
      type: skillMatch[1].toLowerCase(),
      dc: skillMatch[2] ? parseInt(skillMatch[2]) : undefined,
      description: `Roll ${skillMatch[1]} check`,
    })
  }
  
  // Look for attack rolls
  const attackMatch = narrative.match(/(?:roll|make)\s+(?:an?\s+)?attack\s+roll/i)
  if (attackMatch) {
    rolls.push({
      type: 'attack',
      description: 'Roll attack',
    })
  }
  
  // Look for saving throws
  const saveMatch = narrative.match(/(?:make|roll)\s+(?:a\s+)?(\w+)\s+saving\s+throw(?:\s+DC\s+(\d+))?/i)
  if (saveMatch) {
    rolls.push({
      type: `${saveMatch[1].toLowerCase()}Save`,
      dc: saveMatch[2] ? parseInt(saveMatch[2]) : undefined,
      description: `Roll ${saveMatch[1]} saving throw`,
    })
  }
  
  return rolls
}
```

### extractCombatInitiated

`supabase/functions/ai-gm/index.ts:636`

```ts
function extractCombatInitiated(narrative: string): boolean {
  const combatIndicators = [
    /rolls? for initiative/i,
    /combat begins/i,
    /enemies? appear/i,
    /draws? (?:their|his|her) weapon/i,
    /attacks?!/i,
    /initiative/i,
  ]
  
  return combatIndicators.some(pattern => pattern.test(narrative))
}
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `supabase/functions/_shared/ai-gm-rate-limit.ts` | `050346396b229912655843940ecde2fbc2111a571ddc85d12b2149e3d2bc9f61` |
| `supabase/functions/_shared/ai-provider-crypto.ts` | `45e60f76f744077e8d9b243719dcdba5d58a047d36a1c141df830afa2de16532` |
| `supabase/functions/_shared/character-lore-prompt.ts` | `54fffb4ba316515dff7add1998b2d6f02280ddc336c30e48d2a4ee045a60f818` |
| `supabase/functions/_shared/character-lore-provider.ts` | `355c8635d417fd31f9f2afb93e2ae4fe9f26ddeadaf6c2986a74f0201fb5479e` |
| `supabase/functions/_shared/cors.ts` | `f8286c91d79fa5fc5cfea2fa47081916523fa7a440f234aecd9a47c6a8cf5b38` |
| `supabase/functions/_shared/edge-dispatcher-allowlist.ts` | `6d1ae7bde0ba9e41fcaa7b61247732168a62699e7811fb8574cef266cfad3a27` |
| `supabase/functions/_shared/edge-jwt-gate.ts` | `14a871697b051b7fcbee09dbce1dee8bc8ed5ea6a6eca0bec7b2e771b32d0f0c` |
| `supabase/functions/_shared/ollama-llm-resolve.ts` | `e2874b05f38eac54d99abfca1b239138b4f95fece2011224f359bcfda9be99b3` |
| `supabase/functions/_shared/ollama-url-policy.ts` | `864eddb8138fabb9964a92dd948746829d8b09de5f741642b61fb2eb792c4fc1` |
| `supabase/functions/_shared/session-membership-gate.ts` | `53e3c57da9e037c49582d6f5781b52198a74a2c0aabf758467caa7bc2aee7cac` |
| `supabase/functions/ai-gm/index.ts` | `74d6b822589478b537e300b9364bc2668e795655e95a292f2494689265c22880` |
| `supabase/functions/main/index.ts` | `92f3bf56bf3c776e01595d980246079c4a9f8775e417959abea9d7da003bc53e` |

