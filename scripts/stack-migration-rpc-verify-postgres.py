#!/usr/bin/env python3
"""Compare parsed repository function contracts with an isolated PostgreSQL export.

--catalog/--report imports fresh synthetic baseline evidence. --check recomputes
all source fingerprints against the committed observation without starting a DB.
This is never an assertion about a deployed production/Supabase database.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('rpc_extract', ROOT / 'scripts/stack-migration-rpc-extract.py')
EX = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(EX)
OUTPUT = ROOT / '.qa/intake/rpc-contracts/postgres-proof.json'


def normalize_type(node):
    result = EX.sql(node)
    return result.removeprefix('public.') if result else None


def default_value(node):
    # pg_get_functiondef decorates DEFAULT NULL/literals with resolved type
    # casts. Input type is independently compared; strip only AST TypeCast.
    while isinstance(node, EX.ast.TypeCast):
        node = node.arg
    return EX.sql(node)


def fingerprint(node):
    opts = {o.defname: o.arg for o in node.options}
    params = [{
        'name': p.name,
        'type': normalize_type(p.argType),
        'mode': 'IN' if p.mode.name in {'FUNC_PARAM_DEFAULT', 'FUNC_PARAM_IN'} else p.mode.name,
        'default': default_value(p.defexpr),
    } for p in node.parameters or ()]
    names = [p['type'] for p in params if p['mode'] not in {'FUNC_PARAM_OUT', 'FUNC_PARAM_TABLE'}]
    return {
        'signature': EX.function_key(EX.qualified(node.funcname), names),
        'parameters': params,
        'returns': normalize_type(node.returnType),
        'returnsSet': bool(node.returnType and node.returnType.setof),
        'bodySha256': EX.digest(opts['as'][0].sval),
        'language': opts['language'].sval,
        'securityDefiner': bool(getattr(opts.get('security'), 'boolval', False)),
        'searchPath': EX.sql(opts.get('set')),
        'volatility': getattr(opts.get('volatility'), 'sval', 'volatile'),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--catalog', type=Path)
    parser.add_argument('--report', type=Path)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    catalog, _, _, _, _, files, _, _ = EX.compile_catalog()
    expected = {fingerprint(f['node'])['signature']: fingerprint(f['node']) for f in catalog.values()}
    if args.catalog:
        if not args.report:
            parser.error('--report is required with --catalog')
        observed = json.loads(args.catalog.read_text())
        report = json.loads(args.report.read_text())
        functions = []
        for f in observed['functions']:
            node = EX.parse_sql(f['definition'])[0].stmt
            data = {k: v for k, v in f.items() if k not in {'oid', 'definition'}}
            data['definitionSha256'] = EX.digest(f['definition'])
            data['fingerprint'] = fingerprint(node)
            functions.append(data)
        proof = {
            'schemaVersion': 1,
            'scope': 'isolated PostgreSQL with official Supabase platform bootstrap and unmodified full repository migration chain',
            'sourceBaseline': EX.BASELINE,
            'postgresVersion': report['postgres'],
            'observedAt': report['startedAt'],
            'catalogExportSha256': hashlib.sha256(args.catalog.read_bytes()).hexdigest(),
            'reportExportSha256': hashlib.sha256(args.report.read_bytes()).hexdigest(),
            'platformSources': report['platformSources'],
            'migrationSources': [{'path': p, 'sha256': h} for p, h in sorted(files.items()) if p.startswith('supabase/migrations/')],
            'liveDatabaseVerified': False,
            'deployedDatabaseVerified': False,
            'productRuntimeVerified': False,
            'functions': sorted(functions, key=lambda f: f['fingerprint']['signature']),
            'columns': observed.get('columns', []),
            'constraints': observed.get('constraints', []),
            'relations': observed.get('relations', []),
        }
    else:
        proof = json.loads(OUTPUT.read_text())
    actual = {f['fingerprint']['signature']: f['fingerprint'] for f in proof['functions']}
    differences = []
    for key in sorted(set(expected) | set(actual)):
        if expected.get(key) != actual.get(key):
            differences.append({'signature': key, 'expected': expected.get(key), 'actual': actual.get(key)})
    for source in proof['migrationSources']:
        if EX.digest((ROOT / source['path']).read_text()) != source['sha256']:
            differences.append({'migrationSourceDrift': source['path']})
    if differences:
        Path('/tmp/sagatree-rpc-postgres-differences.json').write_text(EX.dump(differences))
        raise SystemExit(f'{len(differences)} function/catalog differences; see /tmp/sagatree-rpc-postgres-differences.json')
    proof['comparison'] = {
        'status': 'passed',
        'functionCount': len(expected),
        'exactBodyMatches': len(expected),
        'signatureDefaultsResultAndSecurityMatches': len(expected),
        'normalizations': [
            'pg_get_functiondef omits public. qualification on composite types; compare resolved public type names.',
            'pg_get_functiondef adds input-type casts to DEFAULT constants; strip AST TypeCast after comparing input types.',
            'Omitted parameter mode and explicit IN have identical PostgreSQL input semantics.',
        ],
        'excludedOptionalRpc': 'increment_marketplace_downloads: present only in optional src/supabase scripts, absent from full migration chain.',
        'aclScope': 'Observed ACL includes platform default privileges; migration-only GRANT/REVOKE is not the full effective ACL.',
    }
    text = EX.dump(proof)
    if args.check:
        if OUTPUT.read_text() != text:
            raise SystemExit('PostgreSQL source comparison proof is stale')
    else:
        OUTPUT.write_text(text)
    print(f'PostgreSQL source comparison: {len(expected)} exact function body/signature/default/result/security matches; deployed/product proof: false')


if __name__ == '__main__':
    main()
