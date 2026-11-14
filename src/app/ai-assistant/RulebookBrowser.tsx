/**
 * RulebookBrowser — offline TOC / search / section reader for Aiberto Phase A.
 * Location: src/app/ai-assistant/RulebookBrowser.tsx
 *
 * Uses domains/rulebook only — no Host, no LLM, no chat.
 */
import { useMemo, useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import {
  getRulebookSection,
  getSagaTreeCoreRulebookIndex,
  searchRulebook,
  type RulebookNormativity,
  type RulebookSection,
} from '../../domains/rulebook';
import { Input } from '../../shared/ui/input';
import { ScrollArea } from '../../shared/ui/scroll-area';
import { Badge } from '../../shared/ui/badge';

function normativityLabel(value: RulebookNormativity): string {
  switch (value) {
    case 'binding-playtest':
      return 'Verbindlich (Playtest)';
    case 'validation':
      return 'Validierung';
    case 'release-criteria':
      return 'Freigabekriterien';
    case 'informational':
      return 'Informativ';
    default:
      return value;
  }
}

/** Browsable TOC: numbered sections at all depths (empty H2 parents still list children). */
function tocSections(sections: readonly RulebookSection[]): RulebookSection[] {
  return sections.filter((section) => Boolean(section.number));
}

function initialSectionId(sections: readonly RulebookSection[]): string | null {
  const withBody = sections.find(
    (section) => Boolean(section.number) && section.bodyMarkdown.trim().length > 0,
  );
  if (withBody) return withBody.id;
  const numbered = sections.find((section) => Boolean(section.number));
  return numbered?.id ?? sections[0]?.id ?? null;
}

export function RulebookBrowser() {
  const index = useMemo(() => getSagaTreeCoreRulebookIndex(), []);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    initialSectionId(index.sections),
  );

  const trimmed = query.trim();
  const hits = useMemo(
    () => (trimmed ? searchRulebook(index, trimmed, { limit: 30 }) : []),
    [index, trimmed],
  );
  const toc = useMemo(() => tocSections(index.sections), [index.sections]);
  const selected = selectedId ? getRulebookSection(index, selectedId) : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3" data-aiberto-rulebook>
      <div className="shrink-0 space-y-2">
        <label className="sr-only" htmlFor="aiberto-rulebook-search">
          Regelbuch durchsuchen
        </label>
        <div className="relative">
          <MagnifyingGlass
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            size={16}
            weight="regular"
            aria-hidden
          />
          <Input
            id="aiberto-rulebook-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Suche in den Core-Regeln…"
            className="h-11 pl-9"
            autoComplete="off"
            data-aiberto-search
          />
        </div>
        <p className="text-xs text-muted-foreground" data-aiberto-version>
          {index.manifest.rulesetId} · Schema {index.manifest.schemaVersion} ·{' '}
          <span className="font-mono">{index.manifest.revisionHash.slice(0, 12)}…</span>
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,0.4fr)_minmax(0,0.6fr)] gap-3">
        <ScrollArea className="min-h-0 rounded-lg border border-border">
          <ul className="space-y-0.5 p-2" data-aiberto-toc>
            {trimmed
              ? hits.map((hit) => (
                  <li key={hit.sectionId}>
                    <button
                      type="button"
                      className={`flex min-h-11 w-full flex-col items-start rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
                        selectedId === hit.sectionId
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-accent/10 hover:text-accent'
                      }`}
                      onClick={() => setSelectedId(hit.sectionId)}
                    >
                      <span className="font-medium">
                        {hit.number ? `§${hit.number} ` : ''}
                        {hit.title}
                      </span>
                      <span className="line-clamp-2 text-xs opacity-80">{hit.snippet}</span>
                    </button>
                  </li>
                ))
              : toc.map((section) => {
                  const depth = Math.max(0, section.headingLevel - 2);
                  return (
                    <li key={section.id}>
                      <button
                        type="button"
                        className={`flex min-h-11 w-full items-center rounded-md py-2 pr-3 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
                          selectedId === section.id
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-accent/10 hover:text-accent'
                        }`}
                        style={{ paddingLeft: `${12 + depth * 12}px` }}
                        onClick={() => setSelectedId(section.id)}
                        data-aiberto-toc-level={section.headingLevel}
                      >
                        {section.number ? `§${section.number} ` : ''}
                        {section.title}
                      </button>
                    </li>
                  );
                })}
            {trimmed && hits.length === 0 ? (
              <li className="px-3 py-4 text-sm text-muted-foreground">Keine Treffer.</li>
            ) : null}
          </ul>
        </ScrollArea>

        <ScrollArea className="min-h-0 rounded-lg border border-border" data-aiberto-section>
          {selected ? (
            <article className="space-y-3 p-4">
              <header className="space-y-2">
                <h3 className="text-base font-semibold leading-snug">
                  {selected.number ? `§${selected.number} ` : ''}
                  {selected.title}
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{normativityLabel(selected.normativity)}</Badge>
                  <span className="font-mono text-xs text-muted-foreground">{selected.id}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Quelle: {selected.source.path}:{selected.source.startLine}–
                  {selected.source.endLine}
                </p>
              </header>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                {selected.bodyMarkdown.trim() || '(Kein Abschnittstext.)'}
              </pre>
            </article>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Abschnitt wählen.</p>
          )}
        </ScrollArea>
      </div>

      <p
        className="shrink-0 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground"
        data-aiberto-orc-notice
      >
        SagaTree Core Rules stehen unter der Open RPG Creative License (ORC). Software-Quellcode
        separat unter AGPL-3.0-only — siehe LICENSES.md.
      </p>
    </div>
  );
}
