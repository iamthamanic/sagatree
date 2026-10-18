/**
 * useSagaOverview — Cached, visibility-refresh saga hub overview (#570).
 * Location: src/app/project/hooks/useSagaOverview.ts
 *
 * Loads via sagaOverviewService only. No Realtime. Hooks: useState/useEffect/useRef.
 */
import { useEffect, useRef, useState } from 'react';
import type { SagaOverviewVm } from '../../../domains/project/contracts/saga-overview';
import { sagaOverviewService } from '../../../infrastructure/project/saga-overview-service';
import { entityCache, sagaOverviewCacheKey } from '../../../lib/entityCache';

export interface UseSagaOverviewOptions {
  sagaPublicId: string | null;
}

export interface UseSagaOverviewResult {
  model: SagaOverviewVm | null;
  isLoading: boolean;
  error: string | null;
  refresh: (opts?: { force?: boolean }) => Promise<void>;
}

type LoadFn = (opts?: { force?: boolean }) => Promise<void>;

export function useSagaOverview(options: UseSagaOverviewOptions): UseSagaOverviewResult {
  const { sagaPublicId } = options;
  const cacheKey = sagaPublicId ? sagaOverviewCacheKey(sagaPublicId) : null;
  const cached = cacheKey ? entityCache.get<SagaOverviewVm>(cacheKey) : null;

  const [model, setModel] = useState<SagaOverviewVm | null>(cached);
  const [isLoading, setIsLoading] = useState(Boolean(sagaPublicId) && !cached);
  const [error, setError] = useState<string | null>(null);
  const loadGenRef = useRef(0);
  const loadRef = useRef<LoadFn>(async () => {});

  useEffect(() => {
    if (!sagaPublicId || !cacheKey) {
      loadRef.current = async () => {
        setModel(null);
        setError(null);
        setIsLoading(false);
      };
      setModel(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const load: LoadFn = async (opts) => {
      const force = opts?.force === true;
      const fresh = !force && entityCache.hasFresh(cacheKey);
      const existing = entityCache.get<SagaOverviewVm>(cacheKey);
      if (existing && !force) {
        setModel(existing);
        if (fresh) {
          setIsLoading(false);
          return;
        }
      }

      const gen = ++loadGenRef.current;
      try {
        setIsLoading(!existing || force);
        // Keep a prior successful model visible while a background refresh runs.
        if (!existing) setError(null);
        const next = await sagaOverviewService.getOverviewByPublicId(sagaPublicId);
        if (gen !== loadGenRef.current) return;
        entityCache.set(cacheKey, next);
        setModel(next);
        setError(null);
      } catch (err) {
        if (gen !== loadGenRef.current) return;
        // Soft-fail refresh: do not blank hub/map panels that already have a model.
        if (!existing && !entityCache.get<SagaOverviewVm>(cacheKey)) {
          setError(
            err instanceof Error ? err.message : 'Saga-Übersicht konnte nicht geladen werden.',
          );
        }
      } finally {
        if (gen === loadGenRef.current) setIsLoading(false);
      }
    };

    loadRef.current = load;
    void load();

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void load({ force: true });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      loadGenRef.current += 1;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [sagaPublicId, cacheKey]);

  const refresh: LoadFn = async (opts) => {
    await loadRef.current(opts);
  };

  return { model, isLoading, error, refresh };
}
