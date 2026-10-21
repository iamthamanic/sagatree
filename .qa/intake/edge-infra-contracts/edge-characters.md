# Edge contract: characters

**Status: SPEC; current branch source verified.** Implementation issue: **#822**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [edge-characters.json](source-contracts/edge-characters.json) (SHA-256 `c5bf9f4be2e6fbdb1e86a93b7901fbcc3c270bc39bbd8718dfa8a677d1d6eb4b`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Exposure and purpose

**legacy-unmounted** — Preserve external 404; no automatic host route or public activation.

Historical in-memory character CRUD, progression, equipment and slot tracker.

Dispatcher denies characters with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps.

## Request variants, fields and defaults

- **create:** POST /characters CreateCharacterRequest: ownerId,name,race,class strings; optional projectId/background/alignment/backstory/portraitUrl,isPublic,Partial<Attributes>,Partial<Proficiencies>,Omit<Equipment,id>[]; no runtime identity verification
- **update:** PUT /characters/:id Partial<Character>, shallow spread; fixes id to path and updatedAt to now, permits client ownerId and all other fields. GET list?ownerId&projectId; GET/DELETE/export by id; POST /characters/import Partial<Character>.
- **progression:** POST /:id/experience {xp:number}; POST /:id/level-up LevelUpRequest {characterId,choice?:{hpIncrease:average|roll|number,abilityScoreImprovement?:Partial<Attributes>,feat?:string,skillProficiency?:string}}; helper uses BODY characterId rather than path
- **equipment:** POST /:id/equipment Omit<Equipment,id>; DELETE /:id/equipment/:equipmentId; POST /:id/equip/:equipmentId and /unequip/:equipmentId
- **healthSlots:** POST /:id/damage {damage}, /heal {healing}, /temp-hp {tempHP}; POST /:id/spell-slots/:singleDigit/use and /spell-slots/restore

## Success and error contracts

- **character:** Character JSON; create201 otherwise200. Defaults level1,xp0,proficiency2,abilities10,skills{},savingThrows false,hp class hit die+Con modifier,AC10+Dex,speed30,initiativeDex,zero slots,empty arrays,Common language,isPublic false. Exact nested types/default helpers in appendix.
- **other:** experience {character,leveledUp}; addEquipment Equipment; slot use {success,remaining}; delete/remove/restore {success:true}

- External endpoint always404 {error:'Not found'}, including OPTIONS; no historical code executes through main.
- In isolated source fixtures, OPTIONS204 shared CORS; unmatched route/method404 {error:'Not found'}; missing single resource404 where explicit branch exists. Thrown missing/invalid body/helper errors500 {error:'Internal server error',message:string}; fields and exact branch exceptions are enumerated in response sites.

## Side effects and transaction boundaries

- Single characters Map only; HP/equipment/slot changes mutate objects; random UUIDs and HP roll. No persistent owner data or database writes.

## Quota, environment and transport


```json
{
  "kind": "none",
  "scope": "No historical worker quota, persistence counter, retry budget or per-user scope exists."
}
```

Historical path strips /functions/v1/characters; no independent request-body ceiling or retry policy. All exact paths, method predicates, query/body reads, defaults and serialized response expressions are materialized in source evidence. No worker-specific abort timeout. No external network requests.

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

`supabase/functions/characters/index.ts:7`

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

- All characters methods stay dispatcher404, including cross-owner body and import payload.
- Record that PUT can overwrite ownerId and level-up uses body.characterId in isolated fixture; neither becomes a successor authorization rule.
- Source check identifies non-advancing addExperience loop; never execute XP-at-threshold fixture without hard timeout. Any retained progression must terminate and be separately tested.

## Observed legacy defects and explicit successor decisions

- addExperience sets const nextLevel/nextThreshold then while never advances either: XP reaching threshold can loop indefinitely.
- No user authentication; client supplies ownerId. level-up body can target a different path ID. Type assertions do not validate nested fields.

## All adapter call sites

No src/infrastructure caller in the reviewed branch. This does not authorize adding a public mount.

## Exact ordered operations

### characters:1

Predicate: `req.method === "GET" && path === "/health"`. Source: `supabase/functions/characters/index.ts:622`.


