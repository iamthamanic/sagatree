import {
  corsHeaders,
  handleOptions,
  type CorsOptions,
} from '../_shared/cors.ts';

const CORS_OPTS: CorsOptions = {
  missingOriginPolicy: 'configured-or-star',
};
// ===========================================
// Sessions Function (Extended)
// Session management, save/load, player sync, chat, world state
// ===========================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// ===========================================
// TYPES (SOLID: Single Responsibility)
// ===========================================

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

interface NPCState {
  id: string
  name: string
  disposition: 'friendly' | 'neutral' | 'hostile' | 'unknown'
  location: string
  memories: string[]
  relationships: Record<string, string>
}

interface SavePoint {
  id: string
  name: string
  description?: string
  worldState: WorldState
  playerStates: PlayerState[]
  createdAt: string
}

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

interface SessionLog {
  id: string
  sessionId: string
  type: 'action' | 'combat' | 'dialogue' | 'exploration' | 'rest' | 'level-up'
  description: string
  details?: Record<string, any>
  timestamp: string
}

// ===========================================
// STORAGE (In-Memory for now, use Redis/DB in production)
// ===========================================

const sessions = new Map<string, Session>()
const sessionPlayers = new Map<string, SessionPlayer[]>()
const chatMessages = new Map<string, ChatMessage[]>()
const sessionLogs = new Map<string, SessionLog[]>()

// ===========================================
// UTILITY FUNCTIONS (DRY)
// ===========================================

function generateId(): string {
  return crypto.randomUUID()
}

function validateSessionData(data: Partial<Session>): { valid: boolean; error?: string } {
  if (!data.projectId) return { valid: false, error: "Missing projectId" }
  if (!data.name) return { valid: false, error: "Missing name" }
  return { valid: true }
}

// ===========================================
// SESSION MANAGEMENT (SOLID: Single Responsibility)
// ===========================================

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

async function getSession(sessionId: string): Promise<Session | null> {
  return sessions.get(sessionId) || null
}

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

async function deleteSession(sessionId: string): Promise<void> {
  sessions.delete(sessionId)
  sessionPlayers.delete(sessionId)
  chatMessages.delete(sessionId)
  sessionLogs.delete(sessionId)
}

async function listSessions(projectId?: string): Promise<Session[]> {
  const all = Array.from(sessions.values())
  if (projectId) {
    return all.filter(s => s.projectId === projectId)
  }
  return all
}

// ===========================================
// SESSION LIFECYCLE (SOLID: Single Responsibility)
// ===========================================

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

async function pauseSession(sessionId: string): Promise<Session> {
  const session = sessions.get(sessionId)
  if (!session) throw new Error("Session not found")
  
  session.status = 'paused'
  session.updatedAt = new Date().toISOString()
  
  sessions.set(sessionId, session)
  return session
}

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

// ===========================================
// PLAYER MANAGEMENT (SOLID: Single Responsibility)
// ===========================================

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

async function leaveSession(sessionId: string, userId: string): Promise<void> {
  const players = sessionPlayers.get(sessionId) || []
  const player = players.find(p => p.userId === userId)
  
  if (player) {
    player.isOnline = false
    player.leftAt = new Date().toISOString()
  }
  
  sessionPlayers.set(sessionId, players)
}

async function getSessionPlayers(sessionId: string): Promise<SessionPlayer[]> {
  return sessionPlayers.get(sessionId) || []
}

async function updatePlayerActivity(sessionId: string, userId: string): Promise<void> {
  const players = sessionPlayers.get(sessionId) || []
  const player = players.find(p => p.userId === userId)
  
  if (player) {
    player.lastActivity = new Date().toISOString()
    sessionPlayers.set(sessionId, players)
  }
}

// ===========================================
// CHAT (SOLID: Single Responsibility)
// ===========================================

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

async function getChatHistory(sessionId: string, limit: number = 100): Promise<ChatMessage[]> {
  const messages = chatMessages.get(sessionId) || []
  return messages.slice(-limit)
}

async function deleteChatMessage(sessionId: string, messageId: string): Promise<void> {
  const messages = chatMessages.get(sessionId) || []
  const filtered = messages.filter(m => m.id !== messageId)
  chatMessages.set(sessionId, filtered)
}

// ===========================================
// WORLD STATE (SOLID: Single Responsibility)
// ===========================================

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

