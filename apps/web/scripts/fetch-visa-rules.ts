/**
 * Developer script: extract visa rules for UK (GBR) passport holders and write
 * them to src/infrastructure/db/seed/visa-rule-ai-seed.ts (SPEC-015 / ADR 061).
 *
 * Usage:
 *   pnpm visa:fetch                 # default curated destination set
 *   pnpm visa:fetch JPN VNM THA     # specific destination alpha-3 codes
 *
 * One-off / offline AI job — NOT run in CI or at deploy time. The generated
 * file is committed and **must be human-reviewed in the PR diff** before merge
 * (the irreducible accuracy gate). The runtime evaluator never calls AI.
 *
 * Requires AI Gateway credentials (AI_GATEWAY_API_KEY locally, or Vercel OIDC).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtractedVisaRule } from '../src/application/ports/visa-rule-extractor';
import { COUNTRY_LIST_SEED } from '../src/infrastructure/db/seed/country-list-seed';
import { VISA_ZONE_MEMBERSHIP_SEED } from '../src/infrastructure/db/seed/visa-rule-seed';
import type { VisaRuleSeed } from '../src/infrastructure/db/seed/visa-rule-seed';
import { GatewayVisaRuleExtractor } from '../src/infrastructure/ai/gateway-visa-rule-extractor';
import { runSanityChecks, serializeAiSeed } from '../src/infrastructure/ai/visa-extraction-checks';
import { gatewayModelId, hasAiCredentials } from '../src/infrastructure/ai/vercel-gateway-client';

const NATIONALITY = 'GBR';

/** A small, high-traffic default set when no destinations are passed on argv. */
const DEFAULT_DESTINATIONS = ['JPN', 'USA', 'THA', 'VNM', 'AUS', 'NZL', 'CAN', 'SGP'];

function toIsoDateToday(): string {
  return new Date().toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  if (!hasAiCredentials()) {
    console.error(
      'No AI Gateway credentials. Set AI_GATEWAY_API_KEY (local) or run on Vercel. Aborting.',
    );
    process.exit(1);
  }

  const requested = process.argv.slice(2).map((a) => a.toUpperCase());
  const targets = requested.length > 0 ? requested : DEFAULT_DESTINATIONS;

  const nameByAlpha3 = new Map(COUNTRY_LIST_SEED.map((c) => [c.alpha3, c.country]));
  const knownAlpha3 = new Set(COUNTRY_LIST_SEED.map((c) => c.alpha3));
  const zoneByAlpha3 = new Map(VISA_ZONE_MEMBERSHIP_SEED.map((m) => [m.alpha3, m.zoneCode]));

  const extractor = new GatewayVisaRuleExtractor(gatewayModelId());
  const validFrom = toIsoDateToday();

  const rows: VisaRuleSeed[] = [];
  let problemCount = 0;

  for (const destination of targets) {
    const destinationName = nameByAlpha3.get(destination);
    if (!destinationName) {
      console.warn(`⚠ ${destination}: not in the country list — skipping`);
      continue;
    }

    const outcome = await extractor.extract({ nationality: NATIONALITY, destination, destinationName });
    if (!outcome.ok) {
      console.error(`✗ ${destination}: ${outcome.error}`);
      problemCount++;
      continue;
    }

    for (const rule of outcome.rules) {
      const problems = runSanityChecks(rule, { destination, knownAlpha3 });
      if (problems.length > 0) {
        problemCount += problems.length;
        for (const p of problems) console.warn(`  ⚠ ${destination} (${rule.purpose}): ${p}`);
      }
      rows.push(toSeedRow(rule, destination, zoneByAlpha3.get(destination) ?? null, validFrom));
    }
    console.log(`✓ ${destination}: ${outcome.rules.length} rule(s)`);
  }

  const outPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../src/infrastructure/db/seed/visa-rule-ai-seed.ts',
  );
  writeFileSync(outPath, serializeAiSeed(rows));

  console.log(`\nWrote ${rows.length} rule(s) to visa-rule-ai-seed.ts.`);
  if (problemCount > 0) {
    console.log(`${problemCount} sanity warning(s) — REVIEW the diff carefully before committing.`);
  }
  console.log('Reminder: every ai-extracted row needs human review before merge.');
}

function toSeedRow(
  rule: ExtractedVisaRule,
  destination: string,
  zoneCode: string | null,
  validFrom: string,
): VisaRuleSeed {
  return {
    nationality: NATIONALITY,
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

main().catch((err) => {
  console.error('Visa fetch failed:', err);
  process.exit(1);
});
