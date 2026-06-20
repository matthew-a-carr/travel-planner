// Shared contract for the visa-rule extraction job (SPEC-019 / ADR 062).
//
// One Zod schema is the single source of truth ("pydantic for AI"): its JSON
// Schema (see scripts/generate-visa-schema.ts → visa-rule.schema.json) is fed to
// both runners' native structured output (Claude Agent SDK `outputFormat`,
// Codex `--output-schema`), and the resulting rows are Zod-re-validated again on
// ingest. The runtime app never imports this — it's extraction/ingest tooling.

import { z } from 'zod';

export const VISA_PURPOSES = [
  'tourism',
  'business',
  'working-holiday',
  'transit',
  'study',
] as const;

export const VISA_CATEGORIES = [
  'visa-free',
  'visa-on-arrival',
  'e-visa',
  'eta',
  'visa-required',
  'admission-refused',
] as const;

export const ENTRY_TYPES = ['single', 'multiple'] as const;

/** What an agent returns for one (nationality, destination) — before stamping. */
export const extractedVisaRuleSchema = z.object({
  purpose: z.enum(VISA_PURPOSES).describe('The visa purpose this rule covers'),
  workRights: z.boolean().describe('Whether the visa permits paid work'),
  minAgeYears: z.number().int().nonnegative().nullable(),
  maxAgeYears: z.number().int().nonnegative().nullable(),
  eligibilityNotes: z.string().max(300).nullable(),
  category: z.enum(VISA_CATEGORIES),
  maxStayDays: z.number().int().positive().nullable(),
  visaValidityDays: z.number().int().positive().nullable(),
  entryType: z.enum(ENTRY_TYPES),
  minDaysOutBeforeReturn: z.number().int().nonnegative().nullable(),
  rollingWindow: z
    .object({
      allowanceDays: z.number().int().positive(),
      windowDays: z.number().int().positive(),
    })
    .nullable(),
  otherRequirements: z.array(z.string().min(3).max(200)).max(8),
  sourceNote: z.string().min(4).max(300).describe('Citation for this rule (e.g. gov.uk page)'),
});

export type ExtractedVisaRule = z.infer<typeof extractedVisaRuleSchema>;

/** The structured output the agent emits for one (nationality, destination). */
export const visaRuleExtractionSchema = z.object({
  rules: z.array(extractedVisaRuleSchema).max(6),
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The fully-stamped, persisted shape — validated again on ingest (defense-in-depth). */
export const visaRuleSeedSchema = z.object({
  nationality: z.string().length(3),
  destination: z.string().length(3),
  zoneCode: z.string().nullable(),
  purpose: z.enum(VISA_PURPOSES),
  workRights: z.boolean(),
  minAgeYears: z.number().int().nonnegative().nullable(),
  maxAgeYears: z.number().int().nonnegative().nullable(),
  eligibilityNotes: z.string().nullable(),
  category: z.enum(VISA_CATEGORIES),
  maxStayDays: z.number().int().positive().nullable(),
  visaValidityDays: z.number().int().positive().nullable(),
  entryType: z.enum(ENTRY_TYPES),
  minDaysOutBeforeReturn: z.number().int().nonnegative().nullable(),
  rollingAllowanceDays: z.number().int().positive().nullable(),
  rollingWindowDays: z.number().int().positive().nullable(),
  otherRequirements: z.array(z.string()),
  validFrom: z.string().regex(ISO_DATE),
  validTo: z.string().regex(ISO_DATE).nullable(),
  source: z.enum(['ai-extracted', 'manual']),
  sourceNote: z.string().nullable(),
});

export type ValidatedVisaRuleSeed = z.infer<typeof visaRuleSeedSchema>;

/** Research instructions shared by both runners (moved from SPEC-015's adapter). */
export const EXTRACTION_SYSTEM_PROMPT = `You are a visa-policy research assistant for a travel-planning app.
Given a traveller's passport nationality and a destination country, emit the entry rules
that apply to ordinary leisure/short-stay travel, plus any well-established longer-stay
route (e.g. a Working Holiday visa) if one clearly exists.

Rules:
- Emit ONE entry per distinct visa/purpose. A country often has just one (short-stay); some
  have two (e.g. a tourist rule + a working-holiday rule).
- Only emit policy you are confident is well-established and current. If unsure, prefer the
  safer interpretation and say so in sourceNote. Do NOT invent specifics.
- maxStayDays is the longest single permitted stay; rollingWindow models shared allowances
  like Schengen's "90 days in any 180" (set it only when such a rule genuinely applies).
- entryType: 'multiple' if the holder may leave and re-enter on the same authorisation.
- Age-restricted routes (working holiday) set minAgeYears/maxAgeYears and workRights=true.
- sourceNote MUST cite where the rule comes from (e.g. the relevant gov.uk travel-advice page).`;
