# SPEC-057: User Notification Preferences

## §1 Summary

Allow users to configure their email notification preferences (e.g., booking confirmations, promotional emails).

## §2 Background

Users have requested control over which emails they receive. Currently all emails are sent unconditionally.

## §3 Acceptance Criteria

- AC-1: Users can enable or disable each notification category independently
- AC-2: Preference changes are persisted immediately
- AC-3: The preferences API endpoint returns the current preferences for the authenticated user
- AC-4: Default preferences are all-enabled for new users

## §5 Out of Scope

- Sending actual emails (handled by a later SPEC)
- Push notifications

## §9 Tests

- Unit tests for the NotificationPreferences domain entity
- Integration tests for the repository against real Postgres
- E2E tests for the preferences API endpoint

## §12 Implementation Order

1. Add `NotificationPreferences` domain entity
2. Add `NotificationPreferencesRepository` interface in domain layer
3. Add `DrizzleNotificationPreferencesRepository` in infrastructure layer
4. Add `UpdateNotificationPreferencesUseCase` in application layer
5. Wire up DI in `create-app-container.ts`
6. Add `/api/v1/notifications/preferences` GET and PATCH endpoints
