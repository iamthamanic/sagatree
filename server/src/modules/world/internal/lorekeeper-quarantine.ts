/**
 * Quarantined lorekeeper Map-graph characterization (MIG-413 / #829).
 * Location: server/src/modules/world/internal/lorekeeper-quarantine.ts
 *
 * NOT Neo4j. NOT a public host route. Legacy defects preserved for fixtures.
 */

export const LOREKEEPER_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

export type WorldNode = {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly description?: string;
  readonly properties: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type Edge = {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly type: string;
  readonly properties: Record<string, unknown>;
  readonly createdAt: string;
};

export type Memory = {
  readonly id: string;
  readonly npcId: string;
  readonly sessionId: string;
  readonly type: string;
  readonly content: string;
  readonly importance: number;
  readonly timestamp: string;
};

export type LoreGraphStore = {
  readonly nodes: Map<string, WorldNode>;
  readonly edges: Map<string, Edge>;
  readonly memories: Map<string, Memory>;
  readonly graphs: Map<string, string>;
};

export function createLoreGraphStore(): LoreGraphStore {
  return {
    nodes: new Map(),
    edges: new Map(),
    memories: new Map(),
    graphs: new Map(),
  };
}

export function getWorldGraph(
  store: LoreGraphStore,
  projectId: string,
): { root: WorldNode | null; nodes: WorldNode[]; edges: Edge[] } {
  const rootNodeId = store.graphs.get(projectId);
  if (!rootNodeId) return { root: null, nodes: [], edges: [] };
  const rootNode = store.nodes.get(rootNodeId);
  if (!rootNode) return { root: null, nodes: [], edges: [] };

  const connectedNodes: WorldNode[] = [rootNode];
  const connectedEdges: Edge[] = [];
  const visited = new Set<string>([rootNodeId]);
  const queue = [rootNodeId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const edge of store.edges.values()) {
      if (edge.from === currentId && !visited.has(edge.to)) {
        visited.add(edge.to);
        const targetNode = store.nodes.get(edge.to);
        if (targetNode) {
          connectedNodes.push(targetNode);
          connectedEdges.push(edge);
          queue.push(edge.to);
        }
      }
    }
  }
  return { root: rootNode, nodes: connectedNodes, edges: connectedEdges };
}

export function createRelationship(
  store: LoreGraphStore,
  data: { fromId: string; toId: string; type: string; properties?: Record<string, unknown> },
  id: string,
  nowIso: string,
): Edge {
  const from = store.nodes.get(data.fromId);
  const to = store.nodes.get(data.toId);
  if (!from || !to) throw new Error('One or both nodes not found');
  const edge: Edge = {
    id,
    from: data.fromId,
    to: data.toId,
    type: data.type,
    properties: data.properties || {},
    createdAt: nowIso,
  };
  store.edges.set(edge.id, edge);
  return edge;
}

/**
 * Legacy getSessionContext: returns ALL npcs/locations/events; only memories filter sessionId.
 * No auth / GM visibility.
 */
export function getSessionContext(
  store: LoreGraphStore,
  sessionId: string,
): {
  npcs: WorldNode[];
  locations: WorldNode[];
  events: WorldNode[];
  memories: Memory[];
} {
  const allNodes = Array.from(store.nodes.values());
  const allMemories = Array.from(store.memories.values());
  return {
    npcs: allNodes.filter((n) => n.type === 'npc'),
    locations: allNodes.filter((n) => n.type === 'location'),
    events: allNodes.filter((n) => n.type === 'event'),
    memories: allMemories.filter((m) => m.sessionId === sessionId),
  };
}

/**
 * Legacy getNPCContext: accepts sessionId but ignores it.
 */
export function getNPCContext(
  store: LoreGraphStore,
  npcId: string,
  sessionId?: string,
): { npc: WorldNode | null; memories: Memory[]; relationships: Edge[] } {
  void sessionId;
  const npc = store.nodes.get(npcId) || null;
  const memories = Array.from(store.memories.values()).filter((m) => m.npcId === npcId);
  const relationships = Array.from(store.edges.values()).filter(
    (e) => e.from === npcId || e.to === npcId,
  );
  return { npc, memories, relationships };
}
