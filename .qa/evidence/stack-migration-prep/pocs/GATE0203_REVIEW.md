# GATE-02 / GATE-03 — unabhängiger Abschlussreview

**Abgeschlossen: 2026-10-21T09:20:22+00:00. Keine Architekturfreigabe.**

**GATE-02 bleibt FAIL:** Die kombinierte Cookie-/Bearer-/JWT-Konfiguration verfehlt das vorgeschriebene Credential-Isolationsziel. **GATE-03 besteht die eingegrenzten lokalen Vertrags- und Lastfälle.** Die beschriebenen Korrekturen und Nachweise sind auf dem eingefrorenen Stand geprüft; daraus folgt keine Produkt- oder Technologie-Freigabe.

## Scope und Unabhängigkeit

Reviewer: `/root/rpc_contract_remediation`. Dieser Agent hat GATE-02/03 nicht implementiert und die Kandidatenquellen im Review nicht verändert. Geprüft wurden alle elf eigenen Dateien in `scripts/stack-migration-pocs/gate-02-03/`, die beiden Gate-Spezifikationen und die beiden Evidence-Verzeichnisse. Der Implementierer bestätigte den vollständigen Freeze einschließlich der Evidence-READMEs vor dem Abschluss. GATE-01 gehört nicht zu diesem Review.

Die Prüfung verbindet Quelllektüre, eigene HTTP-/WS-Gegenproben, einen eigenen echten Chromium-Prozess, den genau einmal ausgeführten strikten Abschlusscheck auf dem Freeze und sechs gezielte Manipulationsproben der historischen Observation-Validierung. Es wurden keine produktiven Nutzer, Zugangsdaten oder Datenbanken verwendet. Die gesichteten upstream Quellen stammen aus den exakt gepinnten installierten Paketen; ihre Hashes wurden zusätzlich zu den Repository-Quellen geprüft.

## Ergebnis des unabhängigen Abschlusslaufs

Abschluss des strikten Laufs: **2026-10-21T09:17:44+00:00**. Tatsächlicher Prozess-Exitcode: **1**. Der Exitcode wird als FAIL festgehalten und nicht in einen allgemeinen PASS umgedeutet. Die finale Ausgabe unterscheidet den bekannten Pflichtziel-Fehler von unerwarteten Ausführungsfehlern:

| Bereich | Pflichtziel / Kriterium | Ausgeführte Assertions | Nicht ausgeführt | Freigabe |
| --- | --- | --- | --- | --- |
| GATE-02 | **FAIL**, Variante A / Zeile 1 | 18 PASS, 0 unerwartete FAIL | 1 JWT-Browserfall sowie die ausdrücklich benannten Plattform-/Produktgrenzen | NOT APPROVED |
| GATE-03 | PASS für die lokalen Spezifikationsfälle und die zusätzliche überlagerte Last | 10 PASS, 0 FAIL | Produktbetrieb, breitere Plattformen und die dokumentierten weiteren Grenzen | NOT APPROVED |

`--check-execution` ist ein separat benannter Ausführungs-/Nachweischeck und darf das weiterhin fehlgeschlagene GATE-02-Ziel nicht als grün darstellen. Dieser Reviewer hat für den finalen Nachweis den **strikten `--check`** verwendet. Der Root-Test-Gate, Produkt-Lint/Build und eine Architekturfreigabe sind nicht Bestandteil dieses eingegrenzten Reviews.

```sh
GATE0203_CHROMIUM=/tmp/sagatree-chromium-140/chrome-headless-shell-linux64/chrome-headless-shell \
  node scripts/stack-migration-pocs/gate-02-03/check.mjs --check
```

## Befunde — alle Schweregrade

