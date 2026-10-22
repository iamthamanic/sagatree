/**
 * ArchetypeIcon — Phosphor icon for each SagaTree primary archetype option.
 * Location: src/app/character/creation/ArchetypeIcon.tsx
 */
import {
  Brain,
  Handshake,
  Heartbeat,
  Sword,
  MaskHappy,
  type Icon
} from '@phosphor-icons/react';
import type { SagaTreeArchetypeKey } from '../../../domains/rules/sagatree/character-creation';

const ARCHETYPE_ICONS: Record<SagaTreeArchetypeKey, Icon> = {
  fighter: Sword,
  thinker: Brain,
  healer: Heartbeat,
  rebel: MaskHappy,
  diplomat: Handshake,
};

type ArchetypeIconProps = {
  archetypeKey: SagaTreeArchetypeKey;
  className?: string;
};

export function ArchetypeIcon({ archetypeKey, className = 'h-4 w-4' }: ArchetypeIconProps) {
  const Icon = ARCHETYPE_ICONS[archetypeKey];
  return <Icon className={className} aria-hidden="true" />;
}
