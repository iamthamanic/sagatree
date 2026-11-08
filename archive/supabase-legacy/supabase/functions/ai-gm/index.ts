import {
  corsHeaders,
  handleOptions,
  type CorsOptions,
} from '../_shared/cors.ts';
import { consumePersistentAiGmRateLimit } from '../_shared/ai-gm-rate-limit.ts';
import { assertSessionMemberAccess } from '../_shared/session-membership-gate.ts';
import { resolveLlmProviderForUser } from '../_shared/ollama-llm-resolve.ts';
import type { CharacterLoreProviderConfig } from '../_shared/character-lore-provider.ts';

const CORS_OPTS: CorsOptions = {
  missingOriginPolicy: 'configured-or-star',
  methods: 'GET, POST, OPTIONS',
  allowHeaders: 'authorization, x-client-info, apikey, content-type, x-session-id, Content-Type, Authorization, X-Session-Id',
};
// ===========================================
// AI Game Master Function (Extended)
// Generates narrative, manages world state, NPC context
// ===========================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// ===========================================
// TYPES (SOLID: Single Responsibility)
// ===========================================

interface Character {
  id: string
  name: string
  race?: string
  class?: string
  level?: number
  hp?: number
  maxHp?: number
  ac?: number
  inventory?: string[]
  conditions?: string[]
}

interface NPC {
  id: string
  name: string
  description?: string
  disposition?: 'friendly' | 'neutral' | 'hostile'
  memories?: string[]
  relationships?: Record<string, string>
}

interface WorldState {
  location: string
  time?: string
  weather?: string
  activeCombats?: string[]
  activeQuests?: string[]
  exploredLocations?: string[]
}

interface SessionContext {
  sessionId: string
  characters: Character[]
  npcs: NPC[]
  worldState: WorldState
  recentEvents: string[]
  ruleset?: string
  tone?: 'serious' | 'lighthearted' | 'dark' | 'heroic'
}

interface GMRequest {
  sessionId: string
  action: string
  context?: Partial<SessionContext>
  stream?: boolean
  ruleset?: 'dnd5e' | 'pathfinder2e' | 'custom'
  tone?: 'serious' | 'lighthearted' | 'dark' | 'heroic'
}

interface GMResponse {
  narrative: string
  worldStateUpdate?: Partial<WorldState>
  npcUpdates?: Array<{ id: string; memories: string[] }>
  combatInitiated?: boolean
  diceRollsRequired?: Array<{ type: string; dc?: number; description: string }>
}

// ===========================================
// CONFIGURATION (DRY: Don't Repeat Yourself)
// ===========================================

const OLLAMA_HOST = Deno.env.get("OLLAMA_HOST") || "http://ollama:11434"
const OLLAMA_MODEL = Deno.env.get("OLLAMA_MODEL") || "llama3.2"
/** Persistent AI GM quota (#670). Override with AI_GM_RATE_LIMIT (1–60). */
const AI_GM_RATE_LIMIT_WINDOW_SECONDS = 60
const DEFAULT_AI_GM_RATE_LIMIT = 12
/** Same env family as character-lore / session-recap — cloud LLM without local Ollama. */
const AI_PROVIDER = (Deno.env.get("CHARACTER_AI_PROVIDER") || "ollama").trim()
const AI_MODEL = (
  Deno.env.get("CHARACTER_AI_MODEL") ||
  Deno.env.get("OLLAMA_MODEL") ||
  "llama3.2"
).trim()
const AI_BASE_URL = (
  Deno.env.get("CHARACTER_AI_BASE_URL") ||
  Deno.env.get("OLLAMA_HOST") ||
  "http://ollama:11434"
).replace(/\/+$/, "")
const AI_API_KEY = (Deno.env.get("CHARACTER_AI_API_KEY") || "").trim()
const LOREKEEPER_URL = Deno.env.get("LOREKEEPER_URL") || "http://localhost:9998/functions/v1/lorekeeper"
const SESSIONS_URL = Deno.env.get("SESSIONS_URL") || "http://localhost:9998/functions/v1/sessions"

