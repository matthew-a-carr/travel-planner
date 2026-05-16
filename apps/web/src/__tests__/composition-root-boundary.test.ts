import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const NEW_DRIZZLE_REPO_REGEX = /new\s+Drizzle[A-Za-z0-9_]*Repository\s*\(/;
const NEW_INVITE_PROVIDER_REGEX = /new\s+(LoggingEmailService|ResendEmailService)\s*\(/;

const ALLOWED_REPOSITORY_CONSTRUCTION_FILES = new Set([
  path.resolve('src/infrastructure/container/create-app-container.ts'),
]);
const ALLOWED_EMAIL_PROVIDER_CONSTRUCTION_FILES = new Set([
  path.resolve('src/infrastructure/email/create-invite-email-service.ts'),
]);

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

describe('Composition root boundary guard', () => {
  it('only constructs Drizzle repositories in the composition root', () => {
    const sourceFiles = getAllRuntimeTsFiles(path.resolve('src'));
    const violations: string[] = [];

    for (const filePath of sourceFiles) {
      const normalizedPath = path.resolve(filePath);
      if (
        ALLOWED_REPOSITORY_CONSTRUCTION_FILES.has(normalizedPath) ||
        ALLOWED_EMAIL_PROVIDER_CONSTRUCTION_FILES.has(normalizedPath)
      ) {
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      if (NEW_DRIZZLE_REPO_REGEX.test(content) || NEW_INVITE_PROVIDER_REGEX.test(content)) {
        violations.push(filePath);
      }
    }

    expect(violations).toEqual([]);
  });
});
