# SagaTree – SQLite-basierte, local-first Architektur

> **Status:** Architekturvorschlag / Migrationsziel, **keine** bereits implementierte Architektur.  
> **Stand:** 19.10.2026 · **Zielpfad:** `docs/architektur-sqlite-based.md`  
> **Referenz:** GitHub-`main` zum Zeitpunkt der Bestandsaufnahme. Lokale, nicht gepushte Änderungen können abweichen.  
> **Prinzip:** Die Produktinvarianten gelten unabhängig von SQLite, PostgreSQL, PocketBase, Hono, Node.js, Desktop-Framework, Transport und KI-Anbieter.

## 1. Entscheidung und Nichtziele

**Zielbild:** SagaTree ist eine Open-Source-, self-hosted- und perspektivisch local-first TTRPG-Plattform mit **einer** geteilten, UI- und Datenbank-unabhängigen Domain-/Rules-Engine. Solo/Puppeteer, GM-gehostete Sitzungen auf Desktop/LAN und dauerhaft gehostete Spielrunden auf einem VPS nutzen dieselben fachlichen Verträge. Ein optionaler zentraler Hub erleichtert Einladungen, Erreichbarkeit oder Hosting, ist aber **keine Voraussetzung** für lokales Spiel oder LAN-Sessions.

**Vorgesehene Standardumsetzung:** React/Vite weiterverwenden; TypeScript-Backend mit Node.js + Hono, SQLite + Drizzle, Better Auth für remote erreichbare Host-Instanzen, zugriffskontrollierter lokaler Storage, WebSocket-Kommandos und -Events; optionale Ollama-/RAG-Adapter. Das ist eine **austauschbare Referenzimplementierung**, kein Auftrag, alle Bibliotheken sofort zu installieren.

**Nichtziele des ersten Inkrements:** vollständige Supabase-Abschaltung, globales Login/Föderation, Cloud-SaaS-Multi-Tenancy, automatischer plattformübergreifender Offline-Merge, obligatorische Relay-Infrastruktur, eigener App-Store/Marketplace, Datenbank pro Figur, Neo4j-/Qdrant-/Redis-Migration um ihrer selbst willen oder Tauri-Festlegung.

**Wichtige Entscheidungsvorbehalte:** Eine später zentral skalierte Multi-Instanz-Plattform kann PostgreSQL erfordern. Eine lokale Desktop-Verpackung ist erst nach einem technischen PoC zwischen Tauri+Sidecar und Electron zu entscheiden. Keine der beiden Entscheidungen darf das Domain-Modell verändern.

## 2. Technologieunabhängige Grundregeln (MUSS)

1. **Eine autoritative Wahrheit je Aggregat und Zeitpunkt.** Kein gleichzeitiges Schreiben derselben Welt/Session in alte und neue Datenhaltung; kein unkontrolliertes Multi-Master.
2. **Serverautoritatives Multiplayer.** Clients schicken validierbare `commands`; sie dürfen weder privilegierte Felder noch finale Kampf-/Weltzustände frei setzen. Solo-Instanzen nutzen denselben Validierungspfad.
3. **Authentifizierung ≠ Autorisierung.** Identität, Instanzrolle, Saga-Mitgliedschaft, GM-Rolle, Eigentum, Freigaben und Aktionsberechtigungen werden einzeln geprüft; IDs, URLs, JWT-Besitz oder Einladungslinks alleine erteilen niemals Rechte.
4. **Deny by default, fail closed.** Bei Fehlern, fehlender Mitgliedschaft, inkonsistenter Relation, undefiniertem Permission-Kontext oder abgelaufenen Einladungen niemals fremde/geheime Daten liefern.
5. **Sichtbarkeit auf Daten- und Transporteebene.** `gm_only`, `public`, `discovered`, `character_specific`, `program` und vergleichbare Klassifizierungen werden **vor** HTTP-Antwort, WebSocket-Event, Dateiabruf, KI-Prompt und RAG-Retrieval gefiltert. CSS-Verstecken zählt nicht.
6. **Explizite Ereignis- und Revisionssemantik.** Snapshot + monotone Revision + `expectedRevision` + `idempotencyKey`; kein stilles Last-Write-Wins. Ereignisse dokumentieren Vorgänge, sind aber ohne bewusste Entscheidung kein vollständiges Event-Sourcing.
7. **Portabilität ohne Verlust.** Export-/Import-Formate sind versioniert; stabile interne Identitäten, öffentliche IDs und Referenzen bleiben nachvollziehbar; unbekannte Felder werden nicht still gelöscht.
8. **Klar getrennte Verantwortlichkeiten.** Domain-/Rules-Kernel ist unabhängig von React, SQLite, Netzwerk und KI; Infrastruktur kapselt Persistenz/Auth/Transport/Storage; App-Slices sprechen nur definierte Verträge an.
9. **Datenhoheit und Offline-Fähigkeit sind echte Produktverträge.** Offline-Aktionen, deren Verbindlichkeit eine Host-Entscheidung benötigt, sind zunächst Entwürfe bzw. ausstehende Befehle, niemals still als endgültig bestätigt.
10. **Keine impliziten Game-Lore-Fakten.** Vorschläge/KI-Dekoration dürfen weder Weltkanon noch tatsächliche Geografie oder Spielregeln ohne autorisierte Bestätigung verändern.
11. **KI ist optional und begrenzt.** Spielen ohne Modell muss möglich sein; Secrets bleiben serverseitig, Modelloutputs sind nicht autoritativ, Quellen und Berechtigungen werden vor Prompt-Bau kontrolliert.
12. **Betrieb ist Teil der Architektur.** Backups, Restore-Proben, Datenmigration, Dateikonsistenz, Logging, Updates, Rollback, Limits und sichere Defaults sind Pflicht.
13. **Einfachster funktionierender Schnitt.** Keine zweite Game-Engine, kein zweiter ungeprüfter Weltbaum, kein bloß vorsorgliches Microservice-System.

