/**
 * BackgroundCarousel — Swipebare Hintergrund-Framework-Auswahl (Frameworks + Custom), analog zum Archetyp-Karussell.
 * Location: src/app/character/creation/BackgroundCarousel.tsx
 */
import {
  CaretLeft,
  CaretRight,
  ClipboardText,
  Compass,
  Crown,
  MaskHappy,
  Fingerprint,
  Flame,
  GraduationCap,
  HandPointing,
  Handshake,
  Heartbeat,
  PencilSimpleLine,
  Scales,
  MagnifyingGlass,
  Shapes,
  Shield,
  Tree,
  Trophy,
  UsersThree,
  Wrench,
  type Icon
} from '@phosphor-icons/react';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import { Card, CardHeader, CardTitle } from '../../../shared/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '../../../shared/ui/carousel';
import {
  getSagaTreeSkill,
  type SagaTreeSkillKey,
} from '../../../domains/rules/sagatree/character-creation';
import type { SagaTreeBackgroundTemplate } from '../../../domains/rules/sagatree/background-templates';
import type { CarouselScrollPhase } from '../../../app/character/shared/carousel.types';
import { useCarouselScrollSync } from '../../../app/character/shared/useCarouselScrollSync';
import { RuleHelp } from '../shared/RuleHelp';

export type BackgroundCarouselSelection = string | null;

type BackgroundCarouselOption =
  | { kind: 'template'; id: string; template: SagaTreeBackgroundTemplate }
  | { kind: 'custom'; id: null };

interface BackgroundCarouselProps {
  templates: readonly SagaTreeBackgroundTemplate[];
  selectedId: string | null | undefined;
  onSelect: (value: BackgroundCarouselSelection) => void;
  labelledBy?: string;
  onScrollPhaseChange?: (phase: CarouselScrollPhase) => void;
}

const BACKGROUND_FRAMEWORK_ICON_BY_ID: Readonly<Record<string, Icon>> = {
  'stage-public': MaskHappy,
  'sport-competition': Trophy,
  'border-scout': Tree,
  'academy-research': GraduationCap,
  'corporate-technician': Wrench,
  'street-doctor': Heartbeat,
  soldier: Shield,
  smuggler: Fingerprint,
  investigator: MagnifyingGlass,
  'trade-networks': Handshake,
  'privilege-elite': Crown,
  'faith-order': Flame,
  'travel-transport': Compass,
  'organization-administration': ClipboardText,
  'service-supply': HandPointing,
  'family-community': UsersThree,
  'law-institutions': Scales,
};

function buildOptions(templates: readonly SagaTreeBackgroundTemplate[]): BackgroundCarouselOption[] {
  return [
    ...templates.map((template) => ({ kind: 'template' as const, id: template.id, template })),
    { kind: 'custom', id: null },
  ];
}

function optionMatches(option: BackgroundCarouselOption, selectedId: string | null | undefined): boolean {
  if (selectedId === undefined) return false;
  return option.id === selectedId;
}

function skillLabels(skills: readonly SagaTreeSkillKey[]): string {
  return skills.map((skill) => getSagaTreeSkill(skill).label).join(' · ');
}

