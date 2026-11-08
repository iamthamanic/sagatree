import {
  corsHeaders,
  handleOptions,
  type CorsOptions,
} from '../_shared/cors.ts';

const CORS_OPTS: CorsOptions = {
  missingOriginPolicy: 'configured-or-star',
};
// ===========================================
// NPCs Function (Extended)
// NPC management, generation, dialogue, relationships
// ===========================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// ===========================================
// TYPES
// ===========================================

interface NPC {
  id: string
  name: string
  type: 'npc' | 'monster' | 'creature'
  race?: string
  class?: string
  level?: number
  hp: number
  maxHp: number
  ac: number
  speed?: number
  description?: string
  disposition: 'friendly' | 'neutral' | 'hostile' | 'unknown'
  location?: string
  memories: string[]
  relationships: Record<string, string>
  stats?: NPCStats
  abilities?: string[]
  actions?: string[]
  inventory: string[]
  portrait?: string
  notes?: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

interface NPCStats {
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
}

interface DialogueLine {
  id: string
  npcId: string
  trigger: string
  text: string
  conditions?: string[]
  responses?: DialogueResponse[]
  tags: string[]
}

interface DialogueResponse {
  text: string
  nextDialogueId?: string
  effect?: string
}

interface NPCGenerator {
  name: string
  race: string
  class: string
  level: number
  disposition: 'friendly' | 'neutral' | 'hostile'
  location: string
  description: string
}

// ===========================================
// STORAGE
// ===========================================

const npcs = new Map<string, NPC>()
const dialogues = new Map<string, DialogueLine[]>()

// ===========================================
// DATA - Name generators
// ===========================================

const NAMES = {
  human: { male: ['Aldric', 'Brom', 'Cedric', 'Darvin', 'Eldon', 'Finn', 'Garrick', 'Harold'], female: ['Alara', 'Brea', 'Cora', 'Dara', 'Elara', 'Fia', 'Gwen', 'Hanna'] },
  elf: { male: ['Aelrindel', 'Braenar', 'Caelynn', 'Daelys', 'Elandorr', 'Faelyn', 'Gaelin', 'Hadar'], female: ['Aeliana', 'Braelynn', 'Caelynn', 'Daelynn', 'Elanna', 'Faelynn', 'Gaelynn', 'Haelynn'] },
  dwarf: { male: ['Adrik', 'Bardin', 'Dolgan', 'Gardin', 'Harbek', 'Kargan', 'Mardin', 'Thordak'], female: ['Annora', 'Brynna', 'Dagna', 'Greta', 'Helga', 'Kadra', 'Marda', 'Thora'] },
  halfling: { male: ['Alton', 'Bram', 'Cedric', 'Dunn', 'Eldon', 'Finbar', 'Garrett', 'Hob'], female: ['Bella', 'Cora', 'Daisy', 'Elsa', 'Fiona', 'Gemma', 'Holly', 'Ivy'] },
  tiefling: { male: ['Aktaeos', 'Barakas', 'Damakos', 'Ephren', 'Gauros', 'Kairon', 'Melech', 'Nerios'], female: ['Akta', 'Bryseis', 'Criella', 'Ephyra', 'Grieta', 'Kalista', 'Melia', 'Nyx'] },
  dragonborn: { male: ['Arjhan', 'Bharash', 'Donaar', 'Ghesh', 'Havar', 'Kriv', 'Medrash', 'Nadarr'], female: ['Akra', 'Bharra', 'Daaria', 'Gheshra', 'Havara', 'Kriva', 'Medra', 'Nadaara'] }
}

const CLASSES = ['Fighter', 'Wizard', 'Rogue', 'Cleric', 'Ranger', 'Paladin', 'Barbarian', 'Bard', 'Druid', 'Monk', 'Sorcerer', 'Warlock']

const DISPOSITIONS: Array<'friendly' | 'neutral' | 'hostile'> = ['friendly', 'neutral', 'hostile']

const LOCATIONS = ['Tavern', 'Market', 'Temple', 'Castle', 'Forest', 'Mountain', 'Village', 'City', 'Dungeon Entrance', 'Port']

const PERSONALITY_TRAITS = [
  'is always polite and respectful',
  'has a dry sense of humor',
  'is suspicious of strangers',
  'loves to tell stories',
  'is deeply religious',
  'has a quick temper',
  'is very curious',
  'is always looking for a bargain',
  'is terrified of magic',
  'has a secret agenda'
]

const PHYSICAL_TRAITS = [
  'has a scar across their face',
  'wears distinctive jewelry',
  'has unusual eye color',
  'walks with a limp',
  'has tattoos covering their arms',
  'dresses in fine clothes',
  'has a missing finger',
  'carries a weapon everywhere'
]

// ===========================================
// UTILITY
// ===========================================

function generateId(): string {
  return crypto.randomUUID()
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateName(race: string = 'human', gender: 'male' | 'female' = 'male'): string {
  const raceNames = NAMES[race.toLowerCase() as keyof typeof NAMES] || NAMES.human
  return randomFrom(raceNames[gender] || raceNames.male)
}

function generateStats(): NPCStats {
  return {
    strength: Math.floor(Math.random() * 15) + 3,
    dexterity: Math.floor(Math.random() * 15) + 3,
    constitution: Math.floor(Math.random() * 15) + 3,
    intelligence: Math.floor(Math.random() * 15) + 3,
    wisdom: Math.floor(Math.random() * 15) + 3,
    charisma: Math.floor(Math.random() * 15) + 3,
  }
}

function generateDescription(npc: Partial<NPC>): string {
  const traits: string[] = []
  
  if (npc.race) traits.push(`is a ${npc.race}`)
  if (npc.class) traits.push(`${npc.class}`)
  if (npc.level) traits.push(`level ${npc.level}`)
  
  const personality = randomFrom(PERSONALITY_TRAITS)
  const physical = randomFrom(PHYSICAL_TRAITS)
  
  return `${npc.name || 'This NPC'} ${traits.join(', ')}. They ${personality} and ${physical}.`
}

// ===========================================
// NPC OPERATIONS
// ===========================================

async function createNPC(data: Partial<NPC>): Promise<NPC> {
  const id = generateId()
  const now = new Date().toISOString()
  
  const npc: NPC = {
    id,
    name: data.name || 'Unknown',
    type: data.type || 'npc',
    race: data.race || 'human',
    class: data.class || 'commoner',
    level: data.level || 1,
    hp: data.hp || 10,
    maxHp: data.maxHp || 10,
    ac: data.ac || 10,
    speed: data.speed || 30,
    description: data.description || '',
    disposition: data.disposition || 'neutral',
    location: data.location || 'Unknown',
    memories: data.memories || [],
    relationships: data.relationships || {},
    stats: data.stats || generateStats(),
    abilities: data.abilities || [],
    actions: data.actions || [],
    inventory: data.inventory || [],
    portrait: data.portrait,
    notes: data.notes,
    tags: data.tags || [],
    createdAt: now,
    updatedAt: now,
  }
  
  if (!npc.description) {
    npc.description = generateDescription(npc)
  }
  
  npcs.set(id, npc)
  return npc
}

async function getNPC(id: string): Promise<NPC | null> {
  return npcs.get(id) || null
}

async function updateNPC(id: string, data: Partial<NPC>): Promise<NPC> {
  const npc = npcs.get(id)
  if (!npc) throw new Error("NPC not found")
  
  const updated: NPC = {
    ...npc,
    ...data,
    id,
    updatedAt: new Date().toISOString(),
  }
  
  npcs.set(id, updated)
  return updated
}

async function deleteNPC(id: string): Promise<void> {
  npcs.delete(id)
  dialogues.delete(id)
}

async function listNPCs(filter?: { type?: string; location?: string; disposition?: string }): Promise<NPC[]> {
  let all = Array.from(npcs.values())
  
  if (filter?.type) {
    all = all.filter(n => n.type === filter.type)
  }
  if (filter?.location) {
    all = all.filter(n => n.location === filter.location)
  }
  if (filter?.disposition) {
    all = all.filter(n => n.disposition === filter.disposition)
  }
  
  return all
}

// ===========================================
// NPC GENERATION
// ===========================================

async function generateNPC(options: {
  type?: 'npc' | 'monster' | 'creature'
  race?: string
  class?: string
  level?: number
  location?: string
  prompt?: string
}): Promise<NPC> {
  const race = options.race || randomFrom(Object.keys(NAMES))
  const gender = Math.random() > 0.5 ? 'male' : 'female'
  const name = generateName(race, gender)
  const npcClass = options.class || randomFrom(CLASSES)
  const level = options.level || Math.floor(Math.random() * 10) + 1
  const disposition = randomFrom(DISPOSITIONS)
  const location = options.location || randomFrom(LOCATIONS)
  
  // Calculate HP based on class and level
  const hitDie: Record<string, number> = {
    'Barbarian': 12, 'Fighter': 10, 'Paladin': 10, 'Ranger': 10,
    'Bard': 8, 'Cleric': 8, 'Druid': 8, 'Monk': 8, 'Rogue': 8, 'Warlock': 8,
    'Sorcerer': 6, 'Wizard': 6,
  }
  const hd = hitDie[npcClass] || 8
  const conMod = Math.floor((Math.floor(Math.random() * 15) + 3 - 10) / 2)
  const maxHp = hd + conMod + (level - 1) * (Math.floor(hd / 2) + 1 + conMod)
  
  return createNPC({
    name,
    type: options.type || 'npc',
    race,
    class: npcClass,
    level,
    hp: maxHp,
    maxHp,
    ac: Math.floor(Math.random() * 6) + 12,
    disposition,
    location,
    memories: [],
    relationships: {},
    stats: generateStats(),
    tags: [race.toLowerCase(), npcClass.toLowerCase(), disposition],
  })
}

// ===========================================
// MEMORY OPERATIONS
// ===========================================

async function addMemory(npcId: string, memory: string): Promise<NPC> {
  const npc = npcs.get(npcId)
  if (!npc) throw new Error("NPC not found")
  
  npc.memories.push(memory)
  npc.updatedAt = new Date().toISOString()
  
  npcs.set(npcId, npc)
  return npc
}

async function getMemories(npcId: string, limit?: number): Promise<string[]> {
  const npc = npcs.get(npcId)
  if (!npc) throw new Error("NPC not found")
  
  const all = npc.memories
  return limit ? all.slice(-limit) : all
}

// ===========================================
// RELATIONSHIP OPERATIONS
// ===========================================

async function setRelationship(npcId: string, targetId: string, relationship: string): Promise<NPC> {
  const npc = npcs.get(npcId)
  if (!npc) throw new Error("NPC not found")
  
  npc.relationships[targetId] = relationship
  npc.updatedAt = new Date().toISOString()
  
  npcs.set(npcId, npc)
  return npc
}

async function getRelationships(npcId: string): Promise<Record<string, string>> {
  const npc = npcs.get(npcId)
  if (!npc) throw new Error("NPC not found")
  
  return npc.relationships
}

// ===========================================
// DIALOGUE OPERATIONS
// ===========================================

async function addDialogue(npcId: string, dialogue: Omit<DialogueLine, 'id' | 'npcId'>): Promise<DialogueLine> {
  const id = generateId()
  const line: DialogueLine = {
    id,
    npcId,
    ...dialogue,
  }
  
  const npcDialogues = dialogues.get(npcId) || []
  npcDialogues.push(line)
  dialogues.set(npcId, npcDialogues)
  
  return line
}

async function getDialogues(npcId: string): Promise<DialogueLine[]> {
  return dialogues.get(npcId) || []
}

async function getDialogueByTrigger(npcId: string, trigger: string): Promise<DialogueLine | null> {
  const npcDialogues = dialogues.get(npcId) || []
  return npcDialogues.find(d => d.trigger === trigger) || null
}

// ===========================================
// IMPORT/EXPORT
// ===========================================

async function exportNPC(npcId: string): Promise<NPC> {
  const npc = npcs.get(npcId)
  if (!npc) throw new Error("NPC not found")
  return JSON.parse(JSON.stringify(npc))
}

async function importNPC(data: Partial<NPC>): Promise<NPC> {
  const id = generateId()
  const now = new Date().toISOString()
  
  const npc: NPC = {
    id,
    name: data.name || 'Unknown',
    type: data.type || 'npc',
    race: data.race || 'human',
    class: data.class || 'commoner',
    level: data.level || 1,
    hp: data.hp || 10,
    maxHp: data.maxHp || 10,
    ac: data.ac || 10,
    speed: data.speed || 30,
    description: data.description || '',
    disposition: data.disposition || 'neutral',
    location: data.location || 'Unknown',
    memories: data.memories || [],
    relationships: data.relationships || {},
    stats: data.stats || generateStats(),
    abilities: data.abilities || [],
    actions: data.actions || [],
    inventory: data.inventory || [],
    portrait: data.portrait,
    notes: data.notes,
    tags: data.tags || [],
    createdAt: now,
    updatedAt: now,
  }
  
  npcs.set(id, npc)
  return npc
}

// ===========================================
// MAIN HANDLER
// ===========================================

serve(async (req: Request) => {
  const headers = corsHeaders(req, CORS_OPTS)
  
  const optionsResponse = handleOptions(req, CORS_OPTS)
  if (optionsResponse) return optionsResponse
  
  const url = new URL(req.url)
  const path = url.pathname.replace("/functions/v1/npcs", "")
  
  try {
    // GET /health
    if (req.method === "GET" && path === "/health") {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        features: ['npcs', 'generation', 'memories', 'relationships', 'dialogues', 'import-export'],
      }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /npcs - Create NPC
    if (req.method === "POST" && path === "/npcs") {
      const body = await req.json()
      const npc = await createNPC(body)
      
      return new Response(JSON.stringify(npc), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /npcs - List NPCs
    if (req.method === "GET" && path === "/npcs") {
      const filter = {
        type: url.searchParams.get('type') || undefined,
        location: url.searchParams.get('location') || undefined,
        disposition: url.searchParams.get('disposition') || undefined,
      }
      const list = await listNPCs(filter)
      
      return new Response(JSON.stringify(list), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /npcs/:id - Get NPC
    if (req.method === "GET" && path.match(/^\/npcs\/[\w-]+$/)) {
      const id = path.split("/")[2]
      const npc = await getNPC(id)
      
      if (!npc) {
        return new Response(JSON.stringify({ error: "NPC not found" }), {
          status: 404,
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
      
      return new Response(JSON.stringify(npc), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // PUT /npcs/:id - Update NPC
    if (req.method === "PUT" && path.match(/^\/npcs\/[\w-]+$/)) {
      const id = path.split("/")[2]
      const body = await req.json()
      const npc = await updateNPC(id, body)
      
      return new Response(JSON.stringify(npc), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // DELETE /npcs/:id - Delete NPC
    if (req.method === "DELETE" && path.match(/^\/npcs\/[\w-]+$/)) {
      const id = path.split("/")[2]
      await deleteNPC(id)
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /npcs/generate - Generate NPC
    if (req.method === "POST" && path === "/npcs/generate") {
      const body = await req.json()
      const npc = await generateNPC(body)
      
      return new Response(JSON.stringify(npc), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /npcs/:id/memory - Add memory
    if (req.method === "POST" && path.match(/^\/npcs\/[\w-]+\/memory$/)) {
      const id = path.split("/")[2]
      const body = await req.json()
      const npc = await addMemory(id, body.memory)
      
      return new Response(JSON.stringify(npc), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /npcs/:id/memories - Get memories
    if (req.method === "GET" && path.match(/^\/npcs\/[\w-]+\/memories$/)) {
      const id = path.split("/")[2]
      const limit = parseInt(url.searchParams.get('limit') || '10')
      const memories = await getMemories(id, limit)
      
      return new Response(JSON.stringify(memories), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /npcs/:id/relationship - Set relationship
    if (req.method === "POST" && path.match(/^\/npcs\/[\w-]+\/relationship$/)) {
      const id = path.split("/")[2]
      const body = await req.json()
      const npc = await setRelationship(id, body.targetId, body.relationship)
      
      return new Response(JSON.stringify(npc), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /npcs/:id/relationships - Get relationships
    if (req.method === "GET" && path.match(/^\/npcs\/[\w-]+\/relationships$/)) {
      const id = path.split("/")[2]
      const relationships = await getRelationships(id)
      
      return new Response(JSON.stringify(relationships), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /npcs/:id/dialogue - Add dialogue
    if (req.method === "POST" && path.match(/^\/npcs\/[\w-]+\/dialogue$/)) {
      const id = path.split("/")[2]
      const body = await req.json()
      const dialogue = await addDialogue(id, body)
      
      return new Response(JSON.stringify(dialogue), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /npcs/:id/dialogues - Get dialogues
    if (req.method === "GET" && path.match(/^\/npcs\/[\w-]+\/dialogues$/)) {
      const id = path.split("/")[2]
      const dialogues = await getDialogues(id)
      
      return new Response(JSON.stringify(dialogues), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /npcs/:id/export - Export NPC
    if (req.method === "GET" && path.match(/^\/npcs\/[\w-]+\/export$/)) {
      const id = path.split("/")[2]
      const npc = await exportNPC(id)
      
      return new Response(JSON.stringify(npc), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /npcs/import - Import NPC
    if (req.method === "POST" && path === "/npcs/import") {
      const body = await req.json()
      const npc = await importNPC(body)
      
      return new Response(JSON.stringify(npc), {
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