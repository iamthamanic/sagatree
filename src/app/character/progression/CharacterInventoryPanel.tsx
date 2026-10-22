import { useState } from 'react';
import {
  Plus,
  Trash
} from '@phosphor-icons/react';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
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
import type { ItemDto, ItemType } from '../../../domains/character';
import { RuleHelp } from '../shared/RuleHelp';

interface CharacterInventoryPanelProps {
  items: ItemDto[];
  onChange: (items: ItemDto[]) => void;
  strength: number;
}

const itemTypeLabels: Record<ItemType, string> = {
  weapon: 'Waffe',
  armor: 'Rüstung',
  shield: 'Schild',
  tool: 'Werkzeug',
  consumable: 'Verbrauch',
  misc: 'Sonstiges',
};

const damageOptions = ['d6+1', 'd8+2', 'd10+3', 'd12+4'] as const;

function isItemType(value: string): value is ItemType {
  return value === 'weapon' || value === 'armor' || value === 'shield' || value === 'tool' || value === 'consumable' || value === 'misc';
}
function parseLoad(value: string): 0 | 1 | 2 | 3 { if (value === '0') return 0; if (value === '2') return 2; if (value === '3') return 3; return 1; }
function parseCost(value: string): 0 | 1 | 2 | 3 | 4 | 5 { if (value === '0') return 0; if (value === '2') return 2; if (value === '3') return 3; if (value === '4') return 4; if (value === '5') return 5; return 1; }
function parseProtection(value: string): 1 | 2 | 3 { if (value === '2') return 2; if (value === '3') return 3; return 1; }
function parseMinimumStrength(value: string): 1 | 2 | 4 { if (value === '2') return 2; if (value === '4') return 4; return 1; }

export function getInventoryLoad(items: readonly ItemDto[]): number {
  return items.reduce((sum, item) => sum + (item.load ?? 1) * Math.max(1, item.quantity), 0);
}

