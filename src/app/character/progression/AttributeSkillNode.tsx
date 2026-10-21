/**
 * AttributeSkillNode — Centered skill card under the attribute carousel
 * (BackgroundSkillNode visual language: icon, name, Question attribute hint).
 * Location: src/app/character/progression/AttributeSkillNode.tsx
 */
import {
  Question,
  Minus,
  Plus
} from '@phosphor-icons/react';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../shared/ui/tooltip';
import {
  getSagaTreeAttribute,
  getSagaTreeSkill,
  type SagaTreeSkillKey,
} from '../../../domains/rules/sagatree/character-creation';
import { SkillIcon } from './SkillIcon';

function rankLabel(rank: number): string {
  if (rank <= 0) return 'Untrainiert';
  if (rank === 1) return 'Trainiert';
  if (rank === 2) return 'Geübt';
  if (rank === 3) return 'Fachkundig';
  if (rank === 4) return 'Meisterlich';
  return 'Weltklasse';
}

interface AttributeSkillNodeProps {
  skillKey: SagaTreeSkillKey;
  finalRank: number;
  backgroundValue: number;
  inBackgroundPool: boolean;
  archetypeTrained: boolean;
  backgroundSpecializationName?: string;
  developmentSpecializationNames: readonly string[];
  focused: boolean;
  canDecreaseFree: boolean;
  canIncreaseFree: boolean;
  onSelect: () => void;
  onHoverChange: (skill: SagaTreeSkillKey | null) => void;
  onChangeFreeRank: (delta: -1 | 1) => void;
}

export function AttributeSkillNode({
  skillKey,
  finalRank,
  backgroundValue,
  inBackgroundPool,
  archetypeTrained,
  backgroundSpecializationName,
  developmentSpecializationNames,
  focused,
  canDecreaseFree,
  canIncreaseFree,
  onSelect,
  onHoverChange,
  onChangeFreeRank,
}: AttributeSkillNodeProps) {
  const skill = getSagaTreeSkill(skillKey);
  const attribute = getSagaTreeAttribute(skill.attribute);

  return (
    <div className="min-w-0" data-attribute-skill-node={skillKey}>
      <div
        role="button"
        tabIndex={0}
        aria-pressed={focused}
        aria-label={`${skill.label} auswählen`}
        onMouseEnter={() => onHoverChange(skillKey)}
        onMouseLeave={() => onHoverChange(null)}
        onFocus={() => {
          onHoverChange(skillKey);
          onSelect();
        }}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
          }
        }}
        className={`relative flex min-h-28 w-full flex-col items-center rounded-lg border p-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          focused
            ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
            : inBackgroundPool
              ? 'border-primary/30 bg-card hover:border-primary/60'
              : 'border-border bg-card hover:border-primary/60'
        }`}
      >
        <div className="flex flex-col items-center gap-1.5">
          <SkillIcon skillKey={skillKey} className="h-7 w-7 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="font-medium">{skill.label}</p>
            <span className="mt-1 inline-flex items-center justify-center gap-1">
              <span
                className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                aria-hidden="true"
              >
                {attribute.shortLabel}
              </span>
              <Tooltip pinOnClick={false}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Standardattribut ${attribute.label} erklären`}
                    className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-primary hover:bg-primary/10"
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <Question className="pointer-events-none size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6} className="max-w-[280px] px-3 py-2 text-left text-xs leading-relaxed">
                  Beim Check wird das Attribut {attribute.label} verwendet — das standardmäßig verknüpfte Attribut
                  für diesen Fertigkeits-Check, nicht Hintergrund- oder Pool-Punkte.
                </TooltipContent>
              </Tooltip>
            </span>
          </div>
          <div className="pt-0.5">
            <p className="text-lg font-semibold tabular-nums">{finalRank}</p>
            <p className="text-[11px] text-muted-foreground">{rankLabel(finalRank)}</p>
          </div>
        </div>

        <div className="mt-2 flex min-h-6 flex-wrap justify-center gap-1.5">
          {inBackgroundPool ? <Badge variant="outline">Hintergrund-Pool</Badge> : null}
          {backgroundValue > 0 ? <Badge variant="outline">Hintergrund +{backgroundValue}</Badge> : null}
          {archetypeTrained ? <Badge variant="outline">Archetyp +1</Badge> : null}
          {backgroundSpecializationName ? <Badge>{backgroundSpecializationName} +2</Badge> : null}
          {developmentSpecializationNames.map((name) => (
            <Badge key={name} variant="secondary">{name}</Badge>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10"
            onClick={(event) => {
              event.stopPropagation();
              onChangeFreeRank(-1);
            }}
            disabled={!canDecreaseFree}
            aria-label={`${skill.label} freien Punkt entfernen`}
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10"
            onClick={(event) => {
              event.stopPropagation();
              onChangeFreeRank(1);
            }}
            disabled={!canIncreaseFree}
            aria-label={`${skill.label} freien Punkt hinzufügen`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
