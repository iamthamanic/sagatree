/**
 * IncompleteTabHint — Pulsing alert icon + hover tooltip for open CharacterEditor gaps.
 * Location: src/app/character/shared/IncompleteTabHint.tsx
 */
import type { SyntheticEvent } from 'react';
import {
  WarningCircle
} from '@phosphor-icons/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../shared/ui/tooltip';

type IncompleteTabHintProps = {
  /** Accessible / tooltip context, e.g. "Spezies". */
  label: string;
  /** Concrete open issues; falls back to a short generic line when empty. */
  messages?: readonly string[];
  className?: string;
};

function stopHelpEvent(event: SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

export function IncompleteTabHint({
  label,
  messages = [],
  className = '',
}: IncompleteTabHintProps) {
  const lines = messages.map((line) => line.trim()).filter(Boolean);
  const summary =
    lines.length > 0
      ? lines
      : ['Hier fehlen noch Angaben. Bitte vervollständige die offenen Felder.'];

  return (
    <Tooltip pinOnClick={false}>
      <TooltipTrigger asChild>
        {/*
          Decorative only for a11y name: keep tab accessible names like "Spezies"
          for Playwright/role queries; hover tooltip carries the gap copy.
        */}
        <span
          aria-hidden="true"
          data-testid="incomplete-tab-hint"
          data-incomplete-tab={label}
          className={`inline-flex size-4 shrink-0 items-center justify-center text-destructive ${className}`}
          onClick={stopHelpEvent}
          onPointerDown={stopHelpEvent}
        >
          <WarningCircle className="pointer-events-none size-3.5 animate-pulse" aria-hidden />
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="max-w-[280px] text-left text-xs leading-relaxed"
      >
        <p className="font-medium">Noch Angaben nötig</p>
        {summary.length === 1 ? (
          <p className="mt-1 text-primary-foreground/90">{summary[0]}</p>
        ) : (
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-primary-foreground/90">
            {summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
