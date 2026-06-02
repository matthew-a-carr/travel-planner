# ADR-012: Real-time Collaborative Editing Architecture

**Status**: Proposed  
**Date**: 2026-05-20  
**Deciders**: Head of Engineering (pending CTO sign-off)

## Context

The product team has requested collaborative editing. This ADR evaluates the technical approach.

## Decision

Use Yjs (CRDT library) over WebSockets, with a Hocuspocus server for persistence.

## Status note

This ADR is under active review. The CTO has concerns about vendor lock-in with Hocuspocus. The decision has not yet been finalised.

## Alternatives considered

- Operational Transformation (OT): more complex, not chosen
- Firebase Realtime DB: rejected due to vendor lock-in concerns
