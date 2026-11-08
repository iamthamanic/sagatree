import {
  corsHeaders,
  handleOptions,
  type CorsOptions,
} from '../_shared/cors.ts';

const CORS_OPTS: CorsOptions = {
  missingOriginPolicy: 'configured-or-star',
};
// ===========================================
// Characters Function (NEW)
// Character creation, management, leveling, inventory
// ===========================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// ===========================================
// TYPES (SOLID: Single Responsibility)
// ===========================================

interface Character {
  id: string
  ownerId: string
  projectId?: string
  name: string
  race: string
  class: string
  level: number
  background?: string
  alignment?: string
  experience: number
  proficiencyBonus: number
  attributes: Attributes
  skills: Record<string, number>
  savingThrows: Record<string, boolean>
  hp: HP
  armorClass: number
  speed: number
  initiative: number
  spellSlots?: SpellSlots
  features: Feature[]
  proficiencies: Proficiencies
  equipment: Equipment[]
  traits: string[]
  ideals?: string
  bonds?: string
  flaws?: string
  backstory?: string
  portraitUrl?: string
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

interface Attributes {
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
}

interface HP {
  current: number
  max: number
  temp: number
}

interface SpellSlots {
  level1: { max: number; used: number }
  level2: { max: number; used: number }
  level3: { max: number; used: number }
  level4: { max: number; used: number }
  level5: { max: number; used: number }
  level6: { max: number; used: number }
  level7: { max: number; used: number }
  level8: { max: number; used: number }
  level9: { max: number; used: number }
}

interface Feature {
  name: string
  description: string
  source: string // class, race, feat
  level: number
  uses?: { max: number; current: number }
}

interface Proficiencies {
  armor: string[]
  weapons: string[]
  tools: string[]
  languages: string[]
}

interface Equipment {
  id: string
  name: string
  type: 'weapon' | 'armor' | 'shield' | 'potion' | 'scroll' | 'wondrous' | 'other'
  quantity: number
  equipped: boolean
  attuned?: boolean
  weight?: number
  description?: string
  properties?: Record<string, any>
}

interface CreateCharacterRequest {
  ownerId: string
  projectId?: string
  name: string
  race: string
  class: string
  background?: string
  alignment?: string
  attributes?: Partial<Attributes>
  proficiencies?: Partial<Proficiencies>
  equipment?: Omit<Equipment, 'id'>[]
  backstory?: string
  portraitUrl?: string
  isPublic?: boolean
}

interface LevelUpRequest {
  characterId: string
  choice?: {
    hpIncrease: 'average' | 'roll' | number
    abilityScoreImprovement?: Partial<Attributes>
    feat?: string
    skillProficiency?: string
  }
}

// ===========================================
// STORAGE (In-Memory for now, use Supabase DB in production)
// ===========================================

const characters = new Map<string, Character>()

// ===========================================
// UTILITY FUNCTIONS (DRY)
// ===========================================

function generateId(): string {
  return crypto.randomUUID()
}

function calculateModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

function calculateProficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1
}

function getDefaultAttributes(): Attributes {
  return {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  }
}

function getDefaultHP(constitution: number, hitDie: number): HP {
  const conMod = calculateModifier(constitution)
  return {
    current: hitDie + conMod,
    max: hitDie + conMod,
    temp: 0,
  }
}

function getDefaultSpellSlots(): SpellSlots {
  return {
    level1: { max: 0, used: 0 },
    level2: { max: 0, used: 0 },
    level3: { max: 0, used: 0 },
    level4: { max: 0, used: 0 },
    level5: { max: 0, used: 0 },
    level6: { max: 0, used: 0 },
    level7: { max: 0, used: 0 },
    level8: { max: 0, used: 0 },
    level9: { max: 0, used: 0 },
  }
}

