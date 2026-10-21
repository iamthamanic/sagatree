/**
 * CharacterInventoryV2Panel — orchestrates Inventory v2 UI (#110/#111/#113).
 * Loads catalog via item-catalog-service, applies domain ops through onChange.
 * Desktop (md+): base grid beside Ausrüstung (lg:flex-row).
 * Mobile (<640px): segmented Inventar | Ausrüstung views; move via Sheet.
 * Location: src/app/character/inventory/CharacterInventoryV2Panel.tsx
 */
import { useEffect, useRef, useState } from 'react';
import {
  SortAscending,
  Question,
  Plus
} from '@phosphor-icons/react';
import { toast } from 'sonner@2.0.3';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../shared/ui/tooltip';
import {
  BASE_SLOT_COUNT,
  calculateTotalLoad,
  coreCatalogRecords,
  createDefinitionLookup,
  mergeStacks,
  moveBaseSlot,
  selectCatalogDefinitions,
  sortBaseGrid,
  splitStack,
  type InventoryState,
  type ItemDefinitionLookup,
} from '../../../domains/character/inventory-v2';
import {
  loadCharacterItemCatalog,
  type CharacterItemCatalog,
} from '../../../infrastructure/inventory/item-catalog-service';
import { InventoryBaseGrid } from './InventoryBaseGrid';
import { InventoryCatalogDialog } from './InventoryCatalogDialog';
import { InventoryContainerPanel } from './InventoryContainerPanel';
import { InventoryEquipmentPanel } from './InventoryEquipmentPanel';
import {
  InventoryMobileViewSwitch,
  type InventoryMobileView,
} from './InventoryMobileViewSwitch';
import { InventoryMoveTargetSheet } from './InventoryMoveTargetSheet';
import { InventoryOverflowSection } from './InventoryOverflowSection';
import { InventorySummaryBar } from './InventorySummaryBar';
import {
  DEFAULT_ABSTRACT_RESOURCE_LEVEL,
  type AbstractResourceLevel,
} from '../../../domains/rules/sagatree/items';

export interface InventoryLoadInfo {
  totalLoad: number;
  occupied: number;
}

export interface CharacterInventoryV2PanelProps {
  state: InventoryState;
  onChange: (next: InventoryState) => void;
  strength: number;
  characterId: string | null;
  userId: string;
  onLoadInfoChange?: (info: InventoryLoadInfo) => void;
  /** Character abstract resources 0–5 (#32). */
  resources?: AbstractResourceLevel;
  onResourcesChange?: (next: AbstractResourceLevel) => void;
}

type InteractionMode =
  | { kind: 'idle' }
  | { kind: 'move'; sourceSlot: number }
  | { kind: 'split'; sourceSlot: number; amount: number };

const emptyLookup: ItemDefinitionLookup = () => undefined;

/** Core-only catalog when Personal/World rows cannot be loaded (offline / CI). */
function coreOnlyCatalog(userId: string): CharacterItemCatalog {
  const records = coreCatalogRecords();
  const context = { userId, effectiveWorldProfileId: null as string | null };
  return {
    effectiveWorldProfileId: null,
    addable: selectCatalogDefinitions(records, context),
    lookup: createDefinitionLookup(records, context),
    records,
  };
}

/** Mobile inventory contract: segmented layout below 640px (Tailwind md). */
const NARROW_MAX_PX = 639;

function useIsNarrowViewport(): boolean {
  const [narrow, setNarrow] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${NARROW_MAX_PX}px)`).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${NARROW_MAX_PX}px)`);
    const sync = () => setNarrow(mql.matches);
    sync();
    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  }, []);

  return narrow;
}

