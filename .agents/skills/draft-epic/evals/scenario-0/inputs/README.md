# Epics Index

This file tracks all epics in the project. Update it when a new epic is created or its status changes.

## Epics

| EPIC # | Title | Status | PR | Strategic ADR |
|--------|-------|--------|----|---------------|
| EPIC-001 | API Gateway Migration | Done | #42 | ADR-001 |
| EPIC-002 | CI/CD Pipeline Overhaul | Done | #67 | ADR-003 |
| EPIC-003 | Search Indexing Revamp | In progress | #88 | ADR-005 |
| EPIC-004 | Notification Service Extraction | Draft | #102 | ADR-006 |

## Triggers

An epic should be drafted when:
- The work needs more than ~3 SPECs to deliver real user value
- Sequencing across SPECs matters
- Cross-cutting decisions should be settled once
- There's a meaningful chance of being killed or pivoted

## File naming

`EPIC-NNN-<slug>.md` — three-digit zero-padded number, lowercase hyphenated slug.
