# SagaTree Migration — PM Readiness-Audit (2026-10-23)

**Scope:** Review aller 90 kanonischen Kind-Issues von Epic #773 über GitHub-Suchabfrage. Structural-contract audit, **kein** Beleg für ausgeführte Source-/Runtime-/Sicherheitsprüfung aller Implementierungen.

## Faktischer Status

- total: **90**
- open: **80**
- closed: **10**
- unknown: **0**
- over5: **14**
- missingInOut: **90**
- missingRuntime: **90**
- missingUserJourney: **90**
- unverifiedImplementation: **80**

**Kritische Feststellungen:** Alle 90 Issues enthalten historische generische `Non-Goals`, keinen kanonischen `## Runtime`- oder `## User Journey`-Block und kein explizites `In:`/`Out:`-Scope; die Generator-Vorlage erzeugt `Task` bzw. `Coordination` statt der im Issue-Contract zugelassenen Typen `feature | bug | chore | docs`. Dies ist ein *struktureller* Mangel; nicht jedes reine Infrastruktur-Issue benötigt eine User Journey. Die >5-Acceptance-Grenze betrifft 14 Issues und ist mit dem erhaltenen Pflicht-Negativtestbestand vor etwaiger Aufteilung zu prüfen.

**Implementierungsstatus:** Ein geschlossenes Issue beweist ohne aktuelle Merge- und Testbelege keine `done`-Akzeptanz. Geöffnete Issues sind nicht automatisch unspezifiziert. Die bestehende Intake-Generator-Logik erzeugt dennoch derzeit 0 `agent-ready`, unabhängig von aktuellen GitHub-Abschlüssen. Daher **keine** Massenfreigabe und kein sofortiger ECC-Unrestricted-Lauf.

## Verbindliche Produktentscheidungen

[7 owner decisions](../../../../docs/architecture/migration-owner-decisions-2026-10-23.md) — Hono+Colyseus, cookie-only Better Auth, Tauri+Node-sidecar, ephemeral Atlas CI, aktive Legacy-Funktionen, optional tus deferred, 14-Tage-Pilot plus gesonderter Cutover/Shutdown.

## Abnahme je Welle

| Welle | Fokus | Readiness-Vertrag |
|---|---|---|
| 0 | Baseline, Atlas, GATE 1–4 | Echtes Test-Evidence, GATE 1/2/3/4 Architektur-Approval nachweisbar; Atlas-Defekte fixen statt Tests skippen |
| 1 | Host/DB/Auth/Policy/Assets | Reale Repo-/Session-/Host-Verträge, negative Cross-Owner/GM/Player Tests, Integration der Cookie-only Vorgaben |
| 2 | HTTP/Realtime/RPC | Hono+Colyseus gemeinsamer Policy-Use-Case, Revision/Idempotenz, 57 RPC-Inventarabdeckung, kein Secret-Leak |
| 3 | Edge | Nur aktuell angebundene Worker aktiv; unmounted bleibt 404; 25 Source-Contracts inkl. Dispatcher berücksichtigen |
| 4 | 13 Infrastruktur-Adapter | Öffentliche Port-Signaturen beibehalten, UI Journey Parität, Integration ohne doppelte DB-Owners |
| 5 | Asset Export/Import | Restore mit stabilen IDs/Hash, tus post-core und kein Cutover-Blocker |
| 6 | Security/CI/Ops | Alle relevanten Authz Canaries und echter Atlas-E2E erforderlich; Red nicht grün etikettieren |
| 7 | Pilot/Cutover/Desktop | 14-Tage-Paritätsfenster und menschlicher Produktivwechsel; Tauri drei OS nach GATE-05 Plattformnachweisen |

## 90 GitHub Issue-Identitäten und aktuelle GitHub-Zustände

