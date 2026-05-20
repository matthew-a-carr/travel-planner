// @travel-planner/shared — wire shapes shared between apps/web and apps/mobile.
//
// Per SPEC-005 + EPIC-001 §10 (narrowed by §16 deviation #3), this package
// contains only the runtime zod schemas and inferred TypeScript types for
// payloads that cross the network between server and mobile client. Server-
// internal domain logic (apps/web/src/domain/**) is NOT re-exported here.

export * from './api-errors';
export * from './me';
export * from './mobile-auth';
