# Edge contract: bestiary

**Status: SPEC; current branch source verified.** Implementation issue: **#819**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [edge-bestiary.json](source-contracts/edge-bestiary.json) (SHA-256 `fc7814bc55918b3f311db1569a4842e914069068b444f0a861437ef3fae3f435`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Exposure and purpose

**legacy-unmounted** — Preserve external 404; no automatic host route or public activation.

Historical seeded monster catalog and random encounter calculator, held in process Maps.

Dispatcher denies bestiary with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps.

## Request variants, fields and defaults

- **monster:** POST /monsters Partial<Monster>; all fields/types copied in schema appendix. Defaults name Unknown,type beast,size medium,CR0,xp calculated,hp10,hitDice2d6,ac10,speed.walk30,each ability10,senses[passive Perception10],languages/actions[],source custom. Falsy values use || fallback.
- **listSearch:** GET /monsters?type&cr(parseFloat)&size; /monsters/search?q(default empty), single /monsters/:id
- **encounter:** POST /encounters {name:string,description?:string,monsters:{monsterId:string,count:number}[],partySize:number,partyLevel:number,environment?:string}; absent monster IDs silently skipped for XP/returned list but still contribute to multiplier count
- **generate:** POST /encounters/generate {difficulty?:easy|medium|hard|deadly(default medium),partySize?:number(default4),partyLevel?:number(default1),environment?:string}; GET /encounters?difficulty and /encounters/:id

## Success and error contracts

- **resources:** Monster/Monster[] and Encounter/Encounter[] JSON200; exact MonsterAction and Encounter nested shapes in appendix
- **calculation:** Encounter totalXP=sum(known monster.xp*count); multiplier1/1.5/2/2.5/3/4 by total requested count, adjustedXP=floor(total*multiplier); calculateDifficulty source thresholds are retained

- External endpoint always404 {error:'Not found'}, including OPTIONS; no historical code executes through main.
- In isolated source fixtures, OPTIONS204 shared CORS; unmatched route/method404 {error:'Not found'}; missing single resource404 where explicit branch exists. Thrown missing/invalid body/helper errors500 {error:'Internal server error',message:string}; fields and exact branch exceptions are enumerated in response sites.

## Side effects and transaction boundaries

- monsters and encounters Maps mutate; SRD seed loads on worker initialization. Random generator calls Math.random and stores generated encounter. No DB, storage or provider calls.

## Quota, environment and transport


```json
{
  "kind": "none",
  "scope": "No historical worker quota, persistence counter, retry budget or per-user scope exists."
}
```

Historical path strips /functions/v1/bestiary; no independent request-body ceiling or retry policy. All exact paths, method predicates, query/body reads, defaults and serialized response expressions are materialized in source evidence. No worker-specific abort timeout. No external network requests.

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

`supabase/functions/bestiary/index.ts:7`

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

- All bestiary paths remain dispatcher404 without Map initialization.
- Isolated create/list/search/encounter fixture checks every Monster default, CR parsing, unknown monster skipping and requested-count multiplier.
- Negative count/XP/party size and unknown difficulty require bounded explicit validation in any separately approved replacement; generator is not authorized for public deployment.

## Observed legacy defects and explicit successor decisions

- No authentication or schema validation; requested monster count and known monster list differ in XP adjustment. Nonpositive/invalid generator data is unbounded.

## All adapter call sites

No src/infrastructure caller in the reviewed branch. This does not authorize adding a public mount.

## Exact ordered operations

### bestiary:1

Predicate: `req.method === "GET" && path === "/health"`. Source: `supabase/functions/bestiary/index.ts:548`.