## 3. Betriebs- und Vertrauensmodelle

| Modus | Autorität | Netzwerk | Persistenz | Identität |
| --- | --- | --- | --- | --- |
| Solo / Puppeteer | lokale SagaTree-Host-Runtime | kein Internet nötig | lokale DB und Assets | lokale Identität; kein Cloudkonto |
| GM-Host im LAN | GM-Host | LAN | DB und Assets des GM | instanzbezogene Konten/Gäste |
| GM-Host über Internet | GM-Host auf PC/VPS | HTTPS/WSS, ggf. Vermittlung | DB und Assets des GM | instanzbezogene Konten/Gäste |
| Optionaler SagaTree Hub | **nicht** Autorität der Welt | freiwillige Internetdienste | nur ausdrücklich vereinbarte Hub-Daten | optional verknüpfbare Identitäten |
| Optionaler großer SaaS-Betrieb | autoritative Instanz je Saga/Partition | zentrale Cloud | getrennte Datenräume, ggf. PostgreSQL | zentrale Identity-Lösung |

**Beispiel Donalu/Dornhain:** Der GM hält Kanon, Welthierarchie, Kartengeometrie, Geheimnisse, laufende Sessions und deren Ereignisse. Spieler halten persönliche Figurenentwürfe und portable Charakterdaten. Beim Beitritt wird eine **Session-Kopie/Bindung** des Charakters erzeugt. Während der Session sind die vom GM-Host akzeptierten Spielaktionen autoritativ. Nach der Session erfolgt eine explizite, revisionsgeprüfte Promotion akzeptierter Änderungen in den persönlichen Charakterbestand. Diese Bindung darf keine fremden Charaktere editierbar machen.

**Problemfall „GM offline“:** Remote-Spieler verlieren den Zugang zu hostgebundenen Inhalten; ihre eigene lokale Kopie/Exports bleiben nutzbar. Für dauerhaft erreichbare Welten ist ein eigener VPS möglich. Ein zentraler Hub ist kein Ausfall-Fallback für private Welten ohne bewusste Datenfreigabe.

**Internet-Erreichbarkeit:** Browser-Clients können einen heimischen Host nicht generell direkt erreichen. HTTPS-Domain, Reverse Proxy, Firewall, Ports/NAT und ggf. ICE/STUN/TURN bzw. Relay sind als eigener optionaler Verbindungspfad zu planen. Gastzugänge dürfen kein ungeschütztes öffentliches Admin-Panel eröffnen.

## 4. Komponenten und Verträge

| Schicht | Fachliche Verantwortung | Referenztechnologie | Austauschbarkeit / Regeln |
| --- | --- | --- | --- |
| UI | Editor, Live-Ansicht, Solo, Player/GM Journeys | React + Vite | keine DB- oder RLS-Entscheidungen im UI |
| Domain/Rules | Character, World, Atlas, Saga, Sessions, Permissions, KI-Kontextverträge | reines TypeScript | keine React-, Runtime-, DB-, Netzwerkimports |
| Use Cases/Host | Commands, Transaktionen, Revisionschecks, Projektionen, Einladungen | TypeScript-Dienste | nicht HTTP-spezifisch |
| API | HTTP-Endpunkte, Middleware, Eingabevalidierung, Fehlercodes | Hono + Node.js | Auth + Policy vor schreibender Aktion |
| Realtime | Session-Kommandos, autorisierte Ereignisse, Reconnect, Snapshot | WebSockets / `ws` | Transport austauschbar; Protokoll versioniert |
| Identity | Login, Passwörter/Provider, Sitzungen | Better Auth | Solo-Gast != globales Login; sichere Cookies/Tokens |
| Authorization | GM-/Spieler-/Owner-Rollen, Knowledge-Reveal, Feld-/Asset-Sicht | SagaTree Policy Layer | Ersatz funktionaler RLS-Garantien |
| DB | persistente relationale Objekte und Transaktionen | SQLite + Drizzle | `Repository`-Port; keine SQL-Typen im Domain-Kernel |
| Assets | Originale/Derivate, Karten, Porträts, GLB/VRM, Metadaten | lokales Dateisystem | Pfade/URLs niemals Zugriffsrechte |
| KI/RAG | Provider, Prompts, Retrieval, Embeddings, Model-Policy | Ollama, FTS5, optional sqlite-vec | KI optional; Retrieval muss Viewer beachten |
| Observability/Betrieb | Migrationen, Backup, Health, Audit, Logs, Limits | einfache Host-Tools | reproduzierbarer Betrieb ohne SaaS-Pflicht |

