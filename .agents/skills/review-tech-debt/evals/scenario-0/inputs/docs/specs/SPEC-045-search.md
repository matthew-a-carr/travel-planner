# SPEC-045: Search Indexer

## Status: Implemented with deviation

## Summary
Introduce full-text search across the content corpus using Elasticsearch.

## Deviation
Incremental indexing was descoped to meet the launch date. The indexer currently drops and rebuilds the entire index on each deployment, causing 2-3 minute search downtime.

## Acceptance Criteria
- Full-text search returns results in < 200ms (p95)
- Index updated within 60 s of content change
- Zero-downtime index rebuilds
