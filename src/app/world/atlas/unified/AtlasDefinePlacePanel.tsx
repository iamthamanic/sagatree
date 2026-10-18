/**
 * AtlasDefinePlacePanel — create region / settlement / building from atlas inspector.
 * Location: src/app/world/atlas/unified/AtlasDefinePlacePanel.tsx
 *
 * Pin = click on map (or marquee center). Persist via world_places; caller adds stamp.
 */
import { useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import {
  SETTLEMENT_PRESETS,
  type AtlasPlaceAuthorKind,
  type SettlementPresetId,
} from '../../../../domains/world/places';
import { Button } from '../../../../shared/ui/button';
import { Input } from '../../../../shared/ui/input';
import { Label } from '../../../../shared/ui/label';

export type AtlasDefinePlaceRequest = {
  readonly authorKind: AtlasPlaceAuthorKind;
  readonly name: string;
  readonly settlementPresetId: SettlementPresetId | null;
};

export type AtlasDefinePlacePanelProps = {
  readonly disabled?: boolean;
  readonly busy?: boolean;
  readonly error?: string | null;
  /** World coords from map click / marquee center. */
  readonly pin: { readonly x: number; readonly y: number } | null;
  readonly pinArmed?: boolean;
  readonly marqueeActive?: boolean;
  readonly onArmPin: () => void;
  readonly onArmMarquee?: () => void;
  readonly onClearPin: () => void;
  readonly onCreate: (req: AtlasDefinePlaceRequest) => void | Promise<void>;
};

export function AtlasDefinePlacePanel({
  disabled = false,
  busy = false,
  error = null,
  pin,
  pinArmed = false,
  marqueeActive = false,
  onArmPin,
  onArmMarquee,
  onClearPin,
  onCreate,
}: AtlasDefinePlacePanelProps) {
  const [authorKind, setAuthorKind] = useState<AtlasPlaceAuthorKind>('settlement');
  const [presetId, setPresetId] = useState<SettlementPresetId>('town');
  const [name, setName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setLocalError('Bitte einen Namen eingeben.');
      return;
    }
    if (!pin) {
      setLocalError('Zuerst auf der Karte markieren (Pin oder Rahmen).');
      return;
    }
    setLocalError(null);
    void onCreate({
      authorKind,
      name: trimmed,
      settlementPresetId: authorKind === 'settlement' ? presetId : null,
    });
  };

  return (
    <div
      className="space-y-2 rounded-md border border-border bg-card/40 p-2"
      data-atlas-define-place
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Ort / Gebiet definieren
      </p>
      <p className="text-[11px] text-muted-foreground">
        1) Markierung auf der Karte · 2) Typ & Name · 3) Anlegen. Land/Wasser mit Pinsel
        (Wasser/Gras).
      </p>
      <div className="flex flex-wrap gap-1">
        <Button
          type="button"
          variant={pinArmed ? 'default' : 'outline'}
          className="min-h-11"
          disabled={disabled || busy}
          data-atlas-arm-pin
          aria-pressed={pinArmed}
          onClick={onArmPin}
        >
          <MapPin className="mr-1 size-4" aria-hidden />
          {pinArmed ? 'Klick auf Karte…' : 'Pin setzen'}
        </Button>
        {authorKind === 'region' && onArmMarquee ? (
          <Button
            type="button"
            variant={marqueeActive ? 'default' : 'outline'}
            className="min-h-11"
            disabled={disabled || busy}
            data-atlas-arm-marquee
            aria-pressed={marqueeActive}
            onClick={onArmMarquee}
          >
            {marqueeActive ? 'Rahmen ziehen…' : 'Gebiet-Rahmen'}
          </Button>
        ) : null}
        {pin ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            disabled={disabled || busy}
            onClick={onClearPin}
          >
            Markierung löschen
          </Button>
        ) : null}
      </div>
      {pin ? (
        <p className="font-mono text-[11px] text-muted-foreground" data-atlas-pin-coords>
          Markierung X {pin.x.toFixed(1)} · Y {pin.y.toFixed(1)}
        </p>
      ) : (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">Noch keine Markierung.</p>
      )}
      <div className="flex flex-wrap gap-1" role="group" aria-label="Platz-Typ">
        {(
          [
            ['region', 'Gebiet'],
            ['settlement', 'Ort'],
            ['building', 'Gebäude'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            disabled={disabled || busy}
            className={`min-h-11 rounded-md px-2 text-xs font-semibold ${
              authorKind === id
                ? 'bg-primary text-primary-foreground'
                : 'border border-border hover:bg-muted'
            }`}
            aria-pressed={authorKind === id}
            onClick={() => setAuthorKind(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {authorKind === 'settlement' ? (
        <div className="flex flex-wrap gap-1" role="group" aria-label="Siedlungs-Preset">
          {SETTLEMENT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={disabled || busy}
              className={`min-h-11 rounded-md px-2 text-xs font-semibold ${
                presetId === p.id
                  ? 'bg-primary/20 text-foreground ring-1 ring-primary'
                  : 'border border-border hover:bg-muted'
              }`}
              aria-pressed={presetId === p.id}
              onClick={() => setPresetId(p.id)}
            >
              {p.labelDe}
            </button>
          ))}
        </div>
      ) : null}
      {authorKind === 'building' ? (
        <p className="text-[11px] text-muted-foreground">Basic-Gebäude (Stempel · Interior später).</p>
      ) : null}
      <Label htmlFor="atlas-define-place-name">Name</Label>
      <Input
        id="atlas-define-place-name"
        className="min-h-11"
        value={name}
        disabled={disabled || busy}
        placeholder={
          authorKind === 'region'
            ? 'z. B. Nordreich'
            : authorKind === 'building'
              ? 'z. B. Gasthaus'
              : 'z. B. Dornhain'
        }
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
      />
      {(localError || error) && (
        <p className="text-xs text-destructive" role="alert">
          {localError || error}
        </p>
      )}
      <Button
        type="button"
        className="min-h-11 w-full"
        disabled={disabled || busy || !pin}
        data-atlas-define-place-submit
        onClick={submit}
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            Wird angelegt…
          </>
        ) : (
          'An Markierung anlegen'
        )}
      </Button>
    </div>
  );
}
