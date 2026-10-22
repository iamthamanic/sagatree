/**
 * NpcCreatureEditorScreen — Grundlagen|Werte|Kampf|Details + live Statblock (#198).
 * Desktop two-column sticky preview; mobile separate Vorschau tab.
 * Location: src/app/npc-creature/NpcCreatureEditorScreen.tsx
 */
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CircleNotch,
  FloppyDisk
} from '@phosphor-icons/react';
import {
  deriveNpcCreaturePower,
  NPC_CREATURE_CATEGORIES,
  type NpcCreatureCategory,
  type NpcCreatureKind,
} from '../../domains/npc-creature';
import type {
  SagaTreeCombatProfile,
  SagaTreeCombatRole,
  SagaTreeNpcLevel,
} from '../../domains/rules/sagatree/npc-creature-power';
import {
  NpcCreatureStatblockPanel,
  NPC_ATTRIBUTE_SHORT_LABELS,
  NPC_COMBAT_PROFILE_LABELS,
  NPC_COMBAT_ROLE_LABELS,
  NPC_CREATURE_CATEGORY_LABELS,
  NPC_CREATURE_KIND_LABELS,
} from '../library';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Label } from '../../shared/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../shared/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../shared/ui/tabs';
import { Textarea } from '../../shared/ui/textarea';
import {
  previewDefinitionFromDraft,
  useNpcCreatureEditor,
  type NpcCreatureEditorDraft,
} from './useNpcCreatureEditor';

const COMBAT_PROFILES: readonly SagaTreeCombatProfile[] = [
  'noncombat',
  'balanced',
  'tough',
  'offensive',
  'mobile',
  'ranged',
  'control_support',
];

const COMBAT_ROLES: readonly SagaTreeCombatRole[] = ['standard', 'elite', 'boss'];
const LEVELS = Array.from({ length: 20 }, (_, index) => (index + 1) as SagaTreeNpcLevel);
const DESKTOP_MQ = '(min-width: 1024px)';

export interface NpcCreatureEditorScreenProps {
  definitionId: string;
  onBack: () => void;
}

function useIsDesktopSplit(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(DESKTOP_MQ).matches : true,
  );

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_MQ);
    const onChange = () => setIsDesktop(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}

