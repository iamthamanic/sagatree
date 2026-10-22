/**
 * CharacterAssistantDrawer (src/app/character/assistant/CharacterAssistantDrawer.tsx)
 *
 * UI-only chat side drawer for the character-creation assistant (Placeholder for a
 * future real assistant backend). Renders a right-side Sheet with a header, a
 * scrollable message list seeded with a welcome message, and an input row with a
 * send button. Sending a message only appends it locally; no network calls.
 *
 * Location: src/app/character/assistant/CharacterAssistantDrawer.tsx
 */
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  PaperPlaneTilt,
  Sparkle,
  User
} from '@phosphor-icons/react';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../../shared/ui/sheet';

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'assistant-welcome',
  role: 'assistant',
  text: 'Hi! Ich helfe dir beim Charakter erstellen — Konzept, Spezies, Archetyp, Essenzen oder Werte. Womit fangen wir an?',
};

function createMessageId(): string {
  return `assistant-msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface CharacterAssistantDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CharacterAssistantDrawer({ open, onOpenChange }: CharacterAssistantDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [draft, setDraft] = useState('');
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  // Reset the draft when the drawer closes so a stale text does not linger.
  useEffect(() => {
    if (!open) setDraft('');
  }, [open]);

  const sendMessage = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((current) => [
      ...current,
      { id: createMessageId(), role: 'user', text },
    ]);
    setDraft('');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        aria-label="Assistent Chat"
      >
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-primary/10">
            <Sparkle className="size-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-base">Assistant</SheetTitle>
            <SheetDescription className="text-xs">
              Charakter-Erstellungs-Hilfe (Demo)
            </SheetDescription>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === 'user'
                  ? 'flex justify-end gap-2'
                  : 'flex justify-start gap-2'
              }
            >
              {message.role === 'assistant' && (
                <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Sparkle className="size-3.5 text-primary" />
                </div>
              )}
              <div
                className={
                  message.role === 'user'
                    ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground'
                    : 'max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm'
                }
              >
                {message.text}
              </div>
              {message.role === 'user' && (
                <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <User className="size-3.5 text-secondary-foreground" />
                </div>
              )}
            </div>
          ))}
          <div ref={scrollAnchorRef} />
        </div>

        <form onSubmit={handleSubmit} className="border-t p-3">
          <div className="flex items-center gap-2">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Frag den Assistenten…"
              aria-label="Nachricht an den Assistenten"
              className="min-w-0 flex-1"
              autoFocus
            />
            <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Senden">
              <PaperPlaneTilt className="size-4" />
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}