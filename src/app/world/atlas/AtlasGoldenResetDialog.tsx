/**
 * AtlasGoldenResetDialog — Reset-to-Golden scope picker for Dornhain atlas.
 * Location: src/app/world/atlas/AtlasGoldenResetDialog.tsx
 */
import { useState } from 'react';
import {
  dornhainGoldenResetModeHintDe,
  dornhainGoldenResetModeLabelDe,
  type DornhainGoldenResetMode,
} from '../../../domains/world/atlas';
import { Button } from '../../../shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../shared/ui/dialog';
import { Label } from '../../../shared/ui/label';
import { RadioGroup, RadioGroupItem } from '../../../shared/ui/radio-group';

const MODES: readonly DornhainGoldenResetMode[] = ['atlas', 'atlas_places', 'everything'];

export type AtlasGoldenResetDialogProps = {
  readonly open: boolean;
  readonly busy?: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: (mode: DornhainGoldenResetMode) => void | Promise<void>;
};

export function AtlasGoldenResetDialog({
  open,
  busy = false,
  onOpenChange,
  onConfirm,
}: AtlasGoldenResetDialogProps) {
  const [mode, setMode] = useState<DornhainGoldenResetMode>('atlas_places');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-atlas-golden-reset-dialog>
        <DialogHeader>
          <DialogTitle>Auf Golden zurücksetzen</DialogTitle>
          <DialogDescription>
            Stellt die Dornhain-Referenzwelt wieder her. Eigene Orte ohne Golden-Seed bleiben
            erhalten, außer du wählst ausdrücklich alles.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={mode}
          onValueChange={(v) => {
            if (v === 'atlas' || v === 'atlas_places' || v === 'everything') setMode(v);
          }}
          className="gap-3"
          aria-label="Reset-Umfang"
        >
          {MODES.map((m) => (
            <div
              key={m}
              className="flex items-start gap-3 rounded-md border border-border p-3"
            >
              <RadioGroupItem value={m} id={`atlas-reset-${m}`} className="mt-1" />
              <div className="min-w-0 space-y-1">
                <Label htmlFor={`atlas-reset-${m}`} className="cursor-pointer font-medium">
                  {dornhainGoldenResetModeLabelDe(m)}
                  {m === 'atlas_places' ? ' (Standard)' : ''}
                </Label>
                <p className="text-xs text-muted-foreground">{dornhainGoldenResetModeHintDe(m)}</p>
              </div>
            </div>
          ))}
        </RadioGroup>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={busy}
            data-atlas-golden-reset-confirm
            onClick={() => void onConfirm(mode)}
          >
            {busy ? 'Setzt zurück…' : 'Zurücksetzen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
