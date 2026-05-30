# Implementation Notes — SPEC-008: Standardised API Response Envelope + OpenAPI 3.1 YAML

**Spec:** [SPEC-008-api-response-envelope-and-openapi](../specs/SPEC-008-api-response-envelope-and-openapi.md)
**Started:** 2026-05-30

> Rolling log written by the implementing agent. Append new entries at the
> bottom as they happen — do not rewrite history. Each entry is a single
> observation, decision, or surprise. At spec close-out, every entry is
> triaged into one of: spec deviations table, spec post-implementation notes,
> docs/tech-debt.md, or discarded.

## Entries

### 2026-05-30 — Envelope half (steps 3–7) already shipped before this impl

**Step:** Steps 3–7 (envelope reshape: shared schemas, respond/errors helpers, /me + mobile routes, mobile client)
**Type:** decision
**Note:** The success/error envelope reshape landed on `main` via the
origin/main merge (commit `b43a40f` "server + mobile envelope reshape (steps
3–7)") and the subsequent SPEC-007↔SPEC-008 renumber. `packages/shared`
already exports `apiSuccessSchema` / `apiErrorEnvelopeSchema` / `requestEchoSchema`
/ `asofSchema` / `versionSchema` (version pinned `1.1.0`); `_lib/respond.ts` +
`_lib/errors.ts` exist; the /me and mobile routes return envelopes; the mobile
client unwraps `.data`. This implementation only covers the OpenAPI half
(step 8 onward).

**Triage (filled at close-out):**

---

### 2026-05-30 — zod v4 native JSON Schema instead of @asteasolutions/zod-to-openapi

**Step:** Step 8 (generator + scripts)
**Type:** deviation
**Note:** SPEC-008 §Decision + the ADR-trigger checklist named
`@asteasolutions/zod-to-openapi` (a zod-v3-era library) and an `.openapi()`
annotation approach. The repo is on **zod v4** (`^4.4.3`), whose native
`z.toJSONSchema(schema, { target: 'draft-2020-12' })` emits exactly the JSON
Schema that OpenAPI 3.1 components use (OAS 3.1 aligns with JSON Schema
2020-12). Chosen (with human sign-off, 2026-05-30) to generate `v1.yaml` from
the existing shared schemas via `z.toJSONSchema` for components + a
hand-assembled `paths`/`info` object serialized with `yaml` — **no
zod-v3-era dependency, no per-schema `.openapi()` annotations**. Avoids
fighting the toolchain (cf. TD-006's TS6 hold rationale). ADR 056 should be
amended to record the zod-native mechanism.

**Triage (filled at close-out):**

---

### 2026-05-30 — Step 11 (envelope e2e) already covered

**Step:** Step 11 (Playwright envelope e2e)
**Type:** decision
**Note:** SPEC-008 specified a new `api-v1-envelope.spec.ts`. The merge
already added `apps/web/tests/e2e/11-api-me.spec.ts`, which asserts the success
envelope shape (`data`/`request`/`asof`/`version`, `asof` RFC-3339-ms regex,
`version` === `ENVELOPE_VERSION`) and the RFC 7807 + `code` 401 envelope. No
separate duplicate file written.

**Triage (filled at close-out):**

---

## Close-out triage summary

> Filled at the very end. One line per entry above plus where it landed.

| Entry | Landed in |
|-------|-----------|
| 1 | |
| 2 | |
| 3 | |