| ID | Schweregrad | Befund | Finale Disposition und konkreter Nachweis |
| --- | --- | --- | --- |
| **R01** | **High** | Die kombinierte Cookie-/Bearer-/JWT-Konfiguration liefert authentifizierende Tokens an Seiten-JavaScript, obwohl das Cookie HttpOnly ist. | **OFFEN.** Eigener Chromium-Lauf für beide Router: Login-JSON und `set-auth-token` jeweils lesbar; jeder Wert ermöglicht mit `credentials: omit` zuerst `get-session` 200, dann JWT-Ausgabe 200 und authentifiziertes Application-`whoami` 200. Netzwerk-ExtraInfo bestätigt fehlendes Cookie bei diesen Replay-Anfragen. Der finale Kandidatenlauf reproduziert den Cookie-freien Session-Replay und weist A/1 sowie GATE-02 insgesamt als FAIL aus. Vor einer Freigabe braucht es ein getrenntes Cookie-Profil und erneute Prüfung aller erreichbaren Token-/Session-Antworten; bloßes Entfernen eines Plugins wird nicht als ausreichende Lösung behauptet. |
| **R02** | **Medium** | Der ursprüngliche `--check` prüfte die gespeicherte historische `observations.json` nicht. | **BEHOBEN für die beanstandete Zuordnung und Messvalidierung.** `observations.mjs` prüft Reporthash, Gate/Status, Laufzeit-/Zeitfelder, exakt erwartete Metriken, Stichprobenzahlen, Perzentilordnung, Widerrufsfrist und Überlappungsinvarianten. `--check` liest und validiert die gespeicherte Datei. Beide Originale werden akzeptiert; sechs gezielte ungültige Kopien wurden unabhängig im Speicher abgewiesen. Neue Laufzeiten werden nicht auf Gleichheit mit historischen Werten geprüft. |
| **R03** | **Medium** | Die frühere Aussage, jede HTTP-Reservation prüfe aktuelle Authentifizierung, war für den Colyseus-HTTP-Reconnect zu breit. | **AUSSAGE KORRIGIERT; GRENZE EXPLIZIT.** Mit gültigem Ticket liefert `/matchmake/reconnect` weiterhin ohne Authentifizierung bzw. mit fremdem Origin HTTP 200. Das ist im README und Report jetzt ausdrücklich beschrieben. Eigene Gegenproben für beide Router × Cookie/JWT: tatsächlicher Upgrade ohne Anmeldung 401/`UNAUTHENTICATED`; anderer Actor oder gleicher Actor mit zweitem Login 403/`SEAT_BINDING_MISMATCH`. Der ursprüngliche Login stellt danach denselben Raum/Sitz wieder her. Die Korrektur besteht in präziser Beschreibung der vorhandenen Schutzgrenze, nicht in einem behaupteten neuen HTTP-Guard. |
| **R04** | **Medium** | Der zusätzliche Planvertrag verlangte Reconnects während HTTP-Commands; anfangs liefen die Lastfälle nacheinander. | **BEHOBEN UND AUSGEFÜHRT.** Jetzt werden 200 echte Reconnects gestartet; ab dem ersten beobachteten Reconnect-Handshake starten 200 echte parallele HTTP-Commands. Der Code prüft gemessene Intervallüberlappung, Reconnect-Abschlüsse während noch laufender HTTP-Anfragen, alle ACK-IDs und lückenlose Revisionen. Beide Kandidaten erhalten im eigenen Abschlusslauf 200 HTTP-ACKs und restaurieren 200 Sitze; Messwerte unten. |
| **R05** | **Low** | Gültig angemeldete Nutzer erhielten auf JSON `null` beim Colyseus-Router 403, bei Hono 500. | **BEHOBEN UND AUSGEFÜHRT.** Gemeinsamer Objekt-Guard in `Policy.execute`; der Colyseus-Adapter ersetzt `null` nicht mehr vorab durch `{}`. Der finale Test prüft bei beiden HTTP-Adaptern und WS denselben Fehler: 400 / `INVALID_PAYLOAD`, ohne Revisionserhöhung. |
| **R06** | **Low** | Der frühere Response-Cast im typisierten Client ersetzte keine Laufzeitvalidierung. | **BEHOBEN UND AUSGEFÜHRT.** `CommandAck`, `Snapshot` und `ApiFailure` werden aus `unknown` geprüft; keine ungeprüften Response-Casts mehr. Strikte TypeScript-Kompilation und sieben tatsächliche fehlerhafte HTTP-Antworten sind Teil des Abschlusslaufs, einschließlich falscher Feldtypen, defektem JSON und widersprüchlichem HTTP-Status/Body. Der kompilierte Client treibt die echten Lastfälle. |
| **R07** | **Low** | Der ursprüngliche Pflicht-Origin-Check blockierte gewöhnliche gleichursprüngliche Browser-GETs auf `whoami`. | **BEHOBEN UND AUSGEFÜHRT.** Fehlendes Origin wird nur für die beiden HTTP-Leseaktionen bei genauem Host und `Sec-Fetch-Site: same-origin` zugelassen. Eigener Chromium-Lauf für beide Router und finale Browserprobe zeigen den tatsächlichen GET ohne Origin mit automatischem Cookie und HTTP 200. Mutationen/WS erhalten diese Ausnahme nicht; eigener POST ohne Origin bleibt 403 ohne Revision. |
| **R08** | **Info / Tech-Debt** | Der PoC verwendet synthetische Rollen, In-Memory-Sitzbindung, Loopback-HTTP und deaktiviertes Rate-Limiting; der Socket-/Adaptervergleich qualifiziert keine öffentliche oder verteilte Installation. | **GRENZEN BEIBEHALTEN.** HTTPS/Secure-Cookie-Verhalten, Tauri, sichere Browser-JWT-Speicherung, vollständige Owner-/GM-/Membership-Produktpolicy, verteilte Persistenz, öffentliche Proxies und Produktionsbetrieb sind ausdrücklich NOT RUN. Das HTTP-500-Szenario prüft eine abgefangene Request-Exception, keinen Prozessabsturz. |
| **R09** | **Info / Messwerkzeug** | Playwright `allHeaders()` lieferte in der eigenen realen Cross-Origin-Probe nur Renderer-Header; die anfängliche Cookie-Präsenz-Assertion scheiterte dadurch. | **MESSUNG KORRIGIERT.** Keine Cookie-Abwesenheit und kein CSRF-PASS daraus abgeleitet. Eigener und finaler Kandidatenlauf verwenden `Network.requestWillBeSentExtraInfo`. Es belegt beim fremden Origin tatsächliches Cookie, `same-site` und Origin; der Request erhält 403 und ändert keine Revision. Diese Messkorrektur ändert keine Produkt-Autorisierung. |

