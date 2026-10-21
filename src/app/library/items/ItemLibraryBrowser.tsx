/**
 * ItemLibraryBrowser — public Library Items tab entry (#138).
 * Composes search, filters, and EntityBrowser (list/grid/carousel); navigates via
 * callbacks from App shell routing (single useAppLocation owner). No item
 * business rules beyond presentation wiring.
 * Location: src/app/library/items/ItemLibraryBrowser.tsx
 */
import { useState } from 'react';
import {
  Package,
  Plus,
  ArrowsClockwise,
  MagnifyingGlass
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { ItemDefinition } from '../../../domains/items';
import {
  archiveDefinition,
  forkDefinition,
} from '../../../infrastructure/inventory/item-catalog-service';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { EntityBrowser } from '../EntityBrowser';
import { ItemLibraryCard } from './ItemLibraryCard';
import { ItemLibraryFiltersBar } from './ItemLibraryFilters';
import { ITEM_LIBRARY_VIEW_MODE_STORAGE_KEY } from './itemLibraryLabels';
import { useItemLibrary } from './useItemLibrary';

export interface ItemLibraryBrowserProps {
  enabled?: boolean;
  /** Navigate to `/items/create` via shell routing. */
  onCreateItem: () => void;
  /** Navigate to `/items/:id` via shell routing. */
  onOpenItem: (itemId: string) => void;
}

export function ItemLibraryBrowser({
  enabled = true,
  onCreateItem,
  onOpenItem,
}: ItemLibraryBrowserProps) {
  const library = useItemLibrary({ enabled });
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const handleDuplicateItem = async (item: ItemDefinition) => {
    setBusyItemId(item.id);
    try {
      const created = await forkDefinition(item.id, { scope: 'personal' });
      toast.success(
        `Item dupliziert${created.publicId ? ` (${created.publicId})` : ''}`,
      );
      library.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Duplizieren fehlgeschlagen');
    } finally {
      setBusyItemId(null);
    }
  };

  const handleArchiveItem = async (item: ItemDefinition) => {
    if (!confirm(`„${item.name}“ archivieren?`)) return;
    setBusyItemId(item.id);
    try {
      await archiveDefinition(item.id);
      toast.success('Item archiviert');
      library.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Archivieren fehlgeschlagen');
    } finally {
      setBusyItemId(null);
    }
  };

  const showResults =
    !library.isLoading && !library.error && library.filteredItems.length > 0;

  return (
    <div className="space-y-4" data-item-library-browser>
      <div className="relative">
        <MagnifyingGlass
          className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Gegenstände suchen…"
          value={library.searchQuery}
          onChange={(event) => library.setSearchQuery(event.target.value)}
          className="h-11 min-h-11 pl-10"
          aria-label="Gegenstände suchen"
          data-item-library-search
        />
      </div>

      <ItemLibraryFiltersBar
        filters={library.filters}
        onChange={library.setFilters}
        onReset={library.resetFilters}
        showReset={library.hasActiveFilters}
      />

      {!showResults ? (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            className="h-11 min-h-11"
            onClick={onCreateItem}
            data-item-library-create
          >
            <Plus className="mr-2 size-4" aria-hidden="true" />
            Neues Item erstellen
          </Button>
        </div>
      ) : null}

      {library.isLoading ? (
        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          aria-busy="true"
          aria-label="Gegenstände werden geladen"
          data-item-library-loading
        >
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="aspect-[4/5] w-full animate-pulse rounded-lg border border-border bg-muted/40"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : null}

      {library.error ? (
        <div
          className="flex flex-col items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-8 text-center"
          role="alert"
          data-item-library-error
        >
          <p className="text-sm text-destructive">{library.error}</p>
          <Button type="button" variant="outline" size="sm" onClick={library.refresh}>
            <ArrowsClockwise className="mr-2 size-4" aria-hidden="true" />
            Erneut versuchen
          </Button>
        </div>
      ) : null}

      {!library.isLoading && !library.error && library.filteredItems.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center"
          data-item-library-empty
        >
          <Package className="size-10 text-muted-foreground" aria-hidden="true" />
          {library.hasActiveFilters ? (
            <>
              <p className="text-muted-foreground">Keine Treffer für Suche und Filter</p>
              <Button type="button" variant="outline" size="sm" onClick={library.resetFilters}>
                Filter zurücksetzen
              </Button>
            </>
          ) : library.items.length === 0 ? (
            <p className="text-muted-foreground">Noch keine Gegenstände verfügbar</p>
          ) : (
            <p className="text-muted-foreground">Keine Gegenstände gefunden</p>
          )}
        </div>
      ) : null}

      {showResults ? (
        <div data-item-library-results>
          <EntityBrowser
            storageKey={ITEM_LIBRARY_VIEW_MODE_STORAGE_KEY}
            items={library.filteredItems}
            getId={(item) => item.id}
            onOpenItem={(item) => onOpenItem(item.id)}
            toolbarLeft={
              library.hasActiveFilters
                ? `${library.filteredItems.length} von ${library.items.length} Gegenständen`
                : `${library.filteredItems.length} Gegenstand${library.filteredItems.length === 1 ? '' : 'e'}`
            }
            toolbarRight={
              <Button
                type="button"
                size="sm"
                className="h-8"
                onClick={onCreateItem}
                data-item-library-create
                aria-label="Neues Item erstellen"
              >
                <Plus className="mr-1 size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Neues Item erstellen</span>
                <span className="sm:hidden">Neu</span>
              </Button>
            }
            renderItem={(item, context) => (
              <ItemLibraryCard
                definition={item}
                viewMode={context.variant === 'list' ? 'list' : 'grid'}
                onOpen={() => onOpenItem(item.id)}
                busy={busyItemId === item.id}
                onDuplicate={() => void handleDuplicateItem(item)}
                onArchive={
                  item.scope === 'personal' || item.scope === 'world'
                    ? () => void handleArchiveItem(item)
                    : undefined
                }
              />
            )}
          />
        </div>
      ) : null}
    </div>
  );
}