function envFallbackProvider(): CharacterLoreProviderConfig {
  if (AI_PROVIDER === 'openai-compatible' && AI_BASE_URL && AI_API_KEY) {
    return {
      provider: 'openai-compatible',
      baseUrl: AI_BASE_URL,
      model: AI_MODEL || OLLAMA_MODEL,
      apiKey: AI_API_KEY,
    }
  }
  return {
    provider: 'ollama',
    baseUrl: AI_BASE_URL || OLLAMA_HOST,
    model: AI_MODEL || OLLAMA_MODEL,
  }
}

async function resolveOptionalUserId(req: Request): Promise<string | null> {
  const authorization = req.headers.get('Authorization')?.trim()
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim()
  const url = Deno.env.get('SUPABASE_URL')?.trim()
  if (!authorization?.startsWith('Bearer ') || !anonKey || !url) return null
  try {
    const response = await fetch(`${url.replace(/\/+$/, '')}/auth/v1/user`, {
      headers: { Authorization: authorization, apikey: anonKey },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return null
    const body: unknown = await response.json()
    return body && typeof body === 'object' && typeof (body as { id?: unknown }).id === 'string'
      ? (body as { id: string }).id
      : null
  } catch {
    return null
  }
}

async function resolveGmProvider(req: Request): Promise<CharacterLoreProviderConfig> {
  const userId = await resolveOptionalUserId(req)
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  const url = Deno.env.get('SUPABASE_URL')?.trim()
  const resolved = await resolveLlmProviderForUser(
    userId && serviceRoleKey && url
      ? { url: url.replace(/\/+$/, ''), serviceRoleKey }
      : null,
    userId,
  )
  return resolved ?? envFallbackProvider()
}

// System prompts by tone (KISS: Keep It Simple)
const SYSTEM_PROMPTS: Record<string, string> = {
  serious: "You are a serious, atmospheric Dungeon Master. Create tension and drama. Use rich, evocative language.",
  lighthearted: "You are a fun, lighthearted Dungeon Master. Include humor and wonder. Keep things entertaining.",
  dark: "You are a dark, gritty Dungeon Master. Emphasize danger, consequences, and moral complexity.",
  heroic: "You are an epic, heroic Dungeon Master. Inspire courage and heroism. Create legendary moments.",
}

// ===========================================
// UTILITY FUNCTIONS (SOLID: Single Responsibility)
// ===========================================

function getAiGmRateLimit(): number {
  const raw = Number.parseInt(Deno.env.get('AI_GM_RATE_LIMIT') || '', 10)
  if (!Number.isInteger(raw)) return DEFAULT_AI_GM_RATE_LIMIT
  return Math.min(60, Math.max(1, raw))
}

function getSupabaseServiceConfig(): { url: string; serviceRoleKey: string; anonKey: string } | null {
  const url = (
    Deno.env.get('SUPABASE_URL') ||
    Deno.env.get('API_EXTERNAL_URL') ||
    ''
  ).replace(/\/+$/, '')
  const serviceRoleKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim()
  const anonKey = (Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('ANON_KEY') || '').trim()
  if (!url || !serviceRoleKey || !anonKey) return null
  return { url, serviceRoleKey, anonKey }
}

/** Resolve caller user id from Bearer JWT (same path as membership gate). */
async function resolveCallerUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization')
  if (!auth?.toLowerCase().startsWith('bearer ')) return null
  const config = getSupabaseServiceConfig()
  if (!config) return null
  const userRes = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.anonKey,
      Authorization: auth,
      'Content-Type': 'application/json',
    },
  })
  if (!userRes.ok) return null
  const body = (await userRes.json()) as { id?: string }
  return typeof body.id === 'string' && body.id ? body.id : null
}

