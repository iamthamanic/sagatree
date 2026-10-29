/**
 * saga-overview-service — Supabase adapter for get_saga_overview RPC (#570).
 * Location: src/infrastructure/project/saga-overview-service.ts
 *
 * Hides RPC transport; maps JSON → SagaOverviewVm via domain parse.
 * Does not SELECT sensitive project/session columns directly (RPC only).
 *
 * Dual-path (MIG-308): production remains Supabase RPC. Host ports are bound via
 * `createHostProjectAdapter` for tests / future cutover (no accidental cutover —
 * VITE host flags alone do not redirect this facade).
 */
import { supabase } from '../../lib/supabase';
import { raceWithTimeoutReject, SUPABASE_QUERY_TIMEOUT_MS } from '../../lib/networkTimeout';
import {
  assertSagaOverviewAudienceSafe,
  parseSagaOverview,
  type SagaOverviewVm,
} from '../../domains/project/contracts/saga-overview';

/** Hub RPC aggregates membership + episodes + world — allow headroom over REST default. */
const SAGA_OVERVIEW_TIMEOUT_MS = Math.max(SUPABASE_QUERY_TIMEOUT_MS, 12_000);

class SagaOverviewService {
  async getOverviewByPublicId(sagaPublicId: string): Promise<SagaOverviewVm> {
    const publicId = sagaPublicId.trim().toUpperCase();
    if (!publicId) {
      throw new Error('Saga-ID fehlt');
    }

    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('get_saga_overview', { p_public_id: publicId }),
      SAGA_OVERVIEW_TIMEOUT_MS,
      'Saga-Übersicht Zeitüberschreitung',
    );

    if (error) {
      const message = error.message || 'Saga-Übersicht fehlgeschlagen';
      if (/not authenticated|forbidden|42501/i.test(message)) {
        throw new Error('Kein Zugriff auf diese Saga');
      }
      if (/not found|P0002/i.test(message)) {
        throw new Error('Saga nicht gefunden');
      }
      throw new Error(message);
    }

    if (data == null) {
      throw new Error('Saga-Übersicht leer');
    }

    const vm = parseSagaOverview(data);
    assertSagaOverviewAudienceSafe(vm);
    return vm;
  }
}

export const sagaOverviewService = new SagaOverviewService();
