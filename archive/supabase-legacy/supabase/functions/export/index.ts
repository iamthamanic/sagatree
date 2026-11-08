import {
  corsHeaders,
  handleOptions,
  type CorsOptions,
} from '../_shared/cors.ts';

const CORS_OPTS: CorsOptions = {
  missingOriginPolicy: 'configured-or-star',
  methods: 'GET, POST, OPTIONS',
};
// Export Function - PDF/JSON export
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

interface ExportRequest { type: 'character' | 'session' | 'world' | 'campaign'; id: string; format: 'json' | 'pdf' | 'markdown'; data: Record<string,any> }

async function exportJSON(data: Record<string,any>): Promise<string> { return JSON.stringify(data, null, 2) }
async function exportMarkdown(data: Record<string,any>, type: string): Promise<string> { let md = ''; if (type === 'character') { md = `# ${data.name || 'Character'}\n\n`; md += `**Race:** ${data.race || 'Unknown'}\n\n`; md += `**Class:** ${data.class || 'Unknown'}\n\n`; md += `**Level:** ${data.level || 1}\n\n`; md += `## Attributes\n\n`; if (data.attributes) { for (const [key, value] of Object.entries(data.attributes)) { md += `- **${key}:** ${value}\n` } } md += `\n## Equipment\n\n`; if (data.equipment) { for (const item of data.equipment) { md += `- ${item.name}${item.equipped ? ' (equipped)' : ''}\n` } } } else if (type === 'session') { md = `# Session: ${data.name || 'Unknown'}\n\n`; md += `**Date:** ${data.createdAt || 'Unknown'}\n\n`; md += `## Players\n\n`; if (data.players) { for (const player of data.players) { md += `- ${player.name}\n` } } } else { md = `# ${data.name || 'Export'}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` } return md }
async function exportPDF(data: Record<string,any>, type: string): Promise<Uint8Array> { const markdown = await exportMarkdown(data, type); const pdfContent = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length ${markdown.length} >>\nstream\nBT\n/F1 12 Tf\n50 700 Td\n(${markdown.replace(/\n/g, ') Tj\n0 -12 Td\n(')}) Tj\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000266 00000 n\n0000000${markdown.length + 300} 00000 n\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${markdown.length + 400}\n%%EOF`; return new TextEncoder().encode(pdfContent) }

serve(async (req: Request) => {
  const headers = corsHeaders(req, CORS_OPTS)
  const optionsResponse = handleOptions(req, CORS_OPTS);
  if (optionsResponse) return optionsResponse
  const url = new URL(req.url)
  const path = url.pathname.replace("/functions/v1/export", "")
  try {
    if (req.method === "GET" && path === "/health") return new Response(JSON.stringify({ status: 'ok', features: ['json', 'pdf', 'markdown'] }), { headers: { ...headers, "Content-Type": "application/json" } })
    if (req.method === "POST" && path === "/export") { const body: ExportRequest = await req.json(); let content: string | Uint8Array; let contentType: string; let filename: string; if (body.format === 'json') { content = await exportJSON(body.data); contentType = 'application/json'; filename = `${body.type}-${body.id}.json` } else if (body.format === 'markdown') { content = await exportMarkdown(body.data, body.type); contentType = 'text/markdown'; filename = `${body.type}-${body.id}.md` } else if (body.format === 'pdf') { content = await exportPDF(body.data, body.type); contentType = 'application/pdf'; filename = `${body.type}-${body.id}.pdf` } else { return new Response(JSON.stringify({ error: "Invalid format" }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } }) } return new Response(content as BodyInit, { headers: { ...headers, "Content-Type": contentType, "Content-Disposition": `attachment; filename="${filename}"` } }) }
    if (req.method === "POST" && path === "/import") { const body = await req.json(); let data: Record<string,any>; try { data = JSON.parse(body.content) } catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } }) } return new Response(JSON.stringify({ success: true, data }), { headers: { ...headers, "Content-Type": "application/json" } }) }
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...headers, "Content-Type": "application/json" } })
  } catch (error: unknown) { return new Response(JSON.stringify({ error: "Internal server error", message: (error instanceof Error ? error.message : String(error)) }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } }) }
})