function getHitDieByClass(className: string): number {
  const hitDice: Record<string, number> = {
    'barbarian': 12,
    'fighter': 10,
    'paladin': 10,
    'ranger': 10,
    'bard': 8,
    'cleric': 8,
    'druid': 8,
    'monk': 8,
    'rogue': 8,
    'warlock': 8,
    'sorcerer': 6,
    'wizard': 6,
  }
  return hitDice[className.toLowerCase()] || 8
}

function getSkillAbility(skill: string): string {
  const skillAbilities: Record<string, string> = {
    'acrobatics': 'dexterity',
    'animal handling': 'wisdom',
    'arcana': 'intelligence',
    'athletics': 'strength',
    'deception': 'charisma',
    'history': 'intelligence',
    'insight': 'wisdom',
    'intimidation': 'charisma',
    'investigation': 'intelligence',
    'medicine': 'wisdom',
    'nature': 'intelligence',
    'perception': 'wisdom',
    'performance': 'charisma',
    'persuasion': 'charisma',
    'religion': 'intelligence',
    'sleight of hand': 'dexterity',
    'stealth': 'dexterity',
    'survival': 'wisdom',
  }
  return skillAbilities[skill.toLowerCase()] || 'intelligence'
}

// ===========================================
// CHARACTER MANAGEMENT (SOLID: Single Responsibility)
// ===========================================

async function createCharacter(data: CreateCharacterRequest): Promise<Character> {
  const id = generateId()
  const now = new Date().toISOString()
  const attributes = { ...getDefaultAttributes(), ...data.attributes }
  const hitDie = getHitDieByClass(data.class)
  
  const character: Character = {
    id,
    ownerId: data.ownerId,
    projectId: data.projectId,
    name: data.name,
    race: data.race,
    class: data.class,
    level: 1,
    background: data.background,
    alignment: data.alignment,
    experience: 0,
    proficiencyBonus: 2,
    attributes,
    skills: {},
    savingThrows: {
      strength: false,
      dexterity: false,
      constitution: false,
      intelligence: false,
      wisdom: false,
      charisma: false,
    },
    hp: getDefaultHP(attributes.constitution, hitDie),
    armorClass: 10 + calculateModifier(attributes.dexterity),
    speed: 30,
    initiative: calculateModifier(attributes.dexterity),
    spellSlots: getDefaultSpellSlots(),
    features: [],
    proficiencies: {
      armor: [],
      weapons: [],
      tools: [],
      languages: ['Common'],
      ...data.proficiencies,
    },
    equipment: (data.equipment || []).map(e => ({
      id: generateId(),
      ...e,
    })),
    traits: [],
    backstory: data.backstory,
    portraitUrl: data.portraitUrl,
    isPublic: data.isPublic || false,
    createdAt: now,
    updatedAt: now,
  }
  
  characters.set(id, character)
  return character
}

async function getCharacter(characterId: string): Promise<Character | null> {
  return characters.get(characterId) || null
}

async function updateCharacter(characterId: string, data: Partial<Character>): Promise<Character> {
  const character = characters.get(characterId)
  if (!character) throw new Error("Character not found")
  
  const updated: Character = {
    ...character,
    ...data,
    id: characterId,
    updatedAt: new Date().toISOString(),
  }
  
  characters.set(characterId, updated)
  return updated
}

async function deleteCharacter(characterId: string): Promise<void> {
  characters.delete(characterId)
}

async function listCharacters(ownerId?: string, projectId?: string): Promise<Character[]> {
  let all = Array.from(characters.values())
  
  if (ownerId) {
    all = all.filter(c => c.ownerId === ownerId)
  }
  
  if (projectId) {
    all = all.filter(c => c.projectId === projectId)
  }
  
  return all
}

// ===========================================
// LEVELING (SOLID: Single Responsibility)
// ===========================================

