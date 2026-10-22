/**
 * CharacterStatisticsPanel — Adventure arcs + development timeline for a saved character.
 * Location: src/app/character/progression/CharacterStatisticsPanel.tsx
 */
import { useEffect, useState } from 'react';
import {
  CircleNotch,
  Plus
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/ui/select';
import { Textarea } from '../../../shared/ui/textarea';
import { characterAdventureArcService } from '../../../infrastructure/character/character-adventure-arc-service';
import type {
  CharacterAdventureArcVm,
  CharacterAdventureDevelopmentKind,
} from '../../../domains/character/contracts/character-adventure-arc.types';

const DEVELOPMENT_KIND_OPTIONS: ReadonlyArray<{ value: CharacterAdventureDevelopmentKind; label: string }> = [
  { value: 'note', label: 'Notiz' },
  { value: 'level', label: 'Stufe' },
  { value: 'species-trait', label: 'Speziesmerkmal' },
  { value: 'skill', label: 'Fertigkeit' },
];

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktiv',
  completed: 'Abgeschlossen',
  left: 'Verlassen',
};

type CharacterStatisticsPanelProps = {
  characterId: string | null;
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('de-DE', { year: 'numeric', month: 'short', day: 'numeric' });
}

function kindLabel(kind: CharacterAdventureDevelopmentKind): string {
  return DEVELOPMENT_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? kind;
}

export function CharacterStatisticsPanel({ characterId }: CharacterStatisticsPanelProps) {
  const [arcs, setArcs] = useState<CharacterAdventureArcVm[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeArcId, setActiveArcId] = useState<string | null>(null);
  const [kind, setKind] = useState<CharacterAdventureDevelopmentKind>('note');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!characterId) {
      setArcs([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    characterAdventureArcService
      .listArcsForCharacter(characterId)
      .then((data) => {
        if (cancelled) return;
        setArcs(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Statistik konnte nicht geladen werden.');
        setArcs([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [characterId]);

  const handleAppend = async (arcId: string) => {
    if (!title.trim()) {
      toast.error('Bitte gib einen Titel für die Entwicklung an.');
      return;
    }
    setIsSaving(true);
    try {
      const updated = await characterAdventureArcService.appendDevelopment(arcId, {
        kind,
        title,
        detail,
      });
      setArcs((current) => current.map((arc) => (arc.id === arcId ? updated : arc)));
      setTitle('');
      setDetail('');
      setActiveArcId(null);
      toast.success('Entwicklung eingetragen');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Entwicklung konnte nicht gespeichert werden.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!characterId) {
    return (
      <section className="rounded-lg border border-border bg-muted/15 p-4">
        <h3 className="font-semibold">Statistik</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Speichere den Charakter zuerst. Danach erscheinen hier Abenteuer-Teilnahmen und die Entwicklungsgeschichte je Kampagne.
        </p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <CircleNotch className="h-5 w-5 animate-spin" />
        <span className="text-sm">Lade Abenteuer-Statistik…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (arcs.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-muted/15 p-4">
        <h3 className="font-semibold">Noch keine Abenteuer</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Sobald dieser Charakter einem Projekt zugeordnet ist, erscheint hier der Abenteuer-Bogen. Entwicklungen kannst du dann je Kampagne eintragen.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Abenteuer-Statistik</h3>
        <p className="text-sm text-muted-foreground">
          Teilnahmen und Entwicklungsgeschichte je Kampagne. Normale Level-ups erzeugen hier noch keinen automatischen Eintrag.
        </p>
      </div>

      {arcs.map((arc) => (
        <article key={arc.id} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h4 className="font-medium leading-snug">{arc.projectName}</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Seit {formatDate(arc.startedAt)}
                {arc.endedAt ? ` · bis ${formatDate(arc.endedAt)}` : ''}
                {` · ${arc.sessionCount} Session${arc.sessionCount === 1 ? '' : 's'}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{STATUS_LABELS[arc.status] ?? arc.status}</Badge>
              {arc.projectStatus && <Badge variant="secondary">{arc.projectStatus}</Badge>}
            </div>
          </div>

          {arc.summary.trim() && (
            <p className="text-sm text-muted-foreground">{arc.summary}</p>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Entwicklung</p>
            {arc.developments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Einträge für dieses Abenteuer.</p>
            ) : (
              <ol className="space-y-2">
                {arc.developments.map((entry) => (
                  <li key={entry.id} className="rounded-md border border-border/70 bg-muted/10 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{kindLabel(entry.kind)}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(entry.at)}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium">{entry.title}</p>
                    {entry.detail && (
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{entry.detail}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>

          {activeArcId === arc.id ? (
            <div className="space-y-3 rounded-md border border-border bg-muted/10 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`dev-kind-${arc.id}`}>Art</Label>
                  <Select value={kind} onValueChange={(value) => setKind(value as CharacterAdventureDevelopmentKind)}>
                    <SelectTrigger id={`dev-kind-${arc.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEVELOPMENT_KIND_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`dev-title-${arc.id}`}>Titel *</Label>
                  <Input
                    id={`dev-title-${arc.id}`}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="z. B. Stufe 2 erreicht"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`dev-detail-${arc.id}`}>Details</Label>
                <Textarea
                  id={`dev-detail-${arc.id}`}
                  rows={2}
                  value={detail}
                  onChange={(event) => setDetail(event.target.value)}
                  placeholder="Was hat sich verändert?"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={isSaving} onClick={() => handleAppend(arc.id)}>
                  {isSaving ? 'Speichert…' : 'Eintragen'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={isSaving}
                  onClick={() => {
                    setActiveArcId(null);
                    setTitle('');
                    setDetail('');
                  }}
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => setActiveArcId(arc.id)}>
              <Plus className="mr-2 h-4 w-4" />Entwicklung eintragen
            </Button>
          )}
        </article>
      ))}
    </div>
  );
}
