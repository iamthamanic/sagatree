/**
 * session-recap-prompt — Edge mirror of domain episode-summary-prompt (#573).
 * Location: supabase/functions/_shared/session-recap-prompt.ts
 */

export type SessionRecapPromptLine = {
  id: string;
  kind: string;
  summary: string;
  visibility?: string | null;
};

export type SessionRecapPrompt = {
  version: 'episode-summary-v1';
  system: string;
  user: string;
  eventCount: number;
};

const FORBIDDEN_VIS = new Set(['gm_only', 'gm-only', 'secret', 'private']);

export function filterSpoilerSafeHighlightLines(
  lines: readonly SessionRecapPromptLine[],
): SessionRecapPromptLine[] {
  return lines.filter((line) => {
    const vis = (line.visibility ?? 'shared').trim().toLowerCase();
    if (FORBIDDEN_VIS.has(vis)) return false;
    if (!line.summary.trim()) return false;
    return true;
  });
}

export function buildSessionRecapPrompt(input: {
  sessionName: string;
  sagaTitle: string | null;
  highlightLines: readonly SessionRecapPromptLine[];
}): SessionRecapPrompt {
  const safe = filterSpoilerSafeHighlightLines(input.highlightLines).slice(0, 20);
  const saga = (input.sagaTitle ?? '').trim() || 'Saga';
  const session = input.sessionName.trim() || 'Episode';
  const events =
    safe.length === 0
      ? '- (Keine freigegebenen Ereignisse — schreibe eine kurze neutrale Episodennotiz.)'
      : safe.map((l) => `- [${l.kind}] ${l.summary.trim()}`).join('\n');

  return {
    version: 'episode-summary-v1',
    system:
      'Du bist Spielleiter-Assistent für ein Pen&Paper. Schreibe auf Deutsch eine kurze Episoden-Zusammenfassung (max. 180 Wörter) für Spieler. ' +
      'Nur aus den gelieferten freigegebenen Ereignissen. Keine Spoiler, keine GM-Geheimnisse, keine Erfindung neuer Plot-Twists. ' +
      'Ton: atmosphärisch, klar, ohne Meta (kein „als KI“).',
    user: `Saga: ${saga}\nEpisode: ${session}\n\nFreigegebene Ereignisse:\n${events}\n\nSchreibe die Zusammenfassung als Fließtext.`,
    eventCount: safe.length,
  };
}