function getXPThreshold(level: number): number {
  const thresholds = [
    0, 300, 900, 2700, 6500,  // 1-5
    14000, 23000, 34000, 48000, 64000,  // 6-10
    85000, 100000, 120000, 140000, 165000,  // 11-15
    195000, 225000, 265000, 305000, 355000,  // 16-20
  ]
  return thresholds[level - 1] || 0
}

async function addExperience(characterId: string, xp: number): Promise<{ character: Character; leveledUp: boolean }> {
  const character = characters.get(characterId)
  if (!character) throw new Error("Character not found")
  
  character.experience += xp
  
  // Check for level up
  const nextLevel = character.level + 1
  const nextThreshold = getXPThreshold(nextLevel)
  
  let leveledUp = false
  
  while (character.experience >= nextThreshold && nextLevel <= 20) {
    character.level = nextLevel
    character.proficiencyBonus = calculateProficiencyBonus(character.level)
    leveledUp = true
  }
  
  character.updatedAt = new Date().toISOString()
  characters.set(characterId, character)
  
  return { character, leveledUp }
}

async function levelUp(data: LevelUpRequest): Promise<Character> {
  const character = characters.get(data.characterId)
  if (!character) throw new Error("Character not found")
  
  if (character.level >= 20) {
    throw new Error("Character is already at max level")
  }
  
  const hitDie = getHitDieByClass(character.class)
  const conMod = calculateModifier(character.attributes.constitution)
  
  // HP increase
  let hpIncrease: number
  if (data.choice?.hpIncrease === 'average') {
    hpIncrease = Math.ceil(hitDie / 2) + conMod
  } else if (typeof data.choice?.hpIncrease === 'number') {
    hpIncrease = data.choice.hpIncrease + conMod
  } else {
    // Roll
    hpIncrease = Math.floor(Math.random() * hitDie) + 1 + conMod
  }
  
  character.hp.max += hpIncrease
  character.hp.current += hpIncrease
  character.level++
  character.proficiencyBonus = calculateProficiencyBonus(character.level)
  
  // Ability score improvement
  if (data.choice?.abilityScoreImprovement) {
    for (const [ability, increase] of Object.entries(data.choice.abilityScoreImprovement)) {
      if (character.attributes[ability as keyof Attributes] !== undefined) {
        character.attributes[ability as keyof Attributes] += increase as number
      }
    }
  }
  
  // Update derived stats
  character.armorClass = 10 + calculateModifier(character.attributes.dexterity)
  character.initiative = calculateModifier(character.attributes.dexterity)
  
  character.updatedAt = new Date().toISOString()
  characters.set(data.characterId, character)
  
  return character
}

// ===========================================
// EQUIPMENT (SOLID: Single Responsibility)
// ===========================================

async function addEquipment(characterId: string, equipment: Omit<Equipment, 'id'>): Promise<Equipment> {
  const character = characters.get(characterId)
  if (!character) throw new Error("Character not found")
  
  const newEquipment: Equipment = {
    id: generateId(),
    ...equipment,
  }
  
  character.equipment.push(newEquipment)
  character.updatedAt = new Date().toISOString()
  
  characters.set(characterId, character)
  return newEquipment
}

async function removeEquipment(characterId: string, equipmentId: string): Promise<void> {
  const character = characters.get(characterId)
  if (!character) throw new Error("Character not found")
  
  character.equipment = character.equipment.filter(e => e.id !== equipmentId)
  character.updatedAt = new Date().toISOString()
  
  characters.set(characterId, character)
}

async function equipItem(characterId: string, equipmentId: string): Promise<Character> {
  const character = characters.get(characterId)
  if (!character) throw new Error("Character not found")
  
  const equipment = character.equipment.find(e => e.id === equipmentId)
  if (!equipment) throw new Error("Equipment not found")
  
  // Unequip same type items first
  if (equipment.type === 'armor') {
    character.equipment.forEach(e => {
      if (e.type === 'armor') e.equipped = false
    })
  }
  
  equipment.equipped = true
  character.updatedAt = new Date().toISOString()
  
  // Recalculate AC
  // (This is simplified - real implementation would need armor calculations)
  
  characters.set(characterId, character)
  return character
}

