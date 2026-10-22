/**
 * InventoryCatalogDialog — Add-catalog for Inventory v2 desktop (#110 / #143).
 * Tabs Core / Standard / Welt / Eigene by source origin; search + type / Setting /
 * Kontext / Quelle filters; thumbnail-only (no 3D); add confirmation with quantity
 * and dry-run slot preview via addItems on a clone.
 * Location: src/app/character/inventory/InventoryCatalogDialog.tsx
 */
import { useEffect, useState } from 'react';
import {
  Plus
} from '@phosphor-icons/react';
import { InventoryItemThumb } from './InventoryItemThumb';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../shared/ui/dialog';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../shared/ui/tabs';
import {
  addItems,
  calculateTotalLoad,
  cloneInventory,
  freeBaseSlotIndices,
  type InventoryState,
  type ItemDefinition,
  type ItemDefinitionLookup,
} from '../../../domains/character/inventory-v2';
import {
  librarySourceFromOrigin,
  normalizeItemDefinition,
  type ItemContext,
  type ItemSettingTag,
  type LibraryItemSource,
} from '../../../domains/items';
import type { CharacterItemCatalog } from '../../../infrastructure/inventory/item-catalog-service';
import { useItemThumbnailSrc } from '../../items';
import {
  INVENTORY_CONTEXT_FILTER_OPTIONS,
  INVENTORY_CONTEXT_LABELS,
  INVENTORY_SETTING_FILTER_OPTIONS,
  INVENTORY_SETTING_LABELS,
  INVENTORY_SOURCE_FILTER_OPTIONS,
  INVENTORY_SOURCE_LABELS,
  INVENTORY_TYPE_FILTER_OPTIONS,
  INVENTORY_TYPE_LABELS,
  inventoryCarryCapacity,
} from './inventory-ui-labels';
import { PersonalItemFormDialog } from './PersonalItemFormDialog';
import { InventoryAffordabilityDialog } from './InventoryAffordabilityDialog';
import {
  applyPurchaseMode,
  resolveAffordability,
  type AbstractResourceLevel,
  type AffordabilityDecision,
  type PurchaseMode,
} from '../../../domains/rules/sagatree/items';

export interface InventoryCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: CharacterItemCatalog | null;
  state: InventoryState;
  strength: number;
  /** Character abstract resources 0–5 for affordability (#32). */
  resources: AbstractResourceLevel;
  onResourcesChange: (next: AbstractResourceLevel) => void;
  onApplyResult: (next: InventoryState) => void;
  onRefuse: (reason: string) => void;
  onCatalogRefresh: () => void;
  onHighlightSlots: (slots: number[]) => void;
}

function previewAdd(
  state: InventoryState,
  lookup: ItemDefinitionLookup,
  definitionId: string,
  quantity: number,
): {
  ok: boolean;
  reason?: string;
  newSlotsNeeded: number;
  projectedLoad: number;
  affectedSlots: number[];
} {
  const beforeFree = new Set(freeBaseSlotIndices(state));
  const result = addItems(cloneInventory(state), lookup, definitionId, quantity);
  if (result.ok === false) {
    return {
      ok: false,
      reason: result.reason,
      newSlotsNeeded: 0,
      projectedLoad: calculateTotalLoad(state, lookup),
      affectedSlots: [],
    };
  }
  const afterFree = freeBaseSlotIndices(result.state);
  const newSlotsNeeded = Math.max(0, beforeFree.size - afterFree.length);
  const affectedSlots: number[] = [];
  result.state.baseSlots.forEach((id, index) => {
    if (id === null) return;
    const beforeId = state.baseSlots[index];
    const beforeQty = beforeId ? state.instances[beforeId]?.quantity : undefined;
    const afterQty = result.state.instances[id]?.quantity;
    if (beforeId !== id || beforeQty !== afterQty) {
      affectedSlots.push(index);
    }
  });
  return {
    ok: true,
    newSlotsNeeded,
    projectedLoad: calculateTotalLoad(result.state, lookup),
    affectedSlots,
  };
}

