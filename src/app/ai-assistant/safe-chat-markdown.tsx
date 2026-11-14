/**
 * safe-chat-markdown — escape HTML + minimal markdown for Aiberto chat (AIB-05).
 * Location: src/app/ai-assistant/safe-chat-markdown.tsx
 *
 * Renders React text nodes only — never assigns raw HTML from model text.
 */
import type { ReactNode } from 'react';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Strip citation markers for display when chips are rendered separately. */
export function stripCitationMarkers(text: string): string {
  return text.replace(/\[(?:cite|section|id):\s*stc-[a-z0-9-]+\]/gi, '').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Very small markdown subset: paragraphs, **bold**, *italic*, `code`, newlines.
 * Output is React text/elements only — no HTML passthrough.
 */
export function renderSafeChatMarkdown(raw: string): ReactNode {
  const text = stripCitationMarkers(raw);
  if (!text) return null;
  const paragraphs = text.split(/\n{2,}/);
  return paragraphs.map((para, pIdx) => {
    const lines = para.split('\n');
    return (
      <p key={`p-${pIdx}`} className="whitespace-pre-wrap break-words text-sm leading-relaxed">
        {lines.map((line, lIdx) => (
          <span key={`l-${pIdx}-${lIdx}`}>
            {lIdx > 0 ? <br /> : null}
            {renderInline(line)}
          </span>
        ))}
      </p>
    );
  });
}

function renderInline(line: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Split by code, then bold, then italic — order avoids nested HTML injection.
  const codeSplit = line.split(/(`[^`]+`)/g);
  codeSplit.forEach((chunk, i) => {
    if (chunk.startsWith('`') && chunk.endsWith('`') && chunk.length >= 2) {
      nodes.push(
        <code
          key={`c-${i}`}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
        >
          {chunk.slice(1, -1)}
        </code>,
      );
      return;
    }
    const boldSplit = chunk.split(/(\*\*[^*]+\*\*)/g);
    boldSplit.forEach((b, j) => {
      if (b.startsWith('**') && b.endsWith('**') && b.length >= 4) {
        nodes.push(
          <strong key={`b-${i}-${j}`} className="font-semibold">
            {b.slice(2, -2)}
          </strong>,
        );
        return;
      }
      const italicSplit = b.split(/(\*[^*]+\*)/g);
      italicSplit.forEach((it, k) => {
        if (it.startsWith('*') && it.endsWith('*') && it.length >= 2 && !it.startsWith('**')) {
          nodes.push(
            <em key={`i-${i}-${j}-${k}`} className="italic">
              {it.slice(1, -1)}
            </em>,
          );
          return;
        }
        if (it) nodes.push(<span key={`t-${i}-${j}-${k}`}>{it}</span>);
      });
    });
  });
  return nodes;
}

/** Extract citation IDs from model text for chip rendering. */
export function extractDisplayCitationIds(text: string): string[] {
  const found = new Set<string>();
  const re = /\[(?:cite|section|id):\s*(stc-[a-z0-9-]+)\]/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match[1]) found.add(match[1].toLowerCase());
  }
  return [...found];
}
