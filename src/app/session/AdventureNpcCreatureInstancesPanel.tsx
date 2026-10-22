/**
 * AdventureNpcCreatureInstancesPanel — list/edit/remove adventure NPC instances (#201).
 * Used in Gamemaster / adventure context. German UI.
 * Location: src/app/session/AdventureNpcCreatureInstancesPanel.tsx
 */
import { useCallback, useEffect, useState } from 'react';
import {
  CircleNotch,
  Plus,
  ArrowsClockwise,
  Trash,
  Users
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import type {
  NpcCreatureInstance,
  NpcCreatureInstanceKind,
} from '../../domains/npc-creature';
import type { ProjectMemberDto, ProjectSummaryVm } from '../../domains/project/contracts/project.types';
import {
  listNpcCreatureInstances,
  removeNpcCreatureInstance,
  spawnNpcCreatureInstance,
  updateNpcCreatureInstanceRuntime,
} from '../../infrastructure/npc-creature/npc-creature-service';
import {
  listBuiltinNpcCreatureDefinitions,
  listCoreNpcCreatureDefinitions,
} from '../../domains/npc-creature';
import { projectMemberService } from '../../infrastructure/project/project-member-service';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Label } from '../../shared/ui/label';
import { Textarea } from '../../shared/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../shared/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../shared/ui/select';

const UNASSIGNED_VALUE = '__unassigned__';

export interface AdventureNpcCreatureInstancesPanelProps {
  /** Active campaigns where the current user is GM. */
  gmProjects: readonly ProjectSummaryVm[];
  /** Optional preselected project (e.g. current adventure). */
  initialProjectId?: string | null;
}

function kindLabel(kind: NpcCreatureInstanceKind): string {
  return kind === 'persistent' ? 'Persistent' : 'Generisch';
}

