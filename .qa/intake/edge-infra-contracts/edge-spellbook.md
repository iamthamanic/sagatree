# Edge contract: spellbook

**Status: SPEC; current branch source verified.** Implementation issue: **#839**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [edge-spellbook.json](source-contracts/edge-spellbook.json) (SHA-256 `d9f004a79762cc5514d7e6621eaa4635978a11feb897100035d3bb77d42cf217`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Exposure and purpose

**legacy-unmounted** — Preserve external 404; no automatic host route or public activation.

Historical seeded spells and per-character spellbook Maps, separate from current character/rules repositories.

Dispatcher denies spellbook404 before JWT/worker creation. Isolated historical worker has no identity, owner or role authorization; characterId in path is trusted.

## Request variants, fields and defaults

- **catalog:** GET /spells?level(parseInt)&school&class(lowercase); GET /spells/:id; POST /spells Partial<Spell>
- **createDefaults:** name Unknown,level0,school evocation,castingTime 1 action,range60 feet,components[V,S],duration Instantaneous,description empty,classes[],source custom; all complete types/default expressions in appendix
- **book:** GET /spellbook/:characterId; POST /:characterId/learn,/prepare,/unprepare {spellId:string}; /cast {spellId:string,level:number}; /restore no body

## Success and error contracts

- **spells:** Spell/Spell[]200, missing single spell404; exact Spell school union and fields retained
- **book:** CharacterSpellbook {characterId,spells:{spellId,known,prepared}[],slotsUsed:Record<string,number>}; GET creates empty book if missing; learn adds known=true/prepared=false; prepare toggles existing record only
- **cast:** {success:boolean,remaining:number}; fixed maximum slots per level1..9 =4,3,3,3,2,1,1,1,1; exhausted or unknown level =>false/0. restore {success:true} and slotsUsed={}.

- External404 for every method including OPTIONS. Isolated OPTIONS204; unsupported route/method404 {error:'Not found'}; missing spell404; thrown/malformed JSON500 {error:'Internal server error',message:string}.

## Side effects and transaction boundaries

- spells/spellbooks Maps only; GET book itself creates Map record. cast increments level slot counter without checking spell exists, is known/prepared or level matches spell. No DB/provider/network.

## Quota, environment and transport


```json
{
  "kind": "none",
  "scope": "No per-user quota; slot counts are game bookkeeping in memory, not request rate limiting."
}
```

Strip /functions/v1/spellbook in isolated handler; no request-byte bound, retry policy or abort timeout. Worker never starts through current dispatcher.

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

`supabase/functions/spellbook/index.ts:7`

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

- All spellbook routes remain dispatcher404.
- Isolated GET creates empty book, repeated learn deduplicates spellId, prepare only changes known record and restore resets all used slots.
- Explicitly capture cast accepting unknown/unprepared spells; a retained successor must test its chosen game rule and owner scope independently before any activation.

## Observed legacy defects and explicit successor decisions

- No owner check; cast ignores spellId and known/prepared state, uses fixed slot table independent of character/class. No persistent spell ownership.

## All adapter call sites

No src/infrastructure caller in the reviewed branch. This does not authorize adding a public mount.

## Exact ordered operations

### spellbook:1

Predicate: `req.method === "GET" && path === "/health"`. Source: `supabase/functions/spellbook/index.ts:57`.


```ts
return new Response(JSON.stringify({ status: 'ok', features: ['spells', 'spellbooks', 'casting'] }), { headers: { ...headers, "Content-Type": "application/json" } })
```

### spellbook:2

Predicate: `req.method === "GET" && path === "/spells"`. Source: `supabase/functions/spellbook/index.ts:58`.


```ts
{ const level = url.searchParams.get('level') ? parseInt(url.searchParams.get('level')!) : undefined; const school = url.searchParams.get('school') || undefined; const classFilter = url.searchParams.get('class') || undefined; const list = await listSpells(level, school, classFilter); return new Response(JSON.stringify(list), { headers: { ...headers, "Content-Type": "application/json" } }) }
```

### spellbook:3

Predicate: `req.method === "GET" && path.match(/^\/spells\/[\w-]+$/)`. Source: `supabase/functions/spellbook/index.ts:59`.


