/**
 * ItemLibraryCard — list/grid row for a Library Items definition (#138/#140).
 * Resolves thumbnail2d assetKey when present; otherwise type/icon fallback.
 * Corner ⋮ is always available (copy ID / fork personal / archive when allowed).
 * Location: src/app/library/items/ItemLibraryCard.tsx
 */
import { useCallback, useState } from 'react';
import {
  Archive,
  Copy,
  CopySimple
} from '@phosphor-icons/react';
import type { ItemDefinition } from '../../../domains/items';
import {
  librarySourceFromOrigin,
  normalizeItemDefinition,
} from '../../../domains/items';
import { InventoryItemThumb } from '../../character';
import { Badge } from '../../../shared/ui/badge';
import { cn } from '../../../shared/ui/utils';
import { useItemThumbnailSrc } from '../../items';
import {
  ITEM_CONTEXT_LABELS,
  ITEM_KIND_LABELS,
  ITEM_SETTING_LABELS,
  LIBRARY_SOURCE_LABELS,
  type ItemLibraryViewMode,
} from './itemLibraryLabels';
import {
  copyPublicIdMenuLabel,
  EntityBrowserCornerMenuPortal,
  EntityBrowserCornerMenuTrigger,
  type EntityBrowserCornerMenuAnchor,
} from '../EntityBrowserCornerMenu';
import { copyLibraryField } from '../copyLibraryField';
import {
  SAGATREE_NATIVE_BADGE_CLASS,
  SAGATREE_NATIVE_BADGE_LABEL,
} from '../libraryNativeBadge';

export interface ItemLibraryCardProps {
  definition: ItemDefinition;
  viewMode: ItemLibraryViewMode;
  onOpen: () => void;
  /** Fork to personal — offered for Core/World/Personal. */
  onDuplicate?: () => void;
  /** Soft-delete — Personal/World only. */
  onArchive?: () => void;
  busy?: boolean;
}

function thumbSlot(definition: ItemDefinition): 'mainHand' | 'body' | 'special' {
  const first = definition.equipSlots?.[0];
  if (first === 'mainHand' || first === 'offHand') return 'mainHand';
  if (first === 'body' || first === 'head' || first === 'feet') return 'body';
  return 'special';
}

function metaLine(definition: ItemDefinition): string {
  const normalized = normalizeItemDefinition(definition);
  const kind = normalized.kindKey
    ? ITEM_KIND_LABELS[normalized.kindKey]
    : normalized.type;
  const settings = (normalized.settingTags ?? [])
    .map((tag) => ITEM_SETTING_LABELS[tag])
    .filter(Boolean);
  const contexts = (normalized.contexts ?? [])
    .slice(0, 2)
    .map((ctx) => ITEM_CONTEXT_LABELS[ctx])
    .filter(Boolean);
  const parts = [kind, ...settings, ...contexts];
  return parts.join(' · ');
}

function mechanicsHint(definition: ItemDefinition): string | null {
  const bits: string[] = [];
  if (definition.damage) bits.push(definition.damage);
  if (definition.protection != null) bits.push(`Schutz ${definition.protection}`);
  if (bits.length === 0) return null;
  return bits.join(' · ');
}

