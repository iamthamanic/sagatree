/**
 * SpeciesTraitOptionItem — Select-Option mit Beschreibung am Eintrag.
 * Label geht in ItemText (Trigger); Beschreibung bleibt nur in der offenen Liste sichtbar.
 * Location: src/app/character/creation/SpeciesTraitOptionItem.tsx
 */
import * as SelectPrimitive from '@radix-ui/react-select@2.1.6';
import {
  Check
} from '@phosphor-icons/react';
import { cn } from '../../../shared/ui/utils';
import type { SagaTreeSpeciesTraitOption } from '../../../domains/rules/sagatree/species-trait-options';

type SpeciesTraitOptionItemProps = {
  option: SagaTreeSpeciesTraitOption;
  disabled?: boolean;
};

export function SpeciesTraitOptionItem({ option, disabled = false }: SpeciesTraitOptionItemProps) {
  return (
    <SelectPrimitive.Item
      value={option.value}
      textValue={option.label}
      disabled={disabled}
      title={option.description}
      className={cn(
        'focus:bg-accent/10 focus:text-foreground data-[state=checked]:bg-accent/10 data-[state=checked]:text-foreground relative flex w-full cursor-default items-start gap-2 rounded-md py-2 pr-8 pl-2.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      )}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
        <span className="block whitespace-normal text-xs leading-snug text-muted-foreground">
          {option.description}
        </span>
      </div>
      <span className="absolute right-2 top-2.5 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}
