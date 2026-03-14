# ADR 036: Nominatim Geocoding with Store-at-Save Strategy

**Date:** 2026-03-14
**Status:** Accepted

## Context

To pin destinations on the map, we need latitude/longitude coordinates. Users add
destinations by selecting a country and optionally typing a city name. We need a
geocoding service to resolve city names to coordinates.

Options considered:

| Service            | Cost               | Rate limit      | API key |
| ------------------ | ------------------ | --------------- | ------- |
| Google Geocoding   | $5 per 1,000 reqs  | 50 QPS          | Yes     |
| Mapbox Geocoding   | Free tier + $      | 600 req/min     | Yes     |
| Nominatim (OSM)    | Free               | 1 req/sec       | No      |

## Decision

Use **Nominatim** (OpenStreetMap's geocoding service) with a **geocode-at-save**
strategy: resolve coordinates client-side when the user selects a city, then persist
`city`, `latitude`, and `longitude` to the database.

## Rationale

- **Zero cost, no API key** — consistent with our Leaflet/OSM choice (ADR 035).
  No billing account, no environment secrets.
- **1 req/sec is sufficient** — geocoding happens only when a user types a city
  name in the autocomplete field. With 300ms debounce and a 3-character minimum,
  a single user generates at most ~3 requests per city search. This is well within
  the rate limit.
- **Geocode once, read many** — coordinates are stored in the `destinations` table
  as `latitude double precision` and `longitude double precision`. The map renders
  instantly from stored data with no geocoding API calls on page load.
- **Client-side autocomplete** — the `CityAutocomplete` component calls Nominatim
  directly from the browser, scoped by the selected country's ISO alpha-2 code.
  This avoids adding a server-side proxy route.

## Schema

Three nullable columns added to the `destinations` table:

```sql
ALTER TABLE "destinations" ADD COLUMN "city" text;
ALTER TABLE "destinations" ADD COLUMN "latitude" double precision;
ALTER TABLE "destinations" ADD COLUMN "longitude" double precision;
```

Nullable so existing destinations without city data continue to work. The map shows
an empty state when no destinations have coordinates.

## Consequences

- Nominatim's usage policy requires a descriptive `User-Agent` header. We send
  `TravelPlanner/1.0`.
- Geocoding quality depends on OpenStreetMap data coverage. For major cities this
  is excellent; for remote locations it may be less precise.
- If Nominatim becomes unavailable, city autocomplete degrades gracefully — users
  can still type a city name manually, it just won't get coordinates until
  Nominatim recovers.
- No server-side geocoding proxy means the Nominatim request originates from the
  user's browser. This is acceptable per Nominatim's usage policy for low-volume
  applications.
