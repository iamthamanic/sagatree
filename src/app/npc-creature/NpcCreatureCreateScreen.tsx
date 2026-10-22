/**
 * NpcCreatureCreateScreen — Step 1 kind + Step 2 mode + Quick Create form (#198).
 * Full path routes into existing CharacterEditor; Quick Create persists via infrastructure.
 * Location: src/app/npc-creature/NpcCreatureCreateScreen.tsx
 */
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CircleNotch,
  PawPrint,
  Scroll,
  UserCircle,
  Lightning
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
  assembleNpcCreatureDefinition,
  NPC_CREATURE_CATEGORIES,
  validateNpcCreatureDefinition,
  type CreateNpcCreatureDefinitionTarget,
  type NpcCreatureCategory,
  type NpcCreatureKind,
} from '../../domains/npc-creature';
import {
  machtgradLabelForLevel,
  normalizeCombatRoleForProfile,
  type SagaTreeCombatProfile,
  type SagaTreeCombatRole,
  type SagaTreeNpcLevel,
} from '../../domains/rules/sagatree/npc-creature-power';
import { createNpcCreatureDefinition } from '../../infrastructure/npc-creature/npc-creature-service';
import { clearCharacterEditorBootstrap } from '../character';
import { useWorldProfiles } from '../world';
import {
  NPC_COMBAT_PROFILE_LABELS,
  NPC_COMBAT_ROLE_LABELS,
  NPC_CREATURE_CATEGORY_LABELS,
} from '../library';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Label } from '../../shared/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../shared/ui/select';
import { Textarea } from '../../shared/ui/textarea';

type CreateStep = 'kind' | 'mode' | 'quick';

const COMBAT_PROFILES: readonly SagaTreeCombatProfile[] = [
  'noncombat',
  'balanced',
  'tough',
  'offensive',
  'mobile',
  'ranged',
  'control_support',
];

const COMBAT_ROLES: readonly SagaTreeCombatRole[] = ['standard', 'elite', 'boss'];

const LEVELS = Array.from({ length: 20 }, (_, index) => (index + 1) as SagaTreeNpcLevel);

export interface NpcCreatureCreateScreenProps {
  onBack: () => void;
  onCreated: (definitionId: string) => void;
  onNavigateToCharacterEditor: () => void;
}

function categoryDefaultForKind(kind: NpcCreatureKind): NpcCreatureCategory {
  return kind === 'npc' ? 'npc' : 'kreatur';
}

