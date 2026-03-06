import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'drizzle');

const NON_TRANSACTIONAL_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\bcreate\s+index\s+concurrently\b/i,
    reason: 'CREATE INDEX CONCURRENTLY cannot run inside a transaction block.',
  },
  {
    pattern: /\bdrop\s+index\s+concurrently\b/i,
    reason: 'DROP INDEX CONCURRENTLY cannot run inside a transaction block.',
  },
  {
    pattern: /\breindex\s+(?:index|table|schema|database|system)?\b/i,
    reason: 'REINDEX statements are blocked for deploy-time transactional safety.',
  },
  {
    pattern: /\bvacuum\b/i,
    reason: 'VACUUM cannot run inside a transaction block.',
  },
  {
    pattern: /\bcreate\s+database\b/i,
    reason: 'CREATE DATABASE cannot run inside a transaction block.',
  },
  {
    pattern: /\bdrop\s+database\b/i,
    reason: 'DROP DATABASE cannot run inside a transaction block.',
  },
];

type MigrationIssue = {
  file: string;
  reason: string;
  statementSnippet: string;
};

function collectMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

function createSnippet(statement: string): string {
  const normalized = statement.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 120) return normalized;
  return `${normalized.slice(0, 117)}...`;
}

function checkMigrations(): MigrationIssue[] {
  const files = collectMigrationFiles();
  const issues: MigrationIssue[] = [];

  for (const file of files) {
    const fullPath = join(MIGRATIONS_DIR, file);
    const content = readFileSync(fullPath, 'utf8');
    const statements = content
      .split('--> statement-breakpoint')
      .map((part) => part.trim())
      .filter(Boolean);

    for (const statement of statements) {
      for (const rule of NON_TRANSACTIONAL_PATTERNS) {
        if (!rule.pattern.test(statement)) continue;
        issues.push({
          file,
          reason: rule.reason,
          statementSnippet: createSnippet(statement),
        });
      }
    }
  }

  return issues;
}

function main() {
  const issues = checkMigrations();

  if (issues.length === 0) {
    console.log('Migration transactional safety check passed.');
    return;
  }

  console.error('Migration transactional safety check failed.');
  for (const issue of issues) {
    console.error(`- ${issue.file}: ${issue.reason}`);
    console.error(`  Statement: ${issue.statementSnippet}`);
  }

  process.exit(1);
}

main();
