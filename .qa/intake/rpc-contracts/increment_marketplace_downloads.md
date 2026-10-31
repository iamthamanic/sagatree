# RPC-Vertrag: `increment_marketplace_downloads`

Host-Nachfolger (#878): atomarer Downloadzähler über SQLite marketplace_items + MarketplaceCountStore; optionale src/supabase SQL-Skripte bleiben Legacy-Installationsquellen ohne Migrationsketten-Autorität.

**Status:** `source-verified`. Quellcode-Baseline `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Umsetzungsfreigabe: nein.**

**Teilaufgabe:** [#878](https://github.com/iamthamanic/sagatree/issues/878) — RPC-MARKETPLACE-COUNT; Koordinator [#816](https://github.com/iamthamanic/sagatree/issues/816).

Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.

## Verhalten

- UPDATE marketplace_items SET downloads=downloads+1 WHEREid=item_id; Rückgabevoid. Unbekannte ID ist No-op; NULL-downloads bleibt bei SQL-AdditionNULL.
- add_marketplace_rpc.sql und deploy_marketplace.sql enthalten denselben Funktionsbody, keine zwei gleichzeitig gültigen Overloads.
- Der Marketplace-Adapter (#675) ruft nur die RPC auf und schreibt downloads bei RPC-Fehler nicht mehr clientseitig — Counter bleiben server-authority only.
- Bei Installation über deploy_marketplace.sql setzt der BEFORE-UPDATE-Trigger marketplace_updated_at zusätzlich updated_at=now(); die reine add_marketplace_rpc.sql setzt diese Tabellen-/Triggerinstallation voraus und belegt sie nicht.

## Berechtigungen

- SECURITY DEFINER mit search_path=public,pg_temp; EXECUTE nur für authenticated (kein anon/PUBLIC) nach #675.
- Keine auth.uid-/Owner-Prüfung im Funktionsbody; Zählerinkrement bleibt absichtlich für authentifizierte Aufrufer ohne Autorenbindung.

## SQL-Signatur 1

`public.increment_marketplace_downloads(uuid)`

| Parameter | PostgreSQL-Typ | Modus | Default |
| --- | --- | --- | --- |
| item_id | `uuid` | DEFAULT | Kein Default — expliziter Wert erforderlich |

**RETURNS:** `void`.

**Wirksame Definition:** [src/supabase/add_marketplace_rpc.sql](../../../src/supabase/add_marketplace_rpc.sql) (Zeilen 1–17, SHA-256 `450d3ba94e44b796ce64bf8c5e2a7a82f53f37b23574f5b1a8dfd1ef1550c670`).

**Vollständiger abgeleiteter SQL-Text:** [.qa/intake/rpc-contracts/effective-sql/increment_marketplace_downloads-1.sql](effective-sql/increment_marketplace_downloads-1.sql); SHA-256 `c5b091e339730043782c23ee4508607ae630090963006afc9a9ffb598df12d44`.

### Ausführungskontext und ACL

| Eigenschaft | Belegter Wert |
| --- | --- |
| SECURITY DEFINER | True |
| search_path | Nicht im Funktionsheader gesetzt |
| Migration-/Skript-EXECUTE-Deklarationen | PUBLIC, authenticated |
| ACL-Scope | Migration/optional-script declarations starting from PostgreSQL PUBLIC default; platform default ACL is separate below. |

**Keine Katalogbeobachtung:** Diese optionale Funktion fehlt in der Repository-Migrationskette. Alternative Installationsquellen stehen unten.

### Exakte Return-Pfade

| Parser-Zeile | Bedingungspfad | Return-Ausdruck |
| --- | --- | --- |
| 2 | unbedingt | `RETURN datum/void` |

### Explizite SQL-Fehler dieses Overloads

Keine eigene RAISE-EXCEPTION-Anweisung. Fehler können aus delegierten Funktionen, Typkonvertierung oder Datenbank-Constraints stammen.

## Transaktion, Idempotenz und Folgewirkungen

- SQL-Inkrement ist ein atomisches UPDATE; Wiederholung zählt erneut. Ohne RPC gibt es keinen Client-Fallback-Zählvertrag (#675).

**Direkt referenzierte reale Relationen:** `public.marketplace_items`.

**Transitive reale Relationen:** `public.marketplace_items`.

Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.

### Direkte und transitive DML-Effekte

| Funktion | Operation | Relation | Spalten | Bedingungspfad |
| --- | --- | --- | --- | --- |
| increment_marketplace_downloads | UPDATE | `public.marketplace_items` | downloads | Optionale Installation |

## Alternative Installationsquellen

Dies sind unabhängige Skriptvarianten derselben Signatur, keine nebeneinander wirksamen Overloads.

### src/supabase/add_marketplace_rpc.sql

[src/supabase/add_marketplace_rpc.sql](../../../src/supabase/add_marketplace_rpc.sql) (Zeilen 1–17, SHA-256 `450d3ba94e44b796ce64bf8c5e2a7a82f53f37b23574f5b1a8dfd1ef1550c670`)

**Deklarierte EXECUTE-Rollen:** PUBLIC, authenticated.

### src/supabase/deploy_marketplace.sql

[src/supabase/deploy_marketplace.sql](../../../src/supabase/deploy_marketplace.sql) (Zeilen 146–160, SHA-256 `fcd99e2ea5dc98bd3b5284e8c2a69f532071be45ccdb66abf58ebfc31c57c38b`)

**Deklarierte EXECUTE-Rollen:** PUBLIC, anon, authenticated.

**Mitinstallierter Tabellen-/Policy-/Trigger-Vertrag:**

```sql
CREATE TABLE IF NOT EXISTS marketplace_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), type text NOT NULL CHECK (type IN ('world', 'adventure', 'character', 'item', 'ruleset')), title text NOT NULL, description text, author_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE, data jsonb NOT NULL DEFAULT '{}', rating numeric(3, 2) NOT NULL DEFAULT 0.00 CHECK (rating >= 0 AND rating <= 5), downloads integer NOT NULL DEFAULT 0, price numeric(10, 2) NOT NULL DEFAULT 0.00 CHECK (price >= 0), image_url text, tags text[] DEFAULT CAST(ARRAY[] AS text[]), is_featured boolean NOT NULL DEFAULT FALSE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE marketplace_items ENABLE ROW LEVEL SECURITY ;
CREATE POLICY "Marketplace items are viewable by everyone" ON marketplace_items AS PERMISSIVE FOR select TO PUBLIC USING (TRUE);
CREATE POLICY "Authenticated users can create marketplace items" ON marketplace_items AS PERMISSIVE FOR insert TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update their own marketplace items" ON marketplace_items AS PERMISSIVE FOR update TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can delete their own marketplace items" ON marketplace_items AS PERMISSIVE FOR delete TO authenticated USING (auth.uid() = author_id);
CREATE TRIGGER marketplace_updated_at BEFORE UPDATE ON marketplace_items FOR EACH ROW EXECUTE PROCEDURE update_marketplace_updated_at();
CREATE TRIGGER marketplace_items_guard_privileged_columns BEFORE INSERT OR UPDATE ON public.marketplace_items FOR EACH ROW EXECUTE PROCEDURE public.marketplace_items_guard_privileged_columns();
```

**Mitinstallierter Trigger-Helper:**

```sql
CREATE OR REPLACE FUNCTION update_marketplace_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Caller: Request-Mapping, Response-Decoding und Fehler

