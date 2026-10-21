/** Reviewed behavior contracts for work that is not a generated RPC/Edge/adapter port. */
const contract = (intent, sources, targets, security, checks, dependsOn) => ({ intent, sources, targets, security, checks, ...(dependsOn ? { dependsOn } : {}) });

export const planContracts = {
  'MIG-001': contract(
    'Eine unveränderliche SQL-/Frontend-Baseline und reproduzierbare synthetische Testdaten für den Alt/Neu-Vergleich festhalten.',
    ['AGENTS.md', '.qa/project.yaml', 'supabase/migrations', 'scripts/apply-migrations.sh'],
    ['.qa/evidence/stack-migration-prep/baseline.md', 'scripts/stack-migration-db'],
    'Nur eine isolierte lokale Datenbank mit synthetischen Identitäten verwenden; Produktiv-Verbindungsdaten sind kein Default. Source-Baseline, angewendete Migrationen und tatsächlich beobachtete Datenbank-ACL getrennt ausweisen.',
    [
      ['Ein festgehaltener main-Commit und die unveränderten Repository-Migrationen', 'der Baseline-Lauf baut eine leere PostgreSQL-Instanz auf', 'Der Bericht enthält Commit, SHA-256 je SQL-Datei, angewendete Reihenfolge und pg_proc-Signaturen; Abweichungen zu scripts/apply-migrations.sh werden einzeln ausgewiesen.'],
      ['Weltbesitzer O, eigenständiger Projekt-GM G, P1, P2 und Fremdbesitzer X', 'die Seed-Datei wird zweimal auf einer frischen Instanz ausgeführt', 'Die synthetischen Fixtures enthalten Memberships, offene/geheime Atlas-Daten, Runtime, Inventar und feste IDs; beide Aufbauten liefern identische fachliche Prüfsummen.'],
      ['Ein Baseline-Commit und eine spätere Arbeitskopie', 'Tests werden protokolliert', 'Jeder PASS nennt den tatsächlich geprüften Commit oder WORKTREE-Hash; ein vorhandener CI-PASS wird nicht als Ausführung der neuen DB-/Browser-Tests ausgegeben.'],
    ], []),
  'MIG-002': contract(
    'Alle produktiven Supabase-Aufrufstellen mit einer überprüften Quelloperation und einem verantwortlichen Migrationsticket verbinden.',
    ['src/infrastructure', 'supabase/functions', 'supabase/migrations', 'src/supabase'],
    ['.qa/intake/rpc-contracts', '.qa/intake/edge-infra-contracts', '.qa/evidence/stack-migration-prep/legacy-target-matrix.md'],
    'SECURITY DEFINER, effektive EXECUTE-Rechte und Dispatcher-Erreichbarkeit getrennt prüfen. Unsichere Legacy-Semantik wird als Defekt erfasst und darf keine gewollte Nachfolger-Berechtigung werden.',
    [
      ['Direkte RPC-Literale und typisierte Wrapper-Argumente im TypeScript-AST', 'das Inventar wird aus dem eingefrorenen Quellbaum regeneriert', 'Alle 57 Frontend-RPC-Namen einschließlich promote_session_outcome_to_saga und promote_session_outcome_to_world sind mit Aufrufstelle und genau einem Primärverantwortlichen erfasst.'],
      ['25 Edge-Verzeichnisse und 13 Infrastruktur-Bereiche (nach #879 inkl. ollama-settings)', 'Source-Snapshots und Dispatcher werden ausgewertet', '25 Edge-Verträge und 13 Adapter-Verträge sind vollständig zugeordnet; neun erreichbare Worker, 15 nicht eingebundene Worker und main als Dispatcher werden getrennt gezählt; ollama-settings ist vorläufig MIG-402/#818 mitgebunden.'],
      ['Ein Vertrag mit einer geänderten SQL-/TypeScript-Quelldatei', 'der Fingerprint-Prüfer läuft', 'Die Prüfung meldet den veralteten Vertragsnachweis mit Dateipfad; unaufgelöste Laufzeitaufrufe und nicht im Bootstrap enthaltene SQL-Dateien erscheinen ausdrücklich als offene Abdeckung.'],
    ], ['MIG-001']),
  'GATE-01': contract(
    'Drizzle mit zentralem Policy Service und ZenStack 3 anhand derselben SQLite-Berechtigungsfälle bewerten.',
    ['.qa/design/gates/GATE-01-drizzle-vs-zenstack.md', 'supabase/migrations/015_inventory_item_definitions.sql'],
    ['.qa/evidence/stack-migration-prep/pocs/gate-01', '.qa/design/gates/GATE-01-drizzle-vs-zenstack.md'],
    'Welteigentum und Projekt-GM sind verschiedene Rollen. Ein GM erhält durch seine Sitzung keine Welt-Editierrechte; ein Weltbesitzer verliert diese nicht, wenn er kein GM ist.',
    [
      ['O besitzt W1, G ist nur GM des Projekts zu W1, P1/P2 sind aktive Spieler', 'beide ORM-Kandidaten führen die identische Suite aus', 'O darf updateMapTitle ausführen, G/P1/P2/X nicht; G darf die GM-Sitzungsoperation ausführen, O ohne GM-Rolle nicht; versteckte Karten fehlen in Spielerprojektionen.'],
      ['Ein autorisierter O und eine veraltete expectedRevision', 'O ändert denselben Kartentitel erneut', 'Die Mutation liefert einen Konflikt ohne Revisionserhöhung; ein unautorisierter Actor erhält einen Berechtigungsfehler und keinen Konflikt als Existenzsignal.'],
      ['Reproduzierbare Kandidaten-Ergebnisse und verbleibende Plattform-/Migrationstests', 'das Entscheidungsprotokoll wird erstellt', 'Die Tabelle nennt PASS/FAIL/NOT RUN je Kriterium und Version; abhängige Issues bleiben bis zur verlinkten menschlichen APPROVED-Entscheidung gesperrt.'],
    ], ['MIG-001', 'MIG-002']),
  'GATE-02': contract(
    'Better-Auth-Sitzungen und Colyseus-Handshake einschließlich Widerruf und Modusgrenzen messen.',
    ['.qa/design/gates/GATE-02-better-auth-colyseus.md', 'src/lib/auth-context.tsx'],
    ['.qa/evidence/stack-migration-prep/pocs/gate-02', '.qa/design/gates/GATE-02-better-auth-colyseus.md'],
    'Loopback-Identität darf niemals einen Remote-GM ergeben. Actor, Host, aktive Membership und Widerruf werden serverseitig vor Join, Reconnect und Command geprüft.',
    [
      ['G, P1, P2 und X mit getrennten Host-Sitzungen', 'Cookie- und Bearer-Kandidaten verbinden sich per HTTP und WebSocket', 'Erlaubte Akteure erhalten dieselbe Rolle auf beiden Transporten; fremder Host, fremdes Projekt, abgelaufene Sitzung und manipulierte Rolle werden vor Raumbeitritt abgewiesen.'],
      ['P1 ist verbunden und seine Membership oder Sitzung wird widerrufen', 'P1 sendet erneut und versucht Reconnect', 'Neue privilegierte Aktionen sind spätestens nach zwei Sekunden gesperrt; Reconnect stellt keine veraltete Berechtigung wieder her.'],
      ['Solo-Modus und ein später erreichbarer Remote-Listener', 'der Host wechselt seinen Modus', 'Lokale Solo-Credentials werden nicht als Remote-Anmeldung akzeptiert; gemessene Varianten und offene Browser-/Plattformfälle stehen im ADR, dessen Freigabe menschlich bleibt.'],
    ], ['MIG-001', 'MIG-002']),
  'GATE-03': contract(
    'Colyseus-eigene HTTP-Routen und Hono plus Colyseus unter identischer Autorität und Last vergleichen.',
    ['.qa/design/gates/GATE-03-colyseus-http-vs-hono.md', 'src/infrastructure/session/session-runtime-service.ts'],
    ['.qa/evidence/stack-migration-prep/pocs/gate-03', '.qa/design/gates/GATE-03-colyseus-http-vs-hono.md'],
    'HTTP und WebSocket verwenden denselben Policy-Einstieg. Kein Transport darf Rollen aus einem ungeprüften Request übernehmen oder GM-Daten an Spieler senden.',
    [
      ['Identische Commands für GM, Spieler und Fremdbesitzer', 'jeder Kandidat führt sie über HTTP und WebSocket aus', 'Beide Transporte liefern dieselbe erlaubte Zustandsänderung und dieselben Denials; ein absichtliches HTTP-500 beendet keine bestehende Raumverbindung.'],
      ['200 konkurrierende Reconnects während HTTP-Commands', 'die reproduzierbare Lastprobe läuft', 'Der Bericht enthält p50/p95/p99, Fehlerrate und beobachtete Prozess-/Socket-Ausfälle je Variante; kein Messwert wird aus Unit-Mocks abgeleitet.'],
      ['Gemessene Routing-, Middleware- und Betriebsunterschiede', 'die Varianten werden beurteilt', 'Der ADR hält Kosten und offene Messkriterien fest; ohne menschliche Entscheidung bleibt sowohl die Hono- als auch die Colyseus-only-Produkteinführung gesperrt.'],
    ], ['MIG-001', 'MIG-002']),
  'GATE-04': contract(
    'Atomare SQLite-Autorität für Zustand, Revision, Ereignis und Idempotenz unter Konkurrenz und Prozessabbruch nachweisen.',
    ['.qa/design/gates/GATE-04-sqlite-revision-idempotency.md', 'src/infrastructure/session/session-runtime-service.ts'],
    ['.qa/evidence/stack-migration-prep/pocs/gate-04', '.qa/design/gates/GATE-04-sqlite-revision-idempotency.md'],
    'Actor und Membership werden vor dem Schreibrecht geprüft. Idempotenz wird pro Sitzung und Schlüssel gespeichert und gegen Actor-/Payload-Wechsel geschützt; Broadcast erfolgt erst nach Commit.',
    [
      ['20 Clients mit jeweils 50 Commands und gemeinsamen expectedRevision-Werten', 'ein SQLite-Writer verarbeitet die gemischten Anforderungen', 'Nur akzeptierte Commands erhöhen die Revision genau einmal; Konflikte verändern weder Zustand noch session_events, und erfolgreiche Revisionen sind lückenlos.'],
      ['Dieselbe session_id/idempotency_key sowie ein zweiter Actor oder anderer Payload', 'Retry und missbräuchliche Wiederverwendung werden gesendet', 'Ein identischer Retry liefert das gespeicherte Ergebnis; Actor-/Payload-Wechsel wird abgewiesen, während derselbe Schlüssel in einer anderen Sitzung unabhängig funktioniert.'],
      ['Abbruchpunkte vor Commit, nach Commit und vor Broadcast', 'der Prozess wird tatsächlich mit SIGKILL beendet und aus WAL neu gestartet', 'Zustand, Revision, session_events und Idempotenz sind gemeinsam vorhanden oder gemeinsam abwesend; Reconnect rekonstruiert bestätigte Ereignisse ohne zweite Mutation.'],
    ], ['MIG-001', 'MIG-002']),
  'GATE-05': contract(
    'Desktop-Verpackung erst nach abgeschlossener Browser-Host-CI und Betriebsnachweis vergleichen.',
    ['.qa/design/gates/GATE-05-tauri-packaging.md', 'docs/architektur-sqlite-based.md'],
    ['.qa/evidence/stack-migration-prep/pocs/gate-05', '.qa/design/gates/GATE-05-tauri-packaging.md'],
    'Sidecar-Zugriff ist auf die angemeldete lokale Instanz beschränkt; Desktop-Verpackung erweitert weder Netzreichweite noch produktive Datenrechte.',
    [
      ['MIG-602 oder MIG-603 ist noch offen', 'der Runner die Desktop-PoC starten möchte', 'Der Runner verweigert GATE-05; dieser PoC blockiert ausschließlich MIG-703 und liegt nach den Browser-Host-Wellen.'],
      ['Browser-Host-CI und Restore-Drill sind abgeschlossen', 'Tauri+Sidecar und Electron werden auf Linux/macOS/Windows geprüft', 'Start/Stop, Portkonflikt, persistentes Datenverzeichnis, signierte Updates und fehlgeschlagener Sidecar-Start haben je Plattform beobachtete Ergebnisse; nicht ausgeführte Plattformen bleiben NOT RUN.'],
      ['Ein offenes Verpackungs-ADR', 'ein Kandidat einzelne Smoke-Tests besteht', 'Teilweise Smoke-Erfolge aktivieren keinen Desktop-Produktcode; MIG-703 benötigt die verlinkte menschliche GATE-05-Freigabe.'],
    ], ['MIG-602', 'MIG-603']),
  'MIG-010': contract(
    'Einen konfigurierbaren lokalen Node-Host mit ehrlicher Readiness und geordnetem Lebenszyklus bereitstellen.',
    ['src/lib/supabase.ts', 'docs/architektur-sqlite-based.md'], ['server/src/bootstrap', 'server/src/config'],
    'Standard-Listener bleibt Loopback; Remote-Bind benötigt explizite Konfiguration. Health-Ausgaben enthalten keine Tokens, Schlüssel oder Dateiinhalte.',
    [
      ['Ein leeres, beschreibbares Datenverzeichnis und keine Cloud-Credentials', 'der Host im Solo-Modus startet', 'Der Host meldet Readiness erst nach erfolgreicher Initialisierung und verwendet nach Neustart dasselbe Datenverzeichnis.'],
      ['Ungültige Konfiguration, belegter Port oder nicht beschreibbares Datenverzeichnis', 'der Host startet', 'Der Prozess endet mit Fehlercode und einer redigierten Ursache; er meldet nicht fälschlich gesund und weicht nicht still auf ein neues Verzeichnis aus.'],
      ['Laufende Requests und ein Terminationssignal', 'der Host herunterfährt', 'Neue Mutationen werden abgewiesen, bereits bestätigte Daten bleiben erhalten und Listener/DB-Ressourcen werden geschlossen.'],
    ], ['MIG-001', 'MIG-002', 'GATE-01']),
  'MIG-011': contract(
    'Den freigegebenen SQLite-Schemakatalog mit atomarem Migrationsjournal und Fremdschlüsselprüfung aufbauen.',
    ['supabase/migrations', 'scripts/apply-migrations.sh'], ['server/src/persistence', 'server/migrations'],
    'Schema-Upgrades dürfen keine Owner-/Membership-Zuordnung verlieren. Dateirechte und DB-Lock verhindern konkurrierende nicht koordinierte Upgrades.',
    [
      ['Leere Datenbank und ein freigegebener geordneter Schema-Stand', 'der Migrationsrunner zweimal startet', 'Tabellen, Indizes, Constraints und Journal entstehen genau einmal; foreign_keys ist für jede Verbindung aktiviert und schema_version bleibt beim zweiten Lauf unverändert.'],
      ['Ein absichtlich fehlerhafter Migrationsschritt', 'das Upgrade abbricht', 'Schema und Journal rollen gemeinsam zurück; der nächste Start meldet denselben fehlgeschlagenen Schritt statt ein teilweise migriertes Schema als bereit auszugeben.'],
      ['Ein Datenbestand mit UUIDs, Zeitstempeln, JSON und Membership-FKs', 'der Integritätscheck läuft', 'Die dokumentierten Postgres→SQLite-Abbildungen erhalten Identitäten und Null-Semantik; orphaned Memberships und ungültige Fremdschlüssel lassen das Gate scheitern.'],
    ], ['MIG-010', 'GATE-01', 'GATE-04']),
  'MIG-012': contract(
    'Einen transportfreien Repository-Port anhand autorisierter Welt-Leseoperationen etablieren.',
    ['src/infrastructure/world', 'src/domains/world'], ['server/src/repositories/world', 'src/infrastructure/world'],
    'Ein Repository-Aufruf erhält einen geprüften Actor-Kontext; fehlende Owner-/Projektberechtigung wird vor der Projektion abgewiesen.',
    [
      ['Bestehende Welt-Repository-Aufrufer und der neue Host-Adapter', 'dieselben autorisierten Weltabfragen ausgeführt werden', 'IDs, Nullwerte, Sortierung und fachliche Fehler bleiben im Vergleich zur Quellbaseline gleich; HTTP/ORM-Typen gelangen nicht in src/domains.'],
      ['X kennt die Welt-ID von O', 'X dieselbe Query über den Host ausführt', 'Die Query gibt weder die Welt noch private Attribute zurück; ein leeres Filterargument erweitert keine Owner-Grenze.'],
      ['Persistierte Weltänderung und ein Host-Neustart', 'der Adapter erneut liest', 'Die Query liefert den gespeicherten Stand und keine nur im Arbeitsspeicher gehaltene Ersatzantwort.'],
    ], ['MIG-011', 'MIG-013']),
  'MIG-013': contract(
    'RLS-/SECURITY-DEFINER-Regeln als explizite Policy-Service-Operationen mit deny-by-default abbilden.',
    ['supabase/migrations/015_inventory_item_definitions.sql', 'supabase/migrations', 'docs/ops/negative-authz-suite.md'], ['server/src/permissions'],
    'Identität, Welt-Owner, Projekt-GM und aktive Membership werden unabhängig geprüft. Legacy-Berechtigungsdefekte bekommen eine explizite sichere Abweichung und keinen Paritätsbonus.',
    [
      ['O besitzt eine Welt, G verwaltet ein Projekt dieser Welt und P1/P2 sind Mitglieder', 'die Policy-Matrix Weltbearbeitung, Session-GM und Spielerlesen prüft', 'Owner-only Weltoperationen erlauben O und verweigern G; GM-only Sessionoperationen erlauben G und verweigern O ohne GM-Rolle; Spieler sehen ausschließlich ihre erlaubte Projektion.'],
      ['Unbekannte Operation, fehlender Actor, inaktive Membership und fremder Tenant', 'jeder Fall denselben zentralen Policy-Einstieg aufruft', 'Alle vier Fälle werden ohne Mutation und ohne Offenlegung privater Ressourcendaten abgewiesen.'],
      ['HTTP, WebSocket, Job-Worker und interner Adapter', 'sie eine geschützte Anwendungsmutation aufrufen', 'Jeder Einstieg erfordert denselben geprüften Actor und dieselbe Policy; ein Callsite-Scan und ein direkter Bypass-Negativtest weisen keinen offenen Alternativpfad aus.'],
    ], ['MIG-011', 'GATE-01']),
  'MIG-014': contract(
    'Freigegebene Better-Auth-Konten und Sitzungen für erreichbare Hosts integrieren.',
    ['src/lib/auth-context.tsx', '.qa/design/gates/GATE-02-better-auth-colyseus.md'], ['server/src/auth', 'src/lib/auth-context.tsx'],
    'Authentifizierung liefert einen Actor, keine vom Client gewählte GM-Rolle. Host-Bindung, Ablauf, Logout und serverseitiger Widerruf gelten auch für Realtime.',
    [
      ['Ein registrierter Remote-Account mit gültiger Host-Sitzung', 'Login, Seiten-Reload und WebSocket-Handshake stattfinden', 'Derselbe Actor wird wiederhergestellt; geheime Sitzungsdaten stehen weder im DTO noch in Serverlogs.'],
      ['Abgelaufene, widerrufene oder für einen anderen Host ausgestellte Sitzung', 'HTTP oder Reconnect sie verwendet', 'Beide Transporte weisen den Zugriff ab und mutieren keine Projektdaten.'],
      ['Ein angemeldeter Spieler', 'er Rollen-/Owner-Felder im Request manipuliert', 'Die gespeicherte Membership bestimmt weiter seine Rechte; manipulierte Felder erzeugen keinen GM- oder Owner-Actor.'],
    ], ['MIG-010', 'MIG-011', 'MIG-013', 'GATE-02']),
  'MIG-015': contract(
    'Solo-Identität lokal persistieren, ohne sie in Remote-Privilegien umzuwandeln.',
    ['src/lib/auth-context.tsx', '.qa/design/gates/GATE-02-better-auth-colyseus.md'], ['server/src/auth/solo'],
    'Loopback und Remote-Authentifizierung bleiben getrennte Vertrauensbereiche. Ein Konfigurationswechsel gewährt bestehenden Solo-Tokens keine Netzrechte.',
    [
      ['Ein Host ohne Cloud-Zugang auf Loopback', 'derselbe lokale Datensatz nach Neustart geöffnet wird', 'Die Solo-Identität und ihre Eigentumszuordnungen bleiben stabil; es wird nicht pro Start ein neuer Owner erzeugt.'],
      ['Ein gültiger Solo-Nachweis', 'er gegen einen Remote-Listener oder anderen Host gesendet wird', 'Der Nachweis wird abgewiesen; der Host erstellt keinen Remote-GM und übernimmt keine fremde lokale Datenbankidentität.'],
      ['Ein Host wechselt von Solo zu Remote-Betrieb', 'die vorhandenen Konten weiterverwendet werden sollen', 'Der Wechsel verlangt den freigegebenen expliziten Account-Linking-Pfad; fehlende Zuordnung ist ein erklärter Fehler statt stiller Vollzugriff.'],
    ], ['MIG-010', 'MIG-011', 'MIG-013', 'GATE-02']),
  'MIG-020': contract(
    'Typisierte HTTP-Queries und Commands mit klarer Fehlerabbildung am Host anbieten.',
    ['src/infrastructure/session/session-runtime-service.ts', 'src/infrastructure/world/world-atlas-service.ts'], ['server/src/api', 'server/src/application'],
    'Der Server validiert Payload und Actor vor Anwendungsmutationen; 401/403/409/422 sind kein Ersatz für eine echte Policy-Prüfung.',
    [
      ['Ein gültiger Actor und ein freigegebenes Command-DTO', 'der Request den HTTP-Einstieg erreicht', 'Validierung, Policy und Anwendungskommandos laufen in der dokumentierten Reihenfolge; die Antwort enthält nur das rollenbezogene Ergebnis.'],
      ['Fehlende Anmeldung, fehlendes Recht, veraltete Revision und ungültiger Payload', 'die vier Requests ausgeführt werden', 'Die Antworten unterscheiden 401, 403, 409 und Validierungsfehler nachvollziehbar und hinterlassen jeweils keinen Teilzustand.'],
      ['Ein verlorener HTTP-Response nach erfolgreichem Commit', 'der Client denselben idempotenten Request wiederholt', 'Die HTTP-Schicht gibt dasselbe Anwendungsergebnis zurück und führt die Mutation nicht ein zweites Mal aus.'],
    ], ['MIG-010', 'MIG-013', 'MIG-014', 'GATE-03']),
  'MIG-021': contract(
    'Autorisierte Realtime-Räume mit durablem Snapshot und Revision-basiertem Resync bereitstellen.',
    ['src/infrastructure/session/session-runtime-channel.ts', 'src/infrastructure/session/session-runtime-service.ts'], ['server/src/realtime'],
    'Membership wird bei Join/Reconnect/Command geprüft; Broadcasts verwenden Empfängerprojektionen und enthalten für Spieler keine GM-only Daten.',
    [
      ['GM und zwei Spieler mit unterschiedlichen letzten Revisionen', 'die Clients verbinden sich nach Unterbrechung erneut', 'Jeder erhält einen konsistenten Snapshot und die freigegebenen Folgeereignisse ohne Lücke oder doppelte Anwendung.'],
      ['Ein fremder Actor oder inzwischen entfernter Spieler', 'Join, Reconnect und Raumkommando werden versucht', 'Alle Pfade verweigern Zugriff; eine gespeicherte Raum-ID oder alte Verbindung umgeht die aktuelle Membership nicht.'],
      ['Ein bestätigtes Command und ein sofortiger Host-Neustart', 'die Clients ihre letzte Revision melden', 'Der Resync rekonstruiert das bestätigte Ergebnis aus persistierten Ereignissen und veröffentlicht keine zurückgerollte Mutation.'],
    ], ['MIG-020', 'MIG-022', 'MIG-024', 'GATE-02', 'GATE-03']),
  'MIG-022': contract(
    'SessionRuntimeState als atomaren persistenten Command-Prozessor mit Revision und Idempotenz portieren.',
    ['src/infrastructure/session/session-runtime-service.ts', '.qa/design/gates/GATE-04-sqlite-revision-idempotency.md'], ['server/src/application/session', 'server/src/persistence/session'],
    'Commands benötigen Session-Membership und operationale Rolle; Actor-/Payload-gebundene Idempotenz verhindert die Wiederverwendung fremder Antworten.',
    [
      ['Zwei zulässige Commands auf derselben expectedRevision', 'beide gleichzeitig geschrieben werden', 'Genau eines committet die nächste Revision samt Zustand und Ereignis; das andere erhält Konflikt und verändert keine Persistenz.'],
      ['Ein bestätigter Command mit session_id/idempotency_key', 'Retry, andere Nutzlast und anderer Actor folgen', 'Identischer Retry liefert dasselbe Ergebnis; abweichende Nutzlast oder Actor wird zurückgewiesen, und die Revision bleibt unverändert.'],
      ['Ein Abbruch zwischen State-, Event- und Idempotenz-Schreibschritt', 'der Host aus WAL neu startet', 'Alle vier Datenteile inklusive Revision sind gemeinsam committet oder gemeinsam abwesend; ein Event wird erst nach erfolgreichem Commit veröffentlicht.'],
    ], ['MIG-011', 'MIG-013', 'MIG-014', 'GATE-04']),
  'MIG-023': contract(
    'Einladungen und Join-Codes mit serverseitiger Rolle und widerrufbarer Mitgliedschaft portieren.',
    ['supabase/migrations/055_session_invites.sql', 'src/infrastructure/session'], ['server/src/application/session/invites'],
    'Ein Code ist kein GM-Nachweis. Ablauf, Zielprojekt, Zielsession und Widerruf gelten atomar mit dem Mitgliedschaftseintrag.',
    [
      ['Ein gültiger Invite für Projekt A und ein angemeldeter Spieler', 'der Spieler den Code einlöst', 'Die Membership entsteht ausschließlich im Zielprojekt mit der serverseitig vorgegebenen Spielerrolle; Wiederholung erstellt keinen zweiten Eintrag.'],
      ['Abgelaufener, widerrufener oder projektfremder Code', 'der Join versucht wird', 'Der Join wird ohne neue Membership und ohne Session-Zustandsänderung abgewiesen.'],
      ['Zwei gleichzeitige Einlösungen und manipuliertes role=gm', 'der Einlösepfad unter Konkurrenz läuft', 'Einmaligkeits-/Nutzungslimits bleiben atomar und der Request kann keine GM- oder Owner-Rechte vergeben.'],
    ], ['MIG-020', 'MIG-022', 'GATE-02']),
  'MIG-024': contract(
    'Serverseitige GM-/Spieler-/Beobachterprojektionen für Snapshot, Query und Ereignis vereinheitlichen.',
    ['supabase/migrations/105_atlas_worldbuilder_player_projection.sql', 'src/infrastructure/session', 'src/infrastructure/world/world-atlas-service.ts'], ['server/src/projections'],
    'Verborgene NPCs, gm_only-Texte und nicht freigegebene Karten werden vor Serialization entfernt; Client-Filter gelten nicht als Berechtigung.',
    [
      ['GM, P1, P2 und Beobachter in derselben Sitzung mit verschiedenem Reveal-Stand', 'Snapshot und Delta derselben Revision gelesen werden', 'Jeder Actor erhält ausschließlich seine freigegebenen Objekte; GM-only Inhalte fehlen rekursiv auch in verschachtelten JSON-Feldern.'],
      ['P1 verliert eine Freigabe oder Membership', 'er Reconnect oder ältere Revision anfordert', 'Die neue Projektion entfernt zuvor sichtbare geheime Inhalte und gibt keine alten ungefilterten Events aus.'],
      ['Ein absichtlich deaktivierter serverseitiger Secret-Filter', 'die Negativsuite läuft', 'Die Canary-Probe wird rot, weil ein konkretes geheimes Markerfeld in einer Spielerantwort auftaucht.'],
    ], ['MIG-013', 'MIG-022', 'GATE-01']),
  'MIG-500': contract(
    'Geschützte lokale Assets mit atomarem Publish und metadata-basierter Autorisierung bereitstellen.',
    ['supabase/functions/media', 'src/infrastructure/media', 'supabase/migrations'], ['server/src/assets'],
    'Weder Dateipfad noch URL ist ein Berechtigungsnachweis; Traversal, Symlinks und fremde Owner-Referenzen werden vor Dateizugriff abgewiesen.',
    [
      ['Ein autorisierter Upload und validierte Dateibytes', 'validate→publish→metadata commit ausgeführt wird', 'Erst nach vollständiger Validierung wird das Asset sichtbar; DB-Metadaten und Dateiprüfsumme passen auch nach Host-Neustart zusammen.'],
      ['X kennt eine fremde Asset-ID oder sendet ../ bzw. einen Symlinkpfad', 'Download oder Upload versucht wird', 'Der Zugriff endet mit 401/403 bzw. Validierungsfehler; keine Datei außerhalb des Asset-Roots wird gelesen oder überschrieben.'],
      ['Abbruch nach temporärer Datei und vor Metadaten-Commit', 'Recovery und Cleanup laufen', 'Kein unvollständiges Asset gilt als veröffentlicht; temporäre Dateien werden nachvollziehbar bereinigt und bestätigte Dateien bleiben erhalten.'],
    ], ['MIG-011', 'MIG-013']),
  'MIG-501': contract(
    'Optionalen fortsetzbaren Großdatei-Upload an denselben Asset-Publish-Pfad anschließen.',
    ['src/infrastructure/media', 'supabase/functions/media'], ['server/src/assets/uploads'],
    'Upload-IDs sind an Actor und Ziel gebunden; jeder Chunk prüft Rechte, Gesamtlänge und Limits erneut.',
    [
      ['Ein teilweise hochgeladener großer Asset-Stream', 'Netzunterbrechung und Resume am bestätigten Offset folgen', 'Der Upload setzt korrekt fort und publiziert genau ein Asset mit der erwarteten Prüfsumme über MIG-500.'],
      ['Falscher Offset, überschrittenes Byte-Limit oder fremder Actor', 'der nächste Chunk gesendet wird', 'Der Server verweigert den Chunk und veröffentlicht keine unvollständigen oder fremden Bytes.'],
      ['Ein Host ohne aktiviertes Großupload-Modul', 'ein normaler kleiner Upload erfolgt', 'Der Host unterstützt den kleinen Upload weiterhin; ein großer Upload erhält einen erklärten Capability-Fehler statt eines hängenden Requests.'],
    ], ['MIG-500', 'MIG-020']),
  'MIG-502': contract(
    'Versionierte Welt-/Saga-Exportbündel mit validiertem Import und überprüfbarem Restore bereitstellen.',
    ['supabase/functions/export', 'src/infrastructure/world', 'src/infrastructure/saga'], ['server/src/migration/bundles'],
    'Importpfade, Owner-Zuordnung und Referenzen werden validiert; ein fremdes Bundle darf keine existierenden fremden Daten überschreiben.',
    [
      ['Ein Bundle mit Karten, NPCs, Inventar, IDs und Asset-Manifest', 'Export→Import in einen leeren Fixture-Host läuft', 'Fachliche IDs, public IDs, Beziehungen und Asset-Hashes bleiben erhalten; fehlende Atlas-Geometrie wird als fehlend gemeldet und nicht erfunden.'],
      ['Unbekannte kritische Version, Path-Traversal oder falsche Prüfsumme', 'das Bundle importiert wird', 'Der Import bricht vor Veröffentlichung ab und hinterlässt keine teilweise autoritativen Daten.'],
      ['Ein fertig exportierter SQLite-/Asset-Stand', 'der dokumentierte Restore auf einem neuen Host ausgeführt wird', 'Der neue Host besteht Owner-/Spieler-Negativtests und liefert dieselben fachlichen Prüfsummen ohne Zugriff auf die Originalinstanz.'],
    ], ['MIG-500', 'MIG-503', 'MIG-020']),
  'MIG-503': contract(
    'Postgres→SQLite-Transfer zuerst als idempotenten trockenen Fixture-Lauf mit Integritätsbericht bauen.',
    ['supabase/migrations', '.qa/intake/rpc-contracts/inventory.json'], ['server/src/migration/postgres'],
    'Defaults verbinden sich nur mit expliziten isolierten Testdaten. Owner, Memberships und geheime Sichtbarkeiten werden nicht vereinfacht.',
    [
      ['Ein eingefrorener Postgres-Fixture-Snapshot mit vollständigem Schema', 'der Transfer auf eine leere SQLite-Datei läuft', 'Der Bericht nennt je Tabelle Zeilenanzahl, kanonische Prüfsumme, Typabbildung und FK-Fehler; jede nicht abgebildete Tabelle blockiert den Lauf ausdrücklich.'],
      ['Abbruch mitten im Transfer und anschließender Wiederholungslauf', 'dieselbe Snapshot-ID erneut übertragen wird', 'Der Zielstand ist vollständig zurückgerollt oder als unvollständig isoliert; ein erfolgreicher Wiederholungslauf erzeugt keine doppelten fachlichen IDs.'],
      ['Synthetische Owner-/GM-/Spieler- und Secret-Daten', 'die Nachtransfer-Projektionen geprüft werden', 'Owner-Beziehungen und Sichtbarkeiten stimmen mit dem festgelegten sicheren Vertrag überein; ein bekannter Legacy-Berechtigungsdefekt wird als Abweichung erfasst.'],
    ], ['MIG-011', 'MIG-002']),
  'MIG-600': contract(
    'Berechtigungsparität und ausdrücklich korrigierte Legacy-Defekte gegen den gesamten Host nachweisen.',
    ['docs/ops/negative-authz-suite.md', '.qa/design/parity-harness/README.md'], ['server/tests/authz', 'e2e', '.github/workflows'],
    'Alle Eintrittswege inklusive Jobs, Assets, HTTP und Realtime werden geprüft; Low/Info-Befunde werden nicht aus dem Bericht entfernt.',
    [
      ['GM, zwei Spieler, Weltbesitzer ohne GM und Fremdbesitzer', 'die dokumentierte Operationsmatrix gegen echte Persistenz läuft', 'Erlaubte Aktionen und Denials sind pro Operation belegt; geheime Marker fehlen in Spielerantworten, Assets und Realtime-Events.'],
      ['Ein absichtlich entfernter Membership-/Secret-Check', 'die negative Canary-Suite im isolierten Lauf ausgeführt wird', 'Das Gate scheitert an einer konkreten unerlaubten Datenoffenlegung oder Mutation und wird erst nach Rücknahme der Regression wieder grün.'],
      ['Die vollständige Liste aller RPC-, Edge- und Infrastruktur-Nachfolger', 'die Abdeckung mit dem CI-Bericht abgeglichen wird', 'Jede Zeile besitzt einen ausgeführten Positiv-/Negativfall oder einen offenen Blocker; ungetestete Fälle werden nicht als Parität ausgegeben.'],
    ]),
  'MIG-601': contract(
    'Reproduzierbare Compose-Profile für Host und optionale AI-/Media-Dienste bereitstellen.',
    ['docker-compose.yml', '.github/workflows/verify.yml'], ['deployment', 'docs/ops'],
    'Host-only benötigt keine Cloud-Secrets; optionale Provider-Credentials werden extern injiziert und nicht in Images/Logs geschrieben.',
    [
      ['Ein frisches persistentes Volume ohne Cloud-Credentials', 'das host-only-Profil gestartet und neu gestartet wird', 'Health wird erst nach DB-Readiness grün; bestätigte Welt-/Session-Daten überleben Container-Neustart.'],
      ['Host+AI oder Host+Media mit fehlenden optionalen Credentials', 'das jeweilige Profil startet', 'Der Host bleibt für lokale Kernfunktionen benutzbar, während der betroffene Provider einen erklärten Capability-Fehler meldet.'],
      ['Derselbe Fixture-Stand im nativen Host und im Container', 'die Integrationssuite beide Varianten prüft', 'HTTP-/Realtime- und Persistenzverhalten stimmen überein; Ports, Datenpfade und Backup-Mounts sind im Runbook reproduzierbar festgehalten.'],
    ]),
  'MIG-602': contract(
    'Host-Unit-, echte DB-/Transport-Integration und Browser-Produktpfade als verlässliche CI-Gates anschließen.',
    ['.github/workflows/verify.yml', 'playwright.config.ts', '.qa/design/parity-harness/README.md'], ['.github/workflows', 'server/tests', 'e2e'],
    'CI erzeugt isolierte synthetische Identitäten; fehlende Testinfrastruktur darf kein stiller Skip und kein Zugriff auf eine Produktivinstanz werden.',
    [
      ['Ein Pull Request ohne externe Datenbank-Secrets', 'die erforderlichen CI-Jobs laufen', 'Die Jobs starten ihre isolierte Datenbank selbst und führen den GM→Player-Atlas-Pfad samt DB-Assertions aus; fehlender Dienst lässt den Job rot werden.'],
      ['Eine echte Permission-Regression im Fixture-System', 'die Canary-Probe ausgelöst wird', 'Mindestens ein erforderlicher Check wird rot; test.skip, continue-on-error und rein gemockte Ersatzantworten erfüllen dieses Kriterium nicht.'],
      ['Ein CI-Lauf auf einem konkreten Commit', 'die Ergebnisse archiviert werden', 'Logs, Testanzahlen und Revision sind diesem Commit zugeordnet; Browser-, DB- und Vertragsprüfung bleiben als unterschiedliche Nachweise erkennbar.'],
    ]),
  'MIG-603': contract(
    'SQLite-, WAL- und Asset-Backups sowie Update/Rollback mit tatsächlich ausgeführten Restore-Drills dokumentieren.',
    ['docs/ops', 'docker-compose.yml', 'docs/architektur-sqlite-based.md'], ['docs/ops/host', 'scripts/host-backup'],
    'Backups enthalten geschützte Daten und werden wie die Originaldaten autorisiert; Snapshot-Konsistenz darf nicht auf unkoordinierten Dateikopien beruhen.',
    [
      ['Aktive Schreiblast und ein freigegebener Backup-Mechanismus', 'ein Snapshot erstellt und auf einem neuen Host restauriert wird', 'SQLite-Integrität, Event-/Revision-Zusammenhang und alle referenzierten Asset-Hashes sind konsistent; erlaubte Spieleraktionen funktionieren nach Restore.'],
      ['Datenträger voll oder abgebrochene Kopie', 'Backup/Restore ausgeführt wird', 'Das Verfahren meldet Fehler und veröffentlicht keinen scheinbar gültigen Restore-Punkt; der letzte gültige Snapshot bleibt verwendbar.'],
      ['Ein fehlerhaftes Host-Update mit Testdaten', 'der dokumentierte Rollback-Drill folgt', 'Version, Schema-Kompatibilität und wiederhergestellte Prüfsummen sind belegt; der Bericht nennt gemessene Dauer und nötige Schreibsperre.'],
    ]),
  'MIG-700': contract(
    'Welt-/Saga-Cutover erst nach vollständigen Nachweisen mit einer einzigen Schreibautorität vorbereiten.',
    ['docs/architektur-sqlite-based.md', '.qa/design/atlas-live-e2e-cutover-gate.md'], ['docs/ops/cutover', 'server/src/migration'],
    'Ein Fixture-Drill ist keine Produktivfreigabe. Vor jeder produktiven Umstellung sind Scope, Backup, Schreibsperre und menschliche Freigabe konkret zu verlinken.',
    [
      ['Mindestens ein Vorgänger aus Welle 0–6 oder Atlas #770 ist offen', 'der Cutover-Runner eine Ausführung erwägt', 'MIG-700 bleibt gesperrt; alle betroffenen Vorgänger sind als konkrete GitHub-Blocker im Ticket und in der maschinenlesbaren Reihenfolge vorhanden.'],
      ['Eine synthetische Welt/Saga und ein vollständiger Exportstand', 'Freeze→Delta→Prüfung→Autoritätswechsel als Drill läuft', 'Während des Wechsels existiert genau eine Schreibautorität; IDs, Revisionen, Geheimnisse und Asset-Hashes sind vor und nach dem Wechsel vergleichbar.'],
      ['Ein absichtlich fehlerhafter Zielstand im Drill', 'Rollback ausgeführt wird', 'Der dokumentierte Rückweg stellt den letzten bestätigten Stand samt Assets wieder her; produktive Schritte bleiben bis zur gesonderten menschlichen Freigabe gesperrt.'],
    ]),
  'MIG-701': contract(
    'Nach dem kontrollierten Wechsel ein definiertes Beobachtungsfenster mit lesender Paritätskontrolle betreiben.',
    ['docs/architektur-sqlite-based.md', '.qa/design/parity-harness/README.md'], ['docs/ops/cutover/parity-window', 'server/src/migration'],
    'Dual-run bedeutet hier Vergleich mit einer ausdrücklich festgelegten Schreibautorität; keine zwei unabhängig schreibenden Systeme für dieselbe Welt/Saga.',
    [
      ['Ein abgeschlossener MIG-700-Drill mit definierter Autorität', 'der Vergleich während des festgelegten Beobachtungsfensters läuft', 'Beide Seiten werden anhand derselben bestätigten Revision verglichen; Queries auf die Schattenseite verursachen keine fachlichen Writes.'],
      ['Eine eingefügte Abweichung in Projektionsdaten oder Asset-Hash', 'der Vergleich erneut läuft', 'Der Bericht identifiziert Datensatz, Revision und Art der Abweichung; eine Diskrepanz setzt den Abschaltvorgänger nicht auf erfüllt.'],
      ['Ein Fehler über dem im Runbook festgelegten Schwellwert', 'der Rollback-Entscheidungsweg geprobt wird', 'Der Fixture-Drill belegt Rückkehr zur letzten konsistenten Autorität und archiviert Beobachtungsdauer, Ergebnis und verantwortliche Entscheidung.'],
    ], ['MIG-700']),
  'MIG-702': contract(
    'Supabase erst nach Beobachtungsfenster, vollständiger Ablösung und Restore-Nachweis zur Abschaltung freigeben.',
    ['docs/architektur-sqlite-based.md', '.qa/design/atlas-live-e2e-cutover-gate.md'], ['docs/ops/cutover/shutdown'],
    'Dieses Ticket allein autorisiert keine Datenlöschung. Offene Legacy-Aufrufe, unbekannte Deploy-Zustände und ungeprüfte Backups blockieren die Abschaltung.',
    [
      ['MIG-700, MIG-701 oder Atlas #770 ohne vollständigen Abschlussnachweis', 'die Abschaltprüfung läuft', 'MIG-702 bleibt agent-blocked; ein umetikettiertes oder aus der Intake-Liste entferntes Vorgängerticket umgeht die Sperre nicht.'],
      ['Alle verifizierten RPC-/Edge-/Infra-Verträge', 'der produktive Aufrufpfad mit der Matrix abgeglichen wird', 'Jede Operation besitzt einen geprüften Nachfolger oder eine menschlich genehmigte Stilllegung; verbliebene Supabase-Netzaufrufe sind explizite Blocker.'],
      ['SQLite-/Asset-Backup und das abgeschlossene Beobachtungsfenster', 'der Abschalt-Drill bewertet wird', 'Restore und Berechtigungs-Negativsuite sind nachgewiesen; erst eine verlinkte menschliche Freigabe erlaubt die konkret beschriebene produktive Abschaltung.'],
    ], ['MIG-700', 'MIG-701', 'ATLAS-LIVE-E2E', 'MIG-603']),
  'MIG-703': contract(
    'Die freigegebene Desktop-Verpackung auf dem fertigen Browser-Host integrieren.',
    ['.qa/design/gates/GATE-05-tauri-packaging.md', 'docs/architektur-sqlite-based.md'], ['desktop', 'docs/ops/desktop'],
    'Desktop-Bridge und Sidecar erlauben nur freigegebene Operationen; Localhost-Port und Dateizugriff verleihen Web-Inhalten keine pauschalen Host-Rechte.',
    [
      ['GATE-05 ohne menschliches APPROVED oder unvollständige Browser-Host-CI', 'Desktop-Implementierung gestartet werden soll', 'MIG-703 bleibt gesperrt; Tauri/Electron-Abhängigkeiten werden nicht als Nebenwirkung früher Browser-Wellen eingeführt.'],
      ['Die freigegebene Verpackung auf Linux/macOS/Windows', 'Start, Stop, erneuter Start und Sidecar-Ausfall geprüft werden', 'Pro Plattform sind App-/Sidecar-Lebenszyklus, Datenerhalt und erklärtes Fehlerbild belegt; nicht ausgeführte Plattformen bleiben offene Abnahmepunkte.'],
      ['Ein fremder Web-Origin oder manipulierte Bridge-Nachricht', 'Datei-/Netzwerkprivilegien angefordert werden', 'Die Bridge verweigert den Zugriff; ein Update-/Rollback-Drill erhält bestehende Host-Daten und ihre Berechtigungen.'],
    ], ['GATE-05', 'MIG-602', 'MIG-603']),
  'ATLAS-LIVE-E2E': contract(
    'Den echten GM→Player-Atlas-Pfad über Browser und isolierte Datenbank als verpflichtenden Nachweis ausführen.',
    ['e2e/atlas-followup-product-e2e-gate.spec.ts', '.qa/design/atlas-live-e2e-cutover-gate.md', 'src/infrastructure/world/world-atlas-service.ts'],
    ['e2e/atlas-isolated-product.spec.ts', 'scripts/stack-migration-db', '.github/workflows/stack-migration-baseline.yml'],
    'Die Testinstanz besitzt nur synthetische Daten. SQL-Proben, UI-Mocks und ein sichtbares Element werden nicht als vollständiger persistenter Produktpfad ausgegeben.',
    [
      ['Weltbesitzer O, separater Projekt-GM G, P1/P2 und X auf einer isolierten Datenbank', 'der Browser Karten erstellt/ändert und Freigaben ausführt', 'Berechtigte Weltänderungen sind nach Browser-Reload und DB-Neustart persistent; Spieler sehen genau die für ihr Projekt/ihren Reveal-Stand erlaubten Karten.'],
      ['Geheime Atlas-Daten und ein fremder oder nicht berechtigter Actor', 'UI und Backend denselben Objektzugriff versuchen', 'Geheime Marker fehlen in Spielerantworten und ein Cross-owner-Write verändert nachweislich keine DB-Zeile.'],
      ['Eine absichtlich aufgeweitete Atlas-Projektionsberechtigung', 'das verpflichtende CI-Gate läuft', 'Die reale Produktprobe wird rot und nach Rücknahme grün; fehlende isolierte Testinfrastruktur schlägt fehl und führt nicht zu test.skip.'],
    ], ['MIG-001']),
};

export const typedStrictAcceptance = 'Touched files: zero type escape hatches (typed-strict / Boy Scout).';