async function enforceAiGmRateLimit(req: Request, headers: HeadersInit): Promise<Response | null> {
  const config = getSupabaseServiceConfig()
  if (!config) {
    console.error('AI GM persistent rate limit unavailable: missing service-role configuration')
    return new Response(JSON.stringify({
      error: 'AI Game Master ist vorübergehend nicht verfügbar. Bitte versuche es später erneut.',
    }), {
      status: 503,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  const userId = await resolveCallerUserId(req)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  try {
    const allowed = await consumePersistentAiGmRateLimit(
      {
        url: config.url,
        serviceRoleKey: config.serviceRoleKey,
        limit: getAiGmRateLimit(),
        windowSeconds: AI_GM_RATE_LIMIT_WINDOW_SECONDS,
      },
      userId,
    )
    if (!allowed) {
      return new Response(JSON.stringify({
        error: 'Zu viele AI-GM-Anfragen. Bitte warte kurz und versuche es erneut.',
      }), {
        status: 429,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }
  } catch (error) {
    console.error(
      'AI GM persistent rate limit failed:',
      error instanceof Error ? error.message : 'unknown error',
    )
    return new Response(JSON.stringify({
      error: 'AI Game Master ist vorübergehend nicht verfügbar. Bitte versuche es später erneut.',
    }), {
      status: 503,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  return null
}

function validateRequest(body: unknown): { valid: boolean; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: "Invalid request body" }
  }
  
  const request = body as Record<string, unknown>
  
  if (!request.sessionId || typeof request.sessionId !== 'string') {
    return { valid: false, error: "Missing or invalid sessionId" }
  }
  
  if (!request.action || typeof request.action !== 'string') {
    return { valid: false, error: "Missing or invalid action" }
  }
  
  if (request.action.length > 5000) {
    return { valid: false, error: "Action too long (max 5000 characters)" }
  }
  
  return { valid: true }
}

function buildCharacterSection(characters: Character[]): string {
  if (!characters || characters.length === 0) return "No characters in party"
  
  return characters.map(c => {
    const parts = [`- ${c.name}`]
    if (c.race || c.class) parts.push(`(${c.race || 'Unknown'} ${c.class || 'Adventurer'})`)
    if (c.level) parts.push(`Level ${c.level}`)
    if (c.hp && c.maxHp) parts.push(`HP: ${c.hp}/${c.maxHp}`)
    if (c.conditions && c.conditions.length > 0) parts.push(`Conditions: ${c.conditions.join(', ')}`)
    return parts.join(' ')
  }).join('\n')
}

function buildNPCSection(npcs: NPC[]): string {
  if (!npcs || npcs.length === 0) return "No NPCs present"
  
  return npcs.map(n => {
    const parts = [`- ${n.name}`]
    if (n.description) parts.push(`: ${n.description}`)
    if (n.disposition) parts.push(`[${n.disposition}]`)
    if (n.memories && n.memories.length > 0) {
      parts.push(`\n  Recent memories: ${n.memories.slice(-3).join('; ')}`)
    }
    return parts.join('')
  }).join('\n')
}

function buildWorldSection(worldState: WorldState): string {
  const parts = [`## Current Location: ${worldState.location}`]
  
  if (worldState.time) parts.push(`Time: ${worldState.time}`)
  if (worldState.weather) parts.push(`Weather: ${worldState.weather}`)
  if (worldState.activeCombats && worldState.activeCombats.length > 0) {
    parts.push(`Active Combats: ${worldState.activeCombats.join(', ')}`)
  }
  if (worldState.activeQuests && worldState.activeQuests.length > 0) {
    parts.push(`Active Quests: ${worldState.activeQuests.join(', ')}`)
  }
  if (worldState.exploredLocations && worldState.exploredLocations.length > 0) {
    parts.push(`Explored: ${worldState.exploredLocations.join(', ')}`)
  }
  
  return parts.join('\n')
}

function buildRecentEventsSection(events: string[]): string {
  if (!events || events.length === 0) return "No recent events"
  
  return events.slice(-5).map((e, i) => `${i + 1}. ${e}`).join('\n')
}

function buildPrompt(request: GMRequest): string {
  const context = request.context || {} as Partial<SessionContext>
  const tone = request.tone || context.tone || 'serious'
  const ruleset = request.ruleset || context.ruleset || 'dnd5e'
  
  const systemPrompt = SYSTEM_PROMPTS[tone] || SYSTEM_PROMPTS.serious
  
  const characterSection = buildCharacterSection(context.characters || [])
  const npcSection = buildNPCSection(context.npcs || [])
  const worldSection = buildWorldSection(context.worldState || { location: 'Unknown' })
  const eventsSection = buildRecentEventsSection(context.recentEvents || [])
  
  return `${systemPrompt}

## Ruleset: ${ruleset.toUpperCase()}

## Session
ID: ${request.sessionId}

${worldSection}

## Party Members
${characterSection}

## NPCs Present
${npcSection}

## Recent Events
${eventsSection}

## Guidelines
- Stay in character as the Dungeon Master
- Describe scenes vividly but concisely
- React to player actions realistically
- Call for dice rolls when appropriate (perception, attack, skill checks)
- Maintain narrative consistency with established facts
- Create opportunities for player agency
- End responses with clear prompts for next actions
- If combat begins, describe it cinematically
- Track and reference NPC memories and relationships

## Player Action
${request.action}

## Dungeon Master Response
`
}

// ===========================================
// LOREKEEPER INTEGRATION (Single Responsibility)
// ===========================================

async function getNPCContext(npcId: string): Promise<NPC | null> {
  try {
    const response = await fetch(`${LOREKEEPER_URL}/npc/${npcId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    
    if (!response.ok) return null
    
    const data = await response.json()
    return data as NPC
  } catch {
    return null
  }
}

async function updateNPCMemory(npcId: string, memory: string): Promise<void> {
  try {
    await fetch(`${LOREKEEPER_URL}/npc/${npcId}/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: memory, type: 'event' }),
    })
  } catch {
    // Silently fail - not critical
  }
}

// ===========================================
// SESSION STATE INTEGRATION
// ===========================================

async function updateSessionWorldState(sessionId: string, worldState: Partial<WorldState>): Promise<void> {
  try {
    await fetch(`${SESSIONS_URL}/${sessionId}/world-state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worldState }),
    })
  } catch {
    // Silently fail - not critical
  }
}

// ===========================================
// LLM INTEGRATION (Ollama local/remote or openai-compatible cloud)
// ===========================================

async function* generateOpenAiCompatibleNarrative(
  prompt: string,
  stream: boolean,
  provider: CharacterLoreProviderConfig,
): AsyncGenerator<{ type: string; content?: string; done?: boolean }> {
  if (!provider.baseUrl || !provider.apiKey) {
    throw new Error(
      "openai-compatible requires base URL and API key (Settings → AI → Organize or CHARACTER_AI_*)",
    )
  }

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      stream,
      temperature: 0.85,
      messages: [
        {
          role: "system",
          content:
            "You are the SagaTree AI Game Master. Follow the user prompt faithfully.",
        },
        { role: "user", content: prompt },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI-compatible provider error: ${response.status} ${response.statusText}`)
  }

  if (!stream) {
    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) throw new Error("OpenAI-compatible provider returned empty content")
    yield { type: "narrative", content }
    yield { type: "complete", done: true }
    return
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error("No response stream")
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const raw of lines) {
        const line = raw.trim()
        if (!line.startsWith("data:")) continue
        const payload = line.slice(5).trim()
        if (!payload || payload === "[DONE]") continue
        try {
          const chunk = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>
          }
          const content = chunk.choices?.[0]?.delta?.content
          if (content) yield { type: "narrative", content }
        } catch {
          // ignore partial JSON frames
        }
      }
    }
    yield { type: "complete", done: true }
  } finally {
    reader.releaseLock()
  }
}

