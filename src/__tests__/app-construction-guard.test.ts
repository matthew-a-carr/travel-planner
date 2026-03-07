import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ALLOWED_BUILT_IN_CONSTRUCTORS = new Set([
  'Date',
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'URIError',
  'EvalError',
  'AggregateError',
  'URL',
  'URLSearchParams',
  'Map',
  'Set',
  'RegExp',
]);

type ImportIndex = {
  readonly localNamedImports: Set<string>;
  readonly localNamespaceImports: Set<string>;
};

function isProjectModuleSpecifier(specifier: string): boolean {
  return specifier.startsWith('@/') || specifier.startsWith('./') || specifier.startsWith('../');
}

function getAllRuntimeTsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...getAllRuntimeTsFiles(fullPath));
      continue;
    }

    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
    if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.int-test.ts')) continue;

    files.push(fullPath);
  }

  return files;
}

function collectLocalImports(sourceFile: ts.SourceFile): ImportIndex {
  const localNamedImports = new Set<string>();
  const localNamespaceImports = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;

    const specifier = statement.moduleSpecifier.getText(sourceFile).slice(1, -1);
    if (!isProjectModuleSpecifier(specifier)) continue;

    const clause = statement.importClause;
    if (!clause) continue;

    if (clause.name) localNamedImports.add(clause.name.text);

    const namedBindings = clause.namedBindings;
    if (!namedBindings) continue;

    if (ts.isNamespaceImport(namedBindings)) {
      localNamespaceImports.add(namedBindings.name.text);
      continue;
    }

    for (const element of namedBindings.elements) {
      localNamedImports.add(element.name.text);
    }
  }

  return {
    localNamedImports,
    localNamespaceImports,
  };
}

function collectLocalClassDeclarations(sourceFile: ts.SourceFile): Set<string> {
  const classNames = new Set<string>();

  function visit(node: ts.Node): void {
    if (ts.isClassDeclaration(node) && node.name) {
      classNames.add(node.name.text);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return classNames;
}

describe('App runtime construction guard', () => {
  it('does not construct project-owned classes with new in src/app', () => {
    const appDir = path.resolve('src/app');
    const appFiles = getAllRuntimeTsFiles(appDir);
    const violations: string[] = [];

    for (const filePath of appFiles) {
      const sourceText = fs.readFileSync(filePath, 'utf8');
      const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);

      const imports = collectLocalImports(sourceFile);
      const localClasses = collectLocalClassDeclarations(sourceFile);

      function visit(node: ts.Node): void {
        if (ts.isNewExpression(node)) {
          const expression = node.expression;

          if (ts.isIdentifier(expression)) {
            const ctorName = expression.text;
            if (!ALLOWED_BUILT_IN_CONSTRUCTORS.has(ctorName)) {
              if (imports.localNamedImports.has(ctorName) || localClasses.has(ctorName)) {
                const { line } = sourceFile.getLineAndCharacterOfPosition(expression.getStart());
                violations.push(`${filePath}:${line + 1} new ${ctorName}`);
              }
            }
          }

          if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
            const namespace = expression.expression.text;
            if (imports.localNamespaceImports.has(namespace)) {
              const { line } = sourceFile.getLineAndCharacterOfPosition(expression.getStart());
              violations.push(
                `${filePath}:${line + 1} new ${namespace}.${expression.name.getText(sourceFile)}`,
              );
            }
          }
        }

        ts.forEachChild(node, visit);
      }

      visit(sourceFile);
    }

    expect(violations).toEqual([]);
  });
});