function OverrideNumberField({
  id,
  label,
  value,
  recommended,
  onChange,
}: {
  id: string;
  label: string;
  value: number | undefined;
  recommended: number;
  onChange: (next: number | undefined) => void;
}) {
  const display = value ?? recommended;
  const overridden = value !== undefined;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {overridden ? (
          <span className="ml-2 text-xs font-normal text-amber-600">
            Override (empf. {recommended})
          </span>
        ) : (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            empf. {recommended}
          </span>
        )}
      </Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          className="h-11 min-h-11"
          value={display}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === '') {
              onChange(undefined);
              return;
            }
            const parsed = Number(raw);
            if (!Number.isFinite(parsed)) return;
            onChange(Math.trunc(parsed));
          }}
        />
        {overridden ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11 shrink-0"
            onClick={() => onChange(undefined)}
          >
            Reset
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function EditorFormFields({
  draft,
  updateDraft,
  scopeLabel,
  disabled = false,
}: {
  draft: NpcCreatureEditorDraft;
  updateDraft: (patch: Partial<NpcCreatureEditorDraft>) => void;
  scopeLabel: string;
  disabled?: boolean;
}) {
  const preview = previewDefinitionFromDraft(
    'personal:preview',
    'personal',
    draft,
  );
  const derived = deriveNpcCreaturePower(preview);
  const recommended = derived.benchmarks;
  const showCombatRole = draft.combatProfile !== 'noncombat';
  const showEliteBoss = draft.combatRole === 'elite' || draft.combatRole === 'boss';
  const showWendepunkt = draft.combatRole === 'boss';

  return (
    <fieldset disabled={disabled} className="min-w-0 border-0 p-0">
    <Tabs defaultValue="basics" className="w-full" data-npc-editor-tabs>
      <TabsList className="flex h-auto min-h-11 w-full flex-wrap justify-start gap-1">
        <TabsTrigger value="basics" className="min-h-11 px-3">
          Grundlagen
        </TabsTrigger>
        <TabsTrigger value="values" className="min-h-11 px-3">
          Werte
        </TabsTrigger>
        <TabsTrigger value="combat" className="min-h-11 px-3">
          Kampf
        </TabsTrigger>
        <TabsTrigger value="details" className="min-h-11 px-3">
          Details
        </TabsTrigger>
      </TabsList>

      <TabsContent value="basics" className="space-y-4 pt-2">
        <div className="space-y-2">
          <Label htmlFor="npc-edit-name">Name</Label>
          <Input
            id="npc-edit-name"
            className="h-11 min-h-11"
            value={draft.name}
            onChange={(event) => updateDraft({ name: event.target.value })}
            data-npc-edit-name
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="npc-edit-kind">Art</Label>
            <Select
              value={draft.kind}
              onValueChange={(value) => updateDraft({ kind: value as NpcCreatureKind })}
            >
              <SelectTrigger id="npc-edit-kind" className="h-11 min-h-11" aria-label="Art">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="npc">{NPC_CREATURE_KIND_LABELS.npc}</SelectItem>
                <SelectItem value="creature">{NPC_CREATURE_KIND_LABELS.creature}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="npc-edit-category">Kategorie</Label>
            <Select
              value={draft.category}
              onValueChange={(value) => updateDraft({ category: value as NpcCreatureCategory })}
            >
              <SelectTrigger id="npc-edit-category" className="h-11 min-h-11" aria-label="Kategorie">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NPC_CREATURE_CATEGORIES.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {NPC_CREATURE_CATEGORY_LABELS[entry]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="npc-edit-description">Kurze Beschreibung</Label>
          <Textarea
            id="npc-edit-description"
            rows={3}
            value={draft.description}
            onChange={(event) => updateDraft({ description: event.target.value })}
          />
        </div>
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          Welt / Quelle: {scopeLabel}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="npc-edit-level">Stufe</Label>
            <Select
              value={String(draft.level)}
              onValueChange={(value) =>
                updateDraft({ level: Number(value) as SagaTreeNpcLevel })
              }
            >
              <SelectTrigger id="npc-edit-level" className="h-11 min-h-11" data-npc-edit-level aria-label="Stufe">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((entry) => (
                  <SelectItem key={entry} value={String(entry)}>
                    Stufe {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Machtgrad {derived.machtgradLabel}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="npc-edit-profile">Kampfprofil</Label>
            <Select
              value={draft.combatProfile}
              onValueChange={(value) =>
                updateDraft({ combatProfile: value as SagaTreeCombatProfile })
              }
            >
              <SelectTrigger id="npc-edit-profile" className="h-11 min-h-11" aria-label="Kampfprofil">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMBAT_PROFILES.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {NPC_COMBAT_PROFILE_LABELS[entry]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {showCombatRole ? (
          <div className="space-y-2">
            <Label htmlFor="npc-edit-role">Kampfrolle</Label>
            <Select
              value={draft.combatRole}
              onValueChange={(value) =>
                updateDraft({ combatRole: value as SagaTreeCombatRole })
              }
            >
              <SelectTrigger id="npc-edit-role" className="h-11 min-h-11" aria-label="Kampfrolle">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMBAT_ROLES.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {NPC_COMBAT_ROLE_LABELS[entry]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Kampfrolle: Standard (Nichtkämpferisch)
          </p>
        )}
      </TabsContent>

      <TabsContent value="values" className="space-y-4 pt-2">
        <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm" data-npc-values-summary>
          Automatisch aus: Stufe {draft.level} · {derived.machtgradLabel} ·{' '}
          {NPC_COMBAT_ROLE_LABELS[draft.combatRole]} ·{' '}
          {NPC_COMBAT_PROFILE_LABELS[draft.combatProfile]}
        </p>
        {!draft.advancedOpen ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-11"
            onClick={() => updateDraft({ advancedOpen: true })}
            data-npc-values-advanced
          >
            Werte manuell anpassen
          </Button>
        ) : (
          <div className="space-y-4" data-npc-values-advanced-panel>
            <div className="grid gap-4 sm:grid-cols-2">
              <OverrideNumberField
                id="npc-ov-health"
                label="Gesundheit"
                value={draft.statOverrides.health}
                recommended={recommended.health}
                onChange={(health) =>
                  updateDraft({
                    statOverrides: { ...draft.statOverrides, health },
                  })
                }
              />
              <OverrideNumberField
                id="npc-ov-defense"
                label="Verteidigung"
                value={draft.statOverrides.defense}
                recommended={recommended.defense}
                onChange={(defense) =>
                  updateDraft({
                    statOverrides: { ...draft.statOverrides, defense },
                  })
                }
              />
              <OverrideNumberField
                id="npc-ov-move"
                label="Bewegung (m)"
                value={draft.statOverrides.movementMeters}
                recommended={recommended.movementMeters}
                onChange={(movementMeters) =>
                  updateDraft({
                    statOverrides: { ...draft.statOverrides, movementMeters },
                  })
                }
              />
              <OverrideNumberField
                id="npc-ov-body"
                label="Körper"
                value={draft.statOverrides.resistanceHigh}
                recommended={recommended.resistances.high}
                onChange={(resistanceHigh) =>
                  updateDraft({
                    statOverrides: { ...draft.statOverrides, resistanceHigh },
                  })
                }
              />
              <OverrideNumberField
                id="npc-ov-reflex"
                label="Reflex"
                value={draft.statOverrides.resistanceNormal}
                recommended={recommended.resistances.normal}
                onChange={(resistanceNormal) =>
                  updateDraft({
                    statOverrides: { ...draft.statOverrides, resistanceNormal },
                  })
                }
              />
              <OverrideNumberField
                id="npc-ov-mind"
                label="Geist"
                value={draft.statOverrides.resistanceLow}
                recommended={recommended.resistances.low}
                onChange={(resistanceLow) =>
                  updateDraft({
                    statOverrides: { ...draft.statOverrides, resistanceLow },
                  })
                }
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Attribute</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {NPC_ATTRIBUTE_SHORT_LABELS.map((label, index) => {
                  const currentAttrs =
                    draft.statOverrides.attributes
                    ?? recommended.attributeDefaults;
                  return (
                    <OverrideNumberField
                      key={label}
                      id={`npc-ov-attr-${index}`}
                      label={label}
                      value={
                        draft.statOverrides.attributes
                          ? draft.statOverrides.attributes[index]
                          : undefined
                      }
                      recommended={recommended.attributeDefaults[index] ?? 0}
                      onChange={(nextValue) => {
                        const base = [...currentAttrs] as [
                          number,
                          number,
                          number,
                          number,
                          number,
                          number,
                        ];
                        if (nextValue === undefined) {
                          base[index] = recommended.attributeDefaults[index] ?? 0;
                          const allMatch = base.every(
                            (value, attrIndex) =>
                              value === (recommended.attributeDefaults[attrIndex] ?? 0),
                          );
                          if (allMatch) {
                            const { attributes: _drop, ...rest } = draft.statOverrides;
                            updateDraft({ statOverrides: rest });
                            return;
                          }
                          updateDraft({
                            statOverrides: { ...draft.statOverrides, attributes: base },
                          });
                          return;
                        }
                        base[index] = nextValue;
                        updateDraft({
                          statOverrides: { ...draft.statOverrides, attributes: base },
                        });
                      }}
                    />
                  );
                })}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="h-11 min-h-11"
              onClick={() => updateDraft({ advancedOpen: false, statOverrides: {} })}
            >
              Automatische Werte wiederherstellen
            </Button>
          </div>
        )}
      </TabsContent>

      <TabsContent value="combat" className="space-y-4 pt-2">
        <div className="space-y-2">
          <Label htmlFor="npc-combat-attacks">Angriffe / Aktionen</Label>
          <Textarea
            id="npc-combat-attacks"
            rows={3}
            value={draft.combatDetails.attacks ?? ''}
            onChange={(event) =>
              updateDraft({
                combatDetails: {
                  ...draft.combatDetails,
                  attacks: event.target.value,
                },
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="npc-combat-reactions">Reaktionen</Label>
          <Textarea
            id="npc-combat-reactions"
            rows={2}
            value={draft.combatDetails.reactions ?? ''}
            onChange={(event) =>
              updateDraft({
                combatDetails: {
                  ...draft.combatDetails,
                  reactions: event.target.value,
                },
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="npc-combat-signatures">Signaturfähigkeiten</Label>
          <Textarea
            id="npc-combat-signatures"
            rows={2}
            value={draft.combatDetails.signatures ?? ''}
            onChange={(event) =>
              updateDraft({
                combatDetails: {
                  ...draft.combatDetails,
                  signatures: event.target.value,
                },
              })
            }
          />
        </div>
        {showEliteBoss ? (
          <div className="space-y-2">
            <Label htmlFor="npc-combat-impulses">Elite-/Boss-Impulse</Label>
            <Textarea
              id="npc-combat-impulses"
              rows={2}
              value={draft.combatDetails.impulseOptions ?? ''}
              onChange={(event) =>
                updateDraft({
                  combatDetails: {
                    ...draft.combatDetails,
                    impulseOptions: event.target.value,
                  },
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Mindestens {recommended.minImpulseOptions} Impulsoption
              {recommended.minImpulseOptions === 1 ? '' : 'en'} empfohlen.
            </p>
          </div>
        ) : null}
        {showWendepunkt ? (
          <div className="space-y-2">
            <Label htmlFor="npc-combat-wendepunkt">Boss-Wendepunkt</Label>
            <Textarea
              id="npc-combat-wendepunkt"
              rows={2}
              value={draft.combatDetails.wendepunkt ?? ''}
              onChange={(event) =>
                updateDraft({
                  combatDetails: {
                    ...draft.combatDetails,
                    wendepunkt: event.target.value,
                  },
                })
              }
            />
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="npc-combat-res">Resistenzen</Label>
            <Textarea
              id="npc-combat-res"
              rows={2}
              value={draft.combatDetails.resistancesNotes ?? ''}
              onChange={(event) =>
                updateDraft({
                  combatDetails: {
                    ...draft.combatDetails,
                    resistancesNotes: event.target.value,
                  },
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="npc-combat-weak">Schwächen</Label>
            <Textarea
              id="npc-combat-weak"
              rows={2}
              value={draft.combatDetails.weaknessesNotes ?? ''}
              onChange={(event) =>
                updateDraft({
                  combatDetails: {
                    ...draft.combatDetails,
                    weaknessesNotes: event.target.value,
                  },
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="npc-combat-imm">Immunitäten</Label>
            <Textarea
              id="npc-combat-imm"
              rows={2}
              value={draft.combatDetails.immunitiesNotes ?? ''}
              onChange={(event) =>
                updateDraft({
                  combatDetails: {
                    ...draft.combatDetails,
                    immunitiesNotes: event.target.value,
                  },
                })
              }
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="details" className="space-y-4 pt-2">
        <div className="space-y-2">
          <Label htmlFor="npc-details-senses">Sinne</Label>
          <Textarea
            id="npc-details-senses"
            rows={2}
            value={draft.detailExtras.senses ?? ''}
            onChange={(event) =>
              updateDraft({
                detailExtras: { ...draft.detailExtras, senses: event.target.value },
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="npc-details-behavior">Verhalten / Taktik</Label>
          <Textarea
            id="npc-details-behavior"
            rows={2}
            value={draft.detailExtras.behavior ?? ''}
            onChange={(event) =>
              updateDraft({
                detailExtras: { ...draft.detailExtras, behavior: event.target.value },
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="npc-details-loot">Loot / Inventar-Hinweise</Label>
          <Textarea
            id="npc-details-loot"
            rows={2}
            value={draft.detailExtras.loot ?? ''}
            onChange={(event) =>
              updateDraft({
                detailExtras: { ...draft.detailExtras, loot: event.target.value },
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="npc-details-tags">Tags (kommagetrennt)</Label>
          <Input
            id="npc-details-tags"
            className="h-11 min-h-11"
            value={draft.tagsText}
            onChange={(event) => updateDraft({ tagsText: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="npc-details-notes">Notizen</Label>
          <Textarea
            id="npc-details-notes"
            rows={3}
            value={draft.notes}
            onChange={(event) => updateDraft({ notes: event.target.value })}
          />
        </div>
      </TabsContent>
    </Tabs>
    </fieldset>
  );
}

export function NpcCreatureEditorScreen({
  definitionId,
  onBack,
}: NpcCreatureEditorScreenProps) {
  const editor = useNpcCreatureEditor(definitionId);
  const isDesktop = useIsDesktopSplit();
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');

  if (editor.isLoading) {
    return (
      <div
        className="flex items-center justify-center py-20"
        aria-busy="true"
        aria-label="Statblock wird geladen"
        data-npc-editor-loading
      >
        <CircleNotch className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (editor.loadError || !editor.draft || !editor.record) {
    return (
      <div className="space-y-4 p-4 sm:p-6" role="alert" data-npc-editor-error>
        <p className="text-sm text-destructive">
          {editor.loadError ?? 'Figur konnte nicht geladen werden.'}
        </p>
        <Button type="button" variant="outline" className="h-11 min-h-11" onClick={onBack}>
          Zurück zur Bibliothek
        </Button>
      </div>
    );
  }

  const preview = previewDefinitionFromDraft(
    editor.record.definition.id,
    editor.record.definition.scope,
    editor.draft,
    editor.record.definition,
  );
  const scopeLabel =
    editor.record.definition.scope === 'world'
      ? `Welt (${editor.record.worldProfileId ?? 'unbekannt'})`
      : 'Eigen';

  const topbar = (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11 shrink-0"
          onClick={onBack}
          aria-label="Zurück"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Button>
        <h1 className="truncate text-xl font-semibold sm:text-2xl" data-npc-editor-title>
          {editor.draft.name.trim() || 'Unbenannte Figur'}
        </h1>
      </div>
      <Button
        type="button"
        className="h-11 min-h-11"
        onClick={() => void editor.save()}
        disabled={editor.isSaving || !editor.dirty}
        data-npc-editor-save
      >
        {editor.isSaving ? (
          <>
            <CircleNotch className="mr-2 size-4 animate-spin" aria-hidden />
            Speichern…
          </>
        ) : (
          <>
            <FloppyDisk className="mr-2 size-4" aria-hidden />
            Speichern
          </>
        )}
      </Button>
    </div>
  );

  const form = (
    <EditorFormFields
      draft={editor.draft}
      updateDraft={editor.updateDraft}
      scopeLabel={scopeLabel}
      disabled={editor.isSaving}
    />
  );

  const previewPanel = (
    <div
      className="rounded-xl border border-border bg-card/60 p-4 lg:sticky lg:top-4"
      data-npc-editor-preview
    >
      <p className="mb-3 text-sm font-semibold">Live-Statblock</p>
      <NpcCreatureStatblockPanel definition={preview} compactHeader />
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6" data-npc-editor-screen>
      {topbar}
      {editor.saveError ? (
        <p
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {editor.saveError}
        </p>
      ) : null}

      {isDesktop ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
          <div>{form}</div>
          {previewPanel}
        </div>
      ) : (
        <Tabs
          value={mobileTab}
          onValueChange={(value) => setMobileTab(value as 'edit' | 'preview')}
        >
          <TabsList className="grid h-11 min-h-11 w-full grid-cols-2">
            <TabsTrigger value="edit" className="min-h-11">
              Bearbeiten
            </TabsTrigger>
            <TabsTrigger value="preview" className="min-h-11" data-npc-editor-mobile-preview>
              Vorschau
            </TabsTrigger>
          </TabsList>
          <TabsContent value="edit" className="pt-3">
            {form}
          </TabsContent>
          <TabsContent value="preview" className="pt-3">
            {previewPanel}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
