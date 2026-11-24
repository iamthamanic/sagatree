# SagaTree Lizenzstruktur

SagaTree nutzt getrennte Lizenzen für Software, Spielregeln und Inhalte.

| Bereich | Lizenz |
| --- | --- |
| Eigener Softwarecode (Frontend, Backend, Rules Engine, Migrationen, eigene Skripte) | **AGPL-3.0-only**, siehe [LICENSE](LICENSE) |
| Kanonisches [SagaTree Core Regelwerk](docs/sagatree%20core%20rules.md) | **Open RPG Creative (ORC) License** für ORC Licensed Material; Reserved Material ausgeschlossen |
| Künftige separat veröffentlichte SDKs und Clientbibliotheken | **Apache-2.0** vorgesehen; aktuell existiert noch **kein** als Apache-2.0 freigegebenes eigenständiges SDK |
| Marken, Logos, charakteristische Welten, Illustrationen und fremde Medien | Keine pauschale Freigabe durch die Softwarelizenz; jeweils gesonderte Rechte |
| Spieler- und Marketplace-Inhalte | Lizenz des jeweiligen Rechteinhabers; keine automatische AGPL- oder ORC-Lizenz |

**Wichtig:** Der programmierte Regelkern unter `src/domains/rules/sagatree/` ist Software und damit AGPL-lizenziert. Nur das ausdrücklich bezeichnete schriftliche Regelmaterial ist unter ORC freigegeben. ORC ist keine Softwarecode-Lizenz.

Die AGPL erlaubt sowohl Self-Hosting als auch kommerzielles Hosting. Wer eine modifizierte AGPL-Anwendung Nutzern über ein Netzwerk zugänglich macht, muss die entsprechenden Quellcodepflichten einhalten (Abschnitt 13). AGPL verbietet keine konkurrierenden Cloud-Angebote.

Apache-2.0 für ein zukünftiges SDK wird erst dann wirksam, wenn konkreter SDK-Code mitsamt der zugehörigen Lizenzangabe separat veröffentlicht ist. Ein öffentliches API oder ein SDK unter Apache-2.0 beseitigt nicht automatisch etwaige AGPL-Pflichten eng gekoppelter Erweiterungen.

## Drittmaterial und Rechtsvorbehalte

AGPL-3.0-only betrifft nur Material, für das die Rechteinhaber eine entsprechende Lizenz erteilen dürfen. Abhängigkeiten, Fonts, Bilder, Logos, 3D-Modelle, Sounds, Screenshots und bestehende Drittanbieter-Attributionen behalten ihre eigenen Bedingungen. Nicht pauschal von AGPL umfasst sind insbesondere `assets/`, `public/assets/`, `src/assets/`, `docs/brand/` und `docs/screenshots/`. Herkunftshinweise stehen unter anderem in [src/Attributions.md](src/Attributions.md), [docs/avatar assets.md](docs/avatar%20assets.md) und [public/assets/avatars/reference/ATTRIBUTION.md](public/assets/avatars/reference/ATTRIBUTION.md).

Fremde Spielsysteme wie D&D, Pathfinder oder DSA erhalten durch diese Lizenzstruktur keine zusätzlichen Nutzungsrechte. Für eigene Marketplace-Inhalte müssen Rechteinhaber eigene Lizenzen und erforderliche Attributionen festlegen. Marketplace- und Creator-Inhalte bleiben von der Plattform-Softwarelizenz unabhängig.

Die Verwendung der Namen und Zeichen SagaTree/SagaTree Core als Marken sowie der offiziellen Logos ist nicht durch die Code- oder ORC-Lizenz eingeräumt. Zulässige sachliche Herkunfts- und Kompatibilitätsangaben bleiben unberührt.

### Lizenztexte und package.json

- [LICENSE](LICENSE) enthält den unveränderten AGPL-3.0-Text der Free Software Foundation.
- [licenses/Apache-2.0.txt](licenses/Apache-2.0.txt) enthält den unveränderten Apache-2.0-Referenztext für **zukünftige** eigenständige SDKs; vorhandener Plattformcode wird dadurch nicht umlizenziert.
- `package.json` → `"license": "AGPL-3.0-only"` beschreibt die vorgesehene Lizenz des Plattformcodes, nicht Assets, Regelwerk oder Marketplace-Inhalte.