**Kein unnötiger Prozess-Split:** API, Auth, Berechtigungen, Datenbankzugriff und WebSockets dürfen im gleichen Node.js-Prozess laufen. Lokaler Modell-Server ist optional separat. Medien-SFU (z. B. LiveKit) bleibt eine eigene, **optionale** Media-Plane; WebSocket-State ersetzt keine Audio-/Video-Infrastruktur.

## 5. Domänenmodell und Datenverantwortung

**Vor Migration inventarisieren und versionieren:** `UserIdentity`, `HostAccount`, `Character` (persönliche Bibliothek), `CharacterSessionBinding`, `WorldProfile`, `WorldNode`, `AtlasMap`, `SagaDefinition`/`SagaVersion`, `Project` (Gruppendurchlauf), `Session`, `SessionRuntimeState`, `SessionEvent`, `KnowledgeFact`, `Reveal`, `Asset`, `AIContextEntry`, `Invite`, `Membership` und `AuditEntry`. Bezeichnungen exakt am aktuellen Domain-Contract verifizieren, statt parallele neue Wahrheiten einzuführen.

**Bestehende Semantik bewahren:**

- World-Atlas: `world > continent > country > place > building > room`, vorhandene IDs/Links/Primary Maps erhalten, keine erfundenen Zwischenebenen oder Kartengeometrien. Root pro WorldProfile; bestehende Atlas-Prototypen nicht als zweite kanonische Wahrheit.
- Saga-Definition/Saga-Version ≠ Project/Durchlauf ≠ Live-Session. Öffentliche IDs sind Routing-/Anzeigehilfen, keine Autorisierung.
- Live-Runtime: `SessionRuntimeState` besitzt eine Revision, Commands verlangen `expectedRevision`; Commit + Event atomar und danach clientgerechte Projektion.
- Knowledge: `gm_only`-Fact-Bodies bleiben aus Spielerantworten, Dateimetadaten und KI-Prompts ausgeschlossen.
- Assets: DB hält Hash, MIME, Größe, Eigentümer, Referenzen, Sichtbarkeit und Dateischlüssel; originale Bytes im Asset-Store. Dateischlüssel nie aus unvalidiertem Clientpfad übernehmen.
- KI-/Loregraph: eindeutige Quelle für Fakten und Relationen; abgeleitete Volltext-/Embedding-Indizes sind jederzeit regenerierbare Read-Modelle.

### Charakter-Portabilität (separates fachliches Protokoll)

1. Spieler exportiert einen versionierten Charakter mit stabiler lokaler ID und Quellversionskennung.
2. GM-Host importiert/bindet **eine Kopie**; unvertrauenswürdige Fremdfelder werden validiert.
3. `sessionCharacterId` und Besitzer-/Quellreferenz sind explizit; kein stiller Identitätsswap.
4. Session-Aktionen ändern den autoritativen Session-Zustand und protokollieren relevante Character-Deltas.
5. Nach Abschluss erstellt der GM-Host ein nachvollziehbares, signiertes oder anderweitig verifizierbares Ergebnis-Paket; dessen konkrete Vertrauenskette ist vor Implementierung zu spezifizieren.
6. Spieler prüft dieses Paket gegen den lokalen Ausgangsstand. Konflikte führen zu Review/Merge oder Ablehnung; niemals ungeprüftem Überschreiben.
7. Import/Export muss ohne SagaTree-Hub möglich sein. Spätere automatische Sync benutzt denselben Vertrag.

**Nicht automatisch lösen:** Mehrere PCs bearbeiten dieselbe Spielfigur offline. Dafür braucht es getrennte Versionen, Merge-Regeln je Feld und einen expliziten Konfliktdialog. Ein globaler `updated_at`-Zeitstempel reicht nicht.

## 6. Autorisierung als RLS-Ersatz

Supabase-`auth.uid()`, Postgres-RLS, `SECURITY DEFINER`-RPCs und Storage-Policies sind derzeit Teil des **Sicherheitsmodells**. Ein Wechsel zu SQLite/Better Auth entfernt diese Garantien und muss sie vollständig in eine **serverseitige Policy-Schicht** übertragen; Better Auth authentifiziert, autorisiert aber nicht automatisch alle SagaTree-Use-Cases.

**Mindestprüfungen pro API/Command/Realtime/Event/Asset/RAG:** authentisierte Host-Identität, Instanzkontext, Eigentümer, Saga-/Session-Mitgliedschaft, GM-/Editorrolle, Zielcharakter-Bindung, Berechtigungen auf referenzierten Fremdschlüsseln, Sichtbarkeit jedes Feldes und jeder Datei, Revisions-/Idempotenzprüfung. Login als „lokaler Admin“ darf auf öffentlichem Hosting niemals über eine triviale Fallback-Identität erreichbar sein.

**Sicherheitsrelevante Fälle:** Fremder liest Welt/Quest; Spieler sieht versteckte Kartengeometrie; angepasster Request setzt `gm_only`; Spieler errät Asset-URL; unverifizierter Session-Code erlaubt Join; berechtigte Person greift über manipulierten characterId auf andere Figur zu; Nutzer sieht geheime Embedding-Treffer; Client lässt beim Reconnect alte Rechte wiederaufleben. In jedem Fall **kein Geheimnis** in Body, Broadcast, Debug-Log oder abgeleitetem KI-Kontext.

