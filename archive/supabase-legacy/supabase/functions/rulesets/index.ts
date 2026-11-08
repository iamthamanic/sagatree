import {
  corsHeaders,
  handleOptions,
  type CorsOptions,
} from '../_shared/cors.ts';

const CORS_OPTS: CorsOptions = {
  missingOriginPolicy: 'configured-or-star',
};
// ===========================================
// Rulesets Function (Extended with Open5e Integration)
// Rules configuration, lookups, Open5e enrichment
// ===========================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// ===========================================
// TYPES
// ===========================================

interface Ruleset {
  id: string
  name: string
  version: string
  description: string
  abilities: string[]
  skills: Record<string, string>
  conditions: string[]
  dice: string[]
  classes: Record<string, ClassInfo>
  races: Record<string, RaceInfo>
  features: Record<string, FeatureInfo>
  spells?: Spell[]
  monsters?: Monster[]
  items?: Item[]
  source: string
  isOfficial: boolean
  isCustom: boolean
}

interface ClassInfo {
  hitDie: number
  primaryAbility: string
  saves: string[]
  features?: string[]
  description?: string
  spellcasting?: {
    ability: string
    spellsKnown?: number[]
    spellSlots?: Record<string, number[]>
  }
}

interface RaceInfo {
  bonuses: Record<string, number>
  speed: number
  traits?: string[]
  description?: string
  languages?: string[]
}

interface FeatureInfo {
  name: string
  description: string
  level?: number
  source?: string
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
  source: string
}

interface Monster {
  id: string
  name: string
  type: string
  size: string
  challengeRating: number
  hp: number
  ac: number
  speed: string
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
  actions: string[]
  source: string
}

interface Item {
  id: string
  name: string
  type: string
  rarity: string
  weight: number
  cost: string
  description: string
  source: string
}

// ===========================================
// STORAGE
// ===========================================

const rulesets = new Map<string, Ruleset>()

// ===========================================
// D&D 5e SRD (SagaTree Primary)
// ===========================================