export function BackgroundCarousel({
  templates,
  selectedId,
  onSelect,
  labelledBy = 'background-competency-heading',
  onScrollPhaseChange,
}: BackgroundCarouselProps) {
  const options = buildOptions(templates);

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
    getSelectedIndex: () => options.findIndex((option) => optionMatches(option, selectedId)),
    getValueAtIndex: (index) => {
      if (index < 0 || index >= options.length) return undefined;
      return options[index].id;
    },
    isSelectionUnset: () => selectedId === undefined,
    shouldSyncScrollToSelection: () => selectedId !== undefined,
    selectionSyncKey: selectedId,
    shouldEmitSelect: (_index, value) => selectedId === undefined || value !== selectedId,
    onSelect,
    onScrollPhaseChange,
    selectOnCenterClick: true,
    prefix: 'background',
    visualMode: 'focus',
  });

  return (
    <div className="relative px-0" role="radiogroup" aria-labelledby={labelledBy}>
      <style>{carouselCss}</style>

      <Carousel setApi={setApi} opts={emblaOpts} className="w-full">
        <CarouselContent className={contentClassName}>
          {options.map((option, index) => {
            const isCenter = index === current;
            const isSelected = optionMatches(option, selectedId);
            const title = option.kind === 'template' ? option.template.name : 'Eigener Hintergrund';
            const summary = option.kind === 'template'
              ? option.template.description
              : 'Kein Framework passt? Benenne deine Vergangenheit selbst und wähle vier passende Fertigkeiten.';
            const playstyle = option.kind === 'template' ? option.template.playstyle : 'Volle Freiheit · gleiche Regeln';
            const poolPreview = option.kind === 'template' ? skillLabels(option.template.skillPool) : 'Vier freie Pool-Fertigkeiten';
            const examples = option.kind === 'template' ? option.template.examples.join(' · ') : null;
            const FrameworkIcon = option.kind === 'template'
              ? BACKGROUND_FRAMEWORK_ICON_BY_ID[option.template.id] ?? Shapes
              : PencilSimpleLine;

            return (
              <CarouselItem
                key={option.kind === 'template' ? option.template.id : 'custom'}
                className={getItemClassName(index)}
              >
                <div className={getCardClassName()}>
                  <Card
                    role="radio"
                    aria-label={title}
                    aria-checked={isSelected && isCenter}
                    tabIndex={isCenter ? 0 : -1}
                    className={`overflow-hidden transition-all duration-300 gap-3 ${isCenter ? 'cursor-default border-primary/60 shadow-lg' : 'cursor-pointer'} ${isSelected && isCenter ? 'border-primary bg-primary/5' : ''} ${option.kind === 'custom' && !(isSelected && isCenter) ? 'border-dashed' : ''}`}
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
                        data-background-framework-icon={option.kind === 'template' ? option.template.id : 'custom'}
                      >
                        <FrameworkIcon className="h-7 w-7 md:h-8 md:w-8" aria-hidden="true" />
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                      {isSelected && isCenter ? (
                        <Badge className="absolute right-2 top-2 border-0 bg-primary text-primary-foreground shadow-sm">Gewählt</Badge>
                      ) : null}
                    </div>
                    <CardHeader className="space-y-1.5 p-3 md:p-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {option.kind === 'template' ? 'Hintergrund Framework' : 'Freier Hintergrund'}
                      </p>
                      <div className="flex items-center gap-1">
                        <CardTitle className="text-sm md:text-base">{title}</CardTitle>
                        <span className="inline-flex" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                          <RuleHelp label={title}>
                            {option.kind === 'template'
                              ? `${option.template.description} Beispiele: ${option.template.examples.join(', ')}. Playstyle: ${option.template.playstyle}`
                              : 'Eigener Hintergrund: vier freie Pool-Fertigkeiten, zwei Trainings mit Hintergrund +1, eine Spezialisierung.'}
                          </RuleHelp>
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">{summary}</p>
                      {examples ? <p className="text-[11px] text-muted-foreground line-clamp-2"><span className="font-medium">Beispiele:</span> {examples}</p> : null}
                      <p className="text-[11px] font-medium text-muted-foreground">{playstyle}</p>
                      {isCenter ? (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {option.kind === 'template'
                            ? option.template.skillPool.map((skill) => (
                              <Badge key={skill} variant="outline">{getSagaTreeSkill(skill).label}</Badge>
                            ))
                            : <Badge variant="secondary">Volle Freiheit</Badge>}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{poolPreview}</p>
                      )}
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
          <Button type="button" variant="outline" size="icon" className={`${navButtonClass} left-0 top-[28%] h-10 w-10 rounded-full border-2 bg-background/95 shadow-xl backdrop-blur-sm md:left-2 md:h-11 md:w-11`} onClick={scrollPrev} aria-label="Vorheriges Hintergrund Framework">
            <CaretLeft className="size-5" />
          </Button>
          <Button type="button" variant="outline" size="icon" className={`${navButtonClass} right-0 top-[28%] h-10 w-10 rounded-full border-2 bg-background/95 shadow-xl backdrop-blur-sm md:right-2 md:h-11 md:w-11`} onClick={scrollNext} aria-label="Nächstes Hintergrund Framework">
            <CaretRight className="size-5" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
