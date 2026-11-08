import {
  corsHeaders,
  handleOptions,
  type CorsOptions,
} from '../_shared/cors.ts';

const CORS_OPTS: CorsOptions = {
  missingOriginPolicy: 'configured-or-star',
};
// ===========================================
// DM Tools Function (Extended)
// Dice rolling, combat, conditions, spells, rulesets
// ===========================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// ===========================================
// TYPES (SOLID: Single Responsibility)
// ===========================================

interface DiceRoll {
  notation: string
  count: number
  sides: number
  modifier: number
  keepHighest?: number
  keepLowest?: number
  advantage?: 'adv' | 'dis'
}

interface DiceResult {
  notation: string
  rolls: number[]
  modifier: number
  advantage?: 'adv' | 'dis'
  total: number
  criticalHit?: boolean
  criticalFail?: boolean
  details?: string
}

interface CombatParticipant {
  id: string
  name: string
  type: 'player' | 'npc' | 'monster'
  initiative: number
  initiativeBonus?: number
  hp: number
  maxHp: number
  ac: number
  conditions: string[]
  notes?: string
}

interface CombatState {
  id: string
  sessionId: string
  round: number
  currentTurn: number
  participants: CombatParticipant[]
  log: CombatLogEntry[]
  status: 'inactive' | 'active' | 'paused' | 'completed'
  startedAt?: string
  endedAt?: string
}

interface CombatLogEntry {
  type: string
  timestamp: string
  round?: number
  turn?: number
  actor?: string
  target?: string
  action?: string
  result?: any
  damage?: number
  healing?: number
  details?: string
  participants?: Array<{ id: string; name: string; initiative: number }>
}

interface Condition {
  name: string
  description: string
  effects: string[]
  duration?: string
}

interface Spell {
  id: string
  name: string
  level: number
  school: string
  castingTime: string
  range: string
  components: string[]
  duration: string
  description: string
  higherLevels?: string
  classes: string[]
}

interface AbilityCheckRequest {
  character: {
    name: string
    modifiers: Record<string, number>
    proficiency?: number
  }
  ability: string
  skill?: string
  dc: number
  advantage?: 'adv' | 'dis'
  guidance?: boolean
}

// ===========================================
// CONFIGURATION (DRY)
// ===========================================

const REDIS_URL = Deno.env.get("REDIS_URL") || "redis://localhost:6379"

