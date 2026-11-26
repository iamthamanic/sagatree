/**
 * SpatialOperationConfirmDialog — SCM-04 confirmation dialog + Werkzeug-Einstellungen (§4/§5/§6).
 * Location: src/app/world/atlas/unified/SpatialOperationConfirmDialog.tsx
 *
 * UI copy in German per SagaTree guidelines; 44px touch targets (AU-*);
 * Cyan primary CTA + Gold hover tokens from shared UI primitives.
 */
import { useEffect, useState } from 'react';
import { ArrowsOut, WarningCircle } from '@phosphor-icons/react';
import type {
  SpatialEditPreferences,
  WorldOperationPlan,
} from '../../../../domains/world/atlas';
import { Button } from '../../../../shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../shared/ui/dialog';

export type SpatialOperationConfirmDialogProps = {
  readonly plan: WorldOperationPlan | null;
  readonly onConfirm: (options: { readonly dontAskAgain: boolean }) => void;
  readonly onCancel: () => void;
};

export function SpatialOperationConfirmDialog({
  plan,
  onConfirm,
  onCancel,
}: SpatialOperationConfirmDialogProps) {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  useEffect(() => {
    setDontAskAgain(false);
  }, [plan]);

  if (!plan) return null;

  const isCascade = plan.requiresConfirmation === 'cascade';
  const titleDe = isCascade
    ? 'Entfernen mit enthaltenen Strukturen bestätigen'
    : 'Bereichserweiterung bestätigen';

  return (
    <Dialog open onOpenChange={(open) => (!open ? onCancel() : undefined)}>
      <DialogContent
        className="max-w-md border-border bg-card text-foreground"
        data-atlas-scm-confirm-dialog
        data-atlas-scm-confirm-kind={plan.requiresConfirmation}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            {isCascade ? (
              <WarningCircle className="size-5 shrink-0 text-accent" aria-hidden />
            ) : (
              <ArrowsOut className="size-5 shrink-0 text-primary" aria-hidden />
            )}
            <span>{titleDe}</span>
          </DialogTitle>
          <DialogDescription
            className="text-sm leading-relaxed text-muted-foreground"
            data-atlas-scm-confirm-summary
          >
            {plan.summaryDe}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {plan.grownCarrierIds.length > 0 ? (
            <div className="rounded-lg border border-border/80 bg-background/60 p-2.5 text-xs">
              <p className="mb-1.5 font-semibold text-foreground">
                Betroffene Ebenen (atomar + rückgängig machbar):
              </p>
              <ul className="space-y-1 text-muted-foreground">
                {plan.changes
                  .filter((c) => c.kind === 'grow_carrier' || c.kind === 'carve_cavity')
                  .map((c) => (
                    <li key={c.entityId} className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-foreground">{c.labelDe}</span>
                      <span className="shrink-0 font-mono text-[10px] uppercase text-primary">
                        {c.kind === 'carve_cavity' ? 'Aushöhlung' : 'wächst mit'}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}

          {plan.archivedDescendantIds.length > 0 || plan.reroutedFlowingIds.length > 0 ? (
            <div className="rounded-lg border border-border/80 bg-background/60 p-2.5 text-xs">
              <p className="mb-1 font-semibold text-foreground">
                Soft-Kaskade (archiviert &amp; rückholbar):
              </p>
              <p className="text-muted-foreground">
                {plan.archivedDescendantIds.length > 0
                  ? `${plan.archivedDescendantIds.length} enthaltene ${plan.archivedDescendantIds.length === 1 ? 'Struktur wird' : 'Strukturen werden'} archiviert.`
                  : null}
                {plan.reroutedFlowingIds.length > 0
                  ? ` ${plan.reroutedFlowingIds.length} fließende ${plan.reroutedFlowingIds.length === 1 ? 'Struktur (Fluss/Straße) wird' : 'Strukturen (Fluss/Straße) werden'} umgeleitet/gekappt.`
                  : null}
              </p>
            </div>
          ) : null}

          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-border/70 bg-background/40 px-3 py-2 text-xs font-medium text-foreground hover:border-accent">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              data-atlas-scm-dont-ask
              checked={dontAskAgain}
              onChange={(e) => setDontAskAgain(e.target.checked)}
            />
            <span>Nicht mehr nachfragen (jederzeit in Werkzeuge änderbar)</span>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            data-atlas-scm-cancel
            onClick={onCancel}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            className="min-h-11"
            data-atlas-scm-confirm
            onClick={() => onConfirm({ dontAskAgain })}
          >
            Bestätigen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type SpatialEditPreferencesSectionProps = {
  readonly prefs: SpatialEditPreferences;
  readonly onChangeConfirmGrow: (next: boolean) => void;
  readonly onChangeConfirmCascade: (next: boolean) => void;
};

/** Persistent Werkzeug-Einstellung section for `spatialEdit.confirmGrow` & `confirmCascade`. */
export function SpatialEditPreferencesSection({
  prefs,
  onChangeConfirmGrow,
  onChangeConfirmCascade,
}: SpatialEditPreferencesSectionProps) {
  return (
    <div
      className="space-y-2 border-t border-border/80 pt-3"
      data-atlas-scm-prefs-section
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Räumliche Bearbeitung (Hinweise)
      </p>
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-md border border-border/80 bg-background/60 px-2.5 py-1.5 text-xs text-foreground transition-colors hover:border-accent">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Wachstum bestätigen</span>
          <span className="block text-[10px] text-muted-foreground">
            Rückfrage vor Bereichserweiterung
          </span>
        </span>
        <input
          type="checkbox"
          className="size-4 shrink-0 accent-primary"
          data-atlas-pref-confirm-grow
          aria-label="Bestätigung vor Bereichserweiterung"
          checked={prefs.confirmGrow}
          onChange={(e) => onChangeConfirmGrow(e.target.checked)}
        />
      </label>
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-md border border-border/80 bg-background/60 px-2.5 py-1.5 text-xs text-foreground transition-colors hover:border-accent">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Entfernen-Kaskade bestätigen</span>
          <span className="block text-[10px] text-muted-foreground">
            Rückfrage vor Soft-Archivierung
          </span>
        </span>
        <input
          type="checkbox"
          className="size-4 shrink-0 accent-primary"
          data-atlas-pref-confirm-cascade
          aria-label="Bestätigung vor Entfernen-Kaskade"
          checked={prefs.confirmCascade}
          onChange={(e) => onChangeConfirmCascade(e.target.checked)}
        />
      </label>
    </div>
  );
}
