import {
  corsHeaders,
  handleOptions,
  type CorsOptions,
} from '../_shared/cors.ts';

const CORS_OPTS: CorsOptions = {
  missingOriginPolicy: 'configured-or-star',
};
// Marketplace Function - Templates marketplace, sharing
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

interface Template { id: string; name: string; type: 'ruleset' | 'character' | 'world' | 'quest' | 'npc'; author: string; description: string; data: Record<string,any>; tags: string[]; downloads: number; rating: number; createdAt: string }

const templates = new Map<string, Template>()

// Sample templates
const sampleTemplates: Template[] = [
  { id: 'dnd5e-srd', name: 'D&D 5e SRD', type: 'ruleset', author: 'Wizards of the Coast', description: 'D&D 5th Edition System Reference Document', data: { abilities: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] }, tags: ['dnd', '5e', 'srd'], downloads: 10000, rating: 5.0, createdAt: '2024-01-01' },
  { id: 'pf2e-core', name: 'Pathfinder 2e Core', type: 'ruleset', author: 'Paizo', description: 'Pathfinder 2nd Edition Core Rules', data: { abilities: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] }, tags: ['pathfinder', 'pf2e'], downloads: 5000, rating: 4.8, createdAt: '2024-01-01' },
  { id: 'hero-template', name: 'Hero Template', type: 'character', author: 'System', description: 'Standard hero character template', data: { level: 1, hp: 10, class: 'fighter' }, tags: ['character', 'hero'], downloads: 2000, rating: 4.5, createdAt: '2024-01-01' },
  { id: 'village-template', name: 'Village Template', type: 'world', author: 'System', description: 'Standard village world template', data: { locations: ['tavern', 'blacksmith', 'general store'] }, tags: ['world', 'village'], downloads: 1500, rating: 4.3, createdAt: '2024-01-01' }
]

sampleTemplates.forEach(t => templates.set(t.id, t))

function generateId(): string { return crypto.randomUUID() }

async function listTemplates(type?: string, tag?: string): Promise<Template[]> { let all = Array.from(templates.values()); if (type) all = all.filter(t => t.type === type); if (tag) all = all.filter(t => t.tags.includes(tag)); return all.sort((a, b) => b.downloads - a.downloads) }
async function getTemplate(id: string): Promise<Template | null> { return templates.get(id) || null }
async function createTemplate(data: Partial<Template>): Promise<Template> { const id = generateId(); const template: Template = { id, name: data.name || 'Untitled', type: data.type || 'ruleset', author: data.author || 'Anonymous', description: data.description || '', data: data.data || {}, tags: data.tags || [], downloads: 0, rating: 0, createdAt: new Date().toISOString() }; templates.set(id, template); return template }
async function downloadTemplate(id: string): Promise<Template | null> { const template = templates.get(id); if (!template) return null; template.downloads++; templates.set(id, template); return template }
async function rateTemplate(id: string, rating: number): Promise<Template | null> { const template = templates.get(id); if (!template) return null; const count = template.downloads || 1; template.rating = ((template.rating * count) + rating) / (count + 1); templates.set(id, template); return template }
async function searchTemplates(query: string): Promise<Template[]> { const lowerQuery = query.toLowerCase(); return Array.from(templates.values()).filter(t => t.name.toLowerCase().includes(lowerQuery) || t.description.toLowerCase().includes(lowerQuery) || t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) }

serve(async (req: Request) => {
  const headers = corsHeaders(req, CORS_OPTS)
  const optionsResponse = handleOptions(req, CORS_OPTS);
  if (optionsResponse) return optionsResponse
  const url = new URL(req.url)
  const path = url.pathname.replace("/functions/v1/marketplace", "")
  try {
    if (req.method === "GET" && path === "/health") return new Response(JSON.stringify({ status: 'ok', features: ['templates', 'search', 'download', 'rate'] }), { headers: { ...headers, "Content-Type": "application/json" } })
    if (req.method === "GET" && path === "/templates") { const type = url.searchParams.get('type') || undefined; const tag = url.searchParams.get('tag') || undefined; const list = await listTemplates(type, tag); return new Response(JSON.stringify(list), { headers: { ...headers, "Content-Type": "application/json" } }) }
    if (req.method === "GET" && path.match(/^\/templates\/[\w-]+$/)) { const id = path.split("/")[2]; const template = await getTemplate(id); if (!template) return new Response(JSON.stringify({ error: "Template not found" }), { status: 404, headers: { ...headers, "Content-Type": "application/json" } }); return new Response(JSON.stringify(template), { headers: { ...headers, "Content-Type": "application/json" } }) }
    if (req.method === "POST" && path === "/templates") { const body = await req.json(); const template = await createTemplate(body); return new Response(JSON.stringify(template), { headers: { ...headers, "Content-Type": "application/json" } }) }
    if (req.method === "POST" && path.match(/^\/templates\/[\w-]+\/download$/)) { const id = path.split("/")[2]; const template = await downloadTemplate(id); if (!template) return new Response(JSON.stringify({ error: "Template not found" }), { status: 404, headers: { ...headers, "Content-Type": "application/json" } }); return new Response(JSON.stringify(template), { headers: { ...headers, "Content-Type": "application/json" } }) }
    if (req.method === "POST" && path.match(/^\/templates\/[\w-]+\/rate$/)) { const id = path.split("/")[2]; const body = await req.json(); const template = await rateTemplate(id, body.rating); if (!template) return new Response(JSON.stringify({ error: "Template not found" }), { status: 404, headers: { ...headers, "Content-Type": "application/json" } }); return new Response(JSON.stringify(template), { headers: { ...headers, "Content-Type": "application/json" } }) }
    if (req.method === "GET" && path === "/search") { const query = url.searchParams.get('q') || ''; const results = await searchTemplates(query); return new Response(JSON.stringify(results), { headers: { ...headers, "Content-Type": "application/json" } }) }
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...headers, "Content-Type": "application/json" } })
  } catch (error: unknown) { return new Response(JSON.stringify({ error: "Internal server error", message: (error instanceof Error ? error.message : String(error)) }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } }) }
})
