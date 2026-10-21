/**
 * CharacterBackgroundPanel — Hintergrund-Auswahl per Karussell mit Bracket-Connector
 * zu den Pool-Skill-Nodes (stackbare 2 Hintergrundpunkte + Spezialisierungs-Branch).
 * Location: src/app/character/creation/CharacterBackgroundPanel.tsx
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Question,
  Minus,
  Plus
} from '@phosphor-icons/react';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../shared/ui/tooltip';
import {
  getBackgroundSpecializationSuggestionNames,
  getSagaTreeBackgroundTemplate,
  getSagaTreeBackgroundTemplatesForWorldProfile,
} from '../../../domains/rules/sagatree/background-templates';
import {
  getSagaTreeAttribute,
  getSagaTreeSkill,
  getSagaTreeSpecializationDescription,
  isSagaTreeSkillKey,
  type SagaTreeSkillKey,
} from '../../../domains/rules/sagatree/character-creation';
import type { CarouselScrollPhase } from '../../../app/character/shared/carousel.types';
import type { SagaTreeBackgroundSkillPoints } from '../../../domains/rules/sagatree/skill-progression';
import { SAGA_TREE_START_BACKGROUND_SKILL_POINTS } from '../../../domains/rules/sagatree/skill-progression';
import { BackgroundCarousel } from './BackgroundCarousel';
import {
  adjustBackgroundSkillPoints,
  backgroundSkillsWithPoints,
  sumBackgroundSkillPointsUsed,
} from './BackgroundSkillPointsAllocator';
import { RuleHelp } from '../shared/RuleHelp';
import { SkillIcon, SkillSelectField } from '../progression';

/**
 * BackgroundSkillAttributeHint — Plain short-label + Question tooltip (same pattern as
 * SpecializationSelectOptionHelp / CharacterEditor). Explains the default Check attribute
 * (not background/pool points). Location: CharacterBackgroundPanel.tsx
 */
function BackgroundSkillAttributeHint({
  attributeLabel,
  attributeShortLabel,
}: {
  attributeLabel: string;
  attributeShortLabel: string;
}) {
  return (
    <span className="mt-1 inline-flex items-center justify-center gap-1">
      <span
        className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
        aria-hidden="true"
      >
        {attributeShortLabel}
      </span>
      <Tooltip pinOnClick={false}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Standardattribut ${attributeLabel} erklären`}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-primary hover:bg-primary/10"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Question className="pointer-events-none size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-[280px] px-3 py-2 text-left text-xs leading-relaxed">
          Beim Check wird das Attribut {attributeLabel} verwendet — das standardmäßig verknüpfte Attribut
          für diesen Fertigkeits-Check, nicht Hintergrund- oder Pool-Punkte.
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

/**
 * SpecializationSelectOptionHelp — Question + shadcn Tooltip portal inside a Radix SelectItem.
 * Native `title` is unreliable on Select options; wrapping SelectTrigger in Tooltip breaks open/E2E.
 * Pattern matches CharacterEditor attribute-option help. Location: CharacterBackgroundPanel.tsx
 */
function SpecializationSelectOptionHelp({ label, description }: { label: string; description: string }) {
  return (
    <Tooltip pinOnClick={false}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${label} erklären`}
          className="pointer-events-auto ml-auto inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-primary hover:bg-primary/10"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <Question className="pointer-events-none size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="max-w-[280px] px-3 py-2 text-left text-xs leading-relaxed">
        {description}
      </TooltipContent>
    </Tooltip>
  );
}

type SkillSlot = SagaTreeSkillKey | '';

interface CharacterBackgroundPanelProps {
  backgroundTemplateId: string | null | undefined;
  worldProfileId?: string | null;
  backgroundName: string;
  skillPool: readonly SkillSlot[];
  backgroundSkillPoints: SagaTreeBackgroundSkillPoints;
  onBackgroundSkillPointsChange: (points: SagaTreeBackgroundSkillPoints) => void;
  specializationSkill: SkillSlot;
  specializationName: string;
  milieuAccess: string;
  contact: string;
  complication: string;
  communication: string;
  complete: boolean;
  onTemplateSelect: (templateId: string | null) => void;
  onBackgroundNameChange: (value: string) => void;
  onPoolSkillChange: (index: number, value: string) => void;
  onSpecializationSkillChange: (skill: SkillSlot) => void;
  onSpecializationNameChange: (value: string) => void;
  onSpecializationApply?: (skill: SagaTreeSkillKey, name: string) => void;
  onMilieuAccessChange: (value: string) => void;
  onContactChange: (value: string) => void;
  onComplicationChange: (value: string) => void;
  onCommunicationChange: (value: string) => void;
}