// D&D 5e Conditions
const CONDITIONS: Record<string, Condition> = {
  blinded: {
    name: "Blinded",
    description: "A blinded creature can't see and automatically fails any ability check that requires sight.",
    effects: ["Disadvantage on attack rolls", "Attack rolls against you have advantage"],
  },
  charmed: {
    name: "Charmed",
    description: "A charmed creature can't attack the charmer or target the charmer with harmful abilities or magical effects.",
    effects: ["Can't attack charmer", "Social advantage on charmer"],
  },
  deafened: {
    name: "Deafened",
    description: "A deafened creature can't hear and automatically fails any ability check that requires hearing.",
    effects: ["Can't hear", "Fails hearing checks"],
  },
  frightened: {
    name: "Frightened",
    description: "A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight.",
    effects: ["Disadvantage on checks and attacks", "Can't approach source of fear"],
  },
  grappled: {
    name: "Grappled",
    description: "A grappled creature's speed becomes 0, and it can't benefit from any bonus to its speed.",
    effects: ["Speed 0", "Can't move"],
  },
  incapacitated: {
    name: "Incapacitated",
    description: "An incapacitated creature can't take actions or reactions.",
    effects: ["No actions", "No reactions"],
  },
  invisible: {
    name: "Invisible",
    description: "An invisible creature is impossible to see without the aid of magic or a special sense.",
    effects: ["Attack rolls against you have disadvantage", "Your attack rolls have advantage"],
  },
  paralyzed: {
    name: "Paralyzed",
    description: "A paralyzed creature is incapacitated and can't move or speak.",
    effects: ["Incapacitated", "Auto-fail STR/DEX saves", "Attacks against you have advantage", "Critical hits against you"],
  },
  petrified: {
    name: "Petrified",
    description: "A petrified creature is transformed, along with any nonmagical objects it is wearing or carrying, into a solid inanimate substance.",
    effects: ["Incapacitated", "Can't move/speak", "Resistance to all damage", "Immune to poison/disease"],
  },
  poisoned: {
    name: "Poisoned",
    description: "A poisoned creature has disadvantage on attack rolls and ability checks.",
    effects: ["Disadvantage on attacks and checks"],
  },
  prone: {
    name: "Prone",
    description: "A prone creature's only movement method is to crawl or stand up.",
    effects: ["Crawl movement only", "Disadvantage on attacks", "Melee attacks against you have advantage"],
  },
  restrained: {
    name: "Restrained",
    description: "A restrained creature's speed becomes 0, and it can't benefit from any bonus to its speed.",
    effects: ["Speed 0", "Disadvantage on attacks", "Advantage on attacks against you", "Disadvantage on DEX saves"],
  },
  stunned: {
    name: "Stunned",
    description: "A stunned creature is incapacitated, can't move, and can speak only falteringly.",
    effects: ["Incapacitated", "Can't move", "Auto-fail STR/DEX saves", "Attacks against you have advantage"],
  },
  unconscious: {
    name: "Unconscious",
    description: "An unconscious creature is incapacitated, can't move or speak, and is unaware of its surroundings.",
    effects: ["Incapacitated", "Can't move/speak", "Unaware", "Auto-fail STR/DEX saves", "Attacks against you have advantage", "Critical hits against you"],
  },
  exhausted: {
    name: "Exhaustion",
    description: "Exhaustion is measured in six levels. Each level adds additional effects.",
    effects: ["Level 1: Disadvantage on ability checks", "Level 2: Speed halved", "Level 3: Disadvantage on attacks and saves", "Level 4: HP max halved", "Level 5: Speed 0", "Level 6: Death"],
  },
}

// ===========================================
// DICE ROLLING (SOLID: Single Responsibility)
// ===========================================

function parseDiceNotation(notation: string): DiceRoll {
  // Parse: d20, 2d6, 3d8+5, 4d6kh3, 2d20kh1 (advantage)
  const match = notation.match(/^(\d+)?d(\d+)([+-]\d+)?(kh(\d+))?(kl(\d+))?$/i)
  
  if (!match) {
    throw new Error(`Invalid dice notation: ${notation}`)
  }
  
  return {
    notation,
    count: parseInt(match[1]) || 1,
    sides: parseInt(match[2]),
    modifier: parseInt(match[3]) || 0,
    keepHighest: match[5] ? parseInt(match[5]) : undefined,
    keepLowest: match[7] ? parseInt(match[7]) : undefined,
  }
}

function rollSingle(sides: number): number {
  return Math.floor(Math.random() * sides) + 1
}

function rollDice(
  notation: string,
  modifier: number = 0,
  advantage: 'adv' | 'dis' | null = null
): DiceResult {
  const dice = parseDiceNotation(notation)
  
  // Roll dice
  let rolls: number[]
  
  if (dice.sides === 20 && advantage) {
    // Advantage/disadvantage: roll twice
    const roll1 = rollSingle(dice.sides)
    const roll2 = rollSingle(dice.sides)
    rolls = advantage === 'adv' ? [Math.max(roll1, roll2)] : [Math.min(roll1, roll2)]
  } else if (dice.keepHighest || dice.keepLowest) {
    // Roll multiple, keep some
    const allRolls = Array.from({ length: dice.count }, () => rollSingle(dice.sides))
    if (dice.keepHighest) {
      rolls = allRolls.sort((a, b) => b - a).slice(0, dice.keepHighest)
    } else if (dice.keepLowest) {
      rolls = allRolls.sort((a, b) => a - b).slice(0, dice.keepLowest as number)
    } else {
      rolls = allRolls
    }
  } else {
    rolls = Array.from({ length: dice.count }, () => rollSingle(dice.sides))
  }
  
  const total = rolls.reduce((sum, roll) => sum + roll, 0) + modifier
  
  // Check for critical hit/fail on d20
  const criticalHit = dice.sides === 20 && rolls[0] === 20
  const criticalFail = dice.sides === 20 && rolls[0] === 1
  
  // Build details string
  const details = `${rolls.join(' + ')}${modifier !== 0 ? ` ${modifier >= 0 ? '+' : ''} ${modifier}` : ''} = ${total}`
  
  return {
    notation: notation,
    rolls,
    modifier,
    advantage: advantage || undefined,
    total,
    criticalHit,
    criticalFail,
    details,
  }
}