const dnd5eSRD: Ruleset = {
  id: 'dnd5e-srd',
  name: 'D&D 5th Edition SRD',
  version: '5.1',
  description: 'Dungeons & Dragons 5th Edition System Reference Document',
  abilities: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'],
  skills: {
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
  },
  conditions: [
    'blinded', 'charmed', 'deafened', 'frightened', 'grappled',
    'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned',
    'prone', 'restrained', 'stunned', 'unconscious', 'exhausted'
  ],
  dice: ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'],
  classes: {
    'barbarian': {
      hitDie: 12,
      primaryAbility: 'strength',
      saves: ['strength', 'constitution'],
      features: ['Rage', 'Unarmored Defense', 'Reckless Attack', 'Danger Sense', 'Primal Path', 'Extra Attack', 'Fast Movement', 'Feral Instinct', 'Brutal Critical', 'Relentless Rage', 'Persistent Rage', 'Indomitable Might', 'Primal Champion'],
      description: 'A fierce warrior of primitive background who can enter a battle fury',
    },
    'bard': {
      hitDie: 8,
      primaryAbility: 'charisma',
      saves: ['dexterity', 'charisma'],
      features: ['Spellcasting', 'Bardic Inspiration', 'Jack of All Trades', 'Song of Rest', 'Bard College', 'Expertise', 'Font of Inspiration', 'Countercharm', 'Magical Secrets', 'Superior Inspiration'],
      description: 'An inspiring magician whose power echoes the music of creation',
    },
    'cleric': {
      hitDie: 8,
      primaryAbility: 'wisdom',
      saves: ['wisdom', 'charisma'],
      features: ['Spellcasting', 'Divine Domain', 'Channel Divinity', 'Ability Score Improvement', 'Destroy Undead', 'Divine Strike', 'Divine Intervention'],
      spellcasting: {
        ability: 'wisdom',
        spellSlots: {
          '1': [3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 8, 9, 9],
        },
      },
      description: 'A priestly champion who wields divine magic in service of a higher power',
    },
    'druid': {
      hitDie: 8,
      primaryAbility: 'wisdom',
      saves: ['intelligence', 'wisdom'],
      features: ['Spellcasting', 'Druidic', 'Wild Shape', 'Druid Circle', 'Wild Shape Improvement', 'Beast Spells', 'Archdruid'],
      description: 'A priest of nature, wielding elemental powers and wild shaping',
    },
    'fighter': {
      hitDie: 10,
      primaryAbility: 'strength',
      saves: ['strength', 'constitution'],
      features: ['Fighting Style', 'Second Wind', 'Action Surge', 'Martial Archetype', 'Extra Attack', 'Indomitable', 'Ability Score Improvement'],
      description: 'A master of martial combat, skilled with a variety of weapons and armor',
    },
    'monk': {
      hitDie: 8,
      primaryAbility: 'dexterity',
      saves: ['strength', 'dexterity'],
      features: ['Unarmored Defense', 'Martial Arts', 'Ki', 'Unarmored Movement', 'Monastic Tradition', 'Deflect Missiles', 'Slow Fall', 'Extra Attack', 'Stunning Strike', 'Ki-Empowered Strikes', 'Evasion', 'Stillness of Mind', 'Purity of Body', 'Tongue of the Sun and Moon', 'Diamond Soul', 'Timeless Body', 'Empty Body', 'Perfect Self'],
      description: 'A master of martial arts, harnessing the power of body and soul',
    },
    'paladin': {
      hitDie: 10,
      primaryAbility: 'charisma',
      saves: ['wisdom', 'charisma'],
      features: ['Divine Sense', 'Lay on Hands', 'Fighting Style', 'Spellcasting', 'Divine Smite', 'Divine Health', 'Sacred Oath', 'Aura of Protection', 'Aura of Courage', 'Improved Divine Smite', 'Cleansing Touch', 'Aura Improvements'],
      description: 'A holy warrior bound to a sacred oath',
    },
    'ranger': {
      hitDie: 10,
      primaryAbility: 'dexterity',
      saves: ['strength', 'dexterity'],
      features: ['Favored Enemy', 'Natural Explorer', 'Fighting Style', 'Spellcasting', 'Ranger Archetype', 'Extra Attack', 'Favored Enemy Improvements', 'Natural Explorer Improvements', 'Lands Stride', 'Hide in Plain Sight', 'Vanish', 'Feral Senses', 'Foe Slayer'],
      description: 'A warrior who combats threats on the edges of civilization',
    },
    'rogue': {
      hitDie: 8,
      primaryAbility: 'dexterity',
      saves: ['dexterity', 'intelligence'],
      features: ['Expertise', 'Sneak Attack', 'Thieves Cant', 'Cunning Action', 'Roguish Archetype', 'Ability Score Improvement', 'Uncanny Dodge', 'Evasion', 'Reliable Talent', 'Blindsense', 'Slippery Mind', 'Elusive', 'Stroke of Luck'],
      description: 'A scoundrel who uses stealth and trickery to overcome obstacles',
    },
    'sorcerer': {
      hitDie: 6,
      primaryAbility: 'charisma',
      saves: ['constitution', 'charisma'],
      features: ['Spellcasting', 'Sorcerous Origin', 'Font of Magic', 'Sorcery Points', 'Metamagic', 'Sorcerous Restoration', 'Ability Score Improvement'],
      description: 'A spellcaster who draws magic from within',
    },
    'warlock': {
      hitDie: 8,
      primaryAbility: 'charisma',
      saves: ['wisdom', 'charisma'],
      features: ['Otherworldly Patron', 'Pact Magic', 'Eldritch Invocations', 'Pact Boon', 'Ability Score Improvement', 'Mystic Arcanum', 'Eldritch Master'],
      description: 'A magic-user who gains power through a pact with a powerful entity',
    },
    'wizard': {
      hitDie: 6,
      primaryAbility: 'intelligence',
      saves: ['intelligence', 'wisdom'],
      features: ['Spellcasting', 'Arcane Recovery', 'Arcane Tradition', 'Ability Score Improvement', 'Spell Mastery', 'Signature Spells'],
      description: 'A scholarly magic-user capable of manipulating the structures of reality',
    },
  },
  races: {
    'human': {
      bonuses: { 'all': 1 },
      speed: 30,
      traits: ['Versatility'],
      description: 'Humans are the most adaptable and ambitious people',
      languages: ['Common'],
    },
    'elf': {
      bonuses: { 'dexterity': 2 },
      speed: 30,
      traits: ['Darkvision', 'Keen Senses', 'Fey Ancestry', 'Trance'],
      description: 'Elves are magical people of otherworldly grace',
      languages: ['Common', 'Elvish'],
    },
    'dwarf': {
      bonuses: { 'constitution': 2 },
      speed: 25,
      traits: ['Darkvision', 'Dwarven Resilience', 'Dwarven Combat Training', 'Stonecunning'],
      description: 'Dwarves are solid and enduring like the mountains',
      languages: ['Common', 'Dwarvish'],
    },
    'halfling': {
      bonuses: { 'dexterity': 2 },
      speed: 25,
      traits: ['Lucky', 'Brave', 'Halfling Nimbleness'],
      description: 'Halflings are a small and clever people',
      languages: ['Common', 'Halfling'],
    },
    'dragonborn': {
      bonuses: { 'strength': 2, 'charisma': 1 },
      speed: 30,
      traits: ['Draconic Ancestry', 'Breath Weapon', 'Damage Resistance'],
      description: 'Dragonborn are proud, honorable dragon-kin',
      languages: ['Common', 'Draconic'],
    },
    'gnome': {
      bonuses: { 'intelligence': 2 },
      speed: 25,
      traits: ['Darkvision', 'Gnome Cunning'],
      description: 'Gnomes are clever and inventive tricksters',
      languages: ['Common', 'Gnomish'],
    },
    'half-elf': {
      bonuses: { 'charisma': 2 },
      speed: 30,
      traits: ['Skill Versatility', 'Fey Ancestry'],
      description: 'Half-elves combine human curiosity with elven grace',
      languages: ['Common', 'Elvish'],
    },
    'half-orc': {
      bonuses: { 'strength': 2, 'constitution': 1 },
      speed: 30,
      traits: ['Darkvision', 'Savage Attacks', 'Relentless Endurance', 'Menacing'],
      description: 'Half-orcs combine human versatility with orcish ferocity',
      languages: ['Common', 'Orc'],
    },
    'tiefling': {
      bonuses: { 'charisma': 2, 'intelligence': 1 },
      speed: 30,
      traits: ['Darkvision', 'Hellish Resistance', 'Infernal Legacy'],
      description: 'Tieflings bear the mark of the infernal',
      languages: ['Common', 'Infernal'],
    },
  },
  features: {},
  source: 'SRD',
  isOfficial: true,
  isCustom: false,
}

