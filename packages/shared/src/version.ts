/**
 * Single-source-of-truth for the published API envelope's `version`
 * field (per SPEC-008 / ADR 056).
 *
 * Manually kept in sync with `packages/shared/package.json#version` —
 * a unit test in `envelope.test.ts` enforces the equality so a
 * mismatch fails CI.
 *
 * SemVer policy (ADR 056 §Decision item 10):
 *   - MAJOR: removed/renamed top-level envelope key, removed `code`,
 *     changed `code` HTTP status, removed a response-schema field.
 *   - MINOR: added endpoint, added `code`, widened enum, added optional
 *     response field, added optional `meta` key.
 *   - PATCH: description/title-only tweaks.
 */
export const ENVELOPE_VERSION = '1.1.0';
