import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function importSpecifiers(file: string, text: string): Array<string> {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      found.push(ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : '[unresolved import]');
    }
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const specifier = node.moduleReference.expression;
      found.push(specifier && ts.isStringLiteral(specifier) ? specifier.text : '[unresolved require]');
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      const specifier = node.arguments[0];
      found.push(specifier && ts.isStringLiteral(specifier) ? specifier.text : '[unresolved dynamic import]');
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return found;
}

export function rejectAppImports(file: string, source: string): Array<string> {
  return importSpecifiers(file, source).filter((specifier) => specifier !== '../domain/contracts.js');
}

export function filesBelow(directory: string, exclude = new Set<string>()): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (exclude.has(entry.name)) return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(file, exclude) : [file];
  });
}

export function domainImportEvidence(repo: string, local: string) {
  const productFiles = filesBelow(path.join(repo, 'src/domains')).filter((file) => /\.tsx?$/.test(file));
  const files = [...productFiles, ...filesBelow(path.join(local, 'domain'))]
    .filter((file) => /\.tsx?$/.test(file));
  const forbidden = files.flatMap((file) => importSpecifiers(file, fs.readFileSync(file, 'utf8'))
    .filter((specifier) => /^(drizzle-orm(?:\/|$)|@zenstackhq\/|zenstack(?:\/|$))/.test(specifier))
    .map((specifier) => ({ file: path.relative(repo, file), specifier })));
  const productManifest = productFiles.sort().map((file) => ({ path: path.relative(repo, file), sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') }));
  const productDomainTreeSha256 = createHash('sha256').update(JSON.stringify(productManifest)).digest('hex');
  return { method: 'TypeScript AST imports, exports, require and dynamic imports', checkedFiles: files.length,
    productDomainFileCount: productFiles.length, productDomainTreeSha256, forbidden };
}
