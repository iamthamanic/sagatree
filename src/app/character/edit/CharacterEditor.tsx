import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle,
  Question,
  Eye,
  FloppyDisk,
  UploadSimple,
  X
} from '@phosphor-icons/react';
import { toast } from 'sonner@2.0.3';
import type { CharacterStudioRuntime } from '../../../infrastructure/character/avatar/character-studio-runtime';
import { CharacterLookSelector } from '../../look';
import { AvatarSurfaceViewer } from '../avatar/AvatarSurfaceViewer';
import { AvatarImportPanel } from '../avatar/AvatarImportPanel';
import { AvatarMeshyPanel } from '../avatar/AvatarMeshyPanel';
import { AvatarMeshyGeneratingOverlay } from '../avatar/AvatarMeshyGeneratingOverlay';
import { AvatarModularGenerateProgress } from '../avatar/AvatarModularGenerateProgress';
import { AvatarSourceSelector } from '../avatar/AvatarSourceSelector';
import { AvatarSpeciesTemplatePicker } from '../avatar/AvatarSpeciesTemplatePicker';
import { HumanLiveActMeshVariantSelect } from '../avatar/HumanLiveActMeshVariantSelect';
import { AvatarTraitPanels } from '../avatar/AvatarTraitPanels';
import { BaseBodyMorphFixture } from '../avatar/BaseBodyMorphFixture';
import { AvatarMorphEditorPanels } from '../avatar/AvatarMorphEditorPanels';
import { isMeshyAvatarJobBusy } from '../../../domains/character/avatar';
import { useCharacterAvatarEditor } from './useCharacterAvatarEditor';
import { characterService } from '../../../infrastructure/character/character-service';
import { materializeAvatarSaveExport } from '../../../infrastructure/character/avatar/character-avatar-export-service';
import { resolveAvatarModelUrl } from '../../../infrastructure/character/avatar/avatar-asset-manifests';
import type {
  AbilityDto,
  CharacterAppearanceDto,
  CharacterAttributesDto,
  CharacterGenderReading,
  ItemDto,
  SagaTreeProfileDto,
  SagaTreeSpeciesTraitInstanceDto,
} from '../../../domains/character';
import type { CharacterLoreContext } from '../../../domains/character/contracts/character-lore.types';
import { AttributeD20Icon } from '../../../shared/ui/AttributeD20Icon';
import { DerivedStatCard } from '../shared/DerivedStatCard';
import { AttributeDerivedConnector } from '../../../shared/ui/AttributeDerivedConnector';
import { AppliedVorlageBadge, type AppliedVorlage } from '../shared/AppliedVorlageBadge';
import { IncompleteTabHint } from '../shared/IncompleteTabHint';
import { IdentityPreviewPills } from '../shared/IdentityPreviewPills';
import { CharacterAssistantButton } from '../assistant/CharacterAssistantButton';
import {
  CharacterArchetypePanel,
  CharacterBackgroundComposer,
  CharacterBackgroundPanel,
  CharacterEssencePanel,
  GenderReadingSelect,
  SpeciesCarousel,
  SpeciesTraitsPanel,
} from '../creation';
import {
  CharacterInventoryV2Panel,
  CharacterNotesSection,
  CharacterPresetPanel,
  CharacterSkillsPanel,
  CharacterStatisticsPanel,
  CharacterTraitEditor,
  RuleHelp,
  type InventoryLoadInfo,
} from '../progression';
import type { InventoryState } from '../../../domains/character/inventory-v2';
import {
  type CharacterAbstractResources,
} from '../../../domains/rules/sagatree/items';
import { getAuthenticatedUserId } from '../../../lib/authenticatedUser';
import { takeCharacterEditorBootstrap, clearCharacterEditorBootstrap } from '../shared/characterEditorBootstrap';
import type { NpcPromotionPlan } from '../../../domains/npc-creature';
import { promoteNpcCreatureCompactToFull } from '../../../infrastructure/npc-creature/npc-creature-service';
import { assertValidSnapshot, characterPresetService } from '../../../infrastructure/character/character-preset-service';
import type { CharacterPresetReleaseMode, CharacterPresetSnapshot } from '../../../domains/character/contracts/character-preset.types';
import { buildSagaTreeDerivedStatCards } from './map-derived-stat-cards';
import { getSagaTreeBackgroundTemplate } from '../../../domains/rules/sagatree/background-templates';
import {
  getSagaTreeStartingTemplate,
  validateSagaTreeStartingTemplate,
} from '../../../domains/rules/sagatree/starting-templates';
import {
  SAGA_TREE_ATTRIBUTE_ADVANCE_LEVELS,
  SAGA_TREE_ATTRIBUTE_BONUS_CAP,
  SAGA_TREE_START_ATTRIBUTE_BONUS_BUDGET,
  SAGA_TREE_START_ATTRIBUTE_BONUS_CAP,
  applySagaTreeAttributeAdvances,
  canAssignSagaTreeAttributeAdvance,
  getSagaTreeAttributeAdvanceBudget,
  getSagaTreeAttributeAdvanceLevels,
  getSagaTreeAttributeBonusLevelGuide,
  getSagaTreeBaseAttributePointsUsed,
  isValidSagaTreeAttributeBuild,
  resolveSagaTreeAttributeBuildState,
  type SagaTreeAttributeAdvanceLevel,
  type SagaTreeAttributeAdvances,
} from '../../../domains/rules/sagatree/attribute-progression';
import {
  SAGA_TREE_SPECIES_TRAIT_BUDGET,
  SAGA_TREE_START_FREE_SKILL_POINTS,
  characterRulesetOptions,
  createEmptySagaTreeSkillRanks,
  getCharacterCreationOptionLabel,
  getSagaTreeArchetype,
  getSagaTreeEssence,
  getSagaTreeSpeciesTrait,
  getSagaTreeSpeciesTraitCost,
  getSagaTreeSpeciesTraitKeysForRace,
  isCharacterRulesetKey,
  isSagaTreeArchetypeKey,
  isSagaTreeEssenceKey,
  isSagaTreeSkillKey,
  normalizeSagaTreeRaceKey,
  sagaTreeAttributeDefinitions,
  sagaTreeRaceOptions,
  sagaTreeSkillDefinitions,
  type CharacterRulesetKey,
  type SagaTreeArchetypeKey,
  type SagaTreeAttributeKey,
  type SagaTreeEssenceKey,
  type SagaTreeSkillKey,
} from '../../../domains/rules/sagatree/character-creation';
import {
  SAGA_TREE_START_BACKGROUND_SKILL_POINTS,
  backgroundSkillPointsToTrainedSkills,
  getSagaTreeExperienceBonus,
  getSagaTreeSkillCap,
  isValidBackgroundSkillPoints,
  isValidSagaTreeSkillDevelopment,
  isValidStartSkillBuild,
  normalizeFreeSkillRanks,
  resolveSagaTreeSkillBuildState,
  resolveSagaTreeSkillRanksSafe,
  sumBackgroundSkillPointsUsed,
  type SagaTreeBackgroundSkillPoints,
  type SagaTreeSkillAdvanceDto,
  type SagaTreeSpecializationRecordDto,
} from '../../../domains/rules/sagatree/skill-progression';
import { getSagaTreeSpeciesTraitOptionCatalog } from '../../../domains/rules/sagatree/species-trait-options';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import { Card, CardContent, CardHeader } from '../../../shared/ui/card';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import { Select, SelectContent, SelectItem, SelectItemText, SelectTrigger, SelectValue } from '../../../shared/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../shared/ui/tooltip';
import { Separator } from '../../../shared/ui/separator';
import { Slider } from '../../../shared/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../shared/ui/tabs';
import { cn } from '../../../shared/ui/utils';
import type { CharacterSheetStatus } from '../../../domains/character/contracts/character.views';
import {
  resolveLoadedInventoryV2,
  useCharacterInventoryEditor,
} from './useCharacterInventoryEditor';

type ActivityTrackingWindow = Window & { trackActivity?: (description: string) => void };
type EditorTab = 'info' | 'values' | 'appearance' | 'inventory' | 'settings';
type ValuesSubTab = 'attributes' | 'background' | 'details' | 'archetype' | 'essenz';
type SettingsSubTab = 'statistics' | 'preset';
type ValidationProblem = { tab: EditorTab; message: string; valuesSubTab?: ValuesSubTab };
type SkillSlot = SagaTreeSkillKey | '';
type BackgroundSkillPool = [SkillSlot, SkillSlot, SkillSlot, SkillSlot];
const INITIAL_ATTRIBUTES: CharacterAttributesDto = { strength: 4, dexterity: 3, endurance: 3, mind: 2, perception: 2, charisma: 1 };

const trackActivity = (description: string) => {
  if (typeof window === 'undefined') return;
  (window as ActivityTrackingWindow).trackActivity?.(description);
};

function isEditorTab(value: string): value is EditorTab {
  return value === 'info' || value === 'values' || value === 'appearance' || value === 'inventory' || value === 'settings';
}

function isValuesSubTab(value: string): value is ValuesSubTab {
  return value === 'attributes' || value === 'background' || value === 'details' || value === 'archetype' || value === 'essenz';
}

function isSettingsSubTab(value: string): value is SettingsSubTab {
  return value === 'statistics' || value === 'preset';
}

function padBackgroundSkills(skills: readonly SagaTreeSkillKey[], size: 4): BackgroundSkillPool {
  const slots: SkillSlot[] = [...skills.slice(0, size)];
  while (slots.length < size) slots.push('');
  return slots as BackgroundSkillPool;
}

function syncBackgroundSpecialization(
  specializations: readonly SagaTreeSpecializationRecordDto[],
  skill: SkillSlot,
  name: string,
): SagaTreeSpecializationRecordDto[] {
  const withoutBackground = specializations.filter((entry) => entry.source !== 'background');
  if (!isSagaTreeSkillKey(skill) || !name.trim()) return withoutBackground;
  return [...withoutBackground, { skill, name: name.trim(), source: 'background', acquiredAtLevel: 1 }];
}

function parseStartAttribute(value: string): 0 | 1 | 2 | 3 | 4 {
  const parsed = Number.parseInt(value, 10);
  if (parsed <= 0) return 0;
  if (parsed >= 4) return 4;
  if (parsed === 1 || parsed === 2 || parsed === 3) return parsed;
  return 0;
}

function uniqueSkills(values: readonly SkillSlot[]): SagaTreeSkillKey[] { return Array.from(new Set(values.filter(isSagaTreeSkillKey))); }

/** Label -> data-derived-card Selector für den Bracket-Tree. */
const DERIVED_SELECTOR_BY_LABEL: Record<string, string> = {
  Gesundheit: 'health', Verteidigung: 'defense', Initiative: 'initiative', Körperwiderstand: 'body-resistance',
  Reflexwiderstand: 'reflex-resistance', Geistwiderstand: 'mind-resistance', Manöverwiderstand: 'maneuver-resistance',
  Bewegung: 'movement', Erholung: 'recovery', Traglast: 'carry-capacity',
};

/**
 * Tooltip-Text für Attribut-Dropdown-Optionen, die über die Standard-Abgeleiteten hinaus
 * Manöverwiderstand an dieses Attribut hängen (max(STÄ+Athletik, GES+Akrobatik)).
 * null = keine Zusatzwirkung bei diesem Wert.
 */
function getAttributeOptionExtraDerivedHint(
  attribute: SagaTreeAttributeKey,
  optionValue: number,
  attributes: CharacterAttributesDto,
  athleticsRank: number,
  acrobaticsRank: number,
): string | null {
  if (attribute === 'strength') {
    const wins = optionValue + athleticsRank >= attributes.dexterity + acrobaticsRank;
    return wins
      ? 'Zusätzlich Manöverwiderstand: Bei diesem Wert gewinnt STÄ+Athletik gegen GES+Akrobatik.'
      : null;
  }
  if (attribute === 'dexterity') {
    const wins = attributes.strength + athleticsRank < optionValue + acrobaticsRank;
    return wins
      ? 'Zusätzlich Manöverwiderstand: Bei diesem Wert gewinnt GES+Akrobatik gegen STÄ+Athletik.'
      : null;
  }
  return null;
}

function areSpeciesTraitInstancesValid(
  instances: readonly SagaTreeSpeciesTraitInstanceDto[],
  allowedTraitKeys: ReadonlySet<string>,
): boolean {
  const nonRepeatableTraits = new Set<string>();
  const repeatableOptions = new Set<string>();

  for (const instance of instances) {
    const trait = getSagaTreeSpeciesTrait(instance.trait);
    if (!allowedTraitKeys.has(instance.trait) || trait.available === false) return false;

    const catalog = getSagaTreeSpeciesTraitOptionCatalog(instance.trait);
    if (!catalog) {
      if (nonRepeatableTraits.has(instance.trait)) return false;
      nonRepeatableTraits.add(instance.trait);
      continue;
    }

    if (!instance.option || !catalog.options.some((option) => option.value === instance.option)) return false;
    const optionIdentity = `${instance.trait}:${instance.option}`;
    if (repeatableOptions.has(optionIdentity)) return false;
    repeatableOptions.add(optionIdentity);
  }

  return true;
}