```ts
{
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        features: ['characters', 'leveling', 'equipment', 'spell-slots', 'hp-management', 'export-import'],
      }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### characters:2

Predicate: `req.method === "GET" && path === "/characters"`. Source: `supabase/functions/characters/index.ts:633`.


```ts
{
      const ownerId = url.searchParams.get('ownerId') || undefined
      const projectId = url.searchParams.get('projectId') || undefined
      const charactersList = await listCharacters(ownerId, projectId)
      
      return new Response(JSON.stringify(charactersList), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### characters:3

Predicate: `req.method === "POST" && path === "/characters"`. Source: `supabase/functions/characters/index.ts:644`.


```ts
{
      const body = await req.json()
      const character = await createCharacter(body)
      
      return new Response(JSON.stringify(character), {
        status: 201,
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### characters:4

Predicate: `req.method === "GET" && path.match(/^\/characters\/[\w-]+$/)`. Source: `supabase/functions/characters/index.ts:655`.


```ts
{
      const characterId = path.split("/")[2]
      const character = await getCharacter(characterId)
      
      if (!character) {
        return new Response(JSON.stringify({ error: "Character not found" }), {
          status: 404,
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
      
      return new Response(JSON.stringify(character), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### characters:5

Predicate: `req.method === "PUT" && path.match(/^\/characters\/[\w-]+$/)`. Source: `supabase/functions/characters/index.ts:672`.


```ts
{
      const characterId = path.split("/")[2]
      const body = await req.json()
      const character = await updateCharacter(characterId, body)
      
      return new Response(JSON.stringify(character), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### characters:6

Predicate: `req.method === "DELETE" && path.match(/^\/characters\/[\w-]+$/)`. Source: `supabase/functions/characters/index.ts:683`.


```ts
{
      const characterId = path.split("/")[2]
      await deleteCharacter(characterId)
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### characters:7

Predicate: `req.method === "POST" && path.match(/^\/characters\/[\w-]+\/experience$/)`. Source: `supabase/functions/characters/index.ts:693`.


```ts
{
      const characterId = path.split("/")[2]
      const body = await req.json()
      const result = await addExperience(characterId, body.xp)
      
      return new Response(JSON.stringify(result), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### characters:8

Predicate: `req.method === "POST" && path.match(/^\/characters\/[\w-]+\/level-up$/)`. Source: `supabase/functions/characters/index.ts:704`.


```ts
{
      const body = await req.json()
      const character = await levelUp(body)
      
      return new Response(JSON.stringify(character), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### characters:9

Predicate: `req.method === "POST" && path.match(/^\/characters\/[\w-]+\/equipment$/)`. Source: `supabase/functions/characters/index.ts:714`.


```ts
{
      const characterId = path.split("/")[2]
      const body = await req.json()
      const equipment = await addEquipment(characterId, body)
      
      return new Response(JSON.stringify(equipment), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### characters:10

Predicate: `req.method === "DELETE" && path.match(/^\/characters\/[\w-]+\/equipment\/[\w-]+$/)`. Source: `supabase/functions/characters/index.ts:725`.


```ts
{
      const characterId = path.split("/")[2]
      const equipmentId = path.split("/")[4]
      await removeEquipment(characterId, equipmentId)
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### characters:11

Predicate: `req.method === "POST" && path.match(/^\/characters\/[\w-]+\/equip\/[\w-]+$/)`. Source: `supabase/functions/characters/index.ts:736`.


```ts
{
      const characterId = path.split("/")[2]
      const equipmentId = path.split("/")[4]
      const character = await equipItem(characterId, equipmentId)
      
      return new Response(JSON.stringify(character), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### characters:12

Predicate: `req.method === "POST" && path.match(/^\/characters\/[\w-]+\/unequip\/[\w-]+$/)`. Source: `supabase/functions/characters/index.ts:747`.


```ts
{
      const characterId = path.split("/")[2]
      const equipmentId = path.split("/")[4]
      const character = await unequipItem(characterId, equipmentId)
      
      return new Response(JSON.stringify(character), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### characters:13

Predicate: `req.method === "POST" && path.match(/^\/characters\/[\w-]+\/spell-slots\/\d\/use$/)`. Source: `supabase/functions/characters/index.ts:758`.


```ts
{
      const characterId = path.split("/")[2]
      const level = parseInt(path.split("/")[4])
      const result = await useSpellSlot(characterId, level)
      
      return new Response(JSON.stringify(result), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### characters:14

Predicate: `req.method === "POST" && path.match(/^\/characters\/[\w-]+\/spell-slots\/restore$/)`. Source: `supabase/functions/characters/index.ts:769`.


```ts
{
      const characterId = path.split("/")[2]
      await restoreSpellSlots(characterId)
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### characters:15

Predicate: `req.method === "POST" && path.match(/^\/characters\/[\w-]+\/damage$/)`. Source: `supabase/functions/characters/index.ts:779`.


```ts
{
      const characterId = path.split("/")[2]
      const body = await req.json()
      const character = await takeDamage(characterId, body.damage)
      
      return new Response(JSON.stringify(character), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### characters:16

Predicate: `req.method === "POST" && path.match(/^\/characters\/[\w-]+\/heal$/)`. Source: `supabase/functions/characters/index.ts:790`.


```ts
{
      const characterId = path.split("/")[2]
      const body = await req.json()
      const character = await healCharacter(characterId, body.healing)
      
      return new Response(JSON.stringify(character), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### characters:17

Predicate: `req.method === "POST" && path.match(/^\/characters\/[\w-]+\/temp-hp$/)`. Source: `supabase/functions/characters/index.ts:801`.


```ts
{
      const characterId = path.split("/")[2]
      const body = await req.json()
      const character = await addTempHP(characterId, body.tempHP)
      
      return new Response(JSON.stringify(character), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### characters:18

Predicate: `req.method === "GET" && path.match(/^\/characters\/[\w-]+\/export$/)`. Source: `supabase/functions/characters/index.ts:812`.


```ts
{
      const characterId = path.split("/")[2]
      const character = await exportCharacter(characterId)
      
      return new Response(JSON.stringify(character), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### characters:19

Predicate: `req.method === "POST" && path === "/characters/import"`. Source: `supabase/functions/characters/index.ts:822`.


```ts
{
      const body = await req.json()
      const character = await importCharacter(body)
      
      return new Response(JSON.stringify(character), {
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

### Character

`supabase/functions/characters/index.ts:21`

```ts
interface Character {
  id: string
  ownerId: string
  projectId?: string
  name: string
  race: string
  class: string
  level: number
  background?: string
  alignment?: string
  experience: number
  proficiencyBonus: number
  attributes: Attributes
  skills: Record<string, number>
  savingThrows: Record<string, boolean>
  hp: HP
  armorClass: number
  speed: number
  initiative: number
  spellSlots?: SpellSlots
  features: Feature[]
  proficiencies: Proficiencies
  equipment: Equipment[]
  traits: string[]
  ideals?: string
  bonds?: string
  flaws?: string
  backstory?: string
  portraitUrl?: string
  isPublic: boolean
  createdAt: string
  updatedAt: string
}
```

### Attributes

`supabase/functions/characters/index.ts:55`

```ts
interface Attributes {
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
}
```

### HP

`supabase/functions/characters/index.ts:64`

```ts
interface HP {
  current: number
  max: number
  temp: number
}
```

### SpellSlots

`supabase/functions/characters/index.ts:70`

```ts
interface SpellSlots {
  level1: { max: number; used: number }
  level2: { max: number; used: number }
  level3: { max: number; used: number }
  level4: { max: number; used: number }
  level5: { max: number; used: number }
  level6: { max: number; used: number }
  level7: { max: number; used: number }
  level8: { max: number; used: number }
  level9: { max: number; used: number }
}
```

### Feature

`supabase/functions/characters/index.ts:82`

```ts
interface Feature {
  name: string
  description: string
  source: string // class, race, feat
  level: number
  uses?: { max: number; current: number }
}
```

### Proficiencies

`supabase/functions/characters/index.ts:90`

```ts
interface Proficiencies {
  armor: string[]
  weapons: string[]
  tools: string[]
  languages: string[]
}
```

### Equipment

`supabase/functions/characters/index.ts:97`

```ts
interface Equipment {
  id: string
  name: string
  type: 'weapon' | 'armor' | 'shield' | 'potion' | 'scroll' | 'wondrous' | 'other'
  quantity: number
  equipped: boolean
  attuned?: boolean
  weight?: number
  description?: string
  properties?: Record<string, any>
}
```

### CreateCharacterRequest

`supabase/functions/characters/index.ts:109`

```ts
interface CreateCharacterRequest {
  ownerId: string
  projectId?: string
  name: string
  race: string
  class: string
  background?: string
  alignment?: string
  attributes?: Partial<Attributes>
  proficiencies?: Partial<Proficiencies>
  equipment?: Omit<Equipment, 'id'>[]
  backstory?: string
  portraitUrl?: string
  isPublic?: boolean
}
```

### LevelUpRequest

`supabase/functions/characters/index.ts:125`

```ts
interface LevelUpRequest {
  characterId: string
  choice?: {
    hpIncrease: 'average' | 'roll' | number
    abilityScoreImprovement?: Partial<Attributes>
    feat?: string
    skillProficiency?: string
  }
}
```


## Exact validation, defaults and helper behavior

### generateId

`supabase/functions/characters/index.ts:145`

```ts
function generateId(): string {
  return crypto.randomUUID()
}
```

### calculateModifier

`supabase/functions/characters/index.ts:149`

```ts
function calculateModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}
```

### calculateProficiencyBonus

`supabase/functions/characters/index.ts:153`

```ts
function calculateProficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1
}
```

### getDefaultAttributes

`supabase/functions/characters/index.ts:157`

```ts
function getDefaultAttributes(): Attributes {
  return {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  }
}
```

### getDefaultHP

`supabase/functions/characters/index.ts:168`

```ts
function getDefaultHP(constitution: number, hitDie: number): HP {
  const conMod = calculateModifier(constitution)
  return {
    current: hitDie + conMod,
    max: hitDie + conMod,
    temp: 0,
  }
}
```

### getDefaultSpellSlots

`supabase/functions/characters/index.ts:177`

```ts
function getDefaultSpellSlots(): SpellSlots {
  return {
    level1: { max: 0, used: 0 },
    level2: { max: 0, used: 0 },
    level3: { max: 0, used: 0 },
    level4: { max: 0, used: 0 },
    level5: { max: 0, used: 0 },
    level6: { max: 0, used: 0 },
    level7: { max: 0, used: 0 },
    level8: { max: 0, used: 0 },
    level9: { max: 0, used: 0 },
  }
}
```

### getHitDieByClass

`supabase/functions/characters/index.ts:191`

```ts
function getHitDieByClass(className: string): number {
  const hitDice: Record<string, number> = {
    'barbarian': 12,
    'fighter': 10,
    'paladin': 10,
    'ranger': 10,
    'bard': 8,
    'cleric': 8,
    'druid': 8,
    'monk': 8,
    'rogue': 8,
    'warlock': 8,
    'sorcerer': 6,
    'wizard': 6,
  }
  return hitDice[className.toLowerCase()] || 8
}
```

### getSkillAbility

`supabase/functions/characters/index.ts:209`

```ts
function getSkillAbility(skill: string): string {
  const skillAbilities: Record<string, string> = {
    'acrobatics': 'dexterity',
    'animal handling': 'wisdom',
    'arcana': 'intelligence',
    'athletics': 'strength',
    'deception': 'charisma',
    'history': 'intelligence',
    'insight': 'wisdom',
    'intimidation': 'charisma',
    'investigation': 'intelligence',
    'medicine': 'wisdom',
    'nature': 'intelligence',
    'perception': 'wisdom',
    'performance': 'charisma',
    'persuasion': 'charisma',
    'religion': 'intelligence',
    'sleight of hand': 'dexterity',
    'stealth': 'dexterity',
    'survival': 'wisdom',
  }
  return skillAbilities[skill.toLowerCase()] || 'intelligence'
}
```

### createCharacter

`supabase/functions/characters/index.ts:237`

```ts
async function createCharacter(data: CreateCharacterRequest): Promise<Character> {
  const id = generateId()
  const now = new Date().toISOString()
  const attributes = { ...getDefaultAttributes(), ...data.attributes }
  const hitDie = getHitDieByClass(data.class)
  
  const character: Character = {
    id,
    ownerId: data.ownerId,
    projectId: data.projectId,
    name: data.name,
    race: data.race,
    class: data.class,
    level: 1,
    background: data.background,
    alignment: data.alignment,
    experience: 0,
    proficiencyBonus: 2,
    attributes,
    skills: {},
    savingThrows: {
      strength: false,
      dexterity: false,
      constitution: false,
      intelligence: false,
      wisdom: false,
      charisma: false,
    },
    hp: getDefaultHP(attributes.constitution, hitDie),
    armorClass: 10 + calculateModifier(attributes.dexterity),
    speed: 30,
    initiative: calculateModifier(attributes.dexterity),
    spellSlots: getDefaultSpellSlots(),
    features: [],
    proficiencies: {
      armor: [],
      weapons: [],
      tools: [],
      languages: ['Common'],
      ...data.proficiencies,
    },
    equipment: (data.equipment || []).map(e => ({
      id: generateId(),
      ...e,
    })),
    traits: [],
    backstory: data.backstory,
    portraitUrl: data.portraitUrl,
    isPublic: data.isPublic || false,
    createdAt: now,
    updatedAt: now,
  }
  
  characters.set(id, character)
  return character
}
```

### getCharacter

`supabase/functions/characters/index.ts:294`

```ts
async function getCharacter(characterId: string): Promise<Character | null> {
  return characters.get(characterId) || null
}
```

### updateCharacter

`supabase/functions/characters/index.ts:298`

```ts
async function updateCharacter(characterId: string, data: Partial<Character>): Promise<Character> {
  const character = characters.get(characterId)
  if (!character) throw new Error("Character not found")
  
  const updated: Character = {
    ...character,
    ...data,
    id: characterId,
    updatedAt: new Date().toISOString(),
  }
  
  characters.set(characterId, updated)
  return updated
}
```

### deleteCharacter

`supabase/functions/characters/index.ts:313`

```ts
async function deleteCharacter(characterId: string): Promise<void> {
  characters.delete(characterId)
}
```

### listCharacters

`supabase/functions/characters/index.ts:317`

```ts
async function listCharacters(ownerId?: string, projectId?: string): Promise<Character[]> {
  let all = Array.from(characters.values())
  
  if (ownerId) {
    all = all.filter(c => c.ownerId === ownerId)
  }
  
  if (projectId) {
    all = all.filter(c => c.projectId === projectId)
  }
  
  return all
}
```

### getXPThreshold

`supabase/functions/characters/index.ts:335`

```ts
function getXPThreshold(level: number): number {
  const thresholds = [
    0, 300, 900, 2700, 6500,  // 1-5
    14000, 23000, 34000, 48000, 64000,  // 6-10
    85000, 100000, 120000, 140000, 165000,  // 11-15
    195000, 225000, 265000, 305000, 355000,  // 16-20
  ]
  return thresholds[level - 1] || 0
}
```

### addExperience

`supabase/functions/characters/index.ts:345`

```ts
async function addExperience(characterId: string, xp: number): Promise<{ character: Character; leveledUp: boolean }> {
  const character = characters.get(characterId)
  if (!character) throw new Error("Character not found")
  
  character.experience += xp
  
  // Check for level up
  const nextLevel = character.level + 1
  const nextThreshold = getXPThreshold(nextLevel)
  
  let leveledUp = false
  
  while (character.experience >= nextThreshold && nextLevel <= 20) {
    character.level = nextLevel
    character.proficiencyBonus = calculateProficiencyBonus(character.level)
    leveledUp = true
  }
  
  character.updatedAt = new Date().toISOString()
  characters.set(characterId, character)
  
  return { character, leveledUp }
}
```

### levelUp

`supabase/functions/characters/index.ts:369`

```ts
async function levelUp(data: LevelUpRequest): Promise<Character> {
  const character = characters.get(data.characterId)
  if (!character) throw new Error("Character not found")
  
  if (character.level >= 20) {
    throw new Error("Character is already at max level")
  }
  
  const hitDie = getHitDieByClass(character.class)
  const conMod = calculateModifier(character.attributes.constitution)
  
  // HP increase
  let hpIncrease: number
  if (data.choice?.hpIncrease === 'average') {
    hpIncrease = Math.ceil(hitDie / 2) + conMod
  } else if (typeof data.choice?.hpIncrease === 'number') {
    hpIncrease = data.choice.hpIncrease + conMod
  } else {
    // Roll
    hpIncrease = Math.floor(Math.random() * hitDie) + 1 + conMod
  }
  
  character.hp.max += hpIncrease
  character.hp.current += hpIncrease
  character.level++
  character.proficiencyBonus = calculateProficiencyBonus(character.level)
  
  // Ability score improvement
  if (data.choice?.abilityScoreImprovement) {
    for (const [ability, increase] of Object.entries(data.choice.abilityScoreImprovement)) {
      if (character.attributes[ability as keyof Attributes] !== undefined) {
        character.attributes[ability as keyof Attributes] += increase as number
      }
    }
  }
  
  // Update derived stats
  character.armorClass = 10 + calculateModifier(character.attributes.dexterity)
  character.initiative = calculateModifier(character.attributes.dexterity)
  
  character.updatedAt = new Date().toISOString()
  characters.set(data.characterId, character)
  
  return character
}
```

### addEquipment

`supabase/functions/characters/index.ts:419`

```ts
async function addEquipment(characterId: string, equipment: Omit<Equipment, 'id'>): Promise<Equipment> {
  const character = characters.get(characterId)
  if (!character) throw new Error("Character not found")
  
  const newEquipment: Equipment = {
    id: generateId(),
    ...equipment,
  }
  
  character.equipment.push(newEquipment)
  character.updatedAt = new Date().toISOString()
  
  characters.set(characterId, character)
  return newEquipment
}
```

### removeEquipment

`supabase/functions/characters/index.ts:435`

```ts
async function removeEquipment(characterId: string, equipmentId: string): Promise<void> {
  const character = characters.get(characterId)
  if (!character) throw new Error("Character not found")
  
  character.equipment = character.equipment.filter(e => e.id !== equipmentId)
  character.updatedAt = new Date().toISOString()
  
  characters.set(characterId, character)
}
```

### equipItem

`supabase/functions/characters/index.ts:445`

```ts
async function equipItem(characterId: string, equipmentId: string): Promise<Character> {
  const character = characters.get(characterId)
  if (!character) throw new Error("Character not found")
  
  const equipment = character.equipment.find(e => e.id === equipmentId)
  if (!equipment) throw new Error("Equipment not found")
  
  // Unequip same type items first
  if (equipment.type === 'armor') {
    character.equipment.forEach(e => {
      if (e.type === 'armor') e.equipped = false
    })
  }
  
  equipment.equipped = true
  character.updatedAt = new Date().toISOString()
  
  // Recalculate AC
  // (This is simplified - real implementation would need armor calculations)
  
  characters.set(characterId, character)
  return character
}
```

### unequipItem

`supabase/functions/characters/index.ts:469`

```ts
async function unequipItem(characterId: string, equipmentId: string): Promise<Character> {
  const character = characters.get(characterId)
  if (!character) throw new Error("Character not found")
  
  const equipment = character.equipment.find(e => e.id === equipmentId)
  if (!equipment) throw new Error("Equipment not found")
  
  equipment.equipped = false
  character.updatedAt = new Date().toISOString()
  
  characters.set(characterId, character)
  return character
}
```

### getSpellSlotsByLevel

`supabase/functions/characters/index.ts:487`

```ts
function getSpellSlotsByLevel(characterClass: string, level: number): SpellSlots {
  // Simplified spell slot progression
  const slotsByLevel: Record<number, SpellSlots> = {
    1: { level1: { max: 2, used: 0 }, level2: { max: 0, used: 0 }, level3: { max: 0, used: 0 }, level4: { max: 0, used: 0 }, level5: { max: 0, used: 0 }, level6: { max: 0, used: 0 }, level7: { max: 0, used: 0 }, level8: { max: 0, used: 0 }, level9: { max: 0, used: 0 } },
    2: { level1: { max: 3, used: 0 }, level2: { max: 0, used: 0 }, level3: { max: 0, used: 0 }, level4: { max: 0, used: 0 }, level5: { max: 0, used: 0 }, level6: { max: 0, used: 0 }, level7: { max: 0, used: 0 }, level8: { max: 0, used: 0 }, level9: { max: 0, used: 0 } },
    3: { level1: { max: 4, used: 0 }, level2: { max: 2, used: 0 }, level3: { max: 0, used: 0 }, level4: { max: 0, used: 0 }, level5: { max: 0, used: 0 }, level6: { max: 0, used: 0 }, level7: { max: 0, used: 0 }, level8: { max: 0, used: 0 }, level9: { max: 0, used: 0 } },
    4: { level1: { max: 4, used: 0 }, level2: { max: 3, used: 0 }, level3: { max: 0, used: 0 }, level4: { max: 0, used: 0 }, level5: { max: 0, used: 0 }, level6: { max: 0, used: 0 }, level7: { max: 0, used: 0 }, level8: { max: 0, used: 0 }, level9: { max: 0, used: 0 } },
    5: { level1: { max: 4, used: 0 }, level2: { max: 3, used: 0 }, level3: { max: 2, used: 0 }, level4: { max: 0, used: 0 }, level5: { max: 0, used: 0 }, level6: { max: 0, used: 0 }, level7: { max: 0, used: 0 }, level8: { max: 0, used: 0 }, level9: { max: 0, used: 0 } },
  }
  
  return slotsByLevel[level] || slotsByLevel[1]
}
```

### useSpellSlot

`supabase/functions/characters/index.ts:500`

```ts
async function useSpellSlot(characterId: string, level: number): Promise<{ success: boolean; remaining: number }> {
  const character = characters.get(characterId)
  if (!character) throw new Error("Character not found")
  
  if (!character.spellSlots) {
    throw new Error("Character has no spell slots")
  }
  
  const slotKey = `level${level}` as keyof SpellSlots
  const slots = character.spellSlots[slotKey]
  
  if (slots.used >= slots.max) {
    return { success: false, remaining: 0 }
  }
  
  slots.used++
  character.updatedAt = new Date().toISOString()
  
  characters.set(characterId, character)
  return { success: true, remaining: slots.max - slots.used }
}
```

### restoreSpellSlots

`supabase/functions/characters/index.ts:522`

```ts
async function restoreSpellSlots(characterId: string): Promise<void> {
  const character = characters.get(characterId)
  if (!character) throw new Error("Character not found")
  
  if (!character.spellSlots) return
  
  for (const key of Object.keys(character.spellSlots) as Array<keyof SpellSlots>) {
    character.spellSlots[key].used = 0
  }
  
  character.updatedAt = new Date().toISOString()
  characters.set(characterId, character)
}
```

### takeDamage

`supabase/functions/characters/index.ts:540`

```ts
async function takeDamage(characterId: string, damage: number): Promise<Character> {
  const character = characters.get(characterId)
  if (!character) throw new Error("Character not found")
  
  // Apply to temp HP first
  if (character.hp.temp > 0) {
    const tempDamage = Math.min(character.hp.temp, damage)
    character.hp.temp -= tempDamage
    damage -= tempDamage
  }
  
  // Then to current HP
  character.hp.current = Math.max(0, character.hp.current - damage)
  character.updatedAt = new Date().toISOString()
  
  characters.set(characterId, character)
  return character
}
```

### healCharacter

`supabase/functions/characters/index.ts:559`

```ts
async function healCharacter(characterId: string, healing: number): Promise<Character> {
  const character = characters.get(characterId)
  if (!character) throw new Error("Character not found")
  
  character.hp.current = Math.min(character.hp.max, character.hp.current + healing)
  character.updatedAt = new Date().toISOString()
  
  characters.set(characterId, character)
  return character
}
```

### addTempHP

`supabase/functions/characters/index.ts:570`

```ts
async function addTempHP(characterId: string, tempHP: number): Promise<Character> {
  const character = characters.get(characterId)
  if (!character) throw new Error("Character not found")
  
  character.hp.temp = Math.max(character.hp.temp, tempHP)
  character.updatedAt = new Date().toISOString()
  
  characters.set(characterId, character)
  return character
}
```

### exportCharacter

`supabase/functions/characters/index.ts:585`

```ts
async function exportCharacter(characterId: string): Promise<Character> {
  const character = characters.get(characterId)
  if (!character) throw new Error("Character not found")
  
  return JSON.parse(JSON.stringify(character))
}
```

### importCharacter

`supabase/functions/characters/index.ts:592`

```ts
async function importCharacter(data: Character): Promise<Character> {
  const id = generateId()
  const now = new Date().toISOString()
  
  const character: Character = {
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  }
  
  characters.set(id, character)
  return character
}
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `supabase/functions/_shared/cors.ts` | `f8286c91d79fa5fc5cfea2fa47081916523fa7a440f234aecd9a47c6a8cf5b38` |
| `supabase/functions/_shared/edge-dispatcher-allowlist.ts` | `8fab25a3d5e0d2324cba6143517aed98c7f635423b789406a0da4e9bd1f51370` |
| `supabase/functions/_shared/edge-jwt-gate.ts` | `14a871697b051b7fcbee09dbce1dee8bc8ed5ea6a6eca0bec7b2e771b32d0f0c` |
| `supabase/functions/characters/index.ts` | `59359af748b2d2ff6c777ed1aa6a48f0cc16cdf8eb9bc8e2816ef2751fee8fe7` |
| `supabase/functions/main/index.ts` | `92f3bf56bf3c776e01595d980246079c4a9f8775e417959abea9d7da003bc53e` |

