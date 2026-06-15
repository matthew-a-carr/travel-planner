import { and, eq, inArray } from 'drizzle-orm';
import type { Alpha3, EntryType, VisaCategory, VisaPurpose, VisaRule } from '@/domain/visa/types';
import type { VisaRuleRepository, VisaZoneMembership } from '@/domain/visa/visa-rule-repository';
import type { Db } from '../client';
import { visaRules, visaZoneMembership } from '../schema';

function toVisaRule(row: typeof visaRules.$inferSelect): VisaRule {
  const rollingWindow =
    row.rollingAllowanceDays !== null && row.rollingWindowDays !== null
      ? { allowanceDays: row.rollingAllowanceDays, windowDays: row.rollingWindowDays }
      : null;
  return {
    id: row.id,
    nationality: row.nationality,
    destination: row.destination,
    zoneCode: row.zoneCode,
    purpose: row.purpose as VisaPurpose,
    workRights: row.workRights,
    eligibility: {
      minAgeYears: row.minAgeYears,
      maxAgeYears: row.maxAgeYears,
      notes: row.eligibilityNotes,
    },
    category: row.category as VisaCategory,
    maxStayDays: row.maxStayDays,
    visaValidityDays: row.visaValidityDays,
    entryType: row.entryType as EntryType,
    minDaysOutBeforeReturn: row.minDaysOutBeforeReturn,
    rollingWindow,
    otherRequirements: (row.otherRequirements as string[]) ?? [],
    validFrom: row.validFrom,
    validTo: row.validTo,
    source: row.source as 'ai-extracted' | 'manual',
    sourceNote: row.sourceNote,
  };
}

export class DrizzleVisaRuleRepository implements VisaRuleRepository {
  constructor(private readonly db: Db) {}

  async findByNationality(nationality: Alpha3): Promise<VisaRule[]> {
    const rows = await this.db
      .select()
      .from(visaRules)
      .where(eq(visaRules.nationality, nationality));
    return rows.map(toVisaRule);
  }

  async findByNationalitiesAndDestinations(
    nationalities: readonly Alpha3[],
    destinations: readonly Alpha3[],
  ): Promise<VisaRule[]> {
    if (nationalities.length === 0 || destinations.length === 0) return [];
    const rows = await this.db
      .select()
      .from(visaRules)
      .where(
        and(
          inArray(visaRules.nationality, [...nationalities]),
          inArray(visaRules.destination, [...destinations]),
        ),
      );
    return rows.map(toVisaRule);
  }

  async findZoneMemberships(): Promise<VisaZoneMembership[]> {
    const rows = await this.db.select().from(visaZoneMembership);
    return rows.map((row) => ({ zoneCode: row.zoneCode, alpha3: row.alpha3 }));
  }
}
