/**
 * avatar-presets — Race presets, appearance normalization, and safe URL helpers.
 * Location: src/domains/character/use-cases/avatar-presets.ts
 */
import type {
  CharacterAppearanceDto,
  CharacterAvatarDto,
  CharacterAvatarFormat,
} from '../domain/character.entity';
import type { AvatarSource } from '../avatar/avatar-source';
import { LEGACY_AVATAR_PROVIDER } from '../avatar/avatar-source';
import { serializePersistedBaseTraits } from '../avatar/trait-layers';

const DEFAULT_HAIR_COLOR = '#000000';
const DEFAULT_SKIN_TONE = '#F5E6D3';

export interface AvatarRacePreset {
  id: string;
  baseBody: 'humanoid-medium' | 'humanoid-short' | 'humanoid-heavy' | 'humanoid-tall';
  head: string;
  ears: string;
  hair: string;
  clothing: string;
  accessory?: string;
  skinTone: string;
  hairColor: string;
  bodySize: number;
  height: number;
}

const neutralPreset: AvatarRacePreset = {
  id: 'humanoid-neutral',
  baseBody: 'humanoid-medium',
  head: 'neutral-soft',
  ears: 'round',
  hair: 'short',
  clothing: 'casual',
  skinTone: DEFAULT_SKIN_TONE,
  hairColor: DEFAULT_HAIR_COLOR,
  bodySize: 50,
  height: 50,
};

export const avatarRacePresets: Readonly<Record<string, AvatarRacePreset>> = {
  human: {
    ...neutralPreset,
    id: 'fantasy-human',
    head: 'human-balanced',
  },
  elf: {
    ...neutralPreset,
    id: 'fantasy-elf',
    baseBody: 'humanoid-tall',
    head: 'elf-angular',
    ears: 'elf-long',
    hair: 'long',
    clothing: 'robe',
    skinTone: '#E7C8B1',
    bodySize: 42,
    height: 62,
  },
  dwarf: {
    ...neutralPreset,
    id: 'fantasy-dwarf',
    baseBody: 'humanoid-heavy',
    head: 'dwarf-broad',
    ears: 'round',
    hair: 'braided',
    clothing: 'armor',
    hairColor: '#4A2A1C',
    bodySize: 74,
    height: 32,
  },
  halfling: {
    ...neutralPreset,
    id: 'fantasy-halfling',
    baseBody: 'humanoid-short',
    head: 'halfling-soft',
    hair: 'wild',
    clothing: 'leather',
    bodySize: 38,
    height: 26,
  },
  orc: {
    ...neutralPreset,
    id: 'fantasy-orc',
    baseBody: 'humanoid-heavy',
    head: 'orc-heavy',
    ears: 'orc-pointed',
    hair: 'wild',
    clothing: 'armor',
    skinTone: '#78966A',
    hairColor: '#211F1C',
    bodySize: 82,
    height: 68,
  },
  cyborg: {
    ...neutralPreset,
    id: 'scifi-cyborg',
    head: 'cyborg-angular',
    ears: 'synthetic',
    hair: 'short',
    clothing: 'armor',
    accessory: 'optic-implant',
    skinTone: '#C7C7C7',
    hairColor: '#20242A',
    bodySize: 58,
    height: 56,
  },
  alien: {
    ...neutralPreset,
    id: 'scifi-alien',
    baseBody: 'humanoid-tall',
    head: 'alien-oval',
    ears: 'none',
    hair: 'bald',
    clothing: 'robe',
    skinTone: '#86C7B5',
    hairColor: '#213438',
    bodySize: 36,
    height: 72,
  },
};

export const CHARACTER_STUDIO_DEMO_URL = 'https://m3-org.github.io/CharacterStudio/';

export function getAvatarPresetForRace(race: string): string {
  return getAvatarRacePreset(race).id;
}

export function getAvatarRacePreset(race: string): AvatarRacePreset {
  return avatarRacePresets[race.trim().toLowerCase()] ?? neutralPreset;
}

