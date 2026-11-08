import {
  corsHeaders,
  handleOptions,
  type CorsOptions,
} from '../_shared/cors.ts';

const CORS_OPTS: CorsOptions = {
  missingOriginPolicy: 'configured-or-star',
};
// Media Function - Image/asset management
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

interface Media { id: string; filename: string; type: string; size: number; url: string; projectId?: string; characterId?: string; tags: string[]; uploadedBy: string; uploadedAt: string }

const mediaFiles = new Map<string, Media>()
const STORAGE_URL = Deno.env.get("SUPABASE_URL") || "http://localhost:8000"

function generateId(): string { return crypto.randomUUID() }
function getMimeType(filename: string): string { const ext = filename.split('.').pop()?.toLowerCase(); const types: Record<string,string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf', mp3: 'audio/mpeg', wav: 'audio/wav', mp4: 'video/mp4', webm: 'video/webm' }; return types[ext || ''] || 'application/octet-stream' }

async function uploadMedia(data: { filename: string; content: string; projectId?: string; characterId?: string; tags?: string[]; uploadedBy: string }): Promise<Media> { const id = generateId(); const type = getMimeType(data.filename); const url = `${STORAGE_URL}/storage/v1/object/media/${id}-${data.filename}`; const size = Math.floor((data.content.length * 3) / 4); const media: Media = { id, filename: data.filename, type, size, url, projectId: data.projectId, characterId: data.characterId, tags: data.tags || [], uploadedBy: data.uploadedBy, uploadedAt: new Date().toISOString() }; mediaFiles.set(id, media); return media }
async function getMedia(id: string): Promise<Media | null> { return mediaFiles.get(id) || null }
async function listMedia(projectId?: string, type?: string): Promise<Media[]> { let all = Array.from(mediaFiles.values()); if (projectId) all = all.filter(m => m.projectId === projectId); if (type) all = all.filter(m => m.type.startsWith(type)); return all }
async function deleteMedia(id: string): Promise<void> { mediaFiles.delete(id) }
async function updateMediaTags(id: string, tags: string[]): Promise<Media> { const media = mediaFiles.get(id); if (!media) throw new Error("Media not found"); media.tags = tags; mediaFiles.set(id, media); return media }

serve(async (req: Request) => {
  const headers = corsHeaders(req, CORS_OPTS)
  const optionsResponse = handleOptions(req, CORS_OPTS);
  if (optionsResponse) return optionsResponse
  const url = new URL(req.url)
  const path = url.pathname.replace("/functions/v1/media", "")
  try {
    if (req.method === "GET" && path === "/health") return new Response(JSON.stringify({ status: 'ok', features: ['upload', 'download', 'delete', 'tags'] }), { headers: { ...headers, "Content-Type": "application/json" } })
    if (req.method === "POST" && path === "/upload") { const body = await req.json(); const media = await uploadMedia(body); return new Response(JSON.stringify(media), { headers: { ...headers, "Content-Type": "application/json" } }) }
    if (req.method === "GET" && path === "/media") { const projectId = url.searchParams.get('projectId') || undefined; const type = url.searchParams.get('type') || undefined; const list = await listMedia(projectId, type); return new Response(JSON.stringify(list), { headers: { ...headers, "Content-Type": "application/json" } }) }
    if (req.method === "GET" && path.match(/^\/media\/[\w-]+$/)) { const id = path.split("/")[2]; const media = await getMedia(id); if (!media) return new Response(JSON.stringify({ error: "Media not found" }), { status: 404, headers: { ...headers, "Content-Type": "application/json" } }); return new Response(JSON.stringify(media), { headers: { ...headers, "Content-Type": "application/json" } }) }
    if (req.method === "PUT" && path.match(/^\/media\/[\w-]+\/tags$/)) { const id = path.split("/")[2]; const body = await req.json(); const media = await updateMediaTags(id, body.tags); return new Response(JSON.stringify(media), { headers: { ...headers, "Content-Type": "application/json" } }) }
    if (req.method === "DELETE" && path.match(/^\/media\/[\w-]+$/)) { const id = path.split("/")[2]; await deleteMedia(id); return new Response(JSON.stringify({ success: true }), { headers: { ...headers, "Content-Type": "application/json" } }) }
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...headers, "Content-Type": "application/json" } })
  } catch (error: unknown) { return new Response(JSON.stringify({ error: "Internal server error", message: (error instanceof Error ? error.message : String(error)) }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } }) }
})
