/**
 * InventoryEquipmentPanel — eight equipment destinations with desktop paper-doll
 * and mobile list. Domain fail-closed: only declared equipSlots (incl. feet).
 * Location: src/app/character/inventory/InventoryEquipmentPanel.tsx
 */
import { useState, type Dispatch, type DragEvent, type ReactNode, type SetStateAction } from 'react';
import {
  Question,
  DotsThree
} from '@phosphor-icons/react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../shared/ui/alert-dialog';
import { Button } from '../../../shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../shared/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../shared/ui/tooltip';
import {
  EQUIPMENT_SLOTS,
  HAND_SLOTS,
  equipItem,
  findInstanceLocation,
  isTwoHandedHandPair,
  unequipItem,
  type EquipmentSlot,
  type InventoryOperationResult,
  type InventoryState,
  type ItemDefinitionLookup,
} from '../../../domains/character/inventory-v2';
import { InventoryEquipmentPaperDollFigure } from './InventoryEquipmentPaperDollFigure';
import { InventoryEquipmentPaperDollHotspots } from './InventoryEquipmentPaperDollHotspots';
import { InventoryItemThumb } from './InventoryItemThumb';
import { useItemThumbnailSrc } from '../../items';
import {
  freeSlotsForEquipDisplace,
  itemDisplayName,
  previewDisplacedOnEquip,
} from './inventory-equip-preview';
import {
  EQUIP_DISPLACE_NO_ROOM,
  EQUIPMENT_SLOT_HELP,
  EQUIPMENT_SLOT_LABELS,
  formatStrengthRequirement,
} from './inventory-ui-labels';

export interface InventoryEquipmentPanelProps {
  state: InventoryState;
  lookup: ItemDefinitionLookup;
  strength: number;
  onApplyResult: (next: InventoryState) => void;
  onRefuse: (reason: string) => void;
}

type PendingEquip = {
  instanceId: string;
  slot: EquipmentSlot;
  displacedNames: string[];
};

const INSTANCE_DRAG_MIME = 'application/x-inventory-instance-id';

/** Desktop paper-doll column order (anatomical, left / right of figure). */
type SideAnchorSlot = Exclude<EquipmentSlot, 'feet' | 'head' | 'mainHand' | 'offHand'>;

const PAPER_DOLL_LEFT: readonly SideAnchorSlot[] = ['body', 'accessory1'];
const PAPER_DOLL_RIGHT: readonly SideAnchorSlot[] = ['special', 'accessory2'];

/**
 * Vertical anchors (% of paper-doll frame) for remaining side-column tiles.
 * head / feet / hands are pinned to the figure (above / below / beside).
 * Spezial sits on the right at body/armor height, above Nebenhand.
 */
const SLOT_ANCHORS: Record<SideAnchorSlot, { side: 'left' | 'right'; top: string }> = {
  body: { side: 'left', top: '14%' },
  special: { side: 'right', top: '14%' },
  accessory1: { side: 'left', top: '54%' },
  accessory2: { side: 'right', top: '54%' },
};

function applyEquipResult(
  result: InventoryOperationResult,
  onApplyResult: (next: InventoryState) => void,
  onRefuse: (reason: string) => void,
  strengthBlock?: { required: number; current: number },
): void {
  if (result.ok === false) {
    if (result.error === 'REQUIREMENT_NOT_MET' && strengthBlock) {
      onRefuse(formatStrengthRequirement(strengthBlock.required, strengthBlock.current));
      return;
    }
    if (result.error === 'BASE_SLOTS_FULL') {
      onRefuse(EQUIP_DISPLACE_NO_ROOM);
      return;
    }
    onRefuse(result.reason);
    return;
  }
  onApplyResult(result.state);
}

type SlotTileProps = {
  slot: EquipmentSlot;
  state: InventoryState;
  lookup: ItemDefinitionLookup;
  dragOverSlot: EquipmentSlot | null;
  selectedSlot: EquipmentSlot | null;
  hoverSlot: EquipmentSlot | null;
  setDragOverSlot: Dispatch<SetStateAction<EquipmentSlot | null>>;
  onSelect: (slot: EquipmentSlot) => void;
  onHover: (slot: EquipmentSlot | null) => void;
  onDropOnSlot: (event: DragEvent<HTMLElement>, slot: EquipmentSlot) => void;
  onUnequip: (slot: EquipmentSlot) => void;
};

/**
 * Palworld-style square: PNG thumb + label under. Same chrome for desktop & mobile.
 */
