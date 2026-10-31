#!/usr/bin/env python3
"""Reproduce the RPC source contract catalogue using PostgreSQL's parser.

This is a source analysis, not a deployed-database inventory. Install the pinned
parser from .qa/intake/rpc-contracts/parser-requirements.txt before running it.
SQL and PL/pgSQL are parsed by libpg_query through pglast. No SQL signature,
relation, error or return expression is inferred with a SQL-matching regexp.
The three dynamic migration transformations are modelled explicitly and retain
their original source references. Unsupported dynamic function DDL fails.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path
import sys
from collections import defaultdict

try:
    import pglast
    from pglast import ast, parse_sql, parser
    from pglast.stream import RawStream
except ImportError as exc:
    raise SystemExit(
        "Install the pinned parser: python -m pip install -r "
        ".qa/intake/rpc-contracts/parser-requirements.txt"
    ) from exc

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / ".qa/intake/rpc-contracts"
BASELINE = "3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248"


def dump(value):
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def digest(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def strings(nodes):
    return ".".join(n.sval for n in nodes)


def qualified(nodes):
    name = strings(nodes)
    return name if "." in name else "public." + name


def relation(node):
    return f"{node.schemaname or 'public'}.{node.relname}"


def sql(node):
    return RawStream()(node) if node is not None else None


def function_key(name, parameters):
    return name + "(" + ",".join(parameters) + ")"


def object_key(obj):
    return function_key(qualified(obj.objname), [sql(x) for x in obj.objargs or ()])


def source_ref(path, rawstmt, full):
    data = full.encode("utf-8")
    begin = rawstmt.stmt_location
    end = begin + rawstmt.stmt_len if rawstmt.stmt_len else len(data)
    return {
        "path": path,
        "startLine": data[:begin].count(b"\n") + 1,
        "endLine": data[:end].count(b"\n") + 1,
        "sha256": digest(full),
    }


def walk_json(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk_json(child)
    elif isinstance(value, (list, tuple)):
        for child in value:
            yield from walk_json(child)


def analyse_sql(query):
    """Return actual RangeVar/FuncCall nodes, excluding query-local CTE names."""
    tree = json.loads(parser.parse_sql_json(query))
    nodes = list(walk_json(tree))
    ctes = {x["CommonTableExpr"]["ctename"] for x in nodes if "CommonTableExpr" in x}
    relations, calls, writes, keys, temporary = set(), [], [], [], []
    for node in nodes:
        if "RangeVar" in node:
            r = node["RangeVar"]
            if not r.get("schemaname") and r["relname"] in ctes:
                continue
            relations.add(f"{r.get('schemaname', 'public')}.{r['relname']}")
        if "FuncCall" in node:
            f = node["FuncCall"]
            name = ".".join(x["String"]["sval"] for x in f["funcname"])
            calls.append({"name": name, "arguments": len(f.get("args", []))})
            if name in {"jsonb_build_object", "json_build_object"}:
                vals = []
                for arg in f.get("args", [])[::2]:
                    constant = arg.get("A_Const", {})
                    if "sval" in constant:
                        vals.append(constant["sval"]["sval"])
                if vals:
                    keys.append(vals)
        if "CreateStmt" in node:
            created = node["CreateStmt"]["relation"]
            if created.get("relpersistence") == "t":
                temporary.append(created["relname"])
        for kind, op in (("InsertStmt", "INSERT"), ("UpdateStmt", "UPDATE"), ("DeleteStmt", "DELETE")):
            if kind in node:
                statement = node[kind]
                r = statement["relation"]
                item = {"operation": op, "relation": f"{r.get('schemaname', 'public')}.{r['relname']}"}
                relations.add(item["relation"])
                if kind == "InsertStmt":
                    item["columns"] = [x["ResTarget"]["name"] for x in statement.get("cols", [])]
                    if statement.get("onConflictClause"):
                        item["onConflict"] = statement["onConflictClause"]["action"]
                        item["onConflictUpdateColumns"] = [x["ResTarget"]["name"] for x in statement["onConflictClause"].get("targetList", [])]
                elif kind == "UpdateStmt":
                    item["columns"] = [x["ResTarget"]["name"] for x in statement.get("targetList", [])]
                writes.append(item)
    return {"relations": sorted(relations), "calls": calls, "writes": writes, "jsonObjectKeys": keys, "temporaryRelations": temporary}


def expression_sql(expr):
    query = expr["query"]
    mode = expr.get("parseMode", 0)
    if mode == 0:
        return query
    if mode == 2:
        return "SELECT " + query
    if mode in {3, 4, 5}:
        # libpg_query identifies assignment parse modes. The SQL lexer locates
        # the assignment token, so quoted ':=' strings do not affect slicing.
        for token in parser.scan(query):
            if token.name in {"COLON_EQUALS", "ASCII_61"}:
                return "SELECT " + query[token.end + 1 :]
        raise ValueError(f"Assignment without an assignment token: {query}")
    raise ValueError(f"Unsupported PL/pgSQL expression mode {mode}: {query}")


def parse_body(fn):
    source_sql = sql(fn["node"])
    options = {o.defname: o.arg for o in fn["node"].options}
    language = options.get("language").sval
    body = options["as"][0].sval
    result = {
        "language": language,
        "relations": set(),
        "calls": set(),
        "writes": [],
        "errors": [],
        "returns": [],
        "branches": [],
        "jsonObjectKeys": [],
        "queries": [],
        "dynamicSql": [],
        "parseErrors": [],
        "parserNormalizations": [],
        "temporaryRelations": [],
    }
    if language == "sql":
        data = analyse_sql(body)
        result["relations"].update(data["relations"])
        result["calls"].update((x["name"], x["arguments"]) for x in data["calls"])
        result["writes"].extend(data["writes"])
        result["jsonObjectKeys"].extend(data["jsonObjectKeys"])
        result["temporaryRelations"].extend(data["temporaryRelations"])
        result["queries"].append({"line": 1, "query": body, "path": []})
        result["returns"].append({"line": 1, "expression": body, "path": []})
    elif language == "plpgsql":
        try:
            pl_tree = json.loads(parser.parse_plpgsql_json(source_sql))
        except parser.ParseError:
            # libpg_query has no pg_class catalogue and therefore treats a
            # custom %ROWTYPE as scalar. PostgreSQL itself resolves this type.
            # One seed helper assigns a composite field. Only its declaration
            # is normalized to RECORD for AST extraction; SQL expressions and
            # the retained effective function text remain byte-for-byte intact.
            declaration = "v_project public.projects%ROWTYPE;"
            if fn["name"] != "public.provision_dornhain_starter_for_user" or source_sql.count(declaration) != 1:
                raise
            parsed_source = source_sql.replace(declaration, "v_project RECORD;")
            pl_tree = json.loads(parser.parse_plpgsql_json(parsed_source))
            result["parserNormalizations"].append("Catalogue-free parser only: v_project public.projects%ROWTYPE → v_project RECORD; effective SQL is unchanged.")

        def visit(value, path=(), line=1):
            if isinstance(value, list):
                for child in value:
                    visit(child, path, line)
                return
            if not isinstance(value, dict):
                return
            if "PLpgSQL_stmt_if" in value:
                s = value["PLpgSQL_stmt_if"]
                cond = s["cond"]["PLpgSQL_expr"]["query"]
                line = s.get("lineno", line)
                result["branches"].append({"line": line, "condition": cond, "path": list(path)})
                visit(s["cond"], path, line)
                visit(s.get("then_body", []), path + (cond,), line)
                prior = [cond]
                for clause in s.get("elsif_list", []):
                    c = clause["PLpgSQL_if_elsif"]
                    text = c["cond"]["PLpgSQL_expr"]["query"]
                    prior_path = path + ("ELSE AFTER: " + " ; ".join(prior),)
                    result["branches"].append({"line": c.get("lineno", line), "condition": text, "path": list(prior_path)})
                    visit(c["cond"], prior_path, c.get("lineno", line))
                    visit(c.get("stmts", []), prior_path + (text,), c.get("lineno", line))
                    prior.append(text)
                visit(s.get("else_body", []), path + ("ELSE AFTER: " + " ; ".join(prior),), line)
                return
            if "PLpgSQL_expr" in value:
                expr = value["PLpgSQL_expr"]
                q = expr["query"]
                item = {"line": line, "query": q, "path": list(path)}
                result["queries"].append(item)
                try:
                    data = analyse_sql(expression_sql(expr))
                    result["relations"].update(data["relations"])
                    result["calls"].update((x["name"], x["arguments"]) for x in data["calls"])
                    result["jsonObjectKeys"].extend(data["jsonObjectKeys"])
                    result["temporaryRelations"].extend(data["temporaryRelations"])
                    result["writes"].extend({**x, **item} for x in data["writes"])
                except Exception as exc:
                    result["parseErrors"].append({**item, "error": str(exc)})
                return
            if "PLpgSQL_stmt_raise" in value:
                s = value["PLpgSQL_stmt_raise"]
                code = s.get("condname", "P0001")
                for opt in s.get("options", []):
                    option = opt["PLpgSQL_raise_option"]
                    if option.get("opt_type") == 0:
                        code = option["expr"]["PLpgSQL_expr"]["query"]
                # ELOG ERROR (21) is RAISE EXCEPTION. NOTICE/WARNING do not throw.
                if s.get("elog_level", 21) >= 21:
                    result["errors"].append({"line": s.get("lineno", line), "sqlstateExpression": code, "message": s.get("message", "rethrow"), "parameters": [x.get("PLpgSQL_expr", {}).get("query") for x in s.get("params", [])], "raiseOptions": s.get("options", []), "path": list(path)})
            for kind in ("PLpgSQL_stmt_return", "PLpgSQL_stmt_return_next", "PLpgSQL_stmt_return_query"):
                if kind in value:
                    s = value[kind]
                    result["returns"].append({"line": s.get("lineno", line), "statement": kind, "expression": s.get("expr", s.get("query", {})).get("PLpgSQL_expr", {}).get("query", "RETURN datum/void"), "path": list(path)})
            for kind in ("PLpgSQL_stmt_dynexecute", "PLpgSQL_stmt_dynfors"):
                if kind in value:
                    result["dynamicSql"].append({"statement": kind, "path": list(path), "ast": value[kind]})
            for child in value.values():
                next_line = child.get("lineno", line) if isinstance(child, dict) else line
                visit(child, path, next_line)

        visit(pl_tree)
    else:
        raise ValueError(f"Unsupported source language {language} for {fn['key']}")
    for temporary in set(result["temporaryRelations"]):
        result["relations"].discard("public." + temporary)
        result["relations"].add("pg_temp." + temporary)
        for write in result["writes"]:
            if write["relation"] == "public." + temporary:
                write["relation"] = "pg_temp." + temporary
    result["temporaryRelations"] = sorted(set(result["temporaryRelations"]))
    result["relations"] = sorted(result["relations"])
    result["calls"] = [{"name": n, "arguments": a} for n, a in sorted(result["calls"])]
    result["jsonObjectKeys"] = [list(x) for x in sorted(set(tuple(x) for x in result["jsonObjectKeys"]))]
    return result


def compile_catalog():
    catalog, history, tables, triggers, policies, files = {}, defaultdict(list), {}, {}, {}, {}
    dropped = []
    migrations = sorted((ROOT / "supabase/migrations").glob("*.sql"))

    def rename_helpers(ref, delete_twin):
        for key in list(catalog):
            fn = catalog.get(key)
            if not fn:
                continue
            name = fn["name"]
            if not (name.startswith("public.sagadrive_") or name == "public.generate_sagadrive_public_id"):
                continue
            new_name = name.replace("sagadrive", "sagatree")
            new_key = function_key(new_name, fn["inputTypes"])
            if new_key in catalog:
                if delete_twin:
                    del catalog[key]
                    dropped.append({"signature": key, "source": ref, "reason": "079 removes legacy twin"})
                continue
            del catalog[key]
            fn["name"], fn["key"] = new_name, new_key
            fn["node"].funcname = tuple(ast.String(sval=p) for p in new_name.split("."))
            fn["transformations"].append({"kind": "rename", "from": name, "to": new_name, "source": ref})
            catalog[new_key] = fn
            for trigger in triggers.values():
                if trigger["function"] == name:
                    trigger["function"] = new_name

    for full_path in migrations:
        path = str(full_path.relative_to(ROOT))
        full = full_path.read_text()
        files[path] = digest(full)
        for raw in parse_sql(full):
            node = raw.stmt
            ref = source_ref(path, raw, full)
            if isinstance(node, ast.CreateFunctionStmt):
                name = qualified(node.funcname)
                params = []
                for p in node.parameters or ():
                    params.append({"name": p.name, "type": sql(p.argType), "mode": p.mode.name, "default": sql(p.defexpr)})
                input_types = [p["type"] for p in params if p["mode"] not in {"FUNC_PARAM_OUT", "FUNC_PARAM_TABLE"}]
                key = function_key(name, input_types)
                previous = catalog.get(key)
                history[name].append(ref)
                catalog[key] = {"key": key, "name": name, "node": node, "parameters": params, "inputTypes": input_types, "source": ref, "transformations": [], "executeGrants": copy.deepcopy(previous["executeGrants"]) if previous else {"PUBLIC"}, "grantHistory": copy.deepcopy(previous["grantHistory"]) if previous else [], "origin": "migration-chain"}
            elif isinstance(node, ast.DropStmt) and node.removeType.name == "OBJECT_FUNCTION":
                for obj in node.objects:
                    key = object_key(obj)
                    catalog.pop(key, None)
                    dropped.append({"signature": key, "source": ref, "reason": "explicit DROP FUNCTION"})
            elif isinstance(node, ast.GrantStmt) and node.objtype.name == "OBJECT_FUNCTION":
                if node.targtype.name != "ACL_TARGET_OBJECT":
                    raise ValueError(f"Unsupported function grant scope at {path}")
                for obj in node.objects:
                    key = object_key(obj)
                    fn = catalog.get(key)
                    if not fn:
                        raise ValueError(f"GRANT/REVOKE references unknown source signature {key} at {path}")
                    for role in node.grantees:
                        role_name = role.rolename or ("PUBLIC" if role.roletype.name == "ROLESPEC_PUBLIC" else role.roletype.name)
                        if node.is_grant:
                            fn["executeGrants"].add(role_name)
                        else:
                            fn["executeGrants"].discard(role_name)
                    fn["grantHistory"].append({"source": ref, "statement": sql(node)})
            elif isinstance(node, ast.CreateStmt):
                name = relation(node.relation)
                table = tables.setdefault(name, {"name": name, "columns": {}, "sources": []})
                table["sources"].append(ref)
                for col in node.tableElts or ():
                    if isinstance(col, ast.ColumnDef):
                        table["columns"][col.colname] = {"name": col.colname, "type": sql(col.typeName), "definition": sql(col), "source": ref}
            elif isinstance(node, ast.AlterTableStmt):
                name = relation(node.relation)
                table = tables.setdefault(name, {"name": name, "columns": {}, "sources": []})
                table["sources"].append(ref)
                for cmd in node.cmds or ():
                    sub = cmd.subtype.name
                    if sub in {"AT_AddColumn", "AT_AddColumnToView"}:
                        col = cmd.def_
                        table["columns"][col.colname] = {"name": col.colname, "type": sql(col.typeName), "definition": sql(col), "source": ref}
                    elif sub == "AT_DropColumn":
                        table["columns"].pop(cmd.name, None)
                    elif sub == "AT_AlterColumnType" and cmd.name in table["columns"]:
                        table["columns"][cmd.name]["type"] = sql(cmd.def_.typeName)
            elif isinstance(node, ast.CreateTrigStmt):
                key = relation(node.relation) + "." + node.trigname
                triggers[key] = {"name": node.trigname, "relation": relation(node.relation), "function": qualified(node.funcname), "source": ref, "statement": sql(node), "events": node.events, "columns": [x.sval for x in node.columns or ()]}
            elif isinstance(node, ast.CreatePolicyStmt):
                key = relation(node.table) + "." + node.policy_name
                policies[key] = {"name": node.policy_name, "relation": relation(node.table), "source": ref, "statement": sql(node)}
            elif isinstance(node, ast.DropStmt) and node.removeType.name in {"OBJECT_TRIGGER", "OBJECT_POLICY"}:
                target = triggers if node.removeType.name == "OBJECT_TRIGGER" else policies
                for obj in node.objects:
                    target.pop(strings(obj), None)
            elif isinstance(node, ast.DoStmt):
                body = next(x.arg.sval for x in node.args if x.defname == "as")
                if path.endswith("073_sagatree_schema_rename_compat.sql"):
                    rename_helpers(ref, False)
                elif path.endswith("079_drop_sagadrive_aliases.sql"):
                    rename_helpers(ref, True)
                elif path.endswith("085_fix_function_bodies_sagatree.sql"):
                    for fn in catalog.values():
                        before = sql(fn["node"])
                        after = before.replace("sagadrive", "sagatree").replace("SagaDrive", "SagaTree")
                        if before != after:
                            fn["node"] = parse_sql(after)[0].stmt
                            fn["transformations"].append({"kind": "body-rewrite", "source": ref, "replacement": "sagadrive→sagatree; SagaDrive→SagaTree"})
                elif "pg_proc" in body or "CREATE OR REPLACE FUNCTION" in body or "ALTER FUNCTION" in body or "DROP FUNCTION" in body:
                    raise ValueError(f"Unsupported dynamic function DDL in {path}")

    # Optional marketplace SQL is intentionally not replayed into the migration
    # chain. Record each independent script's ACL and identical implementation.
    optional = []
    for path in ("src/supabase/add_marketplace_rpc.sql", "src/supabase/deploy_marketplace.sql"):
        full = (ROOT / path).read_text()
        files[path] = digest(full)
        candidate = None
        optional_schema = []
        optional_helpers = []
        for raw in parse_sql(full):
            node = raw.stmt
            ref = source_ref(path, raw, full)
            if isinstance(node, ast.CreateFunctionStmt) and node.funcname[-1].sval == "increment_marketplace_downloads":
                params = [{"name": p.name, "type": sql(p.argType), "mode": p.mode.name, "default": sql(p.defexpr)} for p in node.parameters or ()]
                name = "public.increment_marketplace_downloads"
                candidate = {"key": function_key(name, [p["type"] for p in params]), "name": name, "node": node, "parameters": params, "inputTypes": [p["type"] for p in params], "source": ref, "transformations": [], "executeGrants": {"PUBLIC"}, "grantHistory": [], "origin": "optional-script-outside-migrations"}
            elif isinstance(node, (ast.CreateStmt, ast.AlterTableStmt, ast.CreateTrigStmt, ast.CreatePolicyStmt)):
                optional_schema.append({"source": ref, "statement": sql(node)})
            elif isinstance(node, ast.CreateFunctionStmt) and node.funcname[-1].sval == "update_marketplace_updated_at":
                helper = {"name": qualified(node.funcname), "node": node}
                optional_helpers.append({"source": ref, "effectiveSql": sql(node), "semantics": parse_body(helper)})
            elif isinstance(node, ast.GrantStmt) and node.objtype.name == "OBJECT_FUNCTION" and candidate:
                for obj in node.objects:
                    if object_key(obj) == candidate["key"]:
                        candidate["grantHistory"].append({"source": ref, "statement": sql(node)})
                        for role in node.grantees:
                            candidate["executeGrants"].add(role.rolename or "PUBLIC")
        if candidate:
            candidate["supportingSchema"] = optional_schema
            candidate["supportingFunctions"] = optional_helpers
            optional.append(candidate)
    return catalog, history, tables, triggers, policies, files, dropped, optional


def main():
    argparser = argparse.ArgumentParser()
    argparser.add_argument("--check", action="store_true")
    args = argparser.parse_args()
    old = json.loads((OUT / "inventory.json").read_text())
    semantics_file = OUT / "semantics.json"
    semantics = json.loads(semantics_file.read_text()) if semantics_file.exists() else {}
    caller_data = json.loads((OUT / "callers.json").read_text())
    pg_proof = json.loads((OUT / "postgres-proof.json").read_text())
    pg_functions = {f["fingerprint"]["signature"]: f for f in pg_proof["functions"]}
    catalog, history, tables, triggers, policies, source_files, dropped, optional = compile_catalog()
    body_cache = {}
    for key, fn in catalog.items():
        body_cache[key] = parse_body(fn)
    for index, fn in enumerate(optional):
        body_cache[f"optional:{index}"] = parse_body(fn)

    def resolve_call(call):
        name = call["name"] if "." in call["name"] else "public." + call["name"]
        candidates = []
        for key, fn in catalog.items():
            if fn["name"] != name:
                continue
            inputs = [p for p in fn["parameters"] if p["mode"] not in {"FUNC_PARAM_OUT", "FUNC_PARAM_TABLE"}]
            required = len([p for p in inputs if p["default"] is None])
            if required <= call["arguments"] <= len(inputs):
                candidates.append(key)
        return candidates

    def closure(initial):
        visited, queue, edges = set(), list(initial), []
        while queue:
            key = queue.pop()
            if key in visited:
                continue
            visited.add(key)
            for call in body_cache[key]["calls"]:
                resolved = resolve_call(call)
                for target in resolved:
                    edges.append({"from": key, "to": target, "kind": "function-call"})
                    queue.append(target)
            for write in body_cache[key]["writes"]:
                event_mask = {"INSERT": 4, "DELETE": 8, "UPDATE": 16}[write["operation"]]
                if write.get("onConflict") == "ONCONFLICT_UPDATE":
                    event_mask |= 16
                for tr in triggers.values():
                    if tr["relation"] == write["relation"] and tr["events"] & event_mask:
                        if write["operation"] == "UPDATE" and tr["columns"] and not set(write.get("columns", [])).intersection(tr["columns"]):
                            continue
                        for target in resolve_call({"name": tr["function"], "arguments": 0}):
                            edges.append({"from": key, "to": target, "kind": "trigger", "trigger": tr["name"], "relation": tr["relation"]})
                            queue.append(target)
        return sorted(visited), edges

    outputs = {}
    inventory = {
        "schemaVersion": 2,
        "generatedFromBaseline": BASELINE,
        "rpcCount": len(old["rpcs"]),
        "missingSqlDefinitions": [],
        "note": "Source contracts parsed with PostgreSQL/libpg_query (pglast 7.21); migrations applied as source DDL in lexicographic filename order, with explicit 073/079 rename and 085 rewrite semantics. This is not a deployed pg_proc snapshot and does not assert live security parity.",
        "verification": {"method": "postgresql-ast-and-plpgsql-ast-with-source-review", "parser": pglast.__version__, "baselineSha": BASELINE, "liveDatabaseVerified": False, "deploymentOrder": "lexicographic full migration filename; duplicate numeric prefixes retain filename order", "implementationReady": False, "isolatedPostgresCatalogueVerified": True, "postgresProof": {"path": ".qa/intake/rpc-contracts/postgres-proof.json", "sha256": digest((OUT / "postgres-proof.json").read_text())}},
        "rpcs": [],
    }
    referenced_functions = set()
    all_parse_errors = []
    for old_row in old["rpcs"]:
        name = old_row["rpc"]
        fns = [fn for fn in catalog.values() if fn["name"] == "public." + name]
        initial = [fn["key"] for fn in fns]
        descendants, edges = closure(initial)
        if name == "increment_marketplace_downloads":
            fns = optional[:1]
        if not fns:
            raise ValueError(f"No source definition resolved for {name}")
        referenced_functions.update(descendants)
        row = {
            "rpc": name,
            "verification": {"status": "source-verified", "baselineSha": BASELINE, "liveDatabaseVerified": False, "implementationReady": False},
            "callSites": old_row["callSites"],
            "sqlDefinitions": history.get("public." + name, []) or [fn["source"] for fn in optional if name == "increment_marketplace_downloads"],
            "callerContracts": [c for c in caller_data["calls"] if c["rpc"] == name],
            "overloads": [],
            "directRelations": [],
            "transitiveRelations": sorted({r for key in descendants for r in body_cache[key]["relations"]}),
            "relationConstraints": [],
            "relationPolicies": [],
            "dependencyFunctions": descendants,
            "dependencyEdges": edges,
            "proposedSuccessor": old_row["proposedSuccessor"],
            "summary": semantics.get(name, {}).get("summary", ""),
            "authorization": semantics.get(name, {}).get("authorization", []),
            "behavior": semantics.get(name, {}).get("behavior", []),
            "requiredTests": semantics.get(name, {}).get("requiredTests", []),
            "legacyDefects": semantics.get(name, {}).get("legacyDefects", []),
            "operations": semantics.get(name, {}).get("operations", []),
            "transportObservations": semantics.get(name, {}).get("transportObservations", []),
            "transactionAndIdempotency": semantics.get(name, {}).get("transactionAndIdempotency", []),
            "removedOverloads": [x for x in dropped if x["signature"].startswith("public." + name + "(")],
            "sourceFiles": [],
        }
        for index, fn in enumerate(fns):
            detail = body_cache[f"optional:{index}"] if name == "increment_marketplace_downloads" else body_cache[fn["key"]]
            source_sql = sql(fn["node"]).rstrip() + ";\n"
            suffix = f"{index + 1}"
            effective_path = f".qa/intake/rpc-contracts/effective-sql/{name}-{suffix}.sql"
            outputs[effective_path] = "-- Derived source contract only; DO NOT deploy this catalogue.\n" + source_sql
            options = {o.defname: o.arg for o in fn["node"].options}
            return_type = sql(fn["node"].returnType)
            column_returns = [p for p in fn["parameters"] if p["mode"] == "FUNC_PARAM_TABLE"]
            body = {
                "signature": fn["key"],
                "parameters": fn["parameters"],
                "returns": return_type,
                "returnsSet": bool(fn["node"].returnType and fn["node"].returnType.setof),
                "tableReturnColumns": column_returns,
                "rowReturnColumns": [c for c in pg_proof["columns"] if "public." + c["relation"] == return_type],
                "rowReturnColumnEvidence": ".qa/intake/rpc-contracts/postgres-proof.json#columns" if return_type.startswith("public.") else None,
                "securityDefiner": bool(getattr(options.get("security"), "boolval", False)),
                "searchPath": sql(options.get("set")),
                "source": fn["source"],
                "transformations": fn["transformations"],
                "executeGrants": sorted(fn["executeGrants"]),
                "grantHistory": fn["grantHistory"],
                "origin": fn["origin"],
                "executeGrantsScope": "Migration/optional-script declarations starting from PostgreSQL PUBLIC default; platform default ACL is separate below.",
                "isolatedPostgresObservation": None if name == "increment_marketplace_downloads" else {k: v for k, v in pg_functions[fn["key"]].items() if k not in {"fingerprint"}},
                "effectiveSource": {"path": effective_path, "sha256": digest(outputs[effective_path])},
                "semantics": detail,
            }
            row["overloads"].append(body)
            row["directRelations"].extend(detail["relations"])
            all_parse_errors.extend({"rpc": name, **x} for x in detail["parseErrors"])
        row["directRelations"] = sorted(set(row["directRelations"]))
        row["transitiveRelations"] = sorted(set(row["transitiveRelations"]) | set(row["directRelations"]))
        row["verification"]["isolatedPostgresCatalogueVerified"] = name != "increment_marketplace_downloads"
        row["securityDefiner"] = all(x["securityDefiner"] for x in row["overloads"])
        all_sources = set(row["callSites"])
        for caller in row["callerContracts"]:
            all_sources.update(d["path"] for d in caller.get("supportingDeclarations", []))
        for relation_name in row["transitiveRelations"]:
            all_sources.update(r["path"] for r in tables.get(relation_name, {}).get("sources", []))
        row["relationConstraints"] = [c for c in pg_proof["constraints"] if "public." + c["relation"] in row["transitiveRelations"]]
        row["relationPolicies"] = [p for p in policies.values() if p["relation"] in row["transitiveRelations"]]
        all_sources.update(p["source"]["path"] for p in row["relationPolicies"])
        for edge in row["dependencyEdges"]:
            if edge["kind"] == "trigger":
                all_sources.update(t["source"]["path"] for t in triggers.values() if t["name"] == edge["trigger"] and t["relation"] == edge["relation"])
        for fn in (optional if name == "increment_marketplace_downloads" else fns) + [catalog[key] for key in descendants]:
            all_sources.add(fn["source"]["path"])
            all_sources.update(t["source"]["path"] for t in fn["transformations"])
            all_sources.update(t["source"]["path"] for t in fn["grantHistory"])
        row["sourceFiles"] = [{"path": p, "sha256": digest((ROOT / p).read_text())} for p in sorted(all_sources)]
        if name == "increment_marketplace_downloads":
            # Host successor accepted (#878 / PR #1054): SQLite marketplace_items is canonical.
            # Optional src/supabase SQL remains documented alternative install only (legacyDefects).
            row["verification"]["status"] = "source-verified"
            row["verification"]["sourceDefinitionVerified"] = True
            row["verification"]["implementationReady"] = True
            row["verification"]["blockers"] = []
            row["proposedSuccessor"] = {
                **row.get("proposedSuccessor", {}),
                "status": "ACCEPTED — host SQLite marketplace_items + MarketplaceCountStore (#878)",
                "hostMigration": "server/migrations/0029_marketplace_items.sql",
            }
            row["alternativeInstallations"] = [{"source": fn["source"], "grantHistory": fn["grantHistory"], "executeGrants": sorted(fn["executeGrants"]), "supportingSchema": fn["supportingSchema"], "supportingFunctions": fn["supportingFunctions"]} for fn in optional]
        reviewed = semantics.get(name, {}).get("reviewedSources")
        if reviewed is not None and reviewed != row["sourceFiles"]:
            raise ValueError(f"Source review must be renewed after dependency/caller drift: {name}")
        reviewed_sql = semantics.get(name, {}).get("reviewedEffectiveSql")
        if reviewed_sql is not None and reviewed_sql != [o["effectiveSource"] for o in row["overloads"]]:
            raise ValueError(f"Effective SQL changed after source review: {name}")
        row["verification"]["sourceFiles"] = row["sourceFiles"]
        row["verification"]["reviewEvidence"] = {"path": ".qa/intake/rpc-contracts/semantics.json", "baselineSha": semantics.get(name, {}).get("reviewedBaselineSha"), "effectiveSql": reviewed_sql}
        row["verification"]["legacyBlockers"] = [d["id"] for d in row["legacyDefects"]]
        if not row["summary"] or not row["requiredTests"]:
            row["verification"]["status"] = "source-extracted-review-required"
        inventory["rpcs"].append(row)

    # Shared helper semantics are kept once. These include called trigger bodies
    # and their exact source; this prevents transitive effects being guessed.
    helper_rows = []
    for key in sorted(referenced_functions):
        fn = catalog[key]
        helper_rows.append({"signature": key, "source": fn["source"], "transformations": fn["transformations"], "effectiveSql": sql(fn["node"]), "semantics": body_cache[key]})
        all_parse_errors.extend({"function": key, **x} for x in body_cache[key]["parseErrors"])
    if all_parse_errors:
        Path("/tmp/sagatree-rpc-parse-errors.json").write_text(dump(all_parse_errors))
        raise ValueError(f"{len(all_parse_errors)} SQL expression parse errors; see /tmp/sagatree-rpc-parse-errors.json")
    inventory["sourceCatalogue"] = {
        "path": ".qa/intake/rpc-contracts/effective-functions.json",
        "functionCount": len(helper_rows),
        "sourceFileCount": len(source_files),
        "sourceFiles": [{"path": p, "sha256": h} for p, h in sorted(source_files.items())],
    }
    outputs[inventory["sourceCatalogue"]["path"]] = dump({"baselineSha": BASELINE, "liveDatabaseVerified": False, "functions": helper_rows, "relationDeclarationScope": "Parsed CREATE/ALTER source declarations and history; effective runtime row columns/defaults/nullability/constraints are in postgres-proof.json. Historical column definition text is not asserted as the final constraint state.", "relations": tables, "triggers": list(triggers.values()), "policies": list(policies.values())})
    outputs[".qa/intake/rpc-contracts/inventory.json"] = dump(inventory)
    expected_sql = {str(ROOT / path) for path in outputs if path.startswith(".qa/intake/rpc-contracts/effective-sql/")}
    for stale in (OUT / "effective-sql").glob("*.sql"):
        if str(stale) not in expected_sql:
            if args.check:
                raise ValueError(f"Orphaned effective SQL snapshot: {stale}")
            stale.unlink()
    for path, content in outputs.items():
        destination = ROOT / path
        if args.check:
            if not destination.exists() or destination.read_text() != content:
                raise ValueError(f"Generated source contract is stale: {path}")
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(content)
    print(f"RPC source contracts: {len(inventory['rpcs'])}; effective migration functions including dependencies: {len(helper_rows)}; parser errors: 0; live database verified: false")


if __name__ == "__main__":
    main()
