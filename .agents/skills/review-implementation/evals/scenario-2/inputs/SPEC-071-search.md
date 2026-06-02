# SPEC-071: Booking Search

## §1 Summary

Add full-text search across booking records for authenticated users. Results are filtered to the requesting user's bookings only.

## §2 Background

Users with many bookings need a fast way to find specific ones. Currently only paginated listing is available.

## §3 Acceptance Criteria

- AC-1: Users can search bookings by destination name (case-insensitive partial match)
- AC-2: Results include only the authenticated user's own bookings
- AC-3: Search returns an array of matching bookings with their IDs, destinations, and status
- AC-4: Empty search term returns all of the user's bookings

## §5 Out of Scope

- Searching across other users' bookings
- Filtering by date range

## §9 Tests

- Unit tests for the search query domain object
- Integration test for the repository search method against real Postgres
- E2E tests for the search API endpoint

## §12 Implementation Order

1. Add `BookingSearchQuery` domain object
2. Extend `BookingRepository` interface with `search(userId, term)` method
3. Implement `search` in `DrizzleBookingRepository`
4. Add `SearchBookingsUseCase` in application layer
5. Add `/api/v1/bookings/search` GET endpoint
6. Update OpenAPI spec
