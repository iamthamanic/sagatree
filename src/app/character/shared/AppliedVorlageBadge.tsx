/**
 * AppliedVorlageBadge — Badge for the create-flow Vorlage that seeded CharacterEditor
 * (system starttemplate or user preset). Location: src/app/character/shared/AppliedVorlageBadge.tsx
 */
import {
  Bookmark
} from '@phosphor-icons/react';
import type { SagaTreeStartingTemplateKey } from '../../../domains/rules/sagatree/starting-templates';
import { Badge } from '../../../shared/ui/badge';
import { StartingTemplateIcon } from '../creation/StartingTemplateIcon';

export type AppliedVorlage =
  | {
      kind: 'starting-template';
      templateKey: SagaTreeStartingTemplateKey;
      labelDe: string;
    }
  | {
      kind: 'preset';
      labelDe: string;
    };

type AppliedVorlageBadgeProps = {
  vorlage: AppliedVorlage;
  className?: string;
};

export function AppliedVorlageBadge({ vorlage, className = '' }: AppliedVorlageBadgeProps) {
  const label = vorlage.labelDe.trim();
  if (!label) return null;

  const aria =
    vorlage.kind === 'starting-template'
      ? `Starttemplate: ${label}`
      : `Preset: ${label}`;

  return (
    <Badge
      variant="outline"
      data-testid="applied-vorlage-badge"
      data-vorlage-kind={vorlage.kind}
      aria-label={aria}
      className={`flex max-w-full min-w-0 items-center gap-1.5 ${className}`}
    >
      {vorlage.kind === 'starting-template' ? (
        <StartingTemplateIcon templateKey={vorlage.templateKey} className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <Bookmark className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      <span className="truncate">{label}</span>
    </Badge>
  );
}
