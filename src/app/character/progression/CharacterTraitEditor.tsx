import { useMemo, useState, type KeyboardEvent } from 'react';
import {
  Plus,
  X
} from '@phosphor-icons/react';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../../../shared/ui/popover';
import { getCharacterTraitSuggestions } from '../../../domains/character/use-cases/character-lore-traits';
import type { CharacterLoreContext, CharacterTraitCategory } from '../../../domains/character/contracts/character-lore.types';

interface CharacterTraitEditorProps {
  id: string;
  label: string;
  category: CharacterTraitCategory;
  values: string[];
  context: CharacterLoreContext;
  onChange: (values: string[]) => void;
}

const MAX_TRAIT_LENGTH = 160;
const MAX_TRAIT_BLOCKS = 12;

function normalizeTraitKey(value: string): string {
  return value.trim().toLocaleLowerCase('de-DE');
}

export function CharacterTraitEditor({
  id,
  label,
  category,
  values,
  context,
  onChange,
}: CharacterTraitEditorProps) {
  const [open, setOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const selectedKeys = useMemo(
    () => new Set(values.map(normalizeTraitKey)),
    [values],
  );
  const suggestions = useMemo(
    () => getCharacterTraitSuggestions(category, context)
      .filter((suggestion) => !selectedKeys.has(normalizeTraitKey(suggestion))),
    [category, context, selectedKeys],
  );
  const atLimit = values.length >= MAX_TRAIT_BLOCKS;

  const addValue = (candidate: string) => {
    const value = candidate.trim();
    const key = normalizeTraitKey(value);
    if (!value || value.length > MAX_TRAIT_LENGTH || atLimit || selectedKeys.has(key)) return;
    onChange([...values, value]);
    setCustomValue('');
  };

  const removeValue = (value: string) => {
    onChange(values.filter((entry) => entry !== value));
  };

  const handleCustomKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addValue(customValue);
  };

  return (
    <div className="space-y-2">
      <Label id={`${id}-label`}>{label}</Label>
      <div
        className="min-h-[88px] rounded-md border border-foreground/20 bg-input-background p-2 transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]"
        aria-labelledby={`${id}-label`}
      >
        <div className="flex flex-wrap items-center gap-2">
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1 text-sm"
            >
              <span className="break-words">{value}</span>
              <button
                type="button"
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => removeValue(value)}
                aria-label={`${value} entfernen`}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}

          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 border-dashed"
                aria-label={`${label}: Baustein hinzufügen`}
                disabled={atLimit}
              >
                <Plus className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[min(360px,calc(100vw-2rem))] space-y-3 p-3">
              <div>
                <p className="text-sm font-medium">Baustein hinzufügen</p>
                <p className="text-xs text-muted-foreground">Vorschlag wählen oder eigenen Text schreiben.</p>
              </div>

              <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                {suggestions.length > 0 ? (
                  suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="w-full rounded-md border border-transparent px-2.5 py-2 text-left text-sm transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => addValue(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))
                ) : (
                  <p className="px-2 py-3 text-sm text-muted-foreground">Alle Vorschläge sind bereits ausgewählt.</p>
                )}
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <Label htmlFor={`${id}-custom`} className="text-xs">Eigener Baustein</Label>
                <div className="flex gap-2">
                  <Input
                    id={`${id}-custom`}
                    value={customValue}
                    maxLength={MAX_TRAIT_LENGTH}
                    onChange={(event) => setCustomValue(event.target.value)}
                    onKeyDown={handleCustomKeyDown}
                    placeholder="Eigenen Text eingeben"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addValue(customValue)}
                    disabled={!customValue.trim() || atLimit}
                  >
                    Hinzufügen
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Maximal {MAX_TRAIT_LENGTH} Zeichen pro Baustein.</p>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {values.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">Noch keine Bausteine gewählt. Mit + hinzufügen.</p>
        )}
        {atLimit && (
          <p className="mt-2 text-xs text-muted-foreground">Maximal {MAX_TRAIT_BLOCKS} Bausteine pro Gruppe.</p>
        )}
      </div>
    </div>
  );
}