function thumbSlot(definition: ItemDefinition): 'mainHand' | 'body' | 'special' {
  const first = definition.equipSlots?.[0];
  if (first === 'mainHand' || first === 'offHand') return 'mainHand';
  if (first === 'body' || first === 'head' || first === 'feet') return 'body';
  return 'special';
}

function CatalogRow({
  definition,
  onSelect,
  onEditPersonal,
}: {
  definition: ItemDefinition;
  onSelect: () => void;
  onEditPersonal?: () => void;
}) {
  const normalized = normalizeItemDefinition(definition);
  const source = librarySourceFromOrigin(normalized.origin);
  const sourceLabel = INVENTORY_SOURCE_LABELS[source];
  const assetSrc = useItemThumbnailSrc(normalized.assetKey);
  const settings = (normalized.settingTags ?? [])
    .map((tag) => INVENTORY_SETTING_LABELS[tag])
    .filter(Boolean);
  const contexts = (normalized.contexts ?? [])
    .slice(0, 2)
    .map((ctx) => INVENTORY_CONTEXT_LABELS[ctx])
    .filter(Boolean);

  return (
    <li
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-start sm:justify-between"
      data-inventory-catalog-source={source}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <div className="size-14 shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted/50">
          <InventoryItemThumb
            slot={thumbSlot(normalized)}
            definition={normalized}
            assetSrc={assetSrc}
            alt={`Vorschaubild ${normalized.name}`}
            className="size-full"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{normalized.name}</p>
          {normalized.description && (
            <p className="mt-1 text-sm text-muted-foreground">{normalized.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            <Badge variant="outline" aria-label={`Quelle ${sourceLabel}`}>
              {sourceLabel}
            </Badge>
            <Badge variant="outline">{INVENTORY_TYPE_LABELS[normalized.type]}</Badge>
            <Badge variant="secondary">Last {normalized.load}</Badge>
            <Badge variant="outline">Kosten {normalized.cost}</Badge>
            {settings.map((label) => (
              <Badge key={label} variant="secondary">
                {label}
              </Badge>
            ))}
            {contexts.map((label) => (
              <Badge key={label} variant="outline">
                {label}
              </Badge>
            ))}
            {normalized.damage && <Badge>{normalized.damage}</Badge>}
            {normalized.protection && <Badge>Schutz {normalized.protection}</Badge>}
            {normalized.containerCapacity && (
              <Badge variant="outline">Kapazität {normalized.containerCapacity}</Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {onEditPersonal && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11"
            onClick={onEditPersonal}
          >
            Bearbeiten
          </Button>
        )}
        <Button type="button" size="sm" className="min-h-11" onClick={onSelect}>
          Hinzufügen
        </Button>
      </div>
    </li>
  );
}

export function InventoryCatalogDialog({
  open,
  onOpenChange,
  catalog,
  state,
  strength,
  resources,
  onResourcesChange,
  onApplyResult,
  onRefuse,
  onCatalogRefresh,
  onHighlightSlots,
}: InventoryCatalogDialogProps) {
  const [tab, setTab] = useState('core');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ItemDefinition['type']>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | LibraryItemSource>('all');
  const [settingFilter, setSettingFilter] = useState<'all' | ItemSettingTag>('all');
  const [contextFilter, setContextFilter] = useState<'all' | ItemContext>('all');
  const [selected, setSelected] = useState<ItemDefinition | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [personalOpen, setPersonalOpen] = useState(false);
  const [editingPersonal, setEditingPersonal] = useState<ItemDefinition | null>(null);
  const [pendingAffordability, setPendingAffordability] = useState<{
    decision: AffordabilityDecision;
    itemName: string;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setQuantity(1);
      setSearch('');
      setTypeFilter('all');
      setSourceFilter('all');
      setSettingFilter('all');
      setContextFilter('all');
      return;
    }
    setTab('core');
  }, [open]);

  const hasWorld = Boolean(catalog?.effectiveWorldProfileId);
  const addable = catalog?.addable ?? [];
  const hasStandard = addable.some(
    (definition) => librarySourceFromOrigin(normalizeItemDefinition(definition).origin) === 'standard',
  );
  const overflowBlocks =
    state.legacyOverflow.length > 0
      ? 'Legacy-Overflow ist nicht leer — neue Basis-Stapel sind blockiert.'
      : null;

  const matchesFilters = (definition: ItemDefinition): boolean => {
    const normalized = normalizeItemDefinition(definition);
    const source = librarySourceFromOrigin(normalized.origin);
    if (sourceFilter !== 'all' && source !== sourceFilter) return false;
    if (typeFilter !== 'all' && normalized.type !== typeFilter) return false;
    if (settingFilter !== 'all') {
      const tags = normalized.settingTags ?? [];
      if (!tags.includes(settingFilter)) return false;
    }
    if (contextFilter !== 'all') {
      const contexts = normalized.contexts ?? [];
      if (!contexts.includes(contextFilter)) return false;
    }
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      normalized.name.toLowerCase().includes(q) ||
      normalized.description.toLowerCase().includes(q)
    );
  };

  const filterBySource = (source: LibraryItemSource): ItemDefinition[] => {
    if (!catalog) return [];
    return catalog.addable.filter((definition) => {
      const normalized = normalizeItemDefinition(definition);
      if (librarySourceFromOrigin(normalized.origin) !== source) return false;
      return matchesFilters(definition);
    });
  };

  const preview = selected && catalog
    ? previewAdd(state, catalog.lookup, selected.id, quantity)
    : null;

  const commitAdd = (mode: PurchaseMode | 'free') => {
    if (!selected || !catalog) return;
    const result = addItems(state, catalog.lookup, selected.id, quantity);
    if (result.ok === false) {
      onRefuse(result.reason);
      setPendingAffordability(null);
      return;
    }
    if (mode === 'purchase' && pendingAffordability) {
      onResourcesChange(
        applyPurchaseMode(resources, 'purchase', pendingAffordability.decision),
      );
    }
    const previewResult = previewAdd(state, catalog.lookup, selected.id, quantity);
    onApplyResult(result.state);
    onHighlightSlots(previewResult.affectedSlots);
    setPendingAffordability(null);
    setSelected(null);
    onOpenChange(false);
  };

  const handleAdd = () => {
    if (!selected || !catalog) return;
    const normalized = normalizeItemDefinition(selected);
    const decision = resolveAffordability(normalized.cost, resources);
    if (decision.kind === 'allow-free') {
      commitAdd('free');
      return;
    }
    setPendingAffordability({ decision, itemName: normalized.name });
  };

  const handleAffordabilityConfirm = (mode: PurchaseMode) => {
    commitAdd(mode);
  };

  const tabCount = 2 + (hasWorld ? 1 : 0) + (hasWorld && hasStandard ? 1 : 0);
  const tabGridClass =
    tabCount === 4 ? 'grid-cols-4' : tabCount === 3 ? 'grid-cols-3' : 'grid-cols-2';

  const renderList = (definitions: ItemDefinition[]) => {
    if (definitions.length === 0) {
      return (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Keine Gegenstände für diesen Filter.
        </p>
      );
    }
    return (
      <ul className="space-y-2">
        {definitions.map((definition) => (
          <CatalogRow
            key={definition.id}
            definition={definition}
            onSelect={() => {
              setSelected(definition);
              setQuantity(1);
            }}
            onEditPersonal={
              librarySourceFromOrigin(normalizeItemDefinition(definition).origin) === 'personal'
                ? () => {
                    setEditingPersonal(definition);
                    setPersonalOpen(true);
                  }
                : undefined
            }
          />
        ))}
      </ul>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="flex max-h-[90dvh] w-[calc(100%-1rem)] max-w-3xl flex-col overflow-x-hidden overflow-y-auto sm:max-w-3xl"
          data-inventory-catalog-dialog
        >
          <DialogHeader>
            <DialogTitle>Gegenstand hinzufügen</DialogTitle>
            <DialogDescription>
              Wähle aus Core
              {hasWorld && hasStandard ? ', Standard' : ''}
              {hasWorld ? ', Welt' : ''} oder eigenen Definitionen. Nur Vorschaubilder — kein 3D.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-col gap-3 overflow-x-hidden overflow-y-hidden">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="catalog-search">Suche</Label>
                <Input
                  id="catalog-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name oder Beschreibung"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-type">Typ</Label>
                <Select
                  value={typeFilter}
                  onValueChange={(value) =>
                    setTypeFilter(value === 'all' ? 'all' : (value as ItemDefinition['type']))
                  }
                >
                  <SelectTrigger id="catalog-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_TYPE_FILTER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-source">Quelle</Label>
                <Select
                  value={sourceFilter}
                  onValueChange={(value) =>
                    setSourceFilter(value === 'all' ? 'all' : (value as LibraryItemSource))
                  }
                >
                  <SelectTrigger id="catalog-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_SOURCE_FILTER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-setting">Setting</Label>
                <Select
                  value={settingFilter}
                  onValueChange={(value) =>
                    setSettingFilter(value === 'all' ? 'all' : (value as ItemSettingTag))
                  }
                >
                  <SelectTrigger id="catalog-setting">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_SETTING_FILTER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="catalog-context">Kontext</Label>
                <Select
                  value={contextFilter}
                  onValueChange={(value) =>
                    setContextFilter(value === 'all' ? 'all' : (value as ItemContext))
                  }
                >
                  <SelectTrigger id="catalog-context">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_CONTEXT_FILTER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {overflowBlocks && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {overflowBlocks} Top-ups bestehender Stapel bleiben möglich.
              </p>
            )}

            <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 overflow-hidden">
              <TabsList className={`grid w-full ${tabGridClass}`}>
                <TabsTrigger value="core">Core</TabsTrigger>
                {hasWorld && hasStandard && (
                  <TabsTrigger value="standard">Standard</TabsTrigger>
                )}
                {hasWorld && <TabsTrigger value="world">Welt</TabsTrigger>}
                <TabsTrigger value="personal">Eigene</TabsTrigger>
              </TabsList>
              <div className="mt-3 max-h-[40vh] overflow-y-auto pr-1">
                <TabsContent value="core" className="mt-0">
                  {renderList(filterBySource('core'))}
                </TabsContent>
                {hasWorld && hasStandard && (
                  <TabsContent value="standard" className="mt-0">
                    {renderList(filterBySource('standard'))}
                  </TabsContent>
                )}
                {hasWorld && (
                  <TabsContent value="world" className="mt-0">
                    {renderList(filterBySource('world'))}
                  </TabsContent>
                )}
                <TabsContent value="personal" className="mt-0 space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => {
                      setEditingPersonal(null);
                      setPersonalOpen(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Eigenen Gegenstand erstellen
                  </Button>
                  {renderList(filterBySource('personal'))}
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selected)} onOpenChange={(next) => !next && setSelected(null)}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.name ?? 'Hinzufügen'}</DialogTitle>
            <DialogDescription>
              Menge festlegen. Die gesamte Menge muss atomar passen.
            </DialogDescription>
          </DialogHeader>
          {selected && catalog && preview && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="add-quantity">Menge (1–999)</Label>
                <Input
                  id="add-quantity"
                  type="number"
                  min={1}
                  max={999}
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(
                      Math.min(999, Math.max(1, Number.parseInt(event.target.value, 10) || 1)),
                    )
                  }
                />
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
                <p>
                  Benötigt {preview.newSlotsNeeded} neue Inventarplätze
                </p>
                <p className="mt-1 text-muted-foreground">
                  Projizierte Last {preview.projectedLoad} / {inventoryCarryCapacity(strength)}
                </p>
                {!preview.ok && preview.reason && (
                  <p className="mt-2 text-destructive">{preview.reason}</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelected(null)}>
              Abbrechen
            </Button>
            <Button type="button" disabled={!preview?.ok} onClick={handleAdd}>
              Hinzufügen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PersonalItemFormDialog
        open={personalOpen}
        onOpenChange={setPersonalOpen}
        editing={editingPersonal}
        onSaved={onCatalogRefresh}
      />

      <InventoryAffordabilityDialog
        open={Boolean(pendingAffordability)}
        decision={pendingAffordability?.decision ?? null}
        itemName={pendingAffordability?.itemName ?? ''}
        onCancel={() => setPendingAffordability(null)}
        onConfirm={handleAffordabilityConfirm}
      />
    </>
  );
}