function rollMultiple(rolls: Array<{ notation: string; modifier?: number; advantage?: 'adv' | 'dis' }>): DiceResult[] {
  return rolls.map(r => rollDice(r.notation, r.modifier || 0, r.advantage || null))
}

// ===========================================
// COMBAT MANAGEMENT (SOLID: Single Responsibility)
// ===========================================

// In-memory storage (use Redis in production)
const combatStates = new Map<string, CombatState>()

function createCombatId(): string {
  return crypto.randomUUID()
}

async function initCombat(
  sessionId: string,
  participants: Array<Omit<CombatParticipant, 'initiative'>>
): Promise<CombatState> {
  // Roll initiative for each participant
  const participantsWithInitiative = participants.map(p => ({
    ...p,
    initiative: rollDice('d20').total + (p.initiativeBonus || 0),
    conditions: p.conditions || [],
  })).sort((a, b) => b.initiative - a.initiative)
  
  const combatId = createCombatId()
  
  const combatState: CombatState = {
    id: combatId,
    sessionId,
    round: 1,
    currentTurn: 0,
    participants: participantsWithInitiative,
    log: [{
      type: 'combat_start',
      timestamp: new Date().toISOString(),
      round: 1,
      participants: participantsWithInitiative.map(p => ({
        id: p.id,
        name: p.name,
        initiative: p.initiative,
      })),
    }],
    status: 'active',
    startedAt: new Date().toISOString(),
  }
  
  combatStates.set(combatId, combatState)
  return combatState
}

async function getCombatState(combatId: string): Promise<CombatState | null> {
  return combatStates.get(combatId) || null
}

async function getCombatBySession(sessionId: string): Promise<CombatState | null> {
  for (const [, combat] of combatStates) {
    if (combat.sessionId === sessionId && combat.status === 'active') {
      return combat
    }
  }
  return null
}

async function nextTurn(combatId: string): Promise<CombatState> {
  const combat = combatStates.get(combatId)
  if (!combat) throw new Error("Combat not found")
  
  // Clear expired conditions at end of turn
  const currentParticipant = combat.participants[combat.currentTurn]
  if (currentParticipant) {
    // Remove conditions that expire at end of turn
    // (This would need more complex condition tracking in production)
  }
  
  // Advance turn
  combat.currentTurn = (combat.currentTurn + 1) % combat.participants.length
  
  // New round?
  if (combat.currentTurn === 0) {
    combat.round++
    
    combat.log.push({
      type: 'round_start',
      timestamp: new Date().toISOString(),
      round: combat.round,
    })
  }
  
  const nextParticipant = combat.participants[combat.currentTurn]
  
  combat.log.push({
    type: 'turn_start',
    timestamp: new Date().toISOString(),
    round: combat.round,
    turn: combat.currentTurn,
    actor: nextParticipant.name,
  })
  
  combatStates.set(combatId, combat)
  return combat
}

