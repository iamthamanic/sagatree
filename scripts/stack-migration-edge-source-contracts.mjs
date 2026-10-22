/** Exact TypeScript AST evidence for the migration Edge/infra contracts. No runtime code is executed. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const contractDir = '.qa/intake/edge-infra-contracts';
const outDir = join(root, contractDir, 'source-contracts');
const sha = (text) => createHash('sha256').update(text).digest('hex');
const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory()
  ? files(join(dir, e.name)) : /\.[cm]?tsx?$/.test(e.name) ? [join(dir, e.name)] : []);
const cache = new Map();

function source(path) {
  if (cache.has(path)) return cache.get(path);
  const text = readFileSync(join(root, path), 'utf8');
  const ast = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if (ast.parseDiagnostics.length) throw new Error(`Cannot parse ${path}`);
  const record = { path, text, ast, sha256: sha(text) };
  cache.set(path, record);
  return record;
}

function visit(node, fn) { fn(node); ts.forEachChild(node, (child) => visit(child, fn)); }
function location(node, s) {
  return { path: s.path, line: s.ast.getLineAndCharacterOfPosition(node.getStart(s.ast)).line + 1,
    endLine: s.ast.getLineAndCharacterOfPosition(node.getEnd()).line + 1 };
}

function importedPath(specifier, s) {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(root, dirname(s.path), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
  const found = candidates.find((p) => existsSync(p) && /\.tsx?$/.test(p));
  return found ? relative(root, found) : null;
}

function closure(paths) {
  const seen = new Set();
  function add(path) {
    if (seen.has(path)) return;
    seen.add(path);
    const s = source(path);
    visit(s.ast, (node) => {
      let specifier;
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) specifier = node.moduleSpecifier.text;
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) specifier = node.arguments[0].text;
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) specifier = node.argument.literal.text;
      if (specifier) { const imported = importedPath(specifier, s); if (imported) add(imported); }
    });
  }
  paths.forEach(add);
  return [...seen].sort();
}

function declarations(s) {
  return s.ast.statements.flatMap((node) => {
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node) || ts.isFunctionDeclaration(node)) {
      return [{ kind: ts.SyntaxKind[node.kind], name: node.name?.text ?? 'anonymous',
        ...location(node, s), text: node.getText(s.ast) }];
    }
    if (ts.isVariableStatement(node)) return node.declarationList.declarations.map((d) => ({
      kind: 'VariableDeclaration', name: d.name.getText(s.ast), ...location(d, s), text: d.getText(s.ast),
    }));
    return [];
  });
}

function literals(node, s, seen = new Set()) {
  if (!node) return [];
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isLiteralTypeNode(node)) return literals(node.literal, s, seen);
  if (ts.isUnionTypeNode(node)) return [...new Set(node.types.flatMap((n) => literals(n, s, new Set(seen))))];
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) return literals(node.expression, s, seen);
  if (ts.isPropertyAccessExpression(node) && node.expression.kind === ts.SyntaxKind.ThisKeyword) {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (!ts.isClassDeclaration(parent)) continue;
      const member = parent.members.find((m) => ts.isPropertyDeclaration(m) && m.name.getText(s.ast) === node.name.text);
      return member ? literals(member.initializer, s, seen) : [];
    }
  }
  if (!ts.isIdentifier(node) || seen.has(`${s.path}:${node.text}`)) return [];
  seen.add(`${s.path}:${node.text}`);
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (!ts.isFunctionLike(parent)) continue;
    const parameter = parent.parameters.find((p) => ts.isIdentifier(p.name) && p.name.text === node.text);
    if (parameter) return literals(parameter.type, s, seen);
  }
  for (const statement of s.ast.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const d of statement.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.name.text === node.text) return literals(d.initializer, s, seen);
      }
    }
    if (ts.isImportDeclaration(statement) && statement.importClause?.namedBindings &&
        ts.isNamedImports(statement.importClause.namedBindings) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const binding = statement.importClause.namedBindings.elements.find((e) => e.name.text === node.text);
      const path = importedPath(statement.moduleSpecifier.text, s);
      if (binding && path) return literals(ts.factory.createIdentifier(binding.propertyName?.text ?? binding.name.text), source(path), seen);
    }
  }
  return [];
}
function literal(node, s) {
  const values = literals(node, s);
  return values.length === 1 ? values[0] : null;
}

function expressions(node, s) {
  const reads = new Set(); const returns = []; const calls = [];
  visit(node, (n) => {
    if (ts.isPropertyAccessExpression(n) && /^(body|payload|source|value|entry|context)\b/.test(n.getText(s.ast))) reads.add(n.getText(s.ast));
    if (ts.isReturnStatement(n) && n.expression) returns.push({ ...location(n, s), expression: n.expression.getText(s.ast) });
    if (ts.isCallExpression(n)) calls.push({ ...location(n, s), expression: n.expression.getText(s.ast),
      arguments: n.arguments.map((a) => a.getText(s.ast)) });
  });
  return { requestReads: [...reads].sort(), returns, calls };
}

function edgeEvidence(name) {
  const path = `supabase/functions/${name}/index.ts`;
  const s = source(path); const paths = closure([path]);
  const operations = []; const responseSites = []; const environment = new Set();
  const timeoutSites = []; const effectSites = [];
  visit(s.ast, (node) => {
    if (ts.isIfStatement(node)) {
      const condition = node.expression.getText(s.ast);
      if (/\b(req|request)\.method\s*===/.test(condition) ||
          /^(action|body\.action|payload\.action)\s*===/.test(condition)) {
        operations.push({ id: `${name}:${operations.length + 1}`, condition, ...location(node, s),
          ...expressions(node.thenStatement, s), exactBranch: node.thenStatement.getText(s.ast) });
      }
    }
    if (ts.isCallExpression(node) && /^(jsonResponse|json|sharedJsonResponse)$/.test(node.expression.getText(s.ast))) {
      responseSites.push({ ...location(node, s), expression: node.getText(s.ast) });
    }
    if (ts.isNewExpression(node) && node.expression.getText(s.ast) === 'Response') {
      responseSites.push({ ...location(node, s), expression: node.getText(s.ast) });
    }
  });
  for (const dep of paths) {
    const module = source(dep);
    visit(module.ast, (node) => {
      if (ts.isStringLiteral(node) && /^[A-Z][A-Z0-9_]*_ALLOWED_ORIGIN$/.test(node.text)) environment.add(node.text);
      if (ts.isPropertyAssignment(node) && node.name.getText(module.ast) === 'envKeys' && ts.isArrayLiteralExpression(node.initializer)) {
        for (const key of node.initializer.elements) { const value = literal(key, module); if (value) environment.add(value); }
      }
      if (!ts.isCallExpression(node)) return;
      const expression = node.expression.getText(module.ast);
      if (expression === 'AbortSignal.timeout') timeoutSites.push({ ...location(node, module), expression: node.getText(module.ast) });
      if (/^(fetch|fetchImpl|serviceFetch)$/.test(expression) || /\.(set|delete|rpc|createTask|getTask|upload|remove)$/.test(expression)) {
        effectSites.push({ ...location(node, module), expression: node.getText(module.ast) });
      }
      if (['Deno.env.get', 'env.get', 'readEnv'].includes(expression)) {
        const value = literal(node.arguments[0], module); if (value) environment.add(value);
      }
    });
  }
  const handlerNodes = s.ast.statements.filter((n) => ts.isExpressionStatement(n) && ts.isCallExpression(n.expression)
    && n.expression.expression.getText(s.ast) === 'serve');
  const handler = handlerNodes.map((n) => ({ ...location(n, s), text: n.getText(s.ast), ...expressions(n, s) }));
  if (!operations.length && handlerNodes.length) {
    const node = handlerNodes[0];
    operations.push({ id: `${name}:handler`, condition: 'Complete handler with ordered method/auth/body guards',
      ...location(node, s), ...expressions(node, s), exactBranch: node.getText(s.ast) });
  }
  return { schemaVersion: 1, function: name, evidenceKind: 'exact-typescript-ast-source',
    sourceFiles: paths.map((p) => ({ path: p, sha256: source(p).sha256 })),
    operations, responseSites, environment: [...environment].sort(), timeoutSites, effectSites,
    handler, declarations: paths.flatMap((p) => declarations(source(p))) };
}

function infraEvidence(area) {
  const paths = files(join(root, 'src/infrastructure', area)).map((p) => relative(root, p)).sort();
  const supportPaths = closure(paths).filter((p) => !paths.includes(p));
  const calls = []; const publicDeclarations = []; const imports = []; const operationDeclarations = [];
  for (const path of paths) {
    const s = source(path);
    for (const statement of s.ast.statements) {
      if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
        imports.push({ ...location(statement, s), module: statement.moduleSpecifier.text,
          resolvedPath: importedPath(statement.moduleSpecifier.text, s), expression: statement.getText(s.ast) });
      }
      if (statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        publicDeclarations.push({ ...location(statement, s), text: statement.getText(s.ast) });
      }
    }
    visit(s.ast, (node) => {
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        imports.push({ ...location(node, s), module: node.arguments[0].text, resolvedPath: importedPath(node.arguments[0].text, s),
          expression: node.getText(s.ast), kind: 'dynamic-import' });
      }
      if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node)) {
        const isPrivate = node.modifiers?.some((m) => [ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ProtectedKeyword].includes(m.kind));
        if (!isPrivate) operationDeclarations.push({ ...location(node, s), name: node.name?.getText(s.ast)
          ?? (ts.isVariableDeclaration(node.parent) ? node.parent.name.getText(s.ast) : 'callback'), text: node.getText(s.ast) });
      }
      if (!ts.isCallExpression(node)) return;
      const expression = node.expression.getText(s.ast);
      let kind;
      if (ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        if (method === 'rpc') kind = 'rpc';
        if (method === 'invoke' && expression.includes('functions')) kind = 'edge';
        if (method === 'from' && !expression.startsWith('Array.')) kind = expression.includes('storage') ? 'storage' : 'table';
        if (method === 'channel') kind = 'channel';
        if (method === 'on' && ['postgres_changes', 'broadcast'].includes(literal(node.arguments[0], s))) kind = 'realtime-subscription';
        if (/\.auth\./.test(expression)) kind = 'auth';
        if (method === 'removeChannel') kind = 'realtime-cleanup';
        if (['subscribe', 'send'].includes(method) && /\bchannel\b/.test(expression)) kind = `realtime-${method}`;
        if (s.path.endsWith('/livekit-media-plane-adapter.ts') && ['connect', 'disconnect', 'on', 'off', 'publishData', 'setCameraEnabled', 'setMicrophoneEnabled'].includes(method)) kind = 'provider-sdk';
      }
      if (expression === 'fetch') kind = 'fetch';
      if (['getAuthenticatedUserId', 'getSupabaseAccessToken'].includes(expression)) kind = 'auth-helper';
      if (!kind) return;
      let chain = node;
      while (chain.parent && ((ts.isPropertyAccessExpression(chain.parent) && chain.parent.expression === chain)
        || (ts.isCallExpression(chain.parent) && chain.parent.expression === chain))) chain = chain.parent;
      let enclosing = node.parent;
      while (enclosing && !ts.isFunctionLike(enclosing)) enclosing = enclosing.parent;
      const resolved = literals(node.arguments[0], s);
      for (const name of resolved.length ? resolved : [null]) calls.push({ kind, name, ...location(node, s),
        resolution: resolved.length > 1 ? 'finite-literal-union' : name ? 'literal-or-constant' : 'dynamic-expression',
        expression: node.getText(s.ast), chain: chain.getText(s.ast), arguments: node.arguments.map((a) => a.getText(s.ast)),
        enclosingOperation: enclosing ? { ...location(enclosing, s), text: enclosing.getText(s.ast) } : null });
    });
  }
  return { schemaVersion: 1, area, evidenceKind: 'exact-typescript-ast-source',
    sourceFiles: paths.map((p) => ({ path: p, sha256: source(p).sha256 })),
    supportingSourceFiles: supportPaths.map((p) => ({ path: p, sha256: source(p).sha256 })),
    importedTypeDeclarations: supportPaths.flatMap((p) => declarations(source(p)).filter((d) => ['InterfaceDeclaration', 'TypeAliasDeclaration', 'EnumDeclaration'].includes(d.kind))),
    calls, imports, publicDeclarations, operationDeclarations };
}

const names = readdirSync(join(root, 'supabase/functions'), { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(root, 'supabase/functions', e.name, 'index.ts')))
  .map((e) => e.name).sort();
const areas = readdirSync(join(root, 'src/infrastructure'), { withFileTypes: true })
  .filter((e) => e.isDirectory()).map((e) => e.name).sort();
const outputs = [
  ...names.map((n) => [`edge-${n}.json`, edgeEvidence(n)]),
  ...areas.map((a) => [`infra-${a}.json`, infraEvidence(a)]),
];
let failures = 0;
for (const [name, data] of outputs) {
  const text = `${JSON.stringify(data, null, 2)}\n`;
  const path = join(outDir, name);
  if (process.argv.includes('--write')) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); }
  else if (!existsSync(path) || readFileSync(path, 'utf8') !== text) { console.error(`Stale or missing source contract: ${name}`); failures++; }
}
console.log(`Edge/infra exact source contracts: ${names.length} workers/dispatcher, ${areas.length} areas; ${failures} stale.`);
if (failures) process.exitCode = 1;
