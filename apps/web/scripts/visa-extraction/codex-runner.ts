// Dev-only runner: extract one (nationality, destination)'s visa rules via the
// OpenAI Codex CLI using a ChatGPT subscription (`codex login`). Enforces the
// same JSON Schema via `--output-schema`. Best-effort JSONL parse — Codex's
// non-interactive output shape may shift; adjust if the CLI changes.
// SPEC-019 / ADR 062.

import { execFileSync } from 'node:child_process';

export function extractWithCodex(prompt: string, schemaPath: string): unknown {
  let stdout: string;
  try {
    stdout = execFileSync('codex', ['exec', '--json', '--output-schema', schemaPath, prompt], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`codex exec failed (is the Codex CLI installed and logged in?): ${message}`);
  }

  // `--json` streams JSONL. Scan from the end for the final object carrying a
  // `rules` array (directly, or nested under a structured-output field).
  const lines = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    let obj: unknown;
    try {
      obj = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    const candidate = pickRulesObject(obj);
    if (candidate) return candidate;
  }
  throw new Error('Could not find structured output with a `rules` array in codex output.');
}

function pickRulesObject(obj: unknown): unknown | null {
  if (obj && typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    if (Array.isArray(record.rules)) return record;
    for (const key of ['structured_output', 'output', 'message', 'content', 'result']) {
      const nested = pickRulesObject(record[key]);
      if (nested) return nested;
    }
  }
  return null;
}
