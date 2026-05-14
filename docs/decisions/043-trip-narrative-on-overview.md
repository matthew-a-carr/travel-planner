# ADR 043: Trip Narrative on the Overview Card

**Date:** 2026-05-14
**Status:** Accepted

## Context

The trip overview page (`src/app/trips/[id]/page.tsx`) renders the budget
overview card, the burndown alerts banner, charts and the destination
section. All of these surface *numbers*: total budget, allocation
percentage, daily pace vs target, projection lines. None of them
surface an *answer to the question the user is actually asking* — "am I
on track, and if not, what should I do?".

The same trip state already supports the deterministic burndown maths
(`calculateTripBurndown`, `detectAlerts`) and the AI-driven timeline
insights on a different tab. The overview is where users land first;
it's the highest-leverage place to add a short, AI-written narrative
that explains the burndown state in one paragraph and offers up to
three concrete next steps.

This is roadmap slice 2 of `/root/.claude/plans/how-can-we-make-proud-toast.md`.
ADR 042 added the chat assistant as the conversational AI surface; this
ADR adds a stateless, server-rendered narrative panel as a non-chat AI
surface. The narrative service introduced here is intended to be
reused by future slices (cross-trip budget suggestions on trip
creation; post-trip recap).

## Decision

Adopt a new **TripNarrativeService** port and adapter, plumbed through
the existing port/adapter/no-op pattern, and render its output as a
server-side panel above the alerts banner on the trip overview page.

### Architecture

- **Port** — `src/application/ports/trip-narrative-service.ts`:
  `summarise({ trip, destinations, fixedCosts, spendEntries, currentDate })`
  → `{ ok: true; result: { narrative; bullets } }` |
  `{ ok: false; error }`. `narrative` is ≤ 280 chars (2–3 sentences),
  `bullets` is 0–3 imperatives ≤ 120 chars each.
- **Real adapter** — `src/infrastructure/ai/gateway-trip-narrative.ts`:
  uses `generateObject` against the Vercel AI Gateway with a Zod
  schema enforcing the length budgets and a system prompt that
  forbids invented numbers.
- **No-op fallback** —
  `src/infrastructure/ai/no-op-trip-narrative.ts`: returns
  `{ ok: true, result: { narrative: '', bullets: [] } }` so the panel
  is hidden when `AI_GATEWAY_API_KEY` is unset and the no-op path is
  active. Matches the silent-degradation behaviour of
  `NoOpTimelineInsights`.
- **Router** — `runtimeAwareTripNarrative` in
  `runtime-aware-services.ts`, re-checks `hasAiCredentials()` per
  call (consistent with the other AI ports — see ADR 040).
- **Use case** — `src/application/use-cases/summarise-trip-narrative.ts`:
  fetches trip + destinations + fixedCosts + spend, derives a stable
  state-key, looks up the AI cache (`trip-narrative-v1`, TTL 6 h), and
  on miss invokes the narrative service. AI failure returns
  `ok({ narrative: '', bullets: [] })` — best-effort, the page degrades
  silently.
- **Container** — `AppContainer.tripNarrativeService` joins the
  existing `timelineInsightsService` / `chatAssistant` / `itineraryParser`
  fields. The composition root in `create-app-container.ts` wires
  it; `container.test.ts`'s fake builder is updated to match.
- **UI** — `src/ui/components/TripNarrativePanel.tsx`: a server-safe
  component that renders the paragraph and bulleted list. The trip
  page calls the use case in parallel with the existing burndown +
  charts computation and passes the result.

### Caching strategy

Re-uses the existing `ai_cache` table (ADR 040). Cache key includes:

- destination ids, country, comfort, date range, allocated budget
- fixed-cost ids, date, amount, category
- spend entry count + total pence (coarse — does not invalidate per
  individual entry)
- the day-precision `currentDate` (so pace narratives roll over daily)
- the trip id, status, total budget

TTL 6 h. Coarser than the timeline insights cache (24 h, no day key)
because the narrative is paced against "today"; finer than per-spend
invalidation because the model can absorb minor drift inside a day.

### Why not just chat?

The chat assistant (ADR 042) can answer "how am I tracking?" — and
slice 1 of this roadmap surfaces a chip that prompts exactly that.
The narrative panel is the *unprompted* answer: a passive surface
that requires no action from the user. The two complement each
other.

## Consequences

- One new AI port, one new use case, one new UI component, one new
  container field. No new dependencies, no schema changes.
- The narrative service is intentionally reusable: the same port will
  back the post-trip recap (roadmap slice 7) and the cross-trip
  budget-suggestion narrative (roadmap slice 6).
- Cost: one `generateObject` call per uncached overview load, capped
  by the 6-h TTL. Same gateway + model as the existing AI surfaces.
- The page now renders one extra "AI offline" failure mode (silent
  degradation to an empty panel). Acceptable because the overview
  already works without the narrative.

## Alternatives considered

- **Render the narrative on the timeline tab instead of the overview.**
  Smaller blast radius but lower discoverability — the overview is
  the page users land on. Defer the timeline-tab narrative until
  insight kinds (roadmap slice 4) make it earn its keep.
- **Compute the narrative client-side via a Route Handler.** Lets us
  stream tokens. Rejected: the narrative is short and rendered on
  page load, so a one-shot SSR call with caching is simpler and
  doesn't introduce a hydration race.
- **Extend `TimelineInsightsService` with a `narrative` kind.** Mixes
  two output shapes (structured findings vs free-text paragraph) in
  one port. A separate port is clearer and lets each service evolve
  on its own cadence.
- **No caching, fresh narrative per page load.** Cheap but wasteful
  — the same trip state produces the same narrative. Reusing the
  `ai_cache` table costs nothing.
