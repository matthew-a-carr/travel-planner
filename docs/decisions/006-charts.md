# ADR 006: Charts — Recharts for Trip Budget Visualisation

**Date:** 2026-02-23
**Status:** Accepted

## Context

The trip detail page shows budget and spend data as text rows and progress bars. As destinations
and spend entries accumulate, the proportional relationships between them become harder to read.
Charts give an at-a-glance view that text rows cannot.

## Decision

### Library: Recharts

[Recharts](https://recharts.org) is chosen over alternatives:

| Library         | Reason not chosen |
|-----------------|-------------------|
| Chart.js        | Imperative API, awkward with React Server Components |
| Visx (D3-based) | Significantly higher complexity, no built-in components |
| Tremor          | Opinionated design system, heavier bundle |

Recharts is a declarative React component library with first-class TypeScript support,
`ResponsiveContainer` for fluid sizing, and good React 19 compatibility.

### Charts implemented (v1)

Three charts, rendered in a `ChartsSection` below the budget overview card:

| Chart | Type | Data source | Render condition |
|---|---|---|---|
| Budget breakdown | Horizontal stacked bar | Trip total / fixed costs / allocated / available | Always |
| Estimated vs actual | Grouped vertical bar | Per-destination budget + spend | At least 1 destination |
| Spend by category | Donut (pie) | All spend entries, grouped by category | At least 1 spend entry |

**Spend-over-time** (line chart) is deferred — it requires destinations to have dates set and the
data becomes meaningful only mid-trip.

### Placement

`ChartsSection` is a `'use client'` component inserted between `BudgetOverviewCard` and
`DestinationSection` on the trip detail page. It receives pre-serialised data arrays as props
from the server component — no client-side data fetching.

### Data shape passed as props (server → client)

```typescript
// Budget breakdown
{ label: string; amountPence: number; fill: string }[]

// Estimated vs actual
{ name: string; estimated: number; actual: number }[]  // amounts in pence

// Spend by category
{ category: string; amountPence: number }[]
```

All values in integer pence; formatting (`formatMoney`) applied inside chart components.

## Consequences

- Recharts adds ~140 kB gzipped to the client bundle. Acceptable for an authenticated
  planning tool where load time is not the primary concern.
- All chart data is computed server-side and passed as serialisable props, preserving the
  Server Component architecture for the page.
- Charts are rendered only when there is relevant data — empty states avoid confusing empty axes.