async function applyDamage(combatId: string, targetId: string, damage: number): Promise<CombatState> {
  const combat = combatStates.get(combatId)
  if (!combat) throw new Error("Combat not found")
  
  const target = combat.participants.find(p => p.id === targetId)
  if (!target) throw new Error("Target not found in combat")
  
  const previousHp = target.hp
  target.hp = Math.max(0, target.hp - damage)
  
  combat.log.push({
    type: 'damage',
    timestamp: new Date().toISOString(),
    round: combat.round,
    turn: combat.currentTurn,
    target: target.name,
    damage,
    result: {
      previousHp,
      currentHp: target.hp,
      maxHp: target.maxHp,
    },
  })
  
  // Check for death/unconsciousness
  if (target.hp === 0) {
    target.conditions.push('unconscious')
    
    combat.log.push({
      type: 'condition_applied',
      timestamp: new Date().toISOString(),
      round: combat.round,
      turn: combat.currentTurn,
      target: target.name,
      action: 'unconscious',
      details: `${target.name} falls unconscious`,
    })
  }
  
  combatStates.set(combatId, combat)
  return combat
}

async function applyHealing(combatId: string, targetId: string, healing: number): Promise<CombatState> {
  const combat = combatStates.get(combatId)
  if (!combat) throw new Error("Combat not found")
  
  const target = combat.participants.find(p => p.id === targetId)
  if (!target) throw new Error("Target not found in combat")
  
  const previousHp = target.hp
  target.hp = Math.min(target.maxHp, target.hp + healing)
  
  // Remove unconscious condition if healed
  if (previousHp === 0 && target.hp > 0) {
    target.conditions = target.conditions.filter(c => c !== 'unconscious')
  }
  
  combat.log.push({
    type: 'healing',
    timestamp: new Date().toISOString(),
    round: combat.round,
    turn: combat.currentTurn,
    target: target.name,
    healing,
    result: {
      previousHp,
      currentHp: target.hp,
      maxHp: target.maxHp,
    },
  })
  
  combatStates.set(combatId, combat)
  return combat
}

async function applyCondition(
  combatId: string,
  targetId: string,
  condition: string
): Promise<CombatState> {
  const combat = combatStates.get(combatId)
  if (!combat) throw new Error("Combat not found")
  
  const target = combat.participants.find(p => p.id === targetId)
  if (!target) throw new Error("Target not found in combat")
  
  if (!target.conditions.includes(condition)) {
    target.conditions.push(condition)
    
    combat.log.push({
      type: 'condition_applied',
      timestamp: new Date().toISOString(),
      round: combat.round,
      turn: combat.currentTurn,
      target: target.name,
      action: condition,
    })
  }
  
  combatStates.set(combatId, combat)
  return combat
}

async function removeCondition(
  combatId: string,
  targetId: string,
  condition: string
): Promise<CombatState> {
  const combat = combatStates.get(combatId)
  if (!combat) throw new Error("Combat not found")
  
  const target = combat.participants.find(p => p.id === targetId)
  if (!target) throw new Error("Target not found in combat")
  
  target.conditions = target.conditions.filter(c => c !== condition)
  
  combat.log.push({
    type: 'condition_removed',
    timestamp: new Date().toISOString(),
    round: combat.round,
    turn: combat.currentTurn,
    target: target.name,
    action: condition,
  })
  
  combatStates.set(combatId, combat)
  return combat
}

async function endCombat(combatId: string): Promise<CombatState> {
  const combat = combatStates.get(combatId)
  if (!combat) throw new Error("Combat not found")
  
  combat.status = 'completed'
  combat.endedAt = new Date().toISOString()
  
  combat.log.push({
    type: 'combat_end',
    timestamp: new Date().toISOString(),
    round: combat.round,
  })
  
  combatStates.set(combatId, combat)
  return combat
}

// ===========================================
// ABILITY CHECKS (SOLID: Single Responsibility)
// ===========================================

