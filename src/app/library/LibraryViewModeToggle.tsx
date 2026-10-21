/**
 * LibraryViewModeToggle — Liste / Grid / Karussell control for all Library tabs.
 * Location: src/app/library/LibraryViewModeToggle.tsx
 */
import {
  SquaresFour,
  List
} from '@phosphor-icons/react';
import { Button } from '../../shared/ui/button';
import { cn } from '../../shared/ui/utils';
import type { LibraryViewMode } from './useLibraryViewMode';

function CarouselViewModeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="size-4"
      aria-hidden="true"
    >
      <rect x="1" y="4" width="3" height="8" rx="0.5" fill="currentColor" opacity="0.6" />
      <rect x="6" y="2" width="4" height="12" rx="0.5" fill="currentColor" />
      <rect x="12" y="4" width="3" height="8" rx="0.5" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

export interface LibraryViewModeToggleProps {
  viewMode: LibraryViewMode;
  onViewModeChange: (mode: LibraryViewMode) => void;
  /** Touch-friendly (h-11) vs compact toolbar (h-8). Default compact. */
  size?: 'compact' | 'comfortable';
}

export function LibraryViewModeToggle({
  viewMode,
  onViewModeChange,
  size = 'compact',
}: LibraryViewModeToggleProps) {
  const btn =
    size === 'comfortable'
      ? 'h-11 min-h-11 w-11 min-w-11 p-0'
      : 'h-8 w-8 p-0';

  return (
    <div
      className="flex items-center gap-1 rounded-lg border p-1"
      role="group"
      aria-label="Ansicht wählen"
      data-library-view-mode-toggle
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Listenansicht"
        aria-pressed={viewMode === 'list'}
        onClick={() => onViewModeChange('list')}
        className={cn(btn, viewMode === 'list' && 'bg-background shadow-sm')}
      >
        <List className="size-4" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Grid-Ansicht"
        aria-pressed={viewMode === 'grid'}
        onClick={() => onViewModeChange('grid')}
        className={cn(btn, viewMode === 'grid' && 'bg-background shadow-sm')}
      >
        <SquaresFour className="size-4" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Karussell-Ansicht"
        aria-pressed={viewMode === 'carousel'}
        onClick={() => onViewModeChange('carousel')}
        className={cn(btn, viewMode === 'carousel' && 'bg-background shadow-sm')}
      >
        <CarouselViewModeIcon />
      </Button>
    </div>
  );
}
