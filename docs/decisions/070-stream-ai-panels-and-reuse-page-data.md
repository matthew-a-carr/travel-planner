# ADR 070: Stream AI Panels and Reuse Page Data

**Date:** 2026-09-06
**Status:** Accepted

## Context

The trip overview and timeline awaited optional AI generation before returning
any page content. Each AI use case also repeated four reads already performed
by the page. The closed assistant eagerly imported the chat SDK and tool UI.
These costs affect the common trip navigation journey, even with no chat use.

## Decision

- Render optional AI panels inside server-side Suspense boundaries, after the
  existing authentication and trip membership checks. The overview uses an
  empty fallback, matching ADR 043's optional narrative. The timeline renders
  deterministic findings while waiting for AI enrichment.
- Expose snapshot variants of the existing narrative and timeline use cases.
  Authorized pages pass the data they have already loaded. Repository-based
  callers delegate to the same implementations, preserving cache keys, TTLs,
  and provider-failure behavior. No cross-request trip cache is introduced.
- Split the assistant body into a dynamically imported client component,
  mounted only after opening and history hydration. Keep the trigger, dialog,
  loading state, and history errors in the small initial component.

This follows P4 (remove blocking and duplicate work), P7 (regression tests),
P19 (authorize before streaming), and P28 (reuse existing platform primitives).

## Consequences

The initial page response no longer waits for the AI provider, and each AI panel
avoids four duplicate repository reads. The assistant SDK is downloaded on first
use, so first opening may display a loading state while its chunk arrives.
AI narratives can appear after other content; timeline warnings remain visible
throughout. A render's snapshot is shared with its AI panel rather than reread
later. Existing mutation revalidation continues to obtain fresh data.

Regression tests hold AI pending against real Postgres, check the page returns
and repository reads are not repeated, and prohibit an SDK import when the
assistant is closed. Existing AI cache/fallback and browser chat tests remain
applicable. Reverting the changes restores the previous render path without
schema changes or data migration.
