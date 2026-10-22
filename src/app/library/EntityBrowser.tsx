/**
 * EntityBrowser — shared browse shell for Library entity tabs.
 * Cover-flow rules:
 * - 1 item: exact, no loop
 * - 2 items: exact slides + wrap nav (no Embla loop clones — those peek as a 3rd card)
 * - ≥3: minimal pad + Embla loop for endless scroll; start mid-pack centered
 * Location: src/app/library/EntityBrowser.tsx
 */
import { useRef, type ReactNode } from 'react';
import {
  CaretLeft,
  CaretRight
} from '@phosphor-icons/react';
import { Button } from '../../shared/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '../../shared/ui/carousel';
import {
  CENTER_FOCUS_LIBRARY_SLIDE_BASIS_CLASS,
  expandSlidesForEmblaLoop,
  useCenterFocusCarousel,
  type EmblaLoopSlidePack,
} from '../../shared/carousel';
import { cn } from '../../shared/ui/utils';
import { LibraryViewModeToggle } from './LibraryViewModeToggle';
import {
  useLibraryViewMode,
  type LibraryViewMode,
} from './useLibraryViewMode';

export type EntityBrowserViewMode = LibraryViewMode;

export type EntityBrowserRenderContext = {
  variant: EntityBrowserViewMode;
  isCenter: boolean;
  /** Carousel: side card click scrolls to center, center card click activates. List/grid: activates. */
  onActivate: () => void;
};

type EntityBrowserProps<T extends { id: string }> = {
  storageKey: string;
  items: T[];
  getId: (item: T) => string;
  renderItem: (item: T, context: EntityBrowserRenderContext) => ReactNode;
  onOpenItem?: (item: T) => void;
  toolbarLeft?: ReactNode;
  toolbarRight?: ReactNode;
  emptyState?: ReactNode;
};

/** Embla loop+pad only from 3+ — pair (2) uses wrap without clone peeks. */
const LOOP_EXPAND_MIN_ITEMS = 3;

function identityLoopPack<T>(items: readonly T[]): EmblaLoopSlidePack<T> {
  return {
    slides: [...items],
    sourceCount: items.length,
    toSourceIndex: (slideIndex) => slideIndex,
    nearestSlideIndex: (sourceIndex) => sourceIndex,
  };
}