async function getWorldState(sessionId: string): Promise<WorldState> {
  const session = sessions.get(sessionId)
  if (!session) throw new Error("Session not found")
  
  return session.worldState
}

// ===========================================
// SAVE/LOAD (SOLID: Single Responsibility)
// ===========================================

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

async function listSavePoints(sessionId: string): Promise<SavePoint[]> {
  const session = sessions.get(sessionId)
  if (!session) throw new Error("Session not found")
  
  return session.savePoints
}

async function deleteSavePoint(sessionId: string, savePointId: string): Promise<void> {
  const session = sessions.get(sessionId)
  if (!session) throw new Error("Session not found")
  
  session.savePoints = session.savePoints.filter(sp => sp.id !== savePointId)
  sessions.set(sessionId, session)
}

// ===========================================
// SESSION LOG (SOLID: Single Responsibility)
// ===========================================

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

async function getSessionLogs(sessionId: string, limit: number = 100): Promise<SessionLog[]> {
  const logs = sessionLogs.get(sessionId) || []
  return logs.slice(-limit)
}

// ===========================================
// EXPORT/IMPORT (SOLID: Single Responsibility)
// ===========================================

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

// ===========================================
// MAIN HANDLER
// ===========================================

serve(async (req: Request) => {
  const headers = corsHeaders(req, CORS_OPTS)
  
  const optionsResponse = handleOptions(req, CORS_OPTS)
  if (optionsResponse) return optionsResponse
  
  const url = new URL(req.url)
  const path = url.pathname.replace("/functions/v1/sessions", "")
  
  try {
    // GET /health
    if (req.method === "GET" && path === "/health") {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        features: ['session-management', 'players', 'chat', 'world-state', 'save-load', 'export-import'],
      }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /sessions - List all sessions
    if (req.method === "GET" && path === "/sessions") {
      const projectId = url.searchParams.get('projectId') || undefined
      const sessionsList = await listSessions(projectId)
      
      return new Response(JSON.stringify(sessionsList), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /sessions - Create session
    if (req.method === "POST" && path === "/sessions") {
      const body = await req.json()
      const session = await createSession(body)
      
      return new Response(JSON.stringify(session), {
        status: 201,
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /sessions/:id - Get session
    if (req.method === "GET" && path.match(/^\/sessions\/[\w-]+$/)) {
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
    
    // PUT /sessions/:id - Update session
    if (req.method === "PUT" && path.match(/^\/sessions\/[\w-]+$/)) {
      const sessionId = path.split("/")[2]
      const body = await req.json()
      const session = await updateSession(sessionId, body)
      
      return new Response(JSON.stringify(session), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // DELETE /sessions/:id - Delete session
    if (req.method === "DELETE" && path.match(/^\/sessions\/[\w-]+$/)) {
      const sessionId = path.split("/")[2]
      await deleteSession(sessionId)
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /sessions/:id/start - Start session
    if (req.method === "POST" && path.match(/^\/sessions\/[\w-]+\/start$/)) {
      const sessionId = path.split("/")[2]
      const session = await startSession(sessionId)
      
      return new Response(JSON.stringify(session), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /sessions/:id/pause - Pause session
    if (req.method === "POST" && path.match(/^\/sessions\/[\w-]+\/pause$/)) {
      const sessionId = path.split("/")[2]
      const session = await pauseSession(sessionId)
      
      return new Response(JSON.stringify(session), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /sessions/:id/end - End session
    if (req.method === "POST" && path.match(/^\/sessions\/[\w-]+\/end$/)) {
      const sessionId = path.split("/")[2]
      const session = await endSession(sessionId)
      
      return new Response(JSON.stringify(session), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /sessions/:id/join - Join session
    if (req.method === "POST" && path.match(/^\/sessions\/[\w-]+\/join$/)) {
      const sessionId = path.split("/")[2]
      const body = await req.json()
      const player = await joinSession(sessionId, body)
      
      return new Response(JSON.stringify(player), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /sessions/:id/leave - Leave session
    if (req.method === "POST" && path.match(/^\/sessions\/[\w-]+\/leave$/)) {
      const sessionId = path.split("/")[2]
      const body = await req.json()
      await leaveSession(sessionId, body.userId)
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /sessions/:id/players - Get session players
    if (req.method === "GET" && path.match(/^\/sessions\/[\w-]+\/players$/)) {
      const sessionId = path.split("/")[2]
      const players = await getSessionPlayers(sessionId)
      
      return new Response(JSON.stringify(players), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /sessions/:id/chat - Send chat message
    if (req.method === "POST" && path.match(/^\/sessions\/[\w-]+\/chat$/)) {
      const sessionId = path.split("/")[2]
      const body = await req.json()
      const message = await sendChatMessage(sessionId, body)
      
      return new Response(JSON.stringify(message), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /sessions/:id/chat - Get chat history
    if (req.method === "GET" && path.match(/^\/sessions\/[\w-]+\/chat$/)) {
      const sessionId = path.split("/")[2]
      const limit = parseInt(url.searchParams.get('limit') || '100')
      const messages = await getChatHistory(sessionId, limit)
      
      return new Response(JSON.stringify(messages), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // DELETE /sessions/:id/chat/:messageId - Delete chat message
    if (req.method === "DELETE" && path.match(/^\/sessions\/[\w-]+\/chat\/[\w-]+$/)) {
      const sessionId = path.split("/")[2]
      const messageId = path.split("/")[4]
      await deleteChatMessage(sessionId, messageId)
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /sessions/:id/world-state - Get world state
    if (req.method === "GET" && path.match(/^\/sessions\/[\w-]+\/world-state$/)) {
      const sessionId = path.split("/")[2]
      const worldState = await getWorldState(sessionId)
      
      return new Response(JSON.stringify(worldState), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // PUT /sessions/:id/world-state - Update world state
    if (req.method === "PUT" && path.match(/^\/sessions\/[\w-]+\/world-state$/)) {
      const sessionId = path.split("/")[2]
      const body = await req.json()
      const worldState = await updateWorldState(sessionId, body)
      
      return new Response(JSON.stringify(worldState), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /sessions/:id/save - Create save point
    if (req.method === "POST" && path.match(/^\/sessions\/[\w-]+\/save$/)) {
      const sessionId = path.split("/")[2]
      const body = await req.json()
      const savePoint = await createSavePoint(sessionId, body)
      
      return new Response(JSON.stringify(savePoint), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /sessions/:id/load/:savePointId - Load save point
    if (req.method === "POST" && path.match(/^\/sessions\/[\w-]+\/load\/[\w-]+$/)) {
      const sessionId = path.split("/")[2]
      const savePointId = path.split("/")[4]
      const data = await loadSavePoint(sessionId, savePointId)
      
      return new Response(JSON.stringify(data), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /sessions/:id/saves - List save points
    if (req.method === "GET" && path.match(/^\/sessions\/[\w-]+\/saves$/)) {
      const sessionId = path.split("/")[2]
      const savePoints = await listSavePoints(sessionId)
      
      return new Response(JSON.stringify(savePoints), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // DELETE /sessions/:id/save/:savePointId - Delete save point
    if (req.method === "DELETE" && path.match(/^\/sessions\/[\w-]+\/save\/[\w-]+$/)) {
      const sessionId = path.split("/")[2]
      const savePointId = path.split("/")[4]
      await deleteSavePoint(sessionId, savePointId)
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /sessions/:id/logs - Get session logs
    if (req.method === "GET" && path.match(/^\/sessions\/[\w-]+\/logs$/)) {
      const sessionId = path.split("/")[2]
      const limit = parseInt(url.searchParams.get('limit') || '100')
      const logs = await getSessionLogs(sessionId, limit)
      
      return new Response(JSON.stringify(logs), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /sessions/:id/logs - Add session log
    if (req.method === "POST" && path.match(/^\/sessions\/[\w-]+\/logs$/)) {
      const sessionId = path.split("/")[2]
      const body = await req.json()
      const log = await addSessionLog(sessionId, body)
      
      return new Response(JSON.stringify(log), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /sessions/:id/export - Export session
    if (req.method === "GET" && path.match(/^\/sessions\/[\w-]+\/export$/)) {
      const sessionId = path.split("/")[2]
      const data = await exportSession(sessionId)
      
      return new Response(JSON.stringify(data), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /sessions/import - Import session
    if (req.method === "POST" && path === "/sessions/import") {
      const body = await req.json()
      const session = await importSession(body)
      
      return new Response(JSON.stringify(session), {
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