export function AdventureNpcCreatureInstancesPanel({
  gmProjects,
  initialProjectId = null,
}: AdventureNpcCreatureInstancesPanelProps) {
  const [projectId, setProjectId] = useState(initialProjectId ?? '');
  const [instances, setInstances] = useState<NpcCreatureInstance[]>([]);
  const [members, setMembers] = useState<ProjectMemberDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [spawnDefinitionId, setSpawnDefinitionId] = useState('');
  const [spawnKind, setSpawnKind] = useState<NpcCreatureInstanceKind>('generic');
  const [spawning, setSpawning] = useState(false);
  const [editInstance, setEditInstance] = useState<NpcCreatureInstance | null>(null);
  const [editHp, setEditHp] = useState('0');
  const [editConditions, setEditConditions] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editController, setEditController] = useState(UNASSIGNED_VALUE);
  const [savingEdit, setSavingEdit] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const catalogOptions = [
    ...listCoreNpcCreatureDefinitions(),
    ...listBuiltinNpcCreatureDefinitions(),
  ];

  useEffect(() => {
    if (initialProjectId) {
      setProjectId(initialProjectId);
      return;
    }
    if (!projectId && gmProjects.length === 1) {
      setProjectId(gmProjects[0].id);
    }
  }, [initialProjectId, gmProjects, projectId]);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setInstances([]);
      setMembers([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [rows, memberRows] = await Promise.all([
        listNpcCreatureInstances(projectId),
        projectMemberService.getMembers(projectId),
      ]);
      setInstances(rows);
      setMembers(memberRows.filter((row) => row.status === 'active'));
    } catch (err) {
      console.error('Adventure instances load failed:', err);
      setError(
        err instanceof Error ? err.message : 'Instanzen konnten nicht geladen werden.',
      );
      setInstances([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openEdit = (instance: NpcCreatureInstance) => {
    setEditInstance(instance);
    setEditHp(String(instance.runtime.currentHp));
    setEditConditions(instance.runtime.conditions.join(', '));
    setEditNotes(instance.runtime.encounterNotes);
    setEditController(instance.runtime.temporaryControllerUserId ?? UNASSIGNED_VALUE);
  };

  const handleSaveEdit = async () => {
    if (!editInstance) return;
    const hp = Number(editHp);
    if (!Number.isFinite(hp) || hp < 0) {
      toast.error('TP müssen eine Zahl ≥ 0 sein.');
      return;
    }
    setSavingEdit(true);
    try {
      const conditions = editConditions
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
      const updated = await updateNpcCreatureInstanceRuntime({
        instance: editInstance,
        patch: {
          currentHp: Math.floor(hp),
          conditions,
          encounterNotes: editNotes,
          temporaryControllerUserId:
            editController === UNASSIGNED_VALUE ? null : editController,
        },
        activeMemberUserIds: members.map((member) => member.user_id),
      });
      setInstances((prev) =>
        prev.map((row) => (row.id === updated.id ? updated : row)),
      );
      toast.success('Laufzeitstatus gespeichert.');
      setEditInstance(null);
    } catch (err) {
      console.error('Instance runtime save failed:', err);
      toast.error(
        err instanceof Error ? err.message : 'Status konnte nicht gespeichert werden.',
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRemove = async (instance: NpcCreatureInstance) => {
    const confirmed = window.confirm(
      `„${instance.displayName}“ aus dem Abenteuer entfernen? Die Library-Definition bleibt erhalten.`,
    );
    if (!confirmed) return;
    setRemovingId(instance.id);
    try {
      await removeNpcCreatureInstance(instance.id);
      setInstances((prev) => prev.filter((row) => row.id !== instance.id));
      toast.success('Instanz entfernt.');
    } catch (err) {
      console.error('Remove instance failed:', err);
      toast.error(
        err instanceof Error ? err.message : 'Instanz konnte nicht entfernt werden.',
      );
    } finally {
      setRemovingId(null);
    }
  };

  const handleSpawn = async () => {
    if (!projectId || !spawnDefinitionId) {
      toast.error('Bitte Vorlage und Abenteuer wählen.');
      return;
    }
    setSpawning(true);
    try {
      const created = await spawnNpcCreatureInstance({
        projectId,
        definitionId: spawnDefinitionId,
        instanceKind: spawnKind,
        activeMemberUserIds: members.map((member) => member.user_id),
      });
      setInstances((prev) => [created, ...prev]);
      toast.success(`${created.displayName} hinzugefügt.`);
      setSpawnOpen(false);
      setSpawnDefinitionId('');
      setSpawnKind('generic');
    } catch (err) {
      console.error('Panel spawn failed:', err);
      toast.error(
        err instanceof Error ? err.message : 'Instanz konnte nicht erzeugt werden.',
      );
    } finally {
      setSpawning(false);
    }
  };

  if (gmProjects.length === 0) {
    return (
      <div
        className="rounded-lg border border-border/60 px-4 py-10 text-center"
        data-npc-adventure-instances
        data-npc-adventure-instances-empty-gm
      >
        <Users className="mx-auto mb-3 size-10 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          Instanzen verwalten erfordert ein Abenteuer, das du als Gamemaster führst.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-npc-adventure-instances>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2 flex-1">
          <Label htmlFor="npc-adventure-project">Abenteuer</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger
              id="npc-adventure-project"
              className="h-11 min-h-11"
              data-npc-adventure-project
            >
              <SelectValue placeholder="Abenteuer wählen" />
            </SelectTrigger>
            <SelectContent>
              {gmProjects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11"
            onClick={() => void refresh()}
            disabled={!projectId || loading}
            aria-label="Instanzen neu laden"
          >
            <ArrowsClockwise className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            className="h-11 min-h-11"
            onClick={() => setSpawnOpen(true)}
            disabled={!projectId}
            data-npc-adventure-spawn-open
          >
            <Plus className="mr-2 size-4" aria-hidden="true" />
            Figur hinzufügen
          </Button>
        </div>
      </div>

      {error ? (
        <div
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-8 text-center"
          role="alert"
          data-npc-adventure-instances-error
        >
          <p className="mb-3 text-sm text-destructive">{error}</p>
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11"
            onClick={() => void refresh()}
          >
            Erneut versuchen
          </Button>
        </div>
      ) : loading ? (
        <div
          className="flex items-center justify-center py-12"
          aria-busy="true"
          aria-label="Instanzen werden geladen"
          data-npc-adventure-instances-loading
        >
          <CircleNotch className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : !projectId ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Wähle ein Abenteuer, um Instanzen zu sehen.
        </p>
      ) : instances.length === 0 ? (
        <div
          className="rounded-lg border border-dashed border-border px-4 py-10 text-center"
          data-npc-adventure-instances-empty
        >
          <Users className="mx-auto mb-3 size-10 text-muted-foreground" aria-hidden="true" />
          <p className="mb-1 text-muted-foreground">Noch keine Figuren in diesem Abenteuer.</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Füge Library-Vorlagen als Instanzen hinzu — HP und Zustände bleiben getrennt.
          </p>
          <Button
            type="button"
            className="h-11 min-h-11"
            onClick={() => setSpawnOpen(true)}
            data-npc-adventure-spawn-empty
          >
            <Plus className="mr-2 size-4" aria-hidden="true" />
            Erste Figur hinzufügen
          </Button>
        </div>
      ) : (
        <ul className="space-y-2" data-npc-adventure-instances-list>
          {instances.map((instance) => (
            <li
              key={instance.id}
              className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card/40 p-3 sm:flex-row sm:items-center sm:justify-between"
              data-npc-adventure-instance-row
              data-instance-id={instance.id}
            >
              <div className="min-w-0 space-y-1">
                <p className="truncate font-medium">{instance.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {kindLabel(instance.instanceKind)}
                  {' · '}
                  TP {instance.runtime.currentHp}/{instance.snapshot.maxHealth}
                  {instance.runtime.conditions.length > 0
                    ? ` · ${instance.runtime.conditions.join(', ')}`
                    : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11 min-h-11 flex-1 sm:flex-none"
                  onClick={() => openEdit(instance)}
                  data-npc-adventure-instance-open
                >
                  Öffnen
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11 min-h-11"
                  aria-label={`${instance.displayName} entfernen`}
                  onClick={() => void handleRemove(instance)}
                  disabled={removingId === instance.id}
                  data-npc-adventure-instance-remove
                >
                  {removingId === instance.id ? (
                    <CircleNotch className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash className="size-4 text-destructive" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={spawnOpen} onOpenChange={setSpawnOpen}>
        <DialogContent className="sm:max-w-md" data-npc-adventure-spawn-dialog>
          <DialogHeader>
            <DialogTitle>Figur hinzufügen</DialogTitle>
            <DialogDescription>
              Wähle eine Core-/Pack-Vorlage. Mehrfaches Hinzufügen erzeugt getrennte Instanzen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="npc-adventure-spawn-def">Vorlage</Label>
              <Select value={spawnDefinitionId} onValueChange={setSpawnDefinitionId}>
                <SelectTrigger
                  id="npc-adventure-spawn-def"
                  className="h-11 min-h-11"
                  data-npc-adventure-spawn-definition
                >
                  <SelectValue placeholder="Vorlage wählen" />
                </SelectTrigger>
                <SelectContent>
                  {catalogOptions.map((definition) => (
                    <SelectItem key={definition.id} value={definition.id}>
                      {definition.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="npc-adventure-spawn-kind">Instanztyp</Label>
              <Select
                value={spawnKind}
                onValueChange={(value) =>
                  setSpawnKind(value === 'persistent' ? 'persistent' : 'generic')
                }
              >
                <SelectTrigger
                  id="npc-adventure-spawn-kind"
                  className="h-11 min-h-11"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="generic">Generisch</SelectItem>
                  <SelectItem value="persistent">Einzigartig persistent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-11"
              onClick={() => setSpawnOpen(false)}
              disabled={spawning}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              className="h-11 min-h-11"
              onClick={() => void handleSpawn()}
              disabled={spawning || !spawnDefinitionId}
              data-npc-adventure-spawn-submit
            >
              {spawning ? (
                <>
                  <CircleNotch className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  Wird hinzugefügt…
                </>
              ) : (
                'Hinzufügen'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editInstance)}
        onOpenChange={(open) => {
          if (!open) setEditInstance(null);
        }}
      >
        <DialogContent className="sm:max-w-md" data-npc-adventure-instance-editor>
          <DialogHeader>
            <DialogTitle>{editInstance?.displayName ?? 'Instanz'}</DialogTitle>
            <DialogDescription>
              Laufzeitstatus der Instanz. Änderungen an der Library-Definition
              überschreiben diese Werte nicht.
            </DialogDescription>
          </DialogHeader>
          {editInstance ? (
            <div className="space-y-4 py-2">
              <p className="text-xs text-muted-foreground">
                Snapshot: {editInstance.snapshot.name} · Max-TP{' '}
                {editInstance.snapshot.maxHealth} · Stufe {editInstance.snapshot.level}
              </p>
              <div className="space-y-2">
                <Label htmlFor="npc-instance-hp">Aktuelle TP</Label>
                <Input
                  id="npc-instance-hp"
                  type="number"
                  min={0}
                  max={9999}
                  className="h-11 min-h-11"
                  value={editHp}
                  onChange={(event) => setEditHp(event.target.value)}
                  data-npc-instance-hp
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npc-instance-conditions">Zustände (kommagetrennt)</Label>
                <Input
                  id="npc-instance-conditions"
                  className="h-11 min-h-11"
                  value={editConditions}
                  onChange={(event) => setEditConditions(event.target.value)}
                  placeholder="z. B. Verwundet, Verängstigt"
                  data-npc-instance-conditions
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npc-instance-temp-controller">Temporärer Controller</Label>
                <Select value={editController} onValueChange={setEditController}>
                  <SelectTrigger
                    id="npc-instance-temp-controller"
                    className="h-11 min-h-11"
                    data-npc-instance-temp-controller
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED_VALUE}>Gamemaster</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.user_id.slice(0, 8)}…
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="npc-instance-notes">Encounter-Notizen</Label>
                <Textarea
                  id="npc-instance-notes"
                  rows={3}
                  value={editNotes}
                  onChange={(event) => setEditNotes(event.target.value)}
                  data-npc-instance-notes
                />
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-11"
              onClick={() => setEditInstance(null)}
              disabled={savingEdit}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              className="h-11 min-h-11"
              onClick={() => void handleSaveEdit()}
              disabled={savingEdit}
              data-npc-instance-save
            >
              {savingEdit ? (
                <>
                  <CircleNotch className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  Speichern…
                </>
              ) : (
                'Speichern'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
