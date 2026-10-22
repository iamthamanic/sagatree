# Edge contract: npcs

**Status: SPEC; current branch source verified.** Implementation issue: **#833**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [edge-npcs.json](source-contracts/edge-npcs.json) (SHA-256 `320d3e249deed8dad0eeb6d3c10e9a6a6a2cf14365ee7899b212788a188af6e3`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Exposure and purpose

**legacy-unmounted** — Preserve external 404; no automatic host route or public activation.

Historical random NPC/creature generator, memories, relationships and dialogue Maps.

Dispatcher denies npcs with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps.

## Request variants, fields and defaults

- **crud:** POST /npcs Partial<NPC>; GET /npcs?type&location&disposition; GET/PUT/DELETE /npcs/:id; GET /:id/export; POST /npcs/import Partial<NPC>
- **generate:** POST /npcs/generate {type?:npc|monster|creature,race?,class?,level?,location?,prompt?}; random name/class/level1..10/disposition/location; prompt accepted but unused
- **social:** POST /npcs/:id/memory {memory:string}; GET /:id/memories?limit(default10); POST /:id/relationship {targetId,relationship}; GET /:id/relationships
- **dialogue:** POST /npcs/:id/dialogue Omit<DialogueLine,id|npcId>; GET /:id/dialogues; full trigger/text/response types in appendix

## Success and error contracts

- **resources:** NPC/NPC[]200; defaults Unknown,npc,human,commoner,level1,hp/maxHp/ac10,speed30,neutral,Unknown location,arrays/maps empty,random stats; description generated only on create, not import
- **social:** memory write returns NPC; memories string[]; relationship write NPC/read Record; dialogue DialogueLine/read DialogueLine[]; delete success:true

- External endpoint always404 {error:'Not found'}, including OPTIONS; no historical code executes through main.
- In isolated source fixtures, OPTIONS204 shared CORS; unmatched route/method404 {error:'Not found'}; missing single resource404 where explicit branch exists. Thrown missing/invalid body/helper errors500 {error:'Internal server error',message:string}; fields and exact branch exceptions are enumerated in response sites.

## Side effects and transaction boundaries

- npcs/dialogues Maps and random generation only. No LLM despite prompt field, no persistent NPC-creature RPCs.

## Quota, environment and transport


```json
{
  "kind": "none",
  "scope": "No historical worker quota, persistence counter, retry budget or per-user scope exists."
}
```

Historical path strips /functions/v1/npcs; no independent request-body ceiling or retry policy. All exact paths, method predicates, query/body reads, defaults and serialized response expressions are materialized in source evidence. No worker-specific abort timeout. No external network requests.

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

`supabase/functions/npcs/index.ts:7`

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

- npcs worker all CRUD/social/export/generator paths remain404.
- Isolated fixture pins defaults, generated ranges, memory slicing, replacement relationships and dialogue shape.
- Request prompt does not trigger external provider; legacy NPC structure is not substituted for npc_creature_definitions/instances/controller policy.

## Observed legacy defects and explicit successor decisions

- No auth/ownership/session visibility, generated prompt is unused; object spreads may override nominally generated dialogue fields at runtime.

## All adapter call sites

No src/infrastructure caller in the reviewed branch. This does not authorize adding a public mount.

## Exact ordered operations

### npcs:1

Predicate: `req.method === "GET" && path === "/health"`. Source: `supabase/functions/npcs/index.ts:438`.


