/**
 * Item thumbnail prompt builder — Deno Edge copy of domain contract (#140).
 * Keep in sync with src/domains/items/assets.ts buildItemThumbnailPrompt.
 * Location: supabase/functions/_shared/item-thumbnail-prompt.ts
 */

export interface ItemThumbnailPromptInput {
  name: string;
  description: string;
  setting?: string;
  kindKey?: string;
  userExtra?: string;
}

const ART_DIRECTION =
  'single centered inventory item illustration, isolated object, clean quiet neutral background, no text, no logos, no watermarks, no brand or artist style names';

const MAX_PROMPT = 600;
const MAX_USER_EXTRA = 120;

export function sanitizePromptPart(value: string, max: number): string {
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function buildItemThumbnailPrompt(input: ItemThumbnailPromptInput): string {
  const name = sanitizePromptPart(input.name, 80) || 'item';
  const description = sanitizePromptPart(input.description, 220);
  const setting = sanitizePromptPart(input.setting ?? '', 60);
  const kind = sanitizePromptPart(input.kindKey ?? '', 40);
  const extra = sanitizePromptPart(input.userExtra ?? '', MAX_USER_EXTRA);

  const parts = [
    `Inventory icon of ${name}`,
    description ? `: ${description}` : '',
    kind ? `. Kind: ${kind}` : '',
    setting ? `. Setting: ${setting}` : '',
    extra ? `. Details: ${extra}` : '',
    `. Style: ${ART_DIRECTION}.`,
  ];

  return parts.join('').slice(0, MAX_PROMPT);
}

export function assertSafeUserExtra(raw: unknown): string {
  if (raw === undefined || raw === null || raw === '') return '';
  if (typeof raw !== 'string') throw new Error('userExtra must be a string');
  const cleaned = sanitizePromptPart(raw, MAX_USER_EXTRA);
  if (cleaned.length > MAX_USER_EXTRA) throw new Error('userExtra too long');
  return cleaned;
}