export function CharacterInventoryPanel({ items, onChange, strength }: CharacterInventoryPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ItemType>('misc');
  const [quantity, setQuantity] = useState(1);
  const [load, setLoad] = useState<0 | 1 | 2 | 3>(1);
  const [cost, setCost] = useState<0 | 1 | 2 | 3 | 4 | 5>(1);
  const [damage, setDamage] = useState('d8+2');
  const [damageType, setDamageType] = useState('Kinetisch');
  const [protection, setProtection] = useState<1 | 2 | 3>(1);
  const [minimumStrength, setMinimumStrength] = useState<1 | 2 | 4>(1);
  const [traits, setTraits] = useState('');
  const [validationError, setValidationError] = useState('');

  const capacity = 5 + 2 * strength;
  const totalLoad = getInventoryLoad(items);
  const overloaded = totalLoad > capacity;
  const immobile = totalLoad > capacity * 2;
  const loadPercent = capacity > 0 ? Math.min(100, Math.round((totalLoad / capacity) * 100)) : 100;

  const resetDraft = () => {
    setName(''); setDescription(''); setType('misc'); setQuantity(1); setLoad(1); setCost(1); setDamage('d8+2'); setDamageType('Kinetisch'); setProtection(1); setMinimumStrength(1); setTraits(''); setValidationError('');
  };
  const handleDialogChange = (open: boolean) => { setDialogOpen(open); if (!open) resetDraft(); };

  const handleAddItem = () => {
    const trimmedName = name.trim();
    if (!trimmedName) { setValidationError('Bitte gib einen Namen für den Gegenstand ein.'); return; }
    const parsedTraits = traits.split(',').map((trait) => trait.trim()).filter(Boolean);
    const nextItem: ItemDto = {
      id: crypto.randomUUID(),
      name: trimmedName,
      description: description.trim(),
      type,
      quantity: Math.max(1, quantity),
      load,
      cost,
      ...(type === 'weapon' ? { damage, damage_type: damageType.trim() || 'Kinetisch', traits: parsedTraits } : {}),
      ...(type === 'armor' ? { protection, minimum_strength: minimumStrength } : {}),
      ...(type === 'shield' ? { traits: ['+1 Verteidigung', '1 Hand'] } : {}),
      ...(type === 'tool' && parsedTraits.length > 0 ? { traits: parsedTraits } : {}),
    };
    onChange([...items, nextItem]);
    setDialogOpen(false);
    resetDraft();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-1"><p className="font-medium">Last {totalLoad} / {capacity}</p><RuleHelp label="Traglast">Traglast = 5 + 2 × Stärke. Gegenstände besitzen normalerweise 0 bis 3 Lastpunkte.</RuleHelp></div>
            <p className="text-sm text-muted-foreground">Traglast basiert auf Stärke {strength}.</p>
          </div>
          {immobile ? <Badge variant="destructive">Zu schwer</Badge> : overloaded ? <Badge variant="destructive">Überladen</Badge> : <Badge variant="outline">Tragbar</Badge>}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className={overloaded ? 'h-full rounded-full bg-destructive transition-all' : 'h-full rounded-full bg-primary transition-all'} style={{ width: `${loadPercent}%` }} /></div>
        {overloaded && !immobile && <p className="mt-3 text-sm text-destructive">Über Traglast: Bewegung −3 m und Nachteil auf Athletik und Akrobatik.</p>}
        {immobile && <p className="mt-3 text-sm text-destructive">Mehr als doppelte Traglast: normale längere Bewegung ist nicht möglich.</p>}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="font-medium">Gegenstände ({items.length})</p><p className="text-xs text-muted-foreground">Legacy-Ansicht: Last und Eigenschaften. Inventory v2 nutzt 20 Basisplätze — siehe Charakter-Editor Inventar-Tab.</p></div>
        <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" />Gegenstand hinzufügen</Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/15 px-4 py-10 text-center"><p className="font-medium">Noch keine Ausrüstung</p><p className="mt-1 text-sm text-muted-foreground">Füge Waffen, Rüstung, Werkzeuge oder andere Gegenstände hinzu.</p></div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <article key={item.id} className="relative rounded-lg border border-border bg-card p-4">
              <Button type="button" size="icon" variant="ghost" onClick={() => onChange(items.filter((entry) => entry.id !== item.id))} className="absolute right-2 top-2 size-8 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={`${item.name} aus Inventar entfernen`}><Trash className="h-4 w-4" /></Button>
              <div className="pr-9"><h3 className="font-semibold">{item.name}</h3><p className="text-sm text-muted-foreground">{itemTypeLabels[item.type]} · Menge {item.quantity}</p></div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline">Last {(item.load ?? 1) * Math.max(1, item.quantity)}</Badge>
                {typeof item.cost === 'number' && <Badge variant="outline">Kosten {item.cost}</Badge>}
                {item.damage && <Badge>{item.damage}</Badge>}
                {item.damage_type && <Badge variant="secondary">{item.damage_type}</Badge>}
                {item.protection && <Badge>Schutz {item.protection}</Badge>}
                {item.minimum_strength && <Badge variant="outline">Stärke {item.minimum_strength}+</Badge>}
                {item.type === 'shield' && <Badge>+1 Verteidigung</Badge>}
                {item.traits?.map((trait) => <Badge key={trait} variant="outline">{trait}</Badge>)}
              </div>
              {item.description && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.description}</p>}
            </article>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Gegenstand hinzufügen</DialogTitle><DialogDescription>Lege nur die Werte fest, die für den Gegenstand im SagaTree Core relevant sind.</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2"><Label htmlFor="inventory-name">Name</Label><Input id="inventory-name" value={name} onChange={(event) => { setName(event.target.value); if (validationError) setValidationError(''); }} placeholder="z. B. Langschwert" aria-invalid={Boolean(validationError)} />{validationError && <p className="text-sm text-destructive">{validationError}</p>}</div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="inventory-type">Typ</Label><Select value={type} onValueChange={(value) => { if (isItemType(value)) setType(value); }}><SelectTrigger id="inventory-type"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(itemTypeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="inventory-quantity">Menge</Label><Input id="inventory-quantity" type="number" min="1" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number.parseInt(event.target.value, 10) || 1))} /></div>
              <div className="space-y-2"><div className="flex items-center gap-1"><Label htmlFor="inventory-load">Last</Label><RuleHelp label="Last">Gegenstände besitzen normalerweise 0 bis 3 Lastpunkte. 0 steht für vernachlässigbare Kleinteile; 3 für besonders schwere persönliche Ausrüstung.</RuleHelp></div><Select value={String(load)} onValueChange={(value) => setLoad(parseLoad(value))}><SelectTrigger id="inventory-load"><SelectValue /></SelectTrigger><SelectContent>{[0, 1, 2, 3].map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><div className="flex items-center gap-1"><Label htmlFor="inventory-cost">Kosten</Label><RuleHelp label="Kosten">SagaTree Core verwendet standardmäßig abstrakte Kosten von 0 bis 5. Ein Weltprofil kann diese später durch konkrete Währung ersetzen.</RuleHelp></div><Select value={String(cost)} onValueChange={(value) => setCost(parseCost(value))}><SelectTrigger id="inventory-cost"><SelectValue /></SelectTrigger><SelectContent>{[0, 1, 2, 3, 4, 5].map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select></div>
            </div>

            {type === 'weapon' && <div className="rounded-lg border border-border bg-muted/15 p-4"><p className="mb-3 font-medium">Waffenwerte</p><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="inventory-damage">Schaden</Label><Select value={damage} onValueChange={setDamage}><SelectTrigger id="inventory-damage"><SelectValue /></SelectTrigger><SelectContent>{damageOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="inventory-damage-type">Schadensart</Label><Input id="inventory-damage-type" value={damageType} onChange={(event) => setDamageType(event.target.value)} placeholder="Kinetisch" /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="inventory-traits">Merkmale</Label><Input id="inventory-traits" value={traits} onChange={(event) => setTraits(event.target.value)} placeholder="z. B. Finesse, Zweihändig, Durchdringung 1" /><p className="text-xs text-muted-foreground">Mehrere Merkmale mit Komma trennen.</p></div></div></div>}
            {type === 'armor' && <div className="rounded-lg border border-border bg-muted/15 p-4"><p className="mb-3 font-medium">Rüstungswerte</p><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><div className="flex items-center gap-1"><Label htmlFor="inventory-protection">Schutz</Label><RuleHelp label="Schutz">Rüstung erhöht nicht die Verteidigung. Schutz reduziert erlittenen Schaden.</RuleHelp></div><Select value={String(protection)} onValueChange={(value) => setProtection(parseProtection(value))}><SelectTrigger id="inventory-protection"><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3].map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="inventory-min-strength">Mindeststärke</Label><Select value={String(minimumStrength)} onValueChange={(value) => setMinimumStrength(parseMinimumStrength(value))}><SelectTrigger id="inventory-min-strength"><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 4].map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select></div></div></div>}
            {type === 'tool' && <div className="space-y-2"><Label htmlFor="inventory-tool-traits">Einsatz / Besonderheit</Label><Input id="inventory-tool-traits" value={traits} onChange={(event) => setTraits(event.target.value)} placeholder="z. B. medizinisches Set, Feinmechanik" /></div>}
            {type === 'shield' && <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">Ein Schild gibt nach SagaTree Core +1 Verteidigung und belegt eine Hand.</div>}
            <div className="space-y-2"><Label htmlFor="inventory-description">Beschreibung</Label><Textarea id="inventory-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></div>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => handleDialogChange(false)}>Abbrechen</Button><Button type="button" onClick={handleAddItem}>Gegenstand hinzufügen</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
