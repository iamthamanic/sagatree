/**
 * SkillIcon — Phosphor icon for each SagaTree skill option in selects and lists.
 * Location: src/app/character/progression/SkillIcon.tsx
 */
import {
  BookOpen,
  Car,
  Compass,
  Crosshair,
  Cpu,
  Barbell,
  EyeSlash,
  FileMagnifyingGlass,
  Hand,
  Handshake,
  Heartbeat,
  Microphone,
  Scan,
  Skull,
  Sword,
  Users,
  MaskHappy,
  Lightning,
  type Icon
} from '@phosphor-icons/react';
import type { SagaTreeSkillKey } from '../../../domains/rules/sagatree/character-creation';

const SKILL_ICONS: Record<SagaTreeSkillKey, Icon> = {
  athletics: Barbell,
  acrobatics: Lightning,
  sleight: Hand,
  stealth: EyeSlash,
  melee: Sword,
  ranged: Crosshair,
  awareness: Scan,
  insight: Users,
  survival: Compass,
  investigation: FileMagnifyingGlass,
  knowledge: BookOpen,
  technology: Cpu,
  medicine: Heartbeat,
  driving: Car,
  persuasion: Handshake,
  deception: MaskHappy,
  intimidation: Skull,
  performance: Microphone,
};

type SkillIconProps = {
  skillKey: SagaTreeSkillKey;
  className?: string;
};

export function SkillIcon({ skillKey, className = 'h-4 w-4' }: SkillIconProps) {
  const Icon = SKILL_ICONS[skillKey];
  return <Icon className={className} aria-hidden="true" />;
}