function retainSpeciesTraitInstancesForRace(
  instances: readonly SagaTreeSpeciesTraitInstanceDto[],
  allowedTraitKeys: ReadonlySet<string>,
): SagaTreeSpeciesTraitInstanceDto[] {
  const retained: SagaTreeSpeciesTraitInstanceDto[] = [];
  let usedPoints = 0;

  for (const instance of instances) {
    const trait = getSagaTreeSpeciesTrait(instance.trait);
    if (!allowedTraitKeys.has(instance.trait) || trait.available === false) continue;
    if (usedPoints + trait.cost > SAGA_TREE_SPECIES_TRAIT_BUDGET) continue;
    retained.push(instance);
    usedPoints += trait.cost;
  }

  return retained;
}

export function CharacterEditor() {
  const [activeTab, setActiveTab] = useState<EditorTab>('info');
  const [activeValuesSubTab, setActiveValuesSubTab] = useState<ValuesSubTab>('archetype');
  const [activeSettingsSubTab, setActiveSettingsSubTab] = useState<SettingsSubTab>('statistics');
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [npcPromotionPlan, setNpcPromotionPlan] = useState<NpcPromotionPlan | null>(null);
  const [savedCharacterId, setSavedCharacterId] = useState<string | null>(null);
  const [persistedLevel, setPersistedLevel] = useState<number | null>(null);
  const [characterLevel, setCharacterLevel] = useState(1);
  const [ruleset, setRuleset] = useState<CharacterRulesetKey>('sagatree-core');
  const [characterName, setCharacterName] = useState('');
  const [description, setDescription] = useState('');
  const [characterArchetype, setCharacterArchetype] = useState<SagaTreeArchetypeKey | undefined>();
  const [characterRace, setCharacterRace] = useState('human');
  const [genderReading, setGenderReading] = useState<CharacterGenderReading | undefined>();
  const [essenceProfile, setEssenceProfile] = useState<SagaTreeEssenceKey | undefined>();
  const [speciesTraitInstances, setSpeciesTraitInstances] = useState<SagaTreeSpeciesTraitInstanceDto[]>([]);
  const [speciesProfileName, setSpeciesProfileName] = useState('');
  const [speciesBodyDescription, setSpeciesBodyDescription] = useState('');
  const [presetReleaseMode, setPresetReleaseMode] = useState<CharacterPresetReleaseMode>('manual');
  const [appliedVorlage, setAppliedVorlage] = useState<AppliedVorlage | null>(null);

  const [baseAttributes, setBaseAttributes] = useState<CharacterAttributesDto>(INITIAL_ATTRIBUTES);
  const [attributeAdvances, setAttributeAdvances] = useState<SagaTreeAttributeAdvances>({});
  const [freeSkillRanks, setFreeSkillRanks] = useState(createEmptySagaTreeSkillRanks);
  const [archetypeTrainingSkill, setArchetypeTrainingSkill] = useState<SagaTreeSkillKey | undefined>();
  const [backgroundTemplateId, setBackgroundTemplateId] = useState<string | null | undefined>(undefined);
  const [backgroundName, setBackgroundName] = useState('');
  const [backgroundSkillPool, setBackgroundSkillPool] = useState<BackgroundSkillPool>(['', '', '', '']);
  const [backgroundSkillPoints, setBackgroundSkillPoints] = useState<SagaTreeBackgroundSkillPoints>({});
  const [skillAdvances, setSkillAdvances] = useState<SagaTreeSkillAdvanceDto[]>([]);
  const [specializations, setSpecializations] = useState<SagaTreeSpecializationRecordDto[]>([]);
  const [specializationSkill, setSpecializationSkill] = useState<SkillSlot>('');
  const [specializationName, setSpecializationName] = useState('');
  const [milieuAccess, setMilieuAccess] = useState('');
  const [contact, setContact] = useState('');
  const [complication, setComplication] = useState('');
  const [communication, setCommunication] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<SagaTreeSkillKey | undefined>();
  const [editorUserId, setEditorUserId] = useState('');
  const [backgroundStory, setBackgroundStory] = useState('');
  const [personalityTraits, setPersonalityTraits] = useState<string[]>([]);
  const [ideals, setIdeals] = useState<string[]>([]);
  const [bonds, setBonds] = useState<string[]>([]);
  const [flaws, setFlaws] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  /** Personal Look override from appearance JSON (#347). null = inherit world/saga. */
  const [personalLookProfileId, setPersonalLookProfileId] = useState<string | null>(null);
  const [lookRuntimeReady, setLookRuntimeReady] = useState(false);
  const studioRuntimeRef = useRef<CharacterStudioRuntime | null>(null);
  const bootstrapAppliedRef = useRef(false);

  const {
    headStyle,
    ears,
    hairStyle,
    hairColor,
    skinTone,
    clothing,
    accessory,
    portraitUrl,
    importedModelUrl,
    setImportedModelUrl,
    avatarSource,
    meshyUi,
    setMeshyUi,
    setSagaTreeDirty,
    avatarMorph,
    speciesTemplateId,
    starterWardrobeIds,
    templateWarningsDe,
    importComposition,
    modularGenerateResult,
    uploading,
    portraitPreviewUrl,
    portraitIntakeStatus,
    portraitIntakeStatusLabelDe,
    portraitIntakeCanRetry,
    retryPortraitOptimize,
    abortPortraitOptimize,
    fileInputRef,
    avatarCanvasRef,
    portraitCaptureRef,
    currentAvatar,
    avatarForPersist,
    editorSurfaces,
    morphCapabilities,
    sourceCapabilitySummary,
    appearanceEditable,
    selectedTemplateSpeciesId,
    humanMeshVariant,
    setHumanMeshVariant,
    applyImportOriginalKeep,
    applyBodyConversion,
    applySpeciesTemplate,
    applyAppearancePreset,
    requestAvatarSourceChange,
    handleMeshySuccess,
    handleMorphChange,
    handleBaseTraitChange,
    setHairColorDirty,
    setSkinToneDirty,
    commitFaceAnchors,
    hydrateAvatarFromAppearance,
    handleImageUpload,
    handleGeneratePortrait,
    handleAvatarRuntimeReady,
    handleRemoveImage,
  } = useCharacterAvatarEditor({
    characterRace,
    characterName,
    onCharacterRaceChange: setCharacterRace,
    genderReading,
  });

  const {
    inventory,
    inventoryV2,
    abstractResources,
    inventoryLoad,
    setInventoryLoadInfo,
    handleInventoryChange,
    handleResourcesChange,
    hydrateInventory,
  } = useCharacterInventoryEditor({
    onDirty: () => setSagaTreeDirty(true),
  });

  const archetype = characterArchetype ? getSagaTreeArchetype(characterArchetype) : undefined;
  const essence = essenceProfile ? getSagaTreeEssence(essenceProfile) : undefined;
  const baseSpeciesLabel = getCharacterCreationOptionLabel(sagaTreeRaceOptions, characterRace);
  const speciesDisplayName = characterRace === 'alien' && speciesProfileName.trim() ? speciesProfileName.trim() : baseSpeciesLabel;
  const selectedBackgroundPool = useMemo(() => uniqueSkills(backgroundSkillPool), [backgroundSkillPool]);
  const backgroundPointsUsed = useMemo(() => sumBackgroundSkillPointsUsed(backgroundSkillPoints), [backgroundSkillPoints]);
  const attributes = useMemo(
    () => applySagaTreeAttributeAdvances(baseAttributes, attributeAdvances, characterLevel),
    [attributeAdvances, baseAttributes, characterLevel],
  );
  const skillBuild = useMemo(() => ({
    freeSkillRanks,
    backgroundSkillPoints,
    archetypeTrainingSkill,
    skillAdvances,
    specializations,
  }), [archetypeTrainingSkill, backgroundSkillPoints, freeSkillRanks, skillAdvances, specializations]);
  const finalSkillRanks = useMemo(
    () => resolveSagaTreeSkillRanksSafe(skillBuild, characterLevel),
    [characterLevel, skillBuild],
  );

  const abilities = useMemo<AbilityDto[]>(() => {
    if (!archetype) return [];
    return [{ id: `sagatree-core-${archetype.value}`, name: archetype.coreAbility.name, description: archetype.coreAbility.description, type: archetype.value === 'fighter' ? 'combat' : 'skill', cost: 0, effect: archetype.coreAbility.effect, source: archetype.label, rank: archetype.coreAbility.rank, action_type: archetype.coreAbility.actionType }];
  }, [archetype]);

  const freeSkillPointsUsed = useMemo(() => sagaTreeSkillDefinitions.reduce((sum, skill) => sum + freeSkillRanks[skill.key], 0), [freeSkillRanks]);
  const skillCap = getSagaTreeSkillCap(characterLevel);
  const skillOverflow = useMemo(() => sagaTreeSkillDefinitions.some((skill) => finalSkillRanks[skill.key] > skillCap), [finalSkillRanks, skillCap]);
  const attributeAdvanceLevels = getSagaTreeAttributeAdvanceLevels(characterLevel);
  const attributeAdvanceBudget = getSagaTreeAttributeAdvanceBudget(characterLevel);
  const attributeAdvancesUsed = attributeAdvanceLevels.filter((advanceLevel) => Boolean(attributeAdvances[advanceLevel])).length;
  const attributePointsUsed = getSagaTreeBaseAttributePointsUsed(baseAttributes);
  const attributeDistributionValid = isValidSagaTreeAttributeBuild(baseAttributes, attributeAdvances, characterLevel);
  const speciesTraitCost = getSagaTreeSpeciesTraitCost(speciesTraitInstances.map((instance) => instance.trait));
  const allowedSpeciesTraitKeys = useMemo(() => new Set(getSagaTreeSpeciesTraitKeysForRace(characterRace)), [characterRace]);
  const speciesTraitInstancesValid = areSpeciesTraitInstancesValid(speciesTraitInstances, allowedSpeciesTraitKeys);
  const speciesTraitsComplete = speciesTraitCost === SAGA_TREE_SPECIES_TRAIT_BUDGET
    && speciesTraitInstancesValid
    && (characterRace !== 'alien' || Boolean(speciesProfileName.trim()));
  const carryCapacity = 5 + 2 * attributes.strength;
  const overloaded = inventoryLoad > carryCapacity;
  const movement = overloaded ? 6 : 9;
  const experienceBonus = getSagaTreeExperienceBonus(characterLevel);
  const health = 12 + 2 * attributes.endurance + 2 * experienceBonus;
  const defense = 10 + attributes.dexterity + experienceBonus + Math.max(finalSkillRanks.melee, finalSkillRanks.acrobatics);
  const recovery = attributes.endurance + experienceBonus;
  const derivedStatCards = useMemo(
    () => buildSagaTreeDerivedStatCards({ attributes, finalSkillRanks, experienceBonus, level: characterLevel, overloaded }),
    [attributes, characterLevel, experienceBonus, finalSkillRanks, overloaded],
  );

  const backgroundComplete = backgroundTemplateId !== undefined
    && Boolean(backgroundName.trim())
    && selectedBackgroundPool.length === 4
    && isValidBackgroundSkillPoints(backgroundSkillPoints, selectedBackgroundPool)
    && isSagaTreeSkillKey(specializationSkill)
    && (backgroundSkillPoints[specializationSkill] ?? 0) > 0
    && Boolean(specializationName.trim())
    && Boolean(milieuAccess.trim())
    && Boolean(contact.trim())
    && Boolean(complication.trim())
    && Boolean(communication.trim());
  const genderReadingComplete = Boolean(genderReading);
  const startSkillBuild = useMemo(() => ({
    freeSkillRanks,
    backgroundSkillPoints,
    archetypeTrainingSkill,
  }), [archetypeTrainingSkill, backgroundSkillPoints, freeSkillRanks]);
  const skillsComplete = Boolean(archetypeTrainingSkill)
    && freeSkillPointsUsed === SAGA_TREE_START_FREE_SKILL_POINTS
    && backgroundPointsUsed === SAGA_TREE_START_BACKGROUND_SKILL_POINTS
    && isValidStartSkillBuild(startSkillBuild, selectedBackgroundPool, characterArchetype)
    && isValidSagaTreeSkillDevelopment(startSkillBuild, skillAdvances, specializations, characterLevel)
    && !skillOverflow;
  const archetypeComplete = Boolean(characterArchetype && archetypeTrainingSkill);
  const essenzComplete = Boolean(essenceProfile);
  const attributesComplete = attributeDistributionValid && skillsComplete;
  const detailsComplete = Boolean(notes.trim())
    || personalityTraits.length > 0
    || ideals.length > 0
    || bonds.length > 0
    || flaws.length > 0;
  const valuesSubTabComplete: Record<ValuesSubTab, boolean> = {
    archetype: archetypeComplete,
    essenz: essenzComplete,
    attributes: attributesComplete,
    background: backgroundComplete,
    details: detailsComplete,
  };

  const collectValidationProblems = (): ValidationProblem[] => {
    const problems: ValidationProblem[] = [];
    if (!characterName.trim()) problems.push({ tab: 'info', message: 'Bitte gib deinem Charakter einen Namen.' });
    if (ruleset === 'dnd-5.5e') problems.push({ tab: 'info', message: 'D&D 5.5e ist in diesem Editor noch nicht verfügbar. Wähle SagaTree Core.' });
    if (!genderReadingComplete) problems.push({ tab: 'info', message: 'Bitte wähle, wie dein Charakter gelesen wird (männlich, weiblich oder divers).' });
    if (speciesTraitCost !== SAGA_TREE_SPECIES_TRAIT_BUDGET) problems.push({ tab: 'info', message: `Wähle Speziesmerkmale im Wert von genau ${SAGA_TREE_SPECIES_TRAIT_BUDGET} Punkten.` });
    if (characterRace === 'alien' && !speciesProfileName.trim()) problems.push({ tab: 'info', message: 'Gib deinem Alien-Speziesprofil einen Namen.' });
    if (!speciesTraitInstancesValid) problems.push({ tab: 'info', message: 'Vervollständige alle Speziesmerkmale und verwende jede Unteroption höchstens einmal.' });
    if (!backgroundComplete) problems.push({ tab: 'values', valuesSubTab: 'background', message: 'Vervollständige deinen mechanischen Hintergrund unter Hintergrund.' });
    if (!attributeDistributionValid) problems.push({ tab: 'values', valuesSubTab: 'attributes', message: `Verteile genau ${SAGA_TREE_START_ATTRIBUTE_BONUS_BUDGET} Basis-Bonuspunkte (+0 bis +4) und alle für Level ${characterLevel} verfügbaren Attributsteigerungen, ohne einen Endwert über +${SAGA_TREE_ATTRIBUTE_BONUS_CAP} zu erzeugen.` });
    if (!characterArchetype) problems.push({ tab: 'values', valuesSubTab: 'archetype', message: 'Bitte wähle einen Archetyp.' });
    if (!skillsComplete) problems.push({ tab: 'values', valuesSubTab: 'attributes', message: 'Vervollständige die drei Startquellen (7 frei, 2 Hintergrund, 1 Archetyp) und alle Fertigkeitsentwicklungen bis zu deinem Level. Pro Entwicklungsstufe ist genau eine Entscheidung erlaubt; Spezialisierungen brauchen ihren Mindestrang (1/3/5) bereits zum Erwerbszeitpunkt.' });
    if (!essenceProfile) problems.push({ tab: 'values', valuesSubTab: 'essenz', message: 'Bitte wähle eine primäre Essenz.' });
    return problems;
  };

  const validationProblems = collectValidationProblems();
  const sheetIsComplete = validationProblems.length === 0
    && Boolean(characterArchetype)
    && Boolean(essenceProfile)
    && Boolean(archetypeTrainingSkill)
    && isSagaTreeSkillKey(specializationSkill)
    && Boolean(genderReading)
    && speciesTraitsComplete;
  const highlightGaps = validationAttempted;
  const tabsWithOpenGaps = new Set(validationProblems.map((problem) => problem.tab));
  const incompleteMainTabs = new Set(
    highlightGaps ? validationProblems.map((problem) => problem.tab) : [],
  );
  const incompleteValuesSubTabs = new Set<ValuesSubTab>(
    highlightGaps
      ? validationProblems
          .map((problem) => problem.valuesSubTab)
          .filter((sub): sub is ValuesSubTab => Boolean(sub))
      : [],
  );
  const messagesForTab = (tab: EditorTab): string[] =>
    validationProblems.filter((problem) => problem.tab === tab).map((problem) => problem.message);
  const messagesForValuesSubTab = (sub: ValuesSubTab): string[] =>
    validationProblems
      .filter((problem) => problem.valuesSubTab === sub)
      .map((problem) => problem.message);
  const tabGapClass = (tab: EditorTab) =>
    incompleteMainTabs.has(tab)
      ? 'text-destructive data-[state=active]:text-destructive'
      : undefined;
  const valuesSubGapClass = (sub: ValuesSubTab) =>
    incompleteValuesSubTabs.has(sub)
      ? 'text-destructive data-[state=active]:text-destructive'
      : undefined;

  const buildPresetSnapshot = (): CharacterPresetSnapshot => {
    const sagaTreeProfile: SagaTreeProfileDto = {
      archetype: characterArchetype,
      essence: essenceProfile,
      speciesTraitInstances: speciesTraitInstances.map((instance) => ({
        trait: instance.trait,
        ...(instance.option ? { option: instance.option } : {}),
        source: 'species-creation',
        acquiredAtLevel: 1,
      })),
      speciesProfile: characterRace === 'alien' ? { name: speciesProfileName.trim(), bodyDescription: speciesBodyDescription.trim() } : undefined,
      backgroundTemplateId: backgroundTemplateId ?? null,
      background: {
        name: backgroundName.trim(),
        skillPool: selectedBackgroundPool,
        trainedSkills: backgroundSkillPointsToTrainedSkills(backgroundSkillPoints),
        backgroundSkillPoints,
        specialization: isSagaTreeSkillKey(specializationSkill)
          ? { skill: specializationSkill, name: specializationName.trim(), source: 'background', acquiredAtLevel: 1 }
          : undefined,
        milieuAccess: milieuAccess.trim(),
        contact: contact.trim(),
        complication: complication.trim(),
        communication: communication.trim(),
      },
      archetypeTrainingSkill,
      freeSkillRanks,
      skillAdvances: skillAdvances.length > 0 ? skillAdvances : undefined,
      specializations: specializations.length > 0 ? specializations : undefined,
      baseAttributes,
      attributeAdvances,
      presetReleaseMode,
      drive: 3,
      momentum: 0,
    };
    return {
      schemaVersion: 1,
      name: characterName.trim(),
      description: description.trim(),
      class: characterArchetype ?? '',
      race: characterRace,
      ruleset_key: ruleset,
      level: characterLevel,
      background_story: backgroundStory.trim() || undefined,
      notes: notes.trim(),
      personality_traits: personalityTraits.length > 0 ? personalityTraits : undefined,
      ideals: ideals.length > 0 ? ideals : undefined,
      bonds: bonds.length > 0 ? bonds : undefined,
      flaws: flaws.length > 0 ? flaws : undefined,
      appearance: {
        body_size: currentAvatar.body.size,
        height: currentAvatar.body.height,
        face_features: currentAvatar.traits.head ?? headStyle,
        hair_style: currentAvatar.traits.hair ?? hairStyle,
        hair_color: currentAvatar.colors.hair,
        skin_tone: currentAvatar.colors.skin,
        clothing: currentAvatar.traits.clothing ?? clothing,
        gender_reading: genderReading,
        personal_look_profile_id: personalLookProfileId,
        avatar: avatarForPersist,
      },
      attributes,
      skills: finalSkillRanks,
      sagatree_profile: sagaTreeProfile,
      abilities,
      inventory,
      portrait_url: portraitUrl || undefined,
    };
  };

  const hydrateEditorFromPersistedCharacter = (payload: {
    savedCharacterId: string | null;
    persistedLevel: number | null;
    name: string;
    description: string;
    rulesetKey: string;
    level: number;
    race: string;
    attributes: CharacterAttributesDto;
    skills: Record<SagaTreeSkillKey, number>;
    profile: SagaTreeProfileDto;
    appearance: CharacterAppearanceDto;
    inventory?: ItemDto[];
    inventoryV2?: InventoryState;
    inventorySchemaVersion?: 1 | 2;
    abstractResources?: CharacterAbstractResources;
    backgroundStory?: string;
    notes?: string;
    personalityTraits?: string[];
    ideals?: string[];
    bonds?: string[];
    flaws?: string[];
    portraitUrl?: string;
    sheetStatus?: CharacterSheetStatus;
    successMessage: string;
  }) => {
    const { profile, appearance } = payload;
    const resolved = resolveSagaTreeAttributeBuildState(payload.attributes, profile);
    const hydratedFreeSkillRanks = normalizeFreeSkillRanks(profile.freeSkillRanks);

    setCharacterName(payload.name);
    setDescription(payload.description);
    setRuleset(payload.rulesetKey === 'dnd-5.5e' ? 'dnd-5.5e' : 'sagatree-core');
    setCharacterLevel(payload.level);
    setCharacterRace(normalizeSagaTreeRaceKey(payload.race));
    setCharacterArchetype(profile.archetype && isSagaTreeArchetypeKey(profile.archetype) ? profile.archetype : undefined);
    setEssenceProfile(profile.essence && isSagaTreeEssenceKey(profile.essence) ? profile.essence : undefined);
    setGenderReading(appearance.gender_reading);
    setPersonalLookProfileId(appearance.personal_look_profile_id ?? null);
    setLookRuntimeReady(false);
    setSpeciesTraitInstances(profile.speciesTraitInstances ?? []);
    setSpeciesProfileName(profile.speciesProfile?.name ?? '');
    setSpeciesBodyDescription(profile.speciesProfile?.bodyDescription ?? '');
    setBaseAttributes(resolved.baseAttributes);
    setAttributeAdvances(resolved.attributeAdvances);
    setFreeSkillRanks(hydratedFreeSkillRanks);
    setArchetypeTrainingSkill(profile.archetypeTrainingSkill && isSagaTreeSkillKey(profile.archetypeTrainingSkill) ? profile.archetypeTrainingSkill : undefined);
    setBackgroundTemplateId(profile.backgroundTemplateId === undefined ? undefined : profile.backgroundTemplateId);
    setBackgroundName(profile.background?.name ?? '');
    setBackgroundSkillPool(padBackgroundSkills(profile.background?.skillPool ?? [], 4));
    const resolvedSkills = resolveSagaTreeSkillBuildState({
      freeSkillRanks: hydratedFreeSkillRanks,
      backgroundSkillPoints: profile.background?.backgroundSkillPoints,
      skillPool: profile.background?.skillPool,
      archetypeTrainingSkill: profile.archetypeTrainingSkill && isSagaTreeSkillKey(profile.archetypeTrainingSkill) ? profile.archetypeTrainingSkill : undefined,
      skillAdvances: profile.skillAdvances,
      specializations: profile.specializations,
      backgroundSpecialization: profile.background?.specialization && isSagaTreeSkillKey(profile.background.specialization.skill)
        ? profile.background.specialization
        : undefined,
    });
    setBackgroundSkillPoints(resolvedSkills.backgroundSkillPoints);
    setSkillAdvances(resolvedSkills.skillAdvances ?? []);
    setSpecializations(resolvedSkills.specializations ?? []);
    const backgroundSpec = resolvedSkills.specializations?.find((entry) => entry.source === 'background');
    setSpecializationSkill(backgroundSpec?.skill ?? (profile.background?.specialization?.skill && isSagaTreeSkillKey(profile.background.specialization.skill) ? profile.background.specialization.skill : ''));
    setSpecializationName(backgroundSpec?.name ?? profile.background?.specialization?.name ?? '');
    setMilieuAccess(profile.background?.milieuAccess ?? '');
    setContact(profile.background?.contact ?? '');
    setComplication(profile.background?.complication ?? '');
    setCommunication(profile.background?.communication ?? '');
    hydrateInventory({
      inventory: payload.inventory,
      inventoryV2: payload.inventoryV2,
      abstractResources: payload.abstractResources,
    });
    setBackgroundStory(payload.backgroundStory ?? '');
    setPersonalityTraits(payload.personalityTraits ?? []);
    setIdeals(payload.ideals ?? []);
    setBonds(payload.bonds ?? []);
    setFlaws(payload.flaws ?? []);
    setNotes(payload.notes ?? '');
    setPresetReleaseMode(profile.presetReleaseMode === 'auto' ? 'auto' : 'manual');
    hydrateAvatarFromAppearance(appearance, payload.portraitUrl);
    setSavedCharacterId(payload.savedCharacterId);
    setPersistedLevel(payload.persistedLevel);
    // Incomplete drafts reopen with gap highlights on Spezies/Charakter (and sub-tabs).
    setValidationAttempted(payload.sheetStatus === 'incomplete');
    clearCharacterEditorBootstrap();
    toast.success(payload.successMessage);
  };

  useEffect(() => {
    void getAuthenticatedUserId()
      .then((id) => setEditorUserId(id))
      .catch((error) => {
        console.error('Character editor auth id failed:', error);
      });
  }, []);

  useEffect(() => {
    if (bootstrapAppliedRef.current) return;

    const bootstrap = takeCharacterEditorBootstrap();
    const storedEditId = typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('sagatree:character-edit-id')
      : null;
    if (storedEditId) sessionStorage.removeItem('sagatree:character-edit-id');
    const editCharacterId = bootstrap?.kind === 'character-edit'
      ? bootstrap.characterId
      : storedEditId;

    if (bootstrap?.kind === 'preset-snapshot') {
      bootstrapAppliedRef.current = true;
      const { snapshot } = bootstrap;
      try {
        assertValidSnapshot(snapshot);
      } catch (error) {
        console.error('Preset bootstrap rejected:', error instanceof Error ? error.message : error);
        toast.error(error instanceof Error ? error.message : 'Preset konnte nicht geladen werden.');
        return;
      }
      hydrateEditorFromPersistedCharacter({
        savedCharacterId: null,
        persistedLevel: null,
        name: bootstrap.characterName || snapshot.name,
        description: snapshot.description ?? '',
        rulesetKey: snapshot.ruleset_key,
        level: snapshot.level,
        race: snapshot.race,
        attributes: snapshot.attributes,
        skills: snapshot.skills,
        profile: snapshot.sagatree_profile,
        appearance: snapshot.appearance,
        inventory: snapshot.inventory,
        backgroundStory: snapshot.background_story,
        notes: snapshot.notes,
        personalityTraits: snapshot.personality_traits,
        ideals: snapshot.ideals,
        bonds: snapshot.bonds,
        flaws: snapshot.flaws,
        portraitUrl: snapshot.portrait_url,
        successMessage: 'Preset geladen — neuer Charakter im Editor.',
      });
      setAppliedVorlage({
        kind: 'preset',
        labelDe: bootstrap.characterName || snapshot.name,
      });
      return;
    }

    if (bootstrap?.kind === 'starting-template') {
      bootstrapAppliedRef.current = true;
      const catalogEntry = getSagaTreeStartingTemplate(bootstrap.templateKey);
      if (!catalogEntry) {
        console.error('Starting-template bootstrap rejected: unknown key', bootstrap.templateKey);
        toast.error(`Unbekanntes Starttemplate: ${bootstrap.templateKey}`);
        clearCharacterEditorBootstrap();
        return;
      }
      const validation = validateSagaTreeStartingTemplate(catalogEntry);
      if (validation.ok === false) {
        console.error('Starting-template bootstrap rejected:', validation.message);
        toast.error(validation.message);
        clearCharacterEditorBootstrap();
        return;
      }
      const template = validation.template;
      const background = getSagaTreeBackgroundTemplate(template.backgroundTemplateId);
      if (!background) {
        console.error('Starting-template background missing:', template.backgroundTemplateId);
        toast.error('Starttemplate-Hintergrund ungültig.');
        clearCharacterEditorBootstrap();
        return;
      }
      setCharacterLevel(1);
      setCharacterArchetype(template.archetype);
      setEssenceProfile(template.essence);
      setBaseAttributes({ ...template.attributes });
      setAttributeAdvances({});
      setFreeSkillRanks({ ...template.freeSkillRanks });
      setArchetypeTrainingSkill(template.archetypeTrainingSkill);
      setBackgroundTemplateId(template.backgroundTemplateId);
      setBackgroundName(background.name);
      setBackgroundSkillPool([
        background.skillPool[0],
        background.skillPool[1],
        background.skillPool[2],
        background.skillPool[3],
      ]);
      setBackgroundSkillPoints({ ...template.backgroundSkillPoints });
      setSkillAdvances([]);
      setSpecializationSkill(template.backgroundSpecialization.skill);
      setSpecializationName(template.backgroundSpecialization.name);
      setSpecializations([template.backgroundSpecialization]);
      setAppliedVorlage({
        kind: 'starting-template',
        templateKey: template.key,
        labelDe: template.labelDe,
      });
      clearCharacterEditorBootstrap();
      toast.success(`Starttemplate „${template.labelDe}“ geladen — mechanischer Level-1-Build.`);
      return;
    }

    if (bootstrap?.kind === 'fixture-seed') {
      bootstrapAppliedRef.current = true;
      setCharacterName(bootstrap.characterName);
      setCharacterLevel(bootstrap.level);
      if (bootstrap.raceLabel) {
        // SpeciesCarousel keys are EN (dwarf/elf/orc); DB/UI labels may be DE (Zwergin/Elfin/Ork).
        applyRacePreset(normalizeSagaTreeRaceKey(bootstrap.raceLabel), true);
      }
      clearCharacterEditorBootstrap();
      toast.success(
        bootstrap.classLabel
          ? `Player-Test-Pregen: ${bootstrap.characterName} (${bootstrap.raceLabel ? `${bootstrap.raceLabel} · ` : ''}${bootstrap.classLabel}, Stufe ${bootstrap.level})`
          : `Player-Test-Pregen: ${bootstrap.characterName} (Stufe ${bootstrap.level})`,
      );
      return;
    }

    if (bootstrap?.kind === 'npc-promotion') {
      bootstrapAppliedRef.current = true;
      const { plan } = bootstrap;
      const seed = plan.editorSeed;
      setNpcPromotionPlan(plan);
      setCharacterName(seed.name);
      setDescription(seed.description);
      setCharacterLevel(seed.level);
      setCharacterRace(seed.race);
      setNotes(seed.notes ?? '');
      if (seed.speciesProfileName) {
        setSpeciesProfileName(seed.speciesProfileName);
      }
      if (seed.attributes) {
        setBaseAttributes(seed.attributes);
        setAttributeAdvances({});
      } else {
        setBaseAttributes(INITIAL_ATTRIBUTES);
        setAttributeAdvances({});
      }
      setValidationAttempted(true);
      applyRacePreset(seed.race, true);
      clearCharacterEditorBootstrap();
      toast.success(
        plan.kind === 'compact-to-full'
          ? 'Figur zum Ausbauen geladen — offene Entscheidungen prüfen.'
          : 'Vorlage geladen — neuer Charakter mit offenen Entscheidungen.',
      );
      return;
    }

    if (!editCharacterId) return;
    bootstrapAppliedRef.current = true;

    void (async () => {
      try {
        const character = await characterService.getCharacterById(editCharacterId);
        const inventoryV2State = await resolveLoadedInventoryV2(character);
        hydrateEditorFromPersistedCharacter({
          savedCharacterId: character.id,
          persistedLevel: character.level,
          name: character.name,
          description: character.description,
          rulesetKey: character.rulesetKey,
          level: character.level,
          race: character.race,
          attributes: character.attributes,
          skills: character.skills,
          profile: character.sagaTreeProfile,
          appearance: character.appearance,
          inventory: character.inventory,
          inventoryV2: inventoryV2State,
          inventorySchemaVersion: character.inventorySchemaVersion,
          abstractResources: character.abstractResources,
          backgroundStory: character.backgroundStory,
          notes: character.notes,
          personalityTraits: character.personalityTraits,
          ideals: character.ideals,
          bonds: character.bonds,
          flaws: character.flaws,
          portraitUrl: character.portraitUrl,
          sheetStatus: character.sheetStatus,
          successMessage: character.sheetStatus === 'incomplete'
            ? `Charakter „${character.name}“ geladen — unvollständig, offene Tabs sind markiert.`
            : `Charakter „${character.name}“ geladen.`,
        });
      } catch (error) {
        console.error('Character edit bootstrap failed:', error);
        clearCharacterEditorBootstrap();
        toast.error(error instanceof Error ? error.message : 'Charakter konnte nicht geladen werden.');
      }
    })();
  }, []);

  const loreContext = useMemo<CharacterLoreContext>(() => ({
    ruleset,
    name: characterName.trim(),
    description: [description.trim(), backgroundName.trim() ? `Hintergrund: ${backgroundName.trim()}` : ''].filter(Boolean).join('\n'),
    characterClass: archetype?.label ?? '',
    raceOrSpecies: speciesDisplayName,
    essenceProfile: essence?.label,
    level: characterLevel,
    attributes: { strength: attributes.strength, dexterity: attributes.dexterity, constitution: attributes.endurance, intelligence: attributes.mind, wisdom: attributes.perception, charisma: attributes.charisma },
    abilities: abilities.map((ability) => ({ name: ability.name, description: ability.description, type: ability.type, cost: ability.cost, effect: ability.effect })),
    inventory: inventory.map((item) => ({ name: item.name, description: item.description, type: item.type === 'shield' || item.type === 'tool' ? 'misc' : item.type, quantity: item.quantity })),
    appearance: { bodySize: currentAvatar.body.size, height: currentAvatar.body.height, face: currentAvatar.traits.head ?? headStyle, hairStyle: currentAvatar.traits.hair ?? hairStyle, hairColor: currentAvatar.colors.hair, skinTone: currentAvatar.colors.skin, clothing: currentAvatar.traits.clothing ?? clothing, accessory: currentAvatar.traits.accessory },
    traits: { personality: personalityTraits, ideals, bonds, flaws },
  }), [abilities, archetype, attributes, backgroundName, bonds, characterLevel, characterName, clothing, currentAvatar, description, essence, flaws, hairStyle, ideals, inventory, personalityTraits, ruleset, speciesDisplayName]);

  const rulesetLabel = getCharacterCreationOptionLabel(characterRulesetOptions, ruleset);

  const applyRacePreset = (race: string, resetTraits = false) => {
    const allowed = new Set(getSagaTreeSpeciesTraitKeysForRace(race));
    const retainedInstances = resetTraits ? [] : retainSpeciesTraitInstancesForRace(speciesTraitInstances, allowed);
    setSpeciesTraitInstances(retainedInstances);
    setCharacterRace(race);
    applyAppearancePreset(race);
  };

  const resetBackgroundMechanics = () => {
    setBackgroundName('');
    setBackgroundSkillPool(['', '', '', '']);
    setBackgroundSkillPoints({});
    setSpecializationSkill('');
    setSpecializationName('');
    setSpecializations((current) => current.filter((entry) => entry.source !== 'background'));
  };

  const handleRulesetChange = (value: string) => {
    if (!isCharacterRulesetKey(value)) return;
    const next = value === 'dnd-5.5e' ? 'dnd-5.5e' : 'sagatree-core';
    if (next === ruleset) return;
    setRuleset(next);
    setCharacterArchetype(undefined);
    setEssenceProfile(undefined);
    setArchetypeTrainingSkill(undefined);
    setFreeSkillRanks(createEmptySagaTreeSkillRanks());
    setSkillAdvances([]);
    setSpecializations([]);
    setBackgroundTemplateId(undefined);
    resetBackgroundMechanics();
    setMilieuAccess('');
    setContact('');
    setComplication('');
    setCommunication('');
    setSpeciesTraitInstances([]);
    setSpeciesProfileName('');
    setSpeciesBodyDescription('');
    setBaseAttributes(INITIAL_ATTRIBUTES);
    setAttributeAdvances({});
    applyRacePreset('human', true);
    if (value === 'dnd-5.5e') toast.info('D&D 5.5e: Der vollständige Erstellungsflow folgt demnächst in diesem Editor.');
  };

  const handleArchetypeChange = (value: string) => {
    if (!isSagaTreeArchetypeKey(value)) return;
    const next = getSagaTreeArchetype(value);
    setCharacterArchetype(value);
    if (archetypeTrainingSkill && !next?.skills.includes(archetypeTrainingSkill)) setArchetypeTrainingSkill(undefined);
  };

  const handleEssenceChange = (value: string) => { if (isSagaTreeEssenceKey(value)) setEssenceProfile(value); };

  const applyBackgroundSpecialization = (skill: SkillSlot, name: string) => {
    setSpecializationSkill(skill);
    setSpecializationName(name);
    setSpecializations((current) => syncBackgroundSpecialization(current, skill, name));
  };

  const handleBackgroundTemplateSelect = (templateId: string | null) => {
    setBackgroundTemplateId(templateId);
    setSelectedSkill(undefined);
    if (templateId === null) {
      resetBackgroundMechanics();
      return;
    }
    const template = getSagaTreeBackgroundTemplate(templateId);
    if (!template) {
      setBackgroundTemplateId(null);
      resetBackgroundMechanics();
      return;
    }
    setBackgroundName(template.name);
    setBackgroundSkillPool([template.skillPool[0], template.skillPool[1], template.skillPool[2], template.skillPool[3]]);
    setBackgroundSkillPoints({});
    setSpecializationSkill('');
    setSpecializationName('');
    setSpecializations((current) => current.filter((entry) => entry.source !== 'background'));
  };

  const handleBackgroundSkillPointsChange = (points: SagaTreeBackgroundSkillPoints) => {
    setBackgroundSkillPoints(points);
    if (isSagaTreeSkillKey(specializationSkill) && (points[specializationSkill] ?? 0) <= 0) {
      setSpecializationSkill('');
      setSpecializationName('');
      setSpecializations((current) => current.filter((entry) => entry.source !== 'background'));
    }
  };

  const updateBackgroundPool = (index: number, value: string) => {
    if (!isSagaTreeSkillKey(value) || index < 0 || index > 3) return;
    const previous = backgroundSkillPool[index];
    const next: BackgroundSkillPool = [backgroundSkillPool[0], backgroundSkillPool[1], backgroundSkillPool[2], backgroundSkillPool[3]];
    next[index] = value;
    setBackgroundSkillPool(next);
    if (previous && previous !== value) {
      setBackgroundSkillPoints((current) => {
        const nextPoints = { ...current };
        if (nextPoints[previous]) delete nextPoints[previous];
        if (!next.includes(previous)) {
          if (specializationSkill === previous) {
            setSpecializationSkill('');
            setSpecializationName('');
            setSpecializations((specs) => specs.filter((entry) => entry.source !== 'background'));
          }
        }
        return nextPoints;
      });
    }
  };

  const setAttribute = (attribute: SagaTreeAttributeKey, value: string) => setBaseAttributes((current) => ({ ...current, [attribute]: parseStartAttribute(value) }));
  const setAttributeAdvance = (advanceLevel: SagaTreeAttributeAdvanceLevel, attribute: SagaTreeAttributeKey) => {
    if (!canAssignSagaTreeAttributeAdvance(baseAttributes, attributeAdvances, characterLevel, advanceLevel, attribute)) return;
    setAttributeAdvances((current) => ({ ...current, [advanceLevel]: attribute }));
  };

  // --- Attribute -> abgeleitete Werte (Bracket-Tree im Attribute-Tab) ---
  const [connectedAttribute, setConnectedAttribute] = useState<SagaTreeAttributeKey | null>(null);
  const [hoveredAttribute, setHoveredAttribute] = useState<SagaTreeAttributeKey | null>(null);
  const activeAttribute = hoveredAttribute ?? connectedAttribute;
  const attributeConnectorAnimated = activeAttribute !== null && activeAttribute === connectedAttribute;

  // Ziel-Selektoren pro Attribut. Manöverwiderstand dynamically targets the attribute that
  // currently dominates max(STÄ + Athletik, GES + Akrobatik) — handled separately below.
  const attributeDerivedTargets: Partial<Record<SagaTreeAttributeKey, string[]>> = useMemo(() => {
    const maneuverUsesStrength = attributes.strength + finalSkillRanks.athletics >= attributes.dexterity + finalSkillRanks.acrobatics;
    const targets: Partial<Record<SagaTreeAttributeKey, string[]>> = {
      // Bewegung hängt indirekt an STÄ (Überlastung bei Last > Traglast).
      strength: ['carry-capacity', 'movement', ...(maneuverUsesStrength ? ['maneuver-resistance'] : [])],
      dexterity: ['reflex-resistance', 'defense', ...(maneuverUsesStrength ? [] : ['maneuver-resistance'])],
      endurance: ['health', 'body-resistance', 'recovery'],
      mind: ['mind-resistance'],
      perception: ['initiative'],
      charisma: [],
    };
    return targets;
  }, [attributes.dexterity, attributes.strength, finalSkillRanks.acrobatics, finalSkillRanks.athletics]);
  const connectedTargetSelectors = useMemo(
    () => (activeAttribute ? attributeDerivedTargets[activeAttribute] ?? [] : []),
    [activeAttribute, attributeDerivedTargets],
  );
  const connectedDerivedCards = useMemo(() => {
    if (!activeAttribute || connectedTargetSelectors.length === 0) return [];
    return connectedTargetSelectors
      .map((selector) => derivedStatCards.find((entry) => DERIVED_SELECTOR_BY_LABEL[entry.label] === selector))
      .filter((entry): entry is (typeof derivedStatCards)[number] => entry !== undefined);
  }, [activeAttribute, connectedTargetSelectors, derivedStatCards]);
  const dimmedDerivedCards = useMemo(() => {
    if (!activeAttribute) return [];
    const connected = new Set(connectedTargetSelectors);
    return derivedStatCards.filter((entry) => !connected.has(DERIVED_SELECTOR_BY_LABEL[entry.label]));
  }, [activeAttribute, connectedTargetSelectors, derivedStatCards]);
  const visibleDerivedCards = activeAttribute ? connectedDerivedCards : derivedStatCards;
  useEffect(() => {
    if (!connectedAttribute) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-attr-card]')) return;
      if (target.closest('[data-derived-card]')) return;
      if (target.closest('[data-attr-connector]')) return;
      if (target.closest('[data-slot="select-content"]')) return;
      if (target.closest('[data-radix-popper-content-wrapper]')) return;
      if (target.closest('[role="listbox"]')) return;
      setConnectedAttribute(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [connectedAttribute]);

  const handleSaveCharacter = async () => {
    const problems = collectValidationProblems();
    const nameOk = Boolean(characterName.trim());
    if (!nameOk) {
      setValidationAttempted(true);
      setActiveTab('info');
      toast.error('Mindestens einen Namen vergeben, um zu speichern.');
      return;
    }
    if (ruleset === 'dnd-5.5e') {
      setValidationAttempted(true);
      setActiveTab('info');
      toast.error('D&D 5.5e ist in diesem Editor noch nicht verfügbar. Wähle SagaTree Core.');
      return;
    }

    const isComplete = problems.length === 0
      && Boolean(characterArchetype)
      && Boolean(essenceProfile)
      && Boolean(archetypeTrainingSkill)
      && isSagaTreeSkillKey(specializationSkill)
      && Boolean(genderReading)
      && speciesTraitsComplete;
    const sheetStatus: CharacterSheetStatus = isComplete ? 'complete' : 'incomplete';

    if (!isComplete) {
      setValidationAttempted(true);
    }

    const sagaTreeProfile: SagaTreeProfileDto = {
      archetype: characterArchetype,
      essence: essenceProfile,
      speciesTraitInstances: speciesTraitInstances.map((instance) => ({
        trait: instance.trait,
        ...(instance.option ? { option: instance.option } : {}),
        source: 'species-creation',
        acquiredAtLevel: 1,
      })),
      speciesProfile: characterRace === 'alien' ? { name: speciesProfileName.trim(), bodyDescription: speciesBodyDescription.trim() } : undefined,
      backgroundTemplateId: backgroundTemplateId ?? null,
      background: {
        name: backgroundName.trim(),
        skillPool: selectedBackgroundPool,
        trainedSkills: backgroundSkillPointsToTrainedSkills(backgroundSkillPoints),
        backgroundSkillPoints,
        specialization: isSagaTreeSkillKey(specializationSkill)
          ? { skill: specializationSkill, name: specializationName.trim(), source: 'background', acquiredAtLevel: 1 }
          : undefined,
        milieuAccess: milieuAccess.trim(),
        contact: contact.trim(),
        complication: complication.trim(),
        communication: communication.trim(),
      },
      archetypeTrainingSkill,
      freeSkillRanks,
      skillAdvances: skillAdvances.length > 0 ? skillAdvances : undefined,
      specializations: specializations.length > 0 ? specializations : undefined,
      baseAttributes,
      attributeAdvances,
      presetReleaseMode,
      drive: 3,
      momentum: 0,
    };

    setSaving(true);
    const priorModelUrl = importedModelUrl;
    let avatarForSave = avatarForPersist;
    try {
      trackActivity(`Character Editor: Charakter "${characterName}" wird gespeichert`);
      // Complete saves materialize owner-scoped GLB; incomplete drafts keep current model URL.
      if (isComplete) {
        try {
          const exportArtifact = await materializeAvatarSaveExport({
            avatar: avatarForPersist,
            characterId: savedCharacterId,
            runtimeOverlays: [],
            sourceModelUrl: resolveAvatarModelUrl(avatarForPersist),
          });
          avatarForSave = {
            ...avatarForPersist,
            model_url: exportArtifact.modelUrl,
            model_format: 'glb',
          };
          setImportedModelUrl(exportArtifact.modelUrl);
        } catch (exportError) {
          console.error('Avatar save export error:', exportError);
          setImportedModelUrl(priorModelUrl);
          toast.error(
            exportError instanceof Error
              ? exportError.message
              : 'Avatar-Export fehlgeschlagen. Entwurf bleibt erhalten.',
          );
          return;
        }
      }

      const savePayload = {
        name: characterName.trim(),
        description: description.trim(),
        class: characterArchetype ?? '',
        race: characterRace,
        ruleset_key: ruleset,
        dnd_background: null as null,
        level: characterLevel,
        sheet_status: sheetStatus,
        background_story: backgroundStory.trim() || undefined,
        notes: notes.trim(),
        personality_traits: personalityTraits.length > 0 ? personalityTraits : undefined,
        ideals: ideals.length > 0 ? ideals : undefined,
        bonds: bonds.length > 0 ? bonds : undefined,
        flaws: flaws.length > 0 ? flaws : undefined,
        appearance: {
          body_size: avatarForSave.body.size,
          height: avatarForSave.body.height,
          face_features: avatarForSave.traits.head ?? headStyle,
          hair_style: avatarForSave.traits.hair ?? hairStyle,
          hair_color: avatarForSave.colors.hair,
          skin_tone: avatarForSave.colors.skin,
          clothing: avatarForSave.traits.clothing ?? clothing,
          gender_reading: genderReading,
          personal_look_profile_id: personalLookProfileId,
          avatar: avatarForSave,
        },
        attributes,
        skills: finalSkillRanks,
        sagatree_profile: sagaTreeProfile,
        abilities,
        inventory,
        inventory_v2: inventoryV2,
        abstractResources,
        portrait_url: portraitUrl || undefined,
      };

      const previousLevel = persistedLevel ?? characterLevel;
      const savedCharacter = savedCharacterId
        ? await characterService.updateCharacter(savedCharacterId, savePayload)
        : await characterService.createCharacter(savePayload);
      setSavedCharacterId(savedCharacter.id);
      setPersistedLevel(savedCharacter.level);
      setSagaTreeDirty(false);
      if (!isComplete) {
        setValidationAttempted(true);
      }
      // Round-trip through service normalize so editor state matches persisted base vs advances.
      const resolved = resolveSagaTreeAttributeBuildState(savedCharacter.attributes, savedCharacter.sagaTreeProfile);
      setBaseAttributes(resolved.baseAttributes);
      setAttributeAdvances(resolved.attributeAdvances);
      if (savedCharacter.sagaTreeProfile.presetReleaseMode === 'auto' || savedCharacter.sagaTreeProfile.presetReleaseMode === 'manual') {
        setPresetReleaseMode(savedCharacter.sagaTreeProfile.presetReleaseMode);
      }

      if (isComplete && presetReleaseMode === 'auto' && savedCharacter.level > previousLevel) {
        const autoReleased = await characterPresetService.maybeAutoReleaseVersion({
          characterId: savedCharacter.id,
          previousLevel,
          snapshot: buildPresetSnapshot(),
          releaseMode: 'auto',
        });
        if (autoReleased) {
          toast.success(`Charakter gespeichert · Preset Level ${savedCharacter.level} freigegeben`);
        } else {
          toast.success('Charakter erfolgreich gespeichert');
        }
      } else if (isComplete) {
        toast.success('Charakter erfolgreich gespeichert');
      } else {
        toast.success('Unvollständig gespeichert — offene Tabs sind rot markiert.');
      }
      trackActivity(`Character Editor: Charakter "${characterName}" gespeichert (ID: ${savedCharacter.id})`);

      if (npcPromotionPlan?.kind === 'compact-to-full' && isComplete) {
        try {
          const fullSheet: Record<string, unknown> = {
            ...savePayload,
            id: savedCharacter.id,
          };
          await promoteNpcCreatureCompactToFull({
            definitionId: npcPromotionPlan.sourceDefinitionId,
            fullSheet,
          });
          setNpcPromotionPlan(null);
          toast.success('Figur als vollständiger Charakterbogen gespeichert');
        } catch (promoteError) {
          console.error('Compact→Full promotion failed:', promoteError);
          toast.error(
            promoteError instanceof Error
              ? promoteError.message
              : 'Charakter gespeichert, aber Figur konnte nicht ausgebaut werden.',
          );
        }
      }
    } catch (error) {
      console.error('Character save error:', error);
      toast.error(error instanceof Error ? error.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleTabChange = (value: string) => {
    if (!isEditorTab(value)) return;
    setActiveTab(value);
    if (value === 'values') setActiveValuesSubTab('archetype');
    setConnectedAttribute(null);
    setHoveredAttribute(null);
  };
  const handleValuesSubTabChange = (value: string) => { if (isValuesSubTab(value)) { setActiveValuesSubTab(value); setConnectedAttribute(null); setHoveredAttribute(null); } };
  const handleSettingsSubTabChange = (value: string) => { if (isSettingsSubTab(value)) setActiveSettingsSubTab(value); };
  const showIdentityPills = Boolean(essence?.label || archetype?.label);
  const totalStartSkillPoints = freeSkillPointsUsed + backgroundPointsUsed + (archetypeTrainingSkill ? 1 : 0);

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-7xl space-y-4 p-4 md:space-y-6 md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div><h1 className="text-xl md:text-2xl">Charakter Editor</h1></div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={ruleset} onValueChange={handleRulesetChange}>
              <SelectTrigger id="ruleset" size="sm" className="w-[10.5rem] sm:w-52" aria-label="Regelset"><SelectValue /></SelectTrigger>
              <SelectContent>{characterRulesetOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
            {!sheetIsComplete ? (
              <Badge variant="destructive" data-character-sheet-status="incomplete">
                Unvollständig
              </Badge>
            ) : null}
            <CharacterAssistantButton />
            <Button variant="outline" onClick={() => trackActivity('Character Editor: Vorschau fokussiert')}><Eye className="mr-2 h-4 w-4" />Vorschau</Button>
            <Button onClick={handleSaveCharacter} disabled={saving || uploading} data-avatar-save-export={saving ? 'saving' : 'idle'}><FloppyDisk className="mr-2 h-4 w-4" />{saving ? 'Speichert...' : 'Speichern'}</Button>
          </div>
        </div>

        {npcPromotionPlan && npcPromotionPlan.unresolvedChoices.length > 0 ? (
          <div
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
            role="status"
            data-npc-promotion-unresolved
          >
            <p className="font-medium">
              Offene Entscheidungen ({npcPromotionPlan.unresolvedChoices.length})
            </p>
            <p className="mt-1 text-muted-foreground">
              Übernommene Felder sind vorausgefüllt. Diese Punkte müssen im Editor legal gewählt werden,
              bevor der Charakter gespeichert wird:
            </p>
            <ul className="mt-2 list-inside list-disc text-muted-foreground">
              {npcPromotionPlan.unresolvedChoices.map((choice) => (
                <li key={choice.key}>
                  <span className="text-foreground">{choice.labelDe}</span>
                  {' — '}
                  {choice.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
          <Card className="lg:sticky lg:top-4 lg:col-span-1 lg:self-start">
            <CardHeader className="space-y-3 pb-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="text-xs text-muted-foreground">{rulesetLabel}</p>
                  {appliedVorlage ? <AppliedVorlageBadge vorlage={appliedVorlage} /> : null}
                </div>
                <Badge variant="outline">Drive 3 / 5</Badge>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <div className="flex items-center gap-2">
                    <Input id="name" className="min-w-0 flex-1" placeholder="Charaktername" value={characterName} onChange={(event) => setCharacterName(event.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1 space-y-1.5"><Label htmlFor="gender-reading">Geschlecht</Label><GenderReadingSelect id="gender-reading" value={genderReading} onValueChange={setGenderReading} className="w-full" invalid={validationAttempted && !genderReadingComplete} /></div>
                  <div className="w-[4.5rem] shrink-0 space-y-1.5 sm:w-20"><Label htmlFor="level">Stufe</Label><Select value={String(characterLevel)} onValueChange={(value) => setCharacterLevel(Number.parseInt(value, 10))}><SelectTrigger id="level" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 20 }, (_, index) => index + 1).map((level) => <SelectItem key={level} value={String(level)}>{level}</SelectItem>)}</SelectContent></Select></div>
                </div>
                {validationAttempted && !genderReadingComplete && <p className="text-xs text-destructive">Bitte wähle eine Lesart: männlich, weiblich oder divers.</p>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {meshyUi?.job && isMeshyAvatarJobBusy(meshyUi.job.status) ? (
                <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-border bg-[#0B1220] shadow-inner">
                  <AvatarMeshyGeneratingOverlay
                    fillHost
                    progress={meshyUi.displayProgress}
                    pollHealth={meshyUi.pollHealth}
                    statusLabel={
                      meshyUi.job.status === 'rigging'
                        ? meshyUi.displayProgress >= 99
                          ? 'Modell wird gespeichert…'
                          : meshyUi.displayProgress >= 95
                            ? 'Skelett wird vorbereitet…'
                            : 'Modell wird optimiert…'
                        : meshyUi.job.status === 'queued'
                          ? 'In Warteschlange…'
                          : meshyUi.displayProgress >= 95
                            ? 'Meshy finalisiert…'
                            : 'Charakter wird erzeugt…'
                    }
                  />
                </div>
              ) : (
                <AvatarSurfaceViewer
                  surface="sheet"
                  surfaceRef={{
                    characterId: savedCharacterId ?? 'draft',
                    displayName: characterName.trim() || 'Charakter',
                    portraitUrl: portraitUrl || undefined,
                    modelUrl: importedModelUrl ?? currentAvatar.model_url,
                  }}
                  avatar={currentAvatar}
                  canvasRef={avatarCanvasRef}
                  captureApiRef={portraitCaptureRef}
                  studioRuntimeRef={studioRuntimeRef}
                  onRuntimeReady={() => {
                    setLookRuntimeReady(true);
                    handleAvatarRuntimeReady();
                  }}
                  onFaceAnchorsCommitted={commitFaceAnchors}
                  size="lg"
                  className="w-full border-0"
                />
              )}
              <AvatarSourceSelector
                value={avatarSource}
                capabilitySummary={sourceCapabilitySummary}
                disabled={saving}
                onSelect={requestAvatarSourceChange}
              />
              {avatarSource === 'sagatree' ? (
                <AvatarSpeciesTemplatePicker
                  selectedSpeciesId={selectedTemplateSpeciesId}
                  onSelect={applySpeciesTemplate}
                  disabled={saving}
                  warningsDe={templateWarningsDe}
                  humanMeshSlot={
                    <HumanLiveActMeshVariantSelect
                      value={humanMeshVariant}
                      onChange={setHumanMeshVariant}
                      disabled={saving}
                    />
                  }
                />
              ) : null}
              {avatarSource === 'import' ? (
                <AvatarImportPanel
                  characterId={savedCharacterId}
                  onKeepOriginal={applyImportOriginalKeep}
                  onConverted={applyBodyConversion}
                />
              ) : null}
              {avatarSource === 'meshy' ? (
                <>
                  <AvatarMeshyPanel
                    characterId={savedCharacterId}
                    onJobChange={setMeshyUi}
                    onSuccess={handleMeshySuccess}
                  />
                </>
              ) : null}
              {modularGenerateResult ? (
                <AvatarModularGenerateProgress
                  stages={modularGenerateResult.stages}
                  headlineDe={modularGenerateResult.headlineDe}
                  detailDe={modularGenerateResult.detailDe}
                />
              ) : null}
              {import.meta.env.DEV ? <BaseBodyMorphFixture /> : null}
              {showIdentityPills ? (
                <IdentityPreviewPills
                  essenceKey={essenceProfile}
                  essenceLabel={essence?.label}
                  archetypeKey={characterArchetype}
                  archetypeLabel={archetype?.label}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Wähle Archetyp und Essenz</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Gesundheit</p><p className="mt-1 text-lg font-semibold">{health}</p></div>
                <div className="rounded-lg border border-border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Verteidigung</p><p className="mt-1 text-lg font-semibold">{defense}</p></div>
                <div className="rounded-lg border border-border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Bewegung</p><p className="mt-1 text-lg font-semibold">{movement} m</p></div>
                <div className="rounded-lg border border-border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Erholung</p><p className="mt-1 text-lg font-semibold">{recovery}</p></div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">{sagaTreeAttributeDefinitions.map((attribute) => <div key={attribute.key} className="flex items-center justify-between gap-2"><span className="text-muted-foreground">{attribute.shortLabel}</span><span className="font-semibold">+{attributes[attribute.key]}</span></div>)}</div>
              <Separator />
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Start-Fertigkeiten</span><span className="font-semibold">{totalStartSkillPoints} / 10</span></div>
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Inventarlast</span><span className={overloaded ? 'font-semibold text-destructive' : 'font-semibold'}>{inventoryLoad} / {carryCapacity}</span></div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"><Button variant="outline" onClick={handleGeneratePortrait} disabled={uploading}><Camera className="mr-2 h-4 w-4" />Portrait erzeugen</Button><Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}><UploadSimple className="mr-2 h-4 w-4" />Portrait hochladen</Button><input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" /></div>
              <div
                className="space-y-2"
                aria-live="polite"
                aria-busy={uploading || portraitIntakeStatus === 'optimizing' || portraitIntakeStatus === 'previewing'}
              >
                {(portraitPreviewUrl || portraitUrl) ? (
                  <div className="flex items-center gap-3 rounded-lg border border-border p-2">
                    <img
                      src={portraitPreviewUrl || portraitUrl}
                      alt={portraitPreviewUrl ? 'Portrait-Vorschau' : 'Portrait-Fallback'}
                      className="h-14 w-14 rounded-md object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Portrait</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {portraitIntakeStatus === 'idle' || portraitIntakeStatus === 'complete'
                          ? 'Fallback für kompakte Ansichten'
                          : portraitIntakeStatusLabelDe}
                      </p>
                    </div>
                    {portraitIntakeCanRetry ? (
                      <Button size="sm" variant="outline" onClick={() => void retryPortraitOptimize()} disabled={uploading} aria-label="Portrait-Optimierung erneut versuchen">
                        Erneut
                      </Button>
                    ) : null}
                    {(portraitIntakeStatus === 'optimizing' || portraitIntakeStatus === 'previewing' || portraitIntakeStatus === 'uploading') ? (
                      <Button size="sm" variant="ghost" onClick={abortPortraitOptimize} aria-label="Portrait-Optimierung abbrechen">
                        Abbrechen
                      </Button>
                    ) : null}
                    {portraitUrl && portraitIntakeStatus !== 'optimizing' && portraitIntakeStatus !== 'previewing' ? (
                      <Button size="sm" variant="ghost" onClick={handleRemoveImage} aria-label="Portrait entfernen"><X className="h-4 w-4" /></Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardContent className="pt-6">
              <Tabs value={activeTab} onValueChange={handleTabChange}>
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-5">
                  <TabsTrigger value="info" className={cn('px-1 py-2 text-xs md:px-2 md:text-sm', tabGapClass('info'))}>
                    <span className="inline-flex items-center gap-1.5">
                      Spezies
                      {tabsWithOpenGaps.has('info') ? (
                        <IncompleteTabHint label="Spezies" messages={messagesForTab('info')} />
                      ) : null}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="values" className={cn('px-1 py-2 text-xs md:px-2 md:text-sm', tabGapClass('values'))}>
                    <span className="inline-flex items-center gap-1.5">
                      Charakter
                      {tabsWithOpenGaps.has('values') ? (
                        <IncompleteTabHint label="Charakter" messages={messagesForTab('values')} />
                      ) : null}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="appearance" className={cn('px-1 py-2 text-xs md:px-2 md:text-sm', tabGapClass('appearance'))}>
                    <span className="inline-flex items-center gap-1.5">
                      Look
                      {tabsWithOpenGaps.has('appearance') ? (
                        <IncompleteTabHint label="Look" messages={messagesForTab('appearance')} />
                      ) : null}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="inventory" className={cn('px-1 py-2 text-xs md:px-2 md:text-sm', tabGapClass('inventory'))}>
                    <span className="inline-flex items-center gap-1.5">
                      Inventar
                      {tabsWithOpenGaps.has('inventory') ? (
                        <IncompleteTabHint label="Inventar" messages={messagesForTab('inventory')} />
                      ) : null}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="settings" className={cn('px-1 py-2 text-xs md:px-2 md:text-sm', tabGapClass('settings'))}>
                    <span className="inline-flex items-center gap-1.5">
                      Einstellungen
                      {tabsWithOpenGaps.has('settings') ? (
                        <IncompleteTabHint label="Einstellungen" messages={messagesForTab('settings')} />
                      ) : null}
                    </span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-6">
                  <div className="space-y-2"><Label id="species-label">Spezies</Label><SpeciesCarousel selectedRace={characterRace} onSelect={applyRacePreset} labelledBy="species-label" /></div>
                  <SpeciesTraitsPanel species={characterRace} traitInstances={speciesTraitInstances} speciesProfileName={speciesProfileName} speciesBodyDescription={speciesBodyDescription} validationAttempted={validationAttempted} onTraitInstancesChange={setSpeciesTraitInstances} onSpeciesProfileNameChange={setSpeciesProfileName} onSpeciesBodyDescriptionChange={setSpeciesBodyDescription} />
                </TabsContent>

                <TabsContent value="values" className="space-y-6">
                  <Tabs value={activeValuesSubTab} onValueChange={handleValuesSubTabChange}>
                    <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-5">
                      <TabsTrigger value="archetype" className={cn('px-2 py-2 text-xs md:px-3 md:text-sm', valuesSubGapClass('archetype'))}>
                        <span className="inline-flex items-center gap-1.5">
                          Archetype
                          {valuesSubTabComplete.archetype ? (
                            <CheckCircle className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                          ) : (
                            <IncompleteTabHint label="Archetype" messages={messagesForValuesSubTab('archetype')} />
                          )}
                        </span>
                      </TabsTrigger>
                      <TabsTrigger value="essenz" className={cn('px-2 py-2 text-xs md:px-3 md:text-sm', valuesSubGapClass('essenz'))}>
                        <span className="inline-flex items-center gap-1.5">
                          Essenz
                          {valuesSubTabComplete.essenz ? (
                            <CheckCircle className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                          ) : (
                            <IncompleteTabHint label="Essenz" messages={messagesForValuesSubTab('essenz')} />
                          )}
                        </span>
                      </TabsTrigger>
                      <TabsTrigger value="attributes" className={cn('px-2 py-2 text-xs md:px-3 md:text-sm', valuesSubGapClass('attributes'))}>
                        <span className="inline-flex items-center gap-1.5">
                          Attribute
                          {valuesSubTabComplete.attributes ? (
                            <CheckCircle className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                          ) : (
                            <IncompleteTabHint label="Attribute" messages={messagesForValuesSubTab('attributes')} />
                          )}
                        </span>
                      </TabsTrigger>
                      <TabsTrigger value="background" className={cn('px-2 py-2 text-xs md:px-3 md:text-sm', valuesSubGapClass('background'))}>
                        <span className="inline-flex items-center gap-1.5">
                          Hintergrund
                          {valuesSubTabComplete.background ? (
                            <CheckCircle className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                          ) : (
                            <IncompleteTabHint label="Hintergrund" messages={messagesForValuesSubTab('background')} />
                          )}
                        </span>
                      </TabsTrigger>
                      <TabsTrigger value="details" className={cn('px-2 py-2 text-xs md:px-3 md:text-sm', valuesSubGapClass('details'))}>
                        <span className="inline-flex items-center gap-1.5">
                          Details
                          {valuesSubTabComplete.details ? (
                            <CheckCircle className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                          ) : null}
                        </span>
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="attributes" className="mt-4 space-y-7">
                      <section className="space-y-4">
                        <h3 className="font-semibold">Attribute</h3>
                        {!characterArchetype ? <div className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-3 text-sm text-muted-foreground">Der Archetyp-Punkt ist noch offen. Wähle unter <strong>Archetype</strong> zuerst eine Rolle und eine typische Fertigkeit.</div> : null}
                        <CharacterSkillsPanel
                          characterLevel={characterLevel}
                          attributes={attributes}
                          freeRanks={freeSkillRanks}
                          onFreeRanksChange={setFreeSkillRanks}
                          backgroundPoolSkills={selectedBackgroundPool}
                          backgroundSkillPoints={backgroundSkillPoints}
                          archetypeTrainingSkill={archetypeTrainingSkill}
                          skillAdvances={skillAdvances}
                          onSkillAdvancesChange={setSkillAdvances}
                          specializations={specializations}
                          onSpecializationsChange={setSpecializations}
                          selectedSkill={selectedSkill}
                          onSelectedSkillChange={setSelectedSkill}
                        />
                      </section>

                      <Separator />

                      <section className="space-y-4" data-attr-connector-section>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-semibold">Attributsbonus (=D20 + Bonus)</h3>
                              <RuleHelp label="Attributbonus" contentClassName="max-h-[min(24rem,70vh)] max-w-[min(22rem,90vw)] overflow-y-auto">
                                <div className="space-y-2 text-xs leading-relaxed">
                                  <p>
                                    Für jedes Grundattribut werden Bonuspunkte verteilt. Diese werden bei Attributschecks dem D20 Wurf dazu gerechnet. Auf Level 1 kannst du insgesamt {SAGA_TREE_START_ATTRIBUTE_BONUS_BUDGET} Punkte verteilen. Je Attribut kann ein Bonus auf Level 1 maximal +{SAGA_TREE_START_ATTRIBUTE_BONUS_CAP} geben. Die Basisverteilung wird beim Levelaufstieg nicht neu verteilt. Auf Level {SAGA_TREE_ATTRIBUTE_ADVANCE_LEVELS[0]} wird das Cap auf +{SAGA_TREE_ATTRIBUTE_BONUS_CAP} angehoben und du kannst einen weiteren Bonuspunkt auf ein Attribut deiner Wahl verteilen. Auf Level {SAGA_TREE_ATTRIBUTE_ADVANCE_LEVELS[1]} erhältst du einen weiteren Bonuspunkt welchen du wieder auf ein Grundattribut deiner Wahl verteilen kannst.
                                  </p>
                                  <p>
                                    +0 bedeutet keinen positiven Bonus, nicht Handlungsunfähigkeit. Das bedeutet bei einem Check für dieses Attribut wird nur ein D20 gewürfelt und kein Bonus dazu gerechnet. Boni welche durch andere Mechaniken ausgelöst werden, sind davon nicht betroffen.
                                  </p>
                                  <p className="font-medium">Bonus-Obergrenzen nach Level:</p>
                                  <ul className="list-disc space-y-0.5 pl-4">
                                    {getSagaTreeAttributeBonusLevelGuide().map(({ levelLabel, maxBonus, description }) => (
                                      <li key={levelLabel}>
                                        Level {levelLabel}: Bonus max. +{maxBonus} ({description})
                                      </li>
                                    ))}
                                  </ul>
                                  <p>
                                    Wird ein Charakter auf einem höheren Level mit Bonuspunktveränderung erstellt gelten die entsprechenden Bonuspunkte-Regeln. Beispiel Charakter wird auf Level {SAGA_TREE_ATTRIBUTE_ADVANCE_LEVELS[0]} erstellt -&gt; Grundattribute können jeweils einen Bonus +{SAGA_TREE_ATTRIBUTE_BONUS_CAP} bekommen. Es bleiben {SAGA_TREE_START_ATTRIBUTE_BONUS_BUDGET} Basis-Bonuspunkte (+0 bis +{SAGA_TREE_START_ATTRIBUTE_BONUS_CAP}) plus {getSagaTreeAttributeAdvanceBudget(SAGA_TREE_ATTRIBUTE_ADVANCE_LEVELS[0])} separater Entwicklungsslot — nicht {SAGA_TREE_START_ATTRIBUTE_BONUS_BUDGET + getSagaTreeAttributeAdvanceBudget(SAGA_TREE_ATTRIBUTE_ADVANCE_LEVELS[0])} frei verteilbare Punkte.
                                  </p>
                                </div>
                              </RuleHelp>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">Verteile {SAGA_TREE_START_ATTRIBUTE_BONUS_BUDGET} Bonuspunkte auf Level 1. Diese werden immer als Bonus dem D20 Wurf dazugerechnet. Für weitere Infos klick auf das Fragezeichen.</p>
                          </div>
                          <div className="flex flex-wrap gap-2"><Badge variant={attributePointsUsed === SAGA_TREE_START_ATTRIBUTE_BONUS_BUDGET ? 'default' : 'destructive'}>{attributePointsUsed} / {SAGA_TREE_START_ATTRIBUTE_BONUS_BUDGET} Bonuspunkte</Badge>{attributeAdvanceBudget > 0 ? <Badge variant={attributeAdvancesUsed === attributeAdvanceBudget ? 'default' : 'destructive'}>{attributeAdvancesUsed} / {attributeAdvanceBudget} Entwicklung</Badge> : null}</div>
                        </div>
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                          <div className="rounded-lg border border-border bg-muted/10 p-4">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Attributscheck</p>
                            <p className="mt-1 text-base font-semibold">1W20 + Attributbonus</p>
                            <p className="mt-2 text-sm text-muted-foreground">Ein Bonus von +0 bedeutet: nur der W20 zaehlt. Situative Boni und Mali kommen erst im eigentlichen Check dazu.</p>
                          </div>
                          <div className="rounded-lg border border-border bg-muted/10 p-4">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Startverteilung</p>
                            <p className="mt-1 text-sm font-medium">Level 1: {SAGA_TREE_START_ATTRIBUTE_BONUS_BUDGET} Bonuspunkte gesamt, maximal +{SAGA_TREE_START_ATTRIBUTE_BONUS_CAP} pro Attribut.</p>
                            {attributeAdvanceBudget > 0 ? (
                              <p className="mt-2 text-sm text-muted-foreground">Auf Level {attributeAdvanceLevels.join(' und ')} kommt {attributeAdvanceBudget === 1 ? 'ein separater Entwicklungsslot' : `${attributeAdvanceBudget} separate Entwicklungsslots`} dazu. Diese Slots erhoehen bestehende Werte und sind keine freie Neuverteilung.</p>
                            ) : (
                              <p className="mt-2 text-sm text-muted-foreground">Spaeter kommen auf Level {SAGA_TREE_ATTRIBUTE_ADVANCE_LEVELS.join(' und ')} separate Entwicklungsslots dazu. Diese erhoehen bestehende Werte und sind keine freie Neuverteilung.</p>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                          {sagaTreeAttributeDefinitions.map((attribute) => {
                            return (
                            <div
                              key={attribute.key}
                              data-attr-card={attribute.key}
                              role="button"
                              tabIndex={0}
                              onClick={() => setConnectedAttribute(attribute.key)}
                              onMouseEnter={() => setHoveredAttribute(attribute.key)}
                              onMouseLeave={() => setHoveredAttribute((current) => (current === attribute.key ? null : current))}
                              onKeyDown={(event) => {
                                if (event.key !== 'Enter' && event.key !== ' ') return;
                                const target = event.target;
                                if (!(target instanceof Element)) return;
                                if (target.closest('button, a, input, textarea, select, [role="combobox"], [role="listbox"], [data-slot="select-trigger"]')) return;
                                if (target !== event.currentTarget && target.closest('[data-attr-card]') !== event.currentTarget) return;
                                event.preventDefault();
                                setConnectedAttribute(attribute.key);
                              }}
                              className={`relative flex h-full cursor-pointer flex-col pt-0.5 items-center justify-center gap-2 rounded-lg border bg-card p-3 text-center transition-colors ${connectedAttribute === attribute.key ? 'border-primary bg-primary/5' : selectedSkill && sagaTreeSkillDefinitions.find((skill) => skill.key === selectedSkill)?.attribute === attribute.key ? 'border-primary/60 bg-primary/5' : 'border-border hover:border-primary/60'}`}
                            >
                              <div className="flex w-full items-start justify-center"><span className="opacity-60 [&_svg]:size-3" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}><RuleHelp label={attribute.label}>{attribute.description}</RuleHelp></span></div>
                              <div className="flex w-full flex-col items-center gap-1">
                                <p className="text-sm font-semibold leading-tight">{attribute.label}</p>
                                <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{attribute.shortLabel}</span>
                              </div>
                              <AttributeD20Icon className="my-0.5" />
                              <Select value={String(baseAttributes[attribute.key])} onValueChange={(value) => { setAttribute(attribute.key, value); setConnectedAttribute(attribute.key); }}><SelectTrigger className="w-full min-h-11 min-w-[4.75rem] justify-center gap-1 px-2 text-xs font-medium *:data-[slot=select-value]:line-clamp-none [&_svg:not([class*='size-'])]:size-3.5" aria-label={`${attribute.label} Grundbonus`} onClick={(event) => { event.stopPropagation(); setConnectedAttribute(attribute.key); }} onPointerDown={(event) => event.stopPropagation()}><SelectValue>+{baseAttributes[attribute.key]} Bonus</SelectValue></SelectTrigger><SelectContent>{[0, 1, 2, 3, 4].map((value) => {
                                  const advanceCount = attributeAdvanceLevels.filter((advanceLevel) => attributeAdvances[advanceLevel] === attribute.key).length;
                                  const finalValue = value + advanceCount;
                                  const extraHint = getAttributeOptionExtraDerivedHint(attribute.key, finalValue, attributes, finalSkillRanks.athletics, finalSkillRanks.acrobatics);
                                  return (
                                    <SelectItem key={value} value={String(value)} textValue={`+${value} Bonus`} disabled={finalValue > SAGA_TREE_ATTRIBUTE_BONUS_CAP} className={extraHint ? 'pr-10' : undefined}>
                                      <SelectItemText>+{value} Bonus</SelectItemText>
                                      {extraHint ? (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              type="button"
                                              aria-label="Zusätzlichen abgeleiteten Wert erklären"
                                              className="pointer-events-auto ml-auto inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-primary hover:bg-primary/10"
                                              onClick={(event) => event.stopPropagation()}
                                              onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
                                            >
                                              <Question className="pointer-events-none size-3.5" />
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="right" sideOffset={8} className="max-w-[260px] text-left leading-relaxed">
                                            {extraHint}
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : null}
                                    </SelectItem>
                                  );
                                })}</SelectContent></Select>
                            </div>
                            );
                          })}
                        </div>
                        {attributeAdvanceLevels.length > 0 ? (
                          <div className="rounded-lg border border-border bg-muted/10 p-4">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between"><div><h4 className="font-medium">Permanente Attributentwicklung</h4><p className="text-sm text-muted-foreground">Ab Level 8 und 16 kannst du jeweils ein Attribut dauerhaft weiterentwickeln. Die Wahl erhöht deine bestehende Basis; sie erlaubt keine kostenlose Neuverteilung. Reguläres Maximum: +5.</p></div><Badge variant="outline">{attributeAdvanceBudget} Entwicklung durch Level</Badge></div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              {attributeAdvanceLevels.map((advanceLevel) => (
                                <div key={advanceLevel} className="space-y-1.5"><Label>Permanente Entwicklung (Level {advanceLevel})</Label><Select value={attributeAdvances[advanceLevel]} onValueChange={(value) => { if (sagaTreeAttributeDefinitions.some((entry) => entry.key === value)) setAttributeAdvance(advanceLevel, value as SagaTreeAttributeKey); }}><SelectTrigger className="min-h-11"><SelectValue placeholder="Attribut wählen" /></SelectTrigger><SelectContent>{sagaTreeAttributeDefinitions.map((entry) => <SelectItem key={entry.key} value={entry.key} disabled={!canAssignSagaTreeAttributeAdvance(baseAttributes, attributeAdvances, characterLevel, advanceLevel, entry.key)}>{entry.label} · aktuell +{attributes[entry.key]}</SelectItem>)}</SelectContent></Select></div>
                              ))}
                            </div>
                            {!attributeDistributionValid && attributePointsUsed === SAGA_TREE_START_ATTRIBUTE_BONUS_BUDGET ? <p className="mt-3 text-xs text-destructive">Vergib alle verfügbaren Entwicklungspunkte und achte darauf, dass kein Endwert +5 überschreitet.</p> : null}
                          </div>
                        ) : null}
                        {activeAttribute === 'charisma' ? (
                          <p className="text-center text-[11px] text-muted-foreground">Charisma fließt in keinen abgeleiteten Wert ein.</p>
                        ) : null}
                        <div className="space-y-1">
                          {!activeAttribute ? (
                            <div className="mb-3"><h3 className="font-semibold">Abgeleitete Werte</h3><p className="text-sm text-muted-foreground">Diese Werte werden aus Attributen, Fertigkeiten und Erfahrungsbonus berechnet und nicht direkt bearbeitet. Klicke auf eine Attributkarte, um nur die relevanten Werte zu sehen.</p></div>
                          ) : null}
                          <AttributeDerivedConnector
                            sourceAttribute={activeAttribute}
                            animated={attributeConnectorAnimated}
                            targetSelectors={connectedTargetSelectors}
                          />
                          <div className={activeAttribute ? (visibleDerivedCards.length <= 1 ? 'grid gap-3 grid-cols-1 max-w-md' : visibleDerivedCards.length === 2 ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-3 sm:grid-cols-3') : 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3'}>
                            {visibleDerivedCards.map((entry) => (
                              <div key={entry.label} data-derived-card={DERIVED_SELECTOR_BY_LABEL[entry.label]} className="[&>div]:h-full">
                                <DerivedStatCard {...entry} highlighted={Boolean(activeAttribute)} />
                              </div>
                            ))}
                          </div>
                          {activeAttribute && dimmedDerivedCards.length > 0 ? (
                            <div className="mt-4 grid gap-3 opacity-40 sm:grid-cols-2 xl:grid-cols-3">
                              {dimmedDerivedCards.map((entry) => (
                                <div key={entry.label} data-derived-card={DERIVED_SELECTOR_BY_LABEL[entry.label]} className="[&>div]:h-full">
                                  <DerivedStatCard {...entry} />
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </section>
                    </TabsContent>

                    <TabsContent value="background" className="mt-4 space-y-7">
                      <CharacterBackgroundPanel
                        backgroundTemplateId={backgroundTemplateId}
                        backgroundName={backgroundName}
                        skillPool={backgroundSkillPool}
                        backgroundSkillPoints={backgroundSkillPoints}
                        onBackgroundSkillPointsChange={handleBackgroundSkillPointsChange}
                        specializationSkill={specializationSkill}
                        specializationName={specializationName}
                        milieuAccess={milieuAccess}
                        contact={contact}
                        complication={complication}
                        communication={communication}
                        complete={backgroundComplete}
                        onTemplateSelect={handleBackgroundTemplateSelect}
                        onBackgroundNameChange={setBackgroundName}
                        onPoolSkillChange={updateBackgroundPool}
                        onSpecializationSkillChange={(skill) => {
                          if (!skill) {
                            applyBackgroundSpecialization('', '');
                            return;
                          }
                          const keepName = isSagaTreeSkillKey(specializationSkill) && specializationSkill === skill ? specializationName : '';
                          applyBackgroundSpecialization(skill, keepName);
                        }}
                        onSpecializationNameChange={(name) => {
                          applyBackgroundSpecialization(specializationSkill, name);
                        }}
                        onSpecializationApply={(skill, name) => applyBackgroundSpecialization(skill, name)}
                        onMilieuAccessChange={setMilieuAccess}
                        onContactChange={setContact}
                        onComplicationChange={setComplication}
                        onCommunicationChange={setCommunication}
                      />

                      <Separator />

                      <section className="space-y-4">
                        <div><h3 className="font-semibold">Hintergrundgeschichte</h3><p className="text-sm text-muted-foreground">Optionaler Lore-Teil. Er verändert weder Attributwerte noch die mechanischen Hintergrund-Punkte.</p></div>
                        <CharacterBackgroundComposer value={backgroundStory} context={loreContext} onChange={setBackgroundStory} />
                      </section>
                    </TabsContent>

                    <TabsContent value="details" className="mt-4 space-y-7">
                      <details className="rounded-lg border border-border bg-muted/10 p-4"><summary className="cursor-pointer font-medium">Weitere Charakterdetails · optional</summary><div className="mt-5 space-y-5"><CharacterTraitEditor id="personality" label="Persönlichkeitsmerkmale" category="personality" values={personalityTraits} context={loreContext} onChange={setPersonalityTraits} /><CharacterTraitEditor id="ideals" label="Ideale" category="ideals" values={ideals} context={loreContext} onChange={setIdeals} /><CharacterTraitEditor id="bonds" label="Bindungen" category="bonds" values={bonds} context={loreContext} onChange={setBonds} /><CharacterTraitEditor id="flaws" label="Schwächen" category="flaws" values={flaws} context={loreContext} onChange={setFlaws} /></div></details>
                      <CharacterNotesSection value={notes} onChange={setNotes} />
                    </TabsContent>

                    <TabsContent value="archetype" className="mt-4">
                      <CharacterArchetypePanel
                        selectedArchetype={characterArchetype}
                        onArchetypeChange={handleArchetypeChange}
                        archetypeTrainingSkill={archetypeTrainingSkill}
                        onArchetypeTrainingSkillChange={setArchetypeTrainingSkill}
                        freeRanks={freeSkillRanks}
                        backgroundSkillPoints={backgroundSkillPoints}
                        attributes={attributes}
                        experienceBonus={experienceBonus}
                      />
                    </TabsContent>
                    <TabsContent value="essenz" className="mt-4"><CharacterEssencePanel selectedEssence={essenceProfile} onEssenceChange={handleEssenceChange} /></TabsContent>
                  </Tabs>
                </TabsContent>

                <TabsContent value="appearance" className="space-y-6">
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">Look ist kosmetisch</p><p className="mt-1 text-sm text-muted-foreground">Körperbau, Gesicht, Haare und Kleidung verändern keine Charakterwerte. Spezies und Speziesmerkmale wählst du im Spezies-Tab.</p></div><Badge variant="outline">Keine Werte</Badge></div></div>
                  <CharacterLookSelector
                    characterId={savedCharacterId}
                    personalLookProfileId={personalLookProfileId}
                    onPersonalLookProfileIdChange={setPersonalLookProfileId}
                    studioRuntimeRef={studioRuntimeRef}
                    runtimeReady={lookRuntimeReady}
                    disabled={saving}
                  />
                  {editorSurfaces.status === 'pending' ? (
                    <p
                      className="text-sm text-muted-foreground"
                      data-avatar-capability-pending
                      role="status"
                    >
                      Avatar-Struktur wird geprüft. Morph- und Trait-Controls erscheinen, sobald die Analyse fertig ist.
                    </p>
                  ) : null}
                  {!appearanceEditable && editorSurfaces.status !== 'pending' ? (
                    <p
                      className="text-sm text-muted-foreground"
                      data-avatar-capability-appearance-hint
                    >
                      {editorSurfaces.limitations[0] ??
                        'Für diesen Avatar sind Morph- und Trait-Controls nicht freigeschaltet.'}
                    </p>
                  ) : null}
                  {editorSurfaces.status !== 'pending' ? (
                    <AvatarMorphEditorPanels
                      morph={avatarMorph}
                      capabilities={morphCapabilities}
                      disabled={
                        saving ||
                        (!editorSurfaces.surfaces.morphBody &&
                          !editorSurfaces.surfaces.morphFace)
                      }
                      onMorphChange={handleMorphChange}
                    />
                  ) : null}
                  {editorSurfaces.surfaces.traits ? (
                    <AvatarTraitPanels
                      selection={{
                        head: headStyle,
                        ears,
                        hair: hairStyle,
                        clothing,
                        accessory,
                      }}
                      morph={avatarMorph}
                      onBaseTraitChange={handleBaseTraitChange}
                    />
                  ) : null}
                  {editorSurfaces.surfaces.colors ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="hairColor">Haarfarbe</Label><div className="flex gap-2"><Input id="hairColor" type="color" value={/^#[0-9a-fA-F]{6}$/.test(hairColor) ? hairColor : '#000000'} onChange={(event) => { setHairColorDirty(event.target.value); }} className="h-10 w-20" disabled={saving} /><Input value={hairColor} onChange={(event) => { setHairColorDirty(event.target.value); }} aria-label="Haarfarbe als Hexwert" disabled={saving} /></div></div><div className="space-y-2"><Label htmlFor="skinTone">Hautfarbe</Label><div className="flex gap-2"><Input id="skinTone" type="color" value={/^#[0-9a-fA-F]{6}$/.test(skinTone) ? skinTone : '#F5E6D3'} onChange={(event) => { setSkinToneDirty(event.target.value); }} className="h-10 w-20" disabled={saving} /><Input value={skinTone} onChange={(event) => { setSkinToneDirty(event.target.value); }} aria-label="Hautfarbe als Hexwert" disabled={saving} /></div></div></div>
                  ) : null}
                </TabsContent>

                <TabsContent value="inventory">
                  {editorUserId ? (
                    <CharacterInventoryV2Panel
                      state={inventoryV2}
                      onChange={handleInventoryChange}
                      strength={attributes.strength}
                      characterId={savedCharacterId}
                      userId={editorUserId}
                      onLoadInfoChange={setInventoryLoadInfo}
                      resources={abstractResources.current}
                      onResourcesChange={handleResourcesChange}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">Inventar wird geladen…</p>
                  )}
                </TabsContent>
                <TabsContent value="settings" className="space-y-4">
                  <Tabs value={activeSettingsSubTab} onValueChange={handleSettingsSubTabChange}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="statistics" className="px-3 py-2 text-xs md:text-sm">Statistik</TabsTrigger>
                      <TabsTrigger value="preset" className="px-3 py-2 text-xs md:text-sm">Preset</TabsTrigger>
                    </TabsList>
                    <TabsContent value="statistics" className="mt-4 space-y-4">
                      <CharacterStatisticsPanel characterId={savedCharacterId} />
                    </TabsContent>
                    <TabsContent value="preset" className="mt-4 space-y-4">
                      <CharacterPresetPanel
                        characterId={savedCharacterId}
                        characterName={characterName}
                        characterLevel={characterLevel}
                        ruleset={ruleset}
                        releaseMode={presetReleaseMode}
                        onReleaseModeChange={setPresetReleaseMode}
                        validateForPreset={() => collectValidationProblems()[0]?.message ?? null}
                        buildSnapshot={buildPresetSnapshot}
                      />
                    </TabsContent>
                  </Tabs>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
