# Edge contract: sessions

**Status: SPEC; current branch source verified.** Implementation issue: **#838**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [edge-sessions.json](source-contracts/edge-sessions.json) (SHA-256 `210b68f609dc9528700c2bb2f5625d8bf6390933b211495d7a9ab9622b1b8233`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Exposure and purpose

**legacy-unmounted** — Preserve external 404; no automatic host route or public activation.

Historical Map-backed sessions, players, chat, world state, savepoints and logs; not current RPC runtime.

Dispatcher denies sessions with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps.

## Request variants, fields and defaults

- **createCrud:** POST /sessions {projectId,name,description?,worldState?:Partial<WorldState>}; GET /sessions?projectId, GET/PUT/DELETE /sessions/:id with Partial<Session> for update; start/pause/end POST
- **players:** POST /sessions/:id/join {userId,characterId?}; /leave {userId}; GET /players; identity supplied by body, no actual authentication
- **chat:** POST /:id/chat {userId,characterId?,characterName?,message,type,metadata?}; GET /chat?limit default100; DELETE /chat/:messageId
- **worldSave:** GET/PUT /:id/world-state Partial<WorldState>; POST /:id/save {name,description?,playerStates}; POST /:id/load/:savePointId; GET /:id/saves; DELETE /:id/save/:savePointId
- **logsImport:** GET /:id/logs?limit default100; POST /:id/logs {type,description,details?}; GET /:id/export; POST /sessions/import exported object

## Success and error contracts

- **session:** Session201 create,200 others; generated sequential per-Map project sessionNumber,status scheduled; default world-state location Unknown,time Morning,empty arrays/maps. GET single includes players and recentMessages(last50).
- **variants:** Join SessionPlayer; player list[]; chat ChatMessage/list[]; world WorldState; save SavePoint; load {worldState,playerStates}; logs SessionLog/list[]; export complete object; delete/leave/chat-delete/save-delete success:true; exact object definitions/default expressions in appendix

- External endpoint always404 {error:'Not found'}, including OPTIONS; no historical code executes through main.
- In isolated source fixtures, OPTIONS204 shared CORS; unmatched route/method404 {error:'Not found'}; missing single resource404 where explicit branch exists. Thrown missing/invalid body/helper errors500 {error:'Internal server error',message:string}; fields and exact branch exceptions are enumerated in response sites.

## Side effects and transaction boundaries

- sessions/sessionPlayers/chatMessages/sessionLogs Maps; lifecycle adds local logs, chat/player mutations, savepoints clone world/player state, load overwrites stored world state. No DB RPC, durable event log or realtime socket.

## Quota, environment and transport


```json
{
  "kind": "none",
  "scope": "No historical worker quota, persistence counter, retry budget or per-user scope exists."
}
```

Historical path strips /functions/v1/sessions; no independent request-body ceiling or retry policy. All exact paths, method predicates, query/body reads, defaults and serialized response expressions are materialized in source evidence. No worker-specific abort timeout. No external network requests.

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

`supabase/functions/sessions/index.ts:7`

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

- All sessions methods,including world-state and import, remain dispatcher404.
- Isolated fixture verifies per-Map numbering,start/pause/end,chat limits and save/load object shapes; another worker/process loses these records.
- Body userId,type:dm and arbitrary world-state are not authority; current create_play_session/apply_session_runtime_command transport must not call this worker.

## Observed legacy defects and explicit successor decisions

- No membership/GM/owner validation; body spreads can alter session authority/state. In-memory numbering/chat/savepoints do not provide durable or concurrent runtime guarantees.

## All adapter call sites

No src/infrastructure caller in the reviewed branch. This does not authorize adding a public mount.

## Exact ordered operations

### sessions:1

Predicate: `req.method === "GET" && path === "/health"`. Source: `supabase/functions/sessions/index.ts:553`.


