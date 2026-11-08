import {
  corsHeaders,
  handleOptions,
  type CorsOptions,
} from '../_shared/cors.ts';

const CORS_OPTS: CorsOptions = {
  missingOriginPolicy: 'configured-or-star',
};
// Spellbook Function - Spell management, casting tracking
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

interface Spell { id: string; name: string; level: number; school: 'abjuration' | 'conjuration' | 'divination' | 'enchantment' | 'evocation' | 'illusion' | 'necromancy' | 'transmutation'; castingTime: string; range: string; components: string[]; duration: string; description: string; higherLevels?: string; classes: string[]; source: string }

interface KnownSpell { spellId: string; known: boolean; prepared: boolean }

interface CharacterSpellbook { characterId: string; spells: KnownSpell[]; slotsUsed: Record<string, number> }

const spells = new Map<string, Spell>()
const spellbooks = new Map<string, CharacterSpellbook>()

// D&D 5e SRD Spells (simplified)
const srdSpells: Spell[] = [
  { id: 'fireball', name: 'Fireball', level: 3, school: 'evocation', castingTime: '1 action', range: '150 feet', components: ['V', 'S', 'M'], duration: 'Instantaneous', description: 'A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame.', classes: ['sorcerer', 'wizard'], source: 'SRD' },
  { id: 'magic-missile', name: 'Magic Missile', level: 1, school: 'evocation', castingTime: '1 action', range: '120 feet', components: ['V', 'S'], duration: 'Instantaneous', description: 'You create three glowing darts of magical force. Each dart hits a creature of your choice that you can see within range.', classes: ['sorcerer', 'wizard'], source: 'SRD' },
  { id: 'healing-word', name: 'Healing Word', level: 1, school: 'evocation', castingTime: '1 bonus action', range: '60 feet', components: ['V'], duration: 'Instantaneous', description: 'A creature of your choice that you can see within range regains hit points equal to 1d4 + your spellcasting ability modifier.', classes: ['bard', 'cleric', 'druid'], source: 'SRD' },
  { id: 'cure-wounds', name: 'Cure Wounds', level: 1, school: 'evocation', castingTime: '1 action', range: 'Touch', components: ['V', 'S'], duration: 'Instantaneous', description: 'A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier.', classes: ['bard', 'cleric', 'druid', 'paladin', 'ranger'], source: 'SRD' },
  { id: 'shield', name: 'Shield', level: 1, school: 'abjuration', castingTime: '1 reaction', range: 'Self', components: ['V', 'S'], duration: '1 round', description: 'An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC.', classes: ['sorcerer', 'wizard'], source: 'SRD' },
  { id: 'detect-magic', name: 'Detect Magic', level: 1, school: 'divination', castingTime: '1 action', range: 'Self', components: ['V', 'S'], duration: 'Concentration, up to 10 minutes', description: 'For the duration, you sense the presence of magic within 30 feet of you.', classes: ['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'wizard'], source: 'SRD' },
  { id: 'invisibility', name: 'Invisibility', level: 2, school: 'illusion', castingTime: '1 action', range: 'Touch', components: ['V', 'S', 'M'], duration: 'Concentration, up to 1 hour', description: 'A creature you touch becomes invisible until the spell ends.', classes: ['bard', 'sorcerer', 'warlock', 'wizard'], source: 'SRD' },
  { id: 'counterspell', name: 'Counterspell', level: 3, school: 'abjuration', castingTime: '1 reaction', range: '60 feet', components: ['S'], duration: 'Instantaneous', description: 'You attempt to interrupt a creature in the process of casting a spell.', classes: ['sorcerer', 'warlock', 'wizard'], source: 'SRD' },
  { id: 'hold-person', name: 'Hold Person', level: 2, school: 'enchantment', castingTime: '1 action', range: '60 feet', components: ['V', 'S', 'M'], duration: 'Concentration, up to 1 minute', description: 'Choose a humanoid that you can see within range. The target must succeed on a Wisdom saving throw or be paralyzed.', classes: ['bard', 'cleric', 'druid', 'sorcerer', 'warlock', 'wizard'], source: 'SRD' },
  { id: 'fly', name: 'Fly', level: 3, school: 'transmutation', castingTime: '1 action', range: 'Touch', components: ['V', 'S', 'M'], duration: 'Concentration, up to 10 minutes', description: 'You touch a willing creature. The target gains a flying speed of 60 feet for the duration.', classes: ['sorcerer', 'warlock', 'wizard'], source: 'SRD' }
]

srdSpells.forEach(s => spells.set(s.id, s))

function generateId(): string { return crypto.randomUUID() }

async function listSpells(level?: number, school?: string, classFilter?: string): Promise<Spell[]> { let all = Array.from(spells.values()); if (level !== undefined) all = all.filter(s => s.level === level); if (school) all = all.filter(s => s.school === school); if (classFilter) all = all.filter(s => s.classes.includes(classFilter.toLowerCase())); return all }
async function getSpell(id: string): Promise<Spell | null> { return spells.get(id) || null }
async function createSpell(data: Partial<Spell>): Promise<Spell> { const id = generateId(); const spell: Spell = { id, name: data.name || 'Unknown', level: data.level || 0, school: data.school || 'evocation', castingTime: data.castingTime || '1 action', range: data.range || '60 feet', components: data.components || ['V', 'S'], duration: data.duration || 'Instantaneous', description: data.description || '', higherLevels: data.higherLevels, classes: data.classes || [], source: data.source || 'custom' }; spells.set(id, spell); return spell }
async function getSpellbook(characterId: string): Promise<CharacterSpellbook> { let book = spellbooks.get(characterId); if (!book) { book = { characterId, spells: [], slotsUsed: {} }; spellbooks.set(characterId, book) } return book }
async function learnSpell(characterId: string, spellId: string): Promise<CharacterSpellbook> { const book = await getSpellbook(characterId); const existing = book.spells.find(s => s.spellId === spellId); if (!existing) book.spells.push({ spellId, known: true, prepared: false }); spellbooks.set(characterId, book); return book }
async function prepareSpell(characterId: string, spellId: string): Promise<CharacterSpellbook> { const book = await getSpellbook(characterId); const spell = book.spells.find(s => s.spellId === spellId); if (spell) spell.prepared = true; spellbooks.set(characterId, book); return book }
async function unprepareSpell(characterId: string, spellId: string): Promise<CharacterSpellbook> { const book = await getSpellbook(characterId); const spell = book.spells.find(s => s.spellId === spellId); if (spell) spell.prepared = false; spellbooks.set(characterId, book); return book }
async function castSpell(characterId: string, spellId: string, level: number): Promise<{ success: boolean; remaining: number }> { const book = await getSpellbook(characterId); const slotKey = `level${level}`; const maxSlots = { level1: 4, level2: 3, level3: 3, level4: 3, level5: 2, level6: 1, level7: 1, level8: 1, level9: 1 }; const max = maxSlots[slotKey as keyof typeof maxSlots] || 0; const used = book.slotsUsed[slotKey] || 0; if (used >= max) return { success: false, remaining: 0 }; book.slotsUsed[slotKey] = used + 1; spellbooks.set(characterId, book); return { success: true, remaining: max - book.slotsUsed[slotKey] } }
async function restoreSpellSlots(characterId: string): Promise<void> { const book = await getSpellbook(characterId); book.slotsUsed = {}; spellbooks.set(characterId, book) }

serve(async (req: Request) => {
  const headers = corsHeaders(req, CORS_OPTS)
  const optionsResponse = handleOptions(req, CORS_OPTS);
  if (optionsResponse) return optionsResponse
  const url = new URL(req.url)
  const path = url.pathname.replace("/functions/v1/spellbook", "")
  try {
    if (req.method === "GET" && path === "/health") return new Response(JSON.stringify({ status: 'ok', features: ['spells', 'spellbooks', 'casting'] }), { headers: { ...headers, "Content-Type": "application/json" } })
    if (req.method === "GET" && path === "/spells") { const level = url.searchParams.get('level') ? parseInt(url.searchParams.get('level')!) : undefined; const school = url.searchParams.get('school') || undefined; const classFilter = url.searchParams.get('class') || undefined; const list = await listSpells(level, school, classFilter); return new Response(JSON.stringify(list), { headers: { ...headers, "Content-Type": "application/json" } }) }
    if (req.method === "GET" && path.match(/^\/spells\/[\w-]+$/)) { const id = path.split("/")[2]; const spell = await getSpell(id); if (!spell) return new Response(JSON.stringify({ error: "Spell not found" }), { status: 404, headers: { ...headers, "Content-Type": "application/json" } }); return new Response(JSON.stringify(spell), { headers: { ...headers, "Content-Type": "application/json" } }) }
    if (req.method === "POST" && path === "/spells") { const body = await req.json(); const spell = await createSpell(body); return new Response(JSON.stringify(spell), { headers: { ...headers, "Content-Type": "application/json" } }) }
    if (req.method === "GET" && path.match(/^\/spellbook\/[\w-]+$/)) { const characterId = path.split("/")[2]; const book = await getSpellbook(characterId); return new Response(JSON.stringify(book), { headers: { ...headers, "Content-Type": "application/json" } }) }
    if (req.method === "POST" && path.match(/^\/spellbook\/[\w-]+\/learn$/)) { const characterId = path.split("/")[2]; const body = await req.json(); const book = await learnSpell(characterId, body.spellId); return new Response(JSON.stringify(book), { headers: { ...headers, "Content-Type": "application/json" } }) }
    if (req.method === "POST" && path.match(/^\/spellbook\/[\w-]+\/prepare$/)) { const characterId = path.split("/")[2]; const body = await req.json(); const book = await prepareSpell(characterId, body.spellId); return new Response(JSON.stringify(book), { headers: { ...headers, "Content-Type": "application/json" } }) }
    if (req.method === "POST" && path.match(/^\/spellbook\/[\w-]+\/unprepare$/)) { const characterId = path.split("/")[2]; const body = await req.json(); const book = await unprepareSpell(characterId, body.spellId); return new Response(JSON.stringify(book), { headers: { ...headers, "Content-Type": "application/json" } }) }
    if (req.method === "POST" && path.match(/^\/spellbook\/[\w-]+\/cast$/)) { const characterId = path.split("/")[2]; const body = await req.json(); const result = await castSpell(characterId, body.spellId, body.level); return new Response(JSON.stringify(result), { headers: { ...headers, "Content-Type": "application/json" } }) }
    if (req.method === "POST" && path.match(/^\/spellbook\/[\w-]+\/restore$/)) { const characterId = path.split("/")[2]; await restoreSpellSlots(characterId); return new Response(JSON.stringify({ success: true }), { headers: { ...headers, "Content-Type": "application/json" } }) }
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...headers, "Content-Type": "application/json" } })
  } catch (error: unknown) { return new Response(JSON.stringify({ error: "Internal server error", message: (error instanceof Error ? error.message : String(error)) }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } }) }
})
