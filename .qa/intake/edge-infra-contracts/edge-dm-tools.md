# Edge contract: dm-tools

**Status: SPEC; current branch source verified.** Implementation issue: **#823**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [edge-dm-tools.json](source-contracts/edge-dm-tools.json) (SHA-256 `f92496156d6fcfd5183522dc438520b2d707002ef0edc4da606e650883a11be2`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Exposure and purpose

**legacy-unmounted** — Preserve external 404; no automatic host route or public activation.

Historical local random dice, ability checks and Map-backed combat tracker; configured Redis URL is unused.

Dispatcher denies dm-tools with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps.

## Request variants, fields and defaults

- **dice:** POST /dice {notation:string,modifier?:number(default0),advantage?:adv|dis|null(defaultnull)}; POST /dice/multiple {rolls:{notation,modifier?,advantage?}[]}; exact dice grammar parseDiceNotation is included
- **combat:** POST /combat/init {sessionId:string,participants:Omit<CombatParticipant,initiative>[]}; GET /combat/:id or /combat/session/:sessionId; POST /:id/next,/end
- **changes:** POST /combat/:id/damage {targetId,damage}, /heal {targetId,healing}, /condition {targetId,condition}; DELETE /condition same body
- **check:** POST /check AbilityCheckRequest {character:{name,modifiers,proficiency?},ability,skill?,dc,advantage?,guidance?}; GET /conditions[/:id], /rulesets[/:id] static catalogs

## Success and error contracts

- **dice:** DiceResult {notation,rolls:number[],modifier,advantage?,total,criticalHit,criticalFail,details}; multiple array. d20 advantage rolls twice and keeps one; keep-high/low logic in source.
- **combat:** CombatState includes id,sessionId,round,currentTurn,participants,log,status,startedAt,endedAt?; full participants/log contracts in appendix; init sorts initiative descending
- **check:** {success,roll,ability,skill?,dc,modifier,criticalHit?,criticalFail?}; natural1 false/natural20 true, guidance d4 added; catalog results exact static object/array

- External endpoint always404 {error:'Not found'}, including OPTIONS; no historical code executes through main.
- In isolated source fixtures, OPTIONS204 shared CORS; unmatched route/method404 {error:'Not found'}; missing single resource404 where explicit branch exists. Thrown missing/invalid body/helper errors500 {error:'Internal server error',message:string}; fields and exact branch exceptions are enumerated in response sites.

## Side effects and transaction boundaries

- combatStates Map updates and Math.random rolls; REDIS_URL read but no Redis connection, no DB/storage/provider calls.

## Quota, environment and transport


```json
{
  "kind": "none",
  "scope": "No historical worker quota, persistence counter, retry budget or per-user scope exists."
}
```

Historical path strips /functions/v1/dm-tools; no independent request-body ceiling or retry policy. All exact paths, method predicates, query/body reads, defaults and serialized response expressions are materialized in source evidence. No worker-specific abort timeout. No external network requests.

- `CHARACTER_AI_ALLOWED_ORIGIN`
- `REDIS_URL`

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

`supabase/functions/dm-tools/index.ts:7`

```ts
CORS_OPTS: CorsOptions = {
  missingOriginPolicy: 'configured-or-star',
}
```

### REDIS_URL

`supabase/functions/dm-tools/index.ts:120`

```ts
REDIS_URL = Deno.env.get("REDIS_URL") || "redis://localhost:6379"
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

- dm-tools all routes remain404 at dispatcher, including dice and health.
- Seeded random fixture pins d20 advantage, notation modifier handling, initiative ordering, next-round and end-combat log shapes.
- Invalid notation/missing participant/target follows isolated500 behavior; no claim of authenticated combat or durable Redis state.

## Observed legacy defects and explicit successor decisions

- Unauthenticated client combat/session/character authority and unbounded dice-count input make this unsuitable for activation. REDIS_URL does not provide persistence.

## All adapter call sites

No src/infrastructure caller in the reviewed branch. This does not authorize adding a public mount.

## Exact ordered operations

### dm-tools:1

Predicate: `req.method === "GET" && path === "/health"`. Source: `supabase/functions/dm-tools/index.ts:649`.


```ts
{
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        features: ['dice', 'combat', 'conditions', 'ability-checks', 'rulesets'],
      }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### dm-tools:2

