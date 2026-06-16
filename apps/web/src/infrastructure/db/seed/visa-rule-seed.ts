/**
 * Visa-rule seed data (SPEC-015).
 *
 * This initial set is **hand-authored and human-reviewable in the PR diff**
 * (`source: 'manual'`) for UK (GBR) passport holders across high-traffic
 * destinations plus the Schengen Area. The broad, AI-extracted long tail
 * (`source: 'ai-extracted'`) is produced by `pnpm visa:fetch` in a later step
 * and appended here, gated by the same diff review.
 *
 * Policy is summarised for planning guidance only — always confirm against the
 * destination's official guidance before travel.
 */

export type VisaZoneSeed = {
  readonly code: string;
  readonly name: string;
  readonly rollingAllowanceDays: number | null;
  readonly rollingWindowDays: number | null;
  readonly notes: string | null;
};

export type VisaZoneMembershipSeed = {
  readonly zoneCode: string;
  readonly alpha3: string;
};

export type VisaRuleSeed = {
  readonly nationality: string;
  readonly destination: string;
  readonly zoneCode: string | null;
  readonly purpose: string;
  readonly workRights: boolean;
  readonly minAgeYears: number | null;
  readonly maxAgeYears: number | null;
  readonly eligibilityNotes: string | null;
  readonly category: string;
  readonly maxStayDays: number | null;
  readonly visaValidityDays: number | null;
  readonly entryType: string;
  readonly minDaysOutBeforeReturn: number | null;
  readonly rollingAllowanceDays: number | null;
  readonly rollingWindowDays: number | null;
  readonly otherRequirements: readonly string[];
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly source: 'ai-extracted' | 'manual';
  readonly sourceNote: string | null;
};

export const VISA_ZONES_SEED: readonly VisaZoneSeed[] = [
  {
    code: 'SCHENGEN',
    name: 'Schengen Area',
    rollingAllowanceDays: 90,
    rollingWindowDays: 180,
    notes: 'Short stays are limited to 90 days in any rolling 180-day period across all members.',
  },
];

/** Schengen Area members (ISO alpha-3) as of 2025 (incl. Bulgaria, Romania, Croatia). */
const SCHENGEN_MEMBERS: readonly string[] = [
  'AUT',
  'BEL',
  'BGR',
  'CHE',
  'CZE',
  'DEU',
  'DNK',
  'ESP',
  'EST',
  'FIN',
  'FRA',
  'GRC',
  'HRV',
  'HUN',
  'ISL',
  'ITA',
  'LIE',
  'LTU',
  'LUX',
  'LVA',
  'MLT',
  'NLD',
  'NOR',
  'POL',
  'PRT',
  'ROU',
  'SVK',
  'SVN',
  'SWE',
];

export const VISA_ZONE_MEMBERSHIP_SEED: readonly VisaZoneMembershipSeed[] = SCHENGEN_MEMBERS.map(
  (alpha3) => ({ zoneCode: 'SCHENGEN', alpha3 }),
);

/** A GBR Schengen short-stay rule for one member country. */
function schengenRule(destination: string): VisaRuleSeed {
  return {
    nationality: 'GBR',
    destination,
    zoneCode: 'SCHENGEN',
    purpose: 'tourism',
    workRights: false,
    minAgeYears: null,
    maxAgeYears: null,
    eligibilityNotes: null,
    category: 'visa-free',
    maxStayDays: null, // the binding limit is the zone rolling window
    visaValidityDays: null,
    entryType: 'multiple',
    minDaysOutBeforeReturn: null,
    rollingAllowanceDays: 90,
    rollingWindowDays: 180,
    otherRequirements: [
      'Passport valid for at least 3 months after the intended departure date',
      'Passport issued within the last 10 years',
    ],
    validFrom: '2021-01-01',
    validTo: null,
    source: 'manual',
    sourceNote:
      'gov.uk foreign travel advice — Schengen Area 90/180 short-stay rule for UK nationals',
  };
}

