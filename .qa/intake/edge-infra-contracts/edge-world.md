# Edge contract: world

**Status: SPEC; current branch source verified.** Implementation issue: **#840**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [edge-world.json](source-contracts/edge-world.json) (SHA-256 `43bf453902e52d096fbd3f4e72090252c7a2eee509984749dc4c35e2ac7c0112`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Exposure and purpose

**legacy-unmounted** — Preserve external 404; no automatic host route or public activation.

Historical Map-backed world settings, locations, events, factions, clock and random weather.

Dispatcher denies world with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps.

## Request variants, fields and defaults

- **world:** POST /worlds {projectId,name,description?,settings?:Partial<WorldSettings>}; GET /worlds/:id, /worlds/project/:projectId; PUT /worlds/:id Partial<World>
- **locationsEvents:** POST /:worldId/locations Omit<Location,id> with discovered defaultfalse; PUT /locations/:id Partial<Location>; POST /locations/:id/discover; POST /events Omit<WorldEvent,id>; GET /events?type
- **factionsTime:** POST /:worldId/factions Omit<Faction,id>; PUT /factions/:id/relationship {targetId,status}; POST /time/advance {hours?:number(default1 via ||)}; PUT /weather Partial<Weather>; POST /weather/random

## Success and error contracts

- **world:** World {id,projectId,name,description?,settings,locations,events,factions,quests,time,weather,createdAt,updatedAt}; defaults settings dnd5e/medieval/medium/serious/1..20,arrays empty,time current0/day1/month1/year1/hour8/minute0/Common Era/Gregorian,weather clear20C/calm/none
- **nested:** Location,WorldEvent,Faction,WorldTime,Weather or event[]200; all schemas/default helpers in appendix; random weather temp floor(random*40)-10 => -10..29

- External endpoint always404 {error:'Not found'}, including OPTIONS; no historical code executes through main.
- In isolated source fixtures, OPTIONS204 shared CORS; unmatched route/method404 {error:'Not found'}; missing single resource404 where explicit branch exists. Thrown missing/invalid body/helper errors500 {error:'Internal server error',message:string}; fields and exact branch exceptions are enumerated in response sites.

## Side effects and transaction boundaries

- worlds Map only; discovered flag, location/event/faction lists, simplified30-day clock, random weather, updatedAt. No atlas/place RPCs, map storage or database persistence.

## Quota, environment and transport


```json
{
  "kind": "none",
  "scope": "No historical worker quota, persistence counter, retry budget or per-user scope exists."
}
```

Historical path strips /functions/v1/world; no independent request-body ceiling or retry policy. All exact paths, method predicates, query/body reads, defaults and serialized response expressions are materialized in source evidence. No worker-specific abort timeout. No external network requests.

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

`supabase/functions/world/index.ts:7`

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

- world routes remain dispatcher404,including settings and clock writes.
- Isolated fixture pins create defaults,discovery,event filtering,faction relationship and30-day calendar rollover.
- Negative/nonfinite/huge hours must be bounded in any replacement; persistent world_profiles/world-atlas APIs remain separate and preserve their visibility policies.

## Observed legacy defects and explicit successor decisions

- No authentication or project ownership; arbitrary shallow updates allowed. Clock labels Gregorian but uses30-day months and lacks numeric bounds.

## All adapter call sites

No src/infrastructure caller in the reviewed branch. This does not authorize adding a public mount.

## Exact ordered operations

### world:1

Predicate: `req.method === "GET" && path === "/health"`. Source: `supabase/functions/world/index.ts:389`.


