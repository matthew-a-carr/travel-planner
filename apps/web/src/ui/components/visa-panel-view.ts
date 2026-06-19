import type {
  Alpha3,
  CountryCoverage,
  CoverageStatus,
  VisaAssessment,
  VisaCategory,
} from '@/domain/visa/types';

export type VisaRowSeverity = 'ok' | 'warning' | 'danger' | 'info';

export type VisaRowView = {
  readonly key: string;
  readonly name: string;
  readonly severity: VisaRowSeverity;
  readonly statusLabel: string;
  readonly categoryLabel: string | null;
  readonly staySummary: string | null;
  readonly messages: readonly string[];
  readonly otherRequirements: readonly string[];
};

const ZONE_NAMES: Record<string, string> = { SCHENGEN: 'Schengen Area' };

const STATUS: Record<CoverageStatus, { severity: VisaRowSeverity; label: string }> = {
  ok: { severity: 'ok', label: 'OK' },
  'action-needed': { severity: 'warning', label: 'Action needed' },
  violation: { severity: 'danger', label: 'Issue' },
  unknown: { severity: 'info', label: 'No visa data yet' },
};

const CATEGORY_LABEL: Record<VisaCategory, string> = {
  'visa-free': 'Visa-free',
  'visa-on-arrival': 'Visa on arrival',
  'e-visa': 'e-Visa',
  eta: 'Travel authorisation (ETA)',
  'visa-required': 'Visa required',
  'admission-refused': 'Entry not permitted',
};

/** Friendly name for a coverage grouping (country alpha-3 or zone code). */
export function coverageName(
  coverage: Pick<CountryCoverage, 'destination' | 'zoneCode'>,
  nameByAlpha3: ReadonlyMap<Alpha3, string>,
): string {
  if (coverage.zoneCode !== null) return ZONE_NAMES[coverage.zoneCode] ?? coverage.zoneCode;
  return nameByAlpha3.get(coverage.destination) ?? coverage.destination;
}

function staySummary(coverage: CountryCoverage): string | null {
  const { totalDays, entries } = coverage.stay;
  if (totalDays <= 0) return null;
  const days = `${totalDays} day${totalDays === 1 ? '' : 's'} planned`;
  return entries > 1 ? `${days} · ${entries} entries` : days;
}

/** Map a single coverage to its presentational row. */
export function toVisaRow(
  coverage: CountryCoverage,
  nameByAlpha3: ReadonlyMap<Alpha3, string>,
): VisaRowView {
  const status = STATUS[coverage.status];
  return {
    key: coverage.destination,
    name: coverageName(coverage, nameByAlpha3),
    severity: status.severity,
    statusLabel: status.label,
    categoryLabel: coverage.category === null ? null : CATEGORY_LABEL[coverage.category],
    staySummary: staySummary(coverage),
    messages: coverage.violations.map((v) => v.message),
    otherRequirements: coverage.otherRequirements,
  };
}

/** Build the ordered rows for the panel (violations first, then by name). */
export function buildVisaRows(
  assessment: VisaAssessment,
  nameByAlpha3: ReadonlyMap<Alpha3, string>,
): VisaRowView[] {
  const severityRank: Record<VisaRowSeverity, number> = { danger: 0, warning: 1, info: 2, ok: 3 };
  return assessment.coverages
    .map((coverage) => toVisaRow(coverage, nameByAlpha3))
    .sort((a, b) => {
      const s = severityRank[a.severity] - severityRank[b.severity];
      return s !== 0 ? s : a.name.localeCompare(b.name);
    });
}