```ts
{ const id = path.split("/")[2]; const spell = await getSpell(id); if (!spell) return new Response(JSON.stringify({ error: "Spell not found" }), { status: 404, headers: { ...headers, "Content-Type": "application/json" } }); return new Response(JSON.stringify(spell), { headers: { ...headers, "Content-Type": "application/json" } }) }
```

### spellbook:4

Predicate: `req.method === "POST" && path === "/spells"`. Source: `supabase/functions/spellbook/index.ts:60`.


```ts
{ const body = await req.json(); const spell = await createSpell(body); return new Response(JSON.stringify(spell), { headers: { ...headers, "Content-Type": "application/json" } }) }
```

### spellbook:5

Predicate: `req.method === "GET" && path.match(/^\/spellbook\/[\w-]+$/)`. Source: `supabase/functions/spellbook/index.ts:61`.


```ts
{ const characterId = path.split("/")[2]; const book = await getSpellbook(characterId); return new Response(JSON.stringify(book), { headers: { ...headers, "Content-Type": "application/json" } }) }
```

### spellbook:6

Predicate: `req.method === "POST" && path.match(/^\/spellbook\/[\w-]+\/learn$/)`. Source: `supabase/functions/spellbook/index.ts:62`.


```ts
{ const characterId = path.split("/")[2]; const body = await req.json(); const book = await learnSpell(characterId, body.spellId); return new Response(JSON.stringify(book), { headers: { ...headers, "Content-Type": "application/json" } }) }
```

### spellbook:7

Predicate: `req.method === "POST" && path.match(/^\/spellbook\/[\w-]+\/prepare$/)`. Source: `supabase/functions/spellbook/index.ts:63`.


```ts
{ const characterId = path.split("/")[2]; const body = await req.json(); const book = await prepareSpell(characterId, body.spellId); return new Response(JSON.stringify(book), { headers: { ...headers, "Content-Type": "application/json" } }) }
```

### spellbook:8

Predicate: `req.method === "POST" && path.match(/^\/spellbook\/[\w-]+\/unprepare$/)`. Source: `supabase/functions/spellbook/index.ts:64`.


```ts
{ const characterId = path.split("/")[2]; const body = await req.json(); const book = await unprepareSpell(characterId, body.spellId); return new Response(JSON.stringify(book), { headers: { ...headers, "Content-Type": "application/json" } }) }
```

### spellbook:9

Predicate: `req.method === "POST" && path.match(/^\/spellbook\/[\w-]+\/cast$/)`. Source: `supabase/functions/spellbook/index.ts:65`.


```ts
{ const characterId = path.split("/")[2]; const body = await req.json(); const result = await castSpell(characterId, body.spellId, body.level); return new Response(JSON.stringify(result), { headers: { ...headers, "Content-Type": "application/json" } }) }
```

### spellbook:10

Predicate: `req.method === "POST" && path.match(/^\/spellbook\/[\w-]+\/restore$/)`. Source: `supabase/functions/spellbook/index.ts:66`.


