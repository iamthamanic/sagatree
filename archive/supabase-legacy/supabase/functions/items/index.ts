import {
  corsHeaders,
  handleOptions,
  type CorsOptions,
} from '../_shared/cors.ts';

const CORS_OPTS: CorsOptions = {
  missingOriginPolicy: 'configured-or-star',
};
// Items Function - Item database, equipment management
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

interface Item { id: string; name: string; type: 'weapon' | 'armor' | 'shield' | 'potion' | 'scroll' | 'wondrous' | 'tool' | 'other'; rarity: 'common' | 'uncommon' | 'rare' | 'very rare' | 'legendary' | 'artifact'; weight: number; value: number; description: string; properties: Record<string,any>; source: string }

const items = new Map<string, Item>()

const srdItems: Item[] = [
  { id: 'longsword', name: 'Longsword', type: 'weapon', rarity: 'common', weight: 3, value: 15, description: 'A versatile melee weapon.', properties: { damage: '1d8 slashing', versatile: '1d10' }, source: 'SRD' },
  { id: 'chain-mail', name: 'Chain Mail', type: 'armor', rarity: 'common', weight: 55, value: 75, description: 'Made of interlocking metal rings, chain mail includes a layer of quilted fabric underneath to prevent painful chafing.', properties: { ac: 16, strength: 13, stealth: 'disadvantage' }, source: 'SRD' },
  { id: 'shield', name: 'Shield', type: 'shield', rarity: 'common', weight: 6, value: 10, description: 'A shield made of wood or metal.', properties: { ac: 2 }, source: 'SRD' },
  { id: 'potion-healing', name: 'Potion of Healing', type: 'potion', rarity: 'common', weight: 0.1, value: 50, description: 'You regain 2d4+2 hit points when you drink this potion.', properties: { healing: '2d4+2' }, source: 'SRD' },
  { id: 'scroll-fireball', name: 'Scroll of Fireball', type: 'scroll', rarity: 'uncommon', weight: 0, value: 200, description: 'A scroll containing the Fireball spell.', properties: { spell: 'fireball', level: 3 }, source: 'SRD' },
  { id: 'bag-holding', name: 'Bag of Holding', type: 'wondrous', rarity: 'uncommon', weight: 15, value: 4000, description: 'This bag has an interior space considerably larger than its outside dimensions.', properties: { capacity: 500, weightLimit: 500 }, source: 'SRD' }
]

srdItems.forEach(i => items.set(i.id, i))

function generateId(): string { return crypto.randomUUID() }

async function listItems(type?: string, rarity?: string): Promise<Item[]> { let all = Array.from(items.values()); if (type) all = all.filter(i => i.type === type); if (rarity) all = all.filter(i => i.rarity === rarity); return all }
async function getItem(id: string): Promise<Item | null> { return items.get(id) || null }
async function createItem(data: Partial<Item>): Promise<Item> { const id = generateId(); const item: Item = { id, name: data.name || 'Unknown', type: data.type || 'other', rarity: data.rarity || 'common', weight: data.weight || 0, value: data.value || 0, description: data.description || '', properties: data.properties || {}, source: data.source || 'custom' }; items.set(id, item); return item }

serve(async (req: Request) => {
  const headers = corsHeaders(req, CORS_OPTS)
  const optionsResponse = handleOptions(req, CORS_OPTS);
  if (optionsResponse) return optionsResponse
  const url = new URL(req.url)
  const path = url.pathname.replace("/functions/v1/items", "")
  try {
    if (req.method === "GET" && path === "/health") return new Response(JSON.stringify({ status: 'ok', features: ['items', 'search', 'filter'] }), { headers: { ...headers, "Content-Type": "application/json" } })
    if (req.method === "GET" && path === "/items") { const type = url.searchParams.get('type') || undefined; const rarity = url.searchParams.get('rarity') || undefined; const list = await listItems(type, rarity); return new Response(JSON.stringify(list), { headers: { ...headers, "Content-Type": "application/json" } }) }
    if (req.method === "GET" && path.match(/^\/items\/[\w-]+$/)) { const id = path.split("/")[2]; const item = await getItem(id); if (!item) return new Response(JSON.stringify({ error: "Item not found" }), { status: 404, headers: { ...headers, "Content-Type": "application/json" } }); return new Response(JSON.stringify(item), { headers: { ...headers, "Content-Type": "application/json" } }) }
    if (req.method === "POST" && path === "/items") { const body = await req.json(); const item = await createItem(body); return new Response(JSON.stringify(item), { headers: { ...headers, "Content-Type": "application/json" } }) }
    if (req.method === "POST" && path === "/items/generate") { const types = ['weapon', 'armor', 'potion', 'scroll', 'wondrous']; const rarities = ['common', 'uncommon', 'rare', 'very rare', 'legendary']; const item = await createItem({ name: `Magic ${types[Math.floor(Math.random() * types.length)]}`, type: types[Math.floor(Math.random() * types.length)] as Item['type'], rarity: rarities[Math.floor(Math.random() * rarities.length)] as Item['rarity'], weight: Math.floor(Math.random() * 50), value: Math.floor(Math.random() * 50000) }); return new Response(JSON.stringify(item), { headers: { ...headers, "Content-Type": "application/json" } }) }
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...headers, "Content-Type": "application/json" } })
  } catch (error: unknown) { return new Response(JSON.stringify({ error: "Internal server error", message: (error instanceof Error ? error.message : String(error)) }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } }) }
})
