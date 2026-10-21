/**
 * AiProviderListUx — shared Settings AI provider list chrome (search, card, meta).
 * Used by Organize (Ollama) and Bild/3D/Video/Audio BYOK tabs.
 * Location: src/app/profile/AiProviderListUx.tsx
 */
import type { ReactNode } from 'react';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Loader2, Pencil, Search } from 'lucide-react';

export function ProviderListLoading({ label = 'Provider werden geladen…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground" data-ai-providers-loading>
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ProviderListSearch({
  id,
  value,
  onChange,
  'data-testid': dataTestId,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  'data-testid'?: string;
}) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        id={id}
        name={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Provider suchen…"
        autoComplete="off"
        spellCheck={false}
        className="min-h-11 pl-10"
        aria-label="Provider volltextsuche"
        data-ai-provider-search
        data-testid={dataTestId}
      />
    </div>
  );
}

export function ProviderMetaRow({
  label,
  value,
  empty = '—',
}: {
  label: string;
  value: string | null;
  empty?: string;
}) {
  const display = value?.trim() ? value : empty;
  return (
    <div className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-x-2 gap-y-0.5 text-xs sm:grid-cols-[5rem_minmax(0,1fr)] sm:text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-foreground" title={display}>
        {display}
      </dd>
    </div>
  );
}

export function ProviderStatusBadge({ configured }: { configured: boolean }) {
  return (
    <span
      className={
        configured
          ? 'inline-flex items-center rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary'
          : 'inline-flex items-center rounded-md border border-foreground/15 px-2 py-0.5 text-xs font-medium text-muted-foreground'
      }
      data-ai-provider-status={configured ? 'connected' : 'empty'}
    >
      {configured ? 'Verbunden' : 'Nicht konfiguriert'}
    </span>
  );
}

export function ProviderChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-foreground/10 px-2 py-0.5 text-xs text-muted-foreground">
      {children}
    </span>
  );
}

export interface ProviderListCardMeta {
  label: string;
  value: string | null;
  empty?: string;
}

export function ProviderListCard({
  id,
  displayName,
  configured,
  chips,
  meta,
  onEdit,
}: {
  id: string;
  displayName: string;
  configured: boolean;
  chips?: ReactNode;
  meta: ProviderListCardMeta[];
  onEdit: () => void;
}) {
  return (
    <li
      className="rounded-lg border border-foreground/10 bg-muted/20 p-3 sm:p-4"
      data-ai-provider={id}
      data-ai-provider-configured={configured ? 'true' : 'false'}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium text-pretty md:text-base">{displayName}</h3>
            <ProviderStatusBadge configured={configured} />
            {chips}
          </div>
          <dl className="space-y-1.5" data-ai-provider-meta>
            {meta.map((row) => (
              <ProviderMetaRow
                key={row.label}
                label={row.label}
                value={row.value}
                empty={row.empty}
              />
            ))}
          </dl>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 shrink-0 gap-1.5 px-3"
          onClick={onEdit}
          data-ai-provider-edit={id}
          aria-label={`${displayName} bearbeiten`}
        >
          <Pencil className="size-4" aria-hidden="true" />
          Bearbeiten
        </Button>
      </div>
    </li>
  );
}

export function ProviderListShell({
  children,
  empty,
  emptyMessage = 'Kein Provider passt zur Suche.',
  listTestId,
}: {
  children: ReactNode;
  empty: boolean;
  emptyMessage?: string;
  listTestId?: string;
}) {
  if (empty) {
    return (
      <p className="text-sm text-muted-foreground" data-ai-provider-empty>
        {emptyMessage}
      </p>
    );
  }
  return (
    <ul className="space-y-2" data-ai-provider-list data-testid={listTestId}>
      {children}
    </ul>
  );
}
