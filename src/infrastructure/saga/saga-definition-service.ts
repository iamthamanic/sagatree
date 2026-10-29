/**
 * saga-definition-service — Load/save/publish saga definitions via RPC (#574 / #575).
 * Location: src/infrastructure/saga/saga-definition-service.ts
 *
 * Dual-path (MIG-310): production remains Supabase RPCs. Host ports are
 * bound via `createHostSagaAdapter` for tests / future cutover (no accidental
 * cutover — VITE host flags alone do not redirect this facade).
 */
import { supabase } from '../../lib/supabase';
import { raceWithTimeoutReject, SUPABASE_QUERY_TIMEOUT_MS } from '../../lib/networkTimeout';
import {
  draftToPayload,
  parseSagaDefinitionEditor,
  parseSagaDefinitionVersion,
  type SagaDefinitionDraft,
  type SagaDefinitionEditorVm,
  type SagaDefinitionVersionVm,
} from '../../domains/saga/contracts/saga-definition';

class SagaDefinitionService {
  async getVersionById(versionId: string): Promise<SagaDefinitionVersionVm> {
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('get_saga_definition_version', { p_version_id: versionId }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Saga-Definition Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Saga-Definition konnte nicht geladen werden');
    }
    return parseSagaDefinitionVersion(data);
  }

  async getNativeBySlug(slug: string): Promise<SagaDefinitionVersionVm> {
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('get_native_saga_definition_by_slug', { p_slug: slug }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Native Saga Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Native Saga konnte nicht geladen werden');
    }
    return parseSagaDefinitionVersion(data);
  }

  async getEditor(sagaId: string): Promise<SagaDefinitionEditorVm> {
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('get_saga_definition_editor', { p_saga_id: sagaId }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Saga-Editor Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Saga-Editor konnte nicht geladen werden');
    }
    return parseSagaDefinitionEditor(data);
  }

  async saveDraft(input: {
    readonly sagaId: string;
    readonly draft: SagaDefinitionDraft;
    readonly expectedRevision: number;
  }): Promise<{ readonly revision: number; readonly versionId: string }> {
    const payload = draftToPayload(input.draft);
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('save_saga_definition_draft', {
        p_saga_id: input.sagaId,
        p_payload: payload,
        p_expected_revision: input.expectedRevision,
      }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Speichern Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Entwurf konnte nicht gespeichert werden');
    }
    if (!data || typeof data !== 'object') {
      throw new Error('Ungültige Speicher-Antwort');
    }
    const row = data as { revision?: number; versionId?: string };
    if (typeof row.revision !== 'number' || typeof row.versionId !== 'string') {
      throw new Error('Speicher-Antwort unvollständig');
    }
    return { revision: row.revision, versionId: row.versionId };
  }

  async publishVersion(input: {
    readonly sagaId: string;
    readonly expectedRevision: number;
  }): Promise<{ readonly versionId: string; readonly versionLabel: string }> {
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('publish_saga_definition_version', {
        p_saga_id: input.sagaId,
        p_expected_revision: input.expectedRevision,
      }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Veröffentlichen Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Fassung konnte nicht veröffentlicht werden');
    }
    if (!data || typeof data !== 'object') {
      throw new Error('Ungültige Publish-Antwort');
    }
    const row = data as { versionId?: string; versionLabel?: string };
    if (typeof row.versionId !== 'string') {
      throw new Error('Publish ohne versionId');
    }
    return {
      versionId: row.versionId,
      versionLabel: typeof row.versionLabel === 'string' ? row.versionLabel : 'v?',
    };
  }

  async createCopyFromNative(sourceSagaId: string): Promise<{ readonly sagaId: string }> {
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('copy_native_saga_definition', { p_source_saga_id: sourceSagaId }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Kopie Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Kopie konnte nicht erstellt werden');
    }
    if (!data || typeof data !== 'object') {
      throw new Error('Ungültige Kopie-Antwort');
    }
    const row = data as { sagaId?: string };
    if (typeof row.sagaId !== 'string') {
      throw new Error('Kopie ohne sagaId');
    }
    return { sagaId: row.sagaId };
  }

  async createUserSaga(input: {
    readonly title: string;
    readonly blurb?: string;
  }): Promise<{ readonly sagaId: string }> {
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('create_user_saga_definition', {
        p_title: input.title,
        p_blurb: input.blurb ?? '',
      }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Saga anlegen Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Saga konnte nicht angelegt werden');
    }
    if (!data || typeof data !== 'object') {
      throw new Error('Ungültige Create-Antwort');
    }
    const row = data as { sagaId?: string };
    if (typeof row.sagaId !== 'string') {
      throw new Error('Create ohne sagaId');
    }
    return { sagaId: row.sagaId };
  }

  async createProjectFromVersion(input: {
    readonly sagaId: string;
    readonly versionId: string;
    readonly name?: string;
  }): Promise<{ readonly id: string; readonly publicId: string }> {
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('create_project_from_saga_version', {
        p_saga_id: input.sagaId,
        p_version_id: input.versionId,
        p_name: input.name ?? null,
      }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Neue Gruppe Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Gruppe konnte nicht erstellt werden');
    }
    if (!data || typeof data !== 'object') {
      throw new Error('Ungültige Projekt-Antwort');
    }
    const row = data as { id?: string; public_id?: string };
    if (typeof row.id !== 'string') {
      throw new Error('Projekt ohne ID');
    }
    return {
      id: row.id,
      publicId: typeof row.public_id === 'string' ? row.public_id : '',
    };
  }

  /**
   * Clone a GM playthrough. `fresh` = version start; `with_progress` = copy adventure_runtime.
   */
  async duplicatePlaythrough(input: {
    readonly projectId: string;
    readonly mode: 'fresh' | 'with_progress';
  }): Promise<{ readonly id: string; readonly publicId: string }> {
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('duplicate_saga_playthrough', {
        p_project_id: input.projectId,
        p_mode: input.mode,
      }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Duplizieren Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Saga konnte nicht dupliziert werden');
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== 'object') {
      throw new Error('Ungültige Duplikat-Antwort');
    }
    const parsed = row as { id?: string; public_id?: string };
    if (typeof parsed.id !== 'string') {
      throw new Error('Duplikat ohne ID');
    }
    return {
      id: parsed.id,
      publicId: typeof parsed.public_id === 'string' ? parsed.public_id : '',
    };
  }
}

export const sagaDefinitionService = new SagaDefinitionService();