// Pathfinder 2e (SagaTree Primary)
const pathfinder2e: Ruleset = {
  id: 'pf2e-core',
  name: 'Pathfinder 2nd Edition',
  version: '2.0',
  description: 'Pathfinder 2nd Edition Core Rules',
  abilities: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'],
  skills: {
    'acrobatics': 'dexterity',
    'arcana': 'intelligence',
    'athletics': 'strength',
    'crafting': 'intelligence',
    'deception': 'charisma',
    'diplomacy': 'charisma',
    'intimidation': 'charisma',
    'medicine': 'wisdom',
    'nature': 'wisdom',
    'occultism': 'intelligence',
    'performance': 'charisma',
    'religion': 'wisdom',
    'society': 'intelligence',
    'stealth': 'dexterity',
    'survival': 'wisdom',
    'thievery': 'dexterity',
  },
  conditions: [
    'blinded', 'broken', 'clumsy', 'confused', 'controlled', 'dazzled', 'deafened',
    'doomed', 'drained', 'dying', 'encumbered', 'enfeebled', 'fascinated', 'fatigued',
    'flat-footed', 'fleeing', 'frightened', 'grabbed', 'hidden', 'immobilized',
    'invisible', 'paralyzed', 'petrified', 'prone', 'quickened', 'restrained', 'sick',
    'slowed', 'stunned', 'stupefied', 'unconscious', 'undetected', 'wounded'
  ],
  dice: ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'],
  classes: {},
  races: {},
  features: {},
  source: 'OGL',
  isOfficial: true,
  isCustom: false,
}

// Initialize rulesets
rulesets.set(dnd5eSRD.id, dnd5eSRD)
rulesets.set(pathfinder2e.id, pathfinder2e)

// ===========================================
// OPEN5E INTEGRATION
// ===========================================

const OPEN5E_API = 'https://api.open5e.com'

async function fetchOpen5eSpells(): Promise<Spell[]> {
  try {
    const response = await fetch(`${OPEN5E_API}/spells/?limit=500`)
    const data = await response.json()
    
    return data.results.map((spell: any) => ({
      id: spell.slug,
      name: spell.name,
      level: parseInt(spell.level) || 0,
      school: spell.school,
      castingTime: spell.casting_time,
      range: spell.range,
      components: spell.components.split(',').map((c: string) => c.trim()),
      duration: spell.duration,
      description: spell.desc,
      higherLevels: spell.higher_level,
      classes: spell.dnd_class.split(',').map((c: string) => c.trim().toLowerCase()),
      source: 'Open5e',
    }))
  } catch (error: unknown) {
    console.error('Failed to fetch Open5e spells:', error)
    return []
  }
}

