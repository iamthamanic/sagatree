/**
 * GenderReadingIcon — Phosphor icon for character gender-reading options in the editor.
 * Location: src/app/character/creation/GenderReadingIcon.tsx
 */
import {
  GenderMale,
  GenderNonbinary,
  GenderFemale,
  type Icon
} from '@phosphor-icons/react';
import type { CharacterGenderReading } from '../../../domains/character';

const GENDER_READING_ICONS: Record<CharacterGenderReading, Icon> = {
  'masculine-read': GenderMale,
  'feminine-read': GenderFemale,
  diverse: GenderNonbinary,
};

type GenderReadingIconProps = {
  value: CharacterGenderReading;
  className?: string;
};

export function GenderReadingIcon({ value, className = 'h-4 w-4' }: GenderReadingIconProps) {
  const Icon = GENDER_READING_ICONS[value];
  return <Icon className={className} aria-hidden="true" />;
}
