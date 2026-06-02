# SPEC-010: Async API Client

## Status: Implemented with deviation

## Summary
Replace synchronous `requests` calls in the API client layer with async `httpx` calls to support concurrent request handling under load.

## Deviation
The implementation migrated only the hot paths. The admin API wrapper (`src/api/admin.py`) still uses synchronous `requests` for simplicity during the tight release window.

## Acceptance Criteria
- All public API calls use `httpx.AsyncClient`
- Connection pooling configured with sensible defaults
- Timeouts set per-endpoint
