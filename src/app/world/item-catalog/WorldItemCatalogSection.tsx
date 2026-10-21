/**
 * WorldItemCatalogSection — World-profile authoring for Inventory v2 World-scoped
 * item definitions (#112). Lists create/edit/archive/restore via the catalog
 * service and reuses PersonalItemFormDialog in `mode="world"`. Core clone opens
 * the same form with a template (new World ID on save; Core never mutated).
 * Location: src/app/world/item-catalog/WorldItemCatalogSection.tsx
 */
import { useEffect, useState } from 'react';
import {
  Archive,
  Plus,
  ArrowCounterClockwise
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
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import { Checkbox } from '../../../shared/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  listCoreItemDefinitions,
  type CatalogDefinitionRecord,
  type ItemDefinition,
} from '../../../domains/character/inventory-v2';
import {
  archiveDefinition,
  loadWorldProfileItemCatalog,
  restoreDefinition,
} from '../../../infrastructure/inventory/item-catalog-service';
import {
  PersonalItemFormDialog,
  INVENTORY_TYPE_FILTER_OPTIONS,
  INVENTORY_TYPE_LABELS,
} from '../../character';

export interface WorldItemCatalogSectionProps {
  worldProfileId: string;
}

function keyValueBadges(definition: ItemDefinition) {
  const badges: string[] = [];
  if (definition.damage) badges.push(definition.damage);
  if (definition.damageType) badges.push(definition.damageType);
  if (definition.protection != null) badges.push(`Schutz ${definition.protection}`);
  if (definition.requirements?.minimumStrength != null) {
    badges.push(`Min. Stärke ${definition.requirements.minimumStrength}`);
  }
  if (definition.containerCapacity != null) {
    badges.push(`Kapazität ${definition.containerCapacity}`);
  }
  if (definition.twoHanded) badges.push('Zweihändig');
  for (const trait of definition.traits ?? []) {
    badges.push(trait);
  }
  return badges.slice(0, 6);
}

