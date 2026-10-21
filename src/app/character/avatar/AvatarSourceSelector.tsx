/**
 * AvatarSourceSelector — three source cards (SagaTree / Import / Meshy) for #14.
 * Location: src/app/character/avatar/AvatarSourceSelector.tsx
 *
 * Source is UI origin only; capabilities come from validated analysis, never from the card choice.
 * Long summaries live in a help tooltip next to the title (keeps cards compact).
 */

import {
  Question
} from '@phosphor-icons/react';
import {
  AVATAR_SOURCE_OPTIONS,
  describeAvatarSourceCapabilities,
  type AvatarSource,
} from '../../../domains/character/avatar';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../shared/ui/tooltip';

interface AvatarSourceSelectorProps {
  value: AvatarSource;
  capabilitySummary?: string;
  onSelect: (source: AvatarSource) => void;
  disabled?: boolean;
}

export function AvatarSourceSelector({
  value,
  capabilitySummary,
  onSelect,
  disabled = false,
}: AvatarSourceSelectorProps) {
  const summary =
    capabilitySummary ??
    describeAvatarSourceCapabilities({
      source: value,
      morphBody: false,
      morphFace: false,
      animation: false,
      facial: false,
      wearables: false,
    });

  return (
    <section className="space-y-3" aria-label="Avatar-Quelle" data-avatar-source={value}>
      <div>
        <h3 className="text-sm font-medium">Avatar-Quelle</h3>
        <p className="text-xs text-muted-foreground">
          Eine Quelle wählen. Funktionen richten sich nach der Rig-Analyse — nicht nach der Quelle.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Avatar-Quellen">
        {AVATAR_SOURCE_OPTIONS.map((option) => {
          const selected = value === option.source;
          return (
            <Button
              key={option.source}
              type="button"
              role="radio"
              aria-checked={selected}
              variant={selected ? 'default' : 'outline'}
              disabled={disabled}
              data-avatar-source-card={option.source}
              data-selected={selected ? 'true' : 'false'}
              className="h-auto min-w-0 flex-col items-start gap-1.5 whitespace-normal px-2.5 py-3 text-left"
              onClick={() => onSelect(option.source)}
            >
              <span className="flex w-full min-w-0 items-center gap-1">
                <span className="min-w-0 font-medium leading-snug">{option.titleDe}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      role="img"
                      aria-label={`${option.titleDe} erklären`}
                      data-testid={`avatar-source-help-${option.source}`}
                      className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-current/80 hover:bg-foreground/10 hover:text-current"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                    >
                      <Question className="pointer-events-none size-3.5" aria-hidden />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    sideOffset={6}
                    className="max-w-[280px] text-left text-xs leading-relaxed"
                  >
                    {option.summaryDe}
                  </TooltipContent>
                </Tooltip>
              </span>
              <Badge variant="secondary" className="text-[10px]">
                {option.expectationDe}
              </Badge>
            </Button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground" data-avatar-source-capability-summary>
        {summary}
      </p>
    </section>
  );
}
