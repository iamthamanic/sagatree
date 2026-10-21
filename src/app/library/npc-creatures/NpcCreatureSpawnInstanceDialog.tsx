/**
 * NpcCreatureSpawnInstanceDialog — GM spawns library definition into an adventure (#201).
 * Location: src/app/library/npc-creatures/NpcCreatureSpawnInstanceDialog.tsx
 */
import { useEffect, useState } from 'react';
import {
  CircleNotch
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { NpcCreatureDefinition, NpcCreatureInstanceKind } from '../../../domains/npc-creature';
import type { ProjectMemberDto, ProjectSummaryVm } from '../../../domains/project/contracts/project.types';
import { spawnNpcCreatureInstance } from '../../../infrastructure/npc-creature/npc-creature-service';
import { projectMemberService } from '../../../infrastructure/project/project-member-service';
import { Button } from '../../../shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../shared/ui/dialog';
import { Label } from '../../../shared/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select';

export interface NpcCreatureSpawnInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definition: NpcCreatureDefinition | null;
  gmProjects: readonly ProjectSummaryVm[];
  onSpawned?: () => void;
}

export function NpcCreatureSpawnInstanceDialog({
  open,
  onOpenChange,
  definition,
  gmProjects,
  onSpawned,
}: NpcCreatureSpawnInstanceDialogProps) {
  const [projectId, setProjectId] = useState('');
  const [instanceKind, setInstanceKind] = useState<NpcCreatureInstanceKind>('generic');
  const [members, setMembers] = useState<ProjectMemberDto[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setProjectId('');
      setInstanceKind('generic');
      setMembers([]);
      setLoadingMembers(false);
      setSaving(false);
      return;
    }
    if (gmProjects.length === 1) {
      setProjectId(gmProjects[0].id);
    }
  }, [open, gmProjects]);

  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    setLoadingMembers(true);
    void (async () => {
      try {
        const rows = await projectMemberService.getMembers(projectId);
        if (cancelled) return;
        setMembers(rows.filter((row) => row.status === 'active'));
      } catch (error) {
        console.error('Spawn dialog members load failed:', error);
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : 'Mitglieder konnten nicht geladen werden.',
          );
          setMembers([]);
        }
      } finally {
        if (!cancelled) setLoadingMembers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  const handleSpawn = async () => {
    if (!definition || !projectId) {
      toast.error('Bitte ein Abenteuer wählen.');
      return;
    }
    setSaving(true);
    try {
      const created = await spawnNpcCreatureInstance({
        projectId,
        definitionId: definition.id,
        instanceKind,
        activeMemberUserIds: members.map((member) => member.user_id),
      });
      toast.success(`${created.displayName} hinzugefügt.`);
      onSpawned?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Spawn instance failed:', error);
      toast.error(
        error instanceof Error ? error.message : 'Instanz konnte nicht erzeugt werden.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        data-npc-spawn-instance-dialog
      >
        <DialogHeader>
          <DialogTitle>Zum Abenteuer hinzufügen</DialogTitle>
          <DialogDescription>
            {definition
              ? `Erzeugt eine eigene Instanz von „${definition.name}“ mit eigenem Laufzeitstatus.`
              : 'Wähle eine Figur und ein Abenteuer.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="npc-spawn-project">Abenteuer</Label>
            <Select
              value={projectId}
              onValueChange={setProjectId}
              disabled={gmProjects.length === 0 || saving}
            >
              <SelectTrigger
                id="npc-spawn-project"
                className="h-11 min-h-11"
                data-npc-spawn-project
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

          <div className="space-y-2">
            <Label htmlFor="npc-spawn-kind">Instanztyp</Label>
            <Select
              value={instanceKind}
              onValueChange={(value) =>
                setInstanceKind(value === 'persistent' ? 'persistent' : 'generic')
              }
              disabled={saving}
            >
              <SelectTrigger
                id="npc-spawn-kind"
                className="h-11 min-h-11"
                data-npc-spawn-kind
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="generic">
                  Generisch (Encounter, z. B. Wolf #1)
                </SelectItem>
                <SelectItem value="persistent">
                  Einzigartig persistent (kampagnenweit)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loadingMembers ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CircleNotch className="size-4 animate-spin" aria-hidden="true" />
              Mitglieder werden geladen…
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            className="h-11 min-h-11"
            onClick={() => void handleSpawn()}
            disabled={saving || !projectId || !definition || gmProjects.length === 0}
            data-npc-spawn-submit
          >
            {saving ? (
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
  );
}
