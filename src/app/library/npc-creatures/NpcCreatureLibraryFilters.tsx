/**
 * NpcCreatureLibraryFilters — primary kind + secondary multi-select filters (#197).
 * Location: src/app/library/npc-creatures/NpcCreatureLibraryFilters.tsx
 */
import type { ReactNode } from 'react';
import {
  X
} from '@phosphor-icons/react';
import {
  LIBRARY_NPC_CREATURE_SOURCES,
  NPC_CREATURE_CATEGORIES,
  NPC_CREATURE_SHEET_MODES,
  type LibraryNpcCreatureSource,
  type NpcCreatureCategory,
  type NpcCreatureLibraryFilters as NpcCreatureLibraryFiltersState,
  type NpcCreatureLibraryKindFilter,
  type NpcCreatureSheetMode,
} from '../../../domains/npc-creature';
import type {
  SagaTreeCombatRole,
  SagaTreeMachtgrad,
} from '../../../domains/rules/sagatree/npc-creature-power';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import { Label } from '../../../shared/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select';
import { cn } from '../../../shared/ui/utils';
import {
  LIBRARY_NPC_SOURCE_LABELS,
  NPC_COMBAT_ROLE_LABELS,
  NPC_CREATURE_CATEGORY_LABELS,
  NPC_CREATURE_SHEET_MODE_LABELS,
  NPC_MACHTGRAD_LABELS,
} from './npcCreatureLibraryLabels';

const KIND_OPTIONS: readonly { value: NpcCreatureLibraryKindFilter; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'npc', label: 'NPCs' },
  { value: 'creature', label: 'Kreaturen' },
];

const COMBAT_ROLES: readonly SagaTreeCombatRole[] = ['standard', 'elite', 'boss'];
const MACHTGRADE: readonly SagaTreeMachtgrad[] = [
  'gering',
  'mittel',
  'hoch',
  'extrem',
  'legendaer',
];

export interface NpcCreatureLibraryFiltersProps {
  filters: NpcCreatureLibraryFiltersState;
  onChange: (next: NpcCreatureLibraryFiltersState) => void;
  onReset: () => void;
  showReset: boolean;
}

