# ADR 042: Conversational Trip Assistant — Per-Trip Streaming Drawer

**Date:** 2026-05-09
**Status:** Accepted

## Context

The product has 16 write-side use cases (record spend, edit destination, edit
trip, etc.) under `src/application/use-cases/`, each surfaced through a
dedicated form. It also has rich read-only data — `buildBudgetWaterfall`,
`calculateTripBurndown`, `detectAlerts`, `calculateBurndownProjection` — that a
user can only see if they navigate to the right card on the trip page.

Two real friction points motivate this work:

1. **Mid-trip operations are high-frequency, low-effort intents.** "I just
   spent £8 on lunch in Hanoi" or "push Cambodia back two days" are quick
   thoughts the user wants to act on; opening a form, picking a destination,
   choosing a category, etc., is disproportionate.
2. **Insights are buried.** "Am I on pace?" requires the user to open the trip,
   scroll to the burndown card, and interpret the numbers. The data exists,
   but the *answer to the question* doesn't.

A per-trip conversational assistant subsumes both. It streams replies for
read questions and (in later slices) calls the existing use cases as tools
for write operations.

ADR 040 established the **Vercel AI Gateway + AI SDK** as the AI hosting
choice; ADR 041 established the Timeline tab as the first non-chatbot AI UI.
This ADR adds the chat-shaped surface those decisions explicitly excluded.

## Decision

Adopt a **per-trip conversational assistant** delivered in five thin slices.

This ADR covers Slice 0 — foundations only — and the cross-cutting decisions
that bind future slices.

### Cross-cutting decisions

1. **Per-trip scope, not global.**
   The drawer mounts on the trip detail page (`src/app/trips/[id]/page.tsx`)
   and operates on a single trip's context. A global launcher and trip
   handoff is out of scope.

2. **Persist chat history from day one.**
   Two new tables (`chat_threads`, `chat_messages`) ship in Slice 0. The
   user sees their conversation when they reopen the drawer, not an empty
   shell. The cost is two thin tables and a repository; the value is that
   the slice is genuinely usable from the first ship.

3. **Auto-execute low-risk mutations, confirm risky ones.**
   When tools land in Slice 2+, a pure-domain `classifyToolRisk` function
   decides per-call: query tools and within-budget spends auto-execute with
   inline undo; everything that mutates the schedule, deletes data, or
   would breach the trip-budget invariant renders a Confirm/Cancel card.

4. **Streaming via a Route Handler, not a server action.**
   Server actions don't natively support streaming token-by-token to the
   browser. `streamText` from the AI SDK does. We add a single Route
   Handler at `src/app/api/trips/[id]/chat/route.ts`. This is the first
   Route Handler in the codebase; future AI streaming surfaces should
   follow the same pattern.

5. **Architecture parity with existing AI features.**
   The chat assistant is plumbed through the same port/adapter layout as
   `ItineraryParser` and `TimelineInsightsService`:
   - Port: `src/application/ports/chat-assistant.ts`
     (`ChatAssistantService.streamReply`).
   - Real adapter: `src/infrastructure/ai/anthropic-chat-assistant.ts`,
     constructed only when `hasAiCredentials()` is true.
   - No-op fallback: `src/infrastructure/ai/no-op-chat-assistant.ts`,
     returning a clear "AI offline" error so the UI degrades gracefully
     without throwing.
   - Wired by `createAiServices()` (the same env-var branching point as
     the parser and insights service).

6. **Tools wrap existing use cases — never duplicate domain validation.**
   When tools land in Slice 1+, each tool is a ~30-line shim that calls an
   existing use case (`record-spend.ts`, `edit-destination.ts`, etc.). The
   chat surface becomes a new *interface* over the existing application
   layer; no second source of truth.

### Slice 0 scope (this ADR's first PR)

- New tables: `chat_threads(id, trip_id, user_id, created_at, updated_at)` and
  `chat_messages(id, thread_id, role, content, created_at)`. Compound index
  on `(trip_id, user_id)` for lookup; compound index on
  `(thread_id, created_at)` for replay.
