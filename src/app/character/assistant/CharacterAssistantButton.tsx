/**
 * CharacterAssistantButton (src/app/character/assistant/CharacterAssistantButton.tsx)
 *
 * Header button that opens the CharacterAssistantDrawer. Owns the drawer open
 * state so the CharacterEditor header stays clean; the label stays "Assistant"
 * (icon + text) per product decision, UI-only for now — the real assistant
 * backend comes later.
 *
 * Location: src/app/character/assistant/CharacterAssistantButton.tsx
 */
import { useState } from 'react';
import {
  Sparkle
} from '@phosphor-icons/react';
import { Button } from '../../../shared/ui/button';
import { CharacterAssistantDrawer } from './CharacterAssistantDrawer';

export function CharacterAssistantButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Assistent öffnen"
        aria-haspopup="dialog"
      >
        <Sparkle className="mr-2 h-4 w-4" />
        Assistant
      </Button>
      <CharacterAssistantDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}