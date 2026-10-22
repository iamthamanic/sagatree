/**
 * SessionPastSessionsPanel — List user sessions with status filter + full-text search.
 * Location: src/app/session/SessionPastSessionsPanel.tsx
 */
import { useMemo, useState } from 'react';
import {
  ClockCounterClockwise,
  CircleNotch,
  MagnifyingGlass
} from '@phosphor-icons/react';
import type { SessionVm } from '../../domains/session/contracts/session.types';
import type { PlaySessionStatus } from '../../domains/session/contracts/session-lifecycle';
import { Badge } from '../../shared/ui/badge';
import { Button } from '../../shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../shared/ui/card';
import { Input } from '../../shared/ui/input';
import { Label } from '../../shared/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../shared/ui/select';

type StatusFilter = 'all' | PlaySessionStatus;

const STATUS_LABELS: Record<PlaySessionStatus, string> = {
  waiting: 'Wartet',
  active: 'Aktiv',
  paused: 'Pausiert',
  completed: 'Beendet',
};

type SessionPastSessionsPanelProps = {
  sessions: SessionVm[];
  isLoading: boolean;
  /** Authenticated user — GM action only when session.gmUserId matches. */
  currentUserId: string | null;
  sagaNameByProjectId: Record<string, string>;
  onOpenAsGm: (session: SessionVm) => void;
  onJoinAsPlayer: (session: SessionVm) => void;
};

function matchesQuery(session: SessionVm, query: string, sagaName: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    session.name,
    session.code,
    session.publicId ?? '',
    session.status,
    STATUS_LABELS[session.status],
    sagaName,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export function SessionPastSessionsPanel({
  sessions,
  isLoading,
  currentUserId,
  sagaNameByProjectId,
  onOpenAsGm,
  onJoinAsPlayer,
}: SessionPastSessionsPanelProps) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    const sorted = [...sessions].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    return sorted.filter((session) => {
      if (statusFilter !== 'all' && session.status !== statusFilter) return false;
      const sagaName = session.projectId
        ? sagaNameByProjectId[session.projectId] ?? ''
        : '';
      return matchesQuery(session, query, sagaName);
    });
  }, [sessions, statusFilter, query, sagaNameByProjectId]);

  return (
    <Card data-session-past-panel>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <ClockCounterClockwise className="size-5" />
          Vergangene Sessions
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Offene Sessions — filtern und durchsuchen
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="session-past-search">Suche</Label>
            <div className="relative">
              <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="session-past-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, Code, Saga…"
                className="min-h-11 pl-9"
                data-session-past-search
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-past-status">Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <SelectTrigger
                id="session-past-status"
                className="min-h-11"
                data-session-past-status
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle (offen)</SelectItem>
                <SelectItem value="waiting">{STATUS_LABELS.waiting}</SelectItem>
                <SelectItem value="active">{STATUS_LABELS.active}</SelectItem>
                <SelectItem value="paused">{STATUS_LABELS.paused}</SelectItem>
                {/* completed omitted: getUserSessions() excludes completed rows */}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <CircleNotch className="size-4 animate-spin" />
            Lade Sessions…
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Keine Sessions gefunden
          </p>
        ) : (
          <ul className="space-y-2" data-session-past-list>
            {filtered.map((session) => {
              const sagaName = session.projectId
                ? sagaNameByProjectId[session.projectId]
                : undefined;
              const canResume = session.status !== 'completed';
              const isGm = Boolean(currentUserId && session.gmUserId === currentUserId);
              return (
                <li
                  key={session.id}
                  className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  data-session-past-row={session.id}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-sm md:text-base">{session.name}</p>
                      <Badge variant="outline" className="rounded-full text-[10px] uppercase">
                        {STATUS_LABELS[session.status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground md:text-sm">
                      {sagaName ? `${sagaName} · ` : ''}
                      Code {session.code}
                      {session.publicId ? ` · ${session.publicId}` : ''}
                      {` · ${session.players.length} Spieler`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {canResume ? (
                      <>
                        {isGm ? (
                          <Button
                            type="button"
                            size="sm"
                            className="min-h-11"
                            onClick={() => onOpenAsGm(session)}
                          >
                            Als GM öffnen
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant={isGm ? 'outline' : 'default'}
                          className="min-h-11"
                          onClick={() => onJoinAsPlayer(session)}
                        >
                          {isGm ? 'Als Spieler' : 'Öffnen'}
                        </Button>
                      </>
                    ) : (
                      <Badge variant="secondary" className="rounded-full">
                        Abgeschlossen
                      </Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
