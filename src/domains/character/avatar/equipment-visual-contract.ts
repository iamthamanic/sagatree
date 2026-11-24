/**
 * Avatar equipment visual contract — Inventory-v2 → visual projection (#158).
 * Pure domain: no React / Three / backend clients. Gameplay SoT stays InventoryState.
 * Location: src/domains/character/avatar/equipment-visual-contract.ts
 */

import { parseItemModel3dAssetKey } from '../../items/model3d-assets';
import type { ItemDefinition } from '../../items/definition';
import {
  EQUIPMENT_SLOTS,
  HAND_SLOTS,
  equipmentSlotsOf,
  type EquipmentSlot,
  type InventoryState,
} from '../inventory-v2';
import {
  FIT_RANGE_CONTRACT_VERSION,
  resolveAvatarFitCompatibility,
  type AvatarFitRangeV1,
  type AvatarFitStatus,
} from './fit-range-contract';
import { MORPH_CONTRACT_VERSION, type SagaTreeAvatarMorphStateV1 } from './morph-contract';
import {
  RIG_CONTRACT_VERSION,
  SAGA_TREE_HUMANOID_ANCHORS,
  type SagaTreeHumanoidAnchorId,
} from './rig-contract';

export const EQUIPMENT_VISUAL_CONTRACT_VERSION = 'SagaTreeAvatarEquipmentVisualV1' as const;

export const EQUIPMENT_ATTACHMENT_KINDS = ['rigid', 'skinned'] as const;
export type EquipmentAttachmentKind = (typeof EQUIPMENT_ATTACHMENT_KINDS)[number];

export const EQUIPMENT_VISUAL_STATUSES = [
  'ready',
  'needs-review',
  'incompatible',
  'missing',
] as const;
export type EquipmentVisualStatus = (typeof EQUIPMENT_VISUAL_STATUSES)[number];

export const EQUIPMENT_HIDE_REGIONS = [
  'none',
  'hair',
  'head',
  'torso',
  'arms',
  'legs',
  'hands',
  'feet',
] as const;
export type EquipmentHideRegion = (typeof EQUIPMENT_HIDE_REGIONS)[number];

export interface AvatarEquipmentLocalTransform {
  position: readonly [number, number, number];
  rotationEuler: readonly [number, number, number];
  scale: readonly [number, number, number];
}

export interface AvatarEquipmentBinding {
  bindingId: string;
  /** Logical model3d:… key — never a raw free URL. */
  assetKey: string;
  assetVersion: string;
  definitionId: string;
  scope: 'core' | 'world' | 'personal';
  ownerUserId?: string;
  worldProfileId?: string | null;
  attachment: EquipmentAttachmentKind;
  anchor: SagaTreeHumanoidAnchorId;
  rigVersion: typeof RIG_CONTRACT_VERSION;
  morphContractVersion: typeof MORPH_CONTRACT_VERSION;
  fitRangeContractVersion: typeof FIT_RANGE_CONTRACT_VERSION;
  /** Optional fit window for this wearable. */
  fitRange?: AvatarFitRangeV1;
  transform: AvatarEquipmentLocalTransform;
  hideRegions: readonly EquipmentHideRegion[];
  /** When set, replaces another trait/socket visual instead of stacking. */
  replaceSocket?: string;
  readOnly?: boolean;
}

export interface AvatarEquipmentVisual {
  instanceId: string;
  definitionId: string;
  bindingId: string | null;
  assetKey: string | null;
  attachment: EquipmentAttachmentKind | null;
  anchor: SagaTreeHumanoidAnchorId | null;
  slots: readonly EquipmentSlot[];
  primarySlot: EquipmentSlot;
  transform: AvatarEquipmentLocalTransform | null;
  hideRegions: readonly EquipmentHideRegion[];
  replaceSocket?: string;
  status: EquipmentVisualStatus;
  fitStatus?: AvatarFitStatus;
  reasonDe: string;
}

export interface AvatarEquipmentVisualProjection {
  contractVersion: typeof EQUIPMENT_VISUAL_CONTRACT_VERSION;
  visuals: readonly AvatarEquipmentVisual[];
}

