/**
 * SpeciesCarousel — Swipebare Spezies-Auswahl mit Skizzen, angelehnt an ProjectCarousel (Scriptony).
 * Location: src/app/character/creation/SpeciesCarousel.tsx
 */
import {
  CaretLeft,
  CaretRight
} from '@phosphor-icons/react';
import { sagaTreeRaceOptions } from '../../../domains/rules/sagatree/character-creation';
import { RuleHelp } from '../shared/RuleHelp';
import { SpeciesBannerFlag } from './SpeciesBannerFlag';
import { getSpeciesColorway } from './speciesBanners';
import { getSpeciesSketchUrl } from './speciesSketches';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import { Card, CardHeader, CardTitle } from '../../../shared/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '../../../shared/ui/carousel';
import { useCarouselScrollSync } from '../../../app/character/shared/useCarouselScrollSync';

interface SpeciesCarouselProps {
  selectedRace: string;
  onSelect: (race: string) => void;
  labelledBy?: string;
}

export function SpeciesCarousel({ selectedRace, onSelect, labelledBy = 'species-label' }: SpeciesCarouselProps) {
  const options = sagaTreeRaceOptions;

  const {
    setApi,
    current,
    handleCardClick,
    scrollPrev,
    scrollNext,
    carouselCss,
    emblaOpts,
    contentClassName,
    dotsClass,
    navClass,
    navButtonClass,
    getItemClassName,
    getCardClassName,
    getDotClassName,
  } = useCarouselScrollSync({
    optionsLength: options.length,
    getSelectedIndex: () => options.findIndex((option) => option.value === selectedRace),
    getValueAtIndex: (index) => options[index]?.value,
    isSelectionUnset: () => false,
    shouldSyncScrollToSelection: () => true,
    selectionSyncKey: selectedRace,
    shouldEmitSelect: (_index, value) => value !== selectedRace,
    onSelect,
    selectOnCenterClick: false,
    prefix: 'species',
    visualMode: 'focus',
  });

  return (
    <div className="relative px-0 py-2 md:py-4" role="radiogroup" aria-labelledby={labelledBy}>
      <style>{`
        ${carouselCss}
        .species-banner-flag-wrap {
          position: relative;
        }
        .species-banner-shimmer {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(
            105deg,
            transparent 35%,
            color-mix(in srgb, var(--species-shimmer-soft) 18%, transparent) 42%,
            color-mix(in srgb, var(--species-shimmer) 48%, transparent) 50%,
            color-mix(in srgb, var(--species-shimmer-soft) 18%, transparent) 58%,
            transparent 65%
          );
          background-size: 220% 100%;
          animation: species-banner-shimmer 2.8s ease-in-out infinite;
          mix-blend-mode: overlay;
        }
        @keyframes species-banner-shimmer {
          0%, 100% {
            background-position: 180% 0;
          }
          50% {
            background-position: -80% 0;
          }
        }
        .species-card-header {
          border-top-width: 2px;
          border-top-style: solid;
          background-color: var(--species-header-bg);
        }
        .species-card-header.is-selected {
          animation: species-header-pulse 2.8s ease-in-out infinite;
        }
        @keyframes species-header-pulse {
          0%, 100% {
            background-color: var(--species-header-bg);
          }
          50% {
            background-color: var(--species-header-bg-pulse);
          }
        }
      `}</style>

      <Carousel setApi={setApi} opts={emblaOpts} className="w-full">
        <CarouselContent className={contentClassName}>
          {options.map((option, index) => {
            const isCenter = index === current;
            const isSelected = selectedRace === option.value;
            const colorway = getSpeciesColorway(option.value);
            const headerStyle = {
              '--species-header-bg': colorway.headerBg,
              '--species-header-bg-pulse': colorway.headerBgPulse,
              '--species-accent': colorway.accent,
              '--species-text': colorway.text,
              '--species-border': colorway.border,
              borderTopColor: colorway.border,
            } as React.CSSProperties;
            return (
              <CarouselItem key={option.value} className={getItemClassName(index)}>
                <div className={getCardClassName()}>
                    <Card
                      role="radio"
                      aria-label={option.label}
                      aria-checked={isSelected && isCenter}
                      tabIndex={isCenter ? 0 : -1}
                      className={`overflow-hidden transition-all duration-300 ${isCenter ? 'cursor-default border-primary/60 shadow-lg' : 'cursor-pointer'} ${isSelected && isCenter ? 'border-primary bg-primary/5' : ''}`}
                      onClick={() => handleCardClick(index)}
                      onKeyDown={(event) => {
                        if (!isCenter) return;
                        if (event.key === 'ArrowLeft') {
                          event.preventDefault();
                          scrollPrev();
                        }
                        if (event.key === 'ArrowRight') {
                          event.preventDefault();
                          scrollNext();
                        }
                      }}
                    >
                      <div className="relative aspect-[4/5] overflow-hidden bg-background">
                        <SpeciesBannerFlag species={option.value} isSelected={isSelected} />
                        <img
                          src={getSpeciesSketchUrl(option.value)}
                          alt={`Skizze: ${option.label}`}
                          className="absolute inset-0 z-10 h-full w-full object-contain p-3"
                          draggable={false}
                        />
                        {isSelected && isCenter && (
                          <Badge className="absolute right-2 top-2 border-0 bg-primary text-primary-foreground shadow-sm">
                            Gewählt
                          </Badge>
                        )}
                      </div>
                      <CardHeader
                        className={`species-card-header space-y-2 p-3 md:p-4 ${isSelected ? 'is-selected' : ''}`}
                        style={headerStyle}
                      >
                        <div className="flex items-center gap-1">
                          <CardTitle className="text-sm md:text-base" style={{ color: colorway.accent }}>
                            {option.label}
                          </CardTitle>
                          <span className="inline-flex" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                            <RuleHelp label={option.label}>{option.description}</RuleHelp>
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed line-clamp-3" style={{ color: colorway.text }}>
                          {option.description}
                        </p>
                      </CardHeader>
                    </Card>
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>

      {options.length > 1 && (
        <div className={navClass}>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={`${navButtonClass} left-0 top-[32%] h-10 w-10 rounded-full border-2 bg-background/95 shadow-xl backdrop-blur-sm md:left-2 md:h-11 md:w-11`}
            onClick={scrollPrev}
            aria-label="Vorherige Spezies"
          >
            <CaretLeft className="size-5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={`${navButtonClass} right-0 top-[32%] h-10 w-10 rounded-full border-2 bg-background/95 shadow-xl backdrop-blur-sm md:right-2 md:h-11 md:w-11`}
            onClick={scrollNext}
            aria-label="Nächste Spezies"
          >
            <CaretRight className="size-5" />
          </Button>
        </div>
      )}

      {options.length > 1 && (
        <div className={dotsClass}>
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              className={getDotClassName(index)}
              onClick={() => handleCardClick(index)}
              aria-label={`${option.label} anzeigen`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