**Critical:** Im eingegrenzten Review wurde kein neuer Critical-Befund festgestellt. Die High-Risiken einer reinen JWT-Signaturprüfung nach Widerruf und eines nicht an den aktuellen Login gebundenen Reconnect-Tickets sind im Fixture durch aktuelle Session-Lookups und den tatsächlichen Upgrade-Guard mitigiert und in den bestehenden Reports weiterhin sichtbar. Das ersetzt keine allgemeine Sicherheitsprüfung der Bibliotheken oder des Produkts.

## Eigene Browser- und Authentifizierungsbeobachtungen

Chromium **140.0.7339.186**, frische Browserkontexte, echte Better-Auth-Anmeldung und keine injizierten Cookie-/Origin-Header im positiven Browserablauf. In beiden Routern ist das echte Cookie HttpOnly / SameSite=Lax; `document.cookie` und JavaScript-`Set-Cookie`-Zugriff geben es nicht preis. Die separat lesbaren Login-Tokens authentifizieren dennoch ohne Cookie (R01). Nach normalem Reload bleibt Cookie-`whoami` erfolgreich; ein fremder Origin auf derselben Site sendet sein ambient Cookie tatsächlich, erhält jedoch 403 ohne Zustandsänderung.

Die eigenen WS-Gegenproben lesen beim abgewiesenen Upgrade die konkrete HTTP-Antwort samt JSON-Code; sie akzeptieren weder Timeouts noch beliebige SDK-Fehler als Berechtigungsnachweis. Nach den beiden Ticket-Replay-Angriffen folgt jeweils die erfolgreiche Original-Login-Positivkontrolle. Ein zusätzlich serverseitig herabgestufter GM erhält sowohl über HTTP als auch über WS `GM_REQUIRED`, ohne Mutation.

## Messungen aus genau diesem unabhängigen Abschlusslauf

Diese Zahlen stammen aus der neuen `--check`-Ausgabe. Die gespeicherten Referenz-Observations und deren README-Tabellen wurden nicht durch diese Werte ersetzt. Ein einzelner lokaler Lauf auf Node 24.19.0 ist keine verlässliche Rangliste der Frameworks.

| Kandidat | Originaler 200-Command-Sturm p95 | 200 Reconnects unter HTTP-Last p95 | Gleichzeitige 200 HTTP-Commands p95 | Zeitliche Überlappung |
| --- | ---: | ---: | ---: | ---: |
| Colyseus-Router | 286.055 ms | 920.195 ms | 833.531 ms | 847.233 ms |
| Hono-Router | 280.522 ms | 939.562 ms | 256.025 ms | 268.065 ms |