```ts
{
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        features: ['monsters', 'encounters', 'generation', 'search'],
        monsterCount: monsters.size,
      }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### bestiary:2

Predicate: `req.method === "GET" && path === "/monsters"`. Source: `supabase/functions/bestiary/index.ts:560`.


```ts
{
      const filters = {
        type: url.searchParams.get('type') || undefined,
        cr: url.searchParams.get('cr') ? parseFloat(url.searchParams.get('cr')!) : undefined,
        size: url.searchParams.get('size') || undefined,
      }
      const list = await listMonsters(filters)
      
      return new Response(JSON.stringify(list), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### bestiary:3

Predicate: `req.method === "GET" && path === "/monsters/search"`. Source: `supabase/functions/bestiary/index.ts:574`.


```ts
{
      const query = url.searchParams.get('q') || ''
      const results = await searchMonsters(query)
      
      return new Response(JSON.stringify(results), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### bestiary:4

Predicate: `req.method === "GET" && path.match(/^\/monsters\/[\w-]+$/)`. Source: `supabase/functions/bestiary/index.ts:584`.


```ts
{
      const id = path.split("/")[2]
      const monster = await getMonster(id)
      
      if (!monster) {
        return new Response(JSON.stringify({ error: "Monster not found" }), {
          status: 404,
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
      
      return new Response(JSON.stringify(monster), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### bestiary:5

Predicate: `req.method === "POST" && path === "/monsters"`. Source: `supabase/functions/bestiary/index.ts:601`.


```ts
{
      const body = await req.json()
      const monster = await createMonster(body)
      
      return new Response(JSON.stringify(monster), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### bestiary:6

Predicate: `req.method === "POST" && path === "/encounters"`. Source: `supabase/functions/bestiary/index.ts:611`.


```ts
{
      const body = await req.json()
      const encounter = await createEncounter(body)
      
      return new Response(JSON.stringify(encounter), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### bestiary:7

Predicate: `req.method === "GET" && path.match(/^\/encounters\/[\w-]+$/)`. Source: `supabase/functions/bestiary/index.ts:621`.


```ts
{
      const id = path.split("/")[2]
      const encounter = await getEncounter(id)
      
      if (!encounter) {
        return new Response(JSON.stringify({ error: "Encounter not found" }), {
          status: 404,
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
      
      return new Response(JSON.stringify(encounter), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### bestiary:8

Predicate: `req.method === "GET" && path === "/encounters"`. Source: `supabase/functions/bestiary/index.ts:638`.


```ts
{
      const difficulty = url.searchParams.get('difficulty') || undefined
      const list = await listEncounters(difficulty as 'easy' | 'medium' | 'hard' | 'deadly' | undefined)
      
      return new Response(JSON.stringify(list), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### bestiary:9

Predicate: `req.method === "POST" && path === "/encounters/generate"`. Source: `supabase/functions/bestiary/index.ts:648`.


```ts
{
      const body = await req.json()
      const encounter = await generateEncounter({
        difficulty: body.difficulty || 'medium',
        partySize: body.partySize || 4,
        partyLevel: body.partyLevel || 1,
        environment: body.environment,
      })
      
      return new Response(JSON.stringify(encounter), {
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

### Monster

`supabase/functions/bestiary/index.ts:21`

```ts
interface Monster {
  id: string
  name: string
  type: string
  size: 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan'
  challengeRating: number
  xp: number
  hp: number
  hitDice: string
  ac: number
  armorType?: string
  speed: Record<string, number>
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
  savingThrows?: Record<string, number>
  skills?: Record<string, number>
  damageVulnerabilities?: string[]
  damageResistances?: string[]
  damageImmunities?: string[]
  conditionImmunities?: string[]
  senses: string[]
  languages: string[]
  challengeRatingText: string
  specialTraits?: string[]
  actions: MonsterAction[]
  legendaryActions?: MonsterAction[]
  reactions?: MonsterAction[]
  description?: string
  environment?: string[]
  source: string
}
```

### MonsterAction

`supabase/functions/bestiary/index.ts:57`

```ts
interface MonsterAction {
  name: string
  description: string
  attackBonus?: number
  damage?: string
  damageType?: string
  recharge?: string
  legendaryCost?: number
}
```

### Encounter

`supabase/functions/bestiary/index.ts:67`

```ts
interface Encounter {
  id: string
  name: string
  description?: string
  monsters: Array<{
    monsterId: string
    name: string
    count: number
    xp: number
  }>
  totalXP: number
  adjustedXP: number
  difficulty: 'easy' | 'medium' | 'hard' | 'deadly'
  partySize: number
  partyLevel: number
  environment?: string
  createdAt: string
}
```


## Exact validation, defaults and helper behavior

### generateId

`supabase/functions/bestiary/index.ts:296`

```ts
function generateId(): string {
  return crypto.randomUUID()
}
```

### calculateXP

`supabase/functions/bestiary/index.ts:300`

```ts
function calculateXP(cr: number): number {
  const xpTable: Record<number, number> = {
    0: 10, 0.125: 25, 0.25: 50, 0.5: 100,
    1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800,
    6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
    11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
    16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000,
    21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000,
    26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000,
  }
  return xpTable[cr] || 0
}
```

### calculateDifficulty

`supabase/functions/bestiary/index.ts:313`

```ts
function calculateDifficulty(xp: number, partySize: number, partyLevel: number): 'easy' | 'medium' | 'hard' | 'deadly' {
  const thresholds = {
    easy: 25 * partyLevel * partySize,
    medium: 50 * partyLevel * partySize,
    hard: 75 * partyLevel * partySize,
    deadly: 100 * partyLevel * partySize,
  }
  
  if (xp <= thresholds.easy) return 'easy'
  if (xp <= thresholds.medium) return 'medium'
  if (xp <= thresholds.hard) return 'hard'
  return 'deadly'
}
```

### listMonsters

`supabase/functions/bestiary/index.ts:331`

```ts
async function listMonsters(filters?: { type?: string; cr?: number; size?: string }): Promise<Monster[]> {
  let all = Array.from(monsters.values())
  
  if (filters?.type) {
    all = all.filter(m => m.type.toLowerCase() === filters.type!.toLowerCase())
  }
  if (filters?.cr !== undefined) {
    all = all.filter(m => m.challengeRating === filters.cr)
  }
  if (filters?.size) {
    all = all.filter(m => m.size === filters.size)
  }
  
  return all.sort((a, b) => a.challengeRating - b.challengeRating)
}
```

### getMonster

`supabase/functions/bestiary/index.ts:347`

```ts
async function getMonster(id: string): Promise<Monster | null> {
  return monsters.get(id) || null
}
```

### createMonster

`supabase/functions/bestiary/index.ts:351`

```ts
async function createMonster(data: Partial<Monster>): Promise<Monster> {
  const id = generateId()
  
  const monster: Monster = {
    id,
    name: data.name || 'Unknown',
    type: data.type || 'beast',
    size: data.size || 'medium',
    challengeRating: data.challengeRating || 0,
    xp: data.xp || calculateXP(data.challengeRating || 0),
    hp: data.hp || 10,
    hitDice: data.hitDice || '2d6',
    ac: data.ac || 10,
    armorType: data.armorType,
    speed: data.speed || { walk: 30 },
    strength: data.strength || 10,
    dexterity: data.dexterity || 10,
    constitution: data.constitution || 10,
    intelligence: data.intelligence || 10,
    wisdom: data.wisdom || 10,
    charisma: data.charisma || 10,
    savingThrows: data.savingThrows,
    skills: data.skills,
    damageVulnerabilities: data.damageVulnerabilities,
    damageResistances: data.damageResistances,
    damageImmunities: data.damageImmunities,
    conditionImmunities: data.conditionImmunities,
    senses: data.senses || ['passive Perception 10'],
    languages: data.languages || [],
    challengeRatingText: data.challengeRatingText || String(data.challengeRating || 0),
    specialTraits: data.specialTraits,
    actions: data.actions || [],
    legendaryActions: data.legendaryActions,
    reactions: data.reactions,
    description: data.description,
    environment: data.environment,
    source: data.source || 'custom',
  }
  
  monsters.set(id, monster)
  return monster
}
```

### searchMonsters

`supabase/functions/bestiary/index.ts:394`

```ts
async function searchMonsters(query: string): Promise<Monster[]> {
  const lowerQuery = query.toLowerCase()
  
  return Array.from(monsters.values()).filter(m =>
    m.name.toLowerCase().includes(lowerQuery) ||
    m.type.toLowerCase().includes(lowerQuery) ||
    (m.description && m.description.toLowerCase().includes(lowerQuery))
  )
}
```

### createEncounter

`supabase/functions/bestiary/index.ts:408`

```ts
async function createEncounter(data: {
  name: string
  description?: string
  monsters: Array<{ monsterId: string; count: number }>
  partySize: number
  partyLevel: number
  environment?: string
}): Promise<Encounter> {
  const id = generateId()
  
  // Calculate XP
  let totalXP = 0
  const encounterMonsters: Encounter['monsters'] = []
  
  for (const m of data.monsters) {
    const monster = monsters.get(m.monsterId)
    if (monster) {
      const xp = monster.xp * m.count
      totalXP += xp
      encounterMonsters.push({
        monsterId: m.monsterId,
        name: monster.name,
        count: m.count,
        xp: monster.xp,
      })
    }
  }
  
  // Adjust XP for number of monsters
  const monsterCount = data.monsters.reduce((sum, m) => sum + m.count, 0)
  let multiplier = 1
  if (monsterCount === 2) multiplier = 1.5
  else if (monsterCount >= 3 && monsterCount <= 6) multiplier = 2
  else if (monsterCount >= 7 && monsterCount <= 10) multiplier = 2.5
  else if (monsterCount >= 11 && monsterCount <= 14) multiplier = 3
  else if (monsterCount >= 15) multiplier = 4
  
  const adjustedXP = Math.floor(totalXP * multiplier)
  const difficulty = calculateDifficulty(adjustedXP, data.partySize, data.partyLevel)
  
  const encounter: Encounter = {
    id,
    name: data.name,
    description: data.description,
    monsters: encounterMonsters,
    totalXP,
    adjustedXP,
    difficulty,
    partySize: data.partySize,
    partyLevel: data.partyLevel,
    environment: data.environment,
    createdAt: new Date().toISOString(),
  }
  
  encounters.set(id, encounter)
  return encounter
}
```

### getEncounter

`supabase/functions/bestiary/index.ts:466`

```ts
async function getEncounter(id: string): Promise<Encounter | null> {
  return encounters.get(id) || null
}
```

### listEncounters

`supabase/functions/bestiary/index.ts:470`

```ts
async function listEncounters(difficulty?: string): Promise<Encounter[]> {
  let all = Array.from(encounters.values())
  
  if (difficulty) {
    all = all.filter(e => e.difficulty === difficulty)
  }
  
  return all
}
```

### generateEncounter

`supabase/functions/bestiary/index.ts:480`

```ts
async function generateEncounter(params: {
  difficulty: 'easy' | 'medium' | 'hard' | 'deadly'
  partySize: number
  partyLevel: number
  environment?: string
}): Promise<Encounter> {
  // Calculate XP budget
  const xpThresholds = {
    easy: 25 * params.partyLevel * params.partySize,
    medium: 50 * params.partyLevel * params.partySize,
    hard: 75 * params.partyLevel * params.partySize,
    deadly: 100 * params.partyLevel * params.partySize,
  }
  
  const budget = xpThresholds[params.difficulty]
  
  // Filter monsters by CR (appropriate for party level)
  const appropriateCRs = [params.partyLevel - 1, params.partyLevel, params.partyLevel + 1]
    .filter(cr => cr >= 0)
  
  const availableMonsters = Array.from(monsters.values()).filter(m =>
    appropriateCRs.includes(m.challengeRating) &&
    (!params.environment || (m.environment && m.environment.includes(params.environment)))
  )
  
  // Build encounter
  const selectedMonsters: Array<{ monsterId: string; count: number }> = []
  let currentXP = 0
  
  while (currentXP < budget && availableMonsters.length > 0) {
    // Pick a random monster
    const monster = availableMonsters[Math.floor(Math.random() * availableMonsters.length)]
    
    // Calculate how many we can add
    const maxCount = Math.floor((budget - currentXP) / monster.xp)
    if (maxCount < 1) break
    
    const count = Math.min(maxCount, 6) // Max 6 of any monster
    
    selectedMonsters.push({ monsterId: monster.id, count })
    currentXP += monster.xp * count
  }
  
  return createEncounter({
    name: `${params.difficulty.charAt(0).toUpperCase() + params.difficulty.slice(1)} Encounter`,
    description: `A ${params.difficulty} encounter for a party of ${params.partySize} level ${params.partyLevel} adventurers`,
    monsters: selectedMonsters,
    partySize: params.partySize,
    partyLevel: params.partyLevel,
    environment: params.environment,
  })
}
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `supabase/functions/_shared/cors.ts` | `f8286c91d79fa5fc5cfea2fa47081916523fa7a440f234aecd9a47c6a8cf5b38` |
| `supabase/functions/_shared/edge-dispatcher-allowlist.ts` | `6d1ae7bde0ba9e41fcaa7b61247732168a62699e7811fb8574cef266cfad3a27` |
| `supabase/functions/_shared/edge-jwt-gate.ts` | `14a871697b051b7fcbee09dbce1dee8bc8ed5ea6a6eca0bec7b2e771b32d0f0c` |
| `supabase/functions/bestiary/index.ts` | `b1c116175dd85d93685972b1188eb2499153ac581e65cb1c30ac25f2ea8fe444` |
| `supabase/functions/main/index.ts` | `92f3bf56bf3c776e01595d980246079c4a9f8775e417959abea9d7da003bc53e` |

