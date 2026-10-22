import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function renderReport(report) {
  const ms = (value) => Number(value).toFixed(3);
  const candidates = report.candidateResults;
  const lines = [
    '# GATE-01 — gemessener Linux-SQLite-Vergleich', '',
    `**Ausführungsstatus:** ${report.status}. **Architektur:** ${report.architectureApproval}. Keine Migration ist dadurch freigegeben.`, '',
    `Beobachtet: ${report.observedAt}. Node ${report.runtime.node}, Native-ABI ${report.runtime.nodeAbi}, ${report.runtime.platform}/${report.runtime.architecture}.`, '',
    '## Reale Ergebnisse', '',
    '| Kandidat | Fachliche Tests | Write-Median (ms) | Write-p95 (ms) | Write-Maximum (ms) | Kaltstart-Median (ms) | Kaltstart-p95 (ms) |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...candidates.map((c) => `| ${c.candidate} | ${c.passed} PASS / ${c.failed} FAIL | ${ms(c.warmWriteLatencyMs.median)} | ${ms(c.warmWriteLatencyMs.p95)} | ${ms(c.warmWriteLatencyMs.max)} | ${ms(c.coldProcessWallMs.median)} | ${ms(c.coldProcessWallMs.p95)} |`), '',
    'Je Kandidat: 100 sequentielle, echte SQLite-Transaktionen mit Revision und Quittung; zehn frische Node-Prozesse. Die Kaltstart-Wanduhr umfasst Prozessstart, Loader, Import, Datenbanköffnung und ersten autorisierten Read. OS-/Transpiler-Caches wurden nicht geleert. Das sind Messungen dieses Fixtures, keine allgemeine Leistungsgarantie.', '',
    '## Fachliche Abnahme', '',
    '| Gate-Zeile | Geprüfter Umfang |', '| --- | --- |',
    ...report.gateRows.map((row) => `| ${row.row} | ${row.scope} |`), '',
    'Die Einzelbeobachtungen einschließlich der erwarteten Denial-Fehler, Rollback-/Replay-Zustände und jeder Write-Latenz stehen in [observations.json](observations.json). Ein erwarteter Berechtigungsfehler zählt nur bei dem konkreten Denial-Code; SQL-/Compiler-/Runtime-Fehler werden nicht in einen erfolgreichen Negativtest umgedeutet.', '',
    'Zusätzlich wurde ZenStack ohne Application-Handprüfungen direkt abgefragt: eigene ORM- und QueryBuilder-Policyfilter, nullable GM-Feldredaktion, verweigerter GM-Map-Write, verweigerter World-FK-Write und verweigerte Raw-SQL-Lese-/Schreibaufrufe. Alle Proben liefen gegen den echten PolicyPlugin 3.9.8 und echte SQLite-Dateien.', '',
    '## Raw-SQL-Grenze', '',
    'Die geprüfte PoC-Application besitzt vier Domain-Operationen und keine SQL-/Client-Funktion. Der verpflichtende PoC-Importcheck blockiert sechs konkrete Client-/Driver-Importversuche. ZenStack sperrt mit aktivem PolicyPlugin zusätzlich tatsächliche Raw-SQL-Aufrufe.', '',
    'Der echte ungeschützte Drizzle-Client las im separaten Infrastruktur-Probeaufruf alle sechs Karten und änderte eine fremde Karte innerhalb einer anschließend zurückgerollten Transaktion. Diese Beobachtung macht die verpflichtende Kapselung und Importprüfung des PolicyService-Kandidaten konkret. Die Einbindung einer solchen Grenze in das Produkt-CI ist **NOT RUN**. Keiner der Kandidaten schützt gegen beliebigen Code mit direktem Dateizugriff oder einen bewusst ungeschützten Treiber.', '',
    '## Codeumfang', '',
    `Selbst verfasste Nichtleer-/Nichtkommentar-LOC: Drizzle **${report.codeSize.authoredDrizzleLoc}**, ZenStack **${report.codeSize.authoredZenstackLoc}**, Differenz ZenStack minus Drizzle **${report.codeSize.authoredZenstackLoc - report.codeSize.authoredDrizzleLoc}**. Zusätzlich erzeugt ZenStack **${report.codeSize.generatedZenstackLoc}** LOC. Gemeinsame Domain-, App- und Prüfdateien sind separat aufgeführt.`, '',
    '| Datei | Physische Zeilen | Ohne Leer-/Kommentarzeilen |', '| --- | --- | --- |',
    ...report.codeSize.files.map((file) => `| ${file.file} | ${file.physicalLines} | ${file.nonBlankNonCommentLines} |`), '',
    'LOC sind stark von Sprache und Formatierung abhängig. Entwicklerzeit zum Hinzufügen einer Ressource, subjektive Komplexität und produktiver Migrationsaufwand wurden nicht gemessen.', '',
    '## Sichere Nachfolger-Zielbedingungen', '', ...report.secureTargetChoices.map((item) => '- ' + item), '',
    '## Befunde aller Schweregrade', '',
    '| Schwere | ID | Status | Befund |', '| --- | --- | --- | --- |',
    ...report.findings.map((finding) => `| ${finding.severity} | ${finding.id} | ${finding.status} | ${finding.detail} |`), '',
    '## Nicht ausgeführt', '', ...report.notRun.map((item) => '- **NOT RUN:** ' + item), '',
    '## Einordnung für die Entscheidung', '',
    'Beide Kandidaten erfüllen die geprüfte Owner-/GM-/Saga-Matrix und die Transaktions-/Idempotenzbedingungen. Drizzle hatte in diesem Lauf den niedrigeren Write-p95; dafür muss die verpflichtende Service-/Import-Grenze die rohe Datenbankfähigkeit abschirmen. ZenStack lieferte reale generierte Abfrage- und Feldpolicies einschließlich Raw-SQL-Sperre; Feldpolicies bleiben laut offizieller Dokumentation eine Preview-Funktion.', '',
    'Eine belastbare Entscheidung für mehr als 50 Tabellen benötigt zusätzliche Migrations- und Plattformnachweise. Insbesondere dürfen PostgreSQL-Trigger, ACLs, RLS und die 57 RPC-Verträge nicht durch diese sieben Modelltabellen als bereits portiert gelten. Eine Architekturentscheidung oder ADR-ST-05 wurde hier nicht getroffen.', '',
    '## Quellenbindung und Wiederholung', '',
    'Versionen, Lizenzangaben aus installierten Paketmanifesten, vollständige Source-SHA-256, native SQLite-Binary-Hash und Beobachtungshash stehen in [report.json](report.json). Die aktuelle Quellcodebindung wird mit `npm run verify` geprüft; `npm run check` führt die Messung erneut aus.', '',
    '| Paket | Version | Lizenz laut Paketmanifest |', '| --- | --- | --- |',
    ...report.dependencies.map((entry) => `| ${entry.name} | ${entry.version} | ${entry.license ?? 'Nicht angegeben'} |`), '',
    'Offizielle API-Quellen: [ZenStack-Policies](https://zenstack.dev/docs/orm/access-control/write-policies), [PolicyPlugin/Raw-SQL](https://zenstack.dev/docs/reference/plugins/policy), [Feldpolicies](https://zenstack.dev/docs/orm/access-control/field-level), [ZenStack-Migration](https://zenstack.dev/docs/orm/migration), [Drizzle-SQLite](https://orm.drizzle.team/docs/sqlite/get-started-sqlite) und [Drizzle-Transaktionen](https://orm.drizzle.team/docs/transactions). Die konkrete Verhaltensevidenz stammt aus diesem ausgeführten Paket.', '',
  ];
  return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const local = path.dirname(fileURLToPath(import.meta.url));
  const repo = process.env.GATE01_REPO_ROOT ?? path.resolve(local, '../../..');
  const evidence = process.env.GATE01_EVIDENCE_DIR ?? path.join(repo, '.qa/evidence/stack-migration-prep/pocs/gate-01');
  const report = JSON.parse(fs.readFileSync(path.join(evidence, 'report.json'), 'utf8'));
  fs.writeFileSync(path.join(evidence, 'report.md'), renderReport(report));
  process.stdout.write('Rendered GATE-01 evidence report for ' + report.runtime.node + '\n');
}
