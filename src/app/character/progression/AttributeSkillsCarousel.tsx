/**
 * AttributeSkillsCarousel — Swipebare Attribut-Gruppen für den Skills-Tab,
 * analog zu Hintergrund-/Essenz-Karussell.
 * Location: src/app/character/progression/AttributeSkillsCarousel.tsx
 */
import {
  Brain,
  CaretLeft,
  CaretRight,
  Barbell,
  Eye,
  Heartbeat,
  Sparkle,
  Lightning,
  type Icon
} from '@phosphor-icons/react';
import {
  sagaTreeAttributeDefinitions,
  sagaTreeSkillDefinitions,
  type SagaTreeAttributeKey,
} from '../../../domains/rules/sagatree/character-creation';
import { RuleHelp } from '../shared/RuleHelp';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import { Card, CardHeader, CardTitle } from '../../../shared/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '../../../shared/ui/carousel';
import type { CarouselScrollPhase } from '../../../app/character/shared/carousel.types';
import { useCarouselScrollSync } from '../../../app/character/shared/useCarouselScrollSync';

export type { CarouselScrollPhase } from '../../../app/character/shared/carousel.types';

const ATTRIBUTE_ICONS: Readonly<Record<SagaTreeAttributeKey, Icon>> = {
  strength: Barbell,
  dexterity: Lightning,
  endurance: Heartbeat,
  mind: Brain,
  perception: Eye,
  charisma: Sparkle,
};

interface AttributeSkillsCarouselProps {
  selectedAttribute: SagaTreeAttributeKey;
  onSelect: (value: SagaTreeAttributeKey) => void;
  labelledBy?: string;
  onScrollPhaseChange?: (phase: CarouselScrollPhase) => void;
}

export function AttributeSkillsCarousel({
  selectedAttribute,
  onSelect,
  labelledBy = 'attribute-skills-heading',
  onScrollPhaseChange,
}: AttributeSkillsCarouselProps) {
  const options = sagaTreeAttributeDefinitions;

  const {
    setApi,
    current,
    handleCardClick,
    scrollPrev,
    scrollNext,
    carouselCss,
    emblaOpts,
    contentClassName,
    navClass,
    navButtonClass,
    getItemClassName,
    getCardClassName,
  } = useCarouselScrollSync({
    optionsLength: options.length,
    getSelectedIndex: () => options.findIndex((option) => option.key === selectedAttribute),
    getValueAtIndex: (index) => options[index]?.key,
    isSelectionUnset: () => false,
    shouldSyncScrollToSelection: () => true,
    selectionSyncKey: selectedAttribute,
    shouldEmitSelect: (_index, value) => value !== selectedAttribute,
    onSelect,
    onScrollPhaseChange,
    selectOnCenterClick: false,
    prefix: 'attribute',
    visualMode: 'focus',
  });

  return (
    <div
      className="relative px-0"
      role="radiogroup"
      aria-labelledby={labelledBy}
      data-attribute-skills-carousel
    >
      <style>{carouselCss}</style>

      <Carousel setApi={setApi} opts={emblaOpts} className="w-full">
        <CarouselContent className={contentClassName}>
          {options.map((option, index) => {
            const isCenter = index === current;
            const isSelected = selectedAttribute === option.key;
            const skillCount = sagaTreeSkillDefinitions.filter((skill) => skill.attribute === option.key).length;
            const AttributeIcon = ATTRIBUTE_ICONS[option.key];

            return (
              <CarouselItem key={option.key} className={getItemClassName(index)}>
                <div className={getCardClassName()}>
                  <Card
                    role="radio"
                    aria-label={option.label}
                    aria-checked={isSelected && isCenter}
                    tabIndex={isCenter ? 0 : -1}
                    data-attribute-carousel-card={option.key}
                    className={`overflow-hidden transition-all duration-300 gap-3 ${isCenter ? 'cursor-default border-primary/60 shadow-lg' : 'cursor-pointer'} ${isSelected && isCenter ? 'border-primary bg-primary/5' : ''}`}
                    onClick={() => handleCardClick(index)}
                    onKeyDown={(event) => {
                      if (!isCenter) return;
                      if (event.key === 'ArrowLeft') { event.preventDefault(); scrollPrev(); }
                      if (event.key === 'ArrowRight') { event.preventDefault(); scrollNext(); }
                    }}
                  >
                    <div className="relative flex aspect-[8/5] items-center justify-center overflow-hidden bg-gradient-to-br from-primary/15 via-muted/50 to-accent/10">
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-2xl md:h-16 md:w-16 ${isCenter ? 'bg-primary/20 text-primary' : 'bg-muted/70 text-muted-foreground'}`}
                      >
                        <AttributeIcon className="h-7 w-7 md:h-8 md:w-8" aria-hidden="true" />
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                      {isSelected && isCenter ? (
                        <Badge className="absolute right-2 top-2 border-0 bg-primary text-primary-foreground shadow-sm">Aktiv</Badge>
                      ) : null}
                    </div>
                    <CardHeader className="space-y-1.5 p-3 md:p-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Attribut · {option.shortLabel}
                      </p>
                      <div className="flex items-center gap-1">
                        <CardTitle className="text-sm md:text-base">{option.label}</CardTitle>
                        <span className="inline-flex" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                          <RuleHelp label={option.label}>{option.description}</RuleHelp>
                        </span>
                      </div>
                      {isCenter ? (
                        <p className="text-xs leading-relaxed text-muted-foreground">{option.description}</p>
                      ) : (
                        <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">{option.description}</p>
                      )}
                      <p className="text-[11px] font-medium text-muted-foreground">
                        {skillCount === 0
                          ? 'Kein Standard-Skill-Cluster'
                          : `${skillCount} Fertigkeit${skillCount === 1 ? '' : 'en'}`}
                      </p>
                    </CardHeader>
                  </Card>
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>

      {options.length > 1 ? (
        <div className={navClass}>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={`${navButtonClass} left-0 top-[28%] h-10 w-10 rounded-full border-2 bg-background/95 shadow-xl backdrop-blur-sm md:left-2 md:h-11 md:w-11`}
            onClick={scrollPrev}
            aria-label="Vorheriges Attribut"
          >
            <CaretLeft className="size-5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={`${navButtonClass} right-0 top-[28%] h-10 w-10 rounded-full border-2 bg-background/95 shadow-xl backdrop-blur-sm md:right-2 md:h-11 md:w-11`}
            onClick={scrollNext}
            aria-label="Nächstes Attribut"
          >
            <CaretRight className="size-5" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
