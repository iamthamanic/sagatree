/**
 * Quarantined export Edge worker characterization (MIG-408 / #824).
 * Location: server/src/modules/media/internal/export-quarantine.ts
 *
 * NOT a public host route. Legacy worker is dispatcher-unmounted (404).
 * Format conversion only — import parse does NOT persist resources.
 */

/** Explicit product decision: no automatic host/public activation. */
export const EXPORT_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

/** Minimal PDF serializer is not a validated document pipeline. */
export const EXPORT_PDF_IS_VALIDATED_PIPELINE = false as const;

export type ExportFormat = 'json' | 'pdf' | 'markdown';

export type ExportResult = {
  readonly content: string | Uint8Array;
  readonly contentType: string;
  readonly filename: string;
};

export function exportJson(data: Record<string, unknown>): string {
  return JSON.stringify(data, null, 2);
}

export function exportMarkdown(data: Record<string, unknown>, type: string): string {
  let md = '';
  if (type === 'character') {
    md = `# ${typeof data.name === 'string' ? data.name : 'Character'}\n\n`;
    md += `**Race:** ${typeof data.race === 'string' ? data.race : 'Unknown'}\n\n`;
    md += `**Class:** ${typeof data.class === 'string' ? data.class : 'Unknown'}\n\n`;
    md += `**Level:** ${typeof data.level === 'number' ? data.level : 1}\n\n`;
    md += `## Attributes\n\n`;
    if (data.attributes && typeof data.attributes === 'object') {
      for (const [key, value] of Object.entries(data.attributes as Record<string, unknown>)) {
        md += `- **${key}:** ${String(value)}\n`;
      }
    }
    md += `\n## Equipment\n\n`;
    if (Array.isArray(data.equipment)) {
      for (const item of data.equipment as Array<{ name?: string; equipped?: boolean }>) {
        md += `- ${item.name ?? ''}${item.equipped ? ' (equipped)' : ''}\n`;
      }
    }
  } else if (type === 'session') {
    md = `# Session: ${typeof data.name === 'string' ? data.name : 'Unknown'}\n\n`;
    md += `**Date:** ${typeof data.createdAt === 'string' ? data.createdAt : 'Unknown'}\n\n`;
    md += `## Players\n\n`;
    if (Array.isArray(data.players)) {
      for (const player of data.players as Array<{ name?: string }>) {
        md += `- ${player.name ?? ''}\n`;
      }
    }
  } else {
    md = `# ${typeof data.name === 'string' ? data.name : 'Export'}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
  }
  return md;
}

/** Minimal PDF serializer — not a validated document pipeline. */
export function exportPdf(data: Record<string, unknown>, type: string): Uint8Array {
  const markdown = exportMarkdown(data, type);
  const pdfContent = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length ${markdown.length} >>\nstream\nBT\n/F1 12 Tf\n50 700 Td\n(${markdown.replace(/\n/g, ') Tj\n0 -12 Td\n(')}) Tj\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000266 00000 n\n0000000${markdown.length + 300} 00000 n\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${markdown.length + 400}\n%%EOF`;
  return new TextEncoder().encode(pdfContent);
}

export function buildExport(input: {
  readonly type: string;
  readonly id: string;
  readonly format: string;
  readonly data: Record<string, unknown>;
}): ExportResult | { readonly error: 'Invalid format'; readonly status: 400 } {
  const filenameBase = `${input.type}-${input.id}`;
  if (input.format === 'json') {
    return {
      content: exportJson(input.data),
      contentType: 'application/json',
      filename: `${filenameBase}.json`,
    };
  }
  if (input.format === 'markdown') {
    return {
      content: exportMarkdown(input.data, input.type),
      contentType: 'text/markdown',
      filename: `${filenameBase}.md`,
    };
  }
  if (input.format === 'pdf') {
    return {
      content: exportPdf(input.data, input.type),
      contentType: 'application/pdf',
      filename: `${filenameBase}.pdf`,
    };
  }
  return { error: 'Invalid format', status: 400 };
}

/**
 * Legacy import: JSON.parse only — no schema validation, no persistence.
 * Successor must keep conversion and persistence as separate contracts.
 */
export function parseImportContent(content: string):
  | { readonly ok: true; readonly data: unknown; readonly persisted: false }
  | { readonly ok: false; readonly error: 'Invalid JSON'; readonly status: 400 } {
  try {
    const data: unknown = JSON.parse(content);
    return { ok: true, data, persisted: false };
  } catch {
    return { ok: false, error: 'Invalid JSON', status: 400 };
  }
}
