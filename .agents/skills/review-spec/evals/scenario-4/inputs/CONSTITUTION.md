# Constitution

## Architecture

Layered: Domain → Application → Infrastructure → Presentation. No cross-layer violations.

## API Standards

REST API routes use `/api/v1/` prefix. Responses follow the standard envelope: `{ "data": {...} }` on success, `{ "error": { "code": "...", "message": "..." } }` on failure with appropriate HTTP status codes.

## Testing

Integration tests must use a real test database. Unit tests may mock domain interfaces.

## Observability

Structured JSON logging with correlation IDs at all service boundaries.
