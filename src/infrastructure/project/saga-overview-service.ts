/**
 * saga-overview-service — Host HTTP for saga hub overview (#570).
 * Location: src/infrastructure/project/saga-overview-service.ts
 *
 * CUT-20: host project HTTP only — no Supabase RPC.
 */
import {
  assertSagaOverviewAudienceSafe,
  parseSagaOverview,
  type SagaOverviewVm,
} from '../../domains/project/contracts/saga-overview';
import {
  fetchHostSagaOverview,
  isHostLibraryEnabled,
} from '../host/host-project-http';

class SagaOverviewService {
  async getOverviewByPublicId(sagaPublicId: string): Promise<SagaOverviewVm> {
    if (!isHostLibraryEnabled()) {
      throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
    }
    const publicId = sagaPublicId.trim().toUpperCase();
    if (!publicId) {
      throw new Error('Saga-ID fehlt');
    }

    const data = await fetchHostSagaOverview(publicId);
    if (data == null) throw new Error('Saga-Übersicht leer');
    const vm = parseSagaOverview(data);
    assertSagaOverviewAudienceSafe(vm);
    return vm;
  }
}

export const sagaOverviewService = new SagaOverviewService();
