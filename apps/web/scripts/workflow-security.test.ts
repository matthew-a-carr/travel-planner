import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

type Job = {
  permissions?: Record<string, string>;
  uses?: string;
  steps?: { uses?: string; run?: string }[];
};
type Workflow = {
  permissions?: Record<string, string>;
  jobs: Record<string, Job>;
};

const directory = resolve(import.meta.dirname, '../../../.github/workflows');
const files = readdirSync(directory).filter((file) => /\.ya?ml$/.test(file));

describe('GitHub Actions security boundaries (ADR 071)', () => {
  it('finds workflows to validate', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  describe.each(files)('%s', (file) => {
    const workflow = parse(readFileSync(resolve(directory, file), 'utf8')) as Workflow;

    it('pins external actions and reusable workflows to full commit SHAs', () => {
      for (const job of Object.values(workflow.jobs)) {
        for (const item of [job, ...(job.steps ?? [])]) {
          if (item.uses && !item.uses.startsWith('./')) {
            expect(item.uses).toMatch(/^[^@]+@[a-f0-9]{40}$/);
          }
        }
      }
    });

    it('declares token permissions and confines write access to releases', () => {
      expect(workflow.permissions).toBeTypeOf('object');
      for (const job of Object.values(workflow.jobs)) {
        const permissions = job.permissions ?? workflow.permissions;
        expect(permissions).toBeTypeOf('object');
        for (const [scope, access] of Object.entries(permissions ?? {})) {
          if (file === 'release-please.yml' && ['contents', 'pull-requests'].includes(scope)) {
            expect(['read', 'write']).toContain(access);
          } else {
            expect(access).toBe('read');
          }
        }
      }
    });

    it('passes user-controlled event and dispatch input through environment variables', () => {
      for (const job of Object.values(workflow.jobs)) {
        for (const step of job.steps ?? []) {
          expect(step.run ?? '').not.toMatch(/\$\{\{[^}]*\b(?:inputs\.|github\.event\.)/);
        }
      }
    });
  });
});
