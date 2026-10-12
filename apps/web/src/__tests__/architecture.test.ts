import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

type Dependency = { specifier: string; typeOnly: boolean };

function getImports(source: string): Dependency[] {
  const file = ts.createSourceFile(
    'source.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const imports: Dependency[] = [];
  function add(node: ts.Node | undefined, typeOnly = false) {
    if (node && ts.isStringLiteralLike(node)) imports.push({ specifier: node.text, typeOnly });
  }
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const typeOnly =
        !!clause?.isTypeOnly ||
        (!clause?.name &&
          !!bindings &&
          ts.isNamedImports(bindings) &&
          bindings.elements.length > 0 &&
          bindings.elements.every((element) => element.isTypeOnly));
      add(node.moduleSpecifier, typeOnly);
    } else if (ts.isExportDeclaration(node)) {
      add(node.moduleSpecifier, node.isTypeOnly);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      add(node.moduleReference.expression, node.isTypeOnly);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      add(node.argument.literal, true);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      add(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return imports;
}

const sourceRoot = path.resolve('src');
const sharedRoot = path.resolve('../../packages/shared/src');
type Layer = 'domain' | 'application' | 'infrastructure' | 'shared';

function within(target: string, root: string): boolean {
  return target === root || target.startsWith(`${root}${path.sep}`);
}

function allowed(file: string, layer: Layer, dependency: Dependency): boolean {
  const { specifier, typeOnly } = dependency;
  const target = specifier.startsWith('.')
    ? path.resolve(path.dirname(file), specifier)
    : specifier.startsWith('@/')
      ? path.resolve(sourceRoot, specifier.slice(2))
      : null;

  if (layer === 'shared') {
    return target !== null ? within(target, sharedRoot) : specifier === 'zod';
  }
  if (target === null) {
    // Shared wire types are the recorded exception (SPEC-005/010/024).
    return (
      layer === 'infrastructure' ||
      (layer === 'application' && specifier === '@travel-planner/shared' && typeOnly)
    );
  }
  const layers =
    layer === 'domain'
      ? ['domain']
      : layer === 'application'
        ? ['domain', 'application']
        : ['domain', 'application', 'infrastructure'];
  return layers.some((permitted) => within(target, path.join(sourceRoot, permitted)));
}

function runtimeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : runtimeFiles(file);
    return /\.[cm]?tsx?$/.test(entry.name) && !/\.(test|int-test|spec)\.[cm]?tsx?$/.test(entry.name)
      ? [file]
      : [];
  });
}

describe('Architecture layer boundaries', () => {
  it.each([
    'domain',
    'application',
    'infrastructure',
    'shared',
  ] as const)('%s imports stay within the permitted layers', (layer) => {
    const root = layer === 'shared' ? sharedRoot : path.join(sourceRoot, layer);
    const files = runtimeFiles(root);
    expect(files.length).toBeGreaterThan(0);
    const violations = files.flatMap((file) =>
      getImports(fs.readFileSync(file, 'utf8'))
        .filter((dependency) => !allowed(file, layer, dependency))
        .map(({ specifier }) => `${path.relative(process.cwd(), file)} imports ${specifier}`),
    );
    expect(violations).toEqual([]);
  });
});

describe('Architecture guard regression cases', () => {
  it.each([
    "import 'react';",
    "import { x } from 'react';",
    "export { x } from 'react';",
    "export * from 'react';",
    "const x = import('react');",
    "const x = require('react');",
    "import x = require('react');",
    "type X = import('react').X;",
  ])('detects forbidden external dependencies: %s', (source) => {
    const imports = getImports(source);
    expect(imports).toHaveLength(1);
    expect(allowed(path.join(sourceRoot, 'domain/model.ts'), 'domain', imports[0])).toBe(false);
  });

  it('ignores comments and string contents', () => {
    expect(getImports(`// import 'react';\nconst text = "import('react')";`)).toEqual([]);
  });

  it.each([
    ['domain', '@/application/use-cases/example'],
    ['application', '@/app/api/v1/route'],
    ['infrastructure', '@/app/api/v1/route'],
    ['infrastructure', '../ui/component'],
    ['domain', '../application/example'],
    ['domain', './../../../packages/shared/src'],
  ] as const)('rejects %s importing %s', (layer, specifier) => {
    expect(
      allowed(path.join(sourceRoot, layer, 'model.ts'), layer, { specifier, typeOnly: true }),
    ).toBe(false);
  });

  it('allows only type imports from the shared wire package in application code', () => {
    const file = path.join(sourceRoot, 'application/model.ts');
    for (const source of [
      "import type { TripSummary } from '@travel-planner/shared';",
      "import { type TripSummary } from '@travel-planner/shared';",
    ]) {
      expect(allowed(file, 'application', getImports(source)[0])).toBe(true);
    }
    expect(
      allowed(
        file,
        'application',
        getImports("import { tripSummarySchema } from '@travel-planner/shared';")[0],
      ),
    ).toBe(false);
  });

  it('rejects shared-package relative imports outside its boundary', () => {
    expect(
      allowed(path.join(sharedRoot, 'index.ts'), 'shared', {
        specifier: '../../../apps/web/src/domain/trip/types',
        typeOnly: true,
      }),
    ).toBe(false);
  });
});