```ts
{
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        features: ['npcs', 'generation', 'memories', 'relationships', 'dialogues', 'import-export'],
      }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### npcs:2

Predicate: `req.method === "POST" && path === "/npcs"`. Source: `supabase/functions/npcs/index.ts:449`.


```ts
{
      const body = await req.json()
      const npc = await createNPC(body)
      
      return new Response(JSON.stringify(npc), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### npcs:3

Predicate: `req.method === "GET" && path === "/npcs"`. Source: `supabase/functions/npcs/index.ts:459`.


```ts
{
      const filter = {
        type: url.searchParams.get('type') || undefined,
        location: url.searchParams.get('location') || undefined,
        disposition: url.searchParams.get('disposition') || undefined,
      }
      const list = await listNPCs(filter)
      
      return new Response(JSON.stringify(list), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### npcs:4

Predicate: `req.method === "GET" && path.match(/^\/npcs\/[\w-]+$/)`. Source: `supabase/functions/npcs/index.ts:473`.


```ts
{
      const id = path.split("/")[2]
      const npc = await getNPC(id)
      
      if (!npc) {
        return new Response(JSON.stringify({ error: "NPC not found" }), {
          status: 404,
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
      
      return new Response(JSON.stringify(npc), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### npcs:5

Predicate: `req.method === "PUT" && path.match(/^\/npcs\/[\w-]+$/)`. Source: `supabase/functions/npcs/index.ts:490`.


```ts
{
      const id = path.split("/")[2]
      const body = await req.json()
      const npc = await updateNPC(id, body)
      
      return new Response(JSON.stringify(npc), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### npcs:6

Predicate: `req.method === "DELETE" && path.match(/^\/npcs\/[\w-]+$/)`. Source: `supabase/functions/npcs/index.ts:501`.


```ts
{
      const id = path.split("/")[2]
      await deleteNPC(id)
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### npcs:7

Predicate: `req.method === "POST" && path === "/npcs/generate"`. Source: `supabase/functions/npcs/index.ts:511`.


```ts
{
      const body = await req.json()
      const npc = await generateNPC(body)
      
      return new Response(JSON.stringify(npc), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### npcs:8

Predicate: `req.method === "POST" && path.match(/^\/npcs\/[\w-]+\/memory$/)`. Source: `supabase/functions/npcs/index.ts:521`.


```ts
{
      const id = path.split("/")[2]
      const body = await req.json()
      const npc = await addMemory(id, body.memory)
      
      return new Response(JSON.stringify(npc), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### npcs:9

Predicate: `req.method === "GET" && path.match(/^\/npcs\/[\w-]+\/memories$/)`. Source: `supabase/functions/npcs/index.ts:532`.


```ts
{
      const id = path.split("/")[2]
      const limit = parseInt(url.searchParams.get('limit') || '10')
      const memories = await getMemories(id, limit)
      
      return new Response(JSON.stringify(memories), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### npcs:10

Predicate: `req.method === "POST" && path.match(/^\/npcs\/[\w-]+\/relationship$/)`. Source: `supabase/functions/npcs/index.ts:543`.


```ts
{
      const id = path.split("/")[2]
      const body = await req.json()
      const npc = await setRelationship(id, body.targetId, body.relationship)
      
      return new Response(JSON.stringify(npc), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### npcs:11

Predicate: `req.method === "GET" && path.match(/^\/npcs\/[\w-]+\/relationships$/)`. Source: `supabase/functions/npcs/index.ts:554`.


```ts
{
      const id = path.split("/")[2]
      const relationships = await getRelationships(id)
      
      return new Response(JSON.stringify(relationships), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### npcs:12

Predicate: `req.method === "POST" && path.match(/^\/npcs\/[\w-]+\/dialogue$/)`. Source: `supabase/functions/npcs/index.ts:564`.


```ts
{
      const id = path.split("/")[2]
      const body = await req.json()
      const dialogue = await addDialogue(id, body)
      
      return new Response(JSON.stringify(dialogue), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### npcs:13

Predicate: `req.method === "GET" && path.match(/^\/npcs\/[\w-]+\/dialogues$/)`. Source: `supabase/functions/npcs/index.ts:575`.


```ts
{
      const id = path.split("/")[2]
      const dialogues = await getDialogues(id)
      
      return new Response(JSON.stringify(dialogues), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### npcs:14

Predicate: `req.method === "GET" && path.match(/^\/npcs\/[\w-]+\/export$/)`. Source: `supabase/functions/npcs/index.ts:585`.


```ts
{
      const id = path.split("/")[2]
      const npc = await exportNPC(id)
      
      return new Response(JSON.stringify(npc), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### npcs:15

Predicate: `req.method === "POST" && path === "/npcs/import"`. Source: `supabase/functions/npcs/index.ts:595`.


```ts
{
      const body = await req.json()
      const npc = await importNPC(body)
      
      return new Response(JSON.stringify(npc), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
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

### NPC

`supabase/functions/npcs/index.ts:21`

```ts
interface NPC {
  id: string
  name: string
  type: 'npc' | 'monster' | 'creature'
  race?: string
  class?: string
  level?: number
  hp: number
  maxHp: number
  ac: number
  speed?: number
  description?: string
  disposition: 'friendly' | 'neutral' | 'hostile' | 'unknown'
  location?: string
  memories: string[]
  relationships: Record<string, string>
  stats?: NPCStats
  abilities?: string[]
  actions?: string[]
  inventory: string[]
  portrait?: string
  notes?: string
  tags: string[]
  createdAt: string
  updatedAt: string
}
```

### NPCStats

`supabase/functions/npcs/index.ts:48`

```ts
interface NPCStats {
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
}
```

### DialogueLine

`supabase/functions/npcs/index.ts:57`

```ts
interface DialogueLine {
  id: string
  npcId: string
  trigger: string
  text: string
  conditions?: string[]
  responses?: DialogueResponse[]
  tags: string[]
}
```

### DialogueResponse

`supabase/functions/npcs/index.ts:67`

```ts
interface DialogueResponse {
  text: string
  nextDialogueId?: string
  effect?: string
}
```

### NPCGenerator

`supabase/functions/npcs/index.ts:73`

```ts
interface NPCGenerator {
  name: string
  race: string
  class: string
  level: number
  disposition: 'friendly' | 'neutral' | 'hostile'
  location: string
  description: string
}
```


## Exact validation, defaults and helper behavior

### generateId

`supabase/functions/npcs/index.ts:137`

```ts
function generateId(): string {
  return crypto.randomUUID()
}
```

### randomFrom

`supabase/functions/npcs/index.ts:141`

```ts
function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
```

### generateName

`supabase/functions/npcs/index.ts:145`

```ts
function generateName(race: string = 'human', gender: 'male' | 'female' = 'male'): string {
  const raceNames = NAMES[race.toLowerCase() as keyof typeof NAMES] || NAMES.human
  return randomFrom(raceNames[gender] || raceNames.male)
}
```

### generateStats

`supabase/functions/npcs/index.ts:150`

```ts
function generateStats(): NPCStats {
  return {
    strength: Math.floor(Math.random() * 15) + 3,
    dexterity: Math.floor(Math.random() * 15) + 3,
    constitution: Math.floor(Math.random() * 15) + 3,
    intelligence: Math.floor(Math.random() * 15) + 3,
    wisdom: Math.floor(Math.random() * 15) + 3,
    charisma: Math.floor(Math.random() * 15) + 3,
  }
}
```

### generateDescription

`supabase/functions/npcs/index.ts:161`

```ts
function generateDescription(npc: Partial<NPC>): string {
  const traits: string[] = []
  
  if (npc.race) traits.push(`is a ${npc.race}`)
  if (npc.class) traits.push(`${npc.class}`)
  if (npc.level) traits.push(`level ${npc.level}`)
  
  const personality = randomFrom(PERSONALITY_TRAITS)
  const physical = randomFrom(PHYSICAL_TRAITS)
  
  return `${npc.name || 'This NPC'} ${traits.join(', ')}. They ${personality} and ${physical}.`
}
```

### createNPC

`supabase/functions/npcs/index.ts:178`

```ts
async function createNPC(data: Partial<NPC>): Promise<NPC> {
  const id = generateId()
  const now = new Date().toISOString()
  
  const npc: NPC = {
    id,
    name: data.name || 'Unknown',
    type: data.type || 'npc',
    race: data.race || 'human',
    class: data.class || 'commoner',
    level: data.level || 1,
    hp: data.hp || 10,
    maxHp: data.maxHp || 10,
    ac: data.ac || 10,
    speed: data.speed || 30,
    description: data.description || '',
    disposition: data.disposition || 'neutral',
    location: data.location || 'Unknown',
    memories: data.memories || [],
    relationships: data.relationships || {},
    stats: data.stats || generateStats(),
    abilities: data.abilities || [],
    actions: data.actions || [],
    inventory: data.inventory || [],
    portrait: data.portrait,
    notes: data.notes,
    tags: data.tags || [],
    createdAt: now,
    updatedAt: now,
  }
  
  if (!npc.description) {
    npc.description = generateDescription(npc)
  }
  
  npcs.set(id, npc)
  return npc
}
```

### getNPC

`supabase/functions/npcs/index.ts:217`

```ts
async function getNPC(id: string): Promise<NPC | null> {
  return npcs.get(id) || null
}
```

### updateNPC

`supabase/functions/npcs/index.ts:221`

```ts
async function updateNPC(id: string, data: Partial<NPC>): Promise<NPC> {
  const npc = npcs.get(id)
  if (!npc) throw new Error("NPC not found")
  
  const updated: NPC = {
    ...npc,
    ...data,
    id,
    updatedAt: new Date().toISOString(),
  }
  
  npcs.set(id, updated)
  return updated
}
```

### deleteNPC

`supabase/functions/npcs/index.ts:236`

```ts
async function deleteNPC(id: string): Promise<void> {
  npcs.delete(id)
  dialogues.delete(id)
}
```

### listNPCs

`supabase/functions/npcs/index.ts:241`

```ts
async function listNPCs(filter?: { type?: string; location?: string; disposition?: string }): Promise<NPC[]> {
  let all = Array.from(npcs.values())
  
  if (filter?.type) {
    all = all.filter(n => n.type === filter.type)
  }
  if (filter?.location) {
    all = all.filter(n => n.location === filter.location)
  }
  if (filter?.disposition) {
    all = all.filter(n => n.disposition === filter.disposition)
  }
  
  return all
}
```

### generateNPC

`supabase/functions/npcs/index.ts:261`

```ts
async function generateNPC(options: {
  type?: 'npc' | 'monster' | 'creature'
  race?: string
  class?: string
  level?: number
  location?: string
  prompt?: string
}): Promise<NPC> {
  const race = options.race || randomFrom(Object.keys(NAMES))
  const gender = Math.random() > 0.5 ? 'male' : 'female'
  const name = generateName(race, gender)
  const npcClass = options.class || randomFrom(CLASSES)
  const level = options.level || Math.floor(Math.random() * 10) + 1
  const disposition = randomFrom(DISPOSITIONS)
  const location = options.location || randomFrom(LOCATIONS)
  
  // Calculate HP based on class and level
  const hitDie: Record<string, number> = {
    'Barbarian': 12, 'Fighter': 10, 'Paladin': 10, 'Ranger': 10,
    'Bard': 8, 'Cleric': 8, 'Druid': 8, 'Monk': 8, 'Rogue': 8, 'Warlock': 8,
    'Sorcerer': 6, 'Wizard': 6,
  }
  const hd = hitDie[npcClass] || 8
  const conMod = Math.floor((Math.floor(Math.random() * 15) + 3 - 10) / 2)
  const maxHp = hd + conMod + (level - 1) * (Math.floor(hd / 2) + 1 + conMod)
  
  return createNPC({
    name,
    type: options.type || 'npc',
    race,
    class: npcClass,
    level,
    hp: maxHp,
    maxHp,
    ac: Math.floor(Math.random() * 6) + 12,
    disposition,
    location,
    memories: [],
    relationships: {},
    stats: generateStats(),
    tags: [race.toLowerCase(), npcClass.toLowerCase(), disposition],
  })
}
```

### addMemory

`supabase/functions/npcs/index.ts:309`

```ts
async function addMemory(npcId: string, memory: string): Promise<NPC> {
  const npc = npcs.get(npcId)
  if (!npc) throw new Error("NPC not found")
  
  npc.memories.push(memory)
  npc.updatedAt = new Date().toISOString()
  
  npcs.set(npcId, npc)
  return npc
}
```

### getMemories

`supabase/functions/npcs/index.ts:320`

```ts
async function getMemories(npcId: string, limit?: number): Promise<string[]> {
  const npc = npcs.get(npcId)
  if (!npc) throw new Error("NPC not found")
  
  const all = npc.memories
  return limit ? all.slice(-limit) : all
}
```

### setRelationship

`supabase/functions/npcs/index.ts:332`

```ts
async function setRelationship(npcId: string, targetId: string, relationship: string): Promise<NPC> {
  const npc = npcs.get(npcId)
  if (!npc) throw new Error("NPC not found")
  
  npc.relationships[targetId] = relationship
  npc.updatedAt = new Date().toISOString()
  
  npcs.set(npcId, npc)
  return npc
}
```

### getRelationships

`supabase/functions/npcs/index.ts:343`

```ts
async function getRelationships(npcId: string): Promise<Record<string, string>> {
  const npc = npcs.get(npcId)
  if (!npc) throw new Error("NPC not found")
  
  return npc.relationships
}
```

### addDialogue

`supabase/functions/npcs/index.ts:354`

```ts
async function addDialogue(npcId: string, dialogue: Omit<DialogueLine, 'id' | 'npcId'>): Promise<DialogueLine> {
  const id = generateId()
  const line: DialogueLine = {
    id,
    npcId,
    ...dialogue,
  }
  
  const npcDialogues = dialogues.get(npcId) || []
  npcDialogues.push(line)
  dialogues.set(npcId, npcDialogues)
  
  return line
}
```

### getDialogues

`supabase/functions/npcs/index.ts:369`

```ts
async function getDialogues(npcId: string): Promise<DialogueLine[]> {
  return dialogues.get(npcId) || []
}
```

### getDialogueByTrigger

`supabase/functions/npcs/index.ts:373`

```ts
async function getDialogueByTrigger(npcId: string, trigger: string): Promise<DialogueLine | null> {
  const npcDialogues = dialogues.get(npcId) || []
  return npcDialogues.find(d => d.trigger === trigger) || null
}
```

### exportNPC

`supabase/functions/npcs/index.ts:382`

```ts
async function exportNPC(npcId: string): Promise<NPC> {
  const npc = npcs.get(npcId)
  if (!npc) throw new Error("NPC not found")
  return JSON.parse(JSON.stringify(npc))
}
```

### importNPC

`supabase/functions/npcs/index.ts:388`

```ts
async function importNPC(data: Partial<NPC>): Promise<NPC> {
  const id = generateId()
  const now = new Date().toISOString()
  
  const npc: NPC = {
    id,
    name: data.name || 'Unknown',
    type: data.type || 'npc',
    race: data.race || 'human',
    class: data.class || 'commoner',
    level: data.level || 1,
    hp: data.hp || 10,
    maxHp: data.maxHp || 10,
    ac: data.ac || 10,
    speed: data.speed || 30,
    description: data.description || '',
    disposition: data.disposition || 'neutral',
    location: data.location || 'Unknown',
    memories: data.memories || [],
    relationships: data.relationships || {},
    stats: data.stats || generateStats(),
    abilities: data.abilities || [],
    actions: data.actions || [],
    inventory: data.inventory || [],
    portrait: data.portrait,
    notes: data.notes,
    tags: data.tags || [],
    createdAt: now,
    updatedAt: now,
  }
  
  npcs.set(id, npc)
  return npc
}
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `supabase/functions/_shared/cors.ts` | `f8286c91d79fa5fc5cfea2fa47081916523fa7a440f234aecd9a47c6a8cf5b38` |
| `supabase/functions/_shared/edge-dispatcher-allowlist.ts` | `6d1ae7bde0ba9e41fcaa7b61247732168a62699e7811fb8574cef266cfad3a27` |
| `supabase/functions/_shared/edge-jwt-gate.ts` | `14a871697b051b7fcbee09dbce1dee8bc8ed5ea6a6eca0bec7b2e771b32d0f0c` |
| `supabase/functions/main/index.ts` | `92f3bf56bf3c776e01595d980246079c4a9f8775e417959abea9d7da003bc53e` |
| `supabase/functions/npcs/index.ts` | `b6977fface56851f37ad76d698f6a8167d62a42e1286181bd6e359ad06e8a70c` |