async function unequipItem(characterId: string, equipmentId: string): Promise<Character> {
  const character = characters.get(characterId)
  if (!character) throw new Error("Character not found")
  
  const equipment = character.equipment.find(e => e.id === equipmentId)
  if (!equipment) throw new Error("Equipment not found")
  
  equipment.equipped = false
  character.updatedAt = new Date().toISOString()
  
  characters.set(characterId, character)
  return character
}

// ===========================================
// SPELL SLOTS (SOLID: Single Responsibility)
// ===========================================

function getSpellSlotsByLevel(characterClass: string, level: number): SpellSlots {
  // Simplified spell slot progression
  const slotsByLevel: Record<number, SpellSlots> = {
    1: { level1: { max: 2, used: 0 }, level2: { max: 0, used: 0 }, level3: { max: 0, used: 0 }, level4: { max: 0, used: 0 }, level5: { max: 0, used: 0 }, level6: { max: 0, used: 0 }, level7: { max: 0, used: 0 }, level8: { max: 0, used: 0 }, level9: { max: 0, used: 0 } },
    2: { level1: { max: 3, used: 0 }, level2: { max: 0, used: 0 }, level3: { max: 0, used: 0 }, level4: { max: 0, used: 0 }, level5: { max: 0, used: 0 }, level6: { max: 0, used: 0 }, level7: { max: 0, used: 0 }, level8: { max: 0, used: 0 }, level9: { max: 0, used: 0 } },
    3: { level1: { max: 4, used: 0 }, level2: { max: 2, used: 0 }, level3: { max: 0, used: 0 }, level4: { max: 0, used: 0 }, level5: { max: 0, used: 0 }, level6: { max: 0, used: 0 }, level7: { max: 0, used: 0 }, level8: { max: 0, used: 0 }, level9: { max: 0, used: 0 } },
    4: { level1: { max: 4, used: 0 }, level2: { max: 3, used: 0 }, level3: { max: 0, used: 0 }, level4: { max: 0, used: 0 }, level5: { max: 0, used: 0 }, level6: { max: 0, used: 0 }, level7: { max: 0, used: 0 }, level8: { max: 0, used: 0 }, level9: { max: 0, used: 0 } },
    5: { level1: { max: 4, used: 0 }, level2: { max: 3, used: 0 }, level3: { max: 2, used: 0 }, level4: { max: 0, used: 0 }, level5: { max: 0, used: 0 }, level6: { max: 0, used: 0 }, level7: { max: 0, used: 0 }, level8: { max: 0, used: 0 }, level9: { max: 0, used: 0 } },
  }
  
  return slotsByLevel[level] || slotsByLevel[1]
}

async function useSpellSlot(characterId: string, level: number): Promise<{ success: boolean; remaining: number }> {
  const character = characters.get(characterId)
  if (!character) throw new Error("Character not found")
  
  if (!character.spellSlots) {
    throw new Error("Character has no spell slots")
  }
  
  const slotKey = `level${level}` as keyof SpellSlots
  const slots = character.spellSlots[slotKey]
  
  if (slots.used >= slots.max) {
    return { success: false, remaining: 0 }
  }
  
  slots.used++
  character.updatedAt = new Date().toISOString()
  
  characters.set(characterId, character)
  return { success: true, remaining: slots.max - slots.used }
}

async function restoreSpellSlots(characterId: string): Promise<void> {
  const character = characters.get(characterId)
  if (!character) throw new Error("Character not found")
  
  if (!character.spellSlots) return
  
  for (const key of Object.keys(character.spellSlots) as Array<keyof SpellSlots>) {
    character.spellSlots[key].used = 0
  }
  
  character.updatedAt = new Date().toISOString()
  characters.set(characterId, character)
}

