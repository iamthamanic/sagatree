/**
 * ItemLibraryFilters — Typ/Setting/Kontext/Quelle/Pack multi-select controls (#138).
 * Active selections are also shown as removable chips (not color-only).
 * Location: src/app/library/items/ItemLibraryFilters.tsx
 */
import type { ReactNode } from 'react';
import {
  X
} from '@phosphor-icons/react';
import {
  ITEM_CONTEXTS,
  ITEM_KIND_KEYS,
  ITEM_SETTING_TAGS,
  listBaseItemPacks,
  listContextItemPacks,
  type ItemContext,
  type ItemKindKey,
  type ItemLibraryFilters as ItemLibraryFiltersState,
  type ItemSettingTag,
  type LibraryItemSource,
} from '../../../domains/items';
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
import {
  ITEM_CONTEXT_LABELS,
  ITEM_KIND_LABELS,
  ITEM_SETTING_LABELS,
  LIBRARY_SOURCE_LABELS,
} from './itemLibraryLabels';

const SOURCE_OPTIONS: readonly LibraryItemSource[] = [
  'core',
  'standard',
  'personal',
  'world',
];

export interface ItemLibraryFiltersProps {
  filters: ItemLibraryFiltersState;
  onChange: (next: ItemLibraryFiltersState) => void;
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

export function ItemLibraryFiltersBar({
  filters,
  onChange,
  onReset,
  showReset,
}: ItemLibraryFiltersProps) {
  const packs = [...listBaseItemPacks(), ...listContextItemPacks()];

  const chips: { key: string; label: string; remove: () => void }[] = [
    ...filters.kinds.map((kind) => ({
      key: `kind:${kind}`,
      label: `Typ: ${ITEM_KIND_LABELS[kind]}`,
      remove: () =>
        onChange({ ...filters, kinds: filters.kinds.filter((k) => k !== kind) }),
    })),
    ...filters.settings.map((setting) => ({
      key: `setting:${setting}`,
      label: `Setting: ${ITEM_SETTING_LABELS[setting]}`,
      remove: () =>
        onChange({
          ...filters,
          settings: filters.settings.filter((s) => s !== setting),
        }),
    })),
    ...filters.contexts.map((context) => ({
      key: `context:${context}`,
      label: `Kontext: ${ITEM_CONTEXT_LABELS[context]}`,
      remove: () =>
        onChange({
          ...filters,
          contexts: filters.contexts.filter((c) => c !== context),
        }),
    })),
    ...filters.sources.map((source) => ({
      key: `source:${source}`,
      label: `Quelle: ${LIBRARY_SOURCE_LABELS[source]}`,
      remove: () =>
        onChange({
          ...filters,
          sources: filters.sources.filter((s) => s !== source),
        }),
    })),
    ...filters.packIds.map((packId) => {
      const pack = packs.find((entry) => entry.id === packId);
      return {
        key: `pack:${packId}`,
        label: `Pack: ${pack?.name ?? packId}`,
        remove: () =>
          onChange({
            ...filters,
            packIds: filters.packIds.filter((id) => id !== packId),
          }),
      };
    }),
  ];

  return (
    <div className="space-y-3" data-item-library-filters>
      <div className="flex flex-wrap gap-2 md:gap-3">
        <FilterSelect
          id="item-library-filter-kind"
          label="Typ"
          placeholder="Typ wählen"
          selectKey={`kind:${filters.kinds.join(',')}`}
          onPick={(value) =>
            onChange({
              ...filters,
              kinds: toggleValue(filters.kinds, value as ItemKindKey),
            })
          }
        >
          {ITEM_KIND_KEYS.map((kind) => (
            <SelectItem key={kind} value={kind}>
              {ITEM_KIND_LABELS[kind]}
              {filters.kinds.includes(kind) ? ' ✓' : ''}
            </SelectItem>
          ))}
        </FilterSelect>

        <FilterSelect
          id="item-library-filter-setting"
          label="Setting"
          placeholder="Setting wählen"
          selectKey={`setting:${filters.settings.join(',')}`}
          onPick={(value) =>
            onChange({
              ...filters,
              settings: toggleValue(filters.settings, value as ItemSettingTag),
            })
          }
        >
          {ITEM_SETTING_TAGS.map((setting) => (
            <SelectItem key={setting} value={setting}>
              {ITEM_SETTING_LABELS[setting]}
              {filters.settings.includes(setting) ? ' ✓' : ''}
            </SelectItem>
          ))}
        </FilterSelect>

        <FilterSelect
          id="item-library-filter-context"
          label="Kontext"
          placeholder="Kontext wählen"
          selectKey={`context:${filters.contexts.join(',')}`}
          onPick={(value) =>
            onChange({
              ...filters,
              contexts: toggleValue(filters.contexts, value as ItemContext),
            })
          }
        >
          {ITEM_CONTEXTS.map((context) => (
            <SelectItem key={context} value={context}>
              {ITEM_CONTEXT_LABELS[context]}
              {filters.contexts.includes(context) ? ' ✓' : ''}
            </SelectItem>
          ))}
        </FilterSelect>

        <FilterSelect
          id="item-library-filter-source"
          label="Quelle"
          placeholder="Quelle wählen"
          selectKey={`source:${filters.sources.join(',')}`}
          onPick={(value) =>
            onChange({
              ...filters,
              sources: toggleValue(filters.sources, value as LibraryItemSource),
            })
          }
        >
          {SOURCE_OPTIONS.map((source) => (
            <SelectItem key={source} value={source}>
              {LIBRARY_SOURCE_LABELS[source]}
              {filters.sources.includes(source) ? ' ✓' : ''}
            </SelectItem>
          ))}
        </FilterSelect>

        <FilterSelect
          id="item-library-filter-pack"
          label="Pack"
          placeholder="Pack wählen"
          selectKey={`pack:${filters.packIds.join(',')}`}
          onPick={(value) =>
            onChange({
              ...filters,
              packIds: toggleValue(filters.packIds, value),
            })
          }
        >
          {packs.map((pack) => (
            <SelectItem key={pack.id} value={pack.id}>
              {pack.name}
              {filters.packIds.includes(pack.id) ? ' ✓' : ''}
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
