# Issue A: Real-time Collaborative Editing

**Label**: ai:plan-epic  
**Number**: #201  
**Strategic ADR**: docs/adr/adr-012-realtime-collab.md

## Vision

Add real-time collaborative editing to the document editor so multiple users can work on the same document simultaneously with live cursor tracking and conflict-free merges.

## Scope

- WebSocket infrastructure for document sync
- CRDT-based conflict resolution
- Presence indicators (live cursors, user avatars)
- Offline mode with reconnect merge
- Per-document permission scoping
- Audit log of collaborative edits

## Rough slices

1. WebSocket server and client connection
2. CRDT library integration
3. Presence indicators
4. Offline mode
5. Permission scoping
6. Audit log