**Defensive Defaults:** Host-API nur mit sicherem Bind und TLS öffentlich; Rate Limits, Session-/CSRF-Schutz für Cookie-APIs, sichere Upload-Validierung, parameterisierte SQLs, erlaubte MIME-Typen, Pfadnormalisierung, Security Headers, Secret Rotation, Backup-Zugriffsschutz und kontrollierte Admin-Operationen.

## 7. SQLite-spezifische Umsetzung

- **Instanzmodell:** eine lokale SQLite-Datenbank **je Host-Installation**, mehrere Welten/Sagas pro DB. Kein Shared-File-Zugriff über mehrere Netzwerkserver. Ein optionaler zentraler Hoster bekommt eine separate Partitionierungsentscheidung.
- **Schema:** typisierte Drizzle-Schemata, explizite Fremdschlüssel/Constraints, eindeutige Indizes, referenzielle Integrität; JSON-Felder nur für semistrukturierte Daten statt für sämtliche Beziehungen.
- **SQLite PRAGMAs:** `foreign_keys=ON`; WAL nach Workload-/Speicher-/Backup-Tests; `busy_timeout` und Schreibkonkurrenz mit Lastprofil testen. Migrationen reproduzierbar und auf alten Datenbeständen rückwärtsverträglich gestalten.
- **Transaktionen:** Command-Commit atomar: Berechtigung auf aktuellem Stand prüfen, Revision vergleichen, Daten ändern, Ereignis/Idempotenzschlüssel schreiben. Keine externen KI-/Datei-/Netzwerkaufrufe innerhalb langlaufender Schreibtransaktionen.
- **WAL/Backup:** WAL gehört zum Datenbankzustand. Nur mit offizieller Backup-Methode/konsistentem Checkpoint/Snapshot sichern; kein naives Kopieren allein von `.db` bei laufenden Writes. Assets + DB-Metadaten müssen gemeinsam restaurierbar sein.
- **Ein Writer:** viele Leser, ein aktiver Schreiber; Locking, Retry, Lastspitzen und große Atlas-Updates unter 2, 5, 20+ Spielenden testen. Bei Bedarf Commit-Batching/Write-Queue **erst nach Messung**.
- **Funktionen & Trigger:** `pgcrypto`, `uuid-ossp`, JSONB-Operatoren, `auth.uid()`, PL/pgSQL, Policies, RPC, `SECURITY DEFINER`, `pgvector`, PostgREST und Realtime **nicht 1:1 portieren**. Pro Funktion Verhalten, Eingaben, Berechtigungen, Idempotenz, Datentypen und Fehlermeldungen kartieren.
- **FTS/RAG:** SQLite FTS5 zuerst; optional `sqlite-vec` mit festem Embedding-Modell, Dimensionsvertrag, Versionierung, Re-Embedding-Prozess, Index-Rebuild und Tests für semantische Qualität. Vor Produktionsfreigabe Reife und binäre Kompatibilität der Erweiterung auf Linux/macOS/Windows prüfen.
- **DB-unabhängig bleiben:** Ports für Repository/Transactions/Search. Kein `sqlite-vec`, `better-sqlite3`, Drizzle oder SQL in `src/domains/**` importieren. PostgreSQL könnte später einen zweiten Adapter liefern.

## 8. Multiplayer-Protokoll, State und Transport

```text
Client action + idempotencyKey + expectedRevision
  -> authentication + host permission + input validation
  -> deterministic SagaTree use case
  -> one atomic DB transaction + event
  -> new revision + server-side viewer projection
  -> authorized HTTP/WS responses
  -> reconnect: current snapshot then events / resync
```

- Auf Server bestätigte Aktionen dürfen nicht auf reine Client-Optimistik beruhen. Ein lokales Pending-UI ist möglich; bei Ablehnung muss es korrigierbar sein.
- Snapshot-then-subscribe muss Rennen zwischen Laden und Abonnement abfangen (Cursor/Revision/Replay oder gezieltes Resync).
- Pro Command Protokollversion, Typ, Actor, Session, expectedRevision, Idempotenz, sichere Fehlerform und Korrelation definieren.
- Presence ist flüchtig; Persistenz nur, wenn fachlich nötig. Netzwerkverlust darf keine geisterhaften Spieler oder doppelte Session-Events erzeugen.
- Realtime-Nachrichten und Asset-Links sind **viewer-spezifisch**; keine GM-Originalsnapshots an Spieler broadcasten.
- Session-Commands werden hostseitig serialisiert bzw. transaktional geordnet; gleichzeitige Würfe/Bewegungen brauchen deterministische Semantik.
- Kollaborativer Atlas-Editor: zunächst Revision/Conflict/Refresh; CRDT (Yjs) nur für nachgewiesenen Bedarf gemeinsamer zeitgleicher Bearbeitung – nicht für autoritative Kampf-/Wirtschaftsregeln.

## 9. Lokale KI, RAG und Graph