async function performAbilityCheck(request: AbilityCheckRequest): Promise<{
  success: boolean
  roll: DiceResult
  ability: string
  skill?: string
  dc: number
  modifier: number
  criticalHit?: boolean
  criticalFail?: boolean
}> {
  const modifier = request.character.modifiers[request.ability] || 0
  const proficiency = request.character.proficiency || 0
  
  // Skill check uses ability modifier + proficiency
  const totalModifier = request.skill
    ? modifier + proficiency
    : modifier
  
  // Guidance adds 1d4
  let guidanceBonus = 0
  if (request.guidance) {
    guidanceBonus = rollDice('d4').total
  }
  
  const roll = rollDice('d20', totalModifier + guidanceBonus, request.advantage || null)
  
  // Natural 20 always succeeds, natural 1 always fails
  const success = roll.criticalFail ? false : (roll.criticalHit ? true : roll.total >= request.dc)
  
  return {
    success,
    roll,
    ability: request.ability,
    skill: request.skill,
    dc: request.dc,
    modifier: totalModifier,
    criticalHit: roll.criticalHit,
    criticalFail: roll.criticalFail,
  }
}

// ===========================================
// RULESETS (KISS: Simple lookup)
// ===========================================

const RULESETS: Record<string, any> = {
  dnd5e: {
    name: "D&D 5th Edition",
    abilities: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'],
    skills: {
      acrobatics: 'dexterity',
      'animal handling': 'wisdom',
      arcana: 'intelligence',
      athletics: 'strength',
      deception: 'charisma',
      history: 'intelligence',
      insight: 'wisdom',
      intimidation: 'charisma',
      investigation: 'intelligence',
      medicine: 'wisdom',
      nature: 'intelligence',
      perception: 'wisdom',
      performance: 'charisma',
      persuasion: 'charisma',
      religion: 'intelligence',
      'sleight of hand': 'dexterity',
      stealth: 'dexterity',
      survival: 'wisdom',
    },
    conditions: Object.keys(CONDITIONS),
    dice: ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'],
    advantage: true,
    inspiration: true,
  },
  pathfinder2e: {
    name: "Pathfinder 2nd Edition",
    abilities: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'],
    skills: {
      acrobatics: 'dexterity',
      arcana: 'intelligence',
      athletics: 'strength',
      crafting: 'intelligence',
      deception: 'charisma',
      diplomacy: 'charisma',
      intimidation: 'charisma',
      medicine: 'wisdom',
      nature: 'wisdom',
      occultism: 'intelligence',
      performance: 'charisma',
      religion: 'wisdom',
      society: 'intelligence',
      stealth: 'dexterity',
      survival: 'wisdom',
      thievery: 'dexterity',
    },
    conditions: Object.keys(CONDITIONS),
    dice: ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'],
    advantage: true,
    'degree-of-success': true,
  },
}

// ===========================================
// MAIN HANDLER
// ===========================================

