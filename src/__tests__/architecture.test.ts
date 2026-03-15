import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function getImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const importRegex = /from\s+['"]([^'"]+)['"]/g;
  const imports: string[] = [];
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

function getAllTsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      if (!entry.name.endsWith('.test.ts') && !entry.name.endsWith('.int-test.ts')) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

describe('Architecture layer boundaries', () => {
  it('domain layer must not import from application, infrastructure, or ui', () => {
    const domainFiles = getAllTsFiles(path.resolve('src/domain'));
    for (const file of domainFiles) {
      const imports = getImports(file);
      for (const imp of imports) {
        expect(imp).not.toMatch(/application|infrastructure|ui|next|drizzle|@vercel/);
      }
    }
  });

  it('application layer must not import from infrastructure or ui', () => {
    const appFiles = getAllTsFiles(path.resolve('src/application'));
    for (const file of appFiles) {
      const imports = getImports(file);
      for (const imp of imports) {
        expect(imp).not.toMatch(/infrastructure|ui|next|drizzle|@vercel/);
      }
    }
  });

  it('infrastructure layer must not import from ui', () => {
    const infraFiles = getAllTsFiles(path.resolve('src/infrastructure'));
    for (const file of infraFiles) {
      const imports = getImports(file);
      for (const imp of imports) {
        expect(imp).not.toMatch(/\/ui\//);
      }
    }
  });

  it('every use case must have a co-located integration test', () => {
    const useCaseDir = path.resolve('src/application/use-cases');
    if (!fs.existsSync(useCaseDir)) return;

    const useCaseFiles = fs.readdirSync(useCaseDir).filter(
      (f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('.int-test.ts'),
    );
    const missing: string[] = [];

    for (const file of useCaseFiles) {
      const intTestName = file.replace(/\.ts$/, '.int-test.ts');
      if (!fs.existsSync(path.join(useCaseDir, intTestName))) {
        missing.push(file);
      }
    }

    expect(missing).toEqual([]);
  });
});