function toggleValue<T extends string>(
  values: readonly T[],
  value: T,
): readonly T[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

function FilterSelect({
  id,
  label,
  placeholder,
  selectKey,
  onPick,
  children,
}: {
  id: string;
  label: string;
  placeholder: string;
  selectKey: string;
  onPick: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="min-w-[9.5rem] flex-1 space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select
        key={selectKey}
        onValueChange={(value) => {
          if (value) onPick(value);
        }}
      >
        <SelectTrigger
          id={id}
          className="h-11 min-h-11"
          aria-label={`${label} hinzufügen`}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

export function NpcCreatureLibraryFiltersBar({
  filters,
  onChange,
  onReset,
  showReset,
}: NpcCreatureLibraryFiltersProps) {
  const chips: { key: string; label: string; remove: () => void }[] = [
    ...filters.categories.map((category) => ({
      key: `category:${category}`,
      label: `Kategorie: ${NPC_CREATURE_CATEGORY_LABELS[category]}`,
      remove: () =>
        onChange({
          ...filters,
          categories: filters.categories.filter((entry) => entry !== category),
        }),
    })),
    ...filters.machtgrade.map((machtgrad) => ({
      key: `machtgrad:${machtgrad}`,
      label: `Machtgrad: ${NPC_MACHTGRAD_LABELS[machtgrad]}`,
      remove: () =>
        onChange({
          ...filters,
          machtgrade: filters.machtgrade.filter((entry) => entry !== machtgrad),
        }),
    })),
    ...filters.combatRoles.map((role) => ({
      key: `role:${role}`,
      label: `Kampfrolle: ${NPC_COMBAT_ROLE_LABELS[role]}`,
      remove: () =>
        onChange({
          ...filters,
          combatRoles: filters.combatRoles.filter((entry) => entry !== role),
        }),
    })),
    ...filters.sheetModes.map((mode) => ({
      key: `sheet:${mode}`,
      label: `Darstellung: ${NPC_CREATURE_SHEET_MODE_LABELS[mode]}`,
      remove: () =>
        onChange({
          ...filters,
          sheetModes: filters.sheetModes.filter((entry) => entry !== mode),
        }),
    })),
    ...filters.sources.map((source) => ({
      key: `source:${source}`,
      label: `Quelle: ${LIBRARY_NPC_SOURCE_LABELS[source]}`,
      remove: () =>
        onChange({
          ...filters,
          sources: filters.sources.filter((entry) => entry !== source),
        }),
    })),
  ];

  return (
    <div className="space-y-3" data-npc-library-filters>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Primärfilter Art"
      >
        {KIND_OPTIONS.map((option) => {
          const selected = filters.kind === option.value;
          return (
            <Button
              key={option.value}
              type="button"
              variant={selected ? 'default' : 'outline'}
              size="sm"
              className={cn('h-11 min-h-11 min-w-11 px-4', selected && 'shadow-sm')}
              aria-pressed={selected}
              onClick={() => onChange({ ...filters, kind: option.value })}
              data-npc-kind-filter={option.value}
            >
              {option.label}
            </Button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 md:gap-3">
        <FilterSelect
          id="npc-library-filter-category"
          label="Kategorie"
          placeholder="Kategorie wählen"
          selectKey={`category:${filters.categories.join(',')}`}
          onPick={(value) =>
            onChange({
              ...filters,
              categories: toggleValue(
                filters.categories,
                value as NpcCreatureCategory,
              ),
            })
          }
        >
          {NPC_CREATURE_CATEGORIES.map((category) => (
            <SelectItem key={category} value={category}>
              {NPC_CREATURE_CATEGORY_LABELS[category]}
              {filters.categories.includes(category) ? ' ✓' : ''}
            </SelectItem>
          ))}
        </FilterSelect>

        <FilterSelect
          id="npc-library-filter-machtgrad"
          label="Machtgrad"
          placeholder="Machtgrad wählen"
          selectKey={`machtgrad:${filters.machtgrade.join(',')}`}
          onPick={(value) =>
            onChange({
              ...filters,
              machtgrade: toggleValue(
                filters.machtgrade,
                value as SagaTreeMachtgrad,
              ),
            })
          }
        >
          {MACHTGRADE.map((machtgrad) => (
            <SelectItem key={machtgrad} value={machtgrad}>
              {NPC_MACHTGRAD_LABELS[machtgrad]}
              {filters.machtgrade.includes(machtgrad) ? ' ✓' : ''}
            </SelectItem>
          ))}
        </FilterSelect>

        <FilterSelect
          id="npc-library-filter-role"
          label="Kampfrolle"
          placeholder="Kampfrolle wählen"
          selectKey={`role:${filters.combatRoles.join(',')}`}
          onPick={(value) =>
            onChange({
              ...filters,
              combatRoles: toggleValue(
                filters.combatRoles,
                value as SagaTreeCombatRole,
              ),
            })
          }
        >
          {COMBAT_ROLES.map((role) => (
            <SelectItem key={role} value={role}>
              {NPC_COMBAT_ROLE_LABELS[role]}
              {filters.combatRoles.includes(role) ? ' ✓' : ''}
            </SelectItem>
          ))}
        </FilterSelect>

        <FilterSelect
          id="npc-library-filter-sheet"
          label="Darstellung"
          placeholder="Darstellung wählen"
          selectKey={`sheet:${filters.sheetModes.join(',')}`}
          onPick={(value) =>
            onChange({
              ...filters,
              sheetModes: toggleValue(
                filters.sheetModes,
                value as NpcCreatureSheetMode,
              ),
            })
          }
        >
          {NPC_CREATURE_SHEET_MODES.map((mode) => (
            <SelectItem key={mode} value={mode}>
              {NPC_CREATURE_SHEET_MODE_LABELS[mode]}
              {filters.sheetModes.includes(mode) ? ' ✓' : ''}
            </SelectItem>
          ))}
        </FilterSelect>

        <FilterSelect
          id="npc-library-filter-source"
          label="Quelle"
          placeholder="Quelle wählen"
          selectKey={`source:${filters.sources.join(',')}`}
          onPick={(value) =>
            onChange({
              ...filters,
              sources: toggleValue(
                filters.sources,
                value as LibraryNpcCreatureSource,
              ),
            })
          }
        >
          {LIBRARY_NPC_CREATURE_SOURCES.map((source) => (
            <SelectItem key={source} value={source}>
              {LIBRARY_NPC_SOURCE_LABELS[source]}
              {filters.sources.includes(source) ? ' ✓' : ''}
            </SelectItem>
          ))}
        </FilterSelect>
      </div>

      {chips.length > 0 || showReset ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Aktive Filter">
          {chips.map((chip) => (
            <Badge key={chip.key} variant="secondary" className="gap-1 pr-1 text-xs">
              <span>{chip.label}</span>
              <button
                type="button"
                className="inline-flex size-11 min-h-11 min-w-11 items-center justify-center rounded-sm hover:bg-muted"
                aria-label={`${chip.label} entfernen`}
                onClick={chip.remove}
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </Badge>
          ))}
          {showReset ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-11 min-h-11 px-3"
              onClick={onReset}
            >
              Filter zurücksetzen
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
