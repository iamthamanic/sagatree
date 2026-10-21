/**
 * InventoryItemActions — per-stack action menu for Inventory v2 (#110/#111/#113).
 * Desktop: DropdownMenu. Mobile: bottom Sheet with ~44px action rows.
 * Verschieben, Teilen, Zusammenführen, Ausrüsten, Öffnen, Behälter,
 * Verbrauchen, Entfernen. Domain ops only.
 * Location: src/app/character/inventory/InventoryItemActions.tsx
 */
import { useState } from 'react';
import {
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../shared/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../shared/ui/dropdown-menu';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../../shared/ui/sheet';
import { useIsMobile } from '../../../shared/ui/use-mobile';
import {
  consumeItem,
  equipItem,
  findInstanceLocation,
  freeBaseSlotIndices,
  isContainerInstance,
  isSameStackFamily,
  mergeStacks,
  moveIntoContainer,
  removeItem,
  splitStack,
  type EquipmentSlot,
  type InventoryOperationResult,
  type InventoryState,
  type ItemDefinitionLookup,
} from '../../../domains/character/inventory-v2';
import {
  declaredEquipSlots,
  emptyCompatibleEquipSlots,
  freeSlotsForEquipDisplace,
  itemDisplayName,
  previewDisplacedOnEquip,
} from './inventory-equip-preview';
import {
  EQUIP_DISPLACE_NO_ROOM,
  EQUIPMENT_SLOT_LABELS,
  formatStrengthRequirement,
} from './inventory-ui-labels';

export interface InventoryItemActionsProps {
  state: InventoryState;
  lookup: ItemDefinitionLookup;
  instanceId: string;
  slotIndex: number;
  strength: number;
  onApplyResult: (next: InventoryState) => void;
  onRefuse: (reason: string) => void;
  onRequestMove: () => void;
  onRequestSplit: () => void;
  onOpenContainer?: (containerInstanceId: string) => void;
}

type PendingEquip = {
  slot: EquipmentSlot;
  displacedNames: string[];
};

export function InventoryItemActions({
  state,
  lookup,
  instanceId,
  slotIndex,
  strength,
  onApplyResult,
  onRefuse,
  onRequestMove,
  onRequestSplit,
  onOpenContainer,
}: InventoryItemActionsProps) {
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeAmount, setRemoveAmount] = useState(1);
  const [removeMode, setRemoveMode] = useState<'one' | 'custom' | 'all'>('all');
  const [equipPickerOpen, setEquipPickerOpen] = useState(false);
  const [equipChoices, setEquipChoices] = useState<EquipmentSlot[]>([]);
  const [pendingEquip, setPendingEquip] = useState<PendingEquip | null>(null);
  const [containerPickerOpen, setContainerPickerOpen] = useState(false);
  const [actionsSheetOpen, setActionsSheetOpen] = useState(false);
  const isMobile = useIsMobile();

  const instance = state.instances[instanceId];
  if (!instance) return null;
  const definition = lookup(instance.definitionId);

  const canSplit = Boolean(definition && instance.quantity > 1 && (definition.stackLimit ?? 1) > 1);
  const mergeTargetExists = Object.values(state.instances).some((other) => {
    if (other.instanceId === instanceId) return false;
    if (!isSameStackFamily(instance, other)) return false;
    const otherDef = lookup(other.definitionId);
    if (!otherDef || otherDef.stackLimit <= 1) return false;
    return other.quantity < otherDef.stackLimit;
  });
  const equipSlots = definition?.equipSlots ?? [];
  const canEquip = equipSlots.length > 0;
  const canConsume = definition?.type === 'consumable';
  const canOpen = Boolean(definition?.containerCapacity && definition.containerCapacity > 0);
  const strengthRequired = definition?.requirements?.minimumStrength;
  const strengthBlocked =
    strengthRequired !== undefined && strength < strengthRequired;

  const validContainers = Object.keys(state.containers).filter((containerId) => {
    if (!isContainerInstance(state, containerId, lookup)) return false;
    const positions = state.containers[containerId];
    if (!positions || !positions.some((ref) => ref === null)) return false;
    const location = findInstanceLocation(state, containerId);
    return location?.kind === 'base' || location?.kind === 'equipment';
  });
  const canMoveIntoContainer =
    !isContainerInstance(state, instanceId, lookup) && validContainers.length > 0;

  const applyOrRefuse = (result: InventoryOperationResult) => {
    if (result.ok === false) {
      onRefuse(result.reason);
      return;
    }
    onApplyResult(result.state);
  };

  const applyEquipOrRefuse = (result: InventoryOperationResult) => {
    if (result.ok === false) {
      if (result.error === 'REQUIREMENT_NOT_MET' && strengthRequired !== undefined) {
        onRefuse(formatStrengthRequirement(strengthRequired, strength));
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
  };

  const runEquip = (slot: EquipmentSlot, confirmed: boolean) => {
    if (!definition) return;
    if (strengthBlocked && strengthRequired !== undefined) {
      onRefuse(formatStrengthRequirement(strengthRequired, strength));
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
        slot,
        displacedNames: displaced.map((id) => itemDisplayName(state, lookup, id)),
      });
      return;
    }
    applyEquipOrRefuse(equipItem(state, lookup, instanceId, slot, strength));
  };

  const handleEquip = () => {
    if (!definition || equipSlots.length === 0) return;
    if (strengthBlocked && strengthRequired !== undefined) {
      onRefuse(formatStrengthRequirement(strengthRequired, strength));
      return;
    }

    const empty = emptyCompatibleEquipSlots(state, definition, instanceId);
    if (empty.length === 1) {
      runEquip(empty[0], false);
      return;
    }
    if (empty.length > 1) {
      setEquipChoices(empty);
      setEquipPickerOpen(true);
      return;
    }

    const declared = declaredEquipSlots(definition);
    if (declared.length === 0) {
      onRefuse(`${definition.name} ist nicht ausrüstbar.`);
      return;
    }
    if (declared.length === 1) {
      runEquip(declared[0], false);
      return;
    }
    setEquipChoices(declared);
    setEquipPickerOpen(true);
  };

  const handleConsume = () => {
    applyOrRefuse(consumeItem(state, lookup, instanceId));
  };

  const handleQuickMerge = () => {
    const target = Object.values(state.instances).find((other) => {
      if (other.instanceId === instanceId) return false;
      if (!isSameStackFamily(instance, other)) return false;
      const otherDef = lookup(other.definitionId);
      if (!otherDef || otherDef.stackLimit <= 1) return false;
      return other.quantity < otherDef.stackLimit;
    });
    if (!target) {
      onRefuse('Kein kompatibler Stapel gefunden.');
      return;
    }
    applyOrRefuse(mergeStacks(state, lookup, instanceId, target.instanceId));
  };

  const handleMoveIntoContainer = (containerInstanceId: string) => {
    const positions = state.containers[containerInstanceId];
    const freeIndex = positions?.findIndex((ref) => ref === null) ?? -1;
    if (freeIndex < 0) {
      onRefuse('Behälter ist voll.');
      return;
    }
    const result = moveIntoContainer(
      state,
      lookup,
      instanceId,
      containerInstanceId,
      freeIndex,
    );
    setContainerPickerOpen(false);
    if (result.ok === false) {
      onRefuse(result.reason);
      return;
    }
    onApplyResult(result.state);
  };

  const openRemove = () => {
    setRemoveMode('all');
    setRemoveAmount(1);
    setRemoveOpen(true);
  };

  const confirmRemove = () => {
    let amount = instance.quantity;
    if (instance.quantity > 1) {
      if (removeMode === 'one') amount = 1;
      else if (removeMode === 'custom') {
        amount = Math.min(instance.quantity, Math.max(1, removeAmount));
      } else amount = instance.quantity;
    }

    if (amount >= instance.quantity) {
      applyOrRefuse(removeItem(state, instanceId));
      setRemoveOpen(false);
      return;
    }

    const free = freeBaseSlotIndices(state).find((index) => index !== slotIndex);
    if (free === undefined) {
      onRefuse('Kein freier Platz zum Abspalten der zu entfernenden Menge.');
      return;
    }
    const split = splitStack(state, lookup, instanceId, amount, { kind: 'base', slotIndex: free });
    if (split.ok === false) {
      onRefuse(split.reason);
      return;
    }
    const splitInstanceId = split.state.baseSlots[free];
    if (!splitInstanceId) {
      onRefuse('Teilmenge konnte nicht abgespalten werden.');
      return;
    }
    applyOrRefuse(removeItem(split.state, splitInstanceId));
    setRemoveOpen(false);
  };

  const closeActionsSheet = () => setActionsSheetOpen(false);

  const actionRows = (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-full justify-start"
        onClick={() => {
          closeActionsSheet();
          onRequestMove();
        }}
      >
        Verschieben
      </Button>
      {canSplit && (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full justify-start"
          onClick={() => {
            closeActionsSheet();
            onRequestSplit();
          }}
        >
          Stapel teilen
        </Button>
      )}
      {mergeTargetExists && (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full justify-start"
          onClick={() => {
            closeActionsSheet();
            handleQuickMerge();
          }}
        >
          Mit gleichem Stapel zusammenführen
        </Button>
      )}
      {canEquip && (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full justify-start"
          onClick={() => {
            closeActionsSheet();
            handleEquip();
          }}
        >
          Ausrüsten
        </Button>
      )}
      {canOpen && onOpenContainer && (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full justify-start"
          onClick={() => {
            closeActionsSheet();
            onOpenContainer(instanceId);
          }}
        >
          Öffnen
        </Button>
      )}
      {canMoveIntoContainer && (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full justify-start"
          onClick={() => {
            closeActionsSheet();
            setContainerPickerOpen(true);
          }}
        >
          In Behälter verschieben
        </Button>
      )}
      {canConsume && (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full justify-start"
          onClick={() => {
            closeActionsSheet();
            handleConsume();
          }}
        >
          Verbrauchen
        </Button>
      )}
      <Button
        type="button"
        variant="destructive"
        className="min-h-11 w-full justify-start"
        onClick={() => {
          closeActionsSheet();
          openRemove();
        }}
      >
        Aus Inventar entfernen
      </Button>
    </>
  );

  return (
    <>
      {isMobile ? (
        <>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-11 min-h-11 min-w-11"
            aria-label="Gegenstandsaktionen"
            data-inventory-item-actions-trigger
            onClick={(event) => {
              event.stopPropagation();
              setActionsSheetOpen(true);
            }}
          >
            <DotsThree className="h-5 w-5" />
          </Button>
          <Sheet open={actionsSheetOpen} onOpenChange={setActionsSheetOpen}>
            <SheetContent
              side="bottom"
              className="max-h-[85vh] overflow-y-auto"
              data-inventory-item-actions-sheet
              onClick={(event) => event.stopPropagation()}
            >
              <SheetHeader>
                <SheetTitle>{definition?.name ?? 'Gegenstand'}</SheetTitle>
                <SheetDescription>
                  Platz {slotIndex + 1}
                  {instance.quantity > 1 ? ` · Menge ${instance.quantity}` : ''}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-2 px-4 pb-6">{actionRows}</div>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label="Gegenstandsaktionen"
              data-inventory-item-actions-trigger
              onClick={(event) => event.stopPropagation()}
            >
              <DotsThree className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
            <DropdownMenuItem onSelect={() => onRequestMove()}>Verschieben</DropdownMenuItem>
            {canSplit && (
              <DropdownMenuItem onSelect={() => onRequestSplit()}>Stapel teilen</DropdownMenuItem>
            )}
            {mergeTargetExists && (
              <DropdownMenuItem onSelect={() => handleQuickMerge()}>
                Mit gleichem Stapel zusammenführen
              </DropdownMenuItem>
            )}
            {canEquip && (
              <DropdownMenuItem onSelect={() => handleEquip()}>Ausrüsten</DropdownMenuItem>
            )}
            {canOpen && onOpenContainer && (
              <DropdownMenuItem onSelect={() => onOpenContainer(instanceId)}>
                Öffnen
              </DropdownMenuItem>
            )}
            {canMoveIntoContainer && (
              <DropdownMenuItem onSelect={() => setContainerPickerOpen(true)}>
                In Behälter verschieben
              </DropdownMenuItem>
            )}
            {canConsume && (
              <DropdownMenuItem onSelect={() => handleConsume()}>Verbrauchen</DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => openRemove()}
            >
              Aus Inventar entfernen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={equipPickerOpen} onOpenChange={setEquipPickerOpen}>
        <DialogContent onClick={(event) => event.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Ausrüstungsplatz wählen</DialogTitle>
            <DialogDescription>
              {definition?.name ?? 'Gegenstand'} — Zielplatz auswählen.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            {equipChoices.map((slot) => (
              <Button
                key={slot}
                type="button"
                variant="outline"
                className="min-h-11 justify-start"
                onClick={() => {
                  setEquipPickerOpen(false);
                  runEquip(slot, false);
                }}
              >
                {EQUIPMENT_SLOT_LABELS[slot]}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setEquipPickerOpen(false)}>
              Abbrechen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingEquip !== null}
        onOpenChange={(open) => {
          if (!open) setPendingEquip(null);
        }}
      >
        <AlertDialogContent onClick={(event) => event.stopPropagation()}>
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
            <AlertDialogAction
              onClick={() => {
                if (!pendingEquip) return;
                const slot = pendingEquip.slot;
                setPendingEquip(null);
                runEquip(slot, true);
              }}
            >
              Ausrüsten
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={containerPickerOpen} onOpenChange={setContainerPickerOpen}>
        <DialogContent onClick={(event) => event.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>In Behälter verschieben</DialogTitle>
            <DialogDescription>Zielbehälter wählen.</DialogDescription>
          </DialogHeader>
          <ul className="max-h-64 space-y-2 overflow-y-auto py-2">
            {validContainers.map((containerId) => (
              <li key={containerId}>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full justify-start"
                  onClick={() => handleMoveIntoContainer(containerId)}
                >
                  {itemDisplayName(state, lookup, containerId)}
                </Button>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setContainerPickerOpen(false)}>
              Abbrechen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent onClick={(event) => event.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Aus Inventar entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Gegenstand wird vom Charakter entfernt — nicht in die Welt abgelegt. Es entsteht
              kein Boden- oder Welt-Loot.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {instance.quantity > 1 && (
            <div className="space-y-3 py-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={removeMode === 'one' ? 'default' : 'outline'}
                  onClick={() => setRemoveMode('one')}
                >
                  1
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={removeMode === 'custom' ? 'default' : 'outline'}
                  onClick={() => setRemoveMode('custom')}
                >
                  Menge
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={removeMode === 'all' ? 'default' : 'outline'}
                  onClick={() => setRemoveMode('all')}
                >
                  Gesamten Stapel
                </Button>
              </div>
              {removeMode === 'custom' && (
                <div className="space-y-2">
                  <Label htmlFor={`remove-amount-${instanceId}`}>Menge (1–{instance.quantity})</Label>
                  <Input
                    id={`remove-amount-${instanceId}`}
                    type="number"
                    min={1}
                    max={instance.quantity}
                    value={removeAmount}
                    onChange={(event) =>
                      setRemoveAmount(
                        Math.min(
                          instance.quantity,
                          Math.max(1, Number.parseInt(event.target.value, 10) || 1),
                        ),
                      )
                    }
                  />
                </div>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>Entfernen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
