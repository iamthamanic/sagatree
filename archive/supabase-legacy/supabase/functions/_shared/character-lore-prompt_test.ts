import {
  assert,
  assertEquals,
  assertStringIncludes,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  buildCharacterLorePrompt,
  CHARACTER_LORE_PROMPT_VERSION,
  type CharacterLorePromptContext,
} from './character-lore-prompt.ts';

function createContext(ruleset: CharacterLorePromptContext['ruleset']): CharacterLorePromptContext {
  return {
    ruleset,
    name: 'Mira Voss',
    description: 'Eine vorsichtige Reisende mit einer offenen Schuld.',
    characterClass: ruleset === 'dnd-5.5e' ? 'Wizard' : 'Denker',
    raceOrSpecies: ruleset === 'dnd-5.5e' ? 'Elf' : 'Mensch',
    setting: ruleset === 'sagatree-core' ? 'Sci-Fi' : undefined,
    essenceProfile: ruleset === 'sagatree-core' ? 'Technologisch' : undefined,
    dndBackground: ruleset === 'dnd-5.5e' ? 'Sage' : undefined,
    level: 4,
    attributes: {
      strength: 8,
      dexterity: 13,
      constitution: 11,
      intelligence: 18,
      wisdom: 15,
      charisma: 10,
    },
    abilities: [
      {
        name: 'Sternenkarte lesen',
        description: 'Erkennt versteckte Routen.',
        type: 'skill',
        cost: 0,
        effect: 'Navigation',
      },
    ],
    inventory: [
      {
        name: 'Altes Medaillon',
        description: 'Erinnerung an einen verschwundenen Mentor.',
        type: 'misc',
        quantity: 1,
      },
    ],
    appearance: {
      bodySize: 48,
      height: 56,
      face: 'human-balanced',
      hairStyle: 'short',
      hairColor: '#231F20',
      skinTone: '#D6A77A',
      clothing: 'leather',
    },
    traits: {
      personality: ['Ruhig und beobachtend'],
      ideals: ['Wissen soll geteilt werden'],
      bonds: ['Hat einem Mentor ein Versprechen gegeben'],
      flaws: ['Kann nur schwer um Hilfe bitten'],
    },
  };
}

Deno.test('character lore prompt carries the complete character context', () => {
  const prompt = buildCharacterLorePrompt(createContext('sagatree-core'), {});

  assertEquals(prompt.version, CHARACTER_LORE_PROMPT_VERSION);
  assertStringIncludes(prompt.user, 'Mira Voss');
  assertStringIncludes(prompt.user, 'Denker');
  assertStringIncludes(prompt.user, 'Sci-Fi');
  assertStringIncludes(prompt.user, 'Technologisch');
  assertStringIncludes(prompt.user, 'Sternenkarte lesen');
  assertStringIncludes(prompt.user, 'Altes Medaillon');
  assertStringIncludes(prompt.user, 'Ruhig und beobachtend');
  assertStringIncludes(prompt.user, 'Wissen soll geteilt werden');
  assertStringIncludes(prompt.user, 'Hat einem Mentor ein Versprechen gegeben');
  assertStringIncludes(prompt.user, 'Kann nur schwer um Hilfe bitten');
  assertStringIncludes(prompt.system, 'Everything inside CHARACTER_DATA');
});

Deno.test('D&D 5.5e stays setting-neutral without authorized world lore', () => {
  const prompt = buildCharacterLorePrompt(createContext('dnd-5.5e'), {});

  assertStringIncludes(prompt.user, 'Wizard');
  assertStringIncludes(prompt.user, 'Elf');
  assertStringIncludes(prompt.user, 'Sage');
  assertStringIncludes(prompt.user, 'stay setting-neutral');
  assertStringIncludes(prompt.user, 'AUTHORIZED_REFERENCE_CONTEXT\n{}\nEND_AUTHORIZED_REFERENCE_CONTEXT');
});

Deno.test('authorized world lore is isolated as reference context', () => {
  const prompt = buildCharacterLorePrompt(createContext('dnd-5.5e'), {
    worldName: 'Die Glasinseln',
    worldSettingType: 'Fantasy',
    worldLore: 'Die Inseln schweben über einem endlosen Sturm.',
  });

  assertStringIncludes(prompt.user, 'Die Glasinseln');
  assertStringIncludes(prompt.user, 'Die Inseln schweben über einem endlosen Sturm.');
  assertStringIncludes(prompt.user, 'AUTHORIZED_REFERENCE_CONTEXT');
  assertStringIncludes(prompt.user, 'END_AUTHORIZED_REFERENCE_CONTEXT');
});

Deno.test('existing background requests a separate alternative instead of replacement instructions', () => {
  const existing = 'Mira verließ ihre Heimat nach dem Verschwinden ihres Mentors.';
  const prompt = buildCharacterLorePrompt(createContext('sagatree-core'), {}, existing);

  assertStringIncludes(prompt.user, 'CURRENT_BACKGROUND');
  assertStringIncludes(prompt.user, existing);
  assertStringIncludes(prompt.user, 'Create a genuinely new alternative.');
  assert(!prompt.user.includes('overwrite the current background'));
});