```ts
{ const characterId = path.split("/")[2]; await restoreSpellSlots(characterId); return new Response(JSON.stringify({ success: true }), { headers: { ...headers, "Content-Type": "application/json" } }) }
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

### Spell

`supabase/functions/spellbook/index.ts:13`

```ts
interface Spell { id: string; name: string; level: number; school: 'abjuration' | 'conjuration' | 'divination' | 'enchantment' | 'evocation' | 'illusion' | 'necromancy' | 'transmutation'; castingTime: string; range: string; components: string[]; duration: string; description: string; higherLevels?: string; classes: string[]; source: string }
```

### KnownSpell

`supabase/functions/spellbook/index.ts:15`

```ts
interface KnownSpell { spellId: string; known: boolean; prepared: boolean }
```

### CharacterSpellbook

`supabase/functions/spellbook/index.ts:17`

```ts
interface CharacterSpellbook { characterId: string; spells: KnownSpell[]; slotsUsed: Record<string, number> }
```


## Exact validation, defaults and helper behavior

### generateId

`supabase/functions/spellbook/index.ts:38`

```ts
function generateId(): string { return crypto.randomUUID() }
```

### listSpells

`supabase/functions/spellbook/index.ts:40`

```ts
async function listSpells(level?: number, school?: string, classFilter?: string): Promise<Spell[]> { let all = Array.from(spells.values()); if (level !== undefined) all = all.filter(s => s.level === level); if (school) all = all.filter(s => s.school === school); if (classFilter) all = all.filter(s => s.classes.includes(classFilter.toLowerCase())); return all }
```

### getSpell

`supabase/functions/spellbook/index.ts:41`

```ts
async function getSpell(id: string): Promise<Spell | null> { return spells.get(id) || null }
```

### createSpell

`supabase/functions/spellbook/index.ts:42`

```ts
async function createSpell(data: Partial<Spell>): Promise<Spell> { const id = generateId(); const spell: Spell = { id, name: data.name || 'Unknown', level: data.level || 0, school: data.school || 'evocation', castingTime: data.castingTime || '1 action', range: data.range || '60 feet', components: data.components || ['V', 'S'], duration: data.duration || 'Instantaneous', description: data.description || '', higherLevels: data.higherLevels, classes: data.classes || [], source: data.source || 'custom' }; spells.set(id, spell); return spell }
```

### getSpellbook

`supabase/functions/spellbook/index.ts:43`

```ts
async function getSpellbook(characterId: string): Promise<CharacterSpellbook> { let book = spellbooks.get(characterId); if (!book) { book = { characterId, spells: [], slotsUsed: {} }; spellbooks.set(characterId, book) } return book }
```

### learnSpell

`supabase/functions/spellbook/index.ts:44`

```ts
async function learnSpell(characterId: string, spellId: string): Promise<CharacterSpellbook> { const book = await getSpellbook(characterId); const existing = book.spells.find(s => s.spellId === spellId); if (!existing) book.spells.push({ spellId, known: true, prepared: false }); spellbooks.set(characterId, book); return book }
```

### prepareSpell

`supabase/functions/spellbook/index.ts:45`

```ts
async function prepareSpell(characterId: string, spellId: string): Promise<CharacterSpellbook> { const book = await getSpellbook(characterId); const spell = book.spells.find(s => s.spellId === spellId); if (spell) spell.prepared = true; spellbooks.set(characterId, book); return book }
```

### unprepareSpell

`supabase/functions/spellbook/index.ts:46`

```ts
async function unprepareSpell(characterId: string, spellId: string): Promise<CharacterSpellbook> { const book = await getSpellbook(characterId); const spell = book.spells.find(s => s.spellId === spellId); if (spell) spell.prepared = false; spellbooks.set(characterId, book); return book }
```

### castSpell

`supabase/functions/spellbook/index.ts:47`

```ts
async function castSpell(characterId: string, spellId: string, level: number): Promise<{ success: boolean; remaining: number }> { const book = await getSpellbook(characterId); const slotKey = `level${level}`; const maxSlots = { level1: 4, level2: 3, level3: 3, level4: 3, level5: 2, level6: 1, level7: 1, level8: 1, level9: 1 }; const max = maxSlots[slotKey as keyof typeof maxSlots] || 0; const used = book.slotsUsed[slotKey] || 0; if (used >= max) return { success: false, remaining: 0 }; book.slotsUsed[slotKey] = used + 1; spellbooks.set(characterId, book); return { success: true, remaining: max - book.slotsUsed[slotKey] } }
```

### restoreSpellSlots

`supabase/functions/spellbook/index.ts:48`

```ts
async function restoreSpellSlots(characterId: string): Promise<void> { const book = await getSpellbook(characterId); book.slotsUsed = {}; spellbooks.set(characterId, book) }
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `supabase/functions/_shared/cors.ts` | `f8286c91d79fa5fc5cfea2fa47081916523fa7a440f234aecd9a47c6a8cf5b38` |
| `supabase/functions/_shared/edge-dispatcher-allowlist.ts` | `6d1ae7bde0ba9e41fcaa7b61247732168a62699e7811fb8574cef266cfad3a27` |
| `supabase/functions/_shared/edge-jwt-gate.ts` | `14a871697b051b7fcbee09dbce1dee8bc8ed5ea6a6eca0bec7b2e771b32d0f0c` |
| `supabase/functions/main/index.ts` | `92f3bf56bf3c776e01595d980246079c4a9f8775e417959abea9d7da003bc53e` |
| `supabase/functions/spellbook/index.ts` | `e2a3937922f24ee8f4d966cd1a80e1270ba0647e728f890ca7e67b1ff4e59d9a` |

