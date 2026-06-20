/**
 * Visa-rule extraction (SPEC-019 / ADR 062). Researches visa policy per
 * (nationality, destination) via the Claude Agent SDK or OpenAI Codex — using
 * YOUR subscription, not a metered gateway key — and writes one committed JSON
 * artifact per pair. Schema-validated output; cross-field sanity checks. The
 * runtime app NEVER calls this; ingestion happens at deploy from the artifacts.
 *
 * Usage:
 *   CLAUDE_CODE_OAUTH_TOKEN=… pnpm visa:extract --runner=claude JPN VNM THA
 *   pnpm visa:extract --runner=codex --nationality=GBR AUS NZL    # via `codex login`
 *   pnpm visa:extract                                             # claude, GBR, default set
 *
 * One-off / offline. NOT run in CI. Review the JSON diff before merging — that
 * PR review is the factual-accuracy gate (ADR 061/062).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRY_LIST_SEED } from '../src/infrastructure/db/seed/country-list-seed';
import { VISA_ZONE_MEMBERSHIP_SEED } from '../src/infrastructure/db/seed/visa-rule-seed';
import type { VisaRuleSeed } from '../src/infrastructure/db/seed/visa-rule-seed';
import { runSanityChecks } from '../src/infrastructure/visa-extraction/checks';
import {
  type ExtractedVisaRule,
  visaRuleExtractionSchema,
} from '../src/infrastructure/visa-extraction/extraction-schema';
import { extractWithClaudeAgent } from './visa-extraction/claude-agent-runner';
import { extractWithCodex } from './visa-extraction/codex-runner';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(HERE, '..', 'visa-rule.schema.json');
const DATA_DIR = join(HERE, '..', 'src', 'infrastructure', 'db', 'seed', 'visa-rules-data');
const DEFAULT_DESTINATIONS = ['JPN', 'USA', 'THA', 'VNM', 'AUS', 'NZL', 'CAN', 'SGP'];

function toSeedRow(
  rule: ExtractedVisaRule,
  nationality: string,
  destination: string,
  zoneCode: string | null,
  validFrom: string,
): VisaRuleSeed {
  return {
    nationality,
    destination,
    zoneCode,
    purpose: rule.purpose,
    workRights: rule.workRights,
    minAgeYears: rule.minAgeYears,
    maxAgeYears: rule.maxAgeYears,
    eligibilityNotes: rule.eligibilityNotes,
    category: rule.category,
    maxStayDays: rule.maxStayDays,
    visaValidityDays: rule.visaValidityDays,
    entryType: rule.entryType,
    minDaysOutBeforeReturn: rule.minDaysOutBeforeReturn,
    rollingAllowanceDays: rule.rollingWindow?.allowanceDays ?? null,
    rollingWindowDays: rule.rollingWindow?.windowDays ?? null,
    otherRequirements: rule.otherRequirements,
    validFrom,
    validTo: null,
    source: 'ai-extracted',
    sourceNote: rule.sourceNote,
  };
}

async function main(): Promise<void> {
  let runner = 'claude';
  let nationality = 'GBR';
  const destArgs: string[] = [];
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--runner=')) runner = arg.slice('--runner='.length);
    else if (arg.startsWith('--nationality=')) nationality = arg.slice('--nationality='.length).toUpperCase();
    else destArgs.push(arg.toUpperCase());
  }
  if (runner !== 'claude' && runner !== 'codex') {
    console.error(`Unknown --runner=${runner} (expected 'claude' or 'codex').`);
    process.exit(1);
  }
  const targets = destArgs.length > 0 ? destArgs : DEFAULT_DESTINATIONS;

  const jsonSchema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as Record<string, unknown>;
  const nameByAlpha3 = new Map(COUNTRY_LIST_SEED.map((c) => [c.alpha3, c.country]));
  const knownAlpha3 = new Set(COUNTRY_LIST_SEED.map((c) => c.alpha3));
  const zoneByAlpha3 = new Map(VISA_ZONE_MEMBERSHIP_SEED.map((m) => [m.alpha3, m.zoneCode]));
  const validFrom = new Date().toISOString().slice(0, 10);

  let problemCount = 0;
  let written = 0;

  for (const destination of targets) {
    const destinationName = nameByAlpha3.get(destination);
    if (!destinationName) {
      console.warn(`⚠ ${destination}: not in the country list — skipping`);
      continue;
    }
    const prompt = [
      `Passport nationality (ISO alpha-3): ${nationality}`,
      `Destination country: ${destinationName} (${destination})`,
    ].join('\n');

    let raw: unknown;
    try {
      raw =
        runner === 'codex'
          ? extractWithCodex(prompt, SCHEMA_PATH)
          : await extractWithClaudeAgent(prompt, jsonSchema);
    } catch (error) {
      console.error(`✗ ${destination}: ${error instanceof Error ? error.message : String(error)}`);
      problemCount++;
      continue;
    }

    const parsed = visaRuleExtractionSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(`✗ ${destination}: schema validation failed — ${parsed.error.message}`);
      problemCount++;
      continue;
    }

    const rows: VisaRuleSeed[] = [];
    for (const rule of parsed.data.rules) {
      for (const problem of runSanityChecks(rule, { destination, knownAlpha3 })) {
        problemCount++;
        console.warn(`  ⚠ ${destination} (${rule.purpose}): ${problem}`);
      }
      rows.push(toSeedRow(rule, nationality, destination, zoneByAlpha3.get(destination) ?? null, validFrom));
    }

    const dir = join(DATA_DIR, nationality);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${destination}.json`), `${JSON.stringify(rows, null, 2)}\n`);
    written++;
    console.log(`✓ ${destination}: ${rows.length} rule(s) → visa-rules-data/${nationality}/${destination}.json`);
  }

  console.log(`\nWrote ${written} artifact file(s) under visa-rules-data/${nationality}/.`);
  if (problemCount > 0) {
    console.log(`${problemCount} warning(s) — REVIEW the JSON diff carefully before committing.`);
  }
  console.log('Reminder: every ai-extracted artifact needs human review before merge (ADR 061/062).');
}

main().catch((error) => {
  console.error('Visa extraction failed:', error);
  process.exit(1);
});