```ts
{
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        features: ['world', 'locations', 'events', 'factions', 'time', 'weather'],
      }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### world:2

Predicate: `req.method === "POST" && path === "/worlds"`. Source: `supabase/functions/world/index.ts:400`.


```ts
{
      const body = await req.json()
      const world = await createWorld(body)
      
      return new Response(JSON.stringify(world), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### world:3

Predicate: `req.method === "GET" && path.match(/^\/worlds\/[\w-]+$/)`. Source: `supabase/functions/world/index.ts:410`.


```ts
{
      const worldId = path.split("/")[2]
      const world = await getWorld(worldId)
      
      if (!world) {
        return new Response(JSON.stringify({ error: "World not found" }), {
          status: 404,
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
      
      return new Response(JSON.stringify(world), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### world:4

Predicate: `req.method === "GET" && path.match(/^\/worlds\/project\/[\w-]+$/)`. Source: `supabase/functions/world/index.ts:427`.


```ts
{
      const projectId = path.split("/")[3]
      const world = await getWorldByProject(projectId)
      
      if (!world) {
        return new Response(JSON.stringify({ error: "World not found" }), {
          status: 404,
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
      
      return new Response(JSON.stringify(world), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### world:5

Predicate: `req.method === "PUT" && path.match(/^\/worlds\/[\w-]+$/)`. Source: `supabase/functions/world/index.ts:444`.


```ts
{
      const worldId = path.split("/")[2]
      const body = await req.json()
      const world = await updateWorld(worldId, body)
      
      return new Response(JSON.stringify(world), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### world:6

Predicate: `req.method === "POST" && path.match(/^\/worlds\/[\w-]+\/locations$/)`. Source: `supabase/functions/world/index.ts:455`.


```ts
{
      const worldId = path.split("/")[2]
      const body = await req.json()
      const location = await addLocation(worldId, body)
      
      return new Response(JSON.stringify(location), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### world:7

Predicate: `req.method === "PUT" && path.match(/^\/worlds\/[\w-]+\/locations\/[\w-]+$/)`. Source: `supabase/functions/world/index.ts:466`.


```ts
{
      const worldId = path.split("/")[2]
      const locationId = path.split("/")[4]
      const body = await req.json()
      const location = await updateLocation(worldId, locationId, body)
      
      return new Response(JSON.stringify(location), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### world:8

Predicate: `req.method === "POST" && path.match(/^\/worlds\/[\w-]+\/locations\/[\w-]+\/discover$/)`. Source: `supabase/functions/world/index.ts:478`.


```ts
{
      const worldId = path.split("/")[2]
      const locationId = path.split("/")[4]
      const location = await discoverLocation(worldId, locationId)
      
      return new Response(JSON.stringify(location), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### world:9

Predicate: `req.method === "POST" && path.match(/^\/worlds\/[\w-]+\/events$/)`. Source: `supabase/functions/world/index.ts:489`.


```ts
{
      const worldId = path.split("/")[2]
      const body = await req.json()
      const event = await addEvent(worldId, body)
      
      return new Response(JSON.stringify(event), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### world:10

Predicate: `req.method === "GET" && path.match(/^\/worlds\/[\w-]+\/events$/)`. Source: `supabase/functions/world/index.ts:500`.


```ts
{
      const worldId = path.split("/")[2]
      const type = url.searchParams.get('type') as WorldEvent['type'] | undefined
      const events = await getEvents(worldId, type)
      
      return new Response(JSON.stringify(events), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### world:11

Predicate: `req.method === "POST" && path.match(/^\/worlds\/[\w-]+\/factions$/)`. Source: `supabase/functions/world/index.ts:511`.


```ts
{
      const worldId = path.split("/")[2]
      const body = await req.json()
      const faction = await addFaction(worldId, body)
      
      return new Response(JSON.stringify(faction), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### world:12

Predicate: `req.method === "PUT" && path.match(/^\/worlds\/[\w-]+\/factions\/[\w-]+\/relationship$/)`. Source: `supabase/functions/world/index.ts:522`.


```ts
{
      const worldId = path.split("/")[2]
      const factionId = path.split("/")[4]
      const body = await req.json()
      const faction = await updateFactionRelationship(worldId, factionId, body.targetId, body.status)
      
      return new Response(JSON.stringify(faction), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### world:13

Predicate: `req.method === "POST" && path.match(/^\/worlds\/[\w-]+\/time\/advance$/)`. Source: `supabase/functions/world/index.ts:534`.


```ts
{
      const worldId = path.split("/")[2]
      const body = await req.json()
      const time = await advanceTime(worldId, body.hours || 1)
      
      return new Response(JSON.stringify(time), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### world:14

Predicate: `req.method === "PUT" && path.match(/^\/worlds\/[\w-]+\/weather$/)`. Source: `supabase/functions/world/index.ts:545`.


```ts
{
      const worldId = path.split("/")[2]
      const body = await req.json()
      const weather = await setWeather(worldId, body)
      
      return new Response(JSON.stringify(weather), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### world:15

Predicate: `req.method === "POST" && path.match(/^\/worlds\/[\w-]+\/weather\/random$/)`. Source: `supabase/functions/world/index.ts:556`.


```ts
{
      const worldId = path.split("/")[2]
      const weather = await randomWeather(worldId)
      
      return new Response(JSON.stringify(weather), {
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

### World

`supabase/functions/world/index.ts:21`

```ts
interface World {
  id: string
  projectId: string
  name: string
  description?: string
  settings: WorldSettings
  locations: Location[]
  events: WorldEvent[]
  factions: Faction[]
  quests: string[]
  time: WorldTime
  weather: Weather
  createdAt: string
  updatedAt: string
}
```

### WorldSettings

`supabase/functions/world/index.ts:37`

```ts
interface WorldSettings {
  ruleset: string
  technology: 'ancient' | 'medieval' | 'renaissance' | 'modern' | 'future' | 'custom'
  magic: 'none' | 'low' | 'medium' | 'high' | 'ubiquitous'
  tone: 'serious' | 'lighthearted' | 'dark' | 'heroic'
  startingLevel: number
  maxLevel: number
}
```

### Location

`supabase/functions/world/index.ts:46`

```ts
interface Location {
  id: string
  name: string
  type: 'city' | 'town' | 'village' | 'dungeon' | 'wilderness' | 'building' | 'room'
  parentId?: string
  description?: string
  coordinates?: { x: number; y: number }
  connections: string[]
  npcs: string[]
  items: string[]
  discovered: boolean
}
```

### WorldEvent

`supabase/functions/world/index.ts:59`

```ts
interface WorldEvent {
  id: string
  name: string
  description?: string
  type: 'plot' | 'random' | 'scheduled'
  timestamp: string
  location?: string
  participants: string[]
  consequences: string[]
}
```

### Faction

`supabase/functions/world/index.ts:70`

```ts
interface Faction {
  id: string
  name: string
  type: 'kingdom' | 'guild' | 'cult' | 'tribe' | 'organization'
  description?: string
  leader?: string
  members: string[]
  relationships: Record<string, 'allied' | 'neutral' | 'hostile'>
  goals: string[]
}
```

### WorldTime

`supabase/functions/world/index.ts:81`

```ts
interface WorldTime {
  current: number // Current time in hours from epoch
  day: number
  month: number
  year: number
  hour: number
  minute: number
  epoch: string
  calendar: string
}
```

### Weather

`supabase/functions/world/index.ts:92`

```ts
interface Weather {
  current: string
  temperature: number
  wind: 'calm' | 'light' | 'moderate' | 'strong' | 'storm'
  precipitation: 'none' | 'light' | 'moderate' | 'heavy'
  special?: string
}
```


## Exact validation, defaults and helper behavior

### generateId

`supabase/functions/world/index.ts:110`

```ts
function generateId(): string {
  return crypto.randomUUID()
}
```

### createWorld

`supabase/functions/world/index.ts:118`

```ts
async function createWorld(data: {
  projectId: string
  name: string
  description?: string
  settings?: Partial<WorldSettings>
}): Promise<World> {
  const id = generateId()
  const now = new Date().toISOString()
  
  const world: World = {
    id,
    projectId: data.projectId,
    name: data.name,
    description: data.description,
    settings: {
      ruleset: 'dnd5e',
      technology: 'medieval',
      magic: 'medium',
      tone: 'serious',
      startingLevel: 1,
      maxLevel: 20,
      ...data.settings,
    },
    locations: [],
    events: [],
    factions: [],
    quests: [],
    time: {
      current: 0,
      day: 1,
      month: 1,
      year: 1,
      hour: 8,
      minute: 0,
      epoch: 'Common Era',
      calendar: 'Gregorian',
    },
    weather: {
      current: 'clear',
      temperature: 20,
      wind: 'calm',
      precipitation: 'none',
    },
    createdAt: now,
    updatedAt: now,
  }
  
  worlds.set(id, world)
  return world
}
```

### getWorld

`supabase/functions/world/index.ts:169`

```ts
async function getWorld(worldId: string): Promise<World | null> {
  return worlds.get(worldId) || null
}
```

### getWorldByProject

`supabase/functions/world/index.ts:173`

```ts
async function getWorldByProject(projectId: string): Promise<World | null> {
  for (const [_, world] of worlds) {
    if (world.projectId === projectId) {
      return world
    }
  }
  return null
}
```

### updateWorld

`supabase/functions/world/index.ts:182`

```ts
async function updateWorld(worldId: string, data: Partial<World>): Promise<World> {
  const world = worlds.get(worldId)
  if (!world) throw new Error("World not found")
  
  const updated: World = {
    ...world,
    ...data,
    id: worldId,
    updatedAt: new Date().toISOString(),
  }
  
  worlds.set(worldId, updated)
  return updated
}
```

### addLocation

`supabase/functions/world/index.ts:201`

```ts
async function addLocation(worldId: string, data: Omit<Location, 'id'> & { discovered?: boolean }): Promise<Location> {
  const world = worlds.get(worldId)
  if (!world) throw new Error("World not found")
  
  const location: Location = {
    id: generateId(),
    ...data,
    discovered: data.discovered ?? false,
  }
  
  world.locations.push(location)
  world.updatedAt = new Date().toISOString()
  
  worlds.set(worldId, world)
  return location
}
```

### updateLocation

`supabase/functions/world/index.ts:218`

```ts
async function updateLocation(worldId: string, locationId: string, data: Partial<Location>): Promise<Location> {
  const world = worlds.get(worldId)
  if (!world) throw new Error("World not found")
  
  const index = world.locations.findIndex(l => l.id === locationId)
  if (index === -1) throw new Error("Location not found")
  
  world.locations[index] = {
    ...world.locations[index],
    ...data,
  }
  
  world.updatedAt = new Date().toISOString()
  worlds.set(worldId, world)
  
  return world.locations[index]
}
```

### discoverLocation

`supabase/functions/world/index.ts:236`

```ts
async function discoverLocation(worldId: string, locationId: string): Promise<Location> {
  return updateLocation(worldId, locationId, { discovered: true })
}
```

### addEvent

`supabase/functions/world/index.ts:244`

```ts
async function addEvent(worldId: string, data: Omit<WorldEvent, 'id'>): Promise<WorldEvent> {
  const world = worlds.get(worldId)
  if (!world) throw new Error("World not found")
  
  const event: WorldEvent = {
    id: generateId(),
    ...data,
  }
  
  world.events.push(event)
  world.updatedAt = new Date().toISOString()
  
  worlds.set(worldId, world)
  return event
}
```

### getEvents

`supabase/functions/world/index.ts:260`

```ts
async function getEvents(worldId: string, type?: WorldEvent['type']): Promise<WorldEvent[]> {
  const world = worlds.get(worldId)
  if (!world) throw new Error("World not found")
  
  if (type) {
    return world.events.filter(e => e.type === type)
  }
  
  return world.events
}
```

### addFaction

`supabase/functions/world/index.ts:275`

```ts
async function addFaction(worldId: string, data: Omit<Faction, 'id'>): Promise<Faction> {
  const world = worlds.get(worldId)
  if (!world) throw new Error("World not found")
  
  const faction: Faction = {
    id: generateId(),
    ...data,
  }
  
  world.factions.push(faction)
  world.updatedAt = new Date().toISOString()
  
  worlds.set(worldId, world)
  return faction
}
```

### updateFactionRelationship

`supabase/functions/world/index.ts:291`

```ts
async function updateFactionRelationship(worldId: string, factionId: string, targetId: string, status: 'allied' | 'neutral' | 'hostile'): Promise<Faction> {
  const world = worlds.get(worldId)
  if (!world) throw new Error("World not found")
  
  const faction = world.factions.find(f => f.id === factionId)
  if (!faction) throw new Error("Faction not found")
  
  faction.relationships[targetId] = status
  
  world.updatedAt = new Date().toISOString()
  worlds.set(worldId, world)
  
  return faction
}
```

### advanceTime

`supabase/functions/world/index.ts:310`

```ts
async function advanceTime(worldId: string, hours: number): Promise<WorldTime> {
  const world = worlds.get(worldId)
  if (!world) throw new Error("World not found")
  
  world.time.current += hours
  world.time.hour += hours
  
  // Advance days
  while (world.time.hour >= 24) {
    world.time.hour -= 24
    world.time.day++
    
    // Advance months (simplified - 30 days per month)
    if (world.time.day > 30) {
      world.time.day = 1
      world.time.month++
      
      if (world.time.month > 12) {
        world.time.month = 1
        world.time.year++
      }
    }
  }
  
  world.updatedAt = new Date().toISOString()
  worlds.set(worldId, world)
  
  return world.time
}
```

### setWeather

`supabase/functions/world/index.ts:344`

```ts
async function setWeather(worldId: string, weather: Partial<Weather>): Promise<Weather> {
  const world = worlds.get(worldId)
  if (!world) throw new Error("World not found")
  
  world.weather = {
    ...world.weather,
    ...weather,
  }
  
  world.updatedAt = new Date().toISOString()
  worlds.set(worldId, world)
  
  return world.weather
}
```

### randomWeather

`supabase/functions/world/index.ts:359`

```ts
async function randomWeather(worldId: string): Promise<Weather> {
  const weathers = ['clear', 'cloudy', 'rain', 'snow', 'fog', 'storm']
  const winds: Weather['wind'][] = ['calm', 'light', 'moderate', 'strong', 'storm']
  const precipitations: Weather['precipitation'][] = ['none', 'light', 'moderate', 'heavy']
  
  const weather: Weather = {
    current: weathers[Math.floor(Math.random() * weathers.length)],
    temperature: Math.floor(Math.random() * 40) - 10, // -10 to 30
    wind: winds[Math.floor(Math.random() * winds.length)],
    precipitation: precipitations[Math.floor(Math.random() * precipitations.length)],
  }
  
  return setWeather(worldId, weather)
}
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `supabase/functions/_shared/cors.ts` | `f8286c91d79fa5fc5cfea2fa47081916523fa7a440f234aecd9a47c6a8cf5b38` |
| `supabase/functions/_shared/edge-dispatcher-allowlist.ts` | `8fab25a3d5e0d2324cba6143517aed98c7f635423b789406a0da4e9bd1f51370` |
| `supabase/functions/_shared/edge-jwt-gate.ts` | `14a871697b051b7fcbee09dbce1dee8bc8ed5ea6a6eca0bec7b2e771b32d0f0c` |
| `supabase/functions/main/index.ts` | `92f3bf56bf3c776e01595d980246079c4a9f8775e417959abea9d7da003bc53e` |
| `supabase/functions/world/index.ts` | `02fad42841f086b02d8ee553105e34231ce957d882980fc9c73aa8709da7cb45` |

