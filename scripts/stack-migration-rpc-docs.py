#!/usr/bin/env python3
"""Render reviewed RPC contracts from the exact AST, caller and PostgreSQL evidence."""
import argparse
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'.qa/intake/rpc-contracts'

def code(value):
    return '`'+str(value).replace('`','\\`').replace('|','\\|').replace('\n',' ')+'`'

def bullets(values):
    return '\n'.join('- '+str(v) for v in values)+'\n'

def table(headers, rows):
    def cell(v): return str(v if v is not None else 'NULL').replace('|','\\|').replace('\n',' ')
    return '| '+' | '.join(headers)+' |\n| '+' | '.join('---' for _ in headers)+' |\n'+''.join('| '+' | '.join(cell(v) for v in row)+' |\n' for row in rows)

def link(path,label=None):
    rel=Path(path)
    if rel.is_absolute(): rel=rel.relative_to(ROOT)
    target=Path(__import__('os').path.relpath(ROOT/rel,BASE)).as_posix()
    return '['+(label or rel.as_posix())+']('+target+')'

def source(ref):
    return link(ref['path'])+' (Zeilen '+str(ref['startLine'])+'–'+str(ref['endLine'])+', SHA-256 '+code(ref['sha256'])+')'

def issue(n): return '[#'+str(n)+'](https://github.com/iamthamanic/sagatree/issues/'+str(n)+')'

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    inv=json.loads((BASE/'inventory.json').read_text()); cat=json.loads((BASE/'effective-functions.json').read_text());pg=json.loads((BASE/'postgres-proof.json').read_text());groups=json.loads((BASE/'split-groups.json').read_text());callers=json.loads((BASE/'callers.json').read_text())
    fs={f['signature']:f for f in cat['functions']};pgfs={f['fingerprint']['signature']:f for f in pg['functions']};mapping={n:g for g in groups['groups'] for n in g['rpcNames']};outputs={}
    all_defects={}
    for r in inv['rpcs']:
        for d in r['legacyDefects']:
            item=all_defects.setdefault(d['id'],{**d,'rpcs':[]});item['rpcs'].append(r['rpc'])
    for r in inv['rpcs']:
        name=r['rpc'];g=mapping[name];lines=['# RPC-Vertrag: '+code(name),'',r['summary'],'',
          '**Status:** '+code(r['verification']['status'])+'. Quellcode-Baseline '+code(inv['generatedFromBaseline'])+'. **Umsetzungsfreigabe: nein.**',
          '', '**Teilaufgabe:** '+issue(g['issueNumber'])+' — '+g['id']+'; Koordinator '+issue(g['parentIssue'])+'.','',
          'Die Signaturen, Defaults und Funktionskörper der Repository-Migrationskette wurden mit echtem isoliertem PostgreSQL 15 verglichen. Dieser Nachweis bestätigt keine produktiv deployte Datenbank, keinen PostgREST-/JWT-Transport und keine vollständige Verhaltensparität. Konkrete rote Legacy-Tests bleiben Freigabesperren. Bei der optionalen Marketplace-Funktion ist bereits ihre Installation außerhalb dieser Kette offen.','',
          '## Verhalten','',bullets(r['behavior']), '## Berechtigungen','',bullets(r['authorization'])]
        for index,o in enumerate(r['overloads'],1):
            lines+=['## SQL-Signatur '+str(index),'',code(o['signature']),'',table(['Parameter','PostgreSQL-Typ','Modus','Default'],[[p['name'] or '(unbenannt)',code(p['type']),p['mode'].removeprefix('FUNC_PARAM_'),code(p['default']) if p['default'] is not None else 'Kein Default — expliziter Wert erforderlich'] for p in o['parameters']]),'**RETURNS:** '+code(o['returns'])+'.','', '**Wirksame Definition:** '+source(o['source'])+'.','', '**Vollständiger abgeleiteter SQL-Text:** '+link(o['effectiveSource']['path'])+'; SHA-256 '+code(o['effectiveSource']['sha256'])+'.','']
            if o['transformations']:
                lines+=['**Nachträgliche Transformationen:**','',bullets([t['kind']+': '+source(t['source']) for t in o['transformations']])]
            if o['rowReturnColumns']:
                lines+=['### Vollständige Row-Antwort','', 'Die folgenden finalen Spalten stammen aus pg_attribute/pg_attrdef der isolierten, vollständig migrierten PostgreSQL-Datenbank. Ihre Reihenfolge ist die reale Composite-Reihenfolge.','',table(['Spalte','Typ','NOT NULL','Default'],[[c['name'],code(c['type']),c['not_null'],code(c['default_expression']) if c['default_expression'] is not None else 'Kein Default'] for c in o['rowReturnColumns']])]
            if o['tableReturnColumns']:
                lines+=['### TABLE-Antwort','',table(['Ausgabespalte','Typ'],[[c['name'],code(c['type'])] for c in o['tableReturnColumns']])]
            lines+=['### Ausführungskontext und ACL','',table(['Eigenschaft','Belegter Wert'],[['SECURITY DEFINER',o['securityDefiner']],['search_path',code(o['searchPath']) if o['searchPath'] else 'Nicht im Funktionsheader gesetzt'],['Migration-/Skript-EXECUTE-Deklarationen',', '.join(o['executeGrants']) or 'Keine verbleibenden aus dieser DDL-Auswertung'],['ACL-Scope',o['executeGrantsScope']]])]
            obs=o['isolatedPostgresObservation']
            if obs:
                lines+=['Die Plattform setzt zusätzliche Defaultprivilegien. Deshalb ist die folgende beobachtete ACL für das isolierte Fixture maßgeblich, nicht allein die GRANT/REVOKE-Liste der Migration. EXECUTE-Berechtigung ist vom inneren Auth-Guard zu unterscheiden.','',table(['Owner','Effektive Fixture-ACL','authenticated EXECUTE','anon EXECUTE'],[[obs['owner'],code(obs['acl']),obs['authenticated_execute'],obs['anon_execute']]])]
            else:
                lines+=['**Keine Katalogbeobachtung:** Diese optionale Funktion fehlt in der Repository-Migrationskette. Alternative Installationsquellen stehen unten.','']
            if o['semantics']['returns']:
                lines+=['### Exakte Return-Pfade','',table(['Parser-Zeile','Bedingungspfad','Return-Ausdruck'],[[q['line'],' ∧ '.join(q['path']) or 'unbedingt',code(q['expression'])] for q in o['semantics']['returns']])]
            if o['semantics']['jsonObjectKeys']:
                lines+=['Die vollständigen SQL-Ausdrücke und Caller-Decoder sind normativ. Die AST-erfassten JSON-Schlüsselgruppen umfassen auch verschachtelte Objekte und Event-Payloads; sie sind keine zusammengeworfene globale Antwortstruktur.','',bullets([', '.join(code(k) for k in ks) for ks in o['semantics']['jsonObjectKeys']])]
            lines+=['### Explizite SQL-Fehler dieses Overloads','']
            errs=o['semantics']['errors']
            if errs:
                lines+=[table(['SQLSTATE','Meldung','Formatparameter','Bedingungspfad'],[[e['sqlstateExpression'].strip("'"),e['message'],', '.join(e.get('parameters',[])) or '—',' ∧ '.join(e['path']) or 'unbedingt'] for e in errs])]
            else:
                lines+=['Keine eigene RAISE-EXCEPTION-Anweisung. Fehler können aus delegierten Funktionen, Typkonvertierung oder Datenbank-Constraints stammen.','']
        lines+=['## Transaktion, Idempotenz und Folgewirkungen','',bullets(r['transactionAndIdempotency']), '**Direkt referenzierte reale Relationen:** '+', '.join(code(t) for t in r['directRelations'])+'.','', '**Transitive reale Relationen:** '+', '.join(code(t) for t in r['transitiveRelations'])+'.','',
          'Diese Relationen stammen aus PostgreSQL-AST-RangeVars und DML-Zielen, einschließlich erreichbarer SQL-Helper und anwendbarer Trigger. CTE-Namen, Aliase und SQL-Schlüsselwörter sind ausgeschlossen. Temporäre Zuordnungstabellen tragen ausdrücklich das Schema pg_temp.','']
        writes=[]
        for key in r['dependencyFunctions']:
            for w in fs[key]['semantics']['writes']:
                writes.append([code(key),w['operation'],code(w['relation']),', '.join(w.get('columns',[])) or '—',' ∧ '.join(w.get('path',[])) or 'unbedingt'])
        if name=='increment_marketplace_downloads':
            for w in r['overloads'][0]['semantics']['writes']:writes.append([name,w['operation'],code(w['relation']),', '.join(w.get('columns',[])),'Optionale Installation'])
        if writes: lines+=['### Direkte und transitive DML-Effekte','',table(['Funktion','Operation','Relation','Spalten','Bedingungspfad'],writes)]
        triggers=[e for e in r['dependencyEdges'] if e['kind']=='trigger']
        if triggers:lines+=['### Erreichbare Trigger','',table(['Auslösende Funktion','Relation / Trigger','Funktion'],[[code(e['from']),code(e['relation'])+' / '+code(e['trigger']),code(e['to'])] for e in triggers])]
        deps=[k for k in r['dependencyFunctions'] if not k.startswith('public.'+name+'(')]
        if deps:
            lines+=['### Delegierte Funktionen und Fehler','', 'Alle vollständigen Funktionskörper, Abzweigungen, Queries, Writes, Errors und Source-Hashes stehen im '+link('.qa/intake/rpc-contracts/effective-functions.json','gemeinsamen Funktionskatalog')+'.','']
            rows=[]
            for key in deps:
                f=fs[key]; fpkey=key.replace('(public.','(').replace(',public.',',');obs=pgfs.get(fpkey,{})
                rows.append([code(key),link(f['source']['path']),', '.join(sorted({e['sqlstateExpression'].strip("'") for e in f['semantics']['errors']})) or 'Keine eigene RAISE',str(obs.get('anon_execute','—'))+'/'+str(obs.get('authenticated_execute','—'))])
            lines+=[table(['Helper','SQL-Quelle','Explizite SQLSTATEs','Fixture EXECUTE anon/authenticated'],rows)]
        if r['relationConstraints']:
            lines+=['### Constraint-Vertrag','', 'Die finalen Datenbank-Constraints der beteiligten Relationen sind pro RPC in inventory.json.relationConstraints und vollständig in postgres-proof.json erfasst. NOT NULL, Foreign Key, Unique/Primary Key und CHECK können zusätzlich 23502, 23503, 23505 bzw. 23514 erzeugen; Type-Casts können unabhängig von eigenen RAISE-Anweisungen fehlschlagen. Diese generischen Datenbankfehler werden nicht als bereits durch jeden einzelnen RPC reproduziert ausgegeben.','']
        if r.get('alternativeInstallations'):
            lines+=['## Alternative Installationsquellen','', 'Dies sind unabhängige Skriptvarianten derselben Signatur, keine nebeneinander wirksamen Overloads.','']
            for c in r['alternativeInstallations']:
                lines+=['### '+c['source']['path'],'',source(c['source']), '', '**Deklarierte EXECUTE-Rollen:** '+', '.join(c['executeGrants'])+'.','']
                if c['supportingSchema']:
                    lines+=['**Mitinstallierter Tabellen-/Policy-/Trigger-Vertrag:**','', '```sql\n'+';\n'.join(t['statement'] for t in c['supportingSchema'])+';\n```','']
                for f in c['supportingFunctions']:lines+=['**Mitinstallierter Trigger-Helper:**','', '```sql\n'+f['effectiveSql']+';\n```','']
        if r['operations']:
            lines+=['## Alle 15 Runtime-Kinds und Unteroperationen','', 'Jeder erfolgreiche Erstaufruf endet im gemeinsamen Session-Lock-/Revision-/Event-/Snapshot-Vertrag. Replay und vorab abgewiesene Aufrufe führen diesen Abschluss nicht erneut aus.','']
            for op in r['operations']:
                lines+=['### '+code(op['kind']),'','**Rolle:** '+op['role']+'.','', '**Request:** '+op['request'],'', '**Varianten:**','']
                if op['variants'] and isinstance(op['variants'][0],dict):lines+=[table(['Op','Input','Effekt'],[[v['op'],v['input'],v['effect']] for v in op['variants']])]
                else:lines+=[bullets([code(v) for v in op['variants']])]
                lines+=[bullets(op['effects']), '**Spezifische Abnahme:**','',bullets(op['requiredTests'])]
                lines+=['**Normative Helper:** '+', '.join(code(h['signature']) for h in op['helperContracts'])+'.' if op['helperContracts'] else '**Normativer Zweig:** direkt im Runtime-RPC.', '']
        lines+=['## Caller: Request-Mapping, Response-Decoding und Fehler','']
        for caller in r['callerContracts']:
            lines+=['### '+caller['path']+':'+str(caller['line']),'','AST-Auflösung: '+code(caller['resolution'])+'; SHA-256 '+code(caller['sourceSha256'])+'.','', 'Der vollständige aufrufende Funktionskörper enthält Parameterumformung, RPC-Aufruf, Response-Prüfung, Fehlerumwandlung und gegebenenfalls Fallback:','', '```typescript\n'+caller['callerContract']+'\n```','']
            if caller['supportingDeclarations']:
                lines+=['Direkt oder transitiv referenzierte lokale/importierte Mapper, Decoder und Vertrags-Typen sind zusätzlich mit vollständigem Source-Text in callers.json und inventory.json.callerContracts.supportingDeclarations gespeichert:','',table(['Symbol','Quelle','Zeile','SHA-256'],[[code(d['name']),link(d['path']),d['line'],code(d['sourceSha256'])] for d in caller['supportingDeclarations']])]
        if r.get('transportObservations'):
            lines+=['## Beobachteter isolierter HTTP-Transport','', 'Diese konkreten Fälle wurden über echte GoTrue-Authentifizierung und PostgREST 12.0.1 gemessen. Die gespeicherten Harness-Hashes bezeichnen ausschließlich den damaligen Ausführungsstand zum observedAt-Zeitpunkt; später veränderte Harness-Dateien werden dadurch nicht als erneut ausgeführt oder aktuell verifiziert ausgewiesen. Daraus folgt keine allgemeine SQLSTATE→HTTP-Mappingtabelle für alle RPCs.','']
            for o in r['transportObservations']:
                lines+=[table(['RPC-Pfad','Rolle','HTTP','SQLSTATE','Meldung'],[[o['path'],o['actor'],o['status'],o['response']['code'],o['response']['message']]]), 'Beleg: '+link(o['source']['path'])+'; SHA-256 '+code(o['source']['sha256'])+'.', '']
        lines+=['## Konkrete Abnahmekriterien','', '\n'.join('- [ ] '+t for t in r['requiredTests']), '',
          'Diese Punkte sind verpflichtende Tests für den Nachfolger. Ihre Auflistung behauptet keinen grünen Live-Test. Bereits ausgeführte isolierte SQL-Proben und ihre roten Legacy-Ergebnisse sind gesondert in legacy-observations.json erfasst.','', '## Legacy-Defekte und offene Entscheidungen','']
        if not r['legacyDefects']:
            lines+=['Kein zusätzlicher RPC-spezifischer Defekt in dieser Quellcodeprüfung festgestellt. Dies ersetzt weder Architektur-Gates noch ausstehende Verhaltens-/Produktabnahme.','']
        for d in r['legacyDefects']:
            lines+=['### '+d['severity']+' — '+d['id'],'',d['summary'],'', '**Beleg:** '+d['sourceEvidence'],'', '**Erforderliche Nachfolger-Abnahme:** '+d['requiredSuccessorAcceptance'],'']
            if d.get('observation'):lines+=['**Isolierte Beobachtung:** '+link(d['observation']['path'])+' / '+code(d['observation']['testId'])+'. Eigene RPC-Reproduktion: '+str(d.get('isolatedPostgresReproduced',False))+'.','']
            if d.get('reproductionScope'):lines+=[d['reproductionScope'],'']
        if r['removedOverloads']:
            lines+=['## Entfernte historische Signaturen','',table(['Entfernte Signatur','Grund','Quelle'],[[code(d['signature']),d['reason'],source(d['source'])] for d in r['removedOverloads']])]
        lines+=['## Vollständige Quellenbindung','', 'Die folgenden Hashes binden SQL-Kette, transitive Tabellen-/Trigger-/Policyquellen und Caller-/Decoderquellen. Der zusätzliche isolierte Katalogvergleich steht in '+link('.qa/intake/rpc-contracts/postgres-proof.json')+'.','',table(['Quelle','SHA-256'],[[link(f['path']),code(f['sha256'])] for f in r['sourceFiles']])]
        outputs[name+'.md']='\n'.join(lines).rstrip()+'\n'
    lines=['# RPC-Quellverträge für Epic #773 / PREP-04 #777','',
      '**57 RPC-Namen vollständig erfasst:** die ursprünglichen 55 Literal-Aufrufe plus zwei über eine TypeScript-Literal-Union aufgerufene Outcome-Promotions. Die AST-Inventur enthält 57 aufgelöste Namensvarianten an '+str(callers['physicalCallSiteCount'])+' physischen Aufrufstellen.','',
      '**56 RPC-Namen / 57 wirksame Overloads** sind Teil der vollständig eingespielten Repository-Migrationskette. **Ein weiterer RPC-Name mit einer Signatur** ist ausschließlich in zwei optionalen Marketplace-Installationsskripten belegt. Bei save_session_recap_summary sind Zweierwrapper und Dreierfunktion beide vorhanden (get_session_recap selbst hat nur einen Overload); der Zweier-Atlas-Wrapper wurde dagegen durch Migration106 entfernt.','',
      '## Belegstand und Grenzen','',
      '- Baseline: '+code(inv['generatedFromBaseline'])+'. Sämtliche 106 SQL-Migrationsdateien wurden in voller lexikalischer Dateinamenreihenfolge verarbeitet; doppelte Nummernpräfixe werden nicht zusammengeworfen.',
      '- PostgreSQL-/PLpgSQL-AST: pglast 7.21, 0 Parsefehler. Dynamische Umbenennungen073/079 und Funktionskörperumschreibung085 sind explizit nachgebildet.',
      '- Isoliertes echtes PostgreSQL15: **177 von177 Public-Funktionen** stimmen in Body-Hash, Signatur, Parametern/Defaults, RETURNS, Sprache, Security-Kontext und Volatilität überein. Effektive ACL, finale Spalten und Constraints sind als Fixture-Beobachtung gespeichert.',
      '- Für die 57 RPCs werden 149 erreichbare SQL-Funktionen einschließlich Helper und Trigger im gemeinsamen Katalog geführt. Marketplace-Trigger aus optionalen Skripten stehen separat beim Installationskandidaten.',
      '- **Keine Aussage über eine produktiv deployte Datenbank.** apply-migrations.sh hat eine andere explizite Reihenfolge, endet107 und lässt080_item_thumbnail_webp,082_dornhain_pregen_full_sheets sowie108 aus. Die vollständige Repository-Kette ist deshalb bewusst vom unbekannten tatsächlichen Deployment getrennt.',
      '- **Keine vollständige Verhaltens-/Produktfreigabe.** Die isolierten Negativtests reproduzieren Critical-/High-Legacy-Probleme. Die Architektur-Gates und der echte PostgREST-/JWT-/Browserpfad bleiben separat abzunehmen.','',
      '## Verbindliche Artefakte','',table(['Datei','Inhalt'],[
       ['[inventory.json](inventory.json)','Schema v2: Signaturen, Parameter/Defaults/RETURNS, Auth, explizite Fehler mit Zweigen, reale Relationen, direkte/transitive Writes, Constraint-/Policybindung, Caller, Tests und Legacy-Sperren.'],
       ['[effective-functions.json](effective-functions.json)','Vollständige wirksame SQL-Helper mit AST-Queries, Returns, Branches, Errors und Herkunft; Tabellen-Deklarationshistorie sowie Trigger/Policies.'],
       ['[callers.json](callers.json)','TypeScript-AST: exakte Requests, umschließende Caller und referenzierte Decoder-/Mapper-/Typ-Deklarationen mit Hashes.'],
       ['[postgres-proof.json](postgres-proof.json)','Isolierter Katalogvergleich inklusive finaler ACL, Spalten, Defaults und Constraints; keine Deploymentbehauptung.'],
       ['[transport-observations.json](transport-observations.json)','Zwei echte isolierte GoTrue-/PostgREST-Antworten: Foreign-Liste HTTP403/42501 und verborgene Atlas-Karte HTTP500/P0002.'],
       ['[legacy-observations.json](legacy-observations.json)','Echte isolierte Negativproben: rote Tests bedeuten reproduzierten Legacy-Defekt, keinen grünen Paritätsnachweis.'],
       ['[semantics.json](semantics.json)','RPC-spezifische fachliche Source-Review, Transaktions-/Idempotenzgrenzen, 15 Runtime-Kinds und konkrete Nachfolger-Tests.'],
       ['[split-groups.json](split-groups.json)','Exklusive maschinenlesbare Zuordnung aller57 RPCs zu18 realen Teilissues.'],
       ['[SPLIT_TICKETS.md](SPLIT_TICKETS.md)','Verlinkte Teilissues mit vollständigem Scope, Abhängigkeiten und spezifischer Abnahme.']]),
      '## Legacy-Defekte und Entscheidungsbedarf','', 'Sicherheitsfehler werden nicht als verpflichtende unsichere Parität fortgeschrieben. Nachfolger dürfen und müssen die explizit dokumentierten unerlaubten Zugriffe sperren.','',
      table(['Schwere','ID','Betroffene RPCs','Befund'],[[d['severity'],code(d['id']),', '.join(code(n) for n in d['rpcs']),d['summary']] for d in sorted(all_defects.values(),key=lambda d:({'Critical':0,'High':1,'Medium':2,'Low':3,'Info':4}.get(d['severity'],5),d['id']))]),
      '## Vollständiger Index','',table(['RPC','Wirksame/optionale Signaturen','Status','Teilissue'],[[ '['+r['rpc']+']('+r['rpc']+'.md)',len(r['overloads']),r['verification']['status'],issue(mapping[r['rpc']]['issueNumber'])] for r in inv['rpcs']]),
      '## Reproduzieren und Drift prüfen','', 'Die Werkzeuge dienen nur der Vertragsanalyse. Sie verändern keine Produktmigrationen oder Anwendungsdaten.','',
      '```sh\npython -m pip install -r .qa/intake/rpc-contracts/parser-requirements.txt\nnode scripts/stack-migration-rpc-callers.mjs --check\npython scripts/stack-migration-rpc-verify-postgres.py --check\npython scripts/stack-migration-rpc-extract.py --check\npython scripts/stack-migration-rpc-docs.py --check\n```','',
      'Ein frischer Datenbankvergleich importiert den vom separaten Baseline-Harness erzeugten pg-catalog.json und report.json über --catalog/--report. Ohne diese Argumente prüft das Werkzeug ausschließlich die gebundene isolierte Beobachtung gegen aktuelle Quellen. Ein Ergebnis wird dadurch nicht zu einem neuen Live-Test.','']
    outputs['README.md']='\n'.join(lines)
    lines=['# RPC-Teilaufgaben — exakte Partition aller57 RPCs','', '18 veröffentlichte Teilissues besitzen jedes RPC genau einmal. Koordinatoren813–816 werden nicht als zweite Implementierungszuordnung gezählt. Vorgeschlagene Serverpfade benennen den Review-Scope; sie genehmigen weder Architektur noch Bibliothekswahl.','',table(['Teilissue','Scope','Koordinator','RPC-Anzahl'],[[issue(g['issueNumber']),g['title'],issue(g['parentIssue']),len(g['rpcNames'])] for g in groups['groups']])]
    for g in groups['groups']:
        lines+=['## '+g['id']+' — '+issue(g['issueNumber']),'',g['title'],'', '**Koordinator:** '+issue(g['parentIssue'])+'.','', '**RPCs:**','',bullets(['['+n+']('+n+'.md)' for n in g['rpcNames']]), '**Abhängigkeiten:** '+', '.join(g['dependencies'])+'.','', '**Abnahme:**','', '\n'.join('- [ ] '+a for a in g['acceptanceCriteria']),'', '**Legacy-Sperren:** '+(', '.join(code(x) for x in g.get('legacyBlockers',[])) or 'Keine zusätzlich erfassten RPC-spezifischen Sperren')+'.','', '**Vorgeschlagene Zielmodule:**','',bullets([code(p) for p in g['targetPaths']]), '**Quellpfade einschließlich transitiver Definitionen/Decoder:**','',bullets([link(p) for p in g['sourcePaths']])]
    outputs['SPLIT_TICKETS.md']='\n'.join(lines).rstrip()+'\n'
    for file,text in outputs.items():
        path=BASE/file
        if args.check:
            if not path.exists() or path.read_text()!=text:raise SystemExit('Stale RPC documentation: '+file)
        else:path.write_text(text)
    print('Rendered '+str(len(inv['rpcs']))+' RPC contracts, README and 18 linked split tickets; all legacy blockers retained.')
if __name__=='__main__':main()
