// Pure, deterministic cross-field sanity checks for extracted visa rules
// (SPEC-019, moved from SPEC-015's visa-extraction-checks.ts). No network, no
// AI — these catch model mistakes the schema can't (cross-field coherence). The
// AI's *factual* accuracy is gated by human review of the JSON artifact diff.

import type { ExtractedVisaRule } from './extraction-schema';

export type SanityContext = {
  readonly destination: string; // alpha-3
  readonly knownAlpha3: ReadonlySet<string>;
};

export function runSanityChecks(rule: ExtractedVisaRule, ctx: SanityContext): string[] {
  const problems: string[] = [];

  if (ctx.destination.length !== 3) {
    problems.push(`destination "${ctx.destination}" is not an ISO alpha-3 code`);
  }
  if (ctx.knownAlpha3.size > 0 && !ctx.knownAlpha3.has(ctx.destination)) {
    problems.push(`destination "${ctx.destination}" is not in the known country list`);
  }
  if (
    rule.maxStayDays !== null &&
    rule.visaValidityDays !== null &&
    rule.maxStayDays > rule.visaValidityDays
  ) {
    problems.push(
      `maxStayDays (${rule.maxStayDays}) exceeds visaValidityDays (${rule.visaValidityDays})`,
    );
  }
  if (rule.entryType === 'single' && rule.rollingWindow !== null) {
    problems.push('single-entry rule carries a rolling window (usually a multiple-entry concept)');
  }
  if (rule.rollingWindow !== null) {
    if (rule.rollingWindow.allowanceDays > rule.rollingWindow.windowDays) {
      problems.push(
        `rolling allowance (${rule.rollingWindow.allowanceDays}) exceeds window (${rule.rollingWindow.windowDays})`,
      );
    }
  }
  if (rule.minDaysOutBeforeReturn !== null && rule.minDaysOutBeforeReturn < 0) {
    problems.push('minDaysOutBeforeReturn is negative');
  }
  if (
    rule.minAgeYears !== null &&
    rule.maxAgeYears !== null &&
    rule.minAgeYears > rule.maxAgeYears
  ) {
    problems.push(`minAgeYears (${rule.minAgeYears}) exceeds maxAgeYears (${rule.maxAgeYears})`);
  }
  if (rule.purpose === 'working-holiday' && !rule.workRights) {
    problems.push('working-holiday purpose without workRights');
  }
  if (rule.sourceNote.trim().length < 4) {
    problems.push('missing a meaningful sourceNote citation');
  }

  return problems;
}
