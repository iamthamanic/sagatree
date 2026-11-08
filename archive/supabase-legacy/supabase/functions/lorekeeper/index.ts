import {
  corsHeaders,
  handleOptions,
  type CorsOptions,
} from '../_shared/cors.ts';

const CORS_OPTS: CorsOptions = {
  missingOriginPolicy: 'configured-or-star',
};
// ===========================================
// Lorekeeper Function (Extended)
// Knowledge Graph with consistency checks
// ===========================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// ===========================================
// TYPES
// ===========================================

interface WorldNode {
  id: string
  type: 'world' | 'location' | 'npc' | 'item' | 'event' | 'faction' | 'quest'
  name: string
  description?: string
  properties: Record<string, any>
  createdAt: string
  updatedAt: string
}

interface Edge {
  id: string
  from: string
  to: string
  type: string
  properties: Record<string, any>
  createdAt: string
}

interface Memory {
  id: string
  npcId: string
  sessionId: string
  type: 'event' | 'relationship' | 'location' | 'item' | 'conversation'
  content: string
  importance: number
  timestamp: string
}

interface ConsistencyCheck {
  valid: boolean
  issues: ConsistencyIssue[]
}

interface ConsistencyIssue {
  type: 'contradiction' | 'missing' | 'timeline' | 'relationship'
  severity: 'error' | 'warning' | 'info'
  message: string
  nodes?: string[]
  suggestion?: string
}

// ===========================================
// STORAGE (In-Memory, use Neo4j in production)
// ===========================================

const nodes = new Map<string, WorldNode>()
const edges = new Map<string, Edge>()
const memories = new Map<string, Memory>()
const graphs = new Map<string, string>() // worldId -> rootNodeId

// ===========================================
// WORLD GRAPH OPERATIONS
// ===========================================

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

// ===========================================
// NODE OPERATIONS
// ===========================================

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

async function getNode(nodeId: string): Promise<WorldNode | null> {
  return nodes.get(nodeId) || null
}

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

async function deleteNode(nodeId: string): Promise<void> {
  nodes.delete(nodeId)
  
  // Delete all edges connected to this node
  for (const [edgeId, edge] of edges) {
    if (edge.from === nodeId || edge.to === nodeId) {
      edges.delete(edgeId)
    }
  }
}

// ===========================================
// RELATIONSHIP OPERATIONS
// ===========================================

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

async function getRelationships(nodeId: string): Promise<Edge[]> {
  const relationships: Edge[] = []
  
  for (const [_, edge] of edges) {
    if (edge.from === nodeId || edge.to === nodeId) {
      relationships.push(edge)
    }
  }
  
  return relationships
}

// ===========================================
// MEMORY OPERATIONS (NPC Context)
// ===========================================

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

// ===========================================
// CONSISTENCY CHECKS
// ===========================================

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

// ===========================================
// SESSION CONTEXT
// ===========================================

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

// ===========================================
// UTILITY
// ===========================================

function generateId(): string {
  return crypto.randomUUID()
}

// ===========================================
// MAIN HANDLER
// ===========================================

serve(async (req: Request) => {
  const headers = corsHeaders(req, CORS_OPTS)
  
  const optionsResponse = handleOptions(req, CORS_OPTS)
  if (optionsResponse) return optionsResponse
  
  const url = new URL(req.url)
  const path = url.pathname.replace("/functions/v1/lorekeeper", "")
  
  try {
    // GET /health
    if (req.method === "GET" && path === "/health") {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        features: ['world-graph', 'nodes', 'relationships', 'memories', 'consistency-checks'],
      }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /graph - Create world graph
    if (req.method === "POST" && path === "/graph") {
      const body = await req.json()
      const graph = await createWorldGraph(body)
      
      return new Response(JSON.stringify(graph), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /graph/:projectId - Get world graph
    if (req.method === "GET" && path.match(/^\/graph\/[\w-]+$/)) {
      const projectId = path.split("/")[2]
      const graph = await getWorldGraph(projectId)
      
      return new Response(JSON.stringify(graph), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /node - Create node
    if (req.method === "POST" && path === "/node") {
      const body = await req.json()
      const node = await createNode(body)
      
      return new Response(JSON.stringify(node), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /node/:id - Get node
    if (req.method === "GET" && path.match(/^\/node\/[\w-]+$/)) {
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
    
    // PUT /node/:id - Update node
    if (req.method === "PUT" && path.match(/^\/node\/[\w-]+$/)) {
      const nodeId = path.split("/")[2]
      const body = await req.json()
      const node = await updateNode(nodeId, body)
      
      return new Response(JSON.stringify(node), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // DELETE /node/:id - Delete node
    if (req.method === "DELETE" && path.match(/^\/node\/[\w-]+$/)) {
      const nodeId = path.split("/")[2]
      await deleteNode(nodeId)
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /relationship - Create relationship
    if (req.method === "POST" && path === "/relationship") {
      const body = await req.json()
      const edge = await createRelationship(body)
      
      return new Response(JSON.stringify(edge), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /relationships/:nodeId - Get relationships
    if (req.method === "GET" && path.match(/^\/relationships\/[\w-]+$/)) {
      const nodeId = path.split("/")[2]
      const relationships = await getRelationships(nodeId)
      
      return new Response(JSON.stringify(relationships), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /memory - Add memory
    if (req.method === "POST" && path === "/memory") {
      const body = await req.json()
      const memory = await addMemory(body)
      
      return new Response(JSON.stringify(memory), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /memories/:npcId - Get memories
    if (req.method === "GET" && path.match(/^\/memories\/[\w-]+$/)) {
      const npcId = path.split("/")[2]
      const limit = parseInt(url.searchParams.get('limit') || '10')
      const memories = await getMemories(npcId, limit)
      
      return new Response(JSON.stringify(memories), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /context/:sessionId - Get session context
    if (req.method === "GET" && path.match(/^\/context\/[\w-]+$/)) {
      const sessionId = path.split("/")[2]
      const context = await getSessionContext(sessionId)
      
      return new Response(JSON.stringify(context), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /npc/:npcId - Get NPC context
    if (req.method === "GET" && path.match(/^\/npc\/[\w-]+$/)) {
      const npcId = path.split("/")[2]
      const context = await getNPCContext(npcId)
      
      return new Response(JSON.stringify(context), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /consistency/:worldId - Check consistency
    if (req.method === "POST" && path.match(/^\/consistency\/[\w-]+$/)) {
      const worldId = path.split("/")[2]
      const result = await checkConsistency(worldId)
      
      return new Response(JSON.stringify(result), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // Not found
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...headers, "Content-Type": "application/json" },
    })
    
  } catch (error: unknown) {
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: (error instanceof Error ? error.message : String(error)),
    }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    })
  }
})