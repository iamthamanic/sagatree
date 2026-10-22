/**
 * SagaLoreTimelinePanel — Lore / Verlauf timeline from RPC (#617).
 * Location: src/app/project/SagaLoreTimelinePanel.tsx
 */
import { useEffect, useState } from 'react';
import {
  BookOpen,
  CircleNotch
} from '@phosphor-icons/react';
import type { SagaLoreTimelineVm } from '../../domains/saga/permissions/lore-timeline';
import { sagaPermissionService } from '../../infrastructure/project/saga-permission-service';

export type SagaLoreTimelinePanelProps = {
  sagaPublicId: string;
};

function kindLabel(kind: string): string {
  switch (kind) {
    case 'recap':
      return 'Recap';
    case 'knowledge':
      return 'Wissen';
    case 'lore_binding':
      return 'Lore';
    default:
      return kind;
  }
}

export function SagaLoreTimelinePanel({ sagaPublicId }: SagaLoreTimelinePanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<SagaLoreTimelineVm | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const data = await sagaPermissionService.getLoreTimeline(sagaPublicId);
        if (!cancelled) setTimeline(data);
      } catch (err) {
        if (!cancelled) {
          setTimeline(null);
          setError(err instanceof Error ? err.message : 'Lore konnte nicht geladen werden');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sagaPublicId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" data-saga-lore-loading>
        <CircleNotch className="size-4 animate-spin" aria-hidden />
        Lore / Verlauf wird geladen…
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert" data-saga-lore-error>
        {error}
      </p>
    );
  }

  const entries = timeline?.entries ?? [];

  if (entries.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed border-border p-6 text-center"
        data-saga-catalog="lore"
        data-saga-lore-empty
      >
        <BookOpen className="mx-auto mb-2 size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium text-foreground">Lore / Verlauf</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Noch keine Einträge. Recaps und freigegebenes Wissen erscheinen hier nach Sessions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-saga-catalog="lore" data-saga-lore-timeline>
      <p className="text-sm text-muted-foreground">
        Timeline aus Recaps, Wissen und freigegebener Lore
        {timeline?.canReadHidden ? ' (inkl. versteckter Fakten)' : ''}.
      </p>
      <ul className="space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="rounded-lg border border-border px-3 py-2"
            data-saga-lore-entry={entry.kind}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-foreground">
                {entry.title || 'Eintrag'}
              </p>
              <span className="text-xs text-muted-foreground">
                {kindLabel(entry.kind)} · {entry.visibility}
              </span>
            </div>
            {entry.summary ? (
              <p className="mt-1 text-sm text-muted-foreground">{entry.summary}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
