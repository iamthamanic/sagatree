/**
 * useProviderListSearch — Volltextsuche über Provider-Zeilen (Settings AI Tabs).
 * Location: src/app/profile/useProviderListSearch.ts
 */
import { useMemo, useState } from 'react';

export interface SearchableProviderRow {
  searchable: string;
}

/** Token-AND match: every whitespace-separated token must appear in haystack. */
export function matchesProviderQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  const hay = haystack.toLowerCase();
  return tokens.every((token) => hay.includes(token));
}

export function useProviderListSearch<T extends SearchableProviderRow>(items: T[]) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => items.filter((row) => matchesProviderQuery(row.searchable, query)),
    [items, query],
  );
  return { query, setQuery, filtered };
}
