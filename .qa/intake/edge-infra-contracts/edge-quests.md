# Edge contract: quests

**Status: SPEC; current branch source verified.** Implementation issue: **#834**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [edge-quests.json](source-contracts/edge-quests.json) (SHA-256 `3978d6144cc6de5a5973458e56c517e807c87a891cb20b2aa9998d173bfca714`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Exposure and purpose

**legacy-unmounted** — Preserve external 404; no automatic host route or public activation.

Historical quest/objective tracker with fixed-template random generation in Map.

Dispatcher denies quests with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps.

## Request variants, fields and defaults

- **createUpdate:** POST /quests Partial<Quest>; PUT /quests/:id Partial<Quest>; GET /quests?projectId&status; GET /quests/:id
- **complete:** POST /quests/:questId/complete/:objectiveId without body; missing objective leaves quest unchanged, all completed objectives sets quest.status=completed
- **generate:** POST /quests/generate {type?:main|side|personal(defaultside),level?:number(default1)}; random predefined template, generated objectives obj-index, XP100*level,gold10*level

## Success and error contracts

- **resource:** Quest {id,projectId,name,description,type,status,objectives:Objective[],rewards:Reward[],giver?,location?,prerequisites,createdAt,updatedAt}; defaults projectId empty,name Unknown Quest,type side,status available,arrays empty; all returns200 except absent GET404

- External endpoint always404 {error:'Not found'}, including OPTIONS; no historical code executes through main.
- In isolated source fixtures, OPTIONS204 shared CORS; unmatched route/method404 {error:'Not found'}; missing single resource404 where explicit branch exists. Thrown missing/invalid body/helper errors500 {error:'Internal server error',message:string}; fields and exact branch exceptions are enumerated in response sites.

## Side effects and transaction boundaries

- quests Map writes, timestamps and Math.random; no persistent project quest relation, reward grant or XP mutation on objective completion.

## Quota, environment and transport


```json
{
  "kind": "none",
  "scope": "No historical worker quota, persistence counter, retry budget or per-user scope exists."
}
```

Historical path strips /functions/v1/quests; no independent request-body ceiling or retry policy. All exact paths, method predicates, query/body reads, defaults and serialized response expressions are materialized in source evidence. No worker-specific abort timeout. No external network requests.

- `CHARACTER_AI_ALLOWED_ORIGIN`

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

`supabase/functions/quests/index.ts:7`

```ts
CORS_OPTS: CorsOptions = {
  missingOriginPolicy: 'configured-or-star',
}
```


## Dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| http-host | `authenticated HTTP transport` | #795 |  |

## CORS transport

handleOptions returns204. Default methods GET,POST,PUT,DELETE,OPTIONS and headers authorization,x-client-info,apikey,content-type with Vary:Origin. First nonempty envKeys value wins; default CHARACTER_AI_ALLOWED_ORIGIN. Explicit star returns star; matching CSV origin echoed; localhost allowed if unconfigured or opt-in. Unmatched origin omits header unless configured-or-star, which emits configured raw value or star. CORS never supplies account authorization.

```ts
CORS_OPTS: CorsOptions = {
  missingOriginPolicy: 'configured-or-star',
}
```


## Acceptance and negative tests (required, not executed)

- quests worker all routes remain404.
- Isolated objective completion proves missing objective is no-op and final completed objective changes status; no actual reward/character XP side effect.
- Unknown generator type and negative/invalid level require explicit validation before any separately authorized replacement.

## Observed legacy defects and explicit successor decisions

- Unauthenticated quest/project writes and generated quests default to empty projectId; completion does not grant rewards.

## All adapter call sites

No src/infrastructure caller in the reviewed branch. This does not authorize adding a public mount.

## Exact ordered operations

### quests:1

Predicate: `req.method === "GET" && path === "/health"`. Source: `supabase/functions/quests/index.ts:35`.


```ts
return new Response(JSON.stringify({ status: 'ok', features: ['quests', 'objectives', 'rewards', 'generation'] }), { headers: { ...headers, "Content-Type": "application/json" } })
```

