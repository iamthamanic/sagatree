/**
 * SagaListPanel — Authorized Saga list for /sagas (#489).
 * Location: src/app/project/SagaListPanel.tsx
 */
import {
  CircleNotch,
  Plus
} from '@phosphor-icons/react';
import { Button } from '../../shared/ui/button';
import { pathForSagaNew, pathForSagaSection } from '../shell';
import { useProjectSummaries } from './hooks/useProjectSummaries';

export type SagaListPanelProps = {
  onNavigate: (view: string) => void;
  onNavigateHome: () => void;
};

export function SagaListPanel({ onNavigate, onNavigateHome }: SagaListPanelProps) {
  const { projects, isLoading, error, refreshProjects } = useProjectSummaries({
    enabled: true,
  });
  const active = projects.filter((p) => p.status === 'active');

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-6" data-saga-list>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Sagas</h1>
          <p className="text-sm text-muted-foreground">
            Deine Kampagnen und Abenteuer — öffentliche IDs im Format SA-XXXXX.
          </p>
        </div>
        <Button
          type="button"
          className="min-h-11"
          onClick={() => onNavigate(pathForSagaNew())}
          data-saga-list-create
        >
          <Plus className="mr-2 size-4" />
          Saga erstellen
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3" role="alert">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2 min-h-11"
            onClick={() => {
              void refreshProjects();
            }}
          >
            Erneut laden
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center justify-center py-12" data-saga-list-loading>
          <CircleNotch className="size-8 animate-spin text-muted-foreground" aria-label="Lädt" />
        </div>
      ) : null}

      {!isLoading && !error && active.length === 0 ? (
        <div
          className="rounded-lg border border-dashed border-border p-8 text-center"
          data-saga-list-empty
        >
          <p className="text-muted-foreground">Noch keine Sagas.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Erstelle deine erste Saga, um Charaktere, Welt und Sessions zu bündeln.
          </p>
          <Button
            type="button"
            className="mt-4 min-h-11"
            onClick={() => onNavigate(pathForSagaNew())}
          >
            <Plus className="mr-2 size-4" />
            Erste Saga erstellen
          </Button>
        </div>
      ) : null}

      {!isLoading && active.length > 0 ? (
        <ul className="space-y-2">
          {active.map((saga) => (
            <li key={saga.id}>
              <button
                type="button"
                className="flex min-h-11 w-full flex-col items-start gap-1 rounded-md border border-border px-3 py-3 text-left hover:bg-accent/40"
                onClick={() => onNavigate(pathForSagaSection(saga.publicId, 'overview'))}
                data-saga-list-item={saga.publicId}
              >
                <span className="font-medium">{saga.name}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground">
                  {saga.description || 'Keine Beschreibung'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {saga.publicId}
                  {saga.code ? ` · Code ${saga.code}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Button type="button" variant="ghost" className="min-h-11 self-start" onClick={onNavigateHome}>
        Zurück zum Dashboard
      </Button>
    </div>
  );
}
