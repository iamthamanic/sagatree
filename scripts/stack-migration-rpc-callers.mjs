#!/usr/bin/env node
/** Extract RPC request/caller contracts with the project's TypeScript parser. */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const inventoryPath = join(root, '.qa/intake/rpc-contracts/inventory.json');
const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
const known = new Set(inventory.rpcs.map((row) => row.rpc));
const entries = [];
const dynamic = [];

function walkFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(full) : /\.(?:ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const sourceCache = new Map();
function sourceInfo(full) {
  if (sourceCache.has(full)) return sourceCache.get(full);
  const source = readFileSync(full, 'utf8');
  const tree = ts.createSourceFile(full, source, ts.ScriptTarget.Latest, true);
  const declarations = new Map();
  const imported = new Map();
  const info = { full, source, tree, declarations, imported };
  sourceCache.set(full, info);
  for (const node of tree.statements) {
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) && node.name) declarations.set(node.name.text, node);
    if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer && !ts.isObjectLiteralExpression(declaration.initializer)) declarations.set(declaration.name.text, declaration);
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const moduleName = node.moduleSpecifier.text;
      const base = moduleName.startsWith('.') ? resolve(dirname(full), moduleName) : moduleName.startsWith('@/') ? join(root, 'src', moduleName.slice(2)) : null;
      const target = base && [base, base + '.ts', base + '.tsx', join(base, 'index.ts'), join(base, 'index.tsx')].find((path) => existsSync(path) && /\.(?:ts|tsx)$/.test(path));
      if (target && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
        for (const item of node.importClause.namedBindings.elements) imported.set(item.name.text, { target, exported: item.propertyName?.text ?? item.name.text });
      }
    }
  }
  return info;
}
function supportingDeclarations(callable, initialInfo) {
  const result = [];
  const visited = new Set();
  function follow(node, info, depth) {
    if (depth > 6) return;
    const names = new Set();
    function identifiers(child) {
      if (ts.isIdentifier(child)) names.add(child.text);
      ts.forEachChild(child, identifiers);
    }
    identifiers(node);
    for (const name of [...names].sort()) {
      let targetInfo = info;
      let declaration = info.declarations.get(name);
      if (!declaration && info.imported.has(name)) {
        const binding = info.imported.get(name);
        targetInfo = sourceInfo(binding.target);
        declaration = targetInfo.declarations.get(binding.exported);
      }
      if (!declaration || declaration === callable) continue;
      const key = targetInfo.full + ':' + declaration.pos;
      if (visited.has(key)) continue;
      visited.add(key);
      result.push({
        name: declaration.name?.getText(targetInfo.tree) ?? name,
        kind: ts.SyntaxKind[declaration.kind],
        path: relative(root, targetInfo.full),
        line: targetInfo.tree.getLineAndCharacterOfPosition(declaration.getStart(targetInfo.tree)).line + 1,
        sourceSha256: createHash('sha256').update(targetInfo.source).digest('hex'),
        source: declaration.getText(targetInfo.tree),
      });
      follow(declaration, targetInfo, depth + 1);
    }
  }
  follow(callable, initialInfo, 0);
  return result.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
}

for (const full of walkFiles(join(root, 'src/infrastructure'))) {
  const source = readFileSync(full, 'utf8');
  const path = relative(root, full);
  const info = sourceInfo(full);
  const tree = info.tree;
  const imports = tree.statements.filter(ts.isImportDeclaration).map((node) => node.getText(tree));
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'rpc') {
      const argument = node.arguments[0];
      let callable = node.parent;
      while (callable && !ts.isFunctionLike(callable)) callable = callable.parent;
      let names = [];
      let resolution = 'string-literal';
      if (argument && ts.isStringLiteralLike(argument)) {
        names = [argument.text];
      } else if (argument && ts.isIdentifier(argument)) {
        const parameter = callable?.parameters.find((item) => ts.isIdentifier(item.name) && item.name.text === argument.text);
        if (parameter?.type && ts.isUnionTypeNode(parameter.type) && parameter.type.types.every((type) => ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal))) {
          names = parameter.type.types.map((type) => type.literal.text);
          resolution = 'literal-union-parameter';
        }
      }
      if (!names.length) {
        dynamic.push({ path, call: node.getText(tree) });
      } else {
        const parameters = node.arguments[1];
        const start = tree.getLineAndCharacterOfPosition(node.getStart(tree));
        for (const rpc of names) entries.push({
          rpc,
          resolution,
          path,
          line: start.line + 1,
          sourceSha256: createHash('sha256').update(source).digest('hex'),
          requestExpression: parameters?.getText(tree) ?? null,
          requestKeys: parameters && ts.isObjectLiteralExpression(parameters)
            ? parameters.properties.map((property) => property.name?.getText(tree) ?? 'spread')
            : [],
          callExpression: node.getText(tree),
          enclosingCallable: callable?.name?.getText(tree) ?? null,
          callerContract: callable?.getText(tree) ?? node.getText(tree),
          imports,
          supportingDeclarations: supportingDeclarations(callable ?? node, info),
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
}

const observed = new Set(entries.map((entry) => entry.rpc));
const missing = [...known].filter((name) => !observed.has(name));
const unlisted = [...observed].filter((name) => !known.has(name));
if (missing.length || unlisted.length || dynamic.length) {
  throw new Error(JSON.stringify({ missing, unlisted, dynamic }));
}
const output = JSON.stringify({
  parser: `typescript@${ts.version}`,
  baselineSha: inventory.generatedFromBaseline,
  rpcCount: observed.size,
  callCount: entries.length,
  callCountDefinition: 'Resolved RPC-name variants; a typed union call contributes one entry per allowed literal.',
  physicalCallSiteCount: new Set(entries.map((entry) => entry.path + ':' + entry.line)).size,
  note: 'Exact AST source excerpts include request mapping, response decoding, error conversion and fallback paths. Referenced local/imported decoder, mapper and type declarations are included with source hashes. This is source verification, not runtime parity proof.',
  calls: entries.sort((a, b) => a.rpc.localeCompare(b.rpc) || a.path.localeCompare(b.path) || a.line - b.line),
}, null, 2) + '\n';
const path = join(root, '.qa/intake/rpc-contracts/callers.json');
if (process.argv.includes('--check')) {
  if (readFileSync(path, 'utf8') !== output) throw new Error('RPC caller contracts are stale');
} else {
  writeFileSync(path, output);
}
console.log(`RPC callers: ${observed.size} names, ${entries.length} resolved TypeScript call variants, 0 dynamic/unmapped names`);
