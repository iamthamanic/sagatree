import {
  corsHeaders,
  handleOptions,
  type CorsOptions,
} from '../_shared/cors.ts';

const CORS_OPTS: CorsOptions = {
  missingOriginPolicy: 'configured-or-star',
};
// ===========================================
// Bestiary Function (Extended)
// Monster database, encounters, combat stats
// ===========================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// ===========================================
// TYPES
// ===========================================

interface Monster {
  id: string
  name: string
  type: string
  size: 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan'
  challengeRating: number
  xp: number
  hp: number
  hitDice: string
  ac: number
  armorType?: string
  speed: Record<string, number>
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
  savingThrows?: Record<string, number>
  skills?: Record<string, number>
  damageVulnerabilities?: string[]
  damageResistances?: string[]
  damageImmunities?: string[]
  conditionImmunities?: string[]
  senses: string[]
  languages: string[]
  challengeRatingText: string
  specialTraits?: string[]
  actions: MonsterAction[]
  legendaryActions?: MonsterAction[]
  reactions?: MonsterAction[]
  description?: string
  environment?: string[]
  source: string
}

interface MonsterAction {
  name: string
  description: string
  attackBonus?: number
  damage?: string
  damageType?: string
  recharge?: string
  legendaryCost?: number
}

interface Encounter {
  id: string
  name: string
  description?: string
  monsters: Array<{
    monsterId: string
    name: string
    count: number
    xp: number
  }>
  totalXP: number
  adjustedXP: number
  difficulty: 'easy' | 'medium' | 'hard' | 'deadly'
  partySize: number
  partyLevel: number
  environment?: string
  createdAt: string
}

// ===========================================
// STORAGE
// ===========================================

const monsters = new Map<string, Monster>()
const encounters = new Map<string, Encounter>()

// ===========================================
// D&D 5e SRD MONSTERS (Extended)
// ===========================================

