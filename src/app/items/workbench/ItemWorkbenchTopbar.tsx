/**
 * ItemWorkbenchTopbar — back | title | primary (Speichern / Fork) top-right (#139).
 * Location: src/app/items/workbench/ItemWorkbenchTopbar.tsx
 */
import {
  ArrowLeft
} from '@phosphor-icons/react';
import { Button } from '../../../shared/ui/button';

export interface ItemWorkbenchTopbarProps {
  title: string;
  primaryLabel: string;
  primaryDisabled?: boolean;
  /** Hide primary (e.g. landing before type pick). */
  hidePrimary?: boolean;
  onBack: () => void;
  onPrimary: () => void;
  saving?: boolean;
}

export function ItemWorkbenchTopbar({
  title,
  primaryLabel,
  primaryDisabled,
  hidePrimary,
  onBack,
  onPrimary,
  saving,
}: ItemWorkbenchTopbarProps) {
  return (
    <header
      className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/60 pb-2"
      data-item-workbench-topbar
    >
      <Button
        type="button"
        variant="ghost"
        className="h-11 min-h-11 gap-2 px-3"
        onClick={onBack}
        data-item-workbench-back
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Zurück zu Items
      </Button>

      <h1 className="min-w-0 flex-1 truncate text-center text-lg font-semibold tracking-wide md:text-xl">
        {title}
      </h1>

      {hidePrimary ? (
        <div className="min-w-[7.5rem]" aria-hidden="true" />
      ) : (
        <Button
          type="button"
          className="h-11 min-h-11 min-w-[7.5rem] shrink-0"
          onClick={onPrimary}
          disabled={primaryDisabled || saving}
          data-item-workbench-primary
        >
          {saving ? 'Speichern…' : primaryLabel}
        </Button>
      )}
    </header>
  );
}