async function fetchOpen5eMonsters(): Promise<Monster[]> {
  try {
    const response = await fetch(`${OPEN5E_API}/monsters/?limit=500`)
    const data = await response.json()
    
    return data.results.map((monster: any) => ({
      id: monster.slug,
      name: monster.name,
      type: monster.type,
      size: monster.size,
      challengeRating: parseFloat(monster.cr) || 0,
      hp: monster.hit_points,
      ac: monster.armor_class,
      speed: monster.speed,
      str: monster.strength,
      dex: monster.dexterity,
      con: monster.constitution,
      int: monster.intelligence,
      wis: monster.wisdom,
      cha: monster.charisma,
      actions: [],
      source: 'Open5e',
    }))
  } catch (error: unknown) {
    console.error('Failed to fetch Open5e monsters:', error)
    return []
  }
}

async function fetchOpen5eItems(): Promise<Item[]> {
  try {
    const response = await fetch(`${OPEN5E_API}/weapons/?limit=500`)
    const data = await response.json()
    
    return data.results.map((item: any) => ({
      id: item.slug,
      name: item.name,
      type: 'weapon',
      rarity: 'common',
      weight: 0,
      cost: item.cost,
      description: item.desc || '',
      source: 'Open5e',
    }))
  } catch (error: unknown) {
    console.error('Failed to fetch Open5e items:', error)
    return []
  }
}

// Merge Open5e data into ruleset
async function enrichRulesetWithOpen5e(rulesetId: string): Promise<Ruleset | null> {
  const ruleset = rulesets.get(rulesetId)
  if (!ruleset) return null
  
  // Only enrich D&D 5e
  if (rulesetId !== 'dnd5e-srd') return ruleset
  
  // Fetch Open5e data
  const [spells, monsters, items] = await Promise.all([
    fetchOpen5eSpells(),
    fetchOpen5eMonsters(),
    fetchOpen5eItems(),
  ])
  
  // Merge into ruleset
  const enriched: Ruleset = {
    ...ruleset,
    spells: [...(ruleset.spells || []), ...spells],
    monsters: [...(ruleset.monsters || []), ...monsters],
    items: [...(ruleset.items || []), ...items],
  }
  
  return enriched
}

// ===========================================
// API HANDLERS
// ===========================================

async function listRulesets(): Promise<Ruleset[]> {
  return Array.from(rulesets.values())
}

async function getRuleset(id: string, enrich: boolean = false): Promise<Ruleset | null> {
  const ruleset = rulesets.get(id)
  if (!ruleset) return null
  
  if (enrich) {
    return enrichRulesetWithOpen5e(id)
  }
  
  return ruleset
}

async function createRuleset(data: Partial<Ruleset>): Promise<Ruleset> {
  const id = data.id || `custom-${Date.now()}`
  
  const ruleset: Ruleset = {
    id,
    name: data.name || 'Custom Ruleset',
    version: data.version || '1.0',
    description: data.description || '',
    abilities: data.abilities || ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'],
    skills: data.skills || {},
    conditions: data.conditions || [],
    dice: data.dice || ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'],
    classes: data.classes || {},
    races: data.races || {},
    features: data.features || {},
    source: data.source || 'custom',
    isOfficial: false,
    isCustom: true,
  }
  
  rulesets.set(id, ruleset)
  return ruleset
}

async function getSpells(rulesetId: string, filter?: { level?: number; school?: string; class?: string }): Promise<Spell[]> {
  const ruleset = await getRuleset(rulesetId, true)
  if (!ruleset || !ruleset.spells) return []
  
  let spells = ruleset.spells
  
  if (filter?.level !== undefined) {
    spells = spells.filter(s => s.level === filter.level)
  }
  if (filter?.school) {
    spells = spells.filter(s => s.school.toLowerCase() === filter.school!.toLowerCase())
  }
  if (filter?.class) {
    spells = spells.filter(s => s.classes.includes(filter.class!.toLowerCase()))
  }
  
  return spells
}

async function getMonsters(rulesetId: string, filter?: { type?: string; cr?: number }): Promise<Monster[]> {
  const ruleset = await getRuleset(rulesetId, true)
  if (!ruleset || !ruleset.monsters) return []
  
  let monsters = ruleset.monsters
  
  if (filter?.type) {
    monsters = monsters.filter(m => m.type.toLowerCase() === filter.type!.toLowerCase())
  }
  if (filter?.cr !== undefined) {
    monsters = monsters.filter(m => m.challengeRating === filter.cr)
  }
  
  return monsters
}

