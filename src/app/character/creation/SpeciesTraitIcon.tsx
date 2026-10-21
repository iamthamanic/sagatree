/**
 * SpeciesTraitIcon — Phosphor icon for each SagaTree species trait option.
 * Location: src/app/character/creation/SpeciesTraitIcon.tsx
 */
import {
  Pulse,
  Bird,
  Dna,
  Ear,
  Eye,
  Fish,
  Flame,
  Mountains,
  Moon,
  Shield,
  ShieldCheck,
  Sword,
  Tree,
  Waves,
  type Icon
} from '@phosphor-icons/react';
import type { SagaTreeSpeciesTraitKey } from '../../../domains/rules/sagatree/character-creation';

const SPECIES_TRAIT_ICONS: Record<SagaTreeSpeciesTraitKey, Icon> = {
  'sharpened-sense': Ear,
  'natural-weapon': Sword,
  'narrow-resistance': ShieldCheck,
  'environment-adaptation': Tree,
  'enduring-organism': Pulse,
  'low-rest-need': Moon,
  'natural-protection': Shield,
  'enhanced-climbing': Mountains,
  'enhanced-swimming': Waves,
  amphibious: Fish,
  'enhanced-sight': Eye,
  flight: Bird,
  'extreme-environment': Flame,
  'exceptional-body': Dna,
};

type SpeciesTraitIconProps = {
  traitKey: SagaTreeSpeciesTraitKey;
  className?: string;
};

export function SpeciesTraitIcon({ traitKey, className = 'h-4 w-4' }: SpeciesTraitIconProps) {
  const Icon = SPECIES_TRAIT_ICONS[traitKey];
  return <Icon className={className} aria-hidden="true" />;
}
