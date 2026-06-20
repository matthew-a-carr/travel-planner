/**
 * Generate apps/web/visa-rule.schema.json from the Zod extraction schema
 * (SPEC-019 / ADR 062). Both extraction runners consume this JSON Schema:
 * the Claude Agent SDK via `outputFormat` and Codex via `--output-schema`.
 *
 *   pnpm visa:schema         # regenerate the file
 *   pnpm visa:schema:check   # fail if the committed file is out of date (CI)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { visaRuleExtractionSchema } from '../src/infrastructure/visa-extraction/extraction-schema';

const OUT_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'visa-rule.schema.json');

function render(): string {
  const jsonSchema = z.toJSONSchema(visaRuleExtractionSchema, { target: 'draft-7' });
  return `${JSON.stringify(jsonSchema, null, 2)}\n`;
}

function main(): void {
  const next = render();
  const check = process.argv.includes('--check');

  if (check) {
    let current = '';
    try {
      current = readFileSync(OUT_PATH, 'utf8');
    } catch {
      // missing file → drift
    }
    if (current !== next) {
      console.error('visa-rule.schema.json is out of date. Run `pnpm visa:schema` and commit.');
      process.exit(1);
    }
    console.log('visa-rule.schema.json is up to date.');
    return;
  }

  writeFileSync(OUT_PATH, next);
  console.log(`Wrote ${OUT_PATH}`);
}

main();
