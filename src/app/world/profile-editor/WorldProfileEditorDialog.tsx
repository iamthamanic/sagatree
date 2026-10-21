/**
 * WorldProfileEditorDialog — Vertical slice: create/edit world profile + modules.
 * Location: src/app/world/profile-editor/WorldProfileEditorDialog.tsx
 */
import { useEffect, useState } from 'react';
import {
  PuzzlePiece
} from '@phosphor-icons/react';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../shared/ui/dialog';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/ui/select';
import { Textarea } from '../../../shared/ui/textarea';
import { WorldItemCatalogModuleSection, WorldItemCatalogSection } from '../item-catalog';
import {
  WorldNpcCreatureCatalogModuleSection,
  WorldNpcCreatureCatalogSection,
} from '../npc-creature-catalog';
import { WorldMapEditorScreen } from '../map';
import {
  WORLD_MODULE_REGISTRY,
  getWorldModuleSettingValue,
  setWorldModuleSettingValue,
} from '../../../domains/world/worldModuleRegistry';
import type { CreateWorldProfileDto, WorldModuleConfigMap, WorldProfileVm } from '../../../domains/world/contracts/world.types';

interface WorldProfileEditorDialogProps {
  open: boolean;
  world: WorldProfileVm | null;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: CreateWorldProfileDto) => Promise<boolean>;
}

export function WorldProfileEditorDialog({
  open,
  world,
  onOpenChange,
  onSave,
}: WorldProfileEditorDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [modules, setModules] = useState<WorldModuleConfigMap>({});
  const [npcCatalogRevision, setNpcCatalogRevision] = useState(0);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(world?.name ?? '');
    setDescription(world?.description ?? '');
    setModules(world?.modules ?? {});
    setNpcCatalogRevision(0);
    setValidationAttempted(false);
    setSaveError(null);
  }, [open, world]);

  const handleSave = async () => {
    setValidationAttempted(true);
    setSaveError(null);
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const success = await onSave({ name: name.trim(), description: description.trim(), modules });
      if (success) {
        onOpenChange(false);
      } else {
        setSaveError('Die Welt konnte nicht gespeichert werden. Bitte versuche es erneut.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isSaving && onOpenChange(nextOpen)}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{world ? 'Welt bearbeiten' : 'Neue Welt'}</DialogTitle>
          <DialogDescription>
            Eine Welt bündelt Setting-Regeln und Module. Abenteuer- und Charakterzuordnung folgt in einem separaten Schritt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="world-name">Name *</Label>
            <Input
              id="world-name"
              value={name}
              maxLength={255}
              onChange={(event) => setName(event.target.value)}
              placeholder="z. B. Die zerbrochenen Reiche"
              aria-invalid={validationAttempted && !name.trim()}
              className={validationAttempted && !name.trim() ? 'border-destructive' : undefined}
            />
            {validationAttempted && !name.trim() && (
              <p className="text-xs text-destructive">Bitte gib der Welt einen Namen.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="world-description">Beschreibung</Label>
            <Textarea
              id="world-description"
              value={description}
              rows={3}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Kurzbeschreibung von Setting, Ton und Besonderheiten"
            />
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <PuzzlePiece className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Module</h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Module steuern optionale oder weltabhängige Core-Regeln. Fehlende Einstellungen verwenden immer den Core-Default.
              </p>
            </div>

            {WORLD_MODULE_REGISTRY.filter((module) => !module.customEditor).map((module) => (
              <Card key={module.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="text-base">{module.label}</CardTitle>
                      <CardDescription className="mt-1">{module.description}</CardDescription>
                    </div>
                    <Badge variant="outline" className="w-fit">Core-Modul</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {module.settings.map((setting) => {
                    const value = getWorldModuleSettingValue(modules, module.id, setting.key);
                    const selectedOption = setting.options.find((option) => option.value === value);
                    return (
                      <div key={setting.key} className="space-y-2">
                        <Label htmlFor={`world-module-${module.id}-${setting.key}`}>{setting.label}</Label>
                        <Select
                          value={value}
                          onValueChange={(nextValue) => {
                            setModules((current) => setWorldModuleSettingValue(current, module.id, setting.key, nextValue));
                          }}
                        >
                          <SelectTrigger
                            id={`world-module-${module.id}-${setting.key}`}
                            aria-label={`${module.label}: ${setting.label}`}
                            className="min-h-11"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {setting.options.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedOption && (
                          <p className="text-xs leading-relaxed text-muted-foreground">{selectedOption.description}</p>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}

            <WorldItemCatalogModuleSection
              modules={modules}
              onModulesChange={setModules}
              worldProfileId={world?.id ?? null}
            />

            <WorldNpcCreatureCatalogModuleSection
              modules={modules}
              onModulesChange={setModules}
              worldProfileId={world?.id ?? null}
              catalogRevision={npcCatalogRevision}
            />
          </div>

          {world?.id ? (
            <>
              <WorldItemCatalogSection worldProfileId={world.id} />
              <WorldNpcCreatureCatalogSection
                worldProfileId={world.id}
                onCatalogChanged={() => setNpcCatalogRevision((token) => token + 1)}
              />
              <div
                className="space-y-3 border-t border-border pt-5"
                data-world-map-module-section
              >
                <p className="text-sm text-muted-foreground">
                  Vollständiger Atlas (Leaflet / Hierarchie) unter Bibliothek → Welten → Karte.
                  Hier bleibt der Legacy-Kachel-Editor für bestehende Karten.
                </p>
                {world.publicId ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => {
                      onOpenChange(false);
                      if (typeof window !== 'undefined') {
                        window.history.pushState(
                          null,
                          '',
                          `/library/worlds/${encodeURIComponent(world.publicId)}/map`,
                        );
                        window.dispatchEvent(new PopStateEvent('popstate'));
                      }
                    }}
                    data-world-atlas-open-full
                  >
                    Atlas öffnen
                  </Button>
                ) : null}
                <WorldMapEditorScreen worldProfileId={world.id} />
              </div>
            </>
          ) : (
            <p className="border-t border-border pt-5 text-sm text-muted-foreground">
              Speichere die Welt zuerst, bevor du Ausrüstung & Gegenstände, NPCs & Kreaturen
              oder die Weltkarte für dieses Weltprofil anlegst.
            </p>
          )}

          {saveError && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{saveError}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="button" disabled={isSaving} onClick={() => void handleSave()}>
            {isSaving ? 'Speichert…' : world ? 'Änderungen speichern' : 'Welt erstellen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
