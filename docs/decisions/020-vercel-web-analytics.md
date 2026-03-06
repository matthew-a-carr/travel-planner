# ADR 020: Vercel Web Analytics Integration

**Date:** 2026-03-06
**Status:** Accepted

## Context

We need lightweight page-view analytics for production and preview deployments
without building a custom event pipeline. The app is already hosted on Vercel
and uses the Next.js App Router, so we need an integration that is minimal to
add and operationally low-maintenance.

## Decision

Adopt Vercel Web Analytics by adding `@vercel/analytics` and rendering
`<Analytics />` from `@vercel/analytics/next` in the root
`src/app/layout.tsx`.

## Consequences

- Page views and visitor analytics are captured automatically in Vercel
  environments once deployed.
- Integration overhead remains low (single dependency and one root layout
  component).
- Analytics data collection is coupled to Vercel's analytics product and
  reporting model.