export function CharacterInventoryV2Panel({
  state,
  onChange,
  strength,
  characterId,
  userId,
  onLoadInfoChange,
  resources: resourcesProp,
  onResourcesChange: onResourcesChangeProp,
}: CharacterInventoryV2PanelProps) {
  const [localResources, setLocalResources] = useState<AbstractResourceLevel>(
    DEFAULT_ABSTRACT_RESOURCE_LEVEL,
  );
  const resources = resourcesProp ?? localResources;
  const onResourcesChange = onResourcesChangeProp ?? setLocalResources;
  const [catalog, setCatalog] = useState<CharacterItemCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [mode, setMode] = useState<InteractionMode>({ kind: 'idle' });
  const [splitAmount, setSplitAmount] = useState(1);
  const [highlightedSlots, setHighlightedSlots] = useState<ReadonlySet<number>>(new Set());
  const [openContainerInstanceId, setOpenContainerInstanceId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<InventoryMobileView>('inventar');
  const [moveSheetSlot, setMoveSheetSlot] = useState<number | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catalogRefreshKey = useRef(0);
  const isNarrow = useIsNarrowViewport();

  const lookup = catalog?.lookup ?? emptyLookup;
  const occupied = state.baseSlots.filter((slot) => slot !== null).length;
  const totalLoad = calculateTotalLoad(state, lookup);
  const onLoadInfoChangeRef = useRef(onLoadInfoChange);
  onLoadInfoChangeRef.current = onLoadInfoChange;

  useEffect(() => {
    onLoadInfoChangeRef.current?.({ totalLoad, occupied });
  }, [totalLoad, occupied]);

  const refreshCatalog = () => {
    catalogRefreshKey.current += 1;
    const refreshId = catalogRefreshKey.current;
    if (!userId) {
      setCatalog(coreOnlyCatalog('anonymous'));
      setCatalogError('Benutzer nicht angemeldet — nur Core-Katalog verfügbar.');
      return;
    }
    setCatalogLoading(true);
    setCatalogError('');
    void loadCharacterItemCatalog(characterId, userId)
      .then((next) => {
        if (refreshId !== catalogRefreshKey.current) return;
        setCatalog(next);
      })
      .catch((error) => {
        console.error('[inventory] catalog load failed', error);
        if (refreshId !== catalogRefreshKey.current) return;
        setCatalog(coreOnlyCatalog(userId));
        setCatalogError(
          error instanceof Error
            ? `${error.message} — Core-Katalog als Fallback.`
            : 'Katalog teilweise nicht verfügbar — Core-Katalog als Fallback.',
        );
      })
      .finally(() => {
        if (refreshId === catalogRefreshKey.current) setCatalogLoading(false);
      });
  };

  useEffect(() => {
    catalogRefreshKey.current += 1;
    const refreshId = catalogRefreshKey.current;
    if (!userId) {
      setCatalog(coreOnlyCatalog('anonymous'));
      setCatalogError('Benutzer nicht angemeldet — nur Core-Katalog verfügbar.');
      return;
    }
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError('');
    void loadCharacterItemCatalog(characterId, userId)
      .then((next) => {
        if (cancelled || refreshId !== catalogRefreshKey.current) return;
        setCatalog(next);
      })
      .catch((error) => {
        console.error('[inventory] catalog load failed', error);
        if (cancelled || refreshId !== catalogRefreshKey.current) return;
        setCatalog(coreOnlyCatalog(userId));
        setCatalogError(
          error instanceof Error
            ? `${error.message} — Core-Katalog als Fallback.`
            : 'Katalog teilweise nicht verfügbar — Core-Katalog als Fallback.',
        );
      })
      .finally(() => {
        if (!cancelled && refreshId === catalogRefreshKey.current) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [characterId, userId]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  const refuse = (reason: string) => {
    toast.error(reason);
  };

  const apply = (next: InventoryState) => {
    onChange(next);
  };

  const highlight = (slots: number[]) => {
    setHighlightedSlots(new Set(slots));
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedSlots(new Set()), 2500);
    const first = slots[0];
    if (first !== undefined) {
      const el = document.querySelector(`[data-slot-index="${first}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const handleDropSlot = (fromSlot: number, toSlot: number) => {
    const sourceId = state.baseSlots[fromSlot];
    const targetId = state.baseSlots[toSlot];
    if (sourceId === null) return;

    if (targetId !== null) {
      const merged = mergeStacks(state, lookup, sourceId, targetId);
      if (merged.ok) {
        apply(merged.state);
        return;
      }
    }

    const moved = moveBaseSlot(state, fromSlot, toSlot);
    if (moved.ok === false) {
      refuse(moved.reason);
      return;
    }
    apply(moved.state);
  };

  const handleSelectSlot = (slotIndex: number) => {
    if (mode.kind === 'move') {
      if (slotIndex === mode.sourceSlot) {
        setMode({ kind: 'idle' });
        return;
      }
      handleDropSlot(mode.sourceSlot, slotIndex);
      setMode({ kind: 'idle' });
      return;
    }

    if (mode.kind === 'split') {
      if (state.baseSlots[slotIndex] !== null) {
        refuse('Bitte einen leeren Inventarplatz wählen.');
        return;
      }
      const sourceId = state.baseSlots[mode.sourceSlot];
      if (!sourceId) {
        setMode({ kind: 'idle' });
        return;
      }
      const result = splitStack(state, lookup, sourceId, mode.amount, {
        kind: 'base',
        slotIndex,
      });
      if (result.ok === false) {
        refuse(result.reason);
        return;
      }
      apply(result.state);
      setMode({ kind: 'idle' });
      return;
    }
  };

  const handleSort = () => {
    const result = sortBaseGrid(state, lookup);
    if (result.ok === false) {
      refuse(result.reason);
      return;
    }
    apply(result.state);
    toast.success('Inventar sortiert');
  };

  const handleRequestSplit = (slotIndex: number) => {
    const instanceId = state.baseSlots[slotIndex];
    const instance = instanceId ? state.instances[instanceId] : undefined;
    if (!instance || instance.quantity < 2) {
      refuse('Stapel kann nicht geteilt werden.');
      return;
    }
    const amount = Math.min(instance.quantity - 1, Math.max(1, splitAmount));
    setSplitAmount(amount);
    setMode({ kind: 'split', sourceSlot: slotIndex, amount });
    toast('Leeren Zielplatz für den Teil-Stapel wählen');
  };

  const handleRequestMove = (slotIndex: number) => {
    if (isNarrow) {
      setMoveSheetSlot(slotIndex);
      setMode({ kind: 'idle' });
      return;
    }
    setMode({ kind: 'move', sourceSlot: slotIndex });
    toast('Zielplatz wählen (klicken)');
  };

  const selectedSourceSlot =
    mode.kind === 'move' || mode.kind === 'split' ? mode.sourceSlot : null;

  const toolbar = (
    <div className="flex min-w-0 flex-nowrap items-center gap-2">
      <Button
        type="button"
        className="h-11 shrink-0"
        onClick={() => setCatalogOpen(true)}
        disabled={catalogLoading && !catalog}
      >
        <Plus className="mr-2 h-4 w-4" />
        Gegenstand hinzufügen
      </Button>
      <Tooltip pinOnClick={false}>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0"
            onClick={handleSort}
            aria-label="Inventar sortieren"
          >
            <SortAscending className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[14rem] text-xs leading-snug">
          Gegenstände im Inventar sortieren
        </TooltipContent>
      </Tooltip>
      <Input
        id="inventory-grid-filter"
        className="h-11 min-w-0 flex-1"
        value={filterQuery}
        onChange={(event) => setFilterQuery(event.target.value)}
        placeholder="Name / Typ filtern…"
        aria-label="Filter (nur Anzeige)"
      />
    </div>
  );

  const inventoryHelp = isNarrow
    ? `${BASE_SLOT_COUNT} feste Basisplätze. Menü „Verschieben“ öffnet die Zielplatz-Auswahl.`
    : `${BASE_SLOT_COUNT} feste Basisplätze. Drag & Drop oder Menü „Verschieben“. Filter ändert nicht die gespeicherte Reihenfolge.`;

  /** Matching outer shells so Inventar + Ausrüstung read as equal panels on desktop. */
  const panelShellClass =
    'min-w-0 rounded-xl border border-foreground/10 bg-card/20 p-3 lg:flex lg:min-h-[30rem] lg:flex-col';

  const baseGridBlock = (
    <div className={`${panelShellClass} flex-1`} data-inventory-panel="inventar">
      <div className="mb-3 flex items-center gap-1.5">
        <h3 className="text-sm font-semibold tracking-wide">Inventar</h3>
        <Tooltip pinOnClick={false}>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              aria-label="Hilfe: Inventar"
            >
              <Question className="pointer-events-none size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            sideOffset={6}
            className="max-w-[260px] px-2.5 py-1.5 text-left text-[11px] leading-relaxed"
          >
            {inventoryHelp}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="min-h-0 flex-1">
        <InventoryBaseGrid
          state={state}
          lookup={lookup}
          strength={strength}
          selectedSourceSlot={selectedSourceSlot}
          moveMode={mode.kind === 'move' || mode.kind === 'split'}
          highlightedSlots={highlightedSlots}
          filterQuery={filterQuery}
          fillPanel
          onSelectSlot={handleSelectSlot}
          onDropSlot={handleDropSlot}
          onApplyResult={apply}
          onRefuse={refuse}
          onRequestMove={handleRequestMove}
          onRequestSplit={handleRequestSplit}
          onOpenContainer={(containerInstanceId) => {
            setOpenContainerInstanceId(containerInstanceId);
          }}
        />
      </div>
    </div>
  );

  const equipmentBlock = (
    <aside
      className={`${panelShellClass} w-full lg:w-96 lg:shrink-0`}
      data-inventory-panel="ausruestung"
    >
      <InventoryEquipmentPanel
        state={state}
        lookup={lookup}
        strength={strength}
        onApplyResult={apply}
        onRefuse={refuse}
      />
    </aside>
  );

  const modeBanner =
    mode.kind !== 'idle' ? (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
        <span>
          {mode.kind === 'move'
            ? `Verschieben: Quellplatz ${mode.sourceSlot + 1} — Zielplatz wählen`
            : `Teilen: ${mode.amount} Einheit(en) von Platz ${mode.sourceSlot + 1} — leeren Zielplatz wählen`}
        </span>
        {mode.kind === 'split' && (
          <Input
            className="h-9 w-20"
            type="number"
            min={1}
            aria-label="Teilmenge"
            value={mode.amount}
            onChange={(event) => {
              const instanceId = state.baseSlots[mode.sourceSlot];
              const qty = instanceId ? state.instances[instanceId]?.quantity ?? 2 : 2;
              const nextAmount = Math.min(
                qty - 1,
                Math.max(1, Number.parseInt(event.target.value, 10) || 1),
              );
              setSplitAmount(nextAmount);
              setMode({ ...mode, amount: nextAmount });
            }}
          />
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-11"
          onClick={() => setMode({ kind: 'idle' })}
        >
          Abbrechen
        </Button>
      </div>
    ) : null;

  const catalogErrorBanner = catalogError ? (
    <p className="text-sm text-destructive">
      {catalogError}{' '}
      <button type="button" className="underline" onClick={refreshCatalog}>
        Erneut laden
      </button>
    </p>
  ) : null;

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden" data-character-inventory-v2>
      <InventorySummaryBar
        occupiedSlots={occupied}
        totalLoad={totalLoad}
        strength={strength}
        overflowCount={state.legacyOverflow.length}
        resources={resources}
        onResourcesChange={onResourcesChange}
      />

      {isNarrow ? (
        <div className="space-y-5" data-inventory-mobile-layout>
          <InventoryMobileViewSwitch value={mobileView} onChange={setMobileView} />

          {mobileView === 'inventar' && (
            <div className="min-w-0 space-y-5" data-inventory-mobile-panel="inventar">
              {toolbar}
              {modeBanner}
              {catalogErrorBanner}
              {baseGridBlock}
              <InventoryOverflowSection
                state={state}
                lookup={lookup}
                onApplyResult={apply}
                onRefuse={refuse}
              />
            </div>
          )}

          {mobileView === 'ausruestung' && (
            <div className="min-w-0 space-y-5" data-inventory-mobile-panel="ausruestung">
              {equipmentBlock}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5" data-inventory-desktop-layout>
          {toolbar}
          {modeBanner}
          {catalogErrorBanner}
          <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
            {baseGridBlock}
            {equipmentBlock}
          </div>
          <InventoryOverflowSection
            state={state}
            lookup={lookup}
            onApplyResult={apply}
            onRefuse={refuse}
          />
        </div>
      )}

      <InventoryCatalogDialog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        catalog={catalog}
        state={state}
        strength={strength}
        resources={resources}
        onResourcesChange={onResourcesChange}
        onApplyResult={apply}
        onRefuse={refuse}
        onCatalogRefresh={refreshCatalog}
        onHighlightSlots={highlight}
      />

      <InventoryContainerPanel
        open={openContainerInstanceId !== null}
        onOpenChange={(open) => {
          if (!open) setOpenContainerInstanceId(null);
        }}
        containerInstanceId={openContainerInstanceId}
        state={state}
        lookup={lookup}
        onApplyResult={apply}
        onRefuse={refuse}
      />

      <InventoryMoveTargetSheet
        open={moveSheetSlot !== null}
        onOpenChange={(open) => {
          if (!open) setMoveSheetSlot(null);
        }}
        sourceSlot={moveSheetSlot}
        state={state}
        lookup={lookup}
        onPickTarget={(targetSlot) => {
          if (moveSheetSlot === null) return;
          handleDropSlot(moveSheetSlot, targetSlot);
          setMoveSheetSlot(null);
        }}
      />
    </div>
  );
}
