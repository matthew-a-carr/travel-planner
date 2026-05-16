import type {
  PreDeparturePlannerService,
  PreDeparturePlanOutcome,
} from '@/application/ports/pre-departure-planner-service';

/**
 * Deterministic stub used by the Playwright e2e suite so the panel can be
 * exercised against stable fixture content. Gated by the
 * `E2E_STUB_AI_SERVICES=true` env var in `create-ai-services.ts` — this
 * file is never wired into production paths. See ADR 045 and
 * `tests/e2e/11-pre-departure.spec.ts`.
 *
 * Returns only checklist items (no transport legs) because legs require
 * real destination ids that the test can't predict before the trip is
 * created.
 */
export class E2eStubPreDeparturePlannerService implements PreDeparturePlannerService {
  async plan(): Promise<PreDeparturePlanOutcome> {
    return {
      ok: true,
      result: {
        items: [
          {
            title: 'E2E stub: Apply for visa',
            category: 'visa',
            dueDate: null,
            costPence: 40_000,
            suggestion: 'Stubbed suggestion — verify with the embassy.',
            verifyAt: 'embassy',
          },
          {
            title: 'E2E stub: Open multi-currency account',
            category: 'banking',
            dueDate: null,
            costPence: null,
            suggestion: 'Stubbed info-only suggestion.',
            verifyAt: null,
          },
        ],
        transportLegs: [],
      },
    };
  }
}
