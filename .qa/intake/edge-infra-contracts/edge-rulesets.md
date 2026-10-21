# Edge contract: rulesets

**Status: SPEC; current branch source verified.** Implementation issue: **#835**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [edge-rulesets.json](source-contracts/edge-rulesets.json) (SHA-256 `8c482bf31152b6eda6bd77e2ecd44a5799d0e8d58dd0030792faa6835cdc1de8`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Exposure and purpose

**legacy-unmounted** — Preserve external 404; no automatic host route or public activation.

Historical seeded ruleset Map with optional Open5e enrichment, separate from current rulesets-table adapter.

Dispatcher denies rulesets with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps.

## Request variants, fields and defaults

- **catalog:** GET /rulesets; POST /rulesets Partial<Ruleset>; GET /rulesets/:id?enrich=true; id supplied or custom-Date.now, name Custom Ruleset,version1.0,empty maps/conditions,standard six abilities/seven dice,source custom,isOfficial false,isCustom true
- **supplements:** GET /rulesets/:id/spells?level(parseInt)&school&class; /monsters?type&cr(parseFloat); /items?type; /skills,/conditions,/classes,/races. enrich only equals literal true

## Success and error contracts

- **resources:** Ruleset/Ruleset[], Spell/Monster/Item arrays; nested skills/classes/races objects or {}, conditions[] even absent parent. Single absent ruleset404. Exact public types and Open5e field mapping in appendix
- **enrich:** Open5e results merged for eligible ruleset; provider fetch errors converted to empty result arrays

- External endpoint always404 {error:'Not found'}, including OPTIONS; no historical code executes through main.
- In isolated source fixtures, OPTIONS204 shared CORS; unmatched route/method404 {error:'Not found'}; missing single resource404 where explicit branch exists. Thrown missing/invalid body/helper errors500 {error:'Internal server error',message:string}; fields and exact branch exceptions are enumerated in response sites.

## Side effects and transaction boundaries

- rulesets Map create/enrichment cache; GET https://api.open5e.com/spells/?limit=500, /monsters/?limit=500, /weapons/?limit=500; no database/storage writes.

## Quota, environment and transport


```json
{
  "kind": "none",
  "scope": "No historical worker quota, persistence counter, retry budget or per-user scope exists."
}
```

Historical path strips /functions/v1/rulesets; no independent request-body ceiling or retry policy. All exact paths, method predicates, query/body reads, defaults and serialized response expressions are materialized in source evidence. No worker-specific abort timeout. Open5e GET failures produce empty arrays; three enrichment requests run in Promise.all.

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

`supabase/functions/rulesets/index.ts:7`

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

- rulesets and supplemental routes stay dispatcher404.
- Isolated fixture checks defaults, enrich=true behavior and exact Open5e mapping; no network request during ordinary non-enrich catalog read.
- HTTP failure/bad JSON produces empty supplement arrays; no assumption that limit500 follows pagination or includes all remote records.

## Observed legacy defects and explicit successor decisions

- No auth, owner model or creation validation; Open5e fetches have no explicit timeout/status check/pagination. Caller-supplied ID can overwrite a Map entry.

## All adapter call sites

No src/infrastructure caller in the reviewed branch. This does not authorize adding a public mount.

## Exact ordered operations

### rulesets:1

Predicate: `req.method === "GET" && path === "/health"`. Source: `supabase/functions/rulesets/index.ts:577`.


