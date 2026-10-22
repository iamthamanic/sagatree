/**
 * WorldItemCatalogModuleSection — world-editor UI for the `item-catalog` module
 * (#142): base/context pack toggles, search-add includes/excludes, personal
 * switch, and live effective count. Title: „Gegenstände & Ausrüstung“.
 * Distinct from WorldItemCatalogSection (world-scoped definition authoring #112).
 * Location: src/app/world/item-catalog/WorldItemCatalogModuleSection.tsx
 */
import {
  Package,
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
import { useItemWorldAvailability } from './useItemWorldAvailability';
import type { WorldModuleConfigMap } from '../../../domains/world/contracts/world.types';

export interface WorldItemCatalogModuleSectionProps {
  modules: WorldModuleConfigMap;
  onModulesChange: (
    next:
      | WorldModuleConfigMap
      | ((current: WorldModuleConfigMap) => WorldModuleConfigMap),
  ) => void;
  worldProfileId?: string | null;
}

export function WorldItemCatalogModuleSection({
  modules,
  onModulesChange,
  worldProfileId,
}: WorldItemCatalogModuleSectionProps) {
  const {
    basePacks,
    contextPacks,
    includes,
    excludes,
    allowPersonalItems,
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
    setAllowPersonalItems,
    diagnosis,
  } = useItemWorldAvailability({ modules, onModulesChange, worldProfileId });

  return (
    <Card data-testid="world-item-catalog-module" data-world-item-catalog-module>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Gegenstände & Ausrüstung</CardTitle>
            </div>
            <CardDescription className="mt-1">
              Base- und Kontext-Packs sowie einzelne Ausnahmen für diese Welt. Core-Archetypen
              bleiben immer verfügbar. Setting-Tags sind Empfehlungen, keine Sperren.
            </CardDescription>
          </div>
          <Badge variant="outline" className="w-fit">
            {effectiveCount} Gegenstände in dieser Welt verfügbar
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {worldDefsLoading && (
          <p className="text-sm text-muted-foreground">Welt-Gegenstände werden geladen…</p>
        )}
        {worldDefsError && (
          <p className="text-sm text-destructive">{worldDefsError}</p>
        )}

        <div className="space-y-3">
          <h4 className="text-sm font-medium">Basis-Packs</h4>
          <div className="grid gap-2 sm:grid-cols-3">
            {basePacks.map((pack) => (
              <label
                key={pack.id}
                htmlFor={`item-catalog-pack-${pack.id}`}
                className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-2"
              >
                <Checkbox
                  id={`item-catalog-pack-${pack.id}`}
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
                htmlFor={`item-catalog-pack-${pack.id}`}
                className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-2"
              >
                <Checkbox
                  id={`item-catalog-pack-${pack.id}`}
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
          <Label htmlFor="item-catalog-search">Einzelnen Gegenstand hinzufügen</Label>
          <Input
            id="item-catalog-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Name suchen, z. B. Smartphone"
            aria-label="Gegenstand suchen zum Hinzufügen oder Ausschließen"
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
            <Label htmlFor="item-catalog-allow-personal" className="text-sm font-medium">
              Eigene Items der Spieler erlauben
            </Label>
            <p className="text-xs text-muted-foreground">
              Steuert nur neue Katalog-Angebote — bestehender Besitz bleibt erhalten.
            </p>
          </div>
          <Switch
            id="item-catalog-allow-personal"
            checked={allowPersonalItems}
            onCheckedChange={(checked) => setAllowPersonalItems(checked)}
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
