import {
  corsHeaders,
  handleOptions,
  type CorsOptions,
} from '../_shared/cors.ts';

const CORS_OPTS: CorsOptions = {
  missingOriginPolicy: 'configured-or-star',
};
// ===========================================
// World Function (NEW)
// World/campaign management, locations, time
// ===========================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// ===========================================
// TYPES
// ===========================================

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

interface WorldSettings {
  ruleset: string
  technology: 'ancient' | 'medieval' | 'renaissance' | 'modern' | 'future' | 'custom'
  magic: 'none' | 'low' | 'medium' | 'high' | 'ubiquitous'
  tone: 'serious' | 'lighthearted' | 'dark' | 'heroic'
  startingLevel: number
  maxLevel: number
}

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

interface Weather {
  current: string
  temperature: number
  wind: 'calm' | 'light' | 'moderate' | 'strong' | 'storm'
  precipitation: 'none' | 'light' | 'moderate' | 'heavy'
  special?: string
}

// ===========================================
// STORAGE
// ===========================================

const worlds = new Map<string, World>()

// ===========================================
// UTILITY
// ===========================================

function generateId(): string {
  return crypto.randomUUID()
}

// ===========================================
// WORLD OPERATIONS
// ===========================================

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

async function getWorld(worldId: string): Promise<World | null> {
  return worlds.get(worldId) || null
}

async function getWorldByProject(projectId: string): Promise<World | null> {
  for (const [_, world] of worlds) {
    if (world.projectId === projectId) {
      return world
    }
  }
  return null
}

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

// ===========================================
// LOCATION OPERATIONS
// ===========================================

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

async function discoverLocation(worldId: string, locationId: string): Promise<Location> {
  return updateLocation(worldId, locationId, { discovered: true })
}

// ===========================================
// EVENT OPERATIONS
// ===========================================

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

async function getEvents(worldId: string, type?: WorldEvent['type']): Promise<WorldEvent[]> {
  const world = worlds.get(worldId)
  if (!world) throw new Error("World not found")
  
  if (type) {
    return world.events.filter(e => e.type === type)
  }
  
  return world.events
}

// ===========================================
// FACTION OPERATIONS
// ===========================================

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

// ===========================================
// TIME OPERATIONS
// ===========================================

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

// ===========================================
// WEATHER OPERATIONS
// ===========================================

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

// ===========================================
// MAIN HANDLER
// ===========================================

serve(async (req: Request) => {
  const headers = corsHeaders(req, CORS_OPTS)
  
  const optionsResponse = handleOptions(req, CORS_OPTS)
  if (optionsResponse) return optionsResponse
  
  const url = new URL(req.url)
  const path = url.pathname.replace("/functions/v1/world", "")
  
  try {
    // GET /health
    if (req.method === "GET" && path === "/health") {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        features: ['world', 'locations', 'events', 'factions', 'time', 'weather'],
      }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /worlds - Create world
    if (req.method === "POST" && path === "/worlds") {
      const body = await req.json()
      const world = await createWorld(body)
      
      return new Response(JSON.stringify(world), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /worlds/:id - Get world
    if (req.method === "GET" && path.match(/^\/worlds\/[\w-]+$/)) {
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
    
    // GET /worlds/project/:projectId - Get world by project
    if (req.method === "GET" && path.match(/^\/worlds\/project\/[\w-]+$/)) {
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
    
    // PUT /worlds/:id - Update world
    if (req.method === "PUT" && path.match(/^\/worlds\/[\w-]+$/)) {
      const worldId = path.split("/")[2]
      const body = await req.json()
      const world = await updateWorld(worldId, body)
      
      return new Response(JSON.stringify(world), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /worlds/:id/locations - Add location
    if (req.method === "POST" && path.match(/^\/worlds\/[\w-]+\/locations$/)) {
      const worldId = path.split("/")[2]
      const body = await req.json()
      const location = await addLocation(worldId, body)
      
      return new Response(JSON.stringify(location), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // PUT /worlds/:id/locations/:locationId - Update location
    if (req.method === "PUT" && path.match(/^\/worlds\/[\w-]+\/locations\/[\w-]+$/)) {
      const worldId = path.split("/")[2]
      const locationId = path.split("/")[4]
      const body = await req.json()
      const location = await updateLocation(worldId, locationId, body)
      
      return new Response(JSON.stringify(location), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /worlds/:id/locations/:locationId/discover - Discover location
    if (req.method === "POST" && path.match(/^\/worlds\/[\w-]+\/locations\/[\w-]+\/discover$/)) {
      const worldId = path.split("/")[2]
      const locationId = path.split("/")[4]
      const location = await discoverLocation(worldId, locationId)
      
      return new Response(JSON.stringify(location), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /worlds/:id/events - Add event
    if (req.method === "POST" && path.match(/^\/worlds\/[\w-]+\/events$/)) {
      const worldId = path.split("/")[2]
      const body = await req.json()
      const event = await addEvent(worldId, body)
      
      return new Response(JSON.stringify(event), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /worlds/:id/events - Get events
    if (req.method === "GET" && path.match(/^\/worlds\/[\w-]+\/events$/)) {
      const worldId = path.split("/")[2]
      const type = url.searchParams.get('type') as WorldEvent['type'] | undefined
      const events = await getEvents(worldId, type)
      
      return new Response(JSON.stringify(events), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /worlds/:id/factions - Add faction
    if (req.method === "POST" && path.match(/^\/worlds\/[\w-]+\/factions$/)) {
      const worldId = path.split("/")[2]
      const body = await req.json()
      const faction = await addFaction(worldId, body)
      
      return new Response(JSON.stringify(faction), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // PUT /worlds/:id/factions/:factionId/relationship - Update faction relationship
    if (req.method === "PUT" && path.match(/^\/worlds\/[\w-]+\/factions\/[\w-]+\/relationship$/)) {
      const worldId = path.split("/")[2]
      const factionId = path.split("/")[4]
      const body = await req.json()
      const faction = await updateFactionRelationship(worldId, factionId, body.targetId, body.status)
      
      return new Response(JSON.stringify(faction), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /worlds/:id/time/advance - Advance time
    if (req.method === "POST" && path.match(/^\/worlds\/[\w-]+\/time\/advance$/)) {
      const worldId = path.split("/")[2]
      const body = await req.json()
      const time = await advanceTime(worldId, body.hours || 1)
      
      return new Response(JSON.stringify(time), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // PUT /worlds/:id/weather - Set weather
    if (req.method === "PUT" && path.match(/^\/worlds\/[\w-]+\/weather$/)) {
      const worldId = path.split("/")[2]
      const body = await req.json()
      const weather = await setWeather(worldId, body)
      
      return new Response(JSON.stringify(weather), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /worlds/:id/weather/random - Random weather
    if (req.method === "POST" && path.match(/^\/worlds\/[\w-]+\/weather\/random$/)) {
      const worldId = path.split("/")[2]
      const weather = await randomWeather(worldId)
      
      return new Response(JSON.stringify(weather), {
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