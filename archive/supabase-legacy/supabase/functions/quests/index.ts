import {
  corsHeaders,
  handleOptions,
  type CorsOptions,
} from '../_shared/cors.ts';

const CORS_OPTS: CorsOptions = {
  missingOriginPolicy: 'configured-or-star',
};
// Quests Function - Quest management, tracking, generation
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

interface Quest { id: string; projectId: string; name: string; description: string; type: 'main' | 'side' | 'personal'; status: 'available' | 'active' | 'completed' | 'failed'; objectives: Objective[]; rewards: Reward[]; giver?: string; location?: string; prerequisites: string[]; createdAt: string; updatedAt: string }
interface Objective { id: string; description: string; completed: boolean; target?: string; count?: number; current?: number }
interface Reward { type: 'xp' | 'gold' | 'item' | 'reputation'; amount: number; item?: string }

const quests = new Map<string, Quest>()

function generateId(): string { return crypto.randomUUID() }

async function createQuest(data: Partial<Quest>): Promise<Quest> { const id = generateId(); const now = new Date().toISOString(); const quest: Quest = { id, projectId: data.projectId || '', name: data.name || 'Unknown Quest', description: data.description || '', type: data.type || 'side', status: data.status || 'available', objectives: data.objectives || [], rewards: data.rewards || [], giver: data.giver, location: data.location, prerequisites: data.prerequisites || [], createdAt: now, updatedAt: now }; quests.set(id, quest); return quest }
async function getQuest(id: string): Promise<Quest | null> { return quests.get(id) || null }
async function listQuests(projectId?: string, status?: string): Promise<Quest[]> { let all = Array.from(quests.values()); if (projectId) all = all.filter(q => q.projectId === projectId); if (status) all = all.filter(q => q.status === status); return all }
async function updateQuest(id: string, data: Partial<Quest>): Promise<Quest> { const quest = quests.get(id); if (!quest) throw new Error("Quest not found"); const updated: Quest = { ...quest, ...data, id, updatedAt: new Date().toISOString() }; quests.set(id, updated); return updated }
async function completeObjective(questId: string, objectiveId: string): Promise<Quest> { const quest = quests.get(questId); if (!quest) throw new Error("Quest not found"); const obj = quest.objectives.find(o => o.id === objectiveId); if (obj) { obj.completed = true; quest.updatedAt = new Date().toISOString(); if (quest.objectives.every(o => o.completed)) quest.status = 'completed' } quests.set(questId, quest); return quest }
async function generateQuest(type: 'main' | 'side' | 'personal', level: number): Promise<Quest> { const templates = { main: [{ name: 'The Dragon\'s Hoard', description: 'Defeat the ancient dragon and reclaim the stolen treasure.', objectives: ['Travel to Dragon\'s Lair', 'Defeat the Dragon', 'Retrieve the Treasure'] }, { name: 'The Dark Lord\'s Return', description: 'Stop the Dark Lord from rising again.', objectives: ['Gather Information', 'Find the Ritual Site', 'Disrupt the Ritual'] }], side: [{ name: 'Lost Heirloom', description: 'A villager has lost a precious family heirloom.', objectives: ['Search the Woods', 'Find the Heirloom', 'Return to Owner'] }, { name: 'Monster Bounty', description: 'A dangerous monster is terrorizing the countryside.', objectives: ['Track the Monster', 'Defeat the Monster', 'Collect the Bounty'] }], personal: [{ name: 'Training Exercise', description: 'Practice your skills to become stronger.', objectives: ['Complete 3 Encounters', 'Reach Level ' + (level + 1) ] }, { name: 'Ancient Knowledge', description: 'Seek out ancient texts to expand your knowledge.', objectives: ['Visit the Library', 'Find the Tome', 'Study the Tome'] }] }; const template = templates[type][Math.floor(Math.random() * templates[type].length)]; return createQuest({ name: template.name, description: template.description, type, objectives: template.objectives.map((desc, i) => ({ id: `obj-${i}`, description: desc, completed: false })), rewards: [{ type: 'xp', amount: level * 100 }, { type: 'gold', amount: level * 10 }] }) }

serve(async (req: Request) => {
  const headers = corsHeaders(req, CORS_OPTS)
  const optionsResponse = handleOptions(req, CORS_OPTS);
  if (optionsResponse) return optionsResponse
  const url = new URL(req.url)
  const path = url.pathname.replace("/functions/v1/quests", "")
  try {
    if (req.method === "GET" && path === "/health") return new Response(JSON.stringify({ status: 'ok', features: ['quests', 'objectives', 'rewards', 'generation'] }), { headers: { ...headers, "Content-Type": "application/json" } })
    if (req.method === "POST" && path === "/quests") { const body = await req.json(); const quest = await createQuest(body); return new Response(JSON.stringify(quest), { headers: { ...headers, "Content-Type": "application/json" } }) }
    if (req.method === "GET" && path === "/quests") { const projectId = url.searchParams.get('projectId') || undefined; const status = url.searchParams.get('status') || undefined; const list = await listQuests(projectId, status); return new Response(JSON.stringify(list), { headers: { ...headers, "Content-Type": "application/json" } }) }
    if (req.method === "GET" && path.match(/^\/quests\/[\w-]+$/)) { const id = path.split("/")[2]; const quest = await getQuest(id); if (!quest) return new Response(JSON.stringify({ error: "Quest not found" }), { status: 404, headers: { ...headers, "Content-Type": "application/json" } }); return new Response(JSON.stringify(quest), { headers: { ...headers, "Content-Type": "application/json" } }) }
    if (req.method === "PUT" && path.match(/^\/quests\/[\w-]+$/)) { const id = path.split("/")[2]; const body = await req.json(); const quest = await updateQuest(id, body); return new Response(JSON.stringify(quest), { headers: { ...headers, "Content-Type": "application/json" } }) }
    if (req.method === "POST" && path.match(/^\/quests\/[\w-]+\/complete\/[\w-]+$/)) { const questId = path.split("/")[2]; const objectiveId = path.split("/")[4]; const quest = await completeObjective(questId, objectiveId); return new Response(JSON.stringify(quest), { headers: { ...headers, "Content-Type": "application/json" } }) }
    if (req.method === "POST" && path === "/quests/generate") { const body = await req.json(); const quest = await generateQuest(body.type || 'side', body.level || 1); return new Response(JSON.stringify(quest), { headers: { ...headers, "Content-Type": "application/json" } }) }
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...headers, "Content-Type": "application/json" } })
  } catch (error: unknown) { return new Response(JSON.stringify({ error: "Internal server error", message: (error instanceof Error ? error.message : String(error)) }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } }) }
})
