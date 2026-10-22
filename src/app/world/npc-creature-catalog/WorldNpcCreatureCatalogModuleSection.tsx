/**
 * WorldNpcCreatureCatalogModuleSection — world-editor UI for `npc-creature-catalog`
 * (#199): pack toggles, search-add includes/excludes, personal switch, live count.
 * Distinct from WorldNpcCreatureCatalogSection (world-owned definition authoring).
 * Location: src/app/world/npc-creature-catalog/WorldNpcCreatureCatalogModuleSection.tsx
 */
import {
  PawPrint,
  Plus,
  X
} from '@phosphor-icons/react';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/ui/card';
import { Checkbox } from '../../../shared/ui/checkbox';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import { Switch } from '../../../shared/ui/switch';
import { useNpcCreatureWorldAvailability } from './useNpcCreatureWorldAvailability';
import type { WorldModuleConfigMap } from '../../../domains/world/contracts/world.types';

export interface WorldNpcCreatureCatalogModuleSectionProps {
  modules: WorldModuleConfigMap;
  onModulesChange: (
    next:
      | WorldModuleConfigMap
      | ((current: WorldModuleConfigMap) => WorldModuleConfigMap),
  ) => void;
  worldProfileId?: string | null;
  catalogRevision?: number;
}

export function WorldNpcCreatureCatalogModuleSection({
  modules,
  onModulesChange,
  worldProfileId,
  catalogRevision,
}: WorldNpcCreatureCatalogModuleSectionProps) {
  const {
    basePacks,
    contextPacks,
    includes,
    excludes,
    allowPersonalDefinitions,
    effectiveCount,
    worldDefsLoading,
    worldDefsError,
    searchQuery,
    setSearchQuery,
    searchResults,
    togglePack,
    addInclude,
    removeInclude,
    addExclude,
    removeExclude,
    setAllowPersonalDefinitions,
    diagnosis,
  } = useNpcCreatureWorldAvailability({
    modules,
    onModulesChange,
    worldProfileId,
    catalogRevision,
  });

  return (
    <Card data-testid="world-npc-creature-catalog-module" data-world-npc-creature-catalog-module>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <PawPrint className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">NPCs & Kreaturen</CardTitle>
            </div>
            <CardDescription className="mt-1">
              Basis- und Kontext-Packs sowie einzelne Ausnahmen für diese Welt. Core-Archetypen
              bleiben immer verfügbar. Definitionen werden referenziert, nicht kopiert.
            </CardDescription>
          </div>
          <Badge variant="outline" className="w-fit">
            {effectiveCount} Figuren in dieser Welt verfügbar
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {worldDefsLoading && (
          <p className="text-sm text-muted-foreground">Welt-Figuren werden geladen…</p>
        )}
        {worldDefsError && (
          <p className="text-sm text-destructive">{worldDefsError}</p>
        )}

        {!worldDefsLoading &&
          basePacks.every((pack) => !pack.enabled) &&
          contextPacks.every((pack) => !pack.enabled) &&
          includes.length === 0 && (
          <p className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
            Noch keine Packs aktiv. Aktiviere z. B. Fantasy Basics oder Tiere, oder füge einzelne
            Figuren hinzu. Core-Archetypen bleiben immer verfügbar.
          </p>
        )}

        <div className="space-y-3">
          <h4 className="text-sm font-medium">Basis-Packs</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {basePacks.map((pack) => (
              <label
                key={pack.id}
                htmlFor={`npc-creature-catalog-pack-${pack.id}`}
                className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-2"
              >
                <Checkbox
                  id={`npc-creature-catalog-pack-${pack.id}`}
                  checked={pack.enabled}
                  onCheckedChange={(checked) => togglePack(pack.id, checked === true)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium">{pack.label}</span>
                  <span className="block text-xs text-muted-foreground">{pack.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium">Kontext-Packs</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {contextPacks.map((pack) => (
              <label
                key={pack.id}
                htmlFor={`npc-creature-catalog-pack-${pack.id}`}
                className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-2"
              >
                <Checkbox
                  id={`npc-creature-catalog-pack-${pack.id}`}
                  checked={pack.enabled}
                  onCheckedChange={(checked) => togglePack(pack.id, checked === true)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium">
                    {pack.label}
                    {pack.unknown ? (
                      <Badge variant="secondary" className="ml-2">
                        Unbekannt
                      </Badge>
                    ) : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">{pack.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label htmlFor="npc-creature-catalog-search">Einzelne Figur hinzufügen</Label>
          <Input
            id="npc-creature-catalog-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Name suchen, z. B. Wolf"
            aria-label="Figur suchen zum Hinzufügen oder Ausschließen"
          />
          {searchResults.length > 0 && (
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {searchResults.map((definition) => (
                <li
                  key={definition.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40"
                >
                  <span className="text-sm">
                    <span className="font-medium">{definition.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{definition.id}</span>
                  </span>
                  <span className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-9"
                      onClick={() => addInclude(definition.id)}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Hinzufügen
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="min-h-9"
                      onClick={() => addExclude(definition.id)}
                    >
                      Ausschließen
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {searchQuery.trim().length > 0 && searchResults.length === 0 && (
            <p className="text-sm text-muted-foreground">Keine Treffer.</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Explizit hinzugefügt</h4>
            {includes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine einzelnen Includes.</p>
            ) : (
              <ul className="space-y-1">
                {includes.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5"
                  >
                    <span className="text-sm">
                      {entry.label}
                      {entry.unknown ? (
                        <Badge variant="secondary" className="ml-2">
                          Unbekannt
                        </Badge>
                      ) : null}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`${entry.label} entfernen`}
                      onClick={() => removeInclude(entry.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Explizit ausgeschlossen</h4>
            {excludes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine einzelnen Excludes.</p>
            ) : (
              <ul className="space-y-1">
                {excludes.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5"
                  >
                    <span className="text-sm">
                      {entry.label}
                      {entry.unknown ? (
                        <Badge variant="secondary" className="ml-2">
                          Unbekannt
                        </Badge>
                      ) : null}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Ausschluss ${entry.label} entfernen`}
                      onClick={() => removeExclude(entry.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
          <div>
            <Label htmlFor="npc-creature-catalog-allow-personal" className="text-sm font-medium">
              Eigene Figuren der Spieler erlauben
            </Label>
            <p className="text-xs text-muted-foreground">
              Steuert nur neue Katalog-Angebote — bestehende Definitionen bleiben erhalten.
            </p>
          </div>
          <Switch
            id="npc-creature-catalog-allow-personal"
            checked={allowPersonalDefinitions}
            onCheckedChange={(checked) => setAllowPersonalDefinitions(checked)}
          />
        </div>

        {(diagnosis.unknownPackIds.length > 0 ||
          diagnosis.unknownIncludedDefinitionIds.length > 0 ||
          diagnosis.unknownExcludedDefinitionIds.length > 0) && (
          <p className="text-xs text-muted-foreground">
            Unbekannte IDs bleiben gespeichert (Abwärtskompatibilität).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
