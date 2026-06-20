// Visa data ingestion (SPEC-019 / ADR 062). Loads the hand-authored zone/rule
// seeds AND every committed AI-extracted JSON artifact under
// `seed/visa-rules-data/`, Zod-validates each row, and idempotently upserts into
// Postgres. Called after schema migrations on deploy (migrate-deploy.ts), and
// locally by migrate.ts / seed.ts. No AI — pure data load.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  type ValidatedVisaRuleSeed,
  visaRuleSeedSchema,
} from '../visa-extraction/extraction-schema';
import { visaRules, visaZoneMembership, visaZones } from './schema';
import { VISA_RULES_SEED, VISA_ZONE_MEMBERSHIP_SEED, VISA_ZONES_SEED } from './seed/visa-rule-seed';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), 'seed', 'visa-rules-data');

function listJsonFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return []; // no artifacts extracted yet
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...listJsonFiles(full));
    else if (entry.endsWith('.json')) files.push(full);
  }
  return files;
}

/**
 * Load + validate every AI-extracted artifact. Throws on a malformed row so a
 * bad file fails the deploy loudly rather than silently skipping data.
 */
export function loadExtractedVisaRules(dir: string = DATA_DIR): ValidatedVisaRuleSeed[] {
  const rows: ValidatedVisaRuleSeed[] = [];
  for (const file of listJsonFiles(dir).sort()) {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (!Array.isArray(parsed)) throw new Error(`${file}: expected a JSON array of visa rules`);
    parsed.forEach((raw, index) => {
      const result = visaRuleSeedSchema.safeParse(raw);
      if (!result.success) {
        throw new Error(`${file}[${index}] failed validation: ${result.error.message}`);
      }
      rows.push(result.data);
    });
  }
  return rows;
}

// biome-ignore lint/suspicious/noExplicitAny: drizzle db generic — accepts any postgres-js instance
type Db = PostgresJsDatabase<any>;

/** Idempotently upsert zones, memberships, manual rules, and AI-extracted rules. */
export async function ingestVisaData(db: Db): Promise<{ zones: number; rules: number }> {
  for (const zone of VISA_ZONES_SEED) {
    await db
      .insert(visaZones)
      .values({ ...zone, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: visaZones.code,
        set: {
          name: zone.name,
          rollingAllowanceDays: zone.rollingAllowanceDays,
          rollingWindowDays: zone.rollingWindowDays,
          notes: zone.notes,
          updatedAt: new Date(),
        },
      });
  }

  for (const member of VISA_ZONE_MEMBERSHIP_SEED) {
    await db.insert(visaZoneMembership).values(member).onConflictDoNothing();
  }

  const manual = VISA_RULES_SEED;
  const extracted = loadExtractedVisaRules();
  const allRules = [...manual, ...extracted];

  for (const rule of allRules) {
    await db
      .insert(visaRules)
      .values({ ...rule, otherRequirements: rule.otherRequirements, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [
          visaRules.nationality,
          visaRules.destination,
          visaRules.purpose,
          visaRules.validFrom,
        ],
        set: {
          zoneCode: rule.zoneCode,
          workRights: rule.workRights,
          minAgeYears: rule.minAgeYears,
          maxAgeYears: rule.maxAgeYears,
          eligibilityNotes: rule.eligibilityNotes,
          category: rule.category,
          maxStayDays: rule.maxStayDays,
          visaValidityDays: rule.visaValidityDays,
          entryType: rule.entryType,
          minDaysOutBeforeReturn: rule.minDaysOutBeforeReturn,
          rollingAllowanceDays: rule.rollingAllowanceDays,
          rollingWindowDays: rule.rollingWindowDays,
          otherRequirements: rule.otherRequirements,
          validTo: rule.validTo,
          source: rule.source,
          sourceNote: rule.sourceNote,
          updatedAt: new Date(),
        },
      });
  }

  return { zones: VISA_ZONES_SEED.length, rules: allRules.length };
}
