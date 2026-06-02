# Tech Debt Register

## Outstanding Items

| ID | Subsystem | Description |
|----|-----------|-------------|
| TD-009 | Inventory | Stock level updates are not atomic; race condition under high concurrency |
| TD-010 | User accounts | Password reset tokens are not rate-limited |
