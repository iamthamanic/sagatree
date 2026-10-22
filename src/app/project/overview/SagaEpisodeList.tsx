/**
 * SagaEpisodeList — Sessions table for saga hub overview (#saga-workspace-ia).
 * Columns: name, date, duration, open. Optional GM delete. Full-text filter in header.
 * Location: src/app/project/overview/SagaEpisodeList.tsx
 */
import { useMemo, useState } from 'react';
import {
  MagnifyingGlass,
  Trash
} from '@phosphor-icons/react';
import type {
  SagaEpisodeVm,
  SagaPrimaryAction,
} from '../../../domains/project/contracts/saga-overview';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../shared/ui/table';
import { cn } from '../../../shared/ui/utils';

/** Visible rows before the session table scrolls (header stays in view). */
const SESSION_ROWS_BEFORE_SCROLL = 3;
/** ~header (2.5rem) + 3× row with min-h-11 actions (~3.25rem). */
const SESSION_SCROLL_MAX_CLASS = 'max-h-[12.25rem]';

export type SagaEpisodeListProps = {
  episodes: readonly SagaEpisodeVm[];
  sagaTitle: string;
  onOpenEpisode: (episode: SagaEpisodeVm) => void;
  /** GM-only: show Session löschen. */
  canDeleteEpisodes?: boolean;
  onDeleteEpisode?: (episode: SagaEpisodeVm) => void | Promise<void>;
  primaryAction?: SagaPrimaryAction;
  onPrimary?: () => void;
};

function episodeTitle(episode: SagaEpisodeVm): string {
  return episode.name?.trim() || `Session ${episode.sessionNumber}`;
}

function formatSessionDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatSessionDuration(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt) return '—';
  const start = new Date(startedAt);
  if (Number.isNaN(start.getTime())) return '—';
  const end = endedAt ? new Date(endedAt) : null;
  const endMs = end && !Number.isNaN(end.getTime()) ? end.getTime() : Date.now();
  const minutes = Math.max(0, Math.round((endMs - start.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} Min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours} Std` : `${hours} Std ${rem} Min`;
}

function episodeSearchHaystack(episode: SagaEpisodeVm): string {
  const title = episodeTitle(episode);
  const dateIso = episode.startedAt ?? episode.endedAt;
  return [
    title,
    episode.sessionPublicId,
    `E${String(episode.sessionNumber).padStart(3, '0')}`,
    String(episode.sessionNumber),
    episode.status,
    formatSessionDate(dateIso),
    formatSessionDuration(episode.startedAt, episode.endedAt),
    episode.recapSnippet ?? '',
  ]
    .join(' ')
    .toLowerCase();
}

export function SagaEpisodeList({
  episodes,
  onOpenEpisode,
  canDeleteEpisodes = false,
  onDeleteEpisode,
  primaryAction,
  onPrimary,
}: SagaEpisodeListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const completed = episodes.filter((e) => e.status === 'completed').length;
  const primaryWait = primaryAction?.kind === 'wait';

  const filtered = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return episodes;
    return episodes.filter((episode) => episodeSearchHaystack(episode).includes(needle));
  }, [episodes, searchQuery]);

  const scrollSessions = filtered.length >= SESSION_ROWS_BEFORE_SCROLL;

  return (
    <section
      className="@container flex min-h-0 min-w-0 flex-col rounded-xl border border-border bg-card"
      data-saga-overview-episodes
      data-saga-overview-episodes-scroll={scrollSessions ? '1' : '0'}
      aria-labelledby="saga-overview-episodes-title"
    >
      <div className="flex shrink-0 flex-col gap-2.5 px-4 pb-2.5 pt-3.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <h3
              id="saga-overview-episodes-title"
              className="text-[1.05rem] font-bold text-foreground"
            >
              Sessions
            </h3>
            <p className="text-[13px] text-muted-foreground">
              {episodes.length === 0
                ? 'Noch keine Sessions in dieser Saga.'
                : searchQuery.trim()
                  ? `${filtered.length} von ${episodes.length} · ${completed} abgeschlossen`
                  : `${completed} von ${episodes.length} abgeschlossen`}
            </p>
          </div>
          {primaryAction && onPrimary ? (
            <Button
              type="button"
              className="h-11 min-h-11 shrink-0 px-3 text-xs font-semibold sm:text-sm"
              disabled={primaryWait}
              onClick={onPrimary}
              data-saga-overview-primary={primaryAction.kind}
            >
              {primaryAction.labelDe}
            </Button>
          ) : null}
        </div>
        <div className="relative min-w-0">
          <MagnifyingGlass
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Sessions durchsuchen…"
            className="pl-10"
            aria-label="Sessions durchsuchen"
            data-saga-hub-sessions-search
          />
        </div>
      </div>

      <div
        className={cn(
          'min-h-0 overscroll-contain px-3 pb-3',
          scrollSessions && `${SESSION_SCROLL_MAX_CLASS} overflow-y-auto`,
        )}
      >
        <Table data-saga-overview-episodes-table>
          <TableHeader className={scrollSessions ? 'sticky top-0 z-10 bg-card' : undefined}>
            <TableRow>
              <TableHead>Sessionname</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Dauer</TableHead>
              <TableHead className="text-right">Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {episodes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-6 text-muted-foreground whitespace-normal"
                  data-saga-overview-episodes-empty
                >
                  Noch keine Sessions in dieser Saga. Starte die erste über „Session hosten“.
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-6 text-muted-foreground whitespace-normal"
                  data-saga-overview-episodes-search-empty
                >
                  Keine Treffer für „{searchQuery.trim()}“.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((episode) => {
                const title = episodeTitle(episode);
                const dateIso = episode.startedAt ?? episode.endedAt;
                return (
                  <TableRow
                    key={episode.sessionId}
                    data-saga-overview-episode-row={episode.sessionPublicId}
                  >
                    <TableCell className="max-w-[12rem] truncate font-medium text-foreground">
                      {title}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatSessionDate(dateIso)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatSessionDuration(episode.startedAt, episode.endedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          className="min-h-11 px-3"
                          onClick={() => onOpenEpisode(episode)}
                          data-saga-overview-episode={episode.sessionPublicId}
                        >
                          Öffnen
                        </Button>
                        {canDeleteEpisodes && onDeleteEpisode ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-11 shrink-0 text-muted-foreground hover:text-destructive"
                            aria-label={`${title} löschen`}
                            onClick={() => {
                              void onDeleteEpisode(episode);
                            }}
                            data-saga-overview-episode-delete={episode.sessionPublicId}
                          >
                            <Trash className="size-4" aria-hidden />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