function EquipmentSlotTile({
  slot,
  state,
  lookup,
  dragOverSlot,
  selectedSlot,
  hoverSlot,
  setDragOverSlot,
  onSelect,
  onHover,
  onDropOnSlot,
  onUnequip,
}: SlotTileProps) {
  const instanceId = state.equipment[slot] ?? null;
  const instance = instanceId ? state.instances[instanceId] : undefined;
  const definition = instance ? lookup(instance.definitionId) : undefined;
  const twoHandedPair =
    instanceId !== null &&
    isTwoHandedHandPair(state, instanceId, lookup) &&
    HAND_SLOTS.includes(slot);
  const isOffHandLinked = twoHandedPair && slot === 'offHand';
  const isMainHandLinked = twoHandedPair && slot === 'mainHand';
  const selected = selectedSlot === slot;
  const preview = !selected && (hoverSlot === slot || dragOverSlot === slot);
  const highlighted = selected || preview;
  const filled = Boolean(instance && definition && !isOffHandLinked);
  const labelUnder = filled
    ? definition!.name
    : isOffHandLinked
      ? 'Zweihändig'
      : EQUIPMENT_SLOT_LABELS[slot];
  const assetSrc = useItemThumbnailSrc(isOffHandLinked ? undefined : definition?.assetKey);

  return (
    <div
      role="listitem"
      data-equipment-slot={slot}
      data-equipment-slot-highlight={highlighted ? 'true' : undefined}
      data-equipment-slot-selected={selected ? 'true' : undefined}
      data-equipment-slot-square="true"
      onClick={(event) => {
        event.stopPropagation();
        onSelect(slot);
      }}
      onMouseEnter={() => onHover(slot)}
      onMouseLeave={() => onHover(null)}
      onFocusCapture={() => onHover(slot)}
      onBlurCapture={() => onHover(null)}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDragOverSlot(slot);
        onHover(slot);
      }}
      onDragLeave={() => {
        setDragOverSlot((current) => (current === slot ? null : current));
      }}
      onDrop={(event) => {
        event.stopPropagation();
        onSelect(slot);
        onDropOnSlot(event, slot);
      }}
      aria-label={
        isOffHandLinked
          ? `${EQUIPMENT_SLOT_LABELS[slot]}: Zweihändig / gekoppelt`
          : instance && definition
            ? `${EQUIPMENT_SLOT_LABELS[slot]}: ${definition.name}`
            : `${EQUIPMENT_SLOT_LABELS[slot]}: leer`
      }
      className="group relative flex w-[3.75rem] cursor-pointer flex-col items-center gap-0.5"
    >
      <div
        className={[
          'relative flex size-10 items-center justify-center overflow-hidden rounded-md border transition-colors',
          filled
            ? 'border-border bg-card'
            : 'border-dashed border-border/70 bg-muted/15',
          selected
            ? 'ring-2 ring-primary border-primary/70 bg-primary/15'
            : preview
              ? 'ring-1 ring-primary/60 border-primary/40 bg-primary/5'
              : '',
          isOffHandLinked || isMainHandLinked ? 'border-l-2 border-l-primary/60' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <InventoryItemThumb
          slot={slot}
          definition={isOffHandLinked ? null : definition}
          assetSrc={assetSrc}
          muted={!filled}
          className="size-full"
          alt=""
        />
        {instanceId && !isOffHandLinked && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute -right-1 -top-1 size-6 min-h-6 min-w-6 rounded-full bg-background/90 opacity-0 shadow-sm group-hover:opacity-100 group-focus-within:opacity-100"
                aria-label={`${EQUIPMENT_SLOT_LABELS[slot]} Aktionen`}
                onClick={(event) => event.stopPropagation()}
              >
                <DotsThree className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onUnequip(slot)}>
                Ablegen ins Inventar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="flex w-[3.75rem] items-center justify-center gap-0.5">
        <p
          className={[
            'min-w-0 truncate text-center text-[9px] font-medium leading-tight tracking-wide',
            filled ? 'text-foreground' : 'text-muted-foreground',
          ].join(' ')}
          title={labelUnder}
        >
          {labelUnder}
        </p>
        <Tooltip pinOnClick={false}>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              aria-label={`Hilfe: ${EQUIPMENT_SLOT_LABELS[slot]}`}
              data-equipment-slot-help={slot}
              onClick={(event) => event.stopPropagation()}
            >
              <Question className="pointer-events-none size-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            sideOffset={6}
            className="max-w-[220px] px-2.5 py-1.5 text-left text-[11px] leading-relaxed"
          >
            {EQUIPMENT_SLOT_HELP[slot]}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function SlotColumn({
  slots,
  side,
  renderSlot,
}: {
  slots: readonly SideAnchorSlot[];
  side: 'left' | 'right';
  renderSlot: (slot: EquipmentSlot) => ReactNode;
}) {
  return (
    <div className="relative min-h-0 min-w-0 self-stretch">
      {slots.map((slot) => {
        const anchor = SLOT_ANCHORS[slot];
        return (
          <div
            key={slot}
            className={[
              'absolute w-[3.75rem]',
              side === 'left' ? 'right-0' : 'left-0',
            ].join(' ')}
            style={{ top: anchor.top }}
            data-equipment-slot-anchor={slot}
          >
            {renderSlot(slot)}
          </div>
        );
      })}
    </div>
  );
}

export function InventoryEquipmentPanel({
  state,
  lookup,
  strength,
  onApplyResult,
  onRefuse,
}: InventoryEquipmentPanelProps) {
  const [pendingEquip, setPendingEquip] = useState<PendingEquip | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<EquipmentSlot | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot | null>(null);
  const [hoverSlot, setHoverSlot] = useState<EquipmentSlot | null>(null);

  const tryEquip = (instanceId: string, slot: EquipmentSlot, confirmed: boolean) => {
    const instance = state.instances[instanceId];
    if (!instance) {
      onRefuse('Unbekannte Instanz.');
      return;
    }
    const definition = lookup(instance.definitionId);
    if (!definition) {
      onRefuse(`Unbekannte Definition: ${instance.definitionId}`);
      return;
    }
    const declared = definition.equipSlots ?? [];
    if (definition.twoHanded) {
      if (!HAND_SLOTS.includes(slot)) {
        onRefuse(`${definition.name} ist zweihändig und gehört in eine Hand.`);
        return;
      }
    } else if (!declared.includes(slot)) {
      onRefuse(`${definition.name} passt nicht in ${EQUIPMENT_SLOT_LABELS[slot]}.`);
      return;
    }

    const required = definition.requirements?.minimumStrength;
    if (required !== undefined && strength < required) {
      onRefuse(formatStrengthRequirement(required, strength));
      return;
    }

    const displaced = previewDisplacedOnEquip(state, lookup, instanceId, slot);
    if (displaced.length > 0 && !confirmed) {
      const free = freeSlotsForEquipDisplace(state, instanceId);
      if (displaced.length > free) {
        onRefuse(EQUIP_DISPLACE_NO_ROOM);
        return;
      }
      setPendingEquip({
        instanceId,
        slot: definition.twoHanded ? 'mainHand' : slot,
        displacedNames: displaced.map((id) => itemDisplayName(state, lookup, id)),
      });
      return;
    }

    const targetSlot = definition.twoHanded ? 'mainHand' : slot;
    applyEquipResult(
      equipItem(state, lookup, instanceId, targetSlot, strength),
      onApplyResult,
      onRefuse,
      required !== undefined ? { required, current: strength } : undefined,
    );
  };

  const handleDropOnSlot = (event: DragEvent<HTMLElement>, slot: EquipmentSlot) => {
    event.preventDefault();
    setDragOverSlot(null);
    setSelectedSlot(slot);
    const instanceId = resolveDragInstanceId(event);
    if (!instanceId) return;
    const location = findInstanceLocation(state, instanceId);
    if (location?.kind !== 'base' && location?.kind !== 'equipment') {
      onRefuse('Nur Gegenstände aus dem Basis-Inventar oder der Ausrüstung können ausgerüstet werden.');
      return;
    }
    tryEquip(instanceId, slot, false);
  };

  const resolveDragInstanceId = (event: DragEvent<HTMLElement>): string | null => {
    const fromMime = event.dataTransfer.getData(INSTANCE_DRAG_MIME);
    if (fromMime && state.instances[fromMime]) return fromMime;
    const rawSlot = event.dataTransfer.getData('text/plain');
    const slotIndex = Number.parseInt(rawSlot, 10);
    if (Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < state.baseSlots.length) {
      return state.baseSlots[slotIndex];
    }
    return null;
  };

  const handleUnequip = (slot: EquipmentSlot) => {
    const result = unequipItem(state, slot);
    if (result.ok === false) {
      onRefuse(result.reason);
      return;
    }
    onApplyResult(result.state);
  };

  const confirmPendingEquip = () => {
    if (!pendingEquip) return;
    const { instanceId, slot } = pendingEquip;
    setPendingEquip(null);
    const instance = state.instances[instanceId];
    const required = instance
      ? lookup(instance.definitionId)?.requirements?.minimumStrength
      : undefined;
    applyEquipResult(
      equipItem(state, lookup, instanceId, slot, strength),
      onApplyResult,
      onRefuse,
      required !== undefined ? { required, current: strength } : undefined,
    );
  };

  const renderSlot = (slot: EquipmentSlot) => (
    <EquipmentSlotTile
      key={slot}
      slot={slot}
      state={state}
      lookup={lookup}
      dragOverSlot={dragOverSlot}
      selectedSlot={selectedSlot}
      hoverSlot={hoverSlot}
      setDragOverSlot={setDragOverSlot}
      onSelect={setSelectedSlot}
      onHover={setHoverSlot}
      onDropOnSlot={handleDropOnSlot}
      onUnequip={handleUnequip}
    />
  );

  return (
    <aside
      className="flex min-h-0 flex-1 flex-col space-y-3"
      data-inventory-equipment-panel
      aria-label="Ausrüstung"
      onClick={() => setSelectedSlot(null)}
    >
      <h3 className="text-sm font-semibold tracking-wide">Ausrüstung</h3>

      {/* Desktop paper-doll */}
      <div
        className="relative hidden min-h-0 flex-1 md:block"
        data-equipment-paper-doll="true"
        role="list"
        aria-label="Ausrüstung am Körper"
      >
        <div className="relative grid min-h-[20rem] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-x-2 pt-12 pb-12 lg:min-h-0 lg:flex-1">
          <SlotColumn
            slots={PAPER_DOLL_LEFT}
            side="left"
            renderSlot={renderSlot}
          />
          <div className="relative flex justify-center self-stretch py-1">
            {/* Exact PNG aspect (460×1455) so hotspot % align with body parts */}
            <div
              className="relative z-[1] h-[18rem]"
              style={{ aspectRatio: '460 / 1455' }}
              data-equipment-paper-doll-frame="true"
            >
              {/* Kopf-Kachel mittig über dem Kopf */}
              <div
                className="absolute left-1/2 bottom-[100%] z-[3] mb-1 -translate-x-1/2"
                data-equipment-slot-anchor="head"
              >
                {renderSlot('head')}
              </div>
              <InventoryEquipmentPaperDollFigure className="h-full w-full" />
              <InventoryEquipmentPaperDollHotspots
                selectedSlot={selectedSlot}
                hoverSlot={hoverSlot ?? dragOverSlot}
                onSelect={setSelectedSlot}
                onHover={setHoverSlot}
                onDragOverSlot={setDragOverSlot}
                onDropOnSlot={handleDropOnSlot}
              />
              {/* Haupthand / Nebenhand — neben den Händen */}
              <div
                className="absolute top-[46%] right-full z-[3] mr-1 -translate-y-1/2"
                data-equipment-slot-anchor="mainHand"
              >
                {renderSlot('mainHand')}
              </div>
              <div
                className="absolute top-[46%] left-full z-[3] ml-1 -translate-y-1/2"
                data-equipment-slot-anchor="offHand"
              >
                {renderSlot('offHand')}
              </div>
              {/* Füße-Kachel mittig unter den Stiefeln */}
              <div
                className="absolute left-1/2 top-[100%] z-[3] mt-1 -translate-x-1/2"
                data-equipment-slot-anchor="feet"
              >
                {renderSlot('feet')}
              </div>
            </div>
          </div>
          <SlotColumn
            slots={PAPER_DOLL_RIGHT}
            side="right"
            renderSlot={renderSlot}
          />
        </div>
      </div>

      {/* Mobile square grid (same tiles as desktop) */}
      <ul
        className="grid grid-cols-4 justify-items-center gap-x-2 gap-y-3 md:hidden"
        role="list"
      >
        {EQUIPMENT_SLOTS.map((slot) => renderSlot(slot))}
      </ul>

      <AlertDialog
        open={pendingEquip !== null}
        onOpenChange={(open) => {
          if (!open) setPendingEquip(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ausrüstung ersetzen?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingEquip
                ? `Folgende Gegenstände kehren ins Inventar zurück: ${pendingEquip.displacedNames.join(', ')}.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPendingEquip}>Ausrüsten</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
