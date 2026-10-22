/**
 * CharacterBackgroundComposer — BG story field with examples, generate CTA, and explicit draft accept.
 * Location: src/app/character/creation/CharacterBackgroundComposer.tsx
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Sparkle,
  X
} from '@phosphor-icons/react';
import { toast } from 'sonner@2.0.3';
import { Button } from '../../../shared/ui/button';
import { Label } from '../../../shared/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select';
import { Textarea } from '../../../shared/ui/textarea';
import { useProjectSummaries } from '../../project';
import { buildCharacterBackgroundExamples } from '../../../domains/character/use-cases/character-lore-examples';
import { characterLoreService } from '../../../infrastructure/character/character-lore-service';
import type { CharacterLoreContext } from '../../../domains/character/contracts/character-lore.types';

interface CharacterBackgroundComposerProps {
  value: string;
  context: CharacterLoreContext;
  onChange: (value: string) => void;
}

const EXAMPLE_ROTATION_MS = 5_000;
const EXAMPLE_FADE_MS = 180;
const NO_PROJECT_CONTEXT = 'none';

type StatusBanner = {
  tone: 'error' | 'info';
  message: string;
};

export function CharacterBackgroundComposer({
  value,
  context,
  onChange,
}: CharacterBackgroundComposerProps) {
  const examples = useMemo(() => buildCharacterBackgroundExamples(context), [context]);
  const { projects, isLoading: projectsLoading, error: projectsError } = useProjectSummaries({
    enabled: true,
  });
  const [selectedProjectId, setSelectedProjectId] = useState(
    context.projectId ?? NO_PROJECT_CONTEXT,
  );
  const [exampleIndex, setExampleIndex] = useState(0);
  const [exampleVisible, setExampleVisible] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState('');
  const [statusBanner, setStatusBanner] = useState<StatusBanner | null>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId),
    [projects, selectedProjectId],
  );

  const generationContext = useMemo<CharacterLoreContext>(() => {
    if (selectedProjectId === NO_PROJECT_CONTEXT) {
      return {
        ...context,
        projectId: undefined,
        worldId: undefined,
      };
    }

    if (selectedProject) {
      return {
        ...context,
        projectId: selectedProject.id,
        worldId: selectedProject.worldId ?? undefined,
      };
    }

    return context.projectId === selectedProjectId
      ? context
      : {
          ...context,
          projectId: undefined,
          worldId: undefined,
        };
  }, [context, selectedProject, selectedProjectId]);

  useEffect(() => {
    if (context.projectId) setSelectedProjectId(context.projectId);
  }, [context.projectId]);

  useEffect(() => {
    setExampleIndex(0);
    setExampleVisible(true);
  }, [examples]);

  useEffect(() => {
    if (value.trim() || examples.length < 2) return undefined;

    let fadeTimer: number | undefined;
    const rotationTimer = window.setInterval(() => {
      setExampleVisible(false);
      fadeTimer = window.setTimeout(() => {
        setExampleIndex((current) => (current + 1) % examples.length);
        setExampleVisible(true);
      }, EXAMPLE_FADE_MS);
    }, EXAMPLE_ROTATION_MS);

    return () => {
      window.clearInterval(rotationTimer);
      if (fadeTimer !== undefined) window.clearTimeout(fadeTimer);
    };
  }, [examples, value]);

  const currentExample = examples[exampleIndex] ?? examples[0] ?? '';
  const hasContextProjectOutsideList =
    Boolean(context.projectId) &&
    context.projectId === selectedProjectId &&
    !projects.some((project) => project.id === context.projectId);

  const handleGenerate = async () => {
    setGenerating(true);
    setGeneratedDraft('');
    setStatusBanner(null);
    try {
      const result = await characterLoreService.generateBackground({
        context: generationContext,
        currentBackgroundStory: value.trim() || undefined,
      });
      setGeneratedDraft(result.story);
      setStatusBanner(null);
      toast.success('Neue Hintergrundgeschichte erstellt');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Hintergrundgeschichte konnte nicht generiert werden';
      const tone: StatusBanner['tone'] =
        /nicht konfiguriert|not configured|Character-AI|Ollama|Provider/i.test(message)
          ? 'info'
          : 'error';
      setStatusBanner({ tone, message });
      if (tone === 'info') {
        toast.message(message);
      } else {
        toast.error(message);
      }
    } finally {
      setGenerating(false);
    }
  };

  const acceptGeneratedDraft = () => {
    if (!generatedDraft.trim()) return;
    onChange(generatedDraft);
    setGeneratedDraft('');
    setStatusBanner(null);
    toast.success('KI-Variante übernommen');
  };

  const acceptExample = () => {
    if (!currentExample) return;
    onChange(currentExample);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="characterLoreProject">Kampagnen-Lore</Label>
        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger
            id="characterLoreProject"
            data-testid="character-lore-project-context"
          >
            <SelectValue placeholder="Kein Projekt (setting-neutral)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PROJECT_CONTEXT}>Kein Projekt (setting-neutral)</SelectItem>
            {hasContextProjectOutsideList && context.projectId && (
              <SelectItem value={context.projectId}>Aktuelles Projekt</SelectItem>
            )}
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {selectedProject
            ? selectedProject.worldId
              ? `Projekt „${selectedProject.name}“ und seine verknüpfte Welt-Lore werden serverseitig autorisiert und einbezogen.`
              : `Projekt „${selectedProject.name}“ wird serverseitig autorisiert; es ist aktuell keine Welt verknüpft.`
            : projectsLoading
              ? 'Projekte werden geladen. Ohne Auswahl bleibt die Generierung setting-neutral.'
              : projectsError
                ? 'Projektliste ist aktuell nicht verfügbar. Die Generierung bleibt ohne Projektauswahl setting-neutral.'
                : 'Optional: Wähle ein Projekt, um dessen autorisierte Projekt- und Welt-Lore einzubeziehen.'}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="backgroundStory">Hintergrundgeschichte</Label>
        <div className="overflow-hidden rounded-md border border-foreground/20 bg-input-background transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]">
          <div className="flex min-h-11 items-center justify-end border-b border-border px-2 py-1.5">
            <Button
              type="button"
              size="sm"
              onClick={handleGenerate}
              disabled={generating}
              data-testid="character-bg-generate"
            >
              <Sparkle className="size-4" />
              {generating ? 'Generiert...' : 'Generieren'}
            </Button>
          </div>
          <div className="relative">
            <Textarea
              id="backgroundStory"
              rows={8}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              data-testid="character-bg-story"
              className="relative z-10 min-h-[190px] resize-y rounded-none border-0 bg-transparent shadow-none focus-visible:border-transparent focus-visible:ring-0"
            />
            {!value.trim() && currentExample && (
              <p
                aria-hidden="true"
                className={`pointer-events-none absolute inset-x-3 top-3 z-0 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground transition-opacity duration-200 motion-reduce:transition-none ${exampleVisible ? 'opacity-70' : 'opacity-0'}`}
              >
                {currentExample}
              </p>
            )}
          </div>
          {!value.trim() && currentExample && (
            <div className="flex flex-col gap-2 border-t border-border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Beispiel {exampleIndex + 1} von {examples.length}. Wechselt alle 5 Sekunden.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={acceptExample}
                data-testid="character-bg-accept-example"
              >
                Beispiel übernehmen
              </Button>
            </div>
          )}
        </div>
      </div>

      {statusBanner && (
        <div
          role="status"
          aria-live="polite"
          data-testid="character-bg-status"
          className={`rounded-md border px-3 py-2 text-sm ${
            statusBanner.tone === 'info'
              ? 'border-primary/40 bg-primary/10 text-foreground'
              : 'border-destructive/40 bg-destructive/10 text-destructive'
          }`}
        >
          {statusBanner.message}
        </div>
      )}

      {generatedDraft && (
        <div
          className="rounded-md border border-primary/40 bg-primary/5 p-3"
          aria-live="polite"
          data-testid="character-bg-draft"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Neue KI-Variante</p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setGeneratedDraft('')}
              aria-label="KI-Variante verwerfen"
            >
              <X className="size-4" />
            </Button>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{generatedDraft}</p>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setGeneratedDraft('')}>
              Verwerfen
            </Button>
            <Button type="button" size="sm" onClick={acceptGeneratedDraft} data-testid="character-bg-accept-draft">
              Übernehmen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
