/**
 * EssenceIcon — Phosphor icon for each SagaTree primary essence option.
 * Location: src/app/character/creation/EssenceIcon.tsx
 */
import {
  Brain,
  Circuitry,
  Ghost,
  Link,
  PersonSimple,
  type Icon
} from '@phosphor-icons/react';
import type { SagaTreeEssenceKey } from '../../../domains/rules/sagatree/character-creation';

const ESSENCE_ICONS: Record<SagaTreeEssenceKey, Icon> = {
  physical: PersonSimple,
  mental: Brain,
  spiritual: Ghost,
  bound: Link,
  technological: Circuitry,
};

type EssenceIconProps = {
  essenceKey: SagaTreeEssenceKey;
  className?: string;
};

export function EssenceIcon({ essenceKey, className = 'h-4 w-4' }: EssenceIconProps) {
  const Icon = ESSENCE_ICONS[essenceKey];
  return <Icon className={className} aria-hidden="true" />;
}