// ===========================================
// HP MANAGEMENT (SOLID: Single Responsibility)
// ===========================================

async function takeDamage(characterId: string, damage: number): Promise<Character> {
  const character = characters.get(characterId)
  if (!character) throw new Error("Character not found")
  
  // Apply to temp HP first
  if (character.hp.temp > 0) {
    const tempDamage = Math.min(character.hp.temp, damage)
    character.hp.temp -= tempDamage
    damage -= tempDamage
  }
  
  // Then to current HP
  character.hp.current = Math.max(0, character.hp.current - damage)
  character.updatedAt = new Date().toISOString()
  
  characters.set(characterId, character)
  return character
}

async function healCharacter(characterId: string, healing: number): Promise<Character> {
  const character = characters.get(characterId)
  if (!character) throw new Error("Character not found")
  
  character.hp.current = Math.min(character.hp.max, character.hp.current + healing)
  character.updatedAt = new Date().toISOString()
  
  characters.set(characterId, character)
  return character
}

async function addTempHP(characterId: string, tempHP: number): Promise<Character> {
  const character = characters.get(characterId)
  if (!character) throw new Error("Character not found")
  
  character.hp.temp = Math.max(character.hp.temp, tempHP)
  character.updatedAt = new Date().toISOString()
  
  characters.set(characterId, character)
  return character
}

// ===========================================
// EXPORT/IMPORT (SOLID: Single Responsibility)
// ===========================================

async function exportCharacter(characterId: string): Promise<Character> {
  const character = characters.get(characterId)
  if (!character) throw new Error("Character not found")
  
  return JSON.parse(JSON.stringify(character))
}

async function importCharacter(data: Character): Promise<Character> {
  const id = generateId()
  const now = new Date().toISOString()
  
  const character: Character = {
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  }
  
  characters.set(id, character)
  return character
}

// ===========================================
// MAIN HANDLER
// ===========================================

