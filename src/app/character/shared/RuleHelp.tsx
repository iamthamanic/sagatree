import { type ReactNode } from 'react';
import {
  Question
} from '@phosphor-icons/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../shared/ui/tooltip';
import { cn } from '../../../shared/ui/utils';

interface RuleHelpProps {
  label: string;
  children: ReactNode;
  contentClassName?: string;
}

/**
 * RuleHelp — Regel-Erklärung per Tooltip (Character app shared presentation).
 * Location: src/app/character/shared/RuleHelp.tsx
 */
export function RuleHelp({ label, children, contentClassName }: RuleHelpProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${label} erklären`}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Question className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className={cn('max-w-[320px] px-3 py-2 text-left leading-relaxed', contentClassName)}>
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