export function EntityBrowser<T extends { id: string }>({
  storageKey,
  items,
  getId,
  renderItem,
  onOpenItem,
  toolbarLeft,
  toolbarRight,
  emptyState,
}: EntityBrowserProps<T>) {
  const { viewMode, setViewMode } = useLibraryViewMode(storageKey);

  const useLoopExpand = items.length >= LOOP_EXPAND_MIN_ITEMS;
  const usePairWrap = items.length === 2;
  const itemsKey = items.map(getId).join('|');

  const loopPackRef = useRef<EmblaLoopSlidePack<T>>(identityLoopPack(items));
  const prevPackKeyRef = useRef('');
  const packKey = `${useLoopExpand ? 'loop' : usePairWrap ? 'pair' : 'exact'}:${itemsKey}`;
  if (prevPackKeyRef.current !== packKey) {
    prevPackKeyRef.current = packKey;
    loopPackRef.current = useLoopExpand
      ? expandSlidesForEmblaLoop(items)
      : identityLoopPack(items);
  }
  const loopPack = loopPackRef.current;
  const slides = loopPack.slides;
  // Mid-pack start only when padded for Embla loop (≥3).
  const initialSlideIndex =
    useLoopExpand && slides.length > 0
      ? loopPack.nearestSlideIndex(0, Math.floor(slides.length / 2))
      : 0;

  const {
    setApi,
    current,
    scrollPrev,
    scrollNext,
    scrollToIndex,
    handleCardClick,
    carouselCss,
    emblaOpts,
    dotsClass,
    dotClass,
    navClass,
    navButtonClass,
    getItemClassName,
    getItemStyle,
    getCardClassName,
    contentClassName,
  } = useCenterFocusCarousel({
    itemCount: slides.length,
    enabled: viewMode === 'carousel',
    prefix: 'entity-browser',
    visualMode: 'coverflow',
    slideBasisClassName: CENTER_FOCUS_LIBRARY_SLIDE_BASIS_CLASS,
    loop: useLoopExpand,
    wrap: usePairWrap,
    initialSlideIndex,
  });

  const sourceCurrent = loopPack.toSourceIndex(current);

  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const scrollToSource = (sourceIndex: number) => {
    scrollToIndex(loopPack.nearestSlideIndex(sourceIndex, current));
  };

  const activateItem = (item: T, slideIndex: number) => {
    if (viewMode === 'list' || viewMode === 'grid') {
      onOpenItem?.(item);
      return;
    }
    handleCardClick(slideIndex, () => onOpenItem?.(item));
  };

  return (
    <div
      className="@container w-full min-w-0 space-y-3"
      data-entity-browser
      data-view-mode={viewMode}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 text-sm text-muted-foreground">{toolbarLeft}</div>
        <div className="flex items-center gap-2">
          {toolbarRight}
          <LibraryViewModeToggle
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        </div>
      </div>

      {viewMode === 'carousel' ? (
        <div className="relative px-0 py-5 pb-14">
          <style>{carouselCss}</style>

          <Carousel setApi={setApi} opts={emblaOpts} className="w-full">
            <CarouselContent className={cn(contentClassName, 'items-start')}>
              {slides.map((item, slideIndex) => {
                const sourceIndex = loopPack.toSourceIndex(slideIndex);
                return (
                  <CarouselItem
                    key={`${getId(item)}__${slideIndex}`}
                    className={getItemClassName(slideIndex)}
                    style={getItemStyle(slideIndex)}
                  >
                    <div
                      className={getCardClassName()}
                      onClick={() => handleCardClick(slideIndex, () => onOpenItem?.(item))}
                    >
                      {renderItem(item, {
                        variant: 'carousel',
                        isCenter: sourceIndex === sourceCurrent && slideIndex === current,
                        onActivate: () => activateItem(item, slideIndex),
                      })}
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
          </Carousel>

          {items.length > 1 && (
            <div className={navClass}>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  navButtonClass,
                  'left-1 top-[42%] h-10 w-10 -translate-y-1/2 rounded-full border-2 bg-background/95 shadow-xl backdrop-blur-sm transition-transform hover:scale-110 md:left-4 md:h-12 md:w-12',
                )}
                aria-label="Vorheriges Element"
                onClick={scrollPrev}
              >
                <CaretLeft className="size-5 md:size-6" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  navButtonClass,
                  'right-1 top-[42%] h-10 w-10 -translate-y-1/2 rounded-full border-2 bg-background/95 shadow-xl backdrop-blur-sm transition-transform hover:scale-110 md:right-4 md:h-12 md:w-12',
                )}
                aria-label="Nächstes Element"
                onClick={scrollNext}
              >
                <CaretRight className="size-5 md:size-6" />
              </Button>
            </div>
          )}

          {items.length > 1 && (
            <div className={dotsClass}>
              {items.map((item, sourceIndex) => (
                <button
                  key={getId(item)}
                  type="button"
                  aria-label={`Zu Element ${sourceIndex + 1} springen`}
                  className={cn(dotClass, sourceIndex === sourceCurrent && 'active')}
                  onClick={() => scrollToSource(sourceIndex)}
                />
              ))}
            </div>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          data-entity-browser-grid
        >
          {items.map((item) => (
            <div key={getId(item)} className="min-w-0">
              {renderItem(item, {
                variant: 'grid',
                isCenter: false,
                onActivate: () => activateItem(item, 0),
              })}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={getId(item)}>
              {renderItem(item, {
                variant: 'list',
                isCenter: false,
                onActivate: () => activateItem(item, 0),
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