export function WorldItemCatalogSection({ worldProfileId }: WorldItemCatalogSectionProps) {
  const [records, setRecords] = useState<CatalogDefinitionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ItemDefinition['type']>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ItemDefinition | null>(null);
  const [editingArchived, setEditingArchived] = useState(false);
  const [template, setTemplate] = useState<ItemDefinition | null>(null);
  const [corePickerOpen, setCorePickerOpen] = useState(false);
  const [coreSearch, setCoreSearch] = useState('');
  const [archiveTarget, setArchiveTarget] = useState<CatalogDefinitionRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    void loadWorldProfileItemCatalog(worldProfileId)
      .then((next) => {
        if (!cancelled) setRecords(next);
      })
      .catch((err) => {
        console.error('[worlds] world item catalog load failed', err);
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Welt-Gegenstände konnten nicht geladen werden.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [worldProfileId, reloadToken]);

  const refresh = () => setReloadToken((token) => token + 1);

  const filtered = records
    .filter((record) => {
      if (!showArchived && record.status === 'archived') return false;
      if (typeFilter !== 'all' && record.definition.type !== typeFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        record.definition.name.toLowerCase().includes(q) ||
        record.definition.description.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      return a.definition.name.localeCompare(b.definition.name, 'de');
    });

  const coreDefinitions = listCoreItemDefinitions().filter((definition) => {
    const q = coreSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      definition.name.toLowerCase().includes(q) ||
      definition.description.toLowerCase().includes(q)
    );
  });

  const openCreate = () => {
    setEditing(null);
    setEditingArchived(false);
    setTemplate(null);
    setFormOpen(true);
  };

  const openEdit = (record: CatalogDefinitionRecord) => {
    setEditing(record.definition);
    setEditingArchived(record.status === 'archived');
    setTemplate(null);
    setFormOpen(true);
  };

  const openCoreClone = (definition: ItemDefinition) => {
    setCorePickerOpen(false);
    setEditing(null);
    setEditingArchived(false);
    setTemplate(definition);
    setFormOpen(true);
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    setBusyId(archiveTarget.definition.id);
    setError('');
    try {
      await archiveDefinition(archiveTarget.definition.id);
      setArchiveTarget(null);
      refresh();
    } catch (err) {
      console.error('[worlds] world item archive failed', err);
      setError(err instanceof Error ? err.message : 'Archivieren fehlgeschlagen.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRestore = async (record: CatalogDefinitionRecord) => {
    setBusyId(record.definition.id);
    setError('');
    try {
      await restoreDefinition(record.definition.id);
      refresh();
    } catch (err) {
      console.error('[worlds] world item restore failed', err);
      setError(err instanceof Error ? err.message : 'Wiederherstellen fehlgeschlagen.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section
      className="space-y-4 border-t border-border pt-5"
      data-testid="world-item-catalog"
      data-world-item-catalog
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold">Ausrüstung & Gegenstände</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Definiert Gegenstände, die zusätzlich zum SagaTree Core in dieser Welt verfügbar sind.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setCorePickerOpen(true)}>
            Core-Gegenstand als Vorlage
          </Button>
          <Button type="button" className="min-h-11" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Gegenstand erstellen
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="world-item-search">Suche</Label>
          <Input
            id="world-item-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name oder Beschreibung"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="world-item-type">Typ</Label>
          <Select
            value={typeFilter}
            onValueChange={(value) =>
              setTypeFilter(value === 'all' ? 'all' : (value as ItemDefinition['type']))
            }
          >
            <SelectTrigger id="world-item-type">
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
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={showArchived}
          onCheckedChange={(checked) => setShowArchived(checked === true)}
        />
        Archivierte anzeigen
      </label>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Lade Welt-Gegenstände…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
          Noch keine Welt-Gegenstände. Charaktere haben weiterhin den vollen Core-Katalog; hier
          ergänzt du welt-spezifische Optionen.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((record) => {
            const { definition, status } = record;
            const keys = keyValueBadges(definition);
            const busy = busyId === definition.id;
            return (
              <li
                key={definition.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{definition.name}</p>
                    {status === 'archived' && <Badge variant="secondary">Archiviert</Badge>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge variant="outline">{INVENTORY_TYPE_LABELS[definition.type]}</Badge>
                    <Badge variant="secondary">Last {definition.load}</Badge>
                    <Badge variant="outline">Kosten {definition.cost}</Badge>
                    {keys.map((value) => (
                      <Badge key={`${definition.id}-${value}`} variant="outline">
                        {value}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    disabled={busy}
                    onClick={() => openEdit(record)}
                  >
                    Bearbeiten
                  </Button>
                  {status === 'active' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="min-h-11"
                      disabled={busy}
                      onClick={() => setArchiveTarget(record)}
                    >
                      <Archive className="mr-1 h-3.5 w-3.5" />
                      Archivieren
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      disabled={busy}
                      onClick={() => void handleRestore(record)}
                    >
                      <ArrowCounterClockwise className="mr-1 h-3.5 w-3.5" />
                      Wieder aktivieren
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <PersonalItemFormDialog
        open={formOpen}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) {
            setEditing(null);
            setTemplate(null);
            setEditingArchived(false);
          }
        }}
        editing={editing}
        onSaved={refresh}
        mode="world"
        worldProfileId={worldProfileId}
        template={template}
        archived={editingArchived}
      />

      <Dialog open={corePickerOpen} onOpenChange={setCorePickerOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Core-Gegenstand als Vorlage</DialogTitle>
            <DialogDescription>
              Wähle einen Core-Gegenstand. Es entsteht eine neue Welt-Definition mit eigener ID —
              Core bleibt unverändert.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={coreSearch}
              onChange={(event) => setCoreSearch(event.target.value)}
              placeholder="Core durchsuchen…"
              aria-label="Core-Gegenstände suchen"
            />
            <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {coreDefinitions.map((definition) => (
                <li key={definition.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col rounded-lg border border-border bg-card px-3 py-2 text-left transition hover:bg-muted/40"
                    onClick={() => openCoreClone(definition)}
                  >
                    <span className="font-medium">{definition.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {INVENTORY_TYPE_LABELS[definition.type]} · Last {definition.load} · Kosten{' '}
                      {definition.cost}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(next) => !next && setArchiveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gegenstand archivieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Gegenstand wird für neue Inventarzugänge ausgeblendet. Bereits vorhandene
              Exemplare in Charakterinventaren bleiben erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleArchiveConfirm()}>
              Archivieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