| Kandidat | Restaurierte Sitze | HTTP-ACKs / eindeutige Revisionen | Reconnect-Abschlüsse während HTTP aktiv | HTTP-ACKs während Reconnects aktiv |
| --- | ---: | ---: | ---: | ---: |
| Colyseus-Router | 200/200 | 200/200 | 200 | 191 |
| Hono-Router | 200/200 | 200/200 | 7 | 200 |

Der ursprüngliche gemischte Command-Sturm erhält zusätzlich bei beiden Kandidaten alle 200 ACKs und je drei vollständige Beobachterfolgen mit 200 Deltas. Sämtliche oben genannten Lastfälle haben Fehlerrate 0. Die Widerrufsbeobachtungen bleiben in diesem Lauf klar innerhalb der geforderten 2.000 ms:

| Credential | Sign-out bis Socket geschlossen | Revoke-session bis Socket geschlossen |
| --- | ---: | ---: |
| Cookie | 113.600 ms | 142.940 ms |
| JWT | 100.953 ms | 142.399 ms |

## Nachweis- und Driftprüfung

Beide Berichte besitzen jeweils genau **12 erwartete Repository-Source-Pins**: alle elf eigenen Dateien und die jeweilige Gate-Spezifikation. Alle stimmen mit dem Freeze überein. Zusätzlich wurden je **13 gepinnte installierte Integrationsquellen** geprüft; alle Hashes stimmen. Die Case-IDs sind eindeutig. Beide gespeicherten Observation-Dateien validieren gegen ihren eigenen Report. Die Source-, Report-, Observation- und Evidence-README-Hashes wurden nach Abschluss des strikten Laufs erneut lesend abgeglichen.

Die sechs gezielten Negativproben veränderten ausschließlich Kopien im Speicher: fremder Reporthash, Widerruf über zwei Sekunden, 199 statt 200 Samples, falsche Perzentilordnung, fehlende Zeitüberlappung und null Reconnect-Abschlüsse während HTTP. Alle sechs wurden zurückgewiesen; die unveränderten Originale validierten danach weiterhin. Diese Prüfung belegt Zuordnung und Messinvarianten; sie behauptet keine Gleichheit von Laufzeiten verschiedener Ausführungen.

| Eingefrorene Evidence | SHA-256 |
| --- | --- |
| [gate-02/report.json](gate-02/report.json) | `2744750d3bf5c6d1e7396ddf20ba37c8b23da061e8b727f6f116c47761f5c8c4` |
| [gate-02/observations.json](gate-02/observations.json) | `b1adf73fae7e20291b8dc7294538170254da708968dc1a74d63ed55f6d5e3ede` |
| [gate-02/README.md](gate-02/README.md) | `eda9d7116bac3a24a49f8b4e0240a2866e4ca20ff9a30c62cc1fcb454067d8a9` |
| [gate-03/report.json](gate-03/report.json) | `6f38ae37dbf850a771fe38b0d21cf14622628e6b5541bbb412e766e7b78aa847` |
| [gate-03/observations.json](gate-03/observations.json) | `3c7f00bfed8b65406a9bee008e4d74bf8ebb82afde3b2ac72193d70550f96c58` |
| [gate-03/README.md](gate-03/README.md) | `4e2eb9c76995f64f54c6904b120970d8f345fd1bbe989172aa604ea8d04c1e94` |

### Geprüfte eigene Quellen und Spezifikationen