### src/infrastructure/marketplace/marketplace-service.ts:242

AST-Auflösung: `string-literal`; SHA-256 `01b4f9b1474046827459e2930c90fc80b0cde69a70fda0e6cc043be46454c18f`.

Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:

```typescript
export async function incrementDownloads(id: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('increment_marketplace_downloads', {
      item_id: id,
    });

    if (error) {
      console.error(
        'increment_marketplace_downloads RPC failed (no client counter write):',
        error.message,
      );
    }
  } catch (error) {
    console.error('Error incrementing downloads:', error);
  }
}
```

Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:

| Symbol | Quelle | Zeile | SHA-256 |
| --- | --- | --- | --- |
| `viteEnv` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 3 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 5 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `configuredSupabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 6 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseUrl` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 40 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabaseAnonKey` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 41 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| `supabase` | [src/lib/supabase.ts](../../../src/lib/supabase.ts) | 43 | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

## Konkrete Abnahmekriterien

- [ ] Optionale Installation ausdrücklich auswählen und im Zielmodell bestätigen; full-migration-chain darf nicht fälschlich eine vorhandene Funktion behaupten.
- [ ] Vorhandenes Item erhöht atomar um1; unbekannteID/NULLID sind No-op, NULLZähler-Verhalten separat prüfen.
- [ ] Öffentliche/anon Aufrufbarkeit und DEFINER/search_path-Scope durch expliziten Nachfolgervertrag festlegen; kein stiller authenticated-only Anspruch.
- [ ] RPC fehlt bzw. liefertFehler: Adapter loggt und bricht ab ohne direkten downloads-Update (#675 client-trust); Zählverlust sichtbar, kein privilegierter Client-Write.

Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.

## Legacy-Defekte und offene Entscheidungen

### Medium — RPC-DEPLOY-OPTIONAL-MARKETPLACE

Die Funktion existiert nur in optionalen src/supabase-Installationsskripten und fehlt in der vollständig eingespielten Repository-Migrationskette.

**Beleg:** src/supabase/add_marketplace_rpc.sql und src/supabase/deploy_marketplace.sql; isolierter pg_proc-Katalog enthält keine increment_marketplace_downloads.

**Erforderliche Nachfolger-Abnahme:** Eindeutige Installations-/Nachfolgerentscheidung; Counter nur über installierte RPC oder Host-Nachfolger — kein Client-Write-Fallback.

### Medium — RPC-ACL-MARKETPLACE-DEFINER

Optionale Downloadfunktion ist SECURITY DEFINER ohne search_path-Pin und ohne Akteurprüfung bei bestehenbleibendem PUBLIC-EXECUTE.

**Beleg:** Beide optionalen SQL-Skripte: keine REVOKE PUBLIC, keine SET search_path, kein auth.uid-Guard.

**Erforderliche Nachfolger-Abnahme:** Gewünschte öffentliche Zählberechtigung explizit festlegen; Tabellenqualifizierung/Ausführungskontext und Abuse-/Retry-Semantik prüfen.

## Vollständige Quellenbindung

Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in [.qa/intake/rpc-contracts/postgres-proof.json](postgres-proof.json).

| Quelle | SHA-256 |
| --- | --- |
| [src/infrastructure/marketplace/marketplace-service.ts](../../../src/infrastructure/marketplace/marketplace-service.ts) | `01b4f9b1474046827459e2930c90fc80b0cde69a70fda0e6cc043be46454c18f` |
| [src/lib/supabase.ts](../../../src/lib/supabase.ts) | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |
| [src/supabase/add_marketplace_rpc.sql](../../../src/supabase/add_marketplace_rpc.sql) | `450d3ba94e44b796ce64bf8c5e2a7a82f53f37b23574f5b1a8dfd1ef1550c670` |
| [src/supabase/deploy_marketplace.sql](../../../src/supabase/deploy_marketplace.sql) | `fcd99e2ea5dc98bd3b5284e8c2a69f532071be45ccdb66abf58ebfc31c57c38b` |