### Künftige Plugin-/SDK-Trennung

Ein späteres, **eigenständiges** SDK unter Apache-2.0 und etwaige proprietäre Erweiterungen bleiben nur dann getrennt von AGPL-Pflichten nachvollziehbar, wenn sie als separates Werk entwickelt und veröffentlicht werden (eigene Verteilung, klare API-Grenze, kein Einbetten von AGPL-Quellcode). Eine AGPL-Plugin-Ausnahme wird mit dieser Dokumentation **nicht** erteilt. Eng gekoppelte Kombinationen können weiterhin AGPL-Folgen auslösen; das ist eine Fallfrage, keine pauschale Freistellung.

### Offene rechtliche Prüfpunkte (NEEDS_HUMAN)

Diese Punkte sind dokumentiert und **nicht** durch technische CI-Tests erledigt. Maschinenlesbarer Stand: [docs/licensing/status.json](docs/licensing/status.json) (`open_source_release_ready: false`).

1. **Rechte früherer Beiträge:** Untersuchung in [docs/licensing/contributor-provenance.md](docs/licensing/contributor-provenance.md). Vier Commits unter `Raccoovaclaw <raccoovaclaw@gmx.de>` hinterlassen auf aktuellem HEAD noch ca. **8765** Blame-Zeilen (Edge Functions, `docker-compose.yml`, früherer FE-Client-Stub, Migration `001_initial.sql`, Docs). Kein CLA/DCO/Abtretung im Repo. Circumstantial: kein GitHub-User `Raccoovaclaw`, Name ähnelt OpenClaw/Raccoova — das ist **kein** Rechte-Nachweis. Minimalmaßnahme: Owner-Attest [OWNER_ATTESTATIONS.md](docs/licensing/OWNER_ATTESTATIONS.md) § A **oder** rechtssicherer Rewrite. Ausschluss nur in diesem Dokument reicht nicht, solange der Code veröffentlicht bleibt.
2. **Runtime-Assets:** Inventar [docs/licensing/asset-inventory.json](docs/licensing/asset-inventory.json). Keine `uncleared`-Dateien nach Klassifikation; jedoch ca. **199** `runtime_required` mit `owner_pending` (Icons, Spezies-Meshes, Marketplace-Cover, UI-Art). Marken/Favicons: `reserved`. Authoring unter `assets/`: `excluded`. Freigabe erst nach Owner-Lizenzwahl § C. Drittbelege z. B. [public/assets/avatars/reference/ATTRIBUTION.md](public/assets/avatars/reference/ATTRIBUTION.md) (CC BY 4.0).
3. **Figma Make / shadcn / Unsplash:** Initialimport per `figma[bot]`; Attest § B; Hinweise in [src/Attributions.md](src/Attributions.md).
4. **ORC-Autorencredits:** Die Attribution im kanonischen Regelwerk nennt „SagaTree contributors“. Konkrete individuelle Credits und Versionshistorie sind vor kommerzieller Regelwerksveröffentlichung zu vervollständigen, sofern gewünscht oder vertraglich erforderlich.
5. **SRD/OGL-förmige Daten & Open5e:** die frühere Edge-Function `rulesets/index.ts` (stillgelegter Backend-Baum) enthält D&D/Pathfinder-förmige Kataloge und ruft Open5e zur Laufzeit auf — separate Compliance-Prüfung vor Claim „saubere Redistribution“.
6. **Drittmaterial in Abhängigkeiten:** npm-/Deno-Abhängigkeiten, Google Fonts CDN (Darker Grotesque, typischerweise OFL) und vorhandene Attributionen behalten eigene Bedingungen; SBOM-/Compliance-Prüfung separat.

Automatische Prüfung: `node scripts/asset-license-inventory-check.mjs` (in `npm run test-gate`). Sie verhindert neue **uncleared** Medien und erkennt veraltete Inventare; sie ersetzt **keine** Owner-Atteste.

Unterschriebene Attestierungen gehören nach `docs/licensing/attestations/` (siehe Vorlagen). Ohne ausgefüllte Attestierung bleiben die Blocker offen und PR-Merge ist **NEEDS_HUMAN**.

Diese Dokumentation ersetzt keine rechtliche Prüfung.