serve(async (req: Request) => {
  const headers = corsHeaders(req, CORS_OPTS)
  
  const optionsResponse = handleOptions(req, CORS_OPTS)
  if (optionsResponse) return optionsResponse
  
  const url = new URL(req.url)
  const path = url.pathname.replace("/functions/v1/dm-tools", "")
  
  try {
    // GET /health
    if (req.method === "GET" && path === "/health") {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        features: ['dice', 'combat', 'conditions', 'ability-checks', 'rulesets'],
      }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /dice - Roll dice
    if (req.method === "POST" && path === "/dice") {
      const body = await req.json()
      const { notation, modifier, advantage } = body
      
      const result = rollDice(notation, modifier || 0, advantage || null)
      
      return new Response(JSON.stringify(result), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /dice/multiple - Roll multiple dice
    if (req.method === "POST" && path === "/dice/multiple") {
      const body = await req.json()
      const results = rollMultiple(body.rolls)
      
      return new Response(JSON.stringify(results), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /combat/init - Initialize combat
    if (req.method === "POST" && path === "/combat/init") {
      const body = await req.json()
      const combat = await initCombat(body.sessionId, body.participants)
      
      return new Response(JSON.stringify(combat), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /combat/:id - Get combat state
    if (req.method === "GET" && path.match(/^\/combat\/[\w-]+$/)) {
      const combatId = path.split("/")[2]
      const combat = await getCombatState(combatId)
      
      if (!combat) {
        return new Response(JSON.stringify({ error: "Combat not found" }), {
          status: 404,
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
      
      return new Response(JSON.stringify(combat), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /combat/session/:sessionId - Get active combat for session
    if (req.method === "GET" && path.match(/^\/combat\/session\/[\w-]+$/)) {
      const sessionId = path.split("/")[3]
      const combat = await getCombatBySession(sessionId)
      
      if (!combat) {
        return new Response(JSON.stringify({ error: "No active combat" }), {
          status: 404,
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
      
      return new Response(JSON.stringify(combat), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /combat/:id/next - Next turn
    if (req.method === "POST" && path.match(/^\/combat\/[\w-]+\/next$/)) {
      const combatId = path.split("/")[2]
      const combat = await nextTurn(combatId)
      
      return new Response(JSON.stringify(combat), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /combat/:id/damage - Apply damage
    if (req.method === "POST" && path.match(/^\/combat\/[\w-]+\/damage$/)) {
      const combatId = path.split("/")[2]
      const body = await req.json()
      const combat = await applyDamage(combatId, body.targetId, body.damage)
      
      return new Response(JSON.stringify(combat), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /combat/:id/heal - Apply healing
    if (req.method === "POST" && path.match(/^\/combat\/[\w-]+\/heal$/)) {
      const combatId = path.split("/")[2]
      const body = await req.json()
      const combat = await applyHealing(combatId, body.targetId, body.healing)
      
      return new Response(JSON.stringify(combat), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /combat/:id/condition - Apply condition
    if (req.method === "POST" && path.match(/^\/combat\/[\w-]+\/condition$/)) {
      const combatId = path.split("/")[2]
      const body = await req.json()
      const combat = await applyCondition(combatId, body.targetId, body.condition)
      
      return new Response(JSON.stringify(combat), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // DELETE /combat/:id/condition - Remove condition
    if (req.method === "DELETE" && path.match(/^\/combat\/[\w-]+\/condition$/)) {
      const combatId = path.split("/")[2]
      const body = await req.json()
      const combat = await removeCondition(combatId, body.targetId, body.condition)
      
      return new Response(JSON.stringify(combat), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /combat/:id/end - End combat
    if (req.method === "POST" && path.match(/^\/combat\/[\w-]+\/end$/)) {
      const combatId = path.split("/")[2]
      const combat = await endCombat(combatId)
      
      return new Response(JSON.stringify(combat), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /check - Ability check
    if (req.method === "POST" && path === "/check") {
      const body = await req.json()
      const result = await performAbilityCheck(body)
      
      return new Response(JSON.stringify(result), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /conditions - List all conditions
    if (req.method === "GET" && path === "/conditions") {
      return new Response(JSON.stringify(CONDITIONS), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /conditions/:name - Get specific condition
    if (req.method === "GET" && path.match(/^\/conditions\/[\w-]+$/)) {
      const conditionName = path.split("/")[2].toLowerCase()
      const condition = CONDITIONS[conditionName]
      
      if (!condition) {
        return new Response(JSON.stringify({ error: "Condition not found" }), {
          status: 404,
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
      
      return new Response(JSON.stringify(condition), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /rulesets - List all rulesets
    if (req.method === "GET" && path === "/rulesets") {
      return new Response(JSON.stringify(RULESETS), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /rulesets/:name - Get specific ruleset
    if (req.method === "GET" && path.match(/^\/rulesets\/[\w-]+$/)) {
      const rulesetName = path.split("/")[2].toLowerCase()
      const ruleset = RULESETS[rulesetName]
      
      if (!ruleset) {
        return new Response(JSON.stringify({ error: "Ruleset not found" }), {
          status: 404,
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
      
      return new Response(JSON.stringify(ruleset), {
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