- **Trennung:** Faktenquelle in relationalen Domänen; Retrieval-Index als ableitbarer Cache; LLM als austauschbarer Generator.
- **Hybrid Search:** strukturierte Nachschlagewege (IDs, Orte, NPC-Beziehungen) + FTS5; semantische Vektorsuche nur dort, wo der Anwendungsfall tatsächlich profitiert.
- **RAG-Sicherheit:** Berechtigungen **vor** Prompt-Bau; Index muss Welt, Version und Zugriffskontext referenzieren; nicht erst den fertigen generierten Text „zensieren“.
- **Graph:** Relationen `entity -> relation -> entity` zunächst in relationaler Tabelle; Neo4j nur bei nachgewiesenem komplexem Traversal-Bedarf.
- **Modellversionen:** Embeddings an Provider/Modell/Dimension/Indexversion binden; Wechsel erfordert reproduzierbare Neuindizierung.
- **Ressourcen:** Ollama/Embeddings brauchen extra CPU/GPU/RAM; offener Self-Host muss auch ohne lokale Modelle startbar sein. Abhängige KI-Features zeigen einen klaren „nicht verfügbar“-Zustand.
- **Prompt-Injection:** Benutzer-/Lore-Texte sind Daten, keine Sicherheitsanweisungen; keine Tool-/Datei-/Netzwerkprivilegien über generierte Inhalte.
- **Puppeteer:** identische Rules-/Persistence-Verträge; KI-Agent agiert als durch Policies eingeschränkter Akteur. Kein separater Fork als Standard.

## 10. Storage, Medien, 2D/3D und LiveAct

- Originaldateien, Derivate, öffentliche/sichtbare Referenzen und Cache-Assets unterscheiden. Alle Uploads werden größen-, MIME-, Inhalts- und Besitzer-geprüft.
- Keine beliebigen lokalen Dateipfade, Path Traversal, Symlink-Escapes oder ungeschützte `/assets/secret...`-Routen.
- Große GLB/VRM, Atlas-Dateien, Texturen und Vorschaubilder mit Hash/Content-ID, Referenzzählung, robustem Teilupload-/Abbruchverhalten und Limits.
- Sicheres Asset-Lifecycle: Upload in temporären Bereich -> Validieren -> atomar veröffentlichen -> Metadaten-Commit bzw. aufräumbares Orphan-Protokoll. DB und FS sind **nicht** dieselbe Transaktion.
- Player-safe Atlas-Projektionen inklusive Asset-Zugriff, Map-Liste, Map-Payload und Titel; niemals ausschließlich UI-Sichtfilter.
- LiveAct / Media-Plane (Audio/Video/Streaming) ist nicht dasselbe wie Game-State-Realtime. Bereits bestehendes optionales LiveKit-Konzept beibehalten, nicht durch einfache WebSockets ersetzen.
- Bestehende `CE-*`, `IV-*`, `AU-*`-Contracts bei UX-/Visualisierungsänderungen unverändert erfüllen.

## 11. Auth, Identität und Portabilität

- Better Auth verwaltet **Host-Accounts**; es ist nicht automatisch eine globale SagaTree-Identität. Jeder Self-Host hat eigenen Vertrauensraum.
- Öffentliche Einladungscodes sind kurzlebig, widerrufbar, gehasht wo sinnvoll, rate-limitiert, scope-/role-gebunden; GM-Freigabe je nach Spielregel.
- Solo-Modus ohne Passwortzwang, aber **keine** Privilegienübertragung auf remote erreichbare Bind-Adresse.
- OAuth/Passkeys/SSO nur falls nötig; Desktop-App und Browser müssen Cookie-/Token-Speicherung und Redirects getrennt modellieren.
- Charakterportabilität ist **nicht** Account-Föderation. Signierte/verifizierbare Exporte, Revisionsketten und Consent sind separat zu definieren.
- Rechte- und Besitzwechsel (GM-Transfer, Welt-Fork, Saga-Archivierung, Spieleraustritt) benötigen eigene Use-Cases und Tests.

## 12. Migrationsinventar: Supabase -> neue Ports

| Supabase-Bestandteil | Ziel/Adapter | Abnahmekriterium |
| --- | --- | --- |
| GoTrue / `supabase.auth` | Better Auth + lokale Identity-Abstraktion | Login/Logout/Session/Recovery ohne übertragene Fremdrechte |
| PostgreSQL-Tabellen/Migrationen | Drizzle/SQLite Schema | referenzielle Integrität, Datenparität, öffentliche IDs |
| RLS / Rollen / Storage Policies | serverseitige Policies | negative Zugriffstests pro Owner/GM/Player/Viewer |
| RPC/PLpgSQL/SECURITY DEFINER | atomare Domain-Commands | gleiche fachliche Regeln, Fehlerfälle, Revisionssemantik |
| PostgREST `.from()` | Hono-API + Repository | zugriffskontrollierte Read-Modelle und Paging |
| Realtime `postgres_changes` | WS-Events + Snapshot/Replay | kein Eventverlust nach Reconnect, nur erlaubte Daten |
| Storage-Buckets / Signed URLs | FS + autorisierte Download-Route | sichere Dateien, Ablauf, Löschung, Referenzen |
| Edge Functions (Deno) | Node-Use-Cases/Adapter | Auth, Secrets, Rate Limits, CORS und Fehlersemantik erhalten |
| Redis | in-process Cache nur soweit sicher | Neustart darf kanonische Daten nicht löschen |
| Neo4j / `world_graphs` | SQL-Relationen / optional Graph-Port | referenzielle Lore-Konsistenz |
| pgvector / RAG | FTS5, optional sqlite-vec | Retrieval-/Sichtbarkeitstest bestanden |
| Service-Keys/Webhooks | Host-interne Rollen/Secrets | keine Client-Service-Privilegien |
| Supabase-Provisioning | idempotenter Bootstrap-Use-Case | Dornhain/Starterdaten nur einmal, ohne fremde Welt zu überschreiben |

