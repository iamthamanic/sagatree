/**
 * ItemLibraryToolbar — result count + Liste/Grid/Karussell + primary create CTA (#138).
 * Location: src/app/library/items/ItemLibraryToolbar.tsx
 */
import {
  Plus
} from '@phosphor-icons/react';
import { Button } from '../../../shared/ui/button';
import { LibraryViewModeToggle } from '../LibraryViewModeToggle';
import type { LibraryViewMode } from '../useLibraryViewMode';

export interface ItemLibraryToolbarProps {
  resultCount: number;
  totalCount: number;
  hasActiveFilters: boolean;
  viewMode: LibraryViewMode;
  onViewModeChange: (mode: LibraryViewMode) => void;
  onCreate: () => void;
}

export function ItemLibraryToolbar({
  resultCount,
  totalCount,
  hasActiveFilters,
  viewMode,
  onViewModeChange,
  onCreate,
}: ItemLibraryToolbarProps) {
  const countLabel = hasActiveFilters
    ? `${resultCount} von ${totalCount} Gegenständen`
    : `${resultCount} Gegenstand${resultCount === 1 ? '' : 'e'}`;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3"
      data-item-library-toolbar
    >
      <p className="min-w-0 flex-1 text-sm text-muted-foreground">{countLabel}</p>

      <div className="flex items-center gap-2">
        <LibraryViewModeToggle
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          size="comfortable"
        />

        <Button
          type="button"
          size="sm"
          className="h-11 min-h-11"
          onClick={onCreate}
          data-item-library-create
        >
          <Plus className="mr-2 size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Neues Item erstellen</span>
          <span className="sm:hidden">Neu</span>
        </Button>
      </div>
    </div>
  );
}
