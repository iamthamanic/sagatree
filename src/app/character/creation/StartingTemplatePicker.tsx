/**
 * StartingTemplatePicker — lists the ten SagaTree Level-1 system starttemplates (#464).
 * Location: src/app/character/creation/StartingTemplatePicker.tsx
 *
 * Each row shows a template icon; playstyle summary lives in a help tooltip (keeps the list compact).
 */
import type { SyntheticEvent } from 'react';
import {
  Question
} from '@phosphor-icons/react';
import { listSagaTreeStartingTemplates } from '../../../domains/rules/sagatree/starting-templates';
import type { SagaTreeStartingTemplateKey } from '../../../domains/rules/sagatree/starting-templates';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../shared/ui/tooltip';
import { StartingTemplateIcon } from './StartingTemplateIcon';

type StartingTemplatePickerProps = {
  onSelect: (templateKey: SagaTreeStartingTemplateKey) => void;
};

function stopHelpEvent(event: SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

export function StartingTemplatePicker({ onSelect }: StartingTemplatePickerProps) {
  const templates = listSagaTreeStartingTemplates();

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">SagaTree-Starttemplates</p>
      <ul className="max-h-64 space-y-2 overflow-y-auto" aria-label="SagaTree-Starttemplates">
        {templates.map((template) => (
          <li key={template.key}>
            <button
              type="button"
              onClick={() => onSelect(template.key)}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary"
            >
              <StartingTemplateIcon
                templateKey={template.key}
                className="h-5 w-5 shrink-0 text-muted-foreground"
              />
              <span className="min-w-0 flex-1 font-medium">{template.labelDe}</span>
              <Tooltip pinOnClick={false}>
                <TooltipTrigger asChild>
                  <span
                    role="img"
                    aria-label={`${template.labelDe} erklären`}
                    data-testid={`starting-template-help-${template.key}`}
                    className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                    onClick={stopHelpEvent}
                    onPointerDown={stopHelpEvent}
                  >
                    <Question className="pointer-events-none size-3.5" aria-hidden />
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="left"
                  sideOffset={8}
                  className="max-w-[280px] text-left text-xs leading-relaxed"
                >
                  {template.summaryDe}
                </TooltipContent>
              </Tooltip>
              <span className="shrink-0 text-xs text-muted-foreground">Stufe 1</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