export function normalizeHexColor(value: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : fallback;
}

/** Local signed asset URLs are http://localhost — allow loopback only. */
function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
}

/**
 * Sanitize asset URLs: relative paths, HTTPS remotes, or HTTP loopback (local storage).
 * Rejects arbitrary http hosts to avoid open redirects / mixed-content surprises in prod.
 */
export function normalizeSafeUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('/')) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.protocol === 'https:') return url.toString();
    if (url.protocol === 'http:' && isLoopbackHostname(url.hostname)) {
      return url.toString();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function normalizeAvatarModelUrl(value: string): string | undefined {
  const safeUrl = normalizeSafeUrl(value);
  if (!safeUrl) return undefined;

  const path = safeUrl.replace(/[?#].*$/, '').toLowerCase();
  return path.endsWith('.vrm') || path.endsWith('.glb') ? safeUrl : undefined;
}

function inferAvatarFormat(modelUrl?: string): CharacterAvatarFormat {
  if (!modelUrl) return 'vrm';
  const path = modelUrl.replace(/[?#].*$/, '').toLowerCase();
  return path.endsWith('.glb') ? 'glb' : 'vrm';
}

export function createCharacterStudioAvatar(input: {
  race: string;
  head?: string;
  ears?: string;
  hairStyle: string;
  clothing: string;
  accessory?: string;
  hairColor: string;
  skinTone: string;
  bodySize: number;
  height: number;
  modelUrl?: string;
  source?: AvatarSource;
}): CharacterAvatarDto {
  const modelUrl = normalizeAvatarModelUrl(input.modelUrl ?? '');
  const preset = getAvatarRacePreset(input.race);

  const traits = serializePersistedBaseTraits({
    head: input.head || preset.head,
    ears: input.ears || preset.ears,
    hair: input.hairStyle || preset.hair,
    clothing: input.clothing || preset.clothing,
    accessory: input.accessory || preset.accessory || 'none',
  });

  return {
    schema_version: 1,
    provider: LEGACY_AVATAR_PROVIDER,
    source: input.source ?? 'sagatree',
    preset: preset.id,
    model_format: inferAvatarFormat(modelUrl),
    model_url: modelUrl,
    traits,
    colors: {
      hair: normalizeHexColor(input.hairColor, preset.hairColor),
      skin: normalizeHexColor(input.skinTone, preset.skinTone),
    },
    body: {
      size: Math.max(0, Math.min(100, input.bodySize)),
      height: Math.max(0, Math.min(100, input.height)),
    },
  };
}

export function normalizeCharacterAppearance(
  appearance?: Partial<CharacterAppearanceDto> | null,
): CharacterAppearanceDto {
  const bodySize = appearance?.body_size ?? appearance?.avatar?.body?.size ?? 50;
  const height = appearance?.height ?? appearance?.avatar?.body?.height ?? 50;

  return {
    body_size: bodySize,
    height,
    face_features: appearance?.face_features ?? appearance?.avatar?.traits.head ?? 'default',
    hair_style: appearance?.hair_style ?? appearance?.avatar?.traits.hair ?? 'short',
    hair_color: normalizeHexColor(
      appearance?.hair_color ?? appearance?.avatar?.colors.hair ?? DEFAULT_HAIR_COLOR,
      DEFAULT_HAIR_COLOR,
    ),
    skin_tone: normalizeHexColor(
      appearance?.skin_tone ?? appearance?.avatar?.colors.skin ?? DEFAULT_SKIN_TONE,
      DEFAULT_SKIN_TONE,
    ),
    clothing: appearance?.clothing ?? appearance?.avatar?.traits.clothing ?? 'casual',
    ...(appearance?.gender_reading ? { gender_reading: appearance.gender_reading } : {}),
    ...(appearance?.personal_look_profile_id !== undefined
      ? { personal_look_profile_id: appearance.personal_look_profile_id }
      : {}),
    avatar: appearance?.avatar,
  };
}