Predicate: `req.method === "POST" && path === "/dice"`. Source: `supabase/functions/dm-tools/index.ts:660`.


```ts
{
      const body = await req.json()
      const { notation, modifier, advantage } = body
      
      const result = rollDice(notation, modifier || 0, advantage || null)
      
      return new Response(JSON.stringify(result), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### dm-tools:3

Predicate: `req.method === "POST" && path === "/dice/multiple"`. Source: `supabase/functions/dm-tools/index.ts:672`.


```ts
{
      const body = await req.json()
      const results = rollMultiple(body.rolls)
      
      return new Response(JSON.stringify(results), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### dm-tools:4

Predicate: `req.method === "POST" && path === "/combat/init"`. Source: `supabase/functions/dm-tools/index.ts:682`.


```ts
{
      const body = await req.json()
      const combat = await initCombat(body.sessionId, body.participants)
      
      return new Response(JSON.stringify(combat), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### dm-tools:5

Predicate: `req.method === "GET" && path.match(/^\/combat\/[\w-]+$/)`. Source: `supabase/functions/dm-tools/index.ts:692`.


```ts
{
      const combatId = path.split("/")[2]
      const combat = await getCombatState(combatId)
      
      if (!combat) {
        return new Response(JSON.stringify({ error: "Combat not found" }), {
          status: 404,
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
      
      return new Response(JSON.stringify(combat), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### dm-tools:6

Predicate: `req.method === "GET" && path.match(/^\/combat\/session\/[\w-]+$/)`. Source: `supabase/functions/dm-tools/index.ts:709`.


```ts
{
      const sessionId = path.split("/")[3]
      const combat = await getCombatBySession(sessionId)
      
      if (!combat) {
        return new Response(JSON.stringify({ error: "No active combat" }), {
          status: 404,
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
      
      return new Response(JSON.stringify(combat), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### dm-tools:7

Predicate: `req.method === "POST" && path.match(/^\/combat\/[\w-]+\/next$/)`. Source: `supabase/functions/dm-tools/index.ts:726`.


```ts
{
      const combatId = path.split("/")[2]
      const combat = await nextTurn(combatId)
      
      return new Response(JSON.stringify(combat), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### dm-tools:8

Predicate: `req.method === "POST" && path.match(/^\/combat\/[\w-]+\/damage$/)`. Source: `supabase/functions/dm-tools/index.ts:736`.


```ts
{
      const combatId = path.split("/")[2]
      const body = await req.json()
      const combat = await applyDamage(combatId, body.targetId, body.damage)
      
      return new Response(JSON.stringify(combat), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### dm-tools:9

Predicate: `req.method === "POST" && path.match(/^\/combat\/[\w-]+\/heal$/)`. Source: `supabase/functions/dm-tools/index.ts:747`.


```ts
{
      const combatId = path.split("/")[2]
      const body = await req.json()
      const combat = await applyHealing(combatId, body.targetId, body.healing)
      
      return new Response(JSON.stringify(combat), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### dm-tools:10

Predicate: `req.method === "POST" && path.match(/^\/combat\/[\w-]+\/condition$/)`. Source: `supabase/functions/dm-tools/index.ts:758`.


```ts
{
      const combatId = path.split("/")[2]
      const body = await req.json()
      const combat = await applyCondition(combatId, body.targetId, body.condition)
      
      return new Response(JSON.stringify(combat), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### dm-tools:11

Predicate: `req.method === "DELETE" && path.match(/^\/combat\/[\w-]+\/condition$/)`. Source: `supabase/functions/dm-tools/index.ts:769`.


```ts
{
      const combatId = path.split("/")[2]
      const body = await req.json()
      const combat = await removeCondition(combatId, body.targetId, body.condition)
      
      return new Response(JSON.stringify(combat), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### dm-tools:12

Predicate: `req.method === "POST" && path.match(/^\/combat\/[\w-]+\/end$/)`. Source: `supabase/functions/dm-tools/index.ts:780`.


```ts
{
      const combatId = path.split("/")[2]
      const combat = await endCombat(combatId)
      
      return new Response(JSON.stringify(combat), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### dm-tools:13

Predicate: `req.method === "POST" && path === "/check"`. Source: `supabase/functions/dm-tools/index.ts:790`.


```ts
{
      const body = await req.json()
      const result = await performAbilityCheck(body)
      
      return new Response(JSON.stringify(result), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### dm-tools:14

Predicate: `req.method === "GET" && path === "/conditions"`. Source: `supabase/functions/dm-tools/index.ts:800`.


```ts
{
      return new Response(JSON.stringify(CONDITIONS), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### dm-tools:15

Predicate: `req.method === "GET" && path.match(/^\/conditions\/[\w-]+$/)`. Source: `supabase/functions/dm-tools/index.ts:807`.


```ts
{
      const conditionName = path.split("/")[2].toLowerCase()
      const condition = CONDITIONS[conditionName]
      
      if (!condition) {
        return new Response(JSON.stringify({ error: "Condition not found" }), {
          status: 404,
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
      
      return new Response(JSON.stringify(condition), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### dm-tools:16

Predicate: `req.method === "GET" && path === "/rulesets"`. Source: `supabase/functions/dm-tools/index.ts:824`.


```ts
{
      return new Response(JSON.stringify(RULESETS), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### dm-tools:17

Predicate: `req.method === "GET" && path.match(/^\/rulesets\/[\w-]+$/)`. Source: `supabase/functions/dm-tools/index.ts:831`.


```ts
{
      const rulesetName = path.split("/")[2].toLowerCase()
      const ruleset = RULESETS[rulesetName]
      
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

### DiceRoll

`supabase/functions/dm-tools/index.ts:21`

```ts
interface DiceRoll {
  notation: string
  count: number
  sides: number
  modifier: number
  keepHighest?: number
  keepLowest?: number
  advantage?: 'adv' | 'dis'
}
```

### DiceResult

`supabase/functions/dm-tools/index.ts:31`

```ts
interface DiceResult {
  notation: string
  rolls: number[]
  modifier: number
  advantage?: 'adv' | 'dis'
  total: number
  criticalHit?: boolean
  criticalFail?: boolean
  details?: string
}
```

### CombatParticipant

`supabase/functions/dm-tools/index.ts:42`

```ts
interface CombatParticipant {
  id: string
  name: string
  type: 'player' | 'npc' | 'monster'
  initiative: number
  initiativeBonus?: number
  hp: number
  maxHp: number
  ac: number
  conditions: string[]
  notes?: string
}
```

### CombatState

`supabase/functions/dm-tools/index.ts:55`

```ts
interface CombatState {
  id: string
  sessionId: string
  round: number
  currentTurn: number
  participants: CombatParticipant[]
  log: CombatLogEntry[]
  status: 'inactive' | 'active' | 'paused' | 'completed'
  startedAt?: string
  endedAt?: string
}
```

### CombatLogEntry

`supabase/functions/dm-tools/index.ts:67`

```ts
interface CombatLogEntry {
  type: string
  timestamp: string
  round?: number
  turn?: number
  actor?: string
  target?: string
  action?: string
  result?: any
  damage?: number
  healing?: number
  details?: string
  participants?: Array<{ id: string; name: string; initiative: number }>
}
```

### Condition

`supabase/functions/dm-tools/index.ts:82`

```ts
interface Condition {
  name: string
  description: string
  effects: string[]
  duration?: string
}
```

### Spell

`supabase/functions/dm-tools/index.ts:89`

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
}
```

### AbilityCheckRequest

`supabase/functions/dm-tools/index.ts:103`

```ts
interface AbilityCheckRequest {
  character: {
    name: string
    modifiers: Record<string, number>
    proficiency?: number
  }
  ability: string
  skill?: string
  dc: number
  advantage?: 'adv' | 'dis'
  guidance?: boolean
}
```


## Exact validation, defaults and helper behavior

### parseDiceNotation

`supabase/functions/dm-tools/index.ts:205`

```ts
function parseDiceNotation(notation: string): DiceRoll {
  // Parse: d20, 2d6, 3d8+5, 4d6kh3, 2d20kh1 (advantage)
  const match = notation.match(/^(\d+)?d(\d+)([+-]\d+)?(kh(\d+))?(kl(\d+))?$/i)
  
  if (!match) {
    throw new Error(`Invalid dice notation: ${notation}`)
  }
  
  return {
    notation,
    count: parseInt(match[1]) || 1,
    sides: parseInt(match[2]),
    modifier: parseInt(match[3]) || 0,
    keepHighest: match[5] ? parseInt(match[5]) : undefined,
    keepLowest: match[7] ? parseInt(match[7]) : undefined,
  }
}
```

### rollSingle

`supabase/functions/dm-tools/index.ts:223`

```ts
function rollSingle(sides: number): number {
  return Math.floor(Math.random() * sides) + 1
}
```

### rollDice

`supabase/functions/dm-tools/index.ts:227`

```ts
function rollDice(
  notation: string,
  modifier: number = 0,
  advantage: 'adv' | 'dis' | null = null
): DiceResult {
  const dice = parseDiceNotation(notation)
  
  // Roll dice
  let rolls: number[]
  
  if (dice.sides === 20 && advantage) {
    // Advantage/disadvantage: roll twice
    const roll1 = rollSingle(dice.sides)
    const roll2 = rollSingle(dice.sides)
    rolls = advantage === 'adv' ? [Math.max(roll1, roll2)] : [Math.min(roll1, roll2)]
  } else if (dice.keepHighest || dice.keepLowest) {
    // Roll multiple, keep some
    const allRolls = Array.from({ length: dice.count }, () => rollSingle(dice.sides))
    if (dice.keepHighest) {
      rolls = allRolls.sort((a, b) => b - a).slice(0, dice.keepHighest)
    } else if (dice.keepLowest) {
      rolls = allRolls.sort((a, b) => a - b).slice(0, dice.keepLowest as number)
    } else {
      rolls = allRolls
    }
  } else {
    rolls = Array.from({ length: dice.count }, () => rollSingle(dice.sides))
  }
  
  const total = rolls.reduce((sum, roll) => sum + roll, 0) + modifier
  
  // Check for critical hit/fail on d20
  const criticalHit = dice.sides === 20 && rolls[0] === 20
  const criticalFail = dice.sides === 20 && rolls[0] === 1
  
  // Build details string
  const details = `${rolls.join(' + ')}${modifier !== 0 ? ` ${modifier >= 0 ? '+' : ''} ${modifier}` : ''} = ${total}`
  
  return {
    notation: notation,
    rolls,
    modifier,
    advantage: advantage || undefined,
    total,
    criticalHit,
    criticalFail,
    details,
  }
}
```

### rollMultiple

`supabase/functions/dm-tools/index.ts:277`

```ts
function rollMultiple(rolls: Array<{ notation: string; modifier?: number; advantage?: 'adv' | 'dis' }>): DiceResult[] {
  return rolls.map(r => rollDice(r.notation, r.modifier || 0, r.advantage || null))
}
```

### createCombatId

`supabase/functions/dm-tools/index.ts:288`

```ts
function createCombatId(): string {
  return crypto.randomUUID()
}
```

### initCombat

`supabase/functions/dm-tools/index.ts:292`

```ts
async function initCombat(
  sessionId: string,
  participants: Array<Omit<CombatParticipant, 'initiative'>>
): Promise<CombatState> {
  // Roll initiative for each participant
  const participantsWithInitiative = participants.map(p => ({
    ...p,
    initiative: rollDice('d20').total + (p.initiativeBonus || 0),
    conditions: p.conditions || [],
  })).sort((a, b) => b.initiative - a.initiative)
  
  const combatId = createCombatId()
  
  const combatState: CombatState = {
    id: combatId,
    sessionId,
    round: 1,
    currentTurn: 0,
    participants: participantsWithInitiative,
    log: [{
      type: 'combat_start',
      timestamp: new Date().toISOString(),
      round: 1,
      participants: participantsWithInitiative.map(p => ({
        id: p.id,
        name: p.name,
        initiative: p.initiative,
      })),
    }],
    status: 'active',
    startedAt: new Date().toISOString(),
  }
  
  combatStates.set(combatId, combatState)
  return combatState
}
```

### getCombatState

`supabase/functions/dm-tools/index.ts:329`

```ts
async function getCombatState(combatId: string): Promise<CombatState | null> {
  return combatStates.get(combatId) || null
}
```

### getCombatBySession

`supabase/functions/dm-tools/index.ts:333`

```ts
async function getCombatBySession(sessionId: string): Promise<CombatState | null> {
  for (const [, combat] of combatStates) {
    if (combat.sessionId === sessionId && combat.status === 'active') {
      return combat
    }
  }
  return null
}
```

### nextTurn

`supabase/functions/dm-tools/index.ts:342`

```ts
async function nextTurn(combatId: string): Promise<CombatState> {
  const combat = combatStates.get(combatId)
  if (!combat) throw new Error("Combat not found")
  
  // Clear expired conditions at end of turn
  const currentParticipant = combat.participants[combat.currentTurn]
  if (currentParticipant) {
    // Remove conditions that expire at end of turn
    // (This would need more complex condition tracking in production)
  }
  
  // Advance turn
  combat.currentTurn = (combat.currentTurn + 1) % combat.participants.length
  
  // New round?
  if (combat.currentTurn === 0) {
    combat.round++
    
    combat.log.push({
      type: 'round_start',
      timestamp: new Date().toISOString(),
      round: combat.round,
    })
  }
  
  const nextParticipant = combat.participants[combat.currentTurn]
  
  combat.log.push({
    type: 'turn_start',
    timestamp: new Date().toISOString(),
    round: combat.round,
    turn: combat.currentTurn,
    actor: nextParticipant.name,
  })
  
  combatStates.set(combatId, combat)
  return combat
}
```

### applyDamage

`supabase/functions/dm-tools/index.ts:381`

```ts
async function applyDamage(combatId: string, targetId: string, damage: number): Promise<CombatState> {
  const combat = combatStates.get(combatId)
  if (!combat) throw new Error("Combat not found")
  
  const target = combat.participants.find(p => p.id === targetId)
  if (!target) throw new Error("Target not found in combat")
  
  const previousHp = target.hp
  target.hp = Math.max(0, target.hp - damage)
  
  combat.log.push({
    type: 'damage',
    timestamp: new Date().toISOString(),
    round: combat.round,
    turn: combat.currentTurn,
    target: target.name,
    damage,
    result: {
      previousHp,
      currentHp: target.hp,
      maxHp: target.maxHp,
    },
  })
  
  // Check for death/unconsciousness
  if (target.hp === 0) {
    target.conditions.push('unconscious')
    
    combat.log.push({
      type: 'condition_applied',
      timestamp: new Date().toISOString(),
      round: combat.round,
      turn: combat.currentTurn,
      target: target.name,
      action: 'unconscious',
      details: `${target.name} falls unconscious`,
    })
  }
  
  combatStates.set(combatId, combat)
  return combat
}
```

### applyHealing

`supabase/functions/dm-tools/index.ts:424`

```ts
async function applyHealing(combatId: string, targetId: string, healing: number): Promise<CombatState> {
  const combat = combatStates.get(combatId)
  if (!combat) throw new Error("Combat not found")
  
  const target = combat.participants.find(p => p.id === targetId)
  if (!target) throw new Error("Target not found in combat")
  
  const previousHp = target.hp
  target.hp = Math.min(target.maxHp, target.hp + healing)
  
  // Remove unconscious condition if healed
  if (previousHp === 0 && target.hp > 0) {
    target.conditions = target.conditions.filter(c => c !== 'unconscious')
  }
  
  combat.log.push({
    type: 'healing',
    timestamp: new Date().toISOString(),
    round: combat.round,
    turn: combat.currentTurn,
    target: target.name,
    healing,
    result: {
      previousHp,
      currentHp: target.hp,
      maxHp: target.maxHp,
    },
  })
  
  combatStates.set(combatId, combat)
  return combat
}
```

### applyCondition

`supabase/functions/dm-tools/index.ts:457`

```ts
async function applyCondition(
  combatId: string,
  targetId: string,
  condition: string
): Promise<CombatState> {
  const combat = combatStates.get(combatId)
  if (!combat) throw new Error("Combat not found")
  
  const target = combat.participants.find(p => p.id === targetId)
  if (!target) throw new Error("Target not found in combat")
  
  if (!target.conditions.includes(condition)) {
    target.conditions.push(condition)
    
    combat.log.push({
      type: 'condition_applied',
      timestamp: new Date().toISOString(),
      round: combat.round,
      turn: combat.currentTurn,
      target: target.name,
      action: condition,
    })
  }
  
  combatStates.set(combatId, combat)
  return combat
}
```

### removeCondition

`supabase/functions/dm-tools/index.ts:485`

```ts
async function removeCondition(
  combatId: string,
  targetId: string,
  condition: string
): Promise<CombatState> {
  const combat = combatStates.get(combatId)
  if (!combat) throw new Error("Combat not found")
  
  const target = combat.participants.find(p => p.id === targetId)
  if (!target) throw new Error("Target not found in combat")
  
  target.conditions = target.conditions.filter(c => c !== condition)
  
  combat.log.push({
    type: 'condition_removed',
    timestamp: new Date().toISOString(),
    round: combat.round,
    turn: combat.currentTurn,
    target: target.name,
    action: condition,
  })
  
  combatStates.set(combatId, combat)
  return combat
}
```

### endCombat

`supabase/functions/dm-tools/index.ts:511`

```ts
async function endCombat(combatId: string): Promise<CombatState> {
  const combat = combatStates.get(combatId)
  if (!combat) throw new Error("Combat not found")
  
  combat.status = 'completed'
  combat.endedAt = new Date().toISOString()
  
  combat.log.push({
    type: 'combat_end',
    timestamp: new Date().toISOString(),
    round: combat.round,
  })
  
  combatStates.set(combatId, combat)
  return combat
}
```

### performAbilityCheck

`supabase/functions/dm-tools/index.ts:532`

```ts
async function performAbilityCheck(request: AbilityCheckRequest): Promise<{
  success: boolean
  roll: DiceResult
  ability: string
  skill?: string
  dc: number
  modifier: number
  criticalHit?: boolean
  criticalFail?: boolean
}> {
  const modifier = request.character.modifiers[request.ability] || 0
  const proficiency = request.character.proficiency || 0
  
  // Skill check uses ability modifier + proficiency
  const totalModifier = request.skill
    ? modifier + proficiency
    : modifier
  
  // Guidance adds 1d4
  let guidanceBonus = 0
  if (request.guidance) {
    guidanceBonus = rollDice('d4').total
  }
  
  const roll = rollDice('d20', totalModifier + guidanceBonus, request.advantage || null)
  
  // Natural 20 always succeeds, natural 1 always fails
  const success = roll.criticalFail ? false : (roll.criticalHit ? true : roll.total >= request.dc)
  
  return {
    success,
    roll,
    ability: request.ability,
    skill: request.skill,
    dc: request.dc,
    modifier: totalModifier,
    criticalHit: roll.criticalHit,
    criticalFail: roll.criticalFail,
  }
}
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `supabase/functions/_shared/cors.ts` | `f8286c91d79fa5fc5cfea2fa47081916523fa7a440f234aecd9a47c6a8cf5b38` |
| `supabase/functions/_shared/edge-dispatcher-allowlist.ts` | `6d1ae7bde0ba9e41fcaa7b61247732168a62699e7811fb8574cef266cfad3a27` |
| `supabase/functions/_shared/edge-jwt-gate.ts` | `14a871697b051b7fcbee09dbce1dee8bc8ed5ea6a6eca0bec7b2e771b32d0f0c` |
| `supabase/functions/dm-tools/index.ts` | `66d72e2b61594814ad11b9e2eeede2b17d1ee8169058dcdc89702adcad2e0a6f` |
| `supabase/functions/main/index.ts` | `92f3bf56bf3c776e01595d980246079c4a9f8775e417959abea9d7da003bc53e` |