serve(async (req: Request) => {
  const headers = corsHeaders(req, CORS_OPTS)
  
  const optionsResponse = handleOptions(req, CORS_OPTS)
  if (optionsResponse) return optionsResponse
  
  const url = new URL(req.url)
  const path = url.pathname.replace("/functions/v1/characters", "")
  
  try {
    // GET /health
    if (req.method === "GET" && path === "/health") {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        features: ['characters', 'leveling', 'equipment', 'spell-slots', 'hp-management', 'export-import'],
      }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /characters - List characters
    if (req.method === "GET" && path === "/characters") {
      const ownerId = url.searchParams.get('ownerId') || undefined
      const projectId = url.searchParams.get('projectId') || undefined
      const charactersList = await listCharacters(ownerId, projectId)
      
      return new Response(JSON.stringify(charactersList), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /characters - Create character
    if (req.method === "POST" && path === "/characters") {
      const body = await req.json()
      const character = await createCharacter(body)
      
      return new Response(JSON.stringify(character), {
        status: 201,
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /characters/:id - Get character
    if (req.method === "GET" && path.match(/^\/characters\/[\w-]+$/)) {
      const characterId = path.split("/")[2]
      const character = await getCharacter(characterId)
      
      if (!character) {
        return new Response(JSON.stringify({ error: "Character not found" }), {
          status: 404,
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
      
      return new Response(JSON.stringify(character), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // PUT /characters/:id - Update character
    if (req.method === "PUT" && path.match(/^\/characters\/[\w-]+$/)) {
      const characterId = path.split("/")[2]
      const body = await req.json()
      const character = await updateCharacter(characterId, body)
      
      return new Response(JSON.stringify(character), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // DELETE /characters/:id - Delete character
    if (req.method === "DELETE" && path.match(/^\/characters\/[\w-]+$/)) {
      const characterId = path.split("/")[2]
      await deleteCharacter(characterId)
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /characters/:id/experience - Add experience
    if (req.method === "POST" && path.match(/^\/characters\/[\w-]+\/experience$/)) {
      const characterId = path.split("/")[2]
      const body = await req.json()
      const result = await addExperience(characterId, body.xp)
      
      return new Response(JSON.stringify(result), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /characters/:id/level-up - Level up
    if (req.method === "POST" && path.match(/^\/characters\/[\w-]+\/level-up$/)) {
      const body = await req.json()
      const character = await levelUp(body)
      
      return new Response(JSON.stringify(character), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /characters/:id/equipment - Add equipment
    if (req.method === "POST" && path.match(/^\/characters\/[\w-]+\/equipment$/)) {
      const characterId = path.split("/")[2]
      const body = await req.json()
      const equipment = await addEquipment(characterId, body)
      
      return new Response(JSON.stringify(equipment), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // DELETE /characters/:id/equipment/:equipmentId - Remove equipment
    if (req.method === "DELETE" && path.match(/^\/characters\/[\w-]+\/equipment\/[\w-]+$/)) {
      const characterId = path.split("/")[2]
      const equipmentId = path.split("/")[4]
      await removeEquipment(characterId, equipmentId)
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /characters/:id/equip/:equipmentId - Equip item
    if (req.method === "POST" && path.match(/^\/characters\/[\w-]+\/equip\/[\w-]+$/)) {
      const characterId = path.split("/")[2]
      const equipmentId = path.split("/")[4]
      const character = await equipItem(characterId, equipmentId)
      
      return new Response(JSON.stringify(character), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /characters/:id/unequip/:equipmentId - Unequip item
    if (req.method === "POST" && path.match(/^\/characters\/[\w-]+\/unequip\/[\w-]+$/)) {
      const characterId = path.split("/")[2]
      const equipmentId = path.split("/")[4]
      const character = await unequipItem(characterId, equipmentId)
      
      return new Response(JSON.stringify(character), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /characters/:id/spell-slots/:level/use - Use spell slot
    if (req.method === "POST" && path.match(/^\/characters\/[\w-]+\/spell-slots\/\d\/use$/)) {
      const characterId = path.split("/")[2]
      const level = parseInt(path.split("/")[4])
      const result = await useSpellSlot(characterId, level)
      
      return new Response(JSON.stringify(result), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /characters/:id/spell-slots/restore - Restore all spell slots
    if (req.method === "POST" && path.match(/^\/characters\/[\w-]+\/spell-slots\/restore$/)) {
      const characterId = path.split("/")[2]
      await restoreSpellSlots(characterId)
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /characters/:id/damage - Take damage
    if (req.method === "POST" && path.match(/^\/characters\/[\w-]+\/damage$/)) {
      const characterId = path.split("/")[2]
      const body = await req.json()
      const character = await takeDamage(characterId, body.damage)
      
      return new Response(JSON.stringify(character), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /characters/:id/heal - Heal character
    if (req.method === "POST" && path.match(/^\/characters\/[\w-]+\/heal$/)) {
      const characterId = path.split("/")[2]
      const body = await req.json()
      const character = await healCharacter(characterId, body.healing)
      
      return new Response(JSON.stringify(character), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /characters/:id/temp-hp - Add temporary HP
    if (req.method === "POST" && path.match(/^\/characters\/[\w-]+\/temp-hp$/)) {
      const characterId = path.split("/")[2]
      const body = await req.json()
      const character = await addTempHP(characterId, body.tempHP)
      
      return new Response(JSON.stringify(character), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /characters/:id/export - Export character
    if (req.method === "GET" && path.match(/^\/characters\/[\w-]+\/export$/)) {
      const characterId = path.split("/")[2]
      const character = await exportCharacter(characterId)
      
      return new Response(JSON.stringify(character), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /characters/import - Import character
    if (req.method === "POST" && path === "/characters/import") {
      const body = await req.json()
      const character = await importCharacter(body)
      
      return new Response(JSON.stringify(character), {
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