async function* generateNarrative(
  prompt: string,
  stream: boolean = true,
  provider: CharacterLoreProviderConfig = envFallbackProvider(),
): AsyncGenerator<{ type: string; content?: string; done?: boolean }> {
  if (provider.provider === "openai-compatible") {
    yield* generateOpenAiCompatibleNarrative(prompt, stream, provider)
    return
  }

  const ollamaHost = provider.baseUrl || OLLAMA_HOST
  const response = await fetch(`${ollamaHost}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: provider.model || OLLAMA_MODEL,
      prompt,
      stream,
    }),
  })
  
  if (!response.ok) {
    throw new Error(`Ollama error: ${response.statusText}`)
  }
  
  if (!stream) {
    const data = await response.json()
    yield { type: 'narrative', content: data.response }
    yield { type: 'complete', done: true }
    return
  }
  
  const reader = response.body?.getReader()
  if (!reader) throw new Error("No response stream")
  
  const decoder = new TextDecoder()
  
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const text = decoder.decode(value)
      const lines = text.split('\n').filter(Boolean)
      
      for (const line of lines) {
        try {
          const json = JSON.parse(line)
          if (json.response) {
            yield { type: 'narrative', content: json.response }
          }
          if (json.done) {
            yield { type: 'complete', done: true }
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// ===========================================
// RESPONSE PARSING (Extract structured data)
// ===========================================

function extractWorldStateUpdates(narrative: string): Partial<WorldState> | null {
  // Simple extraction - look for location changes, time mentions, etc.
  const locationMatch = narrative.match(/(?:enters?|arrives? at|moves? to|in)\s+(?:the\s+)?([A-Z][a-zA-Z\s']+)/i)
  const timeMatch = narrative.match(/(?:time is now|it's now|hours? pass|morning|evening|night|dawn|dusk)/i)
  
  const updates: Partial<WorldState> = {}
  
  if (locationMatch) {
    updates.location = locationMatch[1].trim()
  }
  
  if (timeMatch) {
    updates.time = timeMatch[0]
  }
  
  return Object.keys(updates).length > 0 ? updates : null
}

function extractDiceRollRequests(narrative: string): Array<{ type: string; dc?: number; description: string }> {
  const rolls: Array<{ type: string; dc?: number; description: string }> = []
  
  // Look for skill checks
  const skillMatch = narrative.match(/(?:roll|make)\s+(?:a\s+)?(\w+)\s+check(?:\s+DC\s+(\d+))?/i)
  if (skillMatch) {
    rolls.push({
      type: skillMatch[1].toLowerCase(),
      dc: skillMatch[2] ? parseInt(skillMatch[2]) : undefined,
      description: `Roll ${skillMatch[1]} check`,
    })
  }
  
  // Look for attack rolls
  const attackMatch = narrative.match(/(?:roll|make)\s+(?:an?\s+)?attack\s+roll/i)
  if (attackMatch) {
    rolls.push({
      type: 'attack',
      description: 'Roll attack',
    })
  }
  
  // Look for saving throws
  const saveMatch = narrative.match(/(?:make|roll)\s+(?:a\s+)?(\w+)\s+saving\s+throw(?:\s+DC\s+(\d+))?/i)
  if (saveMatch) {
    rolls.push({
      type: `${saveMatch[1].toLowerCase()}Save`,
      dc: saveMatch[2] ? parseInt(saveMatch[2]) : undefined,
      description: `Roll ${saveMatch[1]} saving throw`,
    })
  }
  
  return rolls
}

function extractCombatInitiated(narrative: string): boolean {
  const combatIndicators = [
    /rolls? for initiative/i,
    /combat begins/i,
    /enemies? appear/i,
    /draws? (?:their|his|her) weapon/i,
    /attacks?!/i,
    /initiative/i,
  ]
  
  return combatIndicators.some(pattern => pattern.test(narrative))
}

// ===========================================
// MAIN HANDLER
// ===========================================

serve(async (req: Request) => {
  const headers = corsHeaders(req, CORS_OPTS)
  
  // Handle preflight
  const optionsResponse = handleOptions(req, CORS_OPTS)
  if (optionsResponse) return optionsResponse
  
  // GET /health - Health check
  if (req.method === "GET" && req.url.endsWith('/health')) {
    return new Response(JSON.stringify({
      status: 'ok',
      provider: AI_PROVIDER,
      model: AI_MODEL || OLLAMA_MODEL,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...headers, "Content-Type": "application/json" },
    })
  }
  
  // POST / - Generate narrative
  if (req.method === "POST") {
    try {
      const body = await req.json()
      
      // Validate request
      const validation = validateRequest(body)
      if (!validation.valid) {
        return new Response(JSON.stringify({ error: validation.error }), {
          status: 400,
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
      
      const request: GMRequest = body
      const stream = request.stream !== false

      // #607: non-members must not reach Ollama / mutate world state
      const memberDenied = await assertSessionMemberAccess(req, request.sessionId)
      if (memberDenied) {
        return new Response(memberDenied.body, {
          status: memberDenied.status,
          headers: { ...headers, 'Content-Type': 'application/json' },
        })
      }

      // #670: persistent user quota before any LLM / lorekeeper fan-out
      const rateLimited = await enforceAiGmRateLimit(req, headers)
      if (rateLimited) return rateLimited
      
      // Fetch additional NPC context from Lorekeeper
      if (request.context?.npcs) {
        const npcPromises = request.context.npcs
          .filter(npc => npc.id)
          .map(npc => getNPCContext(npc.id))
        
        const npcContexts = await Promise.all(npcPromises)
        
        npcContexts.forEach((context, i) => {
          if (context && request.context?.npcs?.[i]) {
            request.context.npcs[i].memories = context.memories || []
            request.context.npcs[i].relationships = context.relationships || {}
          }
        })
      }
      
      // Build prompt
      const prompt = buildPrompt(request)
      const provider = await resolveGmProvider(req)
      
      // Generate narrative
      if (stream) {
        const encoder = new TextEncoder()
        let fullNarrative = ''
        
        const readableStream = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of generateNarrative(prompt, true, provider)) {
                if (chunk.type === 'narrative' && chunk.content) {
                  fullNarrative += chunk.content
                  controller.enqueue(encoder.encode(JSON.stringify({
                    type: 'narrative',
                    content: chunk.content,
                  }) + '\n'))
                } else if (chunk.type === 'complete') {
                  // Extract structured data from completed narrative
                  const worldUpdate = extractWorldStateUpdates(fullNarrative)
                  const diceRolls = extractDiceRollRequests(fullNarrative)
                  const combat = extractCombatInitiated(fullNarrative)
                  
                  // Update session world state if needed
                  if (worldUpdate && request.sessionId) {
                    await updateSessionWorldState(request.sessionId, worldUpdate)
                  }
                  
                  // Send final metadata
                  controller.enqueue(encoder.encode(JSON.stringify({
                    type: 'complete',
                    narrative: fullNarrative,
                    worldStateUpdate: worldUpdate,
                    diceRollsRequired: diceRolls.length > 0 ? diceRolls : undefined,
                    combatInitiated: combat,
                  }) + '\n'))
                  
                  controller.close()
                }
              }
            } catch (error: unknown) {
              controller.enqueue(encoder.encode(JSON.stringify({
                type: 'error',
                error: (error instanceof Error ? error.message : String(error)),
              }) + '\n'))
              controller.close()
            }
          },
        })
        
        return new Response(readableStream, {
          headers: { ...headers, "Content-Type": "text/event-stream" },
        })
      } else {
        // Non-streaming
        let fullNarrative = ''
        
        for await (const chunk of generateNarrative(prompt, false, provider)) {
          if (chunk.type === 'narrative' && chunk.content) {
            fullNarrative = chunk.content
          }
        }
        
        const worldUpdate = extractWorldStateUpdates(fullNarrative)
        const diceRolls = extractDiceRollRequests(fullNarrative)
        const combat = extractCombatInitiated(fullNarrative)
        
        if (worldUpdate && request.sessionId) {
          await updateSessionWorldState(request.sessionId, worldUpdate)
        }
        
        const response: GMResponse = {
          narrative: fullNarrative,
          worldStateUpdate: worldUpdate || undefined,
          diceRollsRequired: diceRolls.length > 0 ? diceRolls : undefined,
          combatInitiated: combat,
        }
        
        return new Response(JSON.stringify(response), {
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
    } catch (error: unknown) {
      return new Response(JSON.stringify({
        error: "Internal server error",
        message: (error instanceof Error ? error.message : String(error)),
        stack: (error instanceof Error ? error.stack : undefined),
      }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
  }
  
  // Method not allowed
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...headers, "Content-Type": "application/json" },
  })
})