/**
 * OllamaOrganizePanel — Settings → AI → Organize: LLM-Provider-Liste.
 * Suche + Provider-Karte + Edit-Modal (shared AiProviderListUx).
 * Location: src/app/profile/OllamaOrganizePanel.tsx
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { OllamaSettingsView } from '../../domains/ai-providers';
import { ollamaSettingsService } from '../../infrastructure/ai/ollama-settings-service';
import {
  ProviderChip,
  ProviderListCard,
  ProviderListLoading,
  ProviderListSearch,
  ProviderListShell,
  type ProviderListCardMeta,
} from './AiProviderListUx';
import { useProviderListSearch } from './useProviderListSearch';
import { OllamaOrganizeEditDialog } from './OllamaOrganizeEditDialog';
import { toast } from 'sonner';

interface OrganizeProviderRow {
  id: string;
  displayName: string;
  configured: boolean;
  modeLabel: string;
  meta: ProviderListCardMeta[];
  searchable: string;
}

function buildOllamaRow(settings: OllamaSettingsView): OrganizeProviderRow {
  const modeLabel = settings.useCloud ? 'Cloud' : 'Lokal';
  const model = settings.model.trim() || null;
  const keyHint = settings.hasApiKey ? settings.keyHint : null;
  const endpoint = settings.baseUrl.trim() || '—';
  return {
    id: 'ollama',
    displayName: 'Ollama',
    configured: settings.source === 'user',
    modeLabel,
    meta: [
      { label: 'Endpoint', value: endpoint },
      { label: 'Modell', value: model, empty: 'Kein Modell gewählt' },
      {
        label: 'API-Key',
        value: keyHint,
        empty: modeLabel === 'Cloud' ? 'Fehlt' : 'Optional / keiner',
      },
    ],
    searchable: [
      'ollama',
      'llm',
      modeLabel,
      endpoint,
      model ?? '',
      keyHint ?? '',
      settings.source === 'user' ? 'verbunden' : 'nicht konfiguriert',
      'character-lore',
      'session-recap',
      'ai-gm',
    ]
      .filter(Boolean)
      .join(' '),
  };
}

export function OllamaOrganizePanel() {
  const [settings, setSettings] = useState<OllamaSettingsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
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
        const next = await ollamaSettingsService.get();
        if (!cancelled && mounted.current) setSettings(next);
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : 'Ollama-Einstellungen konnten nicht geladen werden.',
          );
        }
      } finally {
        if (!cancelled && mounted.current) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const providers = useMemo(
    () => (settings ? [buildOllamaRow(settings)] : []),
    [settings],
  );
  const { query, setQuery, filtered } = useProviderListSearch(providers);

  if (loading) {
    return <ProviderListLoading />;
  }

  if (!settings) {
    return (
      <p className="text-sm text-muted-foreground" data-ollama-organize-error>
        Ollama-Einstellungen konnten nicht geladen werden. Bitte später erneut
        versuchen oder erneut anmelden.
      </p>
    );
  }

  return (
    <div className="space-y-3" data-ollama-organize-panel>
      <ProviderListSearch
        id="organize-provider-search"
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
            chips={<ProviderChip>{row.modeLabel}</ProviderChip>}
            meta={row.meta}
            onEdit={() => setEditOpen(true)}
          />
        ))}
      </ProviderListShell>

      <OllamaOrganizeEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={settings}
        onSaved={(next) => setSettings(next)}
      />
    </div>
  );
}