function SuggestionButtons({ values, onSelect }: { values: readonly string[] | undefined; onSelect: (value: string) => void }) {
  if (!values || values.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {values.slice(0, 3).map((value) => (
        <Button key={value} type="button" size="sm" variant="outline" className="min-h-11 px-2 text-xs" onClick={() => onSelect(value)}>
          {value}
        </Button>
      ))}
    </div>
  );
}

interface BackgroundSkillNodeProps {
  skillKey: SagaTreeSkillKey;
  pointValue: 0 | 1 | 2;
  pointsUsed: number;
  backgroundPointsComplete: boolean;
  isSpecializationTarget: boolean;
  specializationName: string;
  specializationOptions: readonly string[];
  onHoverChange: (skill: SagaTreeSkillKey | null) => void;
  onAdjust: (skill: SagaTreeSkillKey, delta: 1 | -1) => void;
  onSpecialize: (skill: SagaTreeSkillKey) => void;
  onSpecializationNameChange: (value: string) => void;
  onSpecializationApply: (skill: SagaTreeSkillKey, name: string) => void;
}

function BackgroundSkillNode({
  skillKey,
  pointValue,
  pointsUsed,
  backgroundPointsComplete,
  isSpecializationTarget,
  specializationName,
  specializationOptions,
  onHoverChange,
  onAdjust,
  onSpecialize,
  onSpecializationNameChange,
  onSpecializationApply,
}: BackgroundSkillNodeProps) {
  const skill = getSagaTreeSkill(skillKey);
  const attribute = getSagaTreeAttribute(skill.attribute);
  const hasSpecialization = Boolean(pointValue > 0 && specializationName.trim() && isSpecializationTarget);
  const selected = pointValue > 0;
  const canDecrease = pointValue > 0;
  const canIncrease =
    pointsUsed < SAGA_TREE_START_BACKGROUND_SKILL_POINTS && pointValue < 2;
  const showSpecializeControl = backgroundPointsComplete && pointValue > 0;
  const selectValue = specializationOptions.includes(specializationName.trim())
    ? specializationName.trim()
    : '';
  const selectedDescription = selectValue ? getSagaTreeSpecializationDescription(selectValue) : undefined;

  const handleCardActivate = () => {
    if (canIncrease) onAdjust(skillKey, 1);
  };

  return (
    <div className="min-w-0" data-background-skill-node={skillKey}>
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={
          canIncrease
            ? `${skill.label} Hintergrundpunkt hinzufügen`
            : `${skill.label} Hintergrundpunkte: ${pointValue}`
        }
        onMouseEnter={() => onHoverChange(skillKey)}
        onMouseLeave={() => onHoverChange(null)}
        onFocus={() => onHoverChange(skillKey)}
        onBlur={() => onHoverChange(null)}
        onClick={handleCardActivate}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleCardActivate();
          }
        }}
        className={`relative flex min-h-28 w-full flex-col items-center justify-center rounded-lg border p-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          selected
            ? 'border-primary bg-primary/5'
            : 'border-border bg-card hover:border-primary/60'
        } ${canIncrease ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {selected ? <Check className="absolute right-2 top-2 h-4 w-4 text-primary" aria-hidden="true" /> : null}
        <div className="flex flex-col items-center gap-1.5">
          <SkillIcon skillKey={skillKey} className="h-7 w-7 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="font-medium">{skill.label}</p>
            <BackgroundSkillAttributeHint
              attributeLabel={attribute.label}
              attributeShortLabel={attribute.shortLabel}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10"
            disabled={!canDecrease}
            onClick={(event) => {
              event.stopPropagation();
              onAdjust(skillKey, -1);
            }}
            aria-label={`${skill.label} Hintergrundpunkt verringern`}
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span className="w-6 text-center text-lg font-semibold tabular-nums" aria-live="polite">
            {pointValue}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10"
            disabled={!canIncrease}
            onClick={(event) => {
              event.stopPropagation();
              onAdjust(skillKey, 1);
            }}
            aria-label={`${skill.label} Hintergrundpunkt erhöhen`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {showSpecializeControl ? (
        <div className="mt-2 flex justify-center">
          <Button
            type="button"
            size="sm"
            variant={isSpecializationTarget ? 'default' : 'outline'}
            className="min-h-11 px-3"
            data-specialize-skill={skillKey}
            onClick={() => onSpecialize(skillKey)}
          >
            Spezialisieren
          </Button>
        </div>
      ) : null}

      {isSpecializationTarget && showSpecializeControl ? (
        <div className="relative mx-auto mt-0 max-w-[14rem] space-y-2 pt-5 text-left" data-specialization-branch={skillKey}>
          <span className="absolute left-1/2 top-0 h-5 -translate-x-1/2 border-l border-primary/60" aria-hidden="true" />
          <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-3">
            <div className="flex items-center gap-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Spezialisierung</p>
              {selectedDescription ? (
                <Tooltip pinOnClick={false}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`${selectValue} erklären`}
                      className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-primary hover:bg-primary/10"
                    >
                      <Question className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6} className="max-w-[280px] px-3 py-2 text-left text-xs leading-relaxed">
                    {selectedDescription}
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
            <Label htmlFor={`specialization-select-${skillKey}`} className="sr-only">
              Vorschlag für {skill.label}
            </Label>
            <Select
              value={selectValue || undefined}
              onValueChange={(value) => onSpecializationApply(skillKey, value)}
            >
              {/* Do not wrap SelectTrigger in Tooltip — Radix tooltip+select nesting blocks pointer/open in E2E. */}
              <SelectTrigger
                id={`specialization-select-${skillKey}`}
                className="mt-2 min-h-11 w-full"
                aria-label={`${skill.label} Spezialisierungsvorschlag`}
              >
                {selectValue ? (
                  <span className="flex min-w-0 items-center gap-2">
                    <SkillIcon skillKey={skillKey} className="h-4 w-4 shrink-0" />
                    <span className="truncate">{selectValue}</span>
                  </span>
                ) : (
                  <SelectValue placeholder="Vorschlag wählen …" />
                )}
              </SelectTrigger>
              <SelectContent>
                {specializationOptions.map((name) => {
                  const description = getSagaTreeSpecializationDescription(name);
                  return (
                    <SelectItem
                      key={name}
                      value={name}
                      textValue={name}
                      className={description ? 'items-start py-2.5 pr-10' : undefined}
                    >
                      <SelectItemText>
                        <span className="flex min-w-0 items-start gap-2">
                          <SkillIcon skillKey={skillKey} className="mt-0.5 h-4 w-4 shrink-0" />
                          <span className="min-w-0 text-left">
                            <span className="block leading-tight">{name}</span>
                            {description ? (
                              <span className="mt-0.5 block text-xs font-normal leading-snug text-muted-foreground whitespace-normal">
                                {description}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </SelectItemText>
                      {description ? (
                        <SpecializationSelectOptionHelp label={name} description={description} />
                      ) : null}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {selectedDescription ? (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{selectedDescription}</p>
            ) : null}
            <Input
              className="mt-2 min-h-11"
              value={specializationName}
              onChange={(event) => onSpecializationNameChange(event.target.value)}
              placeholder="Oder eigenes Fachgebiet"
              aria-label={`${skill.label} Spezialisierung Fachgebiet`}
            />
            {hasSpecialization ? <Badge className="mt-2">+2 auf passende Checks</Badge> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Bracket-Connector vom zentrierten Hintergrund-Karussell zu allen Pool-Skill-Nodes.
 * Vier Pool-Skills bleiben nach Punktverteilung sichtbar; belegte Skills werden hervorgehoben.
 */
interface BackgroundSkillConnectorProps {
  skills: readonly SagaTreeSkillKey[];
  trainedSkills: readonly SagaTreeSkillKey[];
  activeSkill: SagaTreeSkillKey | null;
  scrollPhase: CarouselScrollPhase;
  onStandstill: () => void;
}

function BackgroundSkillConnector({
  skills,
  trainedSkills,
  activeSkill,
  scrollPhase,
  onStandstill,
}: BackgroundSkillConnectorProps) {
  const connectorRef = useRef<HTMLDivElement>(null);
  const scrollPhaseRef = useRef<CarouselScrollPhase>(scrollPhase);
  const onStandstillRef = useRef(onStandstill);
  onStandstillRef.current = onStandstill;

  const [layout, setLayout] = useState<{ width: number; height: number; sourceX: number; targets: number[] }>({
    width: 0,
    height: 0,
    sourceX: 0,
    targets: [],
  });
  const [fadeGeneration, setFadeGeneration] = useState(0);

  const measure = useCallback(() => {
    const el = connectorRef.current;
    if (!el) return;
    if (scrollPhaseRef.current === 'scrolling') return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;

    const panel = el.closest('[data-background-panel]');
    const card = panel?.querySelector('.background-carousel-item.is-center [data-slot="card"]');
    const cardRect = card?.getBoundingClientRect();
    const sourceX = cardRect ? cardRect.left + cardRect.width / 2 - rect.left : rect.width / 2;

    const grid = panel?.querySelector('[data-background-skill-grid]');
    const seen = new Set<number>();
    const targets: number[] = [];
    for (const node of Array.from(grid?.querySelectorAll(':scope > [data-background-skill-node]') ?? [])) {
      const button = node.querySelector('[role="group"]');
      const box = (button ?? node).getBoundingClientRect();
      const center = Math.round(Math.min(rect.width, Math.max(0, box.left + box.width / 2 - rect.left)) * 10) / 10;
      if (seen.has(center)) continue;
      seen.add(center);
      targets.push(center);
    }

    const round1 = (value: number) => Math.round(value * 10) / 10;
    const next = {
      width: round1(rect.width),
      height: round1(rect.height),
      sourceX: round1(Math.min(rect.width, Math.max(0, sourceX))),
      targets: targets.map(round1),
    };
    setLayout((current) => {
      const same =
        current.width === next.width &&
        current.height === next.height &&
        current.sourceX === next.sourceX &&
        current.targets.length === next.targets.length &&
        current.targets.every((target, index) => target === next.targets[index]);
      return same ? current : next;
    });
  }, []);

  useEffect(() => {
    scrollPhaseRef.current = scrollPhase;
    if (scrollPhase === 'settled') {
      measure();
      setFadeGeneration((generation) => generation + 1);
    }
  }, [scrollPhase, measure]);

  useEffect(() => {
    if (scrollPhase !== 'scrolling') return;
    let frame: number | undefined;
    let stableCount = 0;
    let lastX: number | null = null;
    const getCardX = () => {
      const panel = connectorRef.current?.closest('[data-background-panel]');
      const card = panel?.querySelector('.background-carousel-item.is-center [data-slot="card"]');
      return card ? card.getBoundingClientRect().left : null;
    };
    const tick = () => {
      const x = getCardX();
      if (x !== null && lastX !== null && Math.abs(x - lastX) <= 0.5) {
        stableCount += 1;
        if (stableCount >= 3) {
          onStandstillRef.current();
          return;
        }
      } else {
        stableCount = 0;
      }
      lastX = x;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [scrollPhase]);

  useEffect(() => {
    measure();
    const el = connectorRef.current;
    const grid = el?.closest('[data-background-panel]')?.querySelector('[data-background-skill-grid]') ?? null;
    const observer = new ResizeObserver(() => measure());
    if (el) observer.observe(el);
    if (grid) observer.observe(grid);
    window.addEventListener('resize', measure);
    const t1 = window.setTimeout(measure, 50);
    const t2 = window.setTimeout(measure, 350);
    const t3 = window.setTimeout(measure, 700);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [measure, skills, trainedSkills]);

  const railY = layout.height >= 72 ? 24 : layout.height >= 56 ? 18 : layout.height >= 36 ? 12 : 10;
  const railLeft = layout.targets.length ? Math.min(...layout.targets, layout.sourceX) : 0;
  const railRight = layout.targets.length ? Math.max(...layout.targets, layout.sourceX) : layout.width;
  const trainedIndexes = new Set(trainedSkills.map((skill) => skills.indexOf(skill)).filter((index) => index >= 0));
  const hoverIndex = activeSkill ? skills.indexOf(activeSkill) : -1;
  const hasGeometry = layout.width > 0 && layout.targets.length > 0;

  return (
    <div ref={connectorRef} className="relative -mt-px h-14 md:h-[72px]" aria-hidden="true">
      <style>{`
        @keyframes background-connector-draw {
          from { stroke-dashoffset: 100; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes background-connector-flow {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -15; }
        }
        @keyframes background-connector-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes background-connector-reveal {
          from { clip-path: inset(0 0 100% 0); }
          to { clip-path: inset(0 0 0% 0); }
        }
        .background-connector-fade {
          animation:
            background-connector-fade 200ms ease-out both,
            background-connector-reveal 340ms cubic-bezier(0.33, 1, 0.68, 1) both;
        }
        .background-connector-hide {
          opacity: 0;
          pointer-events: none;
        }
        .background-connector-route {
          stroke-dasharray: 100;
          animation: background-connector-draw 450ms cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        .background-connector-route--flow {
          stroke-dasharray: 10 5;
          animation: background-connector-flow 0.75s linear infinite;
        }
      `}</style>
      {hasGeometry ? (
        <svg
          key={`${skills.join('|')}-${fadeGeneration}`}
          className={`${scrollPhase === 'settled' ? 'background-connector-fade' : 'background-connector-hide'} absolute inset-0 overflow-visible`}
          width={layout.width}
          height={layout.height}
          fill="none"
        >
          <g className="text-muted-foreground" strokeLinecap="round">
            <line x1={layout.sourceX} y1={0} x2={layout.sourceX} y2={railY} stroke="currentColor" strokeWidth={1} />
            <line x1={railLeft} y1={railY} x2={railRight} y2={railY} stroke="currentColor" strokeWidth={1} />
            {layout.targets.map((targetX, index) => (
              <line key={`drop-${index}`} x1={targetX} y1={railY} x2={targetX} y2={layout.height} stroke="currentColor" strokeWidth={1} />
            ))}
          </g>
          {Array.from(trainedIndexes).map((index) => {
            const targetX = layout.targets[index];
            if (targetX === undefined) return null;
            return (
              <g key={`trained-${index}`} className="text-primary">
                <path
                  d={`M ${layout.sourceX} 0 L ${layout.sourceX} ${railY} L ${targetX} ${railY} L ${targetX} ${layout.height}`}
                  className="background-connector-route background-connector-route--flow"
                  pathLength={100}
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}
          {hoverIndex >= 0 && !trainedIndexes.has(hoverIndex) && layout.targets[hoverIndex] !== undefined ? (
            <g className="text-foreground">
              <path
                d={`M ${layout.sourceX} 0 L ${layout.sourceX} ${railY} L ${layout.targets[hoverIndex]} ${railY} L ${layout.targets[hoverIndex]} ${layout.height}`}
                className="background-connector-route"
                pathLength={100}
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ) : null}
        </svg>
      ) : null}
    </div>
  );
}

export function CharacterBackgroundPanel({
  backgroundTemplateId,
  worldProfileId,
  backgroundName,
  skillPool,
  backgroundSkillPoints,
  onBackgroundSkillPointsChange,
  specializationSkill,
  specializationName,
  milieuAccess,
  contact,
  complication,
  communication,
  complete,
  onTemplateSelect,
  onBackgroundNameChange,
  onPoolSkillChange,
  onSpecializationSkillChange,
  onSpecializationNameChange,
  onSpecializationApply,
  onMilieuAccessChange,
  onContactChange,
  onComplicationChange,
  onCommunicationChange,
}: CharacterBackgroundPanelProps) {
  const templates = getSagaTreeBackgroundTemplatesForWorldProfile(worldProfileId);
  const selectedTemplate = getSagaTreeBackgroundTemplate(backgroundTemplateId);
  const poolSkills = skillPool.filter(isSagaTreeSkillKey);
  const backgroundPointsUsed = sumBackgroundSkillPointsUsed(backgroundSkillPoints);
  const backgroundPointsComplete = backgroundPointsUsed === SAGA_TREE_START_BACKGROUND_SKILL_POINTS;
  const occupiedBackgroundSkills = backgroundSkillsWithPoints(backgroundSkillPoints);
  const allSkillKeys = getAllSkillKeys();
  const customMode = backgroundTemplateId === null;
  const hasChoice = backgroundTemplateId !== undefined;
  const showSkillGraph = hasChoice && poolSkills.length === 4;
  // Keep all four pool skills visible after allocating points so players can reallocate.
  const visibleSkillNodes = poolSkills;
  const skillGraphViewMode = 'pool';

  const [scrollPhase, setScrollPhase] = useState<CarouselScrollPhase>('settled');
  const [activeSkill, setActiveSkill] = useState<SagaTreeSkillKey | null>(null);

  const handleScrollPhaseChange = useCallback((phase: CarouselScrollPhase) => {
    setScrollPhase(phase);
  }, []);
  const handleStandstill = useCallback(() => setScrollPhase('settled'), []);
  const handleBackgroundPointAdjust = useCallback(
    (skill: SagaTreeSkillKey, delta: 1 | -1) => {
      onBackgroundSkillPointsChange(adjustBackgroundSkillPoints(backgroundSkillPoints, skill, delta));
    },
    [backgroundSkillPoints, onBackgroundSkillPointsChange],
  );
  const handleSpecialize = useCallback(
    (skill: SagaTreeSkillKey) => {
      onSpecializationSkillChange(skill);
    },
    [onSpecializationSkillChange],
  );
  const handleSpecializationApply = useCallback(
    (skill: SagaTreeSkillKey, name: string) => {
      if (onSpecializationApply) {
        onSpecializationApply(skill, name);
        return;
      }
      onSpecializationSkillChange(skill);
      onSpecializationNameChange(name);
    },
    [onSpecializationApply, onSpecializationNameChange, onSpecializationSkillChange],
  );

  return (
    <section className="space-y-5" aria-labelledby="background-competency-heading" data-background-panel>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-1">
            <h3 id="background-competency-heading" className="font-semibold">Hintergrund</h3>
            <RuleHelp label="Hintergrund">
              Dein Hintergrund definiert vier Framework-Fertigkeiten. Du verteilst 2 stackbare Hintergrundpunkte (+2 auf einen Skill oder +1/+1). Attribute werden dadurch nicht erhöht.
            </RuleHelp>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Wähle eine Vergangenheit im Karussell. Verteile danach 2 Hintergrund-Fertigkeitspunkte direkt an den Pool-Skills
            (+2 auf einen Skill oder +1/+1) und lege eine Spezialisierung fest. Alle vier Pool-Skills bleiben sichtbar, damit du Punkte umverteilen kannst.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showSkillGraph ? (
            <Badge variant={backgroundPointsComplete ? 'default' : 'outline'} data-background-points-budget>
              {backgroundPointsUsed} / {SAGA_TREE_START_BACKGROUND_SKILL_POINTS} verteilt
            </Badge>
          ) : null}
          <Badge variant={complete ? 'default' : 'outline'}>{complete ? 'Hintergrund vollständig' : 'Hintergrund offen'}</Badge>
        </div>
      </div>

      <BackgroundCarousel
        templates={templates}
        selectedId={backgroundTemplateId}
        onSelect={onTemplateSelect}
        labelledBy="background-competency-heading"
        onScrollPhaseChange={handleScrollPhaseChange}
      />

      {!hasChoice ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
          Wähle einen Hintergrund im Karussell. Danach siehst du die vier Pool-Fertigkeiten und verteilst 2 Hintergrundpunkte darauf.
        </div>
      ) : (
        <div className="space-y-4">
          {customMode ? (
            <div className="space-y-4 rounded-lg border border-border bg-muted/5 p-4">
              <div className="space-y-2">
                <Label htmlFor="background-name">Name des Hintergrunds</Label>
                <Input id="background-name" value={backgroundName} onChange={(event) => onBackgroundNameChange(event.target.value)} placeholder="z. B. Feldheiler, Kurierin, Hofgelehrter" />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Vier Pool-Fertigkeiten festlegen</p>
                    <p className="text-sm text-muted-foreground">Diese Auswahl definiert deinen Kompetenzrahmen. Hintergrundpunkte folgen direkt darunter.</p>
                  </div>
                  <Badge variant={poolSkills.length === 4 ? 'default' : 'outline'}>{poolSkills.length} / 4</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {skillPool.map((skill, index) => (
                    <SkillSelectField
                      key={index}
                      value={skill}
                      onValueChange={(value) => onPoolSkillChange(index, value)}
                      skillOptions={allSkillKeys}
                      disabledSkillKeys={skillPool.filter((current, currentIndex): current is SagaTreeSkillKey => currentIndex !== index && isSagaTreeSkillKey(current))}
                      placeholder={`Fertigkeit ${index + 1}`}
                      ariaLabel={`Hintergrund-Fertigkeit ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {showSkillGraph ? (
            <div className="space-y-2 -mt-2">
              <BackgroundSkillConnector
                skills={visibleSkillNodes}
                trainedSkills={occupiedBackgroundSkills}
                activeSkill={activeSkill}
                scrollPhase={scrollPhase}
                onStandstill={handleStandstill}
              />

              {/* Centered pool block on large screens; mobile stays full-width stacked. */}
              <div className="mx-auto w-full max-w-5xl space-y-2">
                <div
                  className="mx-auto grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-4"
                  data-background-skill-grid
                  data-training-view={skillGraphViewMode}
                >
                  {visibleSkillNodes.map((skillKey) => (
                    <BackgroundSkillNode
                      key={skillKey}
                      skillKey={skillKey}
                      pointValue={(backgroundSkillPoints[skillKey] ?? 0) as 0 | 1 | 2}
                      pointsUsed={backgroundPointsUsed}
                      backgroundPointsComplete={backgroundPointsComplete}
                      isSpecializationTarget={specializationSkill === skillKey}
                      specializationName={specializationSkill === skillKey ? specializationName : ''}
                      specializationOptions={getBackgroundSpecializationSuggestionNames(selectedTemplate, skillKey)}
                      onHoverChange={(skill) => setActiveSkill(skill)}
                      onAdjust={handleBackgroundPointAdjust}
                      onSpecialize={handleSpecialize}
                      onSpecializationNameChange={onSpecializationNameChange}
                      onSpecializationApply={handleSpecializationApply}
                    />
                  ))}
                </div>

                {!backgroundPointsComplete ? (
                  <div className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-3 text-center text-sm text-muted-foreground">
                    Verteile zuerst alle 2 Hintergrundpunkte. Danach wird die Spezialisierung freigeschaltet.
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-4 text-sm text-muted-foreground">
              {customMode
                ? 'Vervollständige zuerst alle vier Pool-Fertigkeiten. Danach verbindet der Graph sie mit dem gewählten Hintergrund.'
                : 'Pool wird geladen …'}
            </div>
          )}
        </div>
      )}

      {hasChoice ? (
        <div className="rounded-lg border border-border bg-muted/10 p-4">
          <div className="mb-4">
            <p className="font-medium">Verankerung in der Welt</p>
            <p className="mt-1 text-sm text-muted-foreground">Milieu, Kontakt, Komplikation und Kommunikation gehören zu deiner Vergangenheit, aber nicht in den mechanischen Skill-Graphen.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="milieu">Milieuzugang</Label><Input id="milieu" value={milieuAccess} onChange={(event) => onMilieuAccessChange(event.target.value)} placeholder="z. B. Notaufnahmen, Unterwelt, Akademien" /><SuggestionButtons values={selectedTemplate?.milieuSuggestions} onSelect={onMilieuAccessChange} /></div>
            <div className="space-y-2"><Label htmlFor="contact">Kontakt</Label><Input id="contact" value={contact} onChange={(event) => onContactChange(event.target.value)} placeholder="Wer kann dir helfen?" /><SuggestionButtons values={selectedTemplate?.contactSuggestions} onSelect={onContactChange} /></div>
            <div className="space-y-2"><Label htmlFor="complication">Komplikation</Label><Input id="complication" value={complication} onChange={(event) => onComplicationChange(event.target.value)} placeholder="z. B. alte Schulden, gesuchte Identität" /><SuggestionButtons values={selectedTemplate?.complicationSuggestions} onSelect={onComplicationChange} /></div>
            <div className="space-y-2"><Label htmlFor="communication">Zusätzliche Kommunikationsform</Label><Input id="communication" value={communication} onChange={(event) => onCommunicationChange(event.target.value)} placeholder="z. B. Gebärdensprache, Funkcodes" /><SuggestionButtons values={selectedTemplate?.communicationSuggestions} onSelect={onCommunicationChange} /></div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function getAllSkillKeys(): SagaTreeSkillKey[] {
  return [
    'athletics', 'acrobatics', 'sleight', 'stealth', 'melee', 'ranged', 'awareness', 'insight', 'survival',
    'investigation', 'knowledge', 'technology', 'medicine', 'driving', 'persuasion', 'deception', 'intimidation', 'performance',
  ];
}