export function ItemLibraryCard({
  definition,
  viewMode,
  onOpen,
  onDuplicate,
  onArchive,
  busy = false,
}: ItemLibraryCardProps) {
  const normalized = normalizeItemDefinition(definition);
  const source = librarySourceFromOrigin(normalized.origin);
  const isNativeCatalog = source === 'core' || source === 'standard';
  const sourceLabel = isNativeCatalog
    ? SAGATREE_NATIVE_BADGE_LABEL
    : LIBRARY_SOURCE_LABELS[source];
  const mechanics = mechanicsHint(normalized);
  const isGrid = viewMode === 'grid';
  const assetSrc = useItemThumbnailSrc(normalized.assetKey);
  const publicId = normalized.publicId;
  const menuKey = publicId || normalized.id;
  const [menuAnchor, setMenuAnchor] = useState<EntityBrowserCornerMenuAnchor | null>(null);

  const toggleMenu = useCallback(
    (rect: DOMRect, triggerEl: HTMLElement) => {
      setMenuAnchor((prev) =>
        prev?.menuKey === menuKey && prev.triggerEl === triggerEl
          ? null
          : { menuKey, top: rect.bottom + 4, left: rect.right - 224, triggerEl },
      );
    },
    [menuKey],
  );

  return (
    <div
      className={cn(
        'group relative w-full min-h-11 rounded-lg border border-border bg-card text-left transition-colors',
        'hover:border-primary/40 hover:bg-muted/40',
        isGrid ? 'flex flex-col gap-2 p-3' : 'flex items-center gap-3 p-2.5 sm:p-3',
      )}
      data-item-library-card={normalized.id}
      data-item-source={source}
    >
      <div
        className={cn('absolute z-10', isGrid ? 'right-2 top-2' : 'right-2 top-2')}
        data-entity-browser-corner-action
      >
        <EntityBrowserCornerMenuTrigger
          compact
          busy={busy}
          label={`Aktionen für ${normalized.name}`}
          menuKey={menuKey}
          open={menuAnchor?.menuKey === menuKey}
          onToggle={toggleMenu}
          dataAttr="library-item-menu"
        />
      </div>

      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex min-w-0 flex-1 gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary',
          isGrid && 'flex-col gap-2',
        )}
        aria-label={`${normalized.name}, ${sourceLabel}`}
      >
        <div
          className={cn(
            'shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted/50',
            isGrid ? 'aspect-square w-full' : 'size-12 sm:size-14',
          )}
        >
          <InventoryItemThumb
            slot={thumbSlot(normalized)}
            definition={normalized}
            assetSrc={assetSrc}
            alt={`Vorschaubild ${normalized.name}`}
            className="size-full"
          />
        </div>

        <div className={cn('min-w-0 flex-1 pr-10', isGrid && 'space-y-1')}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-medium leading-snug sm:text-base">
              {normalized.name}
            </h3>
            <Badge
              variant="outline"
              className={cn(
                'shrink-0 text-[10px] sm:text-xs',
                isNativeCatalog && SAGATREE_NATIVE_BADGE_CLASS,
              )}
            >
              {sourceLabel}
            </Badge>
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground sm:text-sm">
            {metaLine(normalized)}
          </p>
          {mechanics ? (
            <p className="truncate text-[11px] text-muted-foreground/90 sm:text-xs">
              {mechanics}
            </p>
          ) : null}
        </div>
      </button>

      {menuAnchor ? (
        <EntityBrowserCornerMenuPortal
          anchor={menuAnchor}
          busy={busy}
          dataAttr="library-item-menu"
          contentDataAttr="library-item-menu-content"
          onClose={() => setMenuAnchor(null)}
          items={[
            {
              id: 'copy-id',
              label: copyPublicIdMenuLabel('Item-ID', publicId),
              icon: <Copy className="size-4 shrink-0" aria-hidden="true" />,
              disabled: !publicId,
              onSelect: () => void copyLibraryField('Item-ID', publicId ?? ''),
            },
            ...(onDuplicate
              ? [
                  {
                    id: 'duplicate',
                    label: 'Item duplizieren',
                    icon: <CopySimple className="size-4 shrink-0" aria-hidden="true" />,
                    onSelect: onDuplicate,
                  },
                ]
              : []),
            ...(onArchive
              ? [
                  {
                    id: 'archive',
                    label: 'Item archivieren',
                    icon: <Archive className="size-4 shrink-0" aria-hidden="true" />,
                    destructive: true,
                    separatorBefore: true,
                    onSelect: onArchive,
                  },
                ]
              : []),
          ]}
        />
      ) : null}
    </div>
  );
}
