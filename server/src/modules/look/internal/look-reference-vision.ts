/**
 * Look reference vision provider (CUT-15 / #1150).
 * Location: server/src/modules/look/internal/look-reference-vision.ts
 *
 * Ported from supabase/functions/_shared/look-reference-analysis-provider.ts.
 * Server-only keys; never returns secrets in payloads.
 */

import type { LookRefAnalysisMime } from './look-reference-image.ts';

export type LookRefVisionProviderConfig = {
  readonly baseUrl: string;
  readonly model: string;
  readonly apiKey: string;
};

export type LookRefVisionImagePart = {
  readonly id: string;
  readonly kind: 'style' | 'content';
  readonly mime: LookRefAnalysisMime;
  readonly base64: string;
  readonly weight?: number;
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/** Resolve LOOK_AI_* with CHARACTER_AI_* fallback (legacy Edge parity). */
export function resolveLookRefVisionProviderConfig(
  envGet: (key: string) => string | undefined,
): LookRefVisionProviderConfig | null {
  const baseUrl = (envGet('LOOK_AI_BASE_URL') || envGet('CHARACTER_AI_BASE_URL') || '').trim();
  const model = (envGet('LOOK_AI_MODEL') || envGet('CHARACTER_AI_MODEL') || '').trim();
  const apiKey = (envGet('LOOK_AI_API_KEY') || envGet('CHARACTER_AI_API_KEY') || '').trim();
  if (!baseUrl || !model || !apiKey) return null;
  return {
    baseUrl: trimTrailingSlash(baseUrl),
    model,
    apiKey,
  };
}

export function resolveLookRefRateLimit(envValue: string | undefined): number {
  const configured = Number.parseInt(envValue || '', 10);
  if (Number.isFinite(configured) && configured > 0) return Math.min(configured, 30);
  return 4;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractOpenAiContent(value: unknown): string | null {
  if (!isRecord(value) || !Array.isArray(value.choices) || value.choices.length === 0) {
    return null;
  }
  const choice = value.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message)) return null;
  const content = choice.message.content;
  if (typeof content === 'string') return content.trim() || null;
  return null;
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(candidate.slice(start, end + 1));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function buildSystemPrompt(): string {
  return [
    'You analyze visual references for a SagaTree LookProfile draft.',
    'Return ONLY a JSON object with keys:',
    'displayName (string),',
    'palette { primary, secondary, accent, background } as #RRGGBB,',
    'knobs { characterStylization, characterOutline, lightingWarmth, lightingKey, postFxContrast, postFxSaturation } as integers 0-100,',
    'contentNotes (string, motif/subject only).',
    'Use STYLE images for palette and knobs. CONTENT images inform contentNotes only — never treat content as style.',
    'If no style images are provided, return neutral knobs (around 50) and a neutral gray palette.',
    'Do not include provider names, API keys, or free-form schema extensions.',
  ].join(' ');
}

function buildUserText(images: readonly LookRefVisionImagePart[], displayNameHint?: string): string {
  const lines = images.map((img) => {
    const weight =
      typeof img.weight === 'number' ? ` weight=${img.weight.toFixed(2)}` : '';
    return `- ${img.id}: kind=${img.kind} mime=${img.mime}${weight}`;
  });
  const hint = displayNameHint?.trim()
    ? `Display name hint: ${displayNameHint.trim().slice(0, 80)}`
    : '';
  return [
    'Analyze these references into a SagaTree Look draft JSON.',
    hint,
    'References:',
    ...lines,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Calls an OpenAI-compatible chat/completions vision endpoint.
 * Returns a parsed JSON object or throws — never returns secrets.
 */
export async function analyzeLookReferencesWithVision(
  config: LookRefVisionProviderConfig,
  images: readonly LookRefVisionImagePart[],
  displayNameHint?: string,
): Promise<Record<string, unknown>> {
  const content: Array<Record<string, unknown>> = [
    { type: 'text', text: buildUserText(images, displayNameHint) },
  ];
  for (const img of images) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${img.mime};base64,${img.base64}`,
      },
    });
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) {
    throw new Error(`Vision provider returned ${response.status}`);
  }

  const body: unknown = await response.json();
  const text = extractOpenAiContent(body);
  if (!text) throw new Error('Vision provider returned an invalid response');
  const parsed = extractJsonObject(text);
  if (!parsed) throw new Error('Vision provider returned non-JSON content');
  return parsed;
}
