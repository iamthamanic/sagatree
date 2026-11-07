/**
 * session-recap-ai-service — Host session-recap generate + summary save (#573 / CUT-14 / CUT-20).
 * Location: src/infrastructure/session/session-recap-ai-service.ts
 *
 * CUT-20: host-only via POST/PUT `/api/v1/sessions/:id/recap/*` (no Edge/RPC dual-path).
 */
import {
  generateHostSessionRecapDraft,
  saveHostSessionRecapSummary,
} from '../host/host-session-http';

export type EpisodeSummaryStatus = 'none' | 'draft' | 'approved';

export type SessionRecapAiGenerateResult = {
  readonly summaryText: string;
  readonly summaryStatus: EpisodeSummaryStatus;
  readonly provider: string;
  readonly model: string;
};

class SessionRecapAiService {
  async generateDraft(sessionId: string): Promise<SessionRecapAiGenerateResult> {
    const response = await generateHostSessionRecapDraft(sessionId);
    if (response.status !== 'ok') {
      throw new Error(response.message);
    }
    return {
      summaryText: response.summaryText,
      summaryStatus: response.summaryStatus === 'approved' ? 'approved' : 'draft',
      provider: response.provider,
      model: response.model,
    };
  }

  async saveSummary(
    sessionId: string,
    summaryText: string,
    status: 'draft' | 'approved',
  ): Promise<{ summaryText: string | null; summaryStatus: EpisodeSummaryStatus }> {
    const saved = await saveHostSessionRecapSummary(sessionId, summaryText, status);
    return {
      summaryText:
        typeof saved.summaryText === 'string' ? saved.summaryText : summaryText,
      summaryStatus:
        saved.summaryStatus === 'approved'
          ? 'approved'
          : saved.summaryStatus === 'draft'
            ? 'draft'
            : status,
    };
  }
}

export const sessionRecapAiService = new SessionRecapAiService();
