# Edge contract: lorekeeper

**Status: SPEC; current branch source verified.** Implementation issue: **#829**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [edge-lorekeeper.json](source-contracts/edge-lorekeeper.json) (SHA-256 `87e48d99d50fbf3a6ec76e64ecb742716456f52d828c2b91d055f17da6388cf2`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Exposure and purpose

**legacy-unmounted** — Preserve external 404; no automatic host route or public activation.

Historical Map-backed world graph, memories and consistency evaluator; not a Neo4j connection.

Dispatcher denies lorekeeper with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps.

## Request variants, fields and defaults

- **graph:** POST /graph {projectId,name,description?}; GET /graph/:projectId BFS over outgoing edges
- **nodes:** POST /node {worldId,type:world|location|npc|item|event|faction|quest,name,description?,properties?:Record}; GET/PUT/DELETE /node/:id; PUT Partial<WorldNode>
- **relationships:** POST /relationship {from,to,type,properties?}; GET /relationships/:nodeId
- **memoryContext:** POST /memory {npcId,sessionId,type:event|relationship|location|item|conversation,content,importance?:number(default5 via ||)}; GET /memories/:npcId?limit(default10), /context/:sessionId, /npc/:npcId; POST /consistency/:id uses path ID and no body

## Success and error contracts

- **graph:** WorldNode root create; graph {root:WorldNode|null,nodes:WorldNode[],edges:Edge[]} with absent root returning null/empty200
- **others:** WorldNode,Edge,Memory or arrays; npc context {npc:null|WorldNode,memories,relationships}; session context {npcs,locations,events,memories}; consistency {valid,issues:{type,severity,message,nodes?,suggestion?}[]}; delete {success:true}

- External endpoint always404 {error:'Not found'}, including OPTIONS; no historical code executes through main.
- In isolated source fixtures, OPTIONS204 shared CORS; unmatched route/method404 {error:'Not found'}; missing single resource404 where explicit branch exists. Thrown missing/invalid body/helper errors500 {error:'Internal server error',message:string}; fields and exact branch exceptions are enumerated in response sites.

## Side effects and transaction boundaries

- nodes/edges/memories/graphs Maps; createNode writes node and has_type edge, delete removes related edges; no database or Neo4j request.

## Quota, environment and transport


```json
{
  "kind": "none",
  "scope": "No historical worker quota, persistence counter, retry budget or per-user scope exists."
}
```

Historical path strips /functions/v1/lorekeeper; no independent request-body ceiling or retry policy. All exact paths, method predicates, query/body reads, defaults and serialized response expressions are materialized in source evidence. No worker-specific abort timeout. No external network requests.

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

`supabase/functions/lorekeeper/index.ts:7`

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

- Graph,context,NPC and consistency routes remain dispatcher404.
- Isolated graph traversal and missing-root results match source; edge endpoint existence is enforced by createRelationship.
- Record session-context all-node scan and ignored NPC session filter; any retained role-safe projection must filter before response/provider enrichment.

## Observed legacy defects and explicit successor decisions

- getSessionContext returns every NPC/location/event regardless of requested session/project; only memories filter sessionId. getNPCContext accepts sessionId but ignores it. No auth or GM visibility filter.

## All adapter call sites

No src/infrastructure caller in the reviewed branch. This does not authorize adding a public mount.

## Exact ordered operations

### lorekeeper:1

Predicate: `req.method === "GET" && path === "/health"`. Source: `supabase/functions/lorekeeper/index.ts:423`.