```ts
{
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        features: ['session-management', 'players', 'chat', 'world-state', 'save-load', 'export-import'],
      }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### sessions:2

Predicate: `req.method === "GET" && path === "/sessions"`. Source: `supabase/functions/sessions/index.ts:564`.


```ts
{
      const projectId = url.searchParams.get('projectId') || undefined
      const sessionsList = await listSessions(projectId)
      
      return new Response(JSON.stringify(sessionsList), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### sessions:3

Predicate: `req.method === "POST" && path === "/sessions"`. Source: `supabase/functions/sessions/index.ts:574`.


```ts
{
      const body = await req.json()
      const session = await createSession(body)
      
      return new Response(JSON.stringify(session), {
        status: 201,
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### sessions:4

Predicate: `req.method === "GET" && path.match(/^\/sessions\/[\w-]+$/)`. Source: `supabase/functions/sessions/index.ts:585`.


```ts
{
      const sessionId = path.split("/")[2]
      const session = await getSession(sessionId)
      
      if (!session) {
        return new Response(JSON.stringify({ error: "Session not found" }), {
          status: 404,
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
      
      // Include players and recent messages
      const players = await getSessionPlayers(sessionId)
      const messages = await getChatHistory(sessionId, 50)
      
      return new Response(JSON.stringify({
        ...session,
        players,
        recentMessages: messages,
      }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### sessions:5

Predicate: `req.method === "PUT" && path.match(/^\/sessions\/[\w-]+$/)`. Source: `supabase/functions/sessions/index.ts:610`.


```ts
{
      const sessionId = path.split("/")[2]
      const body = await req.json()
      const session = await updateSession(sessionId, body)
      
      return new Response(JSON.stringify(session), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### sessions:6

Predicate: `req.method === "DELETE" && path.match(/^\/sessions\/[\w-]+$/)`. Source: `supabase/functions/sessions/index.ts:621`.


```ts
{
      const sessionId = path.split("/")[2]
      await deleteSession(sessionId)
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### sessions:7

Predicate: `req.method === "POST" && path.match(/^\/sessions\/[\w-]+\/start$/)`. Source: `supabase/functions/sessions/index.ts:631`.


```ts
{
      const sessionId = path.split("/")[2]
      const session = await startSession(sessionId)
      
      return new Response(JSON.stringify(session), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### sessions:8

Predicate: `req.method === "POST" && path.match(/^\/sessions\/[\w-]+\/pause$/)`. Source: `supabase/functions/sessions/index.ts:641`.


```ts
{
      const sessionId = path.split("/")[2]
      const session = await pauseSession(sessionId)
      
      return new Response(JSON.stringify(session), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### sessions:9

Predicate: `req.method === "POST" && path.match(/^\/sessions\/[\w-]+\/end$/)`. Source: `supabase/functions/sessions/index.ts:651`.


```ts
{
      const sessionId = path.split("/")[2]
      const session = await endSession(sessionId)
      
      return new Response(JSON.stringify(session), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### sessions:10

Predicate: `req.method === "POST" && path.match(/^\/sessions\/[\w-]+\/join$/)`. Source: `supabase/functions/sessions/index.ts:661`.


```ts
{
      const sessionId = path.split("/")[2]
      const body = await req.json()
      const player = await joinSession(sessionId, body)
      
      return new Response(JSON.stringify(player), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### sessions:11

Predicate: `req.method === "POST" && path.match(/^\/sessions\/[\w-]+\/leave$/)`. Source: `supabase/functions/sessions/index.ts:672`.


```ts
{
      const sessionId = path.split("/")[2]
      const body = await req.json()
      await leaveSession(sessionId, body.userId)
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### sessions:12

Predicate: `req.method === "GET" && path.match(/^\/sessions\/[\w-]+\/players$/)`. Source: `supabase/functions/sessions/index.ts:683`.


```ts
{
      const sessionId = path.split("/")[2]
      const players = await getSessionPlayers(sessionId)
      
      return new Response(JSON.stringify(players), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### sessions:13

Predicate: `req.method === "POST" && path.match(/^\/sessions\/[\w-]+\/chat$/)`. Source: `supabase/functions/sessions/index.ts:693`.


```ts
{
      const sessionId = path.split("/")[2]
      const body = await req.json()
      const message = await sendChatMessage(sessionId, body)
      
      return new Response(JSON.stringify(message), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### sessions:14

Predicate: `req.method === "GET" && path.match(/^\/sessions\/[\w-]+\/chat$/)`. Source: `supabase/functions/sessions/index.ts:704`.


```ts
{
      const sessionId = path.split("/")[2]
      const limit = parseInt(url.searchParams.get('limit') || '100')
      const messages = await getChatHistory(sessionId, limit)
      
      return new Response(JSON.stringify(messages), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### sessions:15

Predicate: `req.method === "DELETE" && path.match(/^\/sessions\/[\w-]+\/chat\/[\w-]+$/)`. Source: `supabase/functions/sessions/index.ts:715`.


```ts
{
      const sessionId = path.split("/")[2]
      const messageId = path.split("/")[4]
      await deleteChatMessage(sessionId, messageId)
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### sessions:16

Predicate: `req.method === "GET" && path.match(/^\/sessions\/[\w-]+\/world-state$/)`. Source: `supabase/functions/sessions/index.ts:726`.


```ts
{
      const sessionId = path.split("/")[2]
      const worldState = await getWorldState(sessionId)
      
      return new Response(JSON.stringify(worldState), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### sessions:17

Predicate: `req.method === "PUT" && path.match(/^\/sessions\/[\w-]+\/world-state$/)`. Source: `supabase/functions/sessions/index.ts:736`.


```ts
{
      const sessionId = path.split("/")[2]
      const body = await req.json()
      const worldState = await updateWorldState(sessionId, body)
      
      return new Response(JSON.stringify(worldState), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### sessions:18

Predicate: `req.method === "POST" && path.match(/^\/sessions\/[\w-]+\/save$/)`. Source: `supabase/functions/sessions/index.ts:747`.


```ts
{
      const sessionId = path.split("/")[2]
      const body = await req.json()
      const savePoint = await createSavePoint(sessionId, body)
      
      return new Response(JSON.stringify(savePoint), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### sessions:19

Predicate: `req.method === "POST" && path.match(/^\/sessions\/[\w-]+\/load\/[\w-]+$/)`. Source: `supabase/functions/sessions/index.ts:758`.


```ts
{
      const sessionId = path.split("/")[2]
      const savePointId = path.split("/")[4]
      const data = await loadSavePoint(sessionId, savePointId)
      
      return new Response(JSON.stringify(data), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### sessions:20

Predicate: `req.method === "GET" && path.match(/^\/sessions\/[\w-]+\/saves$/)`. Source: `supabase/functions/sessions/index.ts:769`.


```ts
{
      const sessionId = path.split("/")[2]
      const savePoints = await listSavePoints(sessionId)
      
      return new Response(JSON.stringify(savePoints), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### sessions:21

Predicate: `req.method === "DELETE" && path.match(/^\/sessions\/[\w-]+\/save\/[\w-]+$/)`. Source: `supabase/functions/sessions/index.ts:779`.


```ts
{
      const sessionId = path.split("/")[2]
      const savePointId = path.split("/")[4]
      await deleteSavePoint(sessionId, savePointId)
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### sessions:22

Predicate: `req.method === "GET" && path.match(/^\/sessions\/[\w-]+\/logs$/)`. Source: `supabase/functions/sessions/index.ts:790`.


```ts
{
      const sessionId = path.split("/")[2]
      const limit = parseInt(url.searchParams.get('limit') || '100')
      const logs = await getSessionLogs(sessionId, limit)
      
      return new Response(JSON.stringify(logs), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### sessions:23

Predicate: `req.method === "POST" && path.match(/^\/sessions\/[\w-]+\/logs$/)`. Source: `supabase/functions/sessions/index.ts:801`.


```ts
{
      const sessionId = path.split("/")[2]
      const body = await req.json()
      const log = await addSessionLog(sessionId, body)
      
      return new Response(JSON.stringify(log), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### sessions:24

Predicate: `req.method === "GET" && path.match(/^\/sessions\/[\w-]+\/export$/)`. Source: `supabase/functions/sessions/index.ts:812`.


```ts
{
      const sessionId = path.split("/")[2]
      const data = await exportSession(sessionId)
      
      return new Response(JSON.stringify(data), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### sessions:25

Predicate: `req.method === "POST" && path === "/sessions/import"`. Source: `supabase/functions/sessions/index.ts:822`.


```ts
{
      const body = await req.json()
      const session = await importSession(body)
      
      return new Response(JSON.stringify(session), {
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

### Session

`supabase/functions/sessions/index.ts:21`

```ts
interface Session {
  id: string
  projectId: string
  sessionNumber: number
  name: string
  description?: string
  status: 'scheduled' | 'active' | 'paused' | 'completed'
  startedAt?: string
  endedAt?: string
  worldState: WorldState
  savePoints: SavePoint[]
  notes?: string
  createdAt: string
  updatedAt: string
}
```

### WorldState

`supabase/functions/sessions/index.ts:37`

```ts
interface WorldState {
  location: string
  time: string
  weather?: string
  date?: string
  activeQuests: string[]
  exploredLocations: string[]
  npcs: Record<string, NPCState>
  flags: Record<string, boolean | string | number>
  inventory: string[]
}
```

### NPCState

`supabase/functions/sessions/index.ts:49`

```ts
interface NPCState {
  id: string
  name: string
  disposition: 'friendly' | 'neutral' | 'hostile' | 'unknown'
  location: string
  memories: string[]
  relationships: Record<string, string>
}
```

### SavePoint

`supabase/functions/sessions/index.ts:58`

```ts
interface SavePoint {
  id: string
  name: string
  description?: string
  worldState: WorldState
  playerStates: PlayerState[]
  createdAt: string
}
```

### PlayerState

`supabase/functions/sessions/index.ts:67`

```ts
interface PlayerState {
  userId: string
  characterId: string
  characterName: string
  hp: number
  maxHp: number
  spellSlots: Record<string, number>
  conditions: string[]
  inventory: string[]
  experience: number
  notes?: string
}
```

### SessionPlayer

`supabase/functions/sessions/index.ts:80`

```ts
interface SessionPlayer {
  id: string
  sessionId: string
  userId: string
  characterId?: string
  isOnline: boolean
  joinedAt: string
  leftAt?: string
  lastActivity: string
}
```

### ChatMessage

`supabase/functions/sessions/index.ts:91`

```ts
interface ChatMessage {
  id: string
  sessionId: string
  userId: string
  characterId?: string
  characterName?: string
  message: string
  type: 'player' | 'dm' | 'system' | 'npc'
  metadata?: Record<string, any>
  timestamp: string
}
```

### SessionLog

`supabase/functions/sessions/index.ts:103`

```ts
interface SessionLog {
  id: string
  sessionId: string
  type: 'action' | 'combat' | 'dialogue' | 'exploration' | 'rest' | 'level-up'
  description: string
  details?: Record<string, any>
  timestamp: string
}
```


## Exact validation, defaults and helper behavior

### generateId

`supabase/functions/sessions/index.ts:125`

```ts
function generateId(): string {
  return crypto.randomUUID()
}
```

### validateSessionData

`supabase/functions/sessions/index.ts:129`

```ts
function validateSessionData(data: Partial<Session>): { valid: boolean; error?: string } {
  if (!data.projectId) return { valid: false, error: "Missing projectId" }
  if (!data.name) return { valid: false, error: "Missing name" }
  return { valid: true }
}
```

### createSession

`supabase/functions/sessions/index.ts:139`

```ts
async function createSession(data: {
  projectId: string
  name: string
  description?: string
  worldState?: Partial<WorldState>
}): Promise<Session> {
  const id = generateId()
  const now = new Date().toISOString()
  
  // Get next session number for project
  let sessionNumber = 1
  for (const [, session] of sessions) {
    if (session.projectId === data.projectId) {
      sessionNumber = Math.max(sessionNumber, session.sessionNumber + 1)
    }
  }
  
  const session: Session = {
    id,
    projectId: data.projectId,
    sessionNumber,
    name: data.name,
    description: data.description,
    status: 'scheduled',
    worldState: {
      location: data.worldState?.location || 'Unknown',
      time: data.worldState?.time || 'Morning',
      weather: data.worldState?.weather,
      date: data.worldState?.date,
      activeQuests: data.worldState?.activeQuests || [],
      exploredLocations: data.worldState?.exploredLocations || [],
      npcs: data.worldState?.npcs || {},
      flags: data.worldState?.flags || {},
      inventory: data.worldState?.inventory || [],
    },
    savePoints: [],
    createdAt: now,
    updatedAt: now,
  }
  
  sessions.set(id, session)
  sessionPlayers.set(id, [])
  chatMessages.set(id, [])
  sessionLogs.set(id, [])
  
  return session
}
```

### getSession

`supabase/functions/sessions/index.ts:187`

```ts
async function getSession(sessionId: string): Promise<Session | null> {
  return sessions.get(sessionId) || null
}
```

### updateSession

`supabase/functions/sessions/index.ts:191`

```ts
async function updateSession(sessionId: string, data: Partial<Session>): Promise<Session> {
  const session = sessions.get(sessionId)
  if (!session) throw new Error("Session not found")
  
  const updated: Session = {
    ...session,
    ...data,
    updatedAt: new Date().toISOString(),
  }
  
  sessions.set(sessionId, updated)
  return updated
}
```

### deleteSession

`supabase/functions/sessions/index.ts:205`

```ts
async function deleteSession(sessionId: string): Promise<void> {
  sessions.delete(sessionId)
  sessionPlayers.delete(sessionId)
  chatMessages.delete(sessionId)
  sessionLogs.delete(sessionId)
}
```

### listSessions

`supabase/functions/sessions/index.ts:212`

```ts
async function listSessions(projectId?: string): Promise<Session[]> {
  const all = Array.from(sessions.values())
  if (projectId) {
    return all.filter(s => s.projectId === projectId)
  }
  return all
}
```

### startSession

`supabase/functions/sessions/index.ts:224`

```ts
async function startSession(sessionId: string): Promise<Session> {
  const session = sessions.get(sessionId)
  if (!session) throw new Error("Session not found")
  
  session.status = 'active'
  session.startedAt = new Date().toISOString()
  session.updatedAt = new Date().toISOString()
  
  // Log session start
  const log: SessionLog = {
    id: generateId(),
    sessionId,
    type: 'action',
    description: `Session ${session.sessionNumber} started: ${session.name}`,
    timestamp: new Date().toISOString(),
  }
  sessionLogs.get(sessionId)?.push(log)
  
  sessions.set(sessionId, session)
  return session
}
```

### pauseSession

`supabase/functions/sessions/index.ts:246`

```ts
async function pauseSession(sessionId: string): Promise<Session> {
  const session = sessions.get(sessionId)
  if (!session) throw new Error("Session not found")
  
  session.status = 'paused'
  session.updatedAt = new Date().toISOString()
  
  sessions.set(sessionId, session)
  return session
}
```

### endSession

`supabase/functions/sessions/index.ts:257`

```ts
async function endSession(sessionId: string): Promise<Session> {
  const session = sessions.get(sessionId)
  if (!session) throw new Error("Session not found")
  
  session.status = 'completed'
  session.endedAt = new Date().toISOString()
  session.updatedAt = new Date().toISOString()
  
  // Log session end
  const log: SessionLog = {
    id: generateId(),
    sessionId,
    type: 'action',
    description: `Session ${session.sessionNumber} ended`,
    timestamp: new Date().toISOString(),
  }
  sessionLogs.get(sessionId)?.push(log)
  
  sessions.set(sessionId, session)
  return session
}
```

### joinSession

`supabase/functions/sessions/index.ts:283`

```ts
async function joinSession(sessionId: string, data: {
  userId: string
  characterId?: string
}): Promise<SessionPlayer> {
  const players = sessionPlayers.get(sessionId) || []
  
  // Check if already joined
  const existing = players.find(p => p.userId === data.userId)
  if (existing) {
    existing.isOnline = true
    existing.lastActivity = new Date().toISOString()
    sessionPlayers.set(sessionId, players)
    return existing
  }
  
  const player: SessionPlayer = {
    id: generateId(),
    sessionId,
    userId: data.userId,
    characterId: data.characterId,
    isOnline: true,
    joinedAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
  }
  
  players.push(player)
  sessionPlayers.set(sessionId, players)
  
  return player
}
```

### leaveSession

`supabase/functions/sessions/index.ts:314`

```ts
async function leaveSession(sessionId: string, userId: string): Promise<void> {
  const players = sessionPlayers.get(sessionId) || []
  const player = players.find(p => p.userId === userId)
  
  if (player) {
    player.isOnline = false
    player.leftAt = new Date().toISOString()
  }
  
  sessionPlayers.set(sessionId, players)
}
```

### getSessionPlayers

`supabase/functions/sessions/index.ts:326`

```ts
async function getSessionPlayers(sessionId: string): Promise<SessionPlayer[]> {
  return sessionPlayers.get(sessionId) || []
}
```

### updatePlayerActivity

`supabase/functions/sessions/index.ts:330`

```ts
async function updatePlayerActivity(sessionId: string, userId: string): Promise<void> {
  const players = sessionPlayers.get(sessionId) || []
  const player = players.find(p => p.userId === userId)
  
  if (player) {
    player.lastActivity = new Date().toISOString()
    sessionPlayers.set(sessionId, players)
  }
}
```

### sendChatMessage

`supabase/functions/sessions/index.ts:344`

```ts
async function sendChatMessage(sessionId: string, data: {
  userId: string
  characterId?: string
  characterName?: string
  message: string
  type: 'player' | 'dm' | 'system' | 'npc'
  metadata?: Record<string, any>
}): Promise<ChatMessage> {
  const messages = chatMessages.get(sessionId) || []
  
  const msg: ChatMessage = {
    id: generateId(),
    sessionId,
    userId: data.userId,
    characterId: data.characterId,
    characterName: data.characterName,
    message: data.message,
    type: data.type,
    metadata: data.metadata,
    timestamp: new Date().toISOString(),
  }
  
  messages.push(msg)
  chatMessages.set(sessionId, messages)
  
  return msg
}
```

### getChatHistory

`supabase/functions/sessions/index.ts:372`

```ts
async function getChatHistory(sessionId: string, limit: number = 100): Promise<ChatMessage[]> {
  const messages = chatMessages.get(sessionId) || []
  return messages.slice(-limit)
}
```

### deleteChatMessage

`supabase/functions/sessions/index.ts:377`

```ts
async function deleteChatMessage(sessionId: string, messageId: string): Promise<void> {
  const messages = chatMessages.get(sessionId) || []
  const filtered = messages.filter(m => m.id !== messageId)
  chatMessages.set(sessionId, filtered)
}
```

### updateWorldState

`supabase/functions/sessions/index.ts:387`

```ts
async function updateWorldState(sessionId: string, worldState: Partial<WorldState>): Promise<WorldState> {
  const session = sessions.get(sessionId)
  if (!session) throw new Error("Session not found")
  
  session.worldState = {
    ...session.worldState,
    ...worldState,
  }
  session.updatedAt = new Date().toISOString()
  
  sessions.set(sessionId, session)
  return session.worldState
}
```

### getWorldState

`supabase/functions/sessions/index.ts:401`

```ts
async function getWorldState(sessionId: string): Promise<WorldState> {
  const session = sessions.get(sessionId)
  if (!session) throw new Error("Session not found")
  
  return session.worldState
}
```

### createSavePoint

`supabase/functions/sessions/index.ts:412`

```ts
async function createSavePoint(sessionId: string, data: {
  name: string
  description?: string
  playerStates: PlayerState[]
}): Promise<SavePoint> {
  const session = sessions.get(sessionId)
  if (!session) throw new Error("Session not found")
  
  const savePoint: SavePoint = {
    id: generateId(),
    name: data.name,
    description: data.description,
    worldState: JSON.parse(JSON.stringify(session.worldState)),
    playerStates: data.playerStates,
    createdAt: new Date().toISOString(),
  }
  
  session.savePoints.push(savePoint)
  sessions.set(sessionId, session)
  
  return savePoint
}
```

### loadSavePoint

`supabase/functions/sessions/index.ts:435`

```ts
async function loadSavePoint(sessionId: string, savePointId: string): Promise<{
  worldState: WorldState
  playerStates: PlayerState[]
}> {
  const session = sessions.get(sessionId)
  if (!session) throw new Error("Session not found")
  
  const savePoint = session.savePoints.find(sp => sp.id === savePointId)
  if (!savePoint) throw new Error("Save point not found")
  
  // Restore world state
  session.worldState = JSON.parse(JSON.stringify(savePoint.worldState))
  session.updatedAt = new Date().toISOString()
  
  sessions.set(sessionId, session)
  
  return {
    worldState: savePoint.worldState,
    playerStates: savePoint.playerStates,
  }
}
```

### listSavePoints

`supabase/functions/sessions/index.ts:457`

```ts
async function listSavePoints(sessionId: string): Promise<SavePoint[]> {
  const session = sessions.get(sessionId)
  if (!session) throw new Error("Session not found")
  
  return session.savePoints
}
```

### deleteSavePoint

`supabase/functions/sessions/index.ts:464`

```ts
async function deleteSavePoint(sessionId: string, savePointId: string): Promise<void> {
  const session = sessions.get(sessionId)
  if (!session) throw new Error("Session not found")
  
  session.savePoints = session.savePoints.filter(sp => sp.id !== savePointId)
  sessions.set(sessionId, session)
}
```

### addSessionLog

`supabase/functions/sessions/index.ts:476`

```ts
async function addSessionLog(sessionId: string, log: Omit<SessionLog, 'id' | 'sessionId' | 'timestamp'>): Promise<SessionLog> {
  const logs = sessionLogs.get(sessionId) || []
  
  const entry: SessionLog = {
    id: generateId(),
    sessionId,
    ...log,
    timestamp: new Date().toISOString(),
  }
  
  logs.push(entry)
  sessionLogs.set(sessionId, logs)
  
  return entry
}
```

### getSessionLogs

`supabase/functions/sessions/index.ts:492`

```ts
async function getSessionLogs(sessionId: string, limit: number = 100): Promise<SessionLog[]> {
  const logs = sessionLogs.get(sessionId) || []
  return logs.slice(-limit)
}
```

### exportSession

`supabase/functions/sessions/index.ts:501`

```ts
async function exportSession(sessionId: string): Promise<{
  session: Session
  players: SessionPlayer[]
  messages: ChatMessage[]
  logs: SessionLog[]
}> {
  const session = sessions.get(sessionId)
  if (!session) throw new Error("Session not found")
  
  return {
    session,
    players: sessionPlayers.get(sessionId) || [],
    messages: chatMessages.get(sessionId) || [],
    logs: sessionLogs.get(sessionId) || [],
  }
}
```

### importSession

`supabase/functions/sessions/index.ts:518`

```ts
async function importSession(data: {
  session: Session
  players: SessionPlayer[]
  messages: ChatMessage[]
  logs: SessionLog[]
}): Promise<Session> {
  // Validate
  if (!data.session || !data.session.id) {
    throw new Error("Invalid session data")
  }
  
  // Import
  sessions.set(data.session.id, data.session)
  sessionPlayers.set(data.session.id, data.players || [])
  chatMessages.set(data.session.id, data.messages || [])
  sessionLogs.set(data.session.id, data.logs || [])
  
  return data.session
}
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `supabase/functions/_shared/cors.ts` | `f8286c91d79fa5fc5cfea2fa47081916523fa7a440f234aecd9a47c6a8cf5b38` |
| `supabase/functions/_shared/edge-dispatcher-allowlist.ts` | `6d1ae7bde0ba9e41fcaa7b61247732168a62699e7811fb8574cef266cfad3a27` |
| `supabase/functions/_shared/edge-jwt-gate.ts` | `14a871697b051b7fcbee09dbce1dee8bc8ed5ea6a6eca0bec7b2e771b32d0f0c` |
| `supabase/functions/main/index.ts` | `92f3bf56bf3c776e01595d980246079c4a9f8775e417959abea9d7da003bc53e` |
| `supabase/functions/sessions/index.ts` | `d0bc500a2531caecce486391fdf03f4b3bbbaf8b9e71a9c5c7b650aa2c41ef5e` |