### quests:2

Predicate: `req.method === "POST" && path === "/quests"`. Source: `supabase/functions/quests/index.ts:36`.


```ts
{ const body = await req.json(); const quest = await createQuest(body); return new Response(JSON.stringify(quest), { headers: { ...headers, "Content-Type": "application/json" } }) }
```

### quests:3

Predicate: `req.method === "GET" && path === "/quests"`. Source: `supabase/functions/quests/index.ts:37`.


```ts
{ const projectId = url.searchParams.get('projectId') || undefined; const status = url.searchParams.get('status') || undefined; const list = await listQuests(projectId, status); return new Response(JSON.stringify(list), { headers: { ...headers, "Content-Type": "application/json" } }) }
```

### quests:4

Predicate: `req.method === "GET" && path.match(/^\/quests\/[\w-]+$/)`. Source: `supabase/functions/quests/index.ts:38`.


```ts
{ const id = path.split("/")[2]; const quest = await getQuest(id); if (!quest) return new Response(JSON.stringify({ error: "Quest not found" }), { status: 404, headers: { ...headers, "Content-Type": "application/json" } }); return new Response(JSON.stringify(quest), { headers: { ...headers, "Content-Type": "application/json" } }) }
```

### quests:5

Predicate: `req.method === "PUT" && path.match(/^\/quests\/[\w-]+$/)`. Source: `supabase/functions/quests/index.ts:39`.


```ts
{ const id = path.split("/")[2]; const body = await req.json(); const quest = await updateQuest(id, body); return new Response(JSON.stringify(quest), { headers: { ...headers, "Content-Type": "application/json" } }) }
```

### quests:6

Predicate: `req.method === "POST" && path.match(/^\/quests\/[\w-]+\/complete\/[\w-]+$/)`. Source: `supabase/functions/quests/index.ts:40`.


```ts
{ const questId = path.split("/")[2]; const objectiveId = path.split("/")[4]; const quest = await completeObjective(questId, objectiveId); return new Response(JSON.stringify(quest), { headers: { ...headers, "Content-Type": "application/json" } }) }
```

### quests:7

Predicate: `req.method === "POST" && path === "/quests/generate"`. Source: `supabase/functions/quests/index.ts:41`.


