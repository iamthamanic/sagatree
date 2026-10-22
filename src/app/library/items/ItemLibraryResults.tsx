/**
 * ItemLibraryResults — list/grid results, skeletons, empty and error states (#138).
 * Location: src/app/library/items/ItemLibraryResults.tsx
 */
import {
  Package,
  ArrowsClockwise
} from '@phosphor-icons/react';
import type { ItemDefinition } from '../../../domains/items';
import { Button } from '../../../shared/ui/button';
import { cn } from '../../../shared/ui/utils';
import { ItemLibraryCard } from './ItemLibraryCard';
import type { ItemLibraryViewMode } from './itemLibraryLabels';

export interface ItemLibraryResultsProps {
  items: ItemDefinition[];
  viewMode: ItemLibraryViewMode;
  isLoading: boolean;
  error: string | null;
  hasActiveFilters: boolean;
  catalogEmpty: boolean;
  onOpenItem: (id: string) => void;
  onResetFilters: () => void;
  onRetry: () => void;
  busyItemId?: string | null;
  onDuplicateItem?: (item: ItemDefinition) => void;
  onArchiveItem?: (item: ItemDefinition) => void;
}

function SkeletonRow({ viewMode }: { viewMode: ItemLibraryViewMode }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg border border-border bg-muted/40',
        viewMode === 'grid' ? 'aspect-[4/5] w-full' : 'h-16 w-full',
      )}
      aria-hidden="true"
    />
  );
}

export function ItemLibraryResults({
  items,
  viewMode,
  isLoading,
  error,
  hasActiveFilters,
  catalogEmpty,
  onOpenItem,
  onResetFilters,
  onRetry,
  busyItemId = null,
  onDuplicateItem,
  onArchiveItem,
}: ItemLibraryResultsProps) {
  if (error) {
    return (
      <div
        className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-10 text-center"
        role="alert"
        data-item-library-error
      >
        <p className="mb-4 text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" className="h-11 min-h-11" onClick={onRetry}>
          <ArrowsClockwise className="mr-2 size-4" aria-hidden="true" />
          Erneut versuchen
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className={cn(
          viewMode === 'grid'
            ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'
            : 'space-y-2',
        )}
        aria-busy="true"
        aria-label="Gegenstände werden geladen"
        data-item-library-loading
      >
        {Array.from({ length: viewMode === 'grid' ? 8 : 5 }).map((_, index) => (
          <SkeletonRow key={index} viewMode={viewMode} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="px-4 py-12 text-center" data-item-library-empty>
        <Package className="mx-auto mb-4 size-12 text-muted-foreground" aria-hidden="true" />
        {hasActiveFilters ? (
          <>
            <p className="mb-4 text-muted-foreground">Keine Treffer für Suche und Filter</p>
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-11"
              onClick={onResetFilters}
            >
              Filter zurücksetzen
            </Button>
          </>
        ) : catalogEmpty ? (
          <p className="text-muted-foreground">Noch keine Gegenstände verfügbar</p>
        ) : (
          <p className="text-muted-foreground">Keine Gegenstände gefunden</p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        viewMode === 'grid'
          ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'
          : 'space-y-2',
      )}
      data-item-library-results
      data-view-mode={viewMode}
    >
      {items.map((item) => {
        const canArchive = item.scope === 'personal' || item.scope === 'world';
        return (
          <ItemLibraryCard
            key={item.id}
            definition={item}
            viewMode={viewMode}
            onOpen={() => onOpenItem(item.id)}
            busy={busyItemId === item.id}
            onDuplicate={
              onDuplicateItem ? () => onDuplicateItem(item) : undefined
            }
            onArchive={
              canArchive && onArchiveItem ? () => onArchiveItem(item) : undefined
            }
          />
        );
      })}
    </div>
  );
}