**Repo-spezifische Berührungspunkte (Beispiele, nicht vollständige Suche):**  
`src/lib/auth-context.tsx`; `src/lib/supabase.ts`; `src/infrastructure/world/world-atlas-service.ts`; `src/infrastructure/session/session-runtime-service.ts`; `src/infrastructure/session/session-runtime-channel.ts`; `src/infrastructure/character/supabase-character.repository.ts`; `supabase/functions/**`; `supabase/migrations/**`; `docker-compose.yml`.

**Gesondert aufnehmen:** Bestehender Einladungs-/Join-Code, LiveKit-Tokens, Avatar-/Meshy-Provider, Sessions-Recap, Character-Lore, Rate-Limit-RPCs, Storage-Bucket-Policies, gesetzte CORS-/JWT-Gates, Local-Admin-Sonderwege sowie jegliche branch-lokalen Atlas-/2D-3D-Änderungen.

## 13. Stufenplan und verpflichtende Exit-Gates

### P0 – Evidence Lock und ADRs (kein Produktionswechsel)

- [ ] Aktuellen `main`-Stand plus lokale/uncommittete Arbeit inventarisieren; `docs/`, `.qa/design/`, `AGENTS.md` und bestehende Tests gelten als Vertragsgrundlage.
- [ ] Feature-/Tabellen-/RPC-/Policy-/Edge-/Storage-/Realtime-Matrix inklusive Datenbesitz und Sichtschutz erstellen.
- [ ] Golden Fixtures: Donalu -> Dornhain, GM, zwei Spieler, geheime NPCs/Maps, Session mit konkurrierenden Actions.
- [ ] Vollständige Backup- und Restore-Probe des Alt-Systems.
- [ ] ADRs: Host-Autorität, Charakter-Portabilität, Solo-Identity, SQLite vs zentral Postgres, Streaming/Media, Desktop-Packaging.
- [ ] Negative Authz-Tests und UI-Screenshots des Altverhaltens einfrieren.

**Gate P0:** Jedes kritische Altverhalten hat einen Test bzw. dokumentierten manuellen Beweis; offene Entscheidungen explizit aufgelistet.

### P1 – Host-Skeleton ohne Migrationszwang

- [ ] `server/` als ein Node/Hono-Prozess mit Health, SQLite, Drizzle-Migrationen, lokalen Assets und sicheren Defaults.
- [ ] bestehende `src/domains/**`-Verträge wiederverwenden, minimal nötige Ports in Infrastruktur; keine Frontend-Fork.
- [ ] Welt-/Atlas-Read und eine revisionsgeschützte Write-Operation mit persistenter DB.
- [ ] Prozess-Neustart, WAL/Locking, Datenintegrität und Linux/macOS/Windows-Hostfähigkeit testen.
- [ ] Docker-/CLI-Dev-Setup ohne Cloudzwang, Datenverzeichnis persistent.

**Gate P1:** Dornhain offline ohne Supabase start-/les-/editierbar; nach Neustart identisch; fehlerhafte Writes atomar abgewiesen.

### P2 – Rechte und Multiplayer

- [ ] Host-Konten/Gäste und Join-Protokoll; eigenes Autorisierungsmodul mit Deny-by-default.
- [ ] `SessionRuntimeState`-Commands, `expectedRevision`, Idempotenz, append-only Events, Snapshots.
- [ ] WebSocket-Verbindung inkl. Resync/Replay, Presence und korrektem Disconnect.
- [ ] Zuschauer-/Player-/GM-Projektionen; private Maps, NPCs, Knowledge-Refs und Dateien auf API/WS sperren.
- [ ] Fremd- und manipulierte Zugriffsszenarien automatisiert testen.

**Gate P2:** GM + zwei Spieler spielen mit korrekten Revisions-/Rechteprüfungen; kein Spieler liest ein geheimes Feld oder fremde Daten.

### P3 – Portabilität und Personal-Data-Sync

- [ ] versionierter Charakter-Export/Import ohne Hub.
- [ ] Bound Session Copy + genehmigbare Session-Ergebnisse.
- [ ] Konfliktfälle: lokale Änderung während Session, Abbruch, doppelte Promotion, anderes Host-Konto, verlorener Export.
- [ ] mobile/browser IndexedDB-Strategie und Desktop-Persistenz getrennt testen.
- [ ] Backups, Löschung, Welt-Fork, Import und Eigentumswechsel üben.

**Gate P3:** Figur von Host A zu Host B portierbar, Session-Ergebnis sicher rückführbar; kein stiller Datenverlust.

### P4 – Media, KI und RAG

