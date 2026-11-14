/**
 * AibertoChatPanel — in-memory streaming chat + optional Tool-Activity (AIB-05/06).
 * Location: src/app/ai-assistant/AibertoChatPanel.tsx
 *
 * Chat is RAM-only (reload clears). Citations jump to Rulebook via callback.
 * Tools (flag) show Activity cards; navigate ClientActions use History API.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { PaperPlaneTilt, Stop, Wrench } from '@phosphor-icons/react';
import { Button } from '../../shared/ui/button';
import { Textarea } from '../../shared/ui/textarea';
import { ScrollArea } from '../../shared/ui/scroll-area';
import { Badge } from '../../shared/ui/badge';
import {
  streamAibertoAsk,
  type AibertoAskCitation,
  type AibertoAskFinal,
} from '../../infrastructure/ai/aiberto-ask-service';
import { invokeAibertoTool } from '../../infrastructure/ai/aiberto-tools-service';
import { useAppLocation } from '../shell/routing/useAppLocation';
import { renderSafeChatMarkdown } from './safe-chat-markdown';
import {
  AibertoToolActivityList,
  type AibertoToolActivity,
} from './AibertoToolActivityCard';
import { isAibertoToolsReadEnabled } from './aiberto-flags';

export type AibertoChatPanelProps = {
  readonly onOpenSection: (sectionId: string) => void;
};

type ChatRole = 'user' | 'assistant' | 'system';

type ChatMessage = {
  readonly id: string;
  readonly role: ChatRole;
  readonly text: string;
  readonly citations?: readonly AibertoAskCitation[];
  readonly streaming?: boolean;
};

function newId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function statusMessage(final: AibertoAskFinal): string {
  if (final.status === 'unanswered') return final.message;
  if (final.status === 'disabled' || final.status === 'not-configured') return final.message;
  if (final.status === 'error') return final.message;
  return '';
}

function applyClientNavigate(path: string, navigateToPath: (path: string) => void): void {
  navigateToPath(path);
}

export function AibertoChatPanel({ onOpenSection }: AibertoChatPanelProps) {
  const toolsEnabled = isAibertoToolsReadEnabled();
  const { navigateToPath } = useAppLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [activities, setActivities] = useState<AibertoToolActivity[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy, activities]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
    );
  }, []);

  const runToolSearch = useCallback(async () => {
    const query = draft.trim();
    if (!query || !toolsEnabled || busy) return;
    const activityId = newId();
    setActivities((prev) => [
      {
        id: activityId,
        toolId: 'rulebook.search',
        labelDe: 'Regelbuch suchen',
        status: 'pending',
      },
      ...prev,
    ].slice(0, 12));
    setBusy(true);
    const result = await invokeAibertoTool('rulebook.search', { query, limit: 5 });
    if (result.status === 'ok') {
      const hits =
        result.data &&
        typeof result.data === 'object' &&
        result.data !== null &&
        'hits' in result.data &&
        Array.isArray((result.data as { hits: unknown }).hits)
          ? (result.data as { hits: readonly { sectionId?: string; title?: string }[] }).hits
          : [];
      setActivities((prev) =>
        prev.map((a) =>
          a.id === activityId
            ? {
                ...a,
                status: 'ok',
                detail: `${hits.length} Treffer`,
              }
            : a,
        ),
      );
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'system',
          text:
            hits.length > 0
              ? `Tool rulebook.search: ${hits
                  .slice(0, 5)
                  .map((h) => h.title || h.sectionId || '?')
                  .join(' · ')}`
              : 'Tool rulebook.search: keine Treffer.',
        },
      ]);
    } else {
      const denied = result.status === 'error' && result.code === 'FORBIDDEN';
      setActivities((prev) =>
        prev.map((a) =>
          a.id === activityId
            ? {
                ...a,
                status: denied ? 'denied' : 'error',
                detail: result.message,
              }
            : a,
        ),
      );
      setBanner(result.message);
    }
    setBusy(false);
  }, [busy, draft, toolsEnabled]);

  const runToolNavigate = useCallback(
    async (route: string) => {
      if (!toolsEnabled || busy) return;
      const activityId = newId();
      setActivities((prev) => [
        {
          id: activityId,
          toolId: 'app.navigate',
          labelDe: 'Navigieren',
          status: 'pending',
        },
        ...prev,
      ].slice(0, 12));
      setBusy(true);
      const result = await invokeAibertoTool('app.navigate', { route });
      if (result.status === 'ok' && result.clientAction) {
        setActivities((prev) =>
          prev.map((a) =>
            a.id === activityId
              ? { ...a, status: 'ok', detail: result.clientAction?.path }
              : a,
          ),
        );
        applyClientNavigate(result.clientAction.path, navigateToPath);
      } else {
        setActivities((prev) =>
          prev.map((a) =>
            a.id === activityId
              ? {
                  ...a,
                  status: 'error',
                  detail: result.status === 'ok' ? 'Keine ClientAction' : result.message,
                }
              : a,
          ),
        );
        if (result.status !== 'ok') setBanner(result.message);
      }
      setBusy(false);
    },
    [busy, navigateToPath, toolsEnabled],
  );

  const send = useCallback(async () => {
    const question = draft.trim();
    if (!question || busy) return;
    setDraft('');
    setBanner(null);
    const userMsg: ChatMessage = { id: newId(), role: 'user', text: question };
    const assistantId = newId();
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', text: '', streaming: true, citations: [] },
    ]);
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;

    await streamAibertoAsk(
      question,
      {
        onToken: (text) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, text: `${m.text}${text}` } : m,
            ),
          );
        },
        onFinal: (data) => {
          if (data.status === 'ok') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      text: data.answer || m.text,
                      citations: data.citations,
                      streaming: false,
                    }
                  : m,
              ),
            );
          } else {
            const msg = statusMessage(data);
            setBanner(msg);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      text: m.text.trim() || msg,
                      streaming: false,
                      role: 'system',
                    }
                  : m,
              ),
            );
          }
        },
        onError: (data) => {
          const msg = statusMessage(data) || 'Aiberto-Chat fehlgeschlagen.';
          setBanner(msg);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, text: m.text.trim() || msg, streaming: false, role: 'system' }
                : m,
            ),
          );
        },
      },
      { signal: controller.signal },
    );

    abortRef.current = null;
    setBusy(false);
  }, [busy, draft]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3" data-aiberto-chat>
      {banner ? (
        <div
          role="status"
          className="shrink-0 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
          data-aiberto-chat-banner
        >
          {banner} · Regelbuch bleibt unter „Regeln“ nutzbar.
        </div>
      ) : null}

      {toolsEnabled ? (
        <div className="shrink-0 space-y-2" data-aiberto-tools-surface>
          <AibertoToolActivityList activities={activities} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={busy || !draft.trim()}
              onClick={() => void runToolSearch()}
              aria-label="Regelbuch-Tool suchen"
              data-aiberto-tool-run="rulebook.search"
            >
              <Wrench size={16} weight="regular" aria-hidden className="mr-1.5" />
              Tool: Suche
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={busy}
              onClick={() => void runToolNavigate('library')}
              aria-label="Zur Bibliothek navigieren"
              data-aiberto-tool-run="app.navigate"
            >
              Tool: Bibliothek
            </Button>
          </div>
        </div>
      ) : null}

      <ScrollArea className="min-h-0 flex-1 rounded-lg border border-border">
        <ul className="space-y-3 p-3" data-aiberto-chat-messages>
          {messages.length === 0 ? (
            <li className="text-sm text-muted-foreground">
              Stelle eine Frage zu den SagaTree Core-Regeln. Antworten sind quellengebunden.
              Der Verlauf bleibt nur in diesem Tab (Reload löscht den Chat).
            </li>
          ) : null}
          {messages.map((message) => (
            <li
              key={message.id}
              className={`rounded-lg px-3 py-2 text-sm ${
                message.role === 'user'
                  ? 'ml-6 bg-primary text-primary-foreground'
                  : message.role === 'system'
                    ? 'border border-border bg-muted/40 text-muted-foreground'
                    : 'mr-6 border border-border bg-card'
              }`}
              data-aiberto-chat-role={message.role}
            >
              {message.role === 'assistant' || message.role === 'system' ? (
                <div data-aiberto-safe-markdown>
                  {renderSafeChatMarkdown(message.text || (message.streaming ? '…' : ''))}
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{message.text}</p>
              )}
              {message.streaming ? (
                <p className="mt-1 text-xs opacity-70">Antwortet…</p>
              ) : null}
              {message.citations && message.citations.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2" data-aiberto-citations>
                  {message.citations.map((cite) => (
                    <button
                      key={cite.sectionId}
                      type="button"
                      className="focus-visible:ring-2 focus-visible:ring-primary"
                      onClick={() => onOpenSection(cite.sectionId)}
                      aria-label={`Regelabschnitt ${cite.sectionId} öffnen`}
                    >
                      <Badge variant="outline" className="cursor-pointer hover:border-accent hover:text-accent">
                        {cite.number ? `§${cite.number}` : cite.sectionId}
                        {cite.title ? ` · ${cite.title}` : ''}
                      </Badge>
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
          <div ref={bottomRef} />
        </ul>
      </ScrollArea>

      <div className="shrink-0 space-y-2">
        <label className="sr-only" htmlFor="aiberto-chat-input">
          Frage an Aiberto
        </label>
        <Textarea
          id="aiberto-chat-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Frage zu den Core-Regeln…"
          className="min-h-11 resize-none"
          rows={3}
          disabled={busy}
          data-aiberto-chat-input
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <div className="flex items-center justify-end gap-2">
          {busy ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 min-w-11"
              onClick={stop}
              aria-label="Antwort stoppen"
              data-aiberto-chat-stop
            >
              <Stop size={18} weight="regular" aria-hidden />
              Stop
            </Button>
          ) : (
            <Button
              type="button"
              className="h-11 min-w-11"
              onClick={() => void send()}
              disabled={!draft.trim()}
              aria-label="Frage senden"
              data-aiberto-chat-send
            >
              <PaperPlaneTilt size={18} weight="regular" aria-hidden />
              Senden
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
