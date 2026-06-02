# SPEC-042: Real-Time Notification Service

## §1 Problem Statement

Users miss important workflow events because the current email-only notification system has a multi-hour delivery delay. The business needs a real-time push notification layer that integrates with the existing event bus.

## §2 Goals

- Deliver in-app and push notifications within 500ms of an event
- Support per-user subscription preferences
- Integrate with the existing `event-bus` service

## §3 Non-Goals (§6)

- Email notifications (handled by existing service)
- Notification templates (covered by EPIC-011)
- Analytics dashboard for notification delivery

## §4 Acceptance Criteria

- A `NotificationService` class exposes `subscribe(userId, eventTypes)` and `dispatch(event)`
- Delivery latency p99 < 500ms under 10k concurrent users
- Preferences stored in `user_preferences` table, schema in §7

## §5 Design

The service will use WebSockets for browser clients and APNs/FCM for mobile. An internal queue buffers events during transient failures.

## §6 Non-Goals

See §3.

## §7 Data Schema

```sql
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY,
  event_types JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## §8 Open Questions

1. **Queue implementation**: Use Redis Streams or Kafka?
   - Alternative: In-memory queue (simpler, no infra).
   - Cost of being wrong: Redis adds ops overhead; in-memory loses events on restart.

2. **Mobile SDK ownership**: Does the mobile team own the APNs/FCM integration?
   - Alternative: Shared library owned by platform team.
   - Cost of being wrong: Duplicated push logic, diverging credentials management.

## §9 Risks

- APNs rate limits may throttle bulk notifications during peak usage.
- WebSocket connection count may require horizontal scaling of the notification nodes.

## §10 Cross-Cutting Decisions

N/A — this is a spec, not an epic.
