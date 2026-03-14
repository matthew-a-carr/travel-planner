# ADR 035: Leaflet + OpenStreetMap for Journey Map

**Date:** 2026-03-14
**Status:** Accepted

## Context

The Journey Map feature requires an interactive map displaying trip destinations as
numbered pins connected by a route polyline. The map must support markers with popups,
auto-fit bounds, and work within a Next.js App Router application with server-side
rendering.

Three options were evaluated:

| Library            | Cost          | Bundle size | API key required |
| ------------------ | ------------- | ----------- | ---------------- |
| Google Maps        | Pay-per-load  | ~70KB       | Yes              |
| Mapbox GL JS       | Free tier + $ | ~200KB      | Yes              |
| Leaflet + OSM      | Free          | ~40KB       | No               |

## Decision

Use **Leaflet** (v1.9) with **react-leaflet** (v5) and **OpenStreetMap** tiles.

## Rationale

- **Zero cost at any scale** — OpenStreetMap tiles are free with no API key or
  usage quota. This avoids billing surprises and simplifies deployment (no
  environment secrets for map keys).
- **Smallest bundle** — Leaflet is ~40KB gzipped, roughly half of Google Maps and
  a fifth of Mapbox GL JS.
- **Sufficient functionality** — markers, popups, polylines, and auto-fit bounds
  cover all current requirements. We do not need 3D terrain, turn-by-turn
  directions, or vector tile styling.
- **React integration** — `react-leaflet` v5 provides idiomatic React components
  (`<MapContainer>`, `<Marker>`, `<Polyline>`) and hooks (`useMap`).
- **SSR handling** — Leaflet requires the `window` object. We use Next.js
  `dynamic(() => ..., { ssr: false })` to client-only render the map component.
  This is a well-documented pattern.

## Consequences

- Custom marker icons are built with inline SVG via `L.divIcon` to avoid the
  default Leaflet icon path issue in bundlers.
- Map tiles load from third-party CDN (`tile.openstreetmap.org`). If OSM tiles
  become slow or unavailable, we can swap to another free tile provider (e.g.
  Carto, Stamen) by changing one URL.
- No offline map support. Acceptable for a web-first travel planning tool.
