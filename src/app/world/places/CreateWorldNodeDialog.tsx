/**
 * CreateWorldNodeDialog — contextual + create with ancestor preview (#719).
 * Location: src/app/world/places/CreateWorldNodeDialog.tsx
 */
import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  BUILDING_SUBTYPES,
  COUNTRY_SUBTYPES,
  PLACE_SUBTYPES,
  ROOM_SUBTYPES,
  WORLD_NODE_KINDS,
  labelDeForKind,
  planWorldNodeCreate,
  type WorldNodeKind,
  type WorldNodeSubtype,
} from '../../../domains/world/hierarchy';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import { worldPlaceService } from '../../../infrastructure/world/world-place-service';

const SUBTYPE_LABELS_DE: Record<string, string> = {
  kingdom: 'Königreich',
  republic: 'Republik',
  empire: 'Imperium',
  city: 'Stadt',
  village: 'Dorf',
  wilderness: 'Wildnis',
  forest: 'Wald',
  mountain: 'Gebirge',
  house: 'Haus',
  fortress: 'Festung',
  cave: 'Höhle',
  dungeon: 'Dungeon',
  ruin: 'Ruine',
  chamber: 'Kammer',
  hall: 'Halle',
  corridor: 'Korridor',
};

function subtypesFor(kind: WorldNodeKind): readonly string[] {
  if (kind === 'country') return COUNTRY_SUBTYPES;
  if (kind === 'place') return PLACE_SUBTYPES;
  if (kind === 'building') return BUILDING_SUBTYPES;
  if (kind === 'room') return ROOM_SUBTYPES;
  return [];
}

export type CreateWorldNodeDialogProps = {
  readonly worldProfileId: string;
  readonly canEdit: boolean;
  /** Tip place id when creating under a selected parent; null = from world root. */
  readonly parentPlaceId?: string | null;
  readonly parentKind?: WorldNodeKind | null;
  /** Suggested child kind for contextual + (defaults to continent). */
  readonly defaultChildKind?: WorldNodeKind;
  readonly onCreated?: (result: {
    readonly targetPlaceId: string;
    readonly targetMapId: string | null;
  }) => void;
  readonly onClose?: () => void;
};

export function CreateWorldNodeDialog({
  worldProfileId,
  canEdit,
  parentPlaceId = null,
  parentKind = null,
  defaultChildKind = 'continent',
  onCreated,
  onClose,
}: CreateWorldNodeDialogProps) {
  const [kind, setKind] = useState<WorldNodeKind>(defaultChildKind);
  const [subtype, setSubtype] = useState<string>('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = useMemo(
    () =>
      planWorldNodeCreate({
        childKind: kind,
        childName: name.trim() || '…',
        subtype: (subtype || null) as WorldNodeSubtype | null,
        existingTipKind: parentKind,
      }),
    [kind, name, subtype, parentKind],
  );

  const subtypeOptions = subtypesFor(kind);

  const submit = async () => {
    if (!canEdit) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Bitte einen Namen eingeben.');
      return;
    }
    if (plan.ok === false) {
      setError(`Ungültige Hierarchie: ${plan.reason}`);
      return;
    }
    setBusy(true);
    setError(null);
    const idempotencyKey =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `wb-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const result = await worldPlaceService.createNodeWithMaps({
        worldProfileId,
        kind,
        name: trimmed,
        idempotencyKey,
        subtype: (subtype || null) as WorldNodeSubtype | null,
        parentPlaceId,
      });
      const targetPlaceId = String(result.targetPlaceId ?? '');
      const targetMapId =
        result.targetMapId == null ? null : String(result.targetMapId);
      if (!targetPlaceId) throw new Error('Antwort ohne Zielknoten');
      onCreated?.({ targetPlaceId, targetMapId });
      setName('');
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  if (!canEdit) return null;

  return (
    <div
      className="space-y-3 rounded-md border border-border bg-card/50 p-3"
      data-create-world-node-dialog
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Element anlegen
        </p>
        {onClose ? (
          <Button type="button" variant="ghost" className="min-h-11" onClick={onClose}>
            Schließen
          </Button>
        ) : null}
      </div>

      <div className="space-y-1">
        <Label htmlFor="wb-create-kind">Typ</Label>
        <select
          id="wb-create-kind"
          className="min-h-11 w-full rounded-md border border-border bg-background px-2 text-sm"
          value={kind}
          disabled={busy}
          onChange={(e) => {
            const next = e.target.value as WorldNodeKind;
            setKind(next);
            setSubtype('');
          }}
        >
          {WORLD_NODE_KINDS.map((k) => (
            <option key={k} value={k}>
              {labelDeForKind(k).singular}
            </option>
          ))}
        </select>
      </div>

      {subtypeOptions.length > 0 ? (
        <div className="space-y-1">
          <Label htmlFor="wb-create-subtype">Untertyp</Label>
          <select
            id="wb-create-subtype"
            className="min-h-11 w-full rounded-md border border-border bg-background px-2 text-sm"
            value={subtype}
            disabled={busy}
            onChange={(e) => setSubtype(e.target.value)}
          >
            <option value="">— optional —</option>
            {subtypeOptions.map((s) => (
              <option key={s} value={s}>
                {SUBTYPE_LABELS_DE[s] ?? s}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor="wb-create-name">Name *</Label>
        <Input
          id="wb-create-name"
          className="min-h-11"
          value={name}
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
          placeholder={labelDeForKind(kind).singular}
        />
      </div>

      {plan.ok && plan.previewLinesDe.length > 0 ? (
        <p
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-2 text-xs text-foreground"
          data-create-world-node-preview
        >
          {plan.previewLinesDe.join(' ')}
        </p>
      ) : null}

      {plan.ok === false && name.trim() ? (
        <p className="text-xs text-destructive" role="alert">
          Hierarchie ungültig ({plan.reason}).
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        className="min-h-11 w-full"
        disabled={busy || !name.trim() || plan.ok === false}
        onClick={() => void submit()}
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            Wird angelegt…
          </>
        ) : (
          'Anlegen'
        )}
      </Button>
    </div>
  );
}
