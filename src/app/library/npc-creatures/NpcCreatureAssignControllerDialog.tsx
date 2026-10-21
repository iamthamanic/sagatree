/**
 * NpcCreatureAssignControllerDialog — GM assigns Full NPC controller in a campaign (#200).
 * Location: src/app/library/npc-creatures/NpcCreatureAssignControllerDialog.tsx
 */
import { useEffect, useState } from 'react';
import {
  CircleNotch
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { NpcCreatureDefinition } from '../../../domains/npc-creature';
import type { ProjectMemberDto } from '../../../domains/project/contracts/project.types';
import type { ProjectSummaryVm } from '../../../domains/project/contracts/project.types';
import {
  assignNpcCreatureController,
  getNpcCreatureControllerAssignment,
} from '../../../infrastructure/npc-creature/npc-creature-service';
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

const UNASSIGNED_VALUE = '__unassigned__';

export interface NpcCreatureAssignControllerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definition: NpcCreatureDefinition | null;
  /** Active campaigns where the current user is GM. */
  gmProjects: readonly ProjectSummaryVm[];
}

export function NpcCreatureAssignControllerDialog({
  open,
  onOpenChange,
  definition,
  gmProjects,
}: NpcCreatureAssignControllerDialogProps) {
  const [projectId, setProjectId] = useState('');
  const [members, setMembers] = useState<ProjectMemberDto[]>([]);
  const [controllerUserId, setControllerUserId] = useState<string>(UNASSIGNED_VALUE);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setProjectId('');
      setMembers([]);
      setControllerUserId(UNASSIGNED_VALUE);
      setLoadingMembers(false);
      setSaving(false);
      return;
    }
    if (gmProjects.length === 1) {
      setProjectId(gmProjects[0].id);
    }
  }, [open, gmProjects]);

  useEffect(() => {
    if (!open || !projectId || !definition) return;

    let cancelled = false;
    setLoadingMembers(true);

    void (async () => {
      try {
        const [memberRows, assignment] = await Promise.all([
          projectMemberService.getMembers(projectId),
          getNpcCreatureControllerAssignment(projectId, definition.id),
        ]);
        if (cancelled) return;
        const active = memberRows.filter((row) => row.status === 'active');
        setMembers(active);
        setControllerUserId(assignment?.controllerUserId ?? UNASSIGNED_VALUE);
      } catch (error) {
        console.error('Controller dialog load failed:', error);
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
  }, [open, projectId, definition]);

  const handleSave = async () => {
    if (!definition || !projectId) {
      toast.error('Bitte eine Kampagne wählen.');
      return;
    }

    setSaving(true);
    try {
      const activeMemberUserIds = members.map((member) => member.user_id);
      await assignNpcCreatureController({
        projectId,
        definitionId: definition.id,
        controllerUserId:
          controllerUserId === UNASSIGNED_VALUE ? null : controllerUserId,
        activeMemberUserIds,
      });
      toast.success(
        controllerUserId === UNASSIGNED_VALUE
          ? 'Kontrolle beim Gamemaster'
          : 'Spieler zugewiesen',
      );
      onOpenChange(false);
    } catch (error) {
      console.error('Controller assign failed:', error);
      toast.error(
        error instanceof Error ? error.message : 'Zuweisung fehlgeschlagen.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-npc-assign-controller-dialog>
        <DialogHeader>
          <DialogTitle>Spieler zuweisen</DialogTitle>
          <DialogDescription>
            {definition
              ? `Kontrolle für „${definition.name}“ — Sheet Mode und Identität bleiben unverändert.`
              : 'Kontrolle für eine Figur zuweisen.'}
          </DialogDescription>
        </DialogHeader>

        {gmProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine aktive Kampagne, in der du Gamemaster bist.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="npc-assign-project">Kampagne</Label>
              <Select value={projectId || undefined} onValueChange={setProjectId}>
                <SelectTrigger id="npc-assign-project" className="h-11 min-h-11">
                  <SelectValue placeholder="Kampagne wählen" />
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

            <div className="space-y-1.5">
              <Label htmlFor="npc-assign-controller">Kontrolle</Label>
              {loadingMembers ? (
                <div className="flex h-11 items-center gap-2 text-sm text-muted-foreground">
                  <CircleNotch className="size-4 animate-spin" aria-hidden="true" />
                  Mitglieder werden geladen…
                </div>
              ) : (
                <Select
                  value={controllerUserId}
                  onValueChange={setControllerUserId}
                  disabled={!projectId}
                >
                  <SelectTrigger id="npc-assign-controller" className="h-11 min-h-11">
                    <SelectValue placeholder="Kontrolle wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED_VALUE}>Gamemaster (nicht zugewiesen)</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.role === 'gm'
                          ? `SL · ${member.user_id.slice(0, 8)}…`
                          : `Spieler · ${member.user_id.slice(0, 8)}…`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11"
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            className="h-11 min-h-11"
            disabled={saving || !projectId || gmProjects.length === 0 || loadingMembers}
            onClick={() => void handleSave()}
            data-npc-assign-controller-save
          >
            {saving ? 'Speichert…' : 'Zuweisen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
