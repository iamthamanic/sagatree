/**
 * StartingTemplateIcon — Phosphor icon per SagaTree Level-1 starttemplate key.
 * Location: src/app/character/creation/StartingTemplateIcon.tsx
 */
import {
  Axe,
  Brain,
  Cpu,
  Crosshair,
  Eye,
  Heartbeat,
  Megaphone,
  Sparkle,
  MaskHappy,
  Wrench,
  type Icon
} from '@phosphor-icons/react';
import type { SagaTreeStartingTemplateKey } from '../../../domains/rules/sagatree/starting-templates';

const STARTING_TEMPLATE_ICONS: Record<SagaTreeStartingTemplateKey, Icon> = {
  berserker: Axe,
  vanguard: Crosshair,
  mage: Sparkle,
  technomancer: Cpu,
  medicus: Heartbeat,
  mystic: Eye,
  assassin: MaskHappy,
  mechanom: Wrench,
  mentalist: Brain,
  herald: Megaphone,
};

type StartingTemplateIconProps = {
  templateKey: SagaTreeStartingTemplateKey;
  className?: string;
};

export function StartingTemplateIcon({
  templateKey,
  className = 'h-4 w-4',
}: StartingTemplateIconProps) {
  const Icon = STARTING_TEMPLATE_ICONS[templateKey];
  return <Icon className={className} aria-hidden="true" />;
}
