# SPEC-017: Full-Text Search Integration

## §1 Problem Statement

The product's current search is limited to exact-match queries on indexed fields. Users frequently report missing results when searching with synonyms or partial terms. We need full-text search with relevance ranking.

## §2 Goals

- Support fuzzy and stemmed queries across document titles and body content
- Return results ranked by relevance score
- Integrate with the existing `documents` PostgreSQL table

## §3 Non-Goals (§6)

- Vector / semantic search (covered by EPIC-019)
- Search analytics and query logging
- Multi-language stemming beyond English

## §4 Acceptance Criteria

- `SearchService.query(term, filters)` returns results within 200ms at p95 for datasets up to 1M documents
- Results include a `relevance_score` field normalised to [0, 1]
- Index updates are asynchronous and complete within 30s of document mutation

## §5 Design

Use PostgreSQL `tsvector`/`tsquery` for initial implementation. A dedicated `search_index` table caches pre-computed tsvectors. The existing `documents` table is not modified.

## §6 Non-Goals

See §3.

## §7 Open Questions

1. **Index update trigger**: Use PostgreSQL triggers vs. an application-level event?
   - Alternative: Batch reindex job (simpler, eventual consistency only).
   - Cost of being wrong: Triggers add DB complexity; app-level events need reliable messaging.

2. **Ranking algorithm**: Rely on `ts_rank` or implement custom BM25?
   - Alternative: Defer ranking to Elasticsearch (major infra change).
   - Cost of being wrong: `ts_rank` is limited; BM25 requires custom implementation effort.

## §8 Risks

- PostgreSQL full-text search may not scale beyond 10M documents without Elasticsearch.
- Async index updates create a window of stale results after document mutations.
