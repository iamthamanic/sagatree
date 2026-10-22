/**
 * WorldNpcCreatureCatalogSection — World-profile authoring for world-scoped
 * NPC/creature definitions (#199). Create/edit/archive/restore; Core clone as
 * template. Definitions are referenced by the catalog module, never embedded.
 * Location: src/app/world/npc-creature-catalog/WorldNpcCreatureCatalogSection.tsx
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
  deriveNpcCreaturePower,
  listCoreNpcCreatureDefinitions,
  type NpcCreatureCatalogRecord,
  type NpcCreatureDefinition,
} from '../../../domains/npc-creature';
import {
  archiveNpcCreatureDefinition,
  loadWorldProfileNpcCreatureCatalog,
  restoreNpcCreatureDefinition,
} from '../../../infrastructure/npc-creature/npc-creature-service';
import {
  NPC_CREATURE_CATEGORY_LABELS,
  NPC_CREATURE_KIND_LABELS,
  formatNpcLevelMachtgradLine,
} from '../../library';
import { WorldNpcCreatureFormDialog } from './WorldNpcCreatureFormDialog';

export interface WorldNpcCreatureCatalogSectionProps {
  worldProfileId: string;
  onCatalogChanged?: () => void;
}

export function WorldNpcCreatureCatalogSection({
  worldProfileId,
  onCatalogChanged,
}: WorldNpcCreatureCatalogSectionProps) {
  const [records, setRecords] = useState<NpcCreatureCatalogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<NpcCreatureCatalogRecord | null>(null);
  const [template, setTemplate] = useState<NpcCreatureDefinition | null>(null);
  const [corePickerOpen, setCorePickerOpen] = useState(false);
  const [coreSearch, setCoreSearch] = useState('');
  const [archiveTarget, setArchiveTarget] = useState<NpcCreatureCatalogRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    void loadWorldProfileNpcCreatureCatalog(worldProfileId)
      .then((next) => {
        if (!cancelled) setRecords(next);
      })
      .catch((err: unknown) => {
        console.error('[worlds] world npc-creature catalog load failed', err);
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Welt-NPCs/-Kreaturen konnten nicht geladen werden.',
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

  const refresh = () => {
    setReloadToken((token) => token + 1);
    onCatalogChanged?.();
  };

  const filtered = records
    .filter((record) => {
      if (!showArchived && record.status === 'archived') return false;
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

  const coreDefinitions = listCoreNpcCreatureDefinitions().filter((definition) => {
    const q = coreSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      definition.name.toLowerCase().includes(q) ||
      definition.description.toLowerCase().includes(q)
    );
  });

  const openCreate = () => {
    setEditing(null);
    setTemplate(null);
    setFormOpen(true);
  };

  const openEdit = (record: NpcCreatureCatalogRecord) => {
    setEditing(record);
    setTemplate(null);
    setFormOpen(true);
  };

  const openCoreClone = (definition: NpcCreatureDefinition) => {
    setCorePickerOpen(false);
    setEditing(null);
    setTemplate(definition);
    setFormOpen(true);
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    setBusyId(archiveTarget.definition.id);
    setError('');
    try {
      await archiveNpcCreatureDefinition(archiveTarget.definition.id);
      setArchiveTarget(null);
      refresh();
    } catch (err: unknown) {
      console.error('[worlds] world npc-creature archive failed', err);
      setError(err instanceof Error ? err.message : 'Archivieren fehlgeschlagen.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRestore = async (record: NpcCreatureCatalogRecord) => {
    setBusyId(record.definition.id);
    setError('');
    try {
      await restoreNpcCreatureDefinition(record.definition.id);
      refresh();
    } catch (err: unknown) {
      console.error('[worlds] world npc-creature restore failed', err);
      setError(err instanceof Error ? err.message : 'Wiederherstellen fehlgeschlagen.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section
      className="space-y-4 border-t border-border pt-5"
      data-testid="world-npc-creature-catalog"
      data-world-npc-creature-catalog
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold">Welt-eigene NPCs & Kreaturen</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Figuren und Vorlagen, die zu diesem Weltprofil gehören. Packs bleiben separat —
            hier legst du welt-spezifische Definitionen an.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => setCorePickerOpen(true)}
          >
            Core als Vorlage
          </Button>
          <Button type="button" className="min-h-11" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Figur erstellen
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="world-npc-search">Suche</Label>
        <Input
          id="world-npc-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Name oder Beschreibung"
          className="min-h-11"
        />
      </div>

      <label className="flex min-h-11 items-center gap-2 text-sm">
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
        <p className="text-sm text-muted-foreground">Lade Welt-Figuren…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
          Noch keine welt-eigenen Figuren. Aktiviere Packs oben oder lege hier weltspezifische
          NPCs und Kreaturen an.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((record) => {
            const { definition, status } = record;
            const derived = deriveNpcCreaturePower(definition);
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
                    <Badge variant="outline">{NPC_CREATURE_KIND_LABELS[definition.kind]}</Badge>
                    <Badge variant="outline">
                      {NPC_CREATURE_CATEGORY_LABELS[definition.category]}
                    </Badge>
                    <Badge variant="secondary">
                      {formatNpcLevelMachtgradLine(definition.level, derived.machtgradLabel)}
                    </Badge>
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

      <WorldNpcCreatureFormDialog
        open={formOpen}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) {
            setEditing(null);
            setTemplate(null);
          }
        }}
        worldProfileId={worldProfileId}
        editing={editing}
        template={template}
        onSaved={refresh}
      />

      <Dialog open={corePickerOpen} onOpenChange={setCorePickerOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Core-Figur als Vorlage</DialogTitle>
            <DialogDescription>
              Wähle eine Core-Figur. Es entsteht eine neue Welt-Definition mit eigener ID — Core
              bleibt unverändert.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={coreSearch}
              onChange={(event) => setCoreSearch(event.target.value)}
              placeholder="Core durchsuchen…"
              aria-label="Core-Figuren suchen"
              className="min-h-11"
            />
            <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {coreDefinitions.map((definition) => (
                <li key={definition.id}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full flex-col rounded-lg border border-border bg-card px-3 py-2 text-left transition hover:bg-muted/40"
                    onClick={() => openCoreClone(definition)}
                  >
                    <span className="font-medium">{definition.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {NPC_CREATURE_KIND_LABELS[definition.kind]} ·{' '}
                      {NPC_CREATURE_CATEGORY_LABELS[definition.category]} · Stufe{' '}
                      {definition.level}
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
            <AlertDialogTitle>Figur archivieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Welt-Definition wird für neue Katalog-Angebote ausgeblendet. Die Definition
              bleibt auflösbar und kann wieder aktiviert werden.
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
