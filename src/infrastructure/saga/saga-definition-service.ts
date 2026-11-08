/**
 * saga-definition-service — Saga definitions via host HTTP (#574 / #575, CUT-20).
 * Location: src/infrastructure/saga/saga-definition-service.ts
 */
import {
  draftToPayload,
  parseSagaDefinitionEditor,
  parseSagaDefinitionVersion,
  type SagaDefinitionDraft,
  type SagaDefinitionEditorVm,
  type SagaDefinitionVersionVm,
} from '../../domains/saga/contracts/saga-definition';
import {
  copyHostNativeSagaDefinition,
  createHostProjectFromSagaVersion,
  createHostUserSagaDefinition,
  duplicateHostSagaPlaythrough,
  getHostNativeSagaDefinitionBySlug,
  getHostSagaDefinitionEditor,
  getHostSagaDefinitionVersion,
  isHostLibraryEnabled,
  publishHostSagaDefinitionVersion,
  saveHostSagaDefinitionDraft,
} from '../host/host-saga-definition-http';

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

class SagaDefinitionService {
  async getVersionById(versionId: string): Promise<SagaDefinitionVersionVm> {
    assertHost();
    return parseSagaDefinitionVersion(await getHostSagaDefinitionVersion(versionId));
  }

  async getNativeBySlug(slug: string): Promise<SagaDefinitionVersionVm> {
    assertHost();
    return parseSagaDefinitionVersion(await getHostNativeSagaDefinitionBySlug(slug));
  }

  async getEditor(sagaId: string): Promise<SagaDefinitionEditorVm> {
    assertHost();
    return parseSagaDefinitionEditor(await getHostSagaDefinitionEditor(sagaId));
  }

  async saveDraft(input: {
    readonly sagaId: string;
    readonly draft: SagaDefinitionDraft;
    readonly expectedRevision: number;
  }): Promise<{ readonly revision: number; readonly versionId: string }> {
    assertHost();
    const payload = draftToPayload(input.draft);
    return saveHostSagaDefinitionDraft({
      sagaId: input.sagaId,
      payload: payload as unknown as Record<string, unknown>,
      expectedRevision: input.expectedRevision,
    });
  }

  async publishVersion(input: {
    readonly sagaId: string;
    readonly expectedRevision: number;
  }): Promise<{ readonly versionId: string; readonly versionLabel: string }> {
    assertHost();
    return publishHostSagaDefinitionVersion(input);
  }

  async createCopyFromNative(sourceSagaId: string): Promise<{ readonly sagaId: string }> {
    assertHost();
    return copyHostNativeSagaDefinition(sourceSagaId);
  }

  async createUserSaga(input: {
    readonly title: string;
    readonly blurb?: string;
  }): Promise<{ readonly sagaId: string }> {
    assertHost();
    return createHostUserSagaDefinition(input);
  }

  async createProjectFromVersion(input: {
    readonly sagaId: string;
    readonly versionId: string;
    readonly name?: string;
  }): Promise<{ readonly id: string; readonly publicId: string }> {
    assertHost();
    return createHostProjectFromSagaVersion(input);
  }

  async duplicatePlaythrough(input: {
    readonly projectId: string;
    readonly mode: 'fresh' | 'with_progress';
  }): Promise<{ readonly id: string; readonly publicId: string }> {
    assertHost();
    return duplicateHostSagaPlaythrough(input);
  }
}

export const sagaDefinitionService = new SagaDefinitionService();