const TRANSFORM_CLAMP = {
  position: 5,
  rotation: Math.PI * 2,
  scaleMin: 0.05,
  scaleMax: 5,
} as const;

const IDENTITY_TRANSFORM: AvatarEquipmentLocalTransform = {
  position: [0, 0, 0],
  rotationEuler: [0, 0, 0],
  scale: [1, 1, 1],
};

export function isEquipmentAttachmentKind(value: unknown): value is EquipmentAttachmentKind {
  return typeof value === 'string' && (EQUIPMENT_ATTACHMENT_KINDS as readonly string[]).includes(value);
}

export function isEquipmentHideRegion(value: unknown): value is EquipmentHideRegion {
  return typeof value === 'string' && (EQUIPMENT_HIDE_REGIONS as readonly string[]).includes(value);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Fail-closed transform clamp — NaN/Infinity → identity components. */
export function clampEquipmentTransform(
  input: Partial<AvatarEquipmentLocalTransform> | null | undefined,
): AvatarEquipmentLocalTransform {
  const position = (input?.position ?? IDENTITY_TRANSFORM.position).map((v) =>
    clamp(Number(v), -TRANSFORM_CLAMP.position, TRANSFORM_CLAMP.position),
  ) as [number, number, number];
  const rotationEuler = (input?.rotationEuler ?? IDENTITY_TRANSFORM.rotationEuler).map((v) =>
    clamp(Number(v), -TRANSFORM_CLAMP.rotation, TRANSFORM_CLAMP.rotation),
  ) as [number, number, number];
  const scale = (input?.scale ?? IDENTITY_TRANSFORM.scale).map((v) =>
    clamp(Number(v), TRANSFORM_CLAMP.scaleMin, TRANSFORM_CLAMP.scaleMax),
  ) as [number, number, number];
  return { position, rotationEuler, scale };
}

export function validateAvatarEquipmentBinding(
  binding: AvatarEquipmentBinding,
): { ok: true } | { ok: false; reasonDe: string } {
  if (!binding.bindingId.trim()) return { ok: false, reasonDe: 'Binding-ID fehlt.' };
  if (!binding.definitionId.trim()) return { ok: false, reasonDe: 'Definition-ID fehlt.' };
  if (!parseItemModel3dAssetKey(binding.assetKey)) {
    return { ok: false, reasonDe: 'Asset-Key muss model3d:… sein (keine freie URL).' };
  }
  if (!binding.assetVersion.trim()) return { ok: false, reasonDe: 'Asset-Version fehlt.' };
  if (!isEquipmentAttachmentKind(binding.attachment)) {
    return { ok: false, reasonDe: 'Attachment muss rigid oder skinned sein.' };
  }
  if (!(SAGA_TREE_HUMANOID_ANCHORS as readonly string[]).includes(binding.anchor)) {
    return { ok: false, reasonDe: 'Unbekannter Anchor.' };
  }
  if (binding.rigVersion !== RIG_CONTRACT_VERSION) {
    return { ok: false, reasonDe: 'Rig-Version inkompatibel.' };
  }
  if (binding.morphContractVersion !== MORPH_CONTRACT_VERSION) {
    return { ok: false, reasonDe: 'Morph-Contract-Version inkompatibel.' };
  }
  if (binding.fitRangeContractVersion !== FIT_RANGE_CONTRACT_VERSION) {
    return { ok: false, reasonDe: 'Fit-Range-Contract-Version inkompatibel.' };
  }
  for (const region of binding.hideRegions) {
    if (!isEquipmentHideRegion(region)) {
      return { ok: false, reasonDe: `Ungültige Hide-Region: ${String(region)}` };
    }
  }
  return { ok: true };
}

/** Persistence port — Personal/World/Built-in metadata (infra implements authz). */
export interface AvatarEquipmentBindingRepository {
  getBindingForDefinition(definitionId: string): AvatarEquipmentBinding | null;
  listBindings(): readonly AvatarEquipmentBinding[];
}

export function createInMemoryAvatarEquipmentBindingRepository(
  seed: readonly AvatarEquipmentBinding[] = [],
): AvatarEquipmentBindingRepository {
  const byDefinition = new Map<string, AvatarEquipmentBinding>();
  for (const binding of seed) {
    const validated = validateAvatarEquipmentBinding(binding);
    if (!validated.ok) continue;
    byDefinition.set(binding.definitionId, binding);
  }
  return {
    getBindingForDefinition(definitionId) {
      return byDefinition.get(definitionId) ?? null;
    },
    listBindings() {
      return [...byDefinition.values()];
    },
  };
}

function primarySlot(slots: readonly EquipmentSlot[]): EquipmentSlot {
  if (slots.includes('mainHand')) return 'mainHand';
  return slots[0] ?? 'special';
}

function resolveStatusFromFit(
  binding: AvatarEquipmentBinding,
  morph: SagaTreeAvatarMorphStateV1 | undefined,
): { status: EquipmentVisualStatus; fitStatus?: AvatarFitStatus; reasonDe: string } {
  if (!binding.fitRange) {
    return { status: 'ready', reasonDe: 'Binding bereit (ohne Fit-Range).' };
  }
  if (!morph) {
    return {
      status: 'needs-review',
      fitStatus: 'needs-review',
      reasonDe: 'Fit-Range vorhanden, aber kein Morph-State — Review nötig.',
    };
  }
  const fit = resolveAvatarFitCompatibility({
    fit: binding.fitRange,
    morph,
    expectedAssetVersion: binding.assetVersion,
  });
  if (fit.status === 'ready') {
    return { status: 'ready', fitStatus: 'ready', reasonDe: 'Fit kompatibel.' };
  }
  if (fit.status === 'needs-review') {
    return {
      status: 'needs-review',
      fitStatus: 'needs-review',
      reasonDe: fit.messageDe ?? 'Fit benötigt Review.',
    };
  }
  return {
    status: 'incompatible',
    fitStatus: 'incompatible',
    reasonDe: fit.messageDe ?? 'Fit inkompatibel.',
  };
}

/**
 * Project Inventory equipment → at most one visual per ItemInstance.
 * Two-handed (same instance in both hands) collapses to a single visual.
 */
export function projectInventoryEquipmentVisuals(input: {
  inventory: InventoryState;
  definitions: ReadonlyMap<string, ItemDefinition> | ((id: string) => ItemDefinition | undefined);
  bindings: AvatarEquipmentBindingRepository;
  morph?: SagaTreeAvatarMorphStateV1;
  /** When asset was replaced, mark matching bindingIds as needs-review. */
  supersededBindingIds?: ReadonlySet<string>;
}): AvatarEquipmentVisualProjection {
  const definitionsInput = input.definitions;
  const lookup: (id: string) => ItemDefinition | undefined =
    typeof definitionsInput === 'function'
      ? definitionsInput
      : (id: string) => definitionsInput.get(id);

  const seenInstances = new Set<string>();
  const visuals: AvatarEquipmentVisual[] = [];

  for (const slot of EQUIPMENT_SLOTS) {
    const instanceId = input.inventory.equipment[slot];
    if (!instanceId || seenInstances.has(instanceId)) continue;
    seenInstances.add(instanceId);

    const slots = equipmentSlotsOf(input.inventory, instanceId);
    const instance = input.inventory.instances[instanceId];
    if (!instance) continue;

    const definition = lookup(instance.definitionId);
    const binding = input.bindings.getBindingForDefinition(instance.definitionId);

    if (!binding) {
      visuals.push({
        instanceId,
        definitionId: instance.definitionId,
        bindingId: null,
        assetKey: null,
        attachment: null,
        anchor: null,
        slots,
        primarySlot: primarySlot(slots),
        transform: null,
        hideRegions: [],
        status: 'missing',
        reasonDe: 'Ausgerüstet ohne Visual-Binding — mechanisch gültig, kein Visual.',
      });
      continue;
    }

    const validated = validateAvatarEquipmentBinding(binding);
    if (validated.ok === false) {
      visuals.push({
        instanceId,
        definitionId: instance.definitionId,
        bindingId: binding.bindingId,
        assetKey: binding.assetKey,
        attachment: binding.attachment,
        anchor: binding.anchor,
        slots,
        primarySlot: primarySlot(slots),
        transform: null,
        hideRegions: binding.hideRegions,
        replaceSocket: binding.replaceSocket,
        status: 'incompatible',
        reasonDe: validated.reasonDe,
      });
      continue;
    }

    if (input.supersededBindingIds?.has(binding.bindingId)) {
      visuals.push({
        instanceId,
        definitionId: instance.definitionId,
        bindingId: binding.bindingId,
        assetKey: binding.assetKey,
        attachment: binding.attachment,
        anchor: binding.anchor,
        slots,
        primarySlot: primarySlot(slots),
        transform: clampEquipmentTransform(binding.transform),
        hideRegions: binding.hideRegions,
        replaceSocket: binding.replaceSocket,
        status: 'needs-review',
        reasonDe: 'Asset ersetzt — Binding muss reviewed werden.',
      });
      continue;
    }

    // Prefer definition.model3d key when present; must still be logical model3d:…
    const defKey = definition?.model3d ? parseItemModel3dAssetKey(definition.model3d) : null;
    if (definition?.model3d && !defKey) {
      visuals.push({
        instanceId,
        definitionId: instance.definitionId,
        bindingId: binding.bindingId,
        assetKey: binding.assetKey,
        attachment: binding.attachment,
        anchor: binding.anchor,
        slots,
        primarySlot: primarySlot(slots),
        transform: null,
        hideRegions: binding.hideRegions,
        status: 'incompatible',
        reasonDe: 'Definition enthält freie 3D-URL — fail closed.',
      });
      continue;
    }

    const fitResolved = resolveStatusFromFit(binding, input.morph);
    visuals.push({
      instanceId,
      definitionId: instance.definitionId,
      bindingId: binding.bindingId,
      assetKey: binding.assetKey,
      attachment: binding.attachment,
      anchor: binding.anchor,
      slots,
      primarySlot: primarySlot(slots),
      transform: clampEquipmentTransform(binding.transform),
      hideRegions: binding.hideRegions,
      replaceSocket: binding.replaceSocket,
      status: fitResolved.status,
      fitStatus: fitResolved.fitStatus,
      reasonDe: fitResolved.reasonDe,
    });
  }

  // Two-handed sanity: HAND_SLOTS both pointing at same instance already collapsed via seenInstances
  void HAND_SLOTS;

  return {
    contractVersion: EQUIPMENT_VISUAL_CONTRACT_VERSION,
    visuals,
  };
}

export function createAvatarEquipmentBinding(input: {
  bindingId: string;
  assetId: string;
  definitionId: string;
  scope?: AvatarEquipmentBinding['scope'];
  attachment?: EquipmentAttachmentKind;
  anchor?: SagaTreeHumanoidAnchorId;
  assetVersion?: string;
  transform?: Partial<AvatarEquipmentLocalTransform>;
  hideRegions?: readonly EquipmentHideRegion[];
  fitRange?: AvatarFitRangeV1;
  replaceSocket?: string;
  readOnly?: boolean;
}): AvatarEquipmentBinding {
  return {
    bindingId: input.bindingId,
    assetKey: `model3d:${input.assetId}`,
    assetVersion: input.assetVersion ?? '1',
    definitionId: input.definitionId,
    scope: input.scope ?? 'core',
    attachment: input.attachment ?? 'rigid',
    anchor: input.anchor ?? 'rightHand',
    rigVersion: RIG_CONTRACT_VERSION,
    morphContractVersion: MORPH_CONTRACT_VERSION,
    fitRangeContractVersion: FIT_RANGE_CONTRACT_VERSION,
    fitRange: input.fitRange,
    transform: clampEquipmentTransform(input.transform),
    hideRegions: input.hideRegions ?? ['none'],
    replaceSocket: input.replaceSocket,
    readOnly: input.readOnly === true,
  };
}