- [ ] geschützte lokale Storage-API + Upload-Protokoll und Restore.
- [ ] bestehende Meshy/Look/Avatar-Funktionen über Provider-Adapter migrieren.
- [ ] Ollama und Cloud-kompatible KI als optionale Provider; keine Secrets im Browser.
- [ ] FTS5/strukturierte Suche mit Lore-Sichtprüfung; vec-Extension nach realem Retrieval-Benchmark.
- [ ] Neo4j-/Cache-Entfall **nur** bei bestätigter Feature-Parität.
- [ ] Medien-LiveKit und LiveAct-Protokolle gesondert regressionsprüfen.

**Gate P4:** RAG antwortet nur aus erlaubten Fakten; alle nicht-KI-Spielwege funktionieren ohne Modelle oder externe APIs.

### P5 – Bestandsdaten migrieren und Supabase ausphasen

- [ ] PostgreSQL->SQLite Mapping mit Typen, IDs, UUIDs, Zeitstempeln, JSON, Beziehungen, Storage, Profilen, Sessions.
- [ ] Migration dry-run mit Zählungen, Hashes, referenzieller Integrität, Alias-/Legacy-Handling, Konflikt- und Abbruchbericht.
- [ ] keine neuen Fakten/Orte/Geometrien während World-Atlas-Migration erfinden.
- [ ] Cutover je Welt/Saga mit Freeze, letztem Delta, finalem Snapshot, Eigentümer- und Eventprüfung.
- [ ] rollbackfähige Umschaltung; bei Rückwechsel dürfen neue Writes nicht ohne Replay verloren gehen.
- [ ] Supabase-Dependencies und Docker-Komponenten **erst** nach Paritäts- und Restore-Nachweis entfernen.

**Gate P5:** Daten-, Rechte-, Feature-, UX- und Betriebsgleichheit auf Test- und echten Bestandswelten; kompletter Restore nach simuliertem Fehler.

### P6 – Desktop, Netzkomfort und optionale Cloud

- [ ] Desktop-Prototyp Tauri+Sidecar vs Electron mit realer SQLite/AI/Asset-Ausführung, Signierung und Updates.
- [ ] direkter LAN-Join ohne Hub; Internet-NAT/Relay optional; Offline-Zustände ehrlich darstellen.
- [ ] optionaler Hub nur mit unabhängigen Contracts und expliziter Datenfreigabe.
- [ ] erst bei echtem Lastprofil SaaS/Postgres-Adapter, horizontale Skalierung und mandantengetrennte Betriebsform evaluieren.

**Gate P6:** Solo und LAN ohne SagaTree-Hub; Remote-Spiel mit sicherem Verbindungspfad; kein implizites Pflichtkonto.

## 14. Tests / Quality-Gates

**Domain:** Regeltests (Würfe, Kampf, Inventar, XP, Konsistenz), World-Hierarchie-Invarianten, Immutability und Versionierung.  
**Persistence:** Migration up/down bzw. Restore, Foreign Keys, WAL, Locks, Crash-/Power-loss-Simulation, Snapshot/Asset-Konsistenz.  
**Multiplayer:** 1 GM + 2 Spieler, 20+ simulierte Clients, Concurrent Commands, Doppel-Retry, Revision-Mismatch, Reconnect, Host-Restart, Lobby-Expiry.  
**Security:** Cross-owner Reads/Writes, GM-Privilege Escalation, guessbare IDs/Assets, Hidden-Lore in REST/WS/Prompt/Embedding, Gast-/Admin-Sonderfälle, CSRF, SSRF, Upload/ZIP/GLB-Bombs, Secret-Leaks.  
**RAG:** Exakte Namen vs semantische Treffer, Embedding-Modellwechsel, FTS-only, Rechtefilter, Prompt Injection, Index-Rebuild, Testdaten ohne GM-Secrets.  
**Portabilität:** Export-/Import-Roundtrip und Versionswechsel, Character-Bindings, Merge-Konflikte, doppelte Sessionpromotion.  
**Betrieb:** Install/Update/Backup/Restore/Migration/Recovery, Ressourcenprofil ohne Ollama, Logs ohne PII/Secrets, Datenvolumen mit großen 3D-Assets.  
**UX:** bestehende `CE-*`, `IV-*`, `AU-*`-Gates; responsive Phone/Tablet/Desktop; offline/pending/conflict/permission states.

**Freigabe:** pro Phase reproduzierbare Checks und Belege in `.qa/`, `npm run test-gate` plus gezielte E2E-/Security-Tests. Keine „fertig“-Meldung ohne nachgewiesene Parität; Security-Funde inkl. Low/Info dokumentieren.

## 15. Risiken und Entscheidungen vor Implementierung

| Risiko/Frage | Vorgabe / Entscheidungsgate |
| --- | --- |
| Browser vs Desktop-Lokalbetrieb | Browser-Sandbox, IndexedDB, Origin-Isolation und Installer getrennt spezifizieren |
| Host ist weg / NAT blockiert | Offline-UI, Self-Host-VPS, optional Relay; kein heimlicher Cloudzwang |
| Wer darf Figurenänderungen zurückschreiben? | Versionsvertrag, Eigentümerfreigabe, Konflikt-/Provenienzmodell |
| Better Auth pro Host statt global | Host-Identitäten erst; föderierte Identität separat |
| RLS verliert DB-Enforcement | verpflichtende Server-Policies und negative Regressionssuite |
| SQL-RPC lässt sich nicht automatisch portieren | transaktionale Use Cases + fachliche Paritätstests |
| WAL/FS-Datenkorruption oder konkurrierende Writes | Backup-API, Test auf OS/FS, Schreiblast- und Restore-Proben |
| sqlite-vec/Native-Module auf Plattformen | Erweiterung optional, Architektur mit FTS-Fallback |
| Medien- und AI-Ressourcen | optionale Profile; klare Degraded States |
| Zentrale Skalierung vs kleine GM-Instanzen | Benchmark vor Postgres-/Multi-Server-Entscheidung |
| Ungepushte Atlas-Änderungen | vor Codearbeiten Stand abgleichen, kein blindes Überschreiben |
| Lizenz und Steam-Vertrieb | `docs/LICENSES.md` und `docs/licensing/**` beachten; Code/SDK/Regelwerk/Assets/Modelle getrennt prüfen |