async function getItems(rulesetId: string, filter?: { type?: string }): Promise<Item[]> {
  const ruleset = await getRuleset(rulesetId, true)
  if (!ruleset || !ruleset.items) return []
  
  let items = ruleset.items
  
  if (filter?.type) {
    items = items.filter(i => i.type === filter.type)
  }
  
  return items
}

// ===========================================
// MAIN HANDLER
// ===========================================

serve(async (req: Request) => {
  const headers = corsHeaders(req, CORS_OPTS)
  
  const optionsResponse = handleOptions(req, CORS_OPTS)
  if (optionsResponse) return optionsResponse
  
  const url = new URL(req.url)
  const path = url.pathname.replace("/functions/v1/rulesets", "")
  
  try {
    // GET /health
    if (req.method === "GET" && path === "/health") {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        features: ['rulesets', 'skills', 'conditions', 'classes', 'races', 'spells', 'monsters', 'items', 'open5e'],
        rulesetCount: rulesets.size,
      }), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /rulesets - List all rulesets
    if (req.method === "GET" && path === "/rulesets") {
      const list = await listRulesets()
      return new Response(JSON.stringify(list), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // POST /rulesets - Create custom ruleset
    if (req.method === "POST" && path === "/rulesets") {
      const body = await req.json()
      const ruleset = await createRuleset(body)
      return new Response(JSON.stringify(ruleset), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /rulesets/:id - Get ruleset
    if (req.method === "GET" && path.match(/^\/rulesets\/[\w-]+$/)) {
      const id = path.split("/")[2]
      const enrich = url.searchParams.get('enrich') === 'true'
      const ruleset = await getRuleset(id, enrich)
      
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
    
    // GET /rulesets/:id/spells - Get spells
    if (req.method === "GET" && path.match(/^\/rulesets\/[\w-]+\/spells$/)) {
      const id = path.split("/")[2]
      const filter = {
        level: url.searchParams.get('level') ? parseInt(url.searchParams.get('level')!) : undefined,
        school: url.searchParams.get('school') || undefined,
        class: url.searchParams.get('class') || undefined,
      }
      const spells = await getSpells(id, filter)
      return new Response(JSON.stringify(spells), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /rulesets/:id/monsters - Get monsters
    if (req.method === "GET" && path.match(/^\/rulesets\/[\w-]+\/monsters$/)) {
      const id = path.split("/")[2]
      const filter = {
        type: url.searchParams.get('type') || undefined,
        cr: url.searchParams.get('cr') ? parseFloat(url.searchParams.get('cr')!) : undefined,
      }
      const monsters = await getMonsters(id, filter)
      return new Response(JSON.stringify(monsters), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /rulesets/:id/items - Get items
    if (req.method === "GET" && path.match(/^\/rulesets\/[\w-]+\/items$/)) {
      const id = path.split("/")[2]
      const filter = {
        type: url.searchParams.get('type') || undefined,
      }
      const items = await getItems(id, filter)
      return new Response(JSON.stringify(items), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /rulesets/:id/skills - Get skills
    if (req.method === "GET" && path.match(/^\/rulesets\/[\w-]+\/skills$/)) {
      const id = path.split("/")[2]
      const ruleset = rulesets.get(id)
      return new Response(JSON.stringify(ruleset?.skills || {}), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /rulesets/:id/conditions - Get conditions
    if (req.method === "GET" && path.match(/^\/rulesets\/[\w-]+\/conditions$/)) {
      const id = path.split("/")[2]
      const ruleset = rulesets.get(id)
      return new Response(JSON.stringify(ruleset?.conditions || []), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /rulesets/:id/classes - Get classes
    if (req.method === "GET" && path.match(/^\/rulesets\/[\w-]+\/classes$/)) {
      const id = path.split("/")[2]
      const ruleset = rulesets.get(id)
      return new Response(JSON.stringify(ruleset?.classes || {}), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }
    
    // GET /rulesets/:id/races - Get races
    if (req.method === "GET" && path.match(/^\/rulesets\/[\w-]+\/races$/)) {
      const id = path.split("/")[2]
      const ruleset = rulesets.get(id)
      return new Response(JSON.stringify(ruleset?.races || {}), {
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