```ts
{
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        features: ['world-graph', 'nodes', 'relationships', 'memories', 'consistency-checks'],
      }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### lorekeeper:2

Predicate: `req.method === "POST" && path === "/graph"`. Source: `supabase/functions/lorekeeper/index.ts:434`.


```ts
{
      const body = await req.json()
      const graph = await createWorldGraph(body)
      
      return new Response(JSON.stringify(graph), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### lorekeeper:3

Predicate: `req.method === "GET" && path.match(/^\/graph\/[\w-]+$/)`. Source: `supabase/functions/lorekeeper/index.ts:444`.


```ts
{
      const projectId = path.split("/")[2]
      const graph = await getWorldGraph(projectId)
      
      return new Response(JSON.stringify(graph), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### lorekeeper:4

Predicate: `req.method === "POST" && path === "/node"`. Source: `supabase/functions/lorekeeper/index.ts:454`.


```ts
{
      const body = await req.json()
      const node = await createNode(body)
      
      return new Response(JSON.stringify(node), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### lorekeeper:5

Predicate: `req.method === "GET" && path.match(/^\/node\/[\w-]+$/)`. Source: `supabase/functions/lorekeeper/index.ts:464`.


```ts
{
      const nodeId = path.split("/")[2]
      const node = await getNode(nodeId)
      
      if (!node) {
        return new Response(JSON.stringify({ error: "Node not found" }), {
          status: 404,
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
      
      return new Response(JSON.stringify(node), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### lorekeeper:6

Predicate: `req.method === "PUT" && path.match(/^\/node\/[\w-]+$/)`. Source: `supabase/functions/lorekeeper/index.ts:481`.


```ts
{
      const nodeId = path.split("/")[2]
      const body = await req.json()
      const node = await updateNode(nodeId, body)
      
      return new Response(JSON.stringify(node), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### lorekeeper:7

Predicate: `req.method === "DELETE" && path.match(/^\/node\/[\w-]+$/)`. Source: `supabase/functions/lorekeeper/index.ts:492`.


```ts
{
      const nodeId = path.split("/")[2]
      await deleteNode(nodeId)
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### lorekeeper:8

Predicate: `req.method === "POST" && path === "/relationship"`. Source: `supabase/functions/lorekeeper/index.ts:502`.


```ts
{
      const body = await req.json()
      const edge = await createRelationship(body)
      
      return new Response(JSON.stringify(edge), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### lorekeeper:9

Predicate: `req.method === "GET" && path.match(/^\/relationships\/[\w-]+$/)`. Source: `supabase/functions/lorekeeper/index.ts:512`.


```ts
{
      const nodeId = path.split("/")[2]
      const relationships = await getRelationships(nodeId)
      
      return new Response(JSON.stringify(relationships), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### lorekeeper:10

Predicate: `req.method === "POST" && path === "/memory"`. Source: `supabase/functions/lorekeeper/index.ts:522`.


```ts
{
      const body = await req.json()
      const memory = await addMemory(body)
      
      return new Response(JSON.stringify(memory), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### lorekeeper:11

Predicate: `req.method === "GET" && path.match(/^\/memories\/[\w-]+$/)`. Source: `supabase/functions/lorekeeper/index.ts:532`.


```ts
{
      const npcId = path.split("/")[2]
      const limit = parseInt(url.searchParams.get('limit') || '10')
      const memories = await getMemories(npcId, limit)
      
      return new Response(JSON.stringify(memories), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### lorekeeper:12

Predicate: `req.method === "GET" && path.match(/^\/context\/[\w-]+$/)`. Source: `supabase/functions/lorekeeper/index.ts:543`.


```ts
{
      const sessionId = path.split("/")[2]
      const context = await getSessionContext(sessionId)
      
      return new Response(JSON.stringify(context), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### lorekeeper:13

Predicate: `req.method === "GET" && path.match(/^\/npc\/[\w-]+$/)`. Source: `supabase/functions/lorekeeper/index.ts:553`.


```ts
{
      const npcId = path.split("/")[2]
      const context = await getNPCContext(npcId)
      
      return new Response(JSON.stringify(context), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
```

### lorekeeper:14

Predicate: `req.method === "POST" && path.match(/^\/consistency\/[\w-]+$/)`. Source: `supabase/functions/lorekeeper/index.ts:563`.


```ts
{
      const worldId = path.split("/")[2]
      const result = await checkConsistency(worldId)
      
      return new Response(JSON.stringify(result), {
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

### WorldNode

`supabase/functions/lorekeeper/index.ts:21`

```ts
interface WorldNode {
  id: string
  type: 'world' | 'location' | 'npc' | 'item' | 'event' | 'faction' | 'quest'
  name: string
  description?: string
  properties: Record<string, any>
  createdAt: string
  updatedAt: string
}
```

### Edge

`supabase/functions/lorekeeper/index.ts:31`

```ts
interface Edge {
  id: string
  from: string
  to: string
  type: string
  properties: Record<string, any>
  createdAt: string
}
```

### Memory

`supabase/functions/lorekeeper/index.ts:40`

```ts
interface Memory {
  id: string
  npcId: string
  sessionId: string
  type: 'event' | 'relationship' | 'location' | 'item' | 'conversation'
  content: string
  importance: number
  timestamp: string
}
```

### ConsistencyCheck

`supabase/functions/lorekeeper/index.ts:50`

```ts
interface ConsistencyCheck {
  valid: boolean
  issues: ConsistencyIssue[]
}
```

### ConsistencyIssue

`supabase/functions/lorekeeper/index.ts:55`

```ts
interface ConsistencyIssue {
  type: 'contradiction' | 'missing' | 'timeline' | 'relationship'
  severity: 'error' | 'warning' | 'info'
  message: string
  nodes?: string[]
  suggestion?: string
}
```


## Exact validation, defaults and helper behavior

### createWorldGraph

`supabase/functions/lorekeeper/index.ts:76`

```ts
async function createWorldGraph(data: { projectId: string; name: string; description?: string }): Promise<WorldNode> {
  const id = generateId()
  const now = new Date().toISOString()
  
  const worldNode: WorldNode = {
    id,
    type: 'world',
    name: data.name,
    description: data.description,
    properties: {
      projectId: data.projectId,
    },
    createdAt: now,
    updatedAt: now,
  }
  
  nodes.set(id, worldNode)
  graphs.set(data.projectId, id)
  
  return worldNode
}
```

### getWorldGraph

`supabase/functions/lorekeeper/index.ts:98`

```ts
async function getWorldGraph(projectId: string): Promise<{
  root: WorldNode | null
  nodes: WorldNode[]
  edges: Edge[]
}> {
  const rootNodeId = graphs.get(projectId)
  if (!rootNodeId) {
    return { root: null, nodes: [], edges: [] }
  }
  
  const rootNode = nodes.get(rootNodeId)
  if (!rootNode) {
    return { root: null, nodes: [], edges: [] }
  }
  
  // Get all connected nodes (BFS)
  const connectedNodes: WorldNode[] = [rootNode]
  const connectedEdges: Edge[] = []
  const visited = new Set<string>([rootNodeId])
  const queue = [rootNodeId]
  
  while (queue.length > 0) {
    const currentId = queue.shift()!
    
    for (const [_, edge] of edges) {
      if (edge.from === currentId && !visited.has(edge.to)) {
        visited.add(edge.to)
        const targetNode = nodes.get(edge.to)
        if (targetNode) {
          connectedNodes.push(targetNode)
          connectedEdges.push(edge)
          queue.push(edge.to)
        }
      }
    }
  }
  
  return { root: rootNode, nodes: connectedNodes, edges: connectedEdges }
}
```

### createNode

`supabase/functions/lorekeeper/index.ts:142`

```ts
async function createNode(data: {
  worldId: string
  type: WorldNode['type']
  name: string
  description?: string
  properties?: Record<string, any>
}): Promise<WorldNode> {
  const id = generateId()
  const now = new Date().toISOString()
  
  const node: WorldNode = {
    id,
    type: data.type,
    name: data.name,
    description: data.description,
    properties: data.properties || {},
    createdAt: now,
    updatedAt: now,
  }
  
  nodes.set(id, node)
  
  // Create edge from world to this node
  const edge: Edge = {
    id: generateId(),
    from: data.worldId,
    to: id,
    type: `has_${data.type}`,
    properties: {},
    createdAt: now,
  }
  
  edges.set(edge.id, edge)
  
  return node
}
```

### getNode

`supabase/functions/lorekeeper/index.ts:179`

```ts
async function getNode(nodeId: string): Promise<WorldNode | null> {
  return nodes.get(nodeId) || null
}
```

### updateNode

`supabase/functions/lorekeeper/index.ts:183`

```ts
async function updateNode(nodeId: string, data: Partial<WorldNode>): Promise<WorldNode> {
  const node = nodes.get(nodeId)
  if (!node) throw new Error("Node not found")
  
  const updated: WorldNode = {
    ...node,
    ...data,
    id: nodeId,
    updatedAt: new Date().toISOString(),
  }
  
  nodes.set(nodeId, updated)
  return updated
}
```

### deleteNode

`supabase/functions/lorekeeper/index.ts:198`

```ts
async function deleteNode(nodeId: string): Promise<void> {
  nodes.delete(nodeId)
  
  // Delete all edges connected to this node
  for (const [edgeId, edge] of edges) {
    if (edge.from === nodeId || edge.to === nodeId) {
      edges.delete(edgeId)
    }
  }
}
```

### createRelationship

`supabase/functions/lorekeeper/index.ts:213`

```ts
async function createRelationship(data: {
  fromId: string
  toId: string
  type: string
  properties?: Record<string, any>
}): Promise<Edge> {
  const from = nodes.get(data.fromId)
  const to = nodes.get(data.toId)
  
  if (!from || !to) {
    throw new Error("One or both nodes not found")
  }
  
  const edge: Edge = {
    id: generateId(),
    from: data.fromId,
    to: data.toId,
    type: data.type,
    properties: data.properties || {},
    createdAt: new Date().toISOString(),
  }
  
  edges.set(edge.id, edge)
  return edge
}
```

### getRelationships

`supabase/functions/lorekeeper/index.ts:239`

```ts
async function getRelationships(nodeId: string): Promise<Edge[]> {
  const relationships: Edge[] = []
  
  for (const [_, edge] of edges) {
    if (edge.from === nodeId || edge.to === nodeId) {
      relationships.push(edge)
    }
  }
  
  return relationships
}
```

### addMemory

`supabase/functions/lorekeeper/index.ts:255`

```ts
async function addMemory(data: {
  npcId: string
  sessionId: string
  type: Memory['type']
  content: string
  importance?: number
}): Promise<Memory> {
  const id = generateId()
  
  const memory: Memory = {
    id,
    npcId: data.npcId,
    sessionId: data.sessionId,
    type: data.type,
    content: data.content,
    importance: data.importance || 5,
    timestamp: new Date().toISOString(),
  }
  
  memories.set(id, memory)
  return memory
}
```

### getMemories

`supabase/functions/lorekeeper/index.ts:278`

```ts
async function getMemories(npcId: string, limit?: number): Promise<Memory[]> {
  const npcMemories: Memory[] = []
  
  for (const [_, memory] of memories) {
    if (memory.npcId === npcId) {
      npcMemories.push(memory)
    }
  }
  
  // Sort by importance and timestamp
  npcMemories.sort((a, b) => {
    if (a.importance !== b.importance) {
      return b.importance - a.importance
    }
    return b.timestamp.localeCompare(a.timestamp)
  })
  
  return limit ? npcMemories.slice(0, limit) : npcMemories
}
```

### getNPCContext

`supabase/functions/lorekeeper/index.ts:298`

```ts
async function getNPCContext(npcId: string, sessionId?: string): Promise<{
  npc: WorldNode | null
  memories: Memory[]
  relationships: Edge[]
}> {
  const npc = nodes.get(npcId) || null
  const memories = await getMemories(npcId, 10)
  const relationships = await getRelationships(npcId)
  
  return { npc, memories, relationships }
}
```

### checkConsistency

`supabase/functions/lorekeeper/index.ts:314`

```ts
async function checkConsistency(worldId: string): Promise<ConsistencyCheck> {
  const issues: ConsistencyIssue[] = []
  const { nodes: worldNodes, edges: worldEdges } = await getWorldGraph(worldId)
  
  // Check for contradictions
  const nodeMap = new Map<string, WorldNode>()
  for (const node of worldNodes) {
    nodeMap.set(node.id, node)
    
    // Check for duplicate names
    const duplicates = worldNodes.filter(n => n.name === node.name && n.id !== node.id)
    if (duplicates.length > 0) {
      issues.push({
        type: 'contradiction',
        severity: 'warning',
        message: `Multiple nodes with name "${node.name}"`,
        nodes: [node.id, ...duplicates.map(d => d.id)],
        suggestion: 'Consider renaming to avoid confusion',
      })
    }
  }
  
  // Check for missing relationships
  for (const node of worldNodes) {
    if (node.type === 'npc') {
      const relationships = worldEdges.filter(e => e.from === node.id || e.to === node.id)
      if (relationships.length === 0) {
        issues.push({
          type: 'missing',
          severity: 'info',
          message: `NPC "${node.name}" has no relationships`,
          nodes: [node.id],
          suggestion: 'Consider adding relationships to other entities',
        })
      }
    }
  }
  
  // Check for timeline issues
  const events = worldNodes.filter(n => n.type === 'event')
  const sortedEvents = events.sort((a, b) => 
    (a.properties.timestamp || a.createdAt).localeCompare(b.properties.timestamp || b.createdAt)
  )
  
  // Check for contradictory relationships
  for (const edge of worldEdges) {
    // Check if both nodes exist
    if (!nodeMap.has(edge.from) || !nodeMap.has(edge.to)) {
      issues.push({
        type: 'relationship',
        severity: 'error',
        message: `Edge references non-existent node`,
        nodes: [edge.from, edge.to],
        suggestion: 'Remove or fix the relationship',
      })
    }
  }
  
  return {
    valid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
  }
}
```

### getSessionContext

`supabase/functions/lorekeeper/index.ts:382`

```ts
async function getSessionContext(sessionId: string): Promise<{
  npcs: WorldNode[]
  locations: WorldNode[]
  events: WorldNode[]
  memories: Memory[]
}> {
  // Get all nodes
  const allNodes = Array.from(nodes.values())
  const allMemories = Array.from(memories.values())
  
  return {
    npcs: allNodes.filter(n => n.type === 'npc'),
    locations: allNodes.filter(n => n.type === 'location'),
    events: allNodes.filter(n => n.type === 'event'),
    memories: allMemories.filter(m => m.sessionId === sessionId),
  }
}
```

### generateId

`supabase/functions/lorekeeper/index.ts:404`

```ts
function generateId(): string {
  return crypto.randomUUID()
}
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `supabase/functions/_shared/cors.ts` | `f8286c91d79fa5fc5cfea2fa47081916523fa7a440f234aecd9a47c6a8cf5b38` |
| `supabase/functions/_shared/edge-dispatcher-allowlist.ts` | `6d1ae7bde0ba9e41fcaa7b61247732168a62699e7811fb8574cef266cfad3a27` |
| `supabase/functions/_shared/edge-jwt-gate.ts` | `14a871697b051b7fcbee09dbce1dee8bc8ed5ea6a6eca0bec7b2e771b32d0f0c` |
| `supabase/functions/lorekeeper/index.ts` | `cbf6e3b03b9f411d623609117cd7a60a9bd249f8cd11cc9889c70763fa8baf5f` |
| `supabase/functions/main/index.ts` | `92f3bf56bf3c776e01595d980246079c4a9f8775e417959abea9d7da003bc53e` |