| Repository-Pfad | SHA-256 |
| --- | --- |
| `.qa/design/gates/GATE-02-better-auth-colyseus.md` | `c991faaaa8bc08284eca5306a6cadafb5a07f46abc1ffafb772eeead865180cc` |
| `.qa/design/gates/GATE-03-colyseus-http-vs-hono.md` | `ca708ff74f44da2a4733ff2b6e8a9f91371e90d6656515fd1bdb2a14258ee0c3` |
| `scripts/stack-migration-pocs/gate-02-03/README.md` | `2fb85192187a7a02c7232a9ada09c20d7fed1d75ffaebdc30d624c86569ddc34` |
| `scripts/stack-migration-pocs/gate-02-03/api-client.ts` | `c446bdb2e2fa74eca92493e032e22473d658b96702c0ec0555a10357036b14e1` |
| `scripts/stack-migration-pocs/gate-02-03/browser.mjs` | `4c8412cac15bbd27f363e8271b7c41cabd533c9fc56d88a7405d16c6f1c97fec` |
| `scripts/stack-migration-pocs/gate-02-03/check.mjs` | `167cf32d620231cfa26fbad0ff407357d13e35310e8b71caa746aad136bbd890` |
| `scripts/stack-migration-pocs/gate-02-03/harness.mjs` | `3e400c9c4211096b0dbecacfb3a810ddd92b08a4fa413155bdaa0fd2ac91cdb6` |
| `scripts/stack-migration-pocs/gate-02-03/observations.mjs` | `79608aa2c5de98281aa37b374d8eba1632d07b9d88b1464b9704be7d5a88dd78` |
| `scripts/stack-migration-pocs/gate-02-03/openapi.json` | `22a1a47679c11fe9d8c99bcc97b20ba6bb7d7ccf1fbabfe102080382215c8972` |
| `scripts/stack-migration-pocs/gate-02-03/package-lock.json` | `1786da5433d10109dd010b9fb13dae4b876155966a8bf3b580d37d727b65ca88` |
| `scripts/stack-migration-pocs/gate-02-03/package.json` | `11097246edb5a42e2b71cd67be6b29ef50951cb0c3804b37f8b63703a2eae212` |
| `scripts/stack-migration-pocs/gate-02-03/policy.mjs` | `4630a72cc2fe0c483f507171616e100d21c6f24253f5ffc9fb462ff5ead20bd6` |
| `scripts/stack-migration-pocs/gate-02-03/server.mjs` | `11aac1a29fb4aa125213bc8cd4cfeed1d7d9601c4144bf464ddcc430a46e3247` |

### Prüflauf-Fingerprints

- Striktes Abschlussprotokoll SHA-256: `fe2cd9bdf4495b9a4c8713b3f794a8bd29e7fc1b2c23c5597bd72ab156ac3015`.
- Eigener Chromium-Probe SHA-256: `3bbbe886a2659f5bbc52d944f296877d2f8e3eb7dbeb5c3769ae31b50150a5c7`; protokollierte Beobachtungen SHA-256: `a8953961c5dd5cc8753acf5da96cf1755ee9904c8c2f1fe464ea13dc29941f2a`.
- Tatsächlich gestartetes Chromium-Binary SHA-256: `9bf40006da2fa5bf64a62e0e8b2625c489e9f431c142ca1e86c74476268b2074`.
- Unabhängiger Integritäts-/Canary-Probe SHA-256: `f155372f89e350bff6a74fbc881e7dfe58f99b5de08f2225cd1ee02135838ab5`.

Die zusätzlichen Probeprozesse und ihre Rohprotokolle wurden temporär ausgeführt. Die vollständigen entscheidungsrelevanten Befunde, Bedingungen, Statuscodes, Messungen und eingefrorenen Quellen stehen in diesem Review; die kanonische reproduzierbare Suite liegt im Repository. Der frühe Probeversuch ohne erweiterte Loopback-Berechtigung lief in ein Setup-Timeout und zählt nicht als bestandener Fall. Ebenso zählt die zunächst unvollständige Renderer-Header-Messung nicht als CSRF-Nachweis; der erfolgreiche Netzwerk-ExtraInfo-Lauf ist oben getrennt beschrieben.

## Entscheidung, die offen bleibt

R01 ist ein konkret reproduzierter offener Fehler des kombinierten Kandidaten gegenüber GATE-02 A/1. GATE-02 bleibt deshalb FAIL, die sichere Browser-JWT-Variante bleibt NOT RUN, und beide Gates bleiben NOT APPROVED. R02–R07 sind im oben beschriebenen Umfang korrigiert und nachgeprüft. Eine Veröffentlichung dieser Vorbereitungsevidenz ändert weder die Gate-Entscheidung noch die gesperrten Produkt-Migrationsschritte.

## Konsultierte Primärquellen

- [Better Auth: Bearer-Plugin](https://better-auth.com/docs/plugins/bearer) sowie die gepinnten `better-auth`-1.7.12-Implementierungen für Sign-in, Session, JWT und Bearer.
- [Colyseus: Reconnection](https://docs.colyseus.io/room/reconnection) sowie `MatchMaker.mjs`, `Room.mjs` und `Client.mjs` der gepinnten Versionen.
- [Colyseus: WebSocket-Transport / beforeUpgrade](https://docs.colyseus.io/server/transport/ws) sowie die installierte Transportimplementierung.

Die konkreten HTTP-/Browser-/Lastbefunde stammen aus den beschriebenen lokalen Ausführungen. Die Dokumentation wurde zur Einordnung der APIs verwendet, nicht als Ersatz für den Laufzeitnachweis.