```ts
{
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        features: ['rulesets', 'skills', 'conditions', 'classes', 'races', 'spells', 'monsters', 'items', 'open5e'],
        rulesetCount: rulesets.size,
      }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### rulesets:2

Predicate: `req.method === "GET" && path === "/rulesets"`. Source: `supabase/functions/rulesets/index.ts:589`.


```ts
{
      const list = await listRulesets()
      return new Response(JSON.stringify(list), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### rulesets:3

Predicate: `req.method === "POST" && path === "/rulesets"`. Source: `supabase/functions/rulesets/index.ts:597`.


```ts
{
      const body = await req.json()
      const ruleset = await createRuleset(body)
      return new Response(JSON.stringify(ruleset), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### rulesets:4

Predicate: `req.method === "GET" && path.match(/^\/rulesets\/[\w-]+$/)`. Source: `supabase/functions/rulesets/index.ts:606`.


```ts
{
      const id = path.split("/")[2]
      const enrich = url.searchParams.get('enrich') === 'true'
      const ruleset = await getRuleset(id, enrich)
      
      if (!ruleset) {
        return new Response(JSON.stringify({ error: "Ruleset not found" }), {
          status: 404,
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
      
      return new Response(JSON.stringify(ruleset), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### rulesets:5

Predicate: `req.method === "GET" && path.match(/^\/rulesets\/[\w-]+\/spells$/)`. Source: `supabase/functions/rulesets/index.ts:624`.


```ts
{
      const id = path.split("/")[2]
      const filter = {
        level: url.searchParams.get('level') ? parseInt(url.searchParams.get('level')!) : undefined,
        school: url.searchParams.get('school') || undefined,
        class: url.searchParams.get('class') || undefined,
      }
      const spells = await getSpells(id, filter)
      return new Response(JSON.stringify(spells), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### rulesets:6

Predicate: `req.method === "GET" && path.match(/^\/rulesets\/[\w-]+\/monsters$/)`. Source: `supabase/functions/rulesets/index.ts:638`.


```ts
{
      const id = path.split("/")[2]
      const filter = {
        type: url.searchParams.get('type') || undefined,
        cr: url.searchParams.get('cr') ? parseFloat(url.searchParams.get('cr')!) : undefined,
      }
      const monsters = await getMonsters(id, filter)
      return new Response(JSON.stringify(monsters), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### rulesets:7

Predicate: `req.method === "GET" && path.match(/^\/rulesets\/[\w-]+\/items$/)`. Source: `supabase/functions/rulesets/index.ts:651`.


```ts
{
      const id = path.split("/")[2]
      const filter = {
        type: url.searchParams.get('type') || undefined,
      }
      const items = await getItems(id, filter)
      return new Response(JSON.stringify(items), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### rulesets:8

Predicate: `req.method === "GET" && path.match(/^\/rulesets\/[\w-]+\/skills$/)`. Source: `supabase/functions/rulesets/index.ts:663`.


```ts
{
      const id = path.split("/")[2]
      const ruleset = rulesets.get(id)
      return new Response(JSON.stringify(ruleset?.skills || {}), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### rulesets:9

Predicate: `req.method === "GET" && path.match(/^\/rulesets\/[\w-]+\/conditions$/)`. Source: `supabase/functions/rulesets/index.ts:672`.


```ts
{
      const id = path.split("/")[2]
      const ruleset = rulesets.get(id)
      return new Response(JSON.stringify(ruleset?.conditions || []), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### rulesets:10

Predicate: `req.method === "GET" && path.match(/^\/rulesets\/[\w-]+\/classes$/)`. Source: `supabase/functions/rulesets/index.ts:681`.


```ts
{
      const id = path.split("/")[2]
      const ruleset = rulesets.get(id)
      return new Response(JSON.stringify(ruleset?.classes || {}), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### rulesets:11

Predicate: `req.method === "GET" && path.match(/^\/rulesets\/[\w-]+\/races$/)`. Source: `supabase/functions/rulesets/index.ts:690`.


```ts
{
      const id = path.split("/")[2]
      const ruleset = rulesets.get(id)
      return new Response(JSON.stringify(ruleset?.races || {}), {
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

### Ruleset

`supabase/functions/rulesets/index.ts:21`

```ts
interface Ruleset {
  id: string
  name: string
  version: string
  description: string
  abilities: string[]
  skills: Record<string, string>
  conditions: string[]
  dice: string[]
  classes: Record<string, ClassInfo>
  races: Record<string, RaceInfo>
  features: Record<string, FeatureInfo>
  spells?: Spell[]
  monsters?: Monster[]
  items?: Item[]
  source: string
  isOfficial: boolean
  isCustom: boolean
}
```

### ClassInfo

`supabase/functions/rulesets/index.ts:41`

```ts
interface ClassInfo {
  hitDie: number
  primaryAbility: string
  saves: string[]
  features?: string[]
  description?: string
  spellcasting?: {
    ability: string
    spellsKnown?: number[]
    spellSlots?: Record<string, number[]>
  }
}
```

### RaceInfo

`supabase/functions/rulesets/index.ts:54`

```ts
interface RaceInfo {
  bonuses: Record<string, number>
  speed: number
  traits?: string[]
  description?: string
  languages?: string[]
}
```

### FeatureInfo

`supabase/functions/rulesets/index.ts:62`

```ts
interface FeatureInfo {
  name: string
  description: string
  level?: number
  source?: string
}
```

### Spell

`supabase/functions/rulesets/index.ts:69`

```ts
interface Spell {
  id: string
  name: string
  level: number
  school: string
  castingTime: string
  range: string
  components: string[]
  duration: string
  description: string
  higherLevels?: string
  classes: string[]
  source: string
}
```

### Monster

`supabase/functions/rulesets/index.ts:84`

```ts
interface Monster {
  id: string
  name: string
  type: string
  size: string
  challengeRating: number
  hp: number
  ac: number
  speed: string
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
  actions: string[]
  source: string
}
```

### Item

`supabase/functions/rulesets/index.ts:103`

```ts
interface Item {
  id: string
  name: string
  type: string
  rarity: string
  weight: number
  cost: string
  description: string
  source: string
}
```


## Exact validation, defaults and helper behavior

### fetchOpen5eSpells

`supabase/functions/rulesets/index.ts:370`

```ts
async function fetchOpen5eSpells(): Promise<Spell[]> {
  try {
    const response = await fetch(`${OPEN5E_API}/spells/?limit=500`)
    const data = await response.json()
    
    return data.results.map((spell: any) => ({
      id: spell.slug,
      name: spell.name,
      level: parseInt(spell.level) || 0,
      school: spell.school,
      castingTime: spell.casting_time,
      range: spell.range,
      components: spell.components.split(',').map((c: string) => c.trim()),
      duration: spell.duration,
      description: spell.desc,
      higherLevels: spell.higher_level,
      classes: spell.dnd_class.split(',').map((c: string) => c.trim().toLowerCase()),
      source: 'Open5e',
    }))
  } catch (error: unknown) {
    console.error('Failed to fetch Open5e spells:', error)
    return []
  }
}
```

### fetchOpen5eMonsters

`supabase/functions/rulesets/index.ts:395`

```ts
async function fetchOpen5eMonsters(): Promise<Monster[]> {
  try {
    const response = await fetch(`${OPEN5E_API}/monsters/?limit=500`)
    const data = await response.json()
    
    return data.results.map((monster: any) => ({
      id: monster.slug,
      name: monster.name,
      type: monster.type,
      size: monster.size,
      challengeRating: parseFloat(monster.cr) || 0,
      hp: monster.hit_points,
      ac: monster.armor_class,
      speed: monster.speed,
      str: monster.strength,
      dex: monster.dexterity,
      con: monster.constitution,
      int: monster.intelligence,
      wis: monster.wisdom,
      cha: monster.charisma,
      actions: [],
      source: 'Open5e',
    }))
  } catch (error: unknown) {
    console.error('Failed to fetch Open5e monsters:', error)
    return []
  }
}
```

### fetchOpen5eItems

`supabase/functions/rulesets/index.ts:424`

```ts
async function fetchOpen5eItems(): Promise<Item[]> {
  try {
    const response = await fetch(`${OPEN5E_API}/weapons/?limit=500`)
    const data = await response.json()
    
    return data.results.map((item: any) => ({
      id: item.slug,
      name: item.name,
      type: 'weapon',
      rarity: 'common',
      weight: 0,
      cost: item.cost,
      description: item.desc || '',
      source: 'Open5e',
    }))
  } catch (error: unknown) {
    console.error('Failed to fetch Open5e items:', error)
    return []
  }
}
```

### enrichRulesetWithOpen5e

`supabase/functions/rulesets/index.ts:446`

```ts
async function enrichRulesetWithOpen5e(rulesetId: string): Promise<Ruleset | null> {
  const ruleset = rulesets.get(rulesetId)
  if (!ruleset) return null
  
  // Only enrich D&D 5e
  if (rulesetId !== 'dnd5e-srd') return ruleset
  
  // Fetch Open5e data
  const [spells, monsters, items] = await Promise.all([
    fetchOpen5eSpells(),
    fetchOpen5eMonsters(),
    fetchOpen5eItems(),
  ])
  
  // Merge into ruleset
  const enriched: Ruleset = {
    ...ruleset,
    spells: [...(ruleset.spells || []), ...spells],
    monsters: [...(ruleset.monsters || []), ...monsters],
    items: [...(ruleset.items || []), ...items],
  }
  
  return enriched
}
```

### listRulesets

`supabase/functions/rulesets/index.ts:475`

```ts
async function listRulesets(): Promise<Ruleset[]> {
  return Array.from(rulesets.values())
}
```

### getRuleset

`supabase/functions/rulesets/index.ts:479`

```ts
async function getRuleset(id: string, enrich: boolean = false): Promise<Ruleset | null> {
  const ruleset = rulesets.get(id)
  if (!ruleset) return null
  
  if (enrich) {
    return enrichRulesetWithOpen5e(id)
  }
  
  return ruleset
}
```

### createRuleset

`supabase/functions/rulesets/index.ts:490`

```ts
async function createRuleset(data: Partial<Ruleset>): Promise<Ruleset> {
  const id = data.id || `custom-${Date.now()}`
  
  const ruleset: Ruleset = {
    id,
    name: data.name || 'Custom Ruleset',
    version: data.version || '1.0',
    description: data.description || '',
    abilities: data.abilities || ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'],
    skills: data.skills || {},
    conditions: data.conditions || [],
    dice: data.dice || ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'],
    classes: data.classes || {},
    races: data.races || {},
    features: data.features || {},
    source: data.source || 'custom',
    isOfficial: false,
    isCustom: true,
  }
  
  rulesets.set(id, ruleset)
  return ruleset
}
```

### getSpells

`supabase/functions/rulesets/index.ts:514`

```ts
async function getSpells(rulesetId: string, filter?: { level?: number; school?: string; class?: string }): Promise<Spell[]> {
  const ruleset = await getRuleset(rulesetId, true)
  if (!ruleset || !ruleset.spells) return []
  
  let spells = ruleset.spells
  
  if (filter?.level !== undefined) {
    spells = spells.filter(s => s.level === filter.level)
  }
  if (filter?.school) {
    spells = spells.filter(s => s.school.toLowerCase() === filter.school!.toLowerCase())
  }
  if (filter?.class) {
    spells = spells.filter(s => s.classes.includes(filter.class!.toLowerCase()))
  }
  
  return spells
}
```

### getMonsters

`supabase/functions/rulesets/index.ts:533`

```ts
async function getMonsters(rulesetId: string, filter?: { type?: string; cr?: number }): Promise<Monster[]> {
  const ruleset = await getRuleset(rulesetId, true)
  if (!ruleset || !ruleset.monsters) return []
  
  let monsters = ruleset.monsters
  
  if (filter?.type) {
    monsters = monsters.filter(m => m.type.toLowerCase() === filter.type!.toLowerCase())
  }
  if (filter?.cr !== undefined) {
    monsters = monsters.filter(m => m.challengeRating === filter.cr)
  }
  
  return monsters
}
```

### getItems

`supabase/functions/rulesets/index.ts:549`

```ts
async function getItems(rulesetId: string, filter?: { type?: string }): Promise<Item[]> {
  const ruleset = await getRuleset(rulesetId, true)
  if (!ruleset || !ruleset.items) return []
  
  let items = ruleset.items
  
  if (filter?.type) {
    items = items.filter(i => i.type === filter.type)
  }
  
  return items
}
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `supabase/functions/_shared/cors.ts` | `f8286c91d79fa5fc5cfea2fa47081916523fa7a440f234aecd9a47c6a8cf5b38` |
| `supabase/functions/_shared/edge-dispatcher-allowlist.ts` | `6d1ae7bde0ba9e41fcaa7b61247732168a62699e7811fb8574cef266cfad3a27` |
| `supabase/functions/_shared/edge-jwt-gate.ts` | `14a871697b051b7fcbee09dbce1dee8bc8ed5ea6a6eca0bec7b2e771b32d0f0c` |
| `supabase/functions/main/index.ts` | `92f3bf56bf3c776e01595d980246079c4a9f8775e417959abea9d7da003bc53e` |
| `supabase/functions/rulesets/index.ts` | `4b753ed274bf0abe01b36c7cce304d6c7b474260c28e30bf7f01465b380d4661` |

