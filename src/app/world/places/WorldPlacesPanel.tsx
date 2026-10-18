/**
 * WorldPlacesPanel — hierarchical list of semantic world places (Donalu UX).
 * Location: src/app/world/places/WorldPlacesPanel.tsx
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import {
  pickPrimaryMapIdForPlace,
  placeHasDetailMap,
  type WorldPlaceMapLinkVm,
  type WorldPlaceVm,
} from '../../../domains/world/places';
import { worldPlaceService } from '../../../infrastructure/world/world-place-service';
import { Button } from '../../../shared/ui/button';

export type WorldPlacesPanelProps = {
  readonly worldProfileId: string;
  readonly canEdit?: boolean;
  readonly sagaPublicId?: string | null;
  readonly playerView?: boolean;
  readonly activeMapId?: string | null;
  readonly onOpenMap?: (mapId: string) => void;
  readonly onSelectPlace?: (place: WorldPlaceVm) => void;
  /** Create + link a detail child map when the place has none (IV placeholder CTA). */
  readonly onCreateDetailMap?: (place: WorldPlaceVm) => void | Promise<void>;
};

function indentFor(place: WorldPlaceVm, byId: Map<string, WorldPlaceVm>): number {
  let depth = 0;
  let cur: WorldPlaceVm | undefined = place;
  const seen = new Set<string>();
  while (cur?.parentPlaceId && !seen.has(cur.id)) {
    seen.add(cur.id);
    depth += 1;
    cur = byId.get(cur.parentPlaceId);
    if (depth > 8) break;
  }
  return depth;
}

export function WorldPlacesPanel({
  worldProfileId,
  canEdit = false,
  sagaPublicId = null,
  playerView = false,
  activeMapId = null,
  onOpenMap,
  onSelectPlace,
  onCreateDetailMap,
}: WorldPlacesPanelProps) {
  const [creating, setCreating] = useState(false);
  const [places, setPlaces] = useState<WorldPlaceVm[]>([]);
  const [links, setLinks] = useState<WorldPlaceMapLinkVm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const id = worldProfileId.trim();
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const listOpts = { playerView, sagaPublicId };
      const [nextPlaces, nextLinks] = await Promise.all([
        worldPlaceService.listPlaces(id, listOpts),
        worldPlaceService.listMapLinks(id, listOpts),
      ]);
      setPlaces(nextPlaces);
      setLinks(nextLinks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Orte konnten nicht geladen werden.');
      setPlaces([]);
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [worldProfileId, playerView, sagaPublicId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const byId = useMemo(() => {
    const map = new Map<string, WorldPlaceVm>();
    for (const p of places) map.set(p.id, p);
    return map;
  }, [places]);

  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const selectedHasDetail = selected ? placeHasDetailMap(selected.id, links) : false;

  return (
    <div className="flex min-h-0 flex-col gap-2" data-world-places-panel>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Orte</p>
        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-9 text-xs"
            onClick={() => void reload()}
          >
            Aktualisieren
          </Button>
        ) : null}
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Orte werden geladen…
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && places.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Orte angelegt.</p>
      ) : null}

      <ul className="max-h-64 space-y-1 overflow-y-auto" data-world-places-list>
        {places.map((place) => {
          const depth = indentFor(place, byId);
          const mapId = pickPrimaryMapIdForPlace(place.id, links);
          const active = place.id === selectedId;
          return (
            <li key={place.id}>
              <button
                type="button"
                className={`flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm ${
                  active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
                style={{ paddingLeft: `${8 + depth * 12}px` }}
                onClick={() => {
                  setSelectedId(place.id);
                  onSelectPlace?.(place);
                  if (mapId && onOpenMap) onOpenMap(mapId);
                }}
              >
                <MapPin className="size-3.5 shrink-0 opacity-70" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{place.name}</span>
                <span className="shrink-0 text-[10px] uppercase opacity-70">{place.kind}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {selected ? (
        <div
          className="space-y-2 rounded-md border border-border p-2 text-sm"
          data-world-place-inspector
        >
          <p className="font-medium">{selected.name}</p>
          <p className="text-xs text-muted-foreground">
            {selected.kind}
            {selected.seedKey ? ` · ${selected.seedKey}` : ''}
          </p>
          {!selectedHasDetail ? (
            <div className="space-y-2" data-iv-missing-detail>
              <p className="text-xs text-muted-foreground">
                Für diesen Ort gibt es noch keine Detailkarte.
              </p>
              {canEdit && onCreateDetailMap ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full"
                  disabled={creating}
                  onClick={() => {
                    setCreating(true);
                    void Promise.resolve(onCreateDetailMap(selected))
                      .then(() => reload())
                      .finally(() => setCreating(false));
                  }}
                >
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      Wird angelegt…
                    </>
                  ) : (
                    'Detailkarte anlegen'
                  )}
                </Button>
              ) : null}
            </div>
          ) : null}
          {activeMapId ? (
            <p className="text-[10px] text-muted-foreground">Aktive Karte: {activeMapId.slice(0, 8)}…</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