- One thread per `(trip, user)` — created on first lookup. Multi-user shared
  threads are out of scope; each user has their own conversation per trip.
- Domain types in `src/domain/chat/types.ts` only. No domain logic yet —
  `classifyToolRisk` arrives in Slice 2 with the first mutating tool.
- Use case `processChatMessage` validates input, authorises trip access via
  `OrganizationRepository.findMembership`, persists the user message, calls
  the assistant, and returns an `AsyncIterable<string>` that persists the
  assistant message on completion (or partial output on stream failure).
- Route Handler `POST /api/trips/[id]/chat` returns the stream as
  `text/plain; charset=utf-8`. `GET` returns the existing thread + messages
  for hydration. The handler is the only place that resolves dependencies via
  `getAppContainer()` for chat.
- Drawer client component (`TripAssistantDrawer.tsx`) opens from the trip
  page header, hydrates via `GET`, sends via `POST`, and streams chunks into
  the in-progress assistant message using a plain `ReadableStream` reader.
  We deliberately don't use `useChat` from `@ai-sdk/react` for this slice —
  the protocol is plain text, not the SDK's UI message stream, so the
  client stays minimal.

### Why streaming text rather than the AI SDK UI message protocol

The UI message protocol shines when there are tool calls, attachments, and
mid-response state to render. Slice 0 has none of that. A plain text stream
keeps the client and server pieces small enough to fit in one PR. When tools
land (Slice 2), we'll re-evaluate: either upgrade to the UI message
protocol, or layer structured tool-invocation events on top of the existing
text stream.

## Alternatives considered

- **Global assistant with trip switching.** More capable; requires a context
  resolver that the model trusts not to mutate the wrong trip. Per-trip
  scope eliminates an entire class of authz mistakes for free.
- **Server actions with streaming Response.** Next.js server actions can
  return Response objects but lose the framework's automatic re-validation
  and type plumbing. A Route Handler is the conventional fit for streaming.
- **Ephemeral chat (no persistence) until tools arrive.** Smaller Slice 0
  footprint, but the user's first interaction would be lost on reload.
  Cost/benefit favours persisting from day one given how thin the schema is.
- **Custom tool registry instead of using the AI SDK's `tools` parameter.**
  Defer. The SDK's tool API is the simplest path; if it becomes limiting
  in Slice 4 (multi-step re-balance), revisit.

## Consequences

- The codebase gains its first Route Handler. Future AI streaming surfaces
  (e.g. voice) follow the same pattern: a thin handler that calls an
  application use case and pipes a ReadableStream back.
- Two new tables to maintain. Migration `0011_typical_pretty_boy.sql` is
  transactional and trivially backwards-compatible (additive only).
- The `AppContainer` type now includes `chatMessageRepository` and
  `chatAssistant`. `container.test.ts`'s fake builder was updated to
  match.
- A user signing out cascades to `users.id` — chat threads and messages
  cascade-delete with the user (matches the existing pattern for org
  memberships and accounts).
- Cost: the assistant is gated behind the same `AI_GATEWAY_API_KEY` /
  `VERCEL_OIDC_TOKEN` check as the timeline parser; if neither is set the
  no-op adapter returns a clear error and the UI shows it. No production
  cost is incurred when AI credentials are absent.

## Open questions (for later slices)

- **Slice 2:** What's the exact `classifyToolRisk` rule for "within-budget
  spend"? Initial proposal: `amount ≤ remainingDailyBudget * 1.5` →
  auto-execute with inline undo.
- **Slice 4:** When a proposed edit breaches an invariant, do we re-prompt
  the model with the validation failure to get a re-balance, or do we
  surface the failure verbatim and let the user retry? The plan favours
  re-prompting, but this needs an integration test to validate latency.
- **Multi-user shared threads.** Out of scope for now; revisit if user
  research shows demand.