export function NpcCreatureCreateScreen({
  onBack,
  onCreated,
  onNavigateToCharacterEditor,
}: NpcCreatureCreateScreenProps) {
  const [step, setStep] = useState<CreateStep>('kind');
  const [kind, setKind] = useState<NpcCreatureKind | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<NpcCreatureCategory>('npc');
  const [level, setLevel] = useState<SagaTreeNpcLevel>(1);
  const [combatProfile, setCombatProfile] = useState<SagaTreeCombatProfile>('balanced');
  const [combatRole, setCombatRole] = useState<SagaTreeCombatRole>('standard');
  const [worldId, setWorldId] = useState<string>('personal');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { worlds, isLoading: worldsLoading } = useWorldProfiles({ enabled: step === 'quick' });

  useEffect(() => {
    if (combatProfile === 'noncombat') {
      setCombatRole('standard');
    }
  }, [combatProfile]);

  const machtgradLabel = machtgradLabelForLevel(level);
  const showCombatRole = combatProfile !== 'noncombat';

  const handleSelectKind = (next: NpcCreatureKind) => {
    setKind(next);
    setCategory(categoryDefaultForKind(next));
  };

  const handleFullCharacter = () => {
    clearCharacterEditorBootstrap();
    toast.message('Charakterbogen-Editor geöffnet — vollständiger Charakter.');
    onNavigateToCharacterEditor();
  };

  const handleCreate = async () => {
    if (!kind) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Name ist erforderlich.');
      return;
    }

    const role = normalizeCombatRoleForProfile(combatProfile, combatRole);
    const target: CreateNpcCreatureDefinitionTarget =
      worldId === 'personal'
        ? { scope: 'personal' }
        : { scope: 'world', worldProfileId: worldId };

    const draft = {
      name: trimmedName,
      description: description.trim(),
      kind,
      category,
      sheetMode: 'compact' as const,
      level,
      combatProfile,
      combatRole: role,
      tags: [],
    };

    // Preflight with a temporary id so domain validation runs before write.
    const preflight = assembleNpcCreatureDefinition(
      `${target.scope}:00000000-0000-4000-8000-000000000000`,
      target.scope,
      draft,
    );
    const validation = validateNpcCreatureDefinition(preflight);
    if (validation.ok === false) {
      const message = validation.errors.join(' ');
      setFormError(message);
      toast.error(message);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const created = await createNpcCreatureDefinition({ target, draft });
      toast.success('Statblock erstellt');
      onCreated(created.definition.id);
    } catch (err) {
      console.error('[npc-creature/create] failed', err);
      const message =
        err instanceof Error ? err.message : 'Erstellen fehlgeschlagen.';
      setFormError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6" data-npc-create-screen>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11"
          onClick={() => {
            if (step === 'kind') onBack();
            else if (step === 'mode') setStep('kind');
            else setStep('mode');
          }}
          aria-label="Zurück"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Button>
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Figur erstellen</h1>
          <p className="text-sm text-muted-foreground">
            {step === 'kind' && 'Was möchtest du erstellen?'}
            {step === 'mode' && 'Wie möchtest du starten?'}
            {step === 'quick' && 'Schnell erstellen — kompakter Statblock'}
          </p>
        </div>
      </div>

      {step === 'kind' ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label="Art wählen">
            <button
              type="button"
              role="radio"
              aria-checked={kind === 'npc'}
              onClick={() => handleSelectKind('npc')}
              data-npc-create-kind="npc"
              className={`flex min-h-[11rem] flex-col items-start justify-between rounded-xl border bg-card p-5 text-left transition-colors hover:border-amber-500/80 hover:bg-amber-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                kind === 'npc' ? 'border-primary bg-primary/10' : 'border-border'
              }`}
            >
              <UserCircle className="h-8 w-8 text-primary" aria-hidden />
              <div className="space-y-1">
                <p className="text-lg font-semibold">NPC</p>
                <p className="text-sm text-muted-foreground">
                  Personen und individuelle Figuren
                </p>
              </div>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={kind === 'creature'}
              onClick={() => handleSelectKind('creature')}
              data-npc-create-kind="creature"
              className={`flex min-h-[11rem] flex-col items-start justify-between rounded-xl border bg-card p-5 text-left transition-colors hover:border-amber-500/80 hover:bg-amber-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                kind === 'creature' ? 'border-primary bg-primary/10' : 'border-border'
              }`}
            >
              <PawPrint className="h-8 w-8 text-primary" aria-hidden />
              <div className="space-y-1">
                <p className="text-lg font-semibold">Kreatur</p>
                <p className="text-sm text-muted-foreground">
                  Tiere, Monster, Konstrukte und andere Wesen
                </p>
              </div>
            </button>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" className="h-11 min-h-11" onClick={onBack}>
              Abbrechen
            </Button>
            <Button
              type="button"
              className="h-11 min-h-11"
              disabled={!kind}
              onClick={() => setStep('mode')}
              data-npc-create-next
            >
              Weiter
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'mode' ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label="Startmodus">
            <button
              type="button"
              role="radio"
              aria-checked
              data-npc-create-mode="quick"
              onClick={() => setStep('quick')}
              className="flex min-h-[11rem] flex-col items-start justify-between rounded-xl border border-primary bg-primary/10 p-5 text-left transition-colors hover:border-amber-500/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Lightning className="h-8 w-8 text-primary" aria-hidden />
              <div className="space-y-1">
                <p className="text-lg font-semibold">Schnell erstellen</p>
                <p className="text-sm text-muted-foreground">
                  Kompakter spielbereiter Statblock (Standard)
                </p>
              </div>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={false}
              data-npc-create-mode="full"
              onClick={handleFullCharacter}
              className="flex min-h-[11rem] flex-col items-start justify-between rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-amber-500/80 hover:bg-amber-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Scroll className="h-8 w-8 text-primary" aria-hidden />
              <div className="space-y-1">
                <p className="text-lg font-semibold">Vollständiger Charakter</p>
                <p className="text-sm text-muted-foreground">
                  Kompletter SagaTree-Charakterbogen
                </p>
              </div>
            </button>
          </div>
          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-11"
              onClick={() => setStep('kind')}
            >
              Zurück
            </Button>
            <Button
              type="button"
              className="h-11 min-h-11"
              onClick={() => setStep('quick')}
              data-npc-create-quick-continue
            >
              Schnell erstellen
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'quick' ? (
        <div className="space-y-5" data-npc-quick-create>
          <div className="space-y-2">
            <Label htmlFor="npc-create-name">Name</Label>
            <Input
              id="npc-create-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 min-h-11"
              placeholder="Name der Figur"
              autoComplete="off"
              data-npc-create-name
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="npc-create-category">Kategorie</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as NpcCreatureCategory)}
              >
                <SelectTrigger id="npc-create-category" className="h-11 min-h-11" data-npc-create-category>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NPC_CREATURE_CATEGORIES.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {NPC_CREATURE_CATEGORY_LABELS[entry]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="npc-create-level">Stufe</Label>
              <Select
                value={String(level)}
                onValueChange={(value) => setLevel(Number(value) as SagaTreeNpcLevel)}
              >
                <SelectTrigger id="npc-create-level" className="h-11 min-h-11" data-npc-create-level>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((entry) => (
                    <SelectItem key={entry} value={String(entry)}>
                      Stufe {entry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground" data-npc-create-machtgrad>
                Machtgrad {machtgradLabel}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="npc-create-profile">Kampfprofil</Label>
              <Select
                value={combatProfile}
                onValueChange={(value) => setCombatProfile(value as SagaTreeCombatProfile)}
              >
                <SelectTrigger id="npc-create-profile" className="h-11 min-h-11" data-npc-create-profile>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMBAT_PROFILES.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {NPC_COMBAT_PROFILE_LABELS[entry]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showCombatRole ? (
              <div className="space-y-2">
                <Label htmlFor="npc-create-role">Kampfrolle</Label>
                <Select
                  value={combatRole}
                  onValueChange={(value) => setCombatRole(value as SagaTreeCombatRole)}
                >
                  <SelectTrigger id="npc-create-role" className="h-11 min-h-11" data-npc-create-role>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMBAT_ROLES.map((entry) => (
                      <SelectItem key={entry} value={entry}>
                        {NPC_COMBAT_ROLE_LABELS[entry]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Kampfrolle</Label>
                <p className="flex h-11 min-h-11 items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground">
                  Standard (Nichtkämpferisch)
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="npc-create-world">Welt / Quelle (optional)</Label>
            <Select value={worldId} onValueChange={setWorldId} disabled={worldsLoading}>
              <SelectTrigger id="npc-create-world" className="h-11 min-h-11" data-npc-create-world>
                <SelectValue placeholder="Persönlich (Eigen)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">Persönlich (Eigen)</SelectItem>
                {worlds.map((world) => (
                  <SelectItem key={world.id} value={world.id}>
                    {world.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="npc-create-description">Kurzbeschreibung (optional)</Label>
            <Textarea
              id="npc-create-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="min-h-[5.5rem]"
            />
          </div>

          {formError ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-11"
              onClick={() => setStep('mode')}
              disabled={isSubmitting}
            >
              Zurück
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 min-h-11"
                onClick={onBack}
                disabled={isSubmitting}
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                className="h-11 min-h-11"
                onClick={() => void handleCreate()}
                disabled={isSubmitting}
                data-npc-create-submit
              >
                {isSubmitting ? (
                  <>
                    <CircleNotch className="mr-2 size-4 animate-spin" aria-hidden />
                    Erstellen…
                  </>
                ) : (
                  'Erstellen'
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