## 16. Geplanter Repozuschnitt (kein Code-Auftrag)

```text
src/
  domains/                 # bestehender UI-/DB-freier Rules-/Domain-Kernel
  infrastructure/
    session/               # vorhandene Fachfassaden, später Host-Adapter
    world/
    character/
  app/                     # vorhandene Journeys/Vertikal-Slices
  shared/ui/
server/                    # NEU, eigener Build-/Testbereich; Grenze vorab in AGENTS.md registrieren
  src/
    api/                   # HTTP/WS Transport
    auth/                  # Authentifizierung (nicht fachliche Authorization)
    permissions/           # autoritative Policies
    application/           # Commands/Queries/Transactions
    persistence/           # SQLite/Drizzle/FTS Adapter
    assets/                # kontrollierter FS-Store
    ai/                    # Provider & Retrieval Adapter
    bootstrap/             # Host-Lifecycle
docs/
  architektur-sqlite-based.md
.qa/
  design/                  # Phase- und Issue-spezifische ausführbare Teilentwürfe
  acceptance/
```

**Grenzen:** Kein neues `src/modules/**` oder `src/components/**`; im bestehenden Frontend weiter `src/domains/**` -> `src/infrastructure/**` -> `src/app/**`. Falls `server/` Domain-Code konsumieren soll, Import-/Package-Grenzen sauber definieren statt fragile relative Querverbindungen oder kopierte Rules-Logik.

## 17. Priorität und Kurzentscheid

**Jetzt:** P0 inventarisieren, Testgoldens festschreiben, Rechte-/Datenbesitzmodell bestätigen und einen minimalen P1-Host für Donalu/Dornhain bauen.  
**Danach:** zunächst P2 mit echter Session-Autorität und GM-/Spieler-Geheimnissen beweisen; anschließend P3-Charakterportabilität.  
**Später:** RAG-Ausbau, Desktop-Packaging, Hub und ggf. zentrale Cloud – nur gegen nachgewiesenen Bedarf.  
**Nicht tun:** Supabase, PostgreSQL, RLS, RPC und Realtime in einem ungetesteten Big-Bang ersetzen.

## 18. Quellen im Repository / externe Referenzdokumentation

- [`AGENTS.md`](../AGENTS.md) – verbindliche Domain-/Schichtengrenzen, Security/CI.
- [`src/ARCHITECTURE.md`](../src/ARCHITECTURE.md) – Domain/Infra/App-Vertikalschnitt.
- [`.qa/design/player-test-realtime-runtime-state.md`](../.qa/design/player-test-realtime-runtime-state.md) – Revisions-/Idempotenz-/Snapshot-Vertrag.
- [`.qa/design/session-knowledge-reveals.md`](../.qa/design/session-knowledge-reveals.md) – GM-/Spieler-Wissensfilter.
- [`.qa/design/atlas-worldbuilder-contract.md`](../.qa/design/atlas-worldbuilder-contract.md) – Welthierarchie, Atlas-IDs, kanonische Karten.
- [`.qa/design/live-session-media-plane.md`](../.qa/design/live-session-media-plane.md) – optionale Media-Plane.
- [`docs/navigation-public-ids.md`](navigation-public-ids.md) – öffentliche IDs und Routing.
- [`docs/concepts/conductor-experience-contract.md`](concepts/conductor-experience-contract.md) – CE-Gates.
- [`docs/concepts/imagination-first-visualization-contract.md`](concepts/imagination-first-visualization-contract.md) – IV-Gates.
- [`docs/concepts/adaptive-ui-experience-contract.md`](concepts/adaptive-ui-experience-contract.md) – AU-Gates.
- [`docs/ops/negative-authz-suite.md`](ops/negative-authz-suite.md) – negative Berechtigungstests.
- [`docs/licensing/README.md`](licensing/README.md) – License-/Asset-Freigabe.
- [SQLite WAL](https://sqlite.org/wal.html), [SQLite Backup API](https://www.sqlite.org/backup.html), [Better Auth](https://www.better-auth.com/docs), [Drizzle SQLite](https://orm.drizzle.team/docs/get-started-sqlite), [sqlite-vec](https://github.com/asg017/sqlite-vec).

---

**Dokumentationsregel:** Architekturannahmen, die eine Phase verändert, als ADR ergänzen. Status „Vorschlag“ erst nach Umsetzung und nachgewiesenen Gates auf „Implementiert“ ändern. Dieses Dokument beschreibt den Weg, nicht den gegenwärtigen Produktionszustand.