```ts
{ const body = await req.json(); const quest = await generateQuest(body.type || 'side', body.level || 1); return new Response(JSON.stringify(quest), { headers: { ...headers, "Content-Type": "application/json" } }) }
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

### Quest

`supabase/functions/quests/index.ts:13`

```ts
interface Quest { id: string; projectId: string; name: string; description: string; type: 'main' | 'side' | 'personal'; status: 'available' | 'active' | 'completed' | 'failed'; objectives: Objective[]; rewards: Reward[]; giver?: string; location?: string; prerequisites: string[]; createdAt: string; updatedAt: string }
```

### Objective

`supabase/functions/quests/index.ts:14`

```ts
interface Objective { id: string; description: string; completed: boolean; target?: string; count?: number; current?: number }
```

### Reward

`supabase/functions/quests/index.ts:15`

```ts
interface Reward { type: 'xp' | 'gold' | 'item' | 'reputation'; amount: number; item?: string }
```


## Exact validation, defaults and helper behavior

### generateId

`supabase/functions/quests/index.ts:19`

```ts
function generateId(): string { return crypto.randomUUID() }
```

### createQuest

`supabase/functions/quests/index.ts:21`

```ts
async function createQuest(data: Partial<Quest>): Promise<Quest> { const id = generateId(); const now = new Date().toISOString(); const quest: Quest = { id, projectId: data.projectId || '', name: data.name || 'Unknown Quest', description: data.description || '', type: data.type || 'side', status: data.status || 'available', objectives: data.objectives || [], rewards: data.rewards || [], giver: data.giver, location: data.location, prerequisites: data.prerequisites || [], createdAt: now, updatedAt: now }; quests.set(id, quest); return quest }
```

### getQuest

`supabase/functions/quests/index.ts:22`

```ts
async function getQuest(id: string): Promise<Quest | null> { return quests.get(id) || null }
```

### listQuests

`supabase/functions/quests/index.ts:23`

```ts
async function listQuests(projectId?: string, status?: string): Promise<Quest[]> { let all = Array.from(quests.values()); if (projectId) all = all.filter(q => q.projectId === projectId); if (status) all = all.filter(q => q.status === status); return all }
```

### updateQuest

`supabase/functions/quests/index.ts:24`

```ts
async function updateQuest(id: string, data: Partial<Quest>): Promise<Quest> { const quest = quests.get(id); if (!quest) throw new Error("Quest not found"); const updated: Quest = { ...quest, ...data, id, updatedAt: new Date().toISOString() }; quests.set(id, updated); return updated }
```

### completeObjective

`supabase/functions/quests/index.ts:25`

```ts
async function completeObjective(questId: string, objectiveId: string): Promise<Quest> { const quest = quests.get(questId); if (!quest) throw new Error("Quest not found"); const obj = quest.objectives.find(o => o.id === objectiveId); if (obj) { obj.completed = true; quest.updatedAt = new Date().toISOString(); if (quest.objectives.every(o => o.completed)) quest.status = 'completed' } quests.set(questId, quest); return quest }
```

### generateQuest

`supabase/functions/quests/index.ts:26`

```ts
async function generateQuest(type: 'main' | 'side' | 'personal', level: number): Promise<Quest> { const templates = { main: [{ name: 'The Dragon\'s Hoard', description: 'Defeat the ancient dragon and reclaim the stolen treasure.', objectives: ['Travel to Dragon\'s Lair', 'Defeat the Dragon', 'Retrieve the Treasure'] }, { name: 'The Dark Lord\'s Return', description: 'Stop the Dark Lord from rising again.', objectives: ['Gather Information', 'Find the Ritual Site', 'Disrupt the Ritual'] }], side: [{ name: 'Lost Heirloom', description: 'A villager has lost a precious family heirloom.', objectives: ['Search the Woods', 'Find the Heirloom', 'Return to Owner'] }, { name: 'Monster Bounty', description: 'A dangerous monster is terrorizing the countryside.', objectives: ['Track the Monster', 'Defeat the Monster', 'Collect the Bounty'] }], personal: [{ name: 'Training Exercise', description: 'Practice your skills to become stronger.', objectives: ['Complete 3 Encounters', 'Reach Level ' + (level + 1) ] }, { name: 'Ancient Knowledge', description: 'Seek out ancient texts to expand your knowledge.', objectives: ['Visit the Library', 'Find the Tome', 'Study the Tome'] }] }; const template = templates[type][Math.floor(Math.random() * templates[type].length)]; return createQuest({ name: template.name, description: template.description, type, objectives: template.objectives.map((desc, i) => ({ id: `obj-${i}`, description: desc, completed: false })), rewards: [{ type: 'xp', amount: level * 100 }, { type: 'gold', amount: level * 10 }] }) }
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `supabase/functions/_shared/cors.ts` | `f8286c91d79fa5fc5cfea2fa47081916523fa7a440f234aecd9a47c6a8cf5b38` |
| `supabase/functions/_shared/edge-dispatcher-allowlist.ts` | `6d1ae7bde0ba9e41fcaa7b61247732168a62699e7811fb8574cef266cfad3a27` |
| `supabase/functions/_shared/edge-jwt-gate.ts` | `14a871697b051b7fcbee09dbce1dee8bc8ed5ea6a6eca0bec7b2e771b32d0f0c` |
| `supabase/functions/main/index.ts` | `92f3bf56bf3c776e01595d980246079c4a9f8775e417959abea9d7da003bc53e` |
| `supabase/functions/quests/index.ts` | `1826d17278205f9122b70c1c6e88892d41418335bc9167a25edf21f6eb236bb2` |