const NON_SCHENGEN_RULES: readonly VisaRuleSeed[] = [
  {
    nationality: 'GBR',
    destination: 'JPN',
    zoneCode: null,
    purpose: 'tourism',
    workRights: false,
    minAgeYears: null,
    maxAgeYears: null,
    eligibilityNotes: null,
    category: 'visa-free',
    maxStayDays: 90,
    visaValidityDays: null,
    entryType: 'multiple',
    minDaysOutBeforeReturn: null,
    rollingAllowanceDays: null,
    rollingWindowDays: null,
    otherRequirements: ['Onward or return ticket may be requested'],
    validFrom: '2020-01-01',
    validTo: null,
    source: 'manual',
    sourceNote: 'gov.uk Japan travel advice — visa-free short stays up to 90 days',
  },
  {
    nationality: 'GBR',
    destination: 'USA',
    zoneCode: null,
    purpose: 'tourism',
    workRights: false,
    minAgeYears: null,
    maxAgeYears: null,
    eligibilityNotes: null,
    category: 'eta',
    maxStayDays: 90,
    visaValidityDays: 730,
    entryType: 'multiple',
    minDaysOutBeforeReturn: null,
    rollingAllowanceDays: null,
    rollingWindowDays: null,
    otherRequirements: ['ESTA authorisation required before travel under the Visa Waiver Program'],
    validFrom: '2020-01-01',
    validTo: null,
    source: 'manual',
    sourceNote: 'gov.uk USA travel advice — ESTA / Visa Waiver Program, up to 90 days',
  },
  {
    nationality: 'GBR',
    destination: 'THA',
    zoneCode: null,
    purpose: 'tourism',
    workRights: false,
    minAgeYears: null,
    maxAgeYears: null,
    eligibilityNotes: null,
    category: 'visa-free',
    maxStayDays: 60,
    visaValidityDays: null,
    entryType: 'multiple',
    minDaysOutBeforeReturn: null,
    rollingAllowanceDays: null,
    rollingWindowDays: null,
    otherRequirements: ['Proof of onward travel may be requested'],
    validFrom: '2024-07-15',
    validTo: null,
    source: 'manual',
    sourceNote: 'gov.uk Thailand travel advice — 60-day visa exemption for UK nationals',
  },
  {
    nationality: 'GBR',
    destination: 'VNM',
    zoneCode: null,
    purpose: 'tourism',
    workRights: false,
    minAgeYears: null,
    maxAgeYears: null,
    eligibilityNotes: null,
    category: 'e-visa',
    maxStayDays: 90,
    visaValidityDays: 90,
    entryType: 'multiple',
    minDaysOutBeforeReturn: null,
    rollingAllowanceDays: null,
    rollingWindowDays: null,
    otherRequirements: ['Apply for the e-visa online before travel'],
    validFrom: '2023-08-15',
    validTo: null,
    source: 'manual',
    sourceNote: 'gov.uk Vietnam travel advice — 90-day e-visa for UK nationals',
  },
  // Australia — coexisting tourist + working-holiday rules (SPEC-015 age-eligibility case).
  {
    nationality: 'GBR',
    destination: 'AUS',
    zoneCode: null,
    purpose: 'tourism',
    workRights: false,
    minAgeYears: null,
    maxAgeYears: null,
    eligibilityNotes: null,
    category: 'eta',
    maxStayDays: 90,
    visaValidityDays: 365,
    entryType: 'multiple',
    minDaysOutBeforeReturn: null,
    rollingAllowanceDays: null,
    rollingWindowDays: null,
    otherRequirements: ['Apply for an eVisitor (subclass 651) authorisation before travel'],
    validFrom: '2020-01-01',
    validTo: null,
    source: 'manual',
    sourceNote: 'gov.uk Australia travel advice — eVisitor, up to 90 days per visit',
  },
  {
    nationality: 'GBR',
    destination: 'AUS',
    zoneCode: null,
    purpose: 'working-holiday',
    workRights: true,
    minAgeYears: 18,
    maxAgeYears: 35,
    eligibilityNotes: 'Applicants must be 18–35 at the time of application.',
    category: 'visa-required',
    maxStayDays: 365,
    visaValidityDays: 365,
    entryType: 'multiple',
    minDaysOutBeforeReturn: null,
    rollingAllowanceDays: null,
    rollingWindowDays: null,
    otherRequirements: [
      'Working Holiday visa (subclass 417): apply and pay the fee before travel',
      'Must first enter Australia before turning 36',
    ],
    validFrom: '2020-01-01',
    validTo: null,
    source: 'manual',
    sourceNote: 'Australian Department of Home Affairs — Working Holiday visa (subclass 417)',
  },
];

export const VISA_RULES_SEED: readonly VisaRuleSeed[] = [
  ...SCHENGEN_MEMBERS.map(schengenRule),
  ...NON_SCHENGEN_RULES,
];
