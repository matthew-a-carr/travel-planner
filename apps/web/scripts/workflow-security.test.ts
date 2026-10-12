import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

type Job = {
  permissions?: Record<string, string>;
  uses?: string;
  steps?: { id?: string; uses?: string; run?: string }[];
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

describe('Preview inventory shell step', () => {
  const workflow = parse(readFileSync(resolve(directory, 'infra-preview.yml'), 'utf8')) as Workflow;
  const script = workflow.jobs.apply?.steps?.find((step) => step.id === 'open_previews')?.run;
  if (!script) throw new Error('Preview inventory step not found');

  function runInventory(pages: unknown, manual = '', apiStatus = 0) {
    const temp = mkdtempSync(resolve(tmpdir(), 'preview-inventory-'));
    const output = resolve(temp, 'output');
    try {
      const result = spawnSync('bash', ['-e'], {
        cwd: temp,
        input: `
          gh() {
            # Match the CLI's incompatible-option error before supplying API fixtures.
            if [[ " $* " == *" --slurp "* && " $* " == *" --jq "* ]]; then return 1; fi
            printf '%s\\n' "$TEST_PAGES"
            return "$TEST_API_STATUS"
          }
          ${script}
        `,
        env: {
          NODE_ENV: 'test',
          PATH: process.env.PATH,
          GITHUB_OUTPUT: output,
          REPOSITORY: 'example/repo',
          MANUAL_OPEN_PREVIEWS: manual,
          TEST_PAGES: JSON.stringify(pages),
          TEST_API_STATUS: String(apiStatus),
        },
        encoding: 'utf8',
        timeout: 5_000,
      });
      if (result.error) throw result.error;
      return {
        status: result.status,
        output: existsSync(output) ? readFileSync(output, 'utf8') : '',
        injected: existsSync(resolve(temp, 'injected')),
      };
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  }

  it('combines every API page and excludes bot-authored previews', () => {
    const pr = (number: number, ref: string, type = 'User') => ({
      number,
      head: { ref },
      user: { type },
    });
    expect(
      runInventory([[pr(1, 'feature/one'), pr(2, 'deps', 'Bot')], [pr(3, 'feature/three')]]),
    ).toEqual({
      status: 0,
      output: 'open_previews={"1":"feature/one","3":"feature/three"}\n',
      injected: false,
    });
  });

  it('allows an empty inventory when the API succeeds', () => {
    expect(runInventory([[]])).toEqual({ status: 0, output: 'open_previews={}\n', injected: false });
  });

  it('emits no inventory when the API fails, even with valid partial JSON', () => {
    const result = runInventory([[]], '', 1);
    expect(result.status).not.toBe(0);
    expect(result.output).toBe('');
  });

  it('compacts manual JSON while keeping shell syntax inert', () => {
    const manual = { '4': 'feature/$(touch injected)\nquoted"branch' };
    expect(runInventory(null, JSON.stringify(manual, null, 2), 1)).toEqual({
      status: 0,
      output: `open_previews=${JSON.stringify(manual)}\n`,
      injected: false,
    });
  });

  it('rejects invalid manual map values before producing output', () => {
    const result = runInventory(null, '{"4":false}');
    expect(result.status).not.toBe(0);
    expect(result.output).toBe('');
  });
});
