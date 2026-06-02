# Tech Debt Register

## Outstanding Items

| ID | Title | Severity | Owner | Spec | Opened |
|----|-------|----------|-------|------|--------|
| TD-001 | API client uses deprecated `requests` sync calls instead of async `httpx` | High | backend-team | SPEC-010-api-client | 2024-01-15 |
| TD-002 | User profile page lacks input sanitisation on bio field | Medium | frontend-team | SPEC-022-user-profile | 2024-02-03 |
| TD-003 | CSV export hard-codes UTF-8 without BOM; causes Excel issues on Windows | Low | backend-team | SPEC-031-data-export | 2023-11-20 |
| TD-004 | Search indexer re-indexes entire corpus on every deploy | High | platform-team | SPEC-045-search | 2024-03-01 |
| TD-005 | Payment gateway timeout is hard-coded to 5 s; should be configurable | Medium | payments-team | SPEC-058-checkout | 2024-04-10 |

## Resolved Items

| ID | Title | Resolution | Date |
|----|-------|-----------|------|
| TD-000 | Legacy auth cookie not HttpOnly | Resolved: cookie flags updated in SPEC-007 | 2024-01-02 |