| Reihenfolge | Issue | Welle | GitHub | Vorgänger | Acceptance | In/Out/Runtime-Rework |
|---:|---|---:|---|---|---:|---|
| 1 | [MIG-001 #782](https://github.com/iamthamanic/sagatree/issues/782) | 0 | CLOSED | — | 4 | pending |
| 2 | [ATLAS-LIVE-E2E #770](https://github.com/iamthamanic/sagatree/issues/770) | 0 | OPEN | #782 | 4 | pending |
| 3 | [MIG-002 #783](https://github.com/iamthamanic/sagatree/issues/783) | 0 | CLOSED | #782 | 4 | pending |
| 4 | [GATE-01 #784](https://github.com/iamthamanic/sagatree/issues/784) | 0 | CLOSED | #782, #783 | 4 | pending |
| 5 | [GATE-02 #785](https://github.com/iamthamanic/sagatree/issues/785) | 0 | OPEN | #782, #783 | 4 | pending |
| 6 | [GATE-03 #786](https://github.com/iamthamanic/sagatree/issues/786) | 0 | OPEN | #782, #783 | 4 | pending |
| 7 | [GATE-04 #787](https://github.com/iamthamanic/sagatree/issues/787) | 0 | CLOSED | #782, #783 | 4 | pending |
| 8 | [MIG-010 #789](https://github.com/iamthamanic/sagatree/issues/789) | 1 | CLOSED | #782, #783, #784 | 5 | pending |
| 9 | [MIG-011 #790](https://github.com/iamthamanic/sagatree/issues/790) | 1 | CLOSED | #789, #784, #787 | 5 | pending |
| 10 | [MIG-013 #792](https://github.com/iamthamanic/sagatree/issues/792) | 1 | CLOSED | #790, #784 | 5 | pending |
| 11 | [MIG-012 #791](https://github.com/iamthamanic/sagatree/issues/791) | 1 | CLOSED | #790, #792 | 5 | pending |
| 12 | [MIG-014 #793](https://github.com/iamthamanic/sagatree/issues/793) | 1 | OPEN | #789, #790, #792, #785 | 4 | pending |
| 13 | [MIG-015 #794](https://github.com/iamthamanic/sagatree/issues/794) | 1 | OPEN | #789, #790, #792, #785 | 4 | pending |
| 14 | [MIG-500 #841](https://github.com/iamthamanic/sagatree/issues/841) | 1 | CLOSED | #790, #792 | 4 | pending |
| 15 | [MIG-020 #795](https://github.com/iamthamanic/sagatree/issues/795) | 2 | OPEN | #789, #792, #793, #786 | 4 | pending |
| 16 | [MIG-022 #797](https://github.com/iamthamanic/sagatree/issues/797) | 2 | OPEN | #790, #792, #793, #787 | 4 | pending |
| 17 | [MIG-023 #798](https://github.com/iamthamanic/sagatree/issues/798) | 2 | OPEN | #795, #797, #785 | 4 | pending |
| 18 | [MIG-024 #799](https://github.com/iamthamanic/sagatree/issues/799) | 2 | OPEN | #792, #797, #784 | 4 | pending |
| 19 | [MIG-021 #796](https://github.com/iamthamanic/sagatree/issues/796) | 2 | OPEN | #795, #797, #799, #785, #786 | 4 | pending |
| 20 | [MIG-503 #844](https://github.com/iamthamanic/sagatree/issues/844) | 2 | CLOSED | #790, #783 | 4 | pending |
| 21 | [RPC-MARKETPLACE-COUNT #878](https://github.com/iamthamanic/sagatree/issues/878) | 2 | OPEN | #795, #792, #797, #799, #784, #785, #787 | 5 | pending |
| 22 | [RPC-SAGA-AUTHORING #871](https://github.com/iamthamanic/sagatree/issues/871) | 2 | OPEN | #795, #792, #797, #799, #784, #785, #787 | 5 | pending |
| 23 | [RPC-SAGA-VERSION-READ #872](https://github.com/iamthamanic/sagatree/issues/872) | 2 | OPEN | #795, #792, #797, #799, #784, #785, #787, #871 | 5 | pending |
| 24 | [RPC-SAGA-PROVISION #873](https://github.com/iamthamanic/sagatree/issues/873) | 2 | OPEN | #795, #792, #797, #799, #784, #785, #787, #872 | 5 | pending |
| 25 | [RPC-PROJECT-MEMBERSHIP #874](https://github.com/iamthamanic/sagatree/issues/874) | 2 | OPEN | #795, #792, #797, #799, #784, #785, #787, #873 | 5 | pending |
| 26 | [RPC-SAGA-GOVERNANCE #875](https://github.com/iamthamanic/sagatree/issues/875) | 2 | OPEN | #795, #792, #797, #799, #784, #785, #787, #874 | 5 | pending |
| 27 | [RPC-SESSION-RUNTIME #867](https://github.com/iamthamanic/sagatree/issues/867) | 2 | OPEN | #795, #792, #797, #799, #784, #785, #787 | 5 | pending |
| 28 | [RPC-SESSION-LIFECYCLE #868](https://github.com/iamthamanic/sagatree/issues/868) | 2 | OPEN | #795, #792, #797, #799, #784, #785, #787, #867 | 5 | pending |
| 29 | [RPC-NPC-INSTANCES #877](https://github.com/iamthamanic/sagatree/issues/877) | 2 | OPEN | #795, #792, #797, #799, #784, #785, #787, #868 | 5 | pending |
| 30 | [MIG-353 #816](https://github.com/iamthamanic/sagatree/issues/816) | 2 | OPEN | #877, #878 | 4 | pending |
| 31 | [RPC-SESSION-ACCESS #869](https://github.com/iamthamanic/sagatree/issues/869) | 2 | OPEN | #795, #792, #797, #799, #784, #785, #787, #868 | 5 | pending |
| 32 | [RPC-SESSION-RECAP #870](https://github.com/iamthamanic/sagatree/issues/870) | 2 | OPEN | #795, #792, #797, #799, #784, #785, #787, #868 | 5 | pending |
| 33 | [MIG-351 #814](https://github.com/iamthamanic/sagatree/issues/814) | 2 | OPEN | #867, #868, #869, #870 | 4 | pending |
| 34 | [RPC-SAGA-PROJECTIONS #876](https://github.com/iamthamanic/sagatree/issues/876) | 2 | OPEN | #795, #792, #797, #799, #784, #785, #787, #875, #870 | 5 | pending |
| 35 | [MIG-352 #815](https://github.com/iamthamanic/sagatree/issues/815) | 2 | OPEN | #871, #872, #873, #874, #875, #876 | 4 | pending |
| 36 | [RPC-WORLD-MAP #861](https://github.com/iamthamanic/sagatree/issues/861) | 2 | OPEN | #795, #792, #797, #799, #784, #785, #787 | 5 | pending |
| 37 | [RPC-ATLAS-MAPS #862](https://github.com/iamthamanic/sagatree/issues/862) | 2 | OPEN | #795, #792, #797, #799, #784, #785, #787, #861 | 5 | pending |
| 38 | [RPC-WORLD-PLACES #863](https://github.com/iamthamanic/sagatree/issues/863) | 2 | OPEN | #795, #792, #797, #799, #784, #785, #787, #862 | 5 | pending |
| 39 | [RPC-WORLD-CREATE #864](https://github.com/iamthamanic/sagatree/issues/864) | 2 | OPEN | #795, #792, #797, #799, #784, #785, #787, #863 | 5 | pending |
| 40 | [RPC-WORLD-RESTRUCTURE #865](https://github.com/iamthamanic/sagatree/issues/865) | 2 | OPEN | #795, #792, #797, #799, #784, #785, #787, #864 | 5 | pending |
| 41 | [RPC-WORLD-DESTRUCTIVE #866](https://github.com/iamthamanic/sagatree/issues/866) | 2 | OPEN | #795, #792, #797, #799, #784, #785, #787, #865 | 5 | pending |
| 42 | [MIG-350 #813](https://github.com/iamthamanic/sagatree/issues/813) | 2 | OPEN | #861, #862, #863, #864, #865, #866 | 4 | pending |
| 43 | [MIG-402 #818](https://github.com/iamthamanic/sagatree/issues/818) | 3 | OPEN | #795, #792, #793, #791, #841 | 11 | pending |
| 44 | [MIG-401 #817](https://github.com/iamthamanic/sagatree/issues/817) | 3 | OPEN | #795, #792, #793, #818, #791 | 5 | pending |
| 45 | [MIG-403 #819](https://github.com/iamthamanic/sagatree/issues/819) | 3 | OPEN | #795, #792, #793 | 4 | pending |
| 46 | [MIG-404 #820](https://github.com/iamthamanic/sagatree/issues/820) | 3 | OPEN | #795, #792, #793, #818, #791, #841 | 6 | pending |
| 47 | [MIG-405 #821](https://github.com/iamthamanic/sagatree/issues/821) | 3 | OPEN | #795, #792, #793, #818, #791 | 6 | pending |
| 48 | [MIG-406 #822](https://github.com/iamthamanic/sagatree/issues/822) | 3 | OPEN | #795, #792, #793 | 4 | pending |
| 49 | [MIG-407 #823](https://github.com/iamthamanic/sagatree/issues/823) | 3 | OPEN | #795, #792, #793 | 4 | pending |
| 50 | [MIG-408 #824](https://github.com/iamthamanic/sagatree/issues/824) | 3 | OPEN | #795, #792, #793, #841 | 4 | pending |
| 51 | [MIG-409 #825](https://github.com/iamthamanic/sagatree/issues/825) | 3 | OPEN | #795, #792, #793, #818, #791, #841 | 7 | pending |
| 52 | [MIG-410 #826](https://github.com/iamthamanic/sagatree/issues/826) | 3 | OPEN | #795, #792, #793, #818, #791, #841 | 7 | pending |
| 53 | [MIG-411 #827](https://github.com/iamthamanic/sagatree/issues/827) | 3 | OPEN | #795, #792, #793 | 4 | pending |
| 54 | [MIG-412 #828](https://github.com/iamthamanic/sagatree/issues/828) | 3 | OPEN | #795, #792, #793, #841 | 6 | pending |
| 55 | [MIG-413 #829](https://github.com/iamthamanic/sagatree/issues/829) | 3 | OPEN | #795, #792, #793 | 4 | pending |
| 56 | [MIG-415 #831](https://github.com/iamthamanic/sagatree/issues/831) | 3 | OPEN | #795, #792, #793 | 4 | pending |
| 57 | [MIG-416 #832](https://github.com/iamthamanic/sagatree/issues/832) | 3 | OPEN | #795, #792, #793, #841 | 4 | pending |
| 58 | [MIG-417 #833](https://github.com/iamthamanic/sagatree/issues/833) | 3 | OPEN | #795, #792, #793 | 4 | pending |
| 59 | [MIG-418 #834](https://github.com/iamthamanic/sagatree/issues/834) | 3 | OPEN | #795, #792, #793 | 4 | pending |
| 60 | [MIG-419 #835](https://github.com/iamthamanic/sagatree/issues/835) | 3 | OPEN | #795, #792, #793 | 4 | pending |
| 61 | [MIG-420 #836](https://github.com/iamthamanic/sagatree/issues/836) | 3 | OPEN | #795, #792, #793, #791, #841 | 6 | pending |
| 62 | [MIG-421 #837](https://github.com/iamthamanic/sagatree/issues/837) | 3 | OPEN | #795, #792, #793, #818, #870, #791 | 6 | pending |
| 63 | [MIG-414 #830](https://github.com/iamthamanic/sagatree/issues/830) | 3 | OPEN | #795, #792, #793, #818, #820, #821, #825, #826, #828, #836, #837 | 6 | pending |
| 64 | [MIG-422 #838](https://github.com/iamthamanic/sagatree/issues/838) | 3 | OPEN | #795, #792, #793 | 4 | pending |
| 65 | [MIG-423 #839](https://github.com/iamthamanic/sagatree/issues/839) | 3 | OPEN | #795, #792, #793 | 4 | pending |
| 66 | [MIG-424 #840](https://github.com/iamthamanic/sagatree/issues/840) | 3 | OPEN | #795, #792, #793 | 4 | pending |
| 67 | [MIG-301 #800](https://github.com/iamthamanic/sagatree/issues/800) | 4 | OPEN | #791, #792, #795, #818, #793 | 4 | pending |
| 68 | [MIG-302 #801](https://github.com/iamthamanic/sagatree/issues/801) | 4 | OPEN | #791, #792, #795, #820, #821, #841, #793 | 4 | pending |
| 69 | [MIG-303 #802](https://github.com/iamthamanic/sagatree/issues/802) | 4 | OPEN | #791, #792, #795, #825, #826, #793 | 4 | pending |
| 70 | [MIG-304 #803](https://github.com/iamthamanic/sagatree/issues/803) | 4 | OPEN | #791, #792, #795, #828, #793 | 4 | pending |
| 71 | [MIG-305 #804](https://github.com/iamthamanic/sagatree/issues/804) | 4 | OPEN | #791, #792, #795, #878, #793 | 5 | pending |
| 72 | [MIG-306 #805](https://github.com/iamthamanic/sagatree/issues/805) | 4 | OPEN | #791, #792, #795 | 3 | pending |
| 73 | [MIG-307 #806](https://github.com/iamthamanic/sagatree/issues/806) | 4 | OPEN | #791, #792, #795, #877, #793 | 8 | pending |
| 74 | [MIG-308 #807](https://github.com/iamthamanic/sagatree/issues/807) | 4 | OPEN | #791, #792, #795, #868, #873, #875, #876, #874, #793 | 15 | pending |
| 75 | [MIG-309 #808](https://github.com/iamthamanic/sagatree/issues/808) | 4 | OPEN | #791, #792, #795, #793 | 3 | pending |
| 76 | [MIG-310 #809](https://github.com/iamthamanic/sagatree/issues/809) | 4 | OPEN | #791, #792, #795, #871, #873, #872, #876, #793 | 15 | pending |
| 77 | [MIG-311 #810](https://github.com/iamthamanic/sagatree/issues/810) | 4 | OPEN | #791, #792, #795, #867, #868, #869, #870, #836, #837, #796, #793 | 17 | pending |
| 78 | [MIG-312 #811](https://github.com/iamthamanic/sagatree/issues/811) | 4 | OPEN | #791, #792, #795, #841, #793 | 4 | pending |
| 79 | [MIG-313 #812](https://github.com/iamthamanic/sagatree/issues/812) | 4 | OPEN | #791, #792, #795, #866, #864, #865, #862, #861, #863, #841, #793 | 21 | pending |
| 80 | [MIG-501 #842](https://github.com/iamthamanic/sagatree/issues/842) | 5 | OPEN | #841, #795 | 4 | pending |
| 81 | [MIG-502 #843](https://github.com/iamthamanic/sagatree/issues/843) | 5 | OPEN | #841, #844, #795 | 4 | pending |
| 82 | [MIG-600 #845](https://github.com/iamthamanic/sagatree/issues/845) | 6 | OPEN | #796, #798, #799, #841, #816, #814, #815, #813, #818, #817, #819, #820, #821, #822, #823, #824, #825, #826, #827, #828, #829, #831, #832, #833, #834, #835, #836, #837, #830, #838, #839, #840, #800, #801, #802, #803, #804, #805, #806, #807, #808, #809, #810, #811, #812, #861, #862, #863, #864, #865, #866, #867, #868, #869, #870, #871, #872, #873, #874, #875, #876, #877, #878 | 4 | pending |
| 83 | [MIG-601 #846](https://github.com/iamthamanic/sagatree/issues/846) | 6 | OPEN | #789, #793, #794, #841, #830 | 4 | pending |
| 84 | [MIG-602 #847](https://github.com/iamthamanic/sagatree/issues/847) | 6 | OPEN | #845, #846, #770, #816, #814, #815, #813, #818, #817, #819, #820, #821, #822, #823, #824, #825, #826, #827, #828, #829, #831, #832, #833, #834, #835, #836, #837, #830, #838, #839, #840, #800, #801, #802, #803, #804, #805, #806, #807, #808, #809, #810, #811, #812, #861, #862, #863, #864, #865, #866, #867, #868, #869, #870, #871, #872, #873, #874, #875, #876, #877, #878 | 4 | pending |
| 85 | [MIG-603 #848](https://github.com/iamthamanic/sagatree/issues/848) | 6 | OPEN | #843, #844, #846 | 4 | pending |
| 86 | [GATE-05 #788](https://github.com/iamthamanic/sagatree/issues/788) | 7 | OPEN | #847, #848 | 4 | pending |
| 87 | [MIG-700 #849](https://github.com/iamthamanic/sagatree/issues/849) | 7 | OPEN | #782, #770, #783, #784, #785, #786, #787, #789, #790, #792, #791, #793, #794, #841, #795, #797, #798, #799, #796, #844, #816, #814, #815, #813, #818, #817, #819, #820, #821, #822, #823, #824, #825, #826, #827, #828, #829, #831, #832, #833, #834, #835, #836, #837, #830, #838, #839, #840, #800, #801, #802, #803, #804, #805, #806, #807, #808, #809, #810, #811, #812, #842, #843, #845, #846, #847, #848, #861, #862, #863, #864, #865, #866, #867, #868, #869, #870, #871, #872, #873, #874, #875, #876, #877, #878 | 4 | pending |
| 88 | [MIG-701 #850](https://github.com/iamthamanic/sagatree/issues/850) | 7 | OPEN | #849 | 4 | pending |
| 89 | [MIG-702 #851](https://github.com/iamthamanic/sagatree/issues/851) | 7 | OPEN | #849, #850, #770, #848 | 4 | pending |
| 90 | [MIG-703 #852](https://github.com/iamthamanic/sagatree/issues/852) | 7 | OPEN | #788, #847, #848 | 4 | pending |

## Rework-Regel und Done Definition

1. **Kanonic source generator first:** `scripts/stack-migration-issue-rendering.mjs`, `scripts/stack-migration-plan-contracts.mjs`, Intake, `stack-migration-issue-contracts.mjs` und Validator so überarbeiten, dass Beschlüsse reproduzierbar in 90 Bodies und `publish-plan` geschrieben werden.
2. **Per-Issue:** Issue-Contract korrekt (Typ, Scope In/Out, Journey nur wo UI, Runtime nur für berührte Achsen, Security, Edge Cases, Acceptance, Blockers); existierende Source-Nachweise und alle negativen requiredTests erhalten. Die vorhandenen .qa/design-Mirrors reichen alleine nicht als tieferer Designvertrag.
3. **State:** GitHub Merge/CI/Acceptance verifizieren, dann historische Labels und Intake-Status vereinheitlichen. Abschluss nur bei gehashter Evidenz, nie aufgrund geschlossenem Issue allein.
4. **Sync:** Nach Generator-Render alle 90 GitHub-Bodies mit lokalem kanonischem Ergebnis vergleichen, Mismatches=0, Publication-Hashes aktualisieren, `npm run check:stack-migration-prep` und `npm run test-gate` gegen denselben HEAD ausführen. Bekannte rote Baselines dürfen nicht ohne begründete, scoped Policy maskiert werden.
5. **ECC:** Nur READY queue drain; bei blockiertem Issue unabhängige Kandidaten bearbeiten. Kein Produktionseingriff aufgrund eines grünen Dokumentationschecks.

**Status dieses Audits:** Struktur und Freigaberichtung erfasst; finale vollständige 90-Contract-Synchronisierung und Ausführungsgates **PENDING**.
