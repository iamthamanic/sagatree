/**
 * AiProviderCredentialsPanel — Settings AI BYOK list filtered by modality.
 * Same list/search/edit-modal UX as Organize (shared AiProviderListUx).
 * Location: src/app/profile/AiProviderCredentialsPanel.tsx
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  formatProviderAddedAt,
  settingsAiTabToModality,
  type AiProviderCredentialView,
} from '../../domains/ai-providers';
import { aiProviderCredentialsService } from '../../infrastructure/ai/ai-provider-credentials-service';
import {
  ProviderListCard,
  ProviderListLoading,
  ProviderListSearch,
  ProviderListShell,
  type ProviderListCardMeta,
} from './AiProviderListUx';
import { AiProviderCredentialsEditDialog } from './AiProviderCredentialsEditDialog';
import { useProviderListSearch } from './useProviderListSearch';
import { toast } from 'sonner';

type AiSubTab = 'bild' | '3d' | 'video' | 'audio';

interface AiProviderCredentialsPanelProps {
  tab: AiSubTab;
}

interface CredentialListRow {
  id: string;
  displayName: string;
  configured: boolean;
  meta: ProviderListCardMeta[];
  searchable: string;
  provider: AiProviderCredentialView;
}

function buildCredentialRow(provider: AiProviderCredentialView): CredentialListRow {
  const credits =
    typeof provider.meta.credits === 'number'
      ? provider.meta.credits.toLocaleString('de-DE')
      : null;
  const added = formatProviderAddedAt(provider.addedAt);
  const meta: ProviderListCardMeta[] = [
    {
      label: 'API-Key',
      value: provider.keyHint,
      empty: 'Nicht hinterlegt',
    },
    {
      label: 'Credits',
      value: credits,
      empty: '—',
    },
    {
      label: 'Seit',
      value: added,
      empty: '—',
    },
  ];
  return {
    id: provider.providerId,
    displayName: provider.displayName,
    configured: provider.configured,
    meta,
    searchable: [
      provider.providerId,
      provider.displayName,
      provider.keyHint ?? '',
      credits ?? '',
      added ?? '',
      provider.configured ? 'verbunden' : 'nicht konfiguriert',
      provider.status ?? '',
      ...provider.modalities,
    ]
      .filter(Boolean)
      .join(' '),
    provider,
  };
}

export function AiProviderCredentialsPanel({ tab }: AiProviderCredentialsPanelProps) {
  const modality = settingsAiTabToModality(tab);
  const [providers, setProviders] = useState<AiProviderCredentialView[]>([]);
  const [loading, setLoading] = useState(true);
  const [editProviderId, setEditProviderId] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const list = await aiProviderCredentialsService.list(modality);
        if (!cancelled && mounted.current) setProviders(list);
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : 'Provider konnten nicht geladen werden.',
          );
          if (mounted.current) setProviders([]);
        }
      } finally {
        if (!cancelled && mounted.current) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modality]);

  const rows = useMemo(() => providers.map(buildCredentialRow), [providers]);
  const { query, setQuery, filtered } = useProviderListSearch(rows);
  const editProvider = providers.find((p) => p.providerId === editProviderId) ?? null;

  if (loading) {
    return <ProviderListLoading />;
  }

  if (providers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-ai-providers-empty>
        Noch keine Provider für diesen Bereich. Später hier verbindbar.
      </p>
    );
  }

  return (
    <div className="space-y-3" data-ai-providers-panel data-ai-modality={modality}>
      <ProviderListSearch
        id={`${tab}-provider-search`}
        value={query}
        onChange={setQuery}
      />

      <ProviderListShell empty={filtered.length === 0}>
        {filtered.map((row) => (
          <ProviderListCard
            key={row.id}
            id={row.id}
            displayName={row.displayName}
            configured={row.configured}
            meta={row.meta}
            onEdit={() => setEditProviderId(row.id)}
          />
        ))}
      </ProviderListShell>

      <AiProviderCredentialsEditDialog
        open={editProviderId !== null}
        onOpenChange={(open) => {
          if (!open) setEditProviderId(null);
        }}
        provider={editProvider}
        onSaved={(updated) => {
          setProviders((prev) =>
            prev.map((p) => (p.providerId === updated.providerId ? updated : p)),
          );
        }}
      />
    </div>
  );
}