const srdMonsters: Monster[] = [
  {
    id: 'goblin',
    name: 'Goblin',
    type: 'humanoid',
    size: 'small',
    challengeRating: 0.25,
    xp: 50,
    hp: 7,
    hitDice: '2d6',
    ac: 15,
    armorType: 'leather armor, shield',
    speed: { walk: 30 },
    strength: 8,
    dexterity: 14,
    constitution: 10,
    intelligence: 10,
    wisdom: 8,
    charisma: 8,
    skills: { stealth: 6 },
    senses: ['darkvision 60 ft.'],
    languages: ['Common', 'Goblin'],
    challengeRatingText: '1/4',
    specialTraits: ['Nimble Escape: The goblin can take the Disengage or Hide action as a bonus action on each of its turns.'],
    actions: [
      { name: 'Scimitar', description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.', attackBonus: 4, damage: '1d6+2', damageType: 'slashing' },
      { name: 'Shortbow', description: 'Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage.', attackBonus: 4, damage: '1d6+2', damageType: 'piercing' },
    ],
    environment: ['forest', 'mountain', 'underdark'],
    source: 'SRD',
  },
  {
    id: 'orc',
    name: 'Orc',
    type: 'humanoid',
    size: 'medium',
    challengeRating: 0.5,
    xp: 100,
    hp: 15,
    hitDice: '2d8+4',
    ac: 13,
    armorType: 'hide armor',
    speed: { walk: 30 },
    strength: 16,
    dexterity: 12,
    constitution: 16,
    intelligence: 7,
    wisdom: 11,
    charisma: 10,
    senses: ['darkvision 60 ft.'],
    languages: ['Common', 'Orc'],
    challengeRatingText: '1/2',
    specialTraits: ['Aggressive: As a bonus action, the orc can move up to its speed toward a hostile creature that it can see.'],
    actions: [
      { name: 'Greataxe', description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 9 (1d12 + 3) slashing damage.', attackBonus: 5, damage: '1d12+3', damageType: 'slashing' },
      { name: 'Javelin', description: 'Melee or Ranged Weapon Attack: +5 to hit, reach 5 ft. or range 30/120 ft., one target. Hit: 6 (1d6 + 3) piercing damage.', attackBonus: 5, damage: '1d6+3', damageType: 'piercing' },
    ],
    environment: ['forest', 'mountain', 'grassland'],
    source: 'SRD',
  },
  {
    id: 'skeleton',
    name: 'Skeleton',
    type: 'undead',
    size: 'medium',
    challengeRating: 0.25,
    xp: 50,
    hp: 13,
    hitDice: '2d8+4',
    ac: 13,
    armorType: 'armor scraps',
    speed: { walk: 30 },
    strength: 10,
    dexterity: 14,
    constitution: 15,
    intelligence: 6,
    wisdom: 8,
    charisma: 5,
    damageVulnerabilities: ['bludgeoning'],
    damageImmunities: ['poison'],
    conditionImmunities: ['exhausted', 'poisoned'],
    senses: ['darkvision 60 ft.', 'passive Perception 9'],
    languages: ['understands Common but can\'t speak'],
    challengeRatingText: '1/4',
    actions: [
      { name: 'Shortbow', description: 'Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage.', attackBonus: 4, damage: '1d6+2', damageType: 'piercing' },
      { name: 'Shortsword', description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) piercing damage.', attackBonus: 4, damage: '1d6+2', damageType: 'piercing' },
    ],
    environment: ['any'],
    source: 'SRD',
  },
  {
    id: 'zombie',
    name: 'Zombie',
    type: 'undead',
    size: 'medium',
    challengeRating: 0.25,
    xp: 50,
    hp: 22,
    hitDice: '3d8+9',
    ac: 8,
    speed: { walk: 20 },
    strength: 13,
    dexterity: 6,
    constitution: 16,
    intelligence: 3,
    wisdom: 6,
    charisma: 5,
    damageImmunities: ['poison'],
    conditionImmunities: ['poisoned'],
    senses: ['darkvision 60 ft.', 'passive Perception 8'],
    languages: ['understands Common but can\'t speak'],
    challengeRatingText: '1/4',
    specialTraits: ['Undead Fortitude: If damage reduces the zombie to 0 hit points, it must make a Constitution saving throw with a DC of 5 + the damage taken, unless the damage is radiant or a critical hit. On a success, the zombie drops to 1 hit point.'],
    actions: [
      { name: 'Slam', description: 'Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6 + 1) bludgeoning damage.', attackBonus: 3, damage: '1d6+1', damageType: 'bludgeoning' },
    ],
    environment: ['any'],
    source: 'SRD',
  },
  {
    id: 'dragon-red-ancient',
    name: 'Ancient Red Dragon',
    type: 'dragon',
    size: 'gargantuan',
    challengeRating: 24,
    xp: 62000,
    hp: 546,
    hitDice: '28d20+252',
    ac: 22,
    armorType: 'natural armor',
    speed: { walk: 40, fly: 80 },
    strength: 30,
    dexterity: 10,
    constitution: 29,
    intelligence: 18,
    wisdom: 15,
    charisma: 23,
    savingThrows: { dexterity: 6, constitution: 15, wisdom: 8, charisma: 12 },
    skills: { perception: 14, stealth: 6 },
    damageImmunities: ['fire'],
    senses: ['blindsight 60 ft.', 'darkvision 120 ft.', 'passive Perception 24'],
    languages: ['Common', 'Draconic'],
    challengeRatingText: '24',
    specialTraits: [
      'Legendary Resistance (3/Day): If the dragon fails a saving throw, it can choose to succeed instead.',
      'Fire Immunity: The dragon is immune to fire damage.',
    ],
    actions: [
      { name: 'Bite', description: 'Melee Weapon Attack: +17 to hit, reach 15 ft., one target. Hit: 21 (2d10 + 10) piercing damage plus 14 (4d6) fire damage.', attackBonus: 17, damage: '2d10+10', damageType: 'piercing' },
      { name: 'Claw', description: 'Melee Weapon Attack: +17 to hit, reach 10 ft., one target. Hit: 17 (2d6 + 10) slashing damage.', attackBonus: 17, damage: '2d6+10', damageType: 'slashing' },
      { name: 'Tail', description: 'Melee Weapon Attack: +17 to hit, reach 20 ft., one target. Hit: 19 (2d8 + 10) bludgeoning damage.', attackBonus: 17, damage: '2d8+10', damageType: 'bludgeoning' },
      { name: 'Fire Breath', description: 'The dragon exhales fire in a 90-foot cone. Each creature in that area must make a DC 24 Dexterity saving throw, taking 91 (26d6) fire damage on a failed save, or half as much damage on a successful one.', recharge: '5-6' },
    ],
    legendaryActions: [
      { name: 'Detect', description: 'The dragon makes a Wisdom (Perception) check.', legendaryCost: 1 },
      { name: 'Tail Attack', description: 'The dragon makes a tail attack.', legendaryCost: 1 },
      { name: 'Wing Attack', description: 'The dragon beats its wings. Each creature within 15 ft. of the dragon must succeed on a DC 24 Dexterity saving throw or take 16 (2d6 + 5) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.', legendaryCost: 2 },
    ],
    environment: ['mountain'],
    source: 'SRD',
  },
  {
    id: 'bandit',
    name: 'Bandit',
    type: 'humanoid',
    size: 'medium',
    challengeRating: 0.125,
    xp: 25,
    hp: 11,
    hitDice: '2d8+2',
    ac: 12,
    armorType: 'leather armor',
    speed: { walk: 30 },
    strength: 11,
    dexterity: 12,
    constitution: 11,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    senses: ['passive Perception 10'],
    languages: ['any one language (usually Common)'],
    challengeRatingText: '1/8',
    actions: [
      { name: 'Scimitar', description: 'Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6 + 1) slashing damage.', attackBonus: 3, damage: '1d6+1', damageType: 'slashing' },
      { name: 'Light Crossbow', description: 'Ranged Weapon Attack: +3 to hit, range 80/320 ft., one target. Hit: 5 (1d8 + 1) piercing damage.', attackBonus: 3, damage: '1d8+1', damageType: 'piercing' },
    ],
    environment: ['any'],
    source: 'SRD',
  },
]

// Initialize with SRD monsters
srdMonsters.forEach(m => monsters.set(m.id, m))

// ===========================================
// UTILITY
// ===========================================

function generateId(): string {
  return crypto.randomUUID()
}

function calculateXP(cr: number): number {
  const xpTable: Record<number, number> = {
    0: 10, 0.125: 25, 0.25: 50, 0.5: 100,
    1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800,
    6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
    11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
    16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000,
    21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000,
    26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000,
  }
  return xpTable[cr] || 0
}

function calculateDifficulty(xp: number, partySize: number, partyLevel: number): 'easy' | 'medium' | 'hard' | 'deadly' {
  const thresholds = {
    easy: 25 * partyLevel * partySize,
    medium: 50 * partyLevel * partySize,
    hard: 75 * partyLevel * partySize,
    deadly: 100 * partyLevel * partySize,
  }
  
  if (xp <= thresholds.easy) return 'easy'
  if (xp <= thresholds.medium) return 'medium'
  if (xp <= thresholds.hard) return 'hard'
  return 'deadly'
}

// ===========================================
// MONSTER OPERATIONS
// ===========================================

async function listMonsters(filters?: { type?: string; cr?: number; size?: string }): Promise<Monster[]> {
  let all = Array.from(monsters.values())
  
  if (filters?.type) {
    all = all.filter(m => m.type.toLowerCase() === filters.type!.toLowerCase())
  }
  if (filters?.cr !== undefined) {
    all = all.filter(m => m.challengeRating === filters.cr)
  }
  if (filters?.size) {
    all = all.filter(m => m.size === filters.size)
  }
  
  return all.sort((a, b) => a.challengeRating - b.challengeRating)
}

async function getMonster(id: string): Promise<Monster | null> {
  return monsters.get(id) || null
}

async function createMonster(data: Partial<Monster>): Promise<Monster> {
  const id = generateId()
  
  const monster: Monster = {
    id,
    name: data.name || 'Unknown',
    type: data.type || 'beast',
    size: data.size || 'medium',
    challengeRating: data.challengeRating || 0,
    xp: data.xp || calculateXP(data.challengeRating || 0),
    hp: data.hp || 10,
    hitDice: data.hitDice || '2d6',
    ac: data.ac || 10,
    armorType: data.armorType,
    speed: data.speed || { walk: 30 },
    strength: data.strength || 10,
    dexterity: data.dexterity || 10,
    constitution: data.constitution || 10,
    intelligence: data.intelligence || 10,
    wisdom: data.wisdom || 10,
    charisma: data.charisma || 10,
    savingThrows: data.savingThrows,
    skills: data.skills,
    damageVulnerabilities: data.damageVulnerabilities,
    damageResistances: data.damageResistances,
    damageImmunities: data.damageImmunities,
    conditionImmunities: data.conditionImmunities,
    senses: data.senses || ['passive Perception 10'],
    languages: data.languages || [],
    challengeRatingText: data.challengeRatingText || String(data.challengeRating || 0),
    specialTraits: data.specialTraits,
    actions: data.actions || [],
    legendaryActions: data.legendaryActions,
    reactions: data.reactions,
    description: data.description,
    environment: data.environment,
    source: data.source || 'custom',
  }
  
  monsters.set(id, monster)
  return monster
}

async function searchMonsters(query: string): Promise<Monster[]> {
  const lowerQuery = query.toLowerCase()
  
  return Array.from(monsters.values()).filter(m =>
    m.name.toLowerCase().includes(lowerQuery) ||
    m.type.toLowerCase().includes(lowerQuery) ||
    (m.description && m.description.toLowerCase().includes(lowerQuery))
  )
}

// ===========================================
// ENCOUNTER OPERATIONS
// ===========================================

async function createEncounter(data: {
  name: string
  description?: string
  monsters: Array<{ monsterId: string; count: number }>
  partySize: number
  partyLevel: number
  environment?: string
}): Promise<Encounter> {
  const id = generateId()
  
  // Calculate XP
  let totalXP = 0
  const encounterMonsters: Encounter['monsters'] = []
  
  for (const m of data.monsters) {
    const monster = monsters.get(m.monsterId)
    if (monster) {
      const xp = monster.xp * m.count
      totalXP += xp
      encounterMonsters.push({
        monsterId: m.monsterId,
        name: monster.name,
        count: m.count,
        xp: monster.xp,
      })
    }
  }
  
  // Adjust XP for number of monsters
  const monsterCount = data.monsters.reduce((sum, m) => sum + m.count, 0)
  let multiplier = 1
  if (monsterCount === 2) multiplier = 1.5
  else if (monsterCount >= 3 && monsterCount <= 6) multiplier = 2
  else if (monsterCount >= 7 && monsterCount <= 10) multiplier = 2.5
  else if (monsterCount >= 11 && monsterCount <= 14) multiplier = 3
  else if (monsterCount >= 15) multiplier = 4
  
  const adjustedXP = Math.floor(totalXP * multiplier)
  const difficulty = calculateDifficulty(adjustedXP, data.partySize, data.partyLevel)
  
  const encounter: Encounter = {
    id,
    name: data.name,
    description: data.description,
    monsters: encounterMonsters,
    totalXP,
    adjustedXP,
    difficulty,
    partySize: data.partySize,
    partyLevel: data.partyLevel,
    environment: data.environment,
    createdAt: new Date().toISOString(),
  }
  
  encounters.set(id, encounter)
  return encounter
}

async function getEncounter(id: string): Promise<Encounter | null> {
  return encounters.get(id) || null
}

async function listEncounters(difficulty?: string): Promise<Encounter[]> {
  let all = Array.from(encounters.values())
  
  if (difficulty) {
    all = all.filter(e => e.difficulty === difficulty)
  }
  
  return all
}

async function generateEncounter(params: {
  difficulty: 'easy' | 'medium' | 'hard' | 'deadly'
  partySize: number
  partyLevel: number
  environment?: string
}): Promise<Encounter> {
  // Calculate XP budget
  const xpThresholds = {
    easy: 25 * params.partyLevel * params.partySize,
    medium: 50 * params.partyLevel * params.partySize,
    hard: 75 * params.partyLevel * params.partySize,
    deadly: 100 * params.partyLevel * params.partySize,
  }
  
  const budget = xpThresholds[params.difficulty]
  
  // Filter monsters by CR (appropriate for party level)
  const appropriateCRs = [params.partyLevel - 1, params.partyLevel, params.partyLevel + 1]
    .filter(cr => cr >= 0)
  
  const availableMonsters = Array.from(monsters.values()).filter(m =>
    appropriateCRs.includes(m.challengeRating) &&
    (!params.environment || (m.environment && m.environment.includes(params.environment)))
  )
  
  // Build encounter
  const selectedMonsters: Array<{ monsterId: string; count: number }> = []
  let currentXP = 0
  
  while (currentXP < budget && availableMonsters.length > 0) {
    // Pick a random monster
    const monster = availableMonsters[Math.floor(Math.random() * availableMonsters.length)]
    
    // Calculate how many we can add
    const maxCount = Math.floor((budget - currentXP) / monster.xp)
    if (maxCount < 1) break
    
    const count = Math.min(maxCount, 6) // Max 6 of any monster
    
    selectedMonsters.push({ monsterId: monster.id, count })
    currentXP += monster.xp * count
  }
  
  return createEncounter({
    name: `${params.difficulty.charAt(0).toUpperCase() + params.difficulty.slice(1)} Encounter`,
    description: `A ${params.difficulty} encounter for a party of ${params.partySize} level ${params.partyLevel} adventurers`,
    monsters: selectedMonsters,
    partySize: params.partySize,
    partyLevel: params.partyLevel,
    environment: params.environment,
  })
}

// ===========================================
// MAIN HANDLER
// ===========================================

serve(async (req: Request) => {
  const headers = corsHeaders(req, CORS_OPTS)
  
  const optionsResponse = handleOptions(req, CORS_OPTS)
  if (optionsResponse) return optionsResponse
  
  const url = new URL(req.url)
  const path = url.pathname.replace("/functions/v1/bestiary", "")
  
  try {
    // GET /health
    if (req.method === "GET" && path === "/health") {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        features: ['monsters', 'encounters', 'generation', 'search'],
        monsterCount: monsters.size,
      }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /monsters - List monsters
    if (req.method === "GET" && path === "/monsters") {
      const filters = {
        type: url.searchParams.get('type') || undefined,
        cr: url.searchParams.get('cr') ? parseFloat(url.searchParams.get('cr')!) : undefined,
        size: url.searchParams.get('size') || undefined,
      }
      const list = await listMonsters(filters)
      
      return new Response(JSON.stringify(list), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /monsters/search - Search monsters
    if (req.method === "GET" && path === "/monsters/search") {
      const query = url.searchParams.get('q') || ''
      const results = await searchMonsters(query)
      
      return new Response(JSON.stringify(results), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /monsters/:id - Get monster
    if (req.method === "GET" && path.match(/^\/monsters\/[\w-]+$/)) {
      const id = path.split("/")[2]
      const monster = await getMonster(id)
      
      if (!monster) {
        return new Response(JSON.stringify({ error: "Monster not found" }), {
          status: 404,
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
      
      return new Response(JSON.stringify(monster), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /monsters - Create monster
    if (req.method === "POST" && path === "/monsters") {
      const body = await req.json()
      const monster = await createMonster(body)
      
      return new Response(JSON.stringify(monster), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /encounters - Create encounter
    if (req.method === "POST" && path === "/encounters") {
      const body = await req.json()
      const encounter = await createEncounter(body)
      
      return new Response(JSON.stringify(encounter), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /encounters/:id - Get encounter
    if (req.method === "GET" && path.match(/^\/encounters\/[\w-]+$/)) {
      const id = path.split("/")[2]
      const encounter = await getEncounter(id)
      
      if (!encounter) {
        return new Response(JSON.stringify({ error: "Encounter not found" }), {
          status: 404,
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
      
      return new Response(JSON.stringify(encounter), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /encounters - List encounters
    if (req.method === "GET" && path === "/encounters") {
      const difficulty = url.searchParams.get('difficulty') || undefined
      const list = await listEncounters(difficulty as 'easy' | 'medium' | 'hard' | 'deadly' | undefined)
      
      return new Response(JSON.stringify(list), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /encounters/generate - Generate random encounter
    if (req.method === "POST" && path === "/encounters/generate") {
      const body = await req.json()
      const encounter = await generateEncounter({
        difficulty: body.difficulty || 'medium',
        partySize: body.partySize || 4,
        partyLevel: body.partyLevel || 1,
        environment: body.environment,
      })
      
      return new Response(JSON.stringify(encounter), {
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