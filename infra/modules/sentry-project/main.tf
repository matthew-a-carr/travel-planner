resource "sentry_project" "this" {
  organization  = var.organization
  teams         = [var.team]
  name          = var.project_name
  slug          = var.project_slug
  platform      = "javascript-nextjs"
  default_rules = false
  default_key   = true
}

# Retrieve the auto-created default client key to read the public DSN.
data "sentry_key" "default" {
  organization = var.organization
  project      = sentry_project.this.slug
  first        = true
}

# ── Issue Alerts ──────────────────────────────────────────────────────────────

# Alert: new issue seen for the first time in production.
resource "sentry_issue_alert" "new_issue" {
  organization = var.organization
  project      = sentry_project.this.slug
  name         = "New issue in ${var.alert_environment}"

  action_match = "all"
  filter_match = "all"
  frequency    = 1440 # deduplicate per day

  conditions_v2 = [
    { first_seen_event = {} },
  ]

  filters_v2 = [
    {
      tagged_event = {
        key   = "environment"
        match = "EQUAL"
        value = var.alert_environment
      }
    },
  ]

  actions_v2 = [
    {
      notify_email = {
        target_type      = var.alert_notify_target_type
        fallthrough_type = "ActiveMembers"
      }
    },
  ]
}

# Alert: a previously resolved issue has regressed in production.
resource "sentry_issue_alert" "regression" {
  organization = var.organization
  project      = sentry_project.this.slug
  name         = "Regression in ${var.alert_environment}"

  action_match = "all"
  filter_match = "all"
  frequency    = 60

  conditions_v2 = [
    { regression_event = {} },
  ]

  filters_v2 = [
    {
      tagged_event = {
        key   = "environment"
        match = "EQUAL"
        value = var.alert_environment
      }
    },
  ]

  actions_v2 = [
    {
      notify_email = {
        target_type      = var.alert_notify_target_type
        fallthrough_type = "ActiveMembers"
      }
    },
  ]
}

# Alert: a previously ignored issue has reappeared in production.
resource "sentry_issue_alert" "reappeared" {
  organization = var.organization
  project      = sentry_project.this.slug
  name         = "Issue reappeared in ${var.alert_environment}"

  action_match = "all"
  filter_match = "all"
  frequency    = 60

  conditions_v2 = [
    { reappeared_event = {} },
  ]

  filters_v2 = [
    {
      tagged_event = {
        key   = "environment"
        match = "EQUAL"
        value = var.alert_environment
      }
    },
  ]

  actions_v2 = [
    {
      notify_email = {
        target_type      = var.alert_notify_target_type
        fallthrough_type = "ActiveMembers"
      }
    },
  ]
}

# Alert: high error volume — more than 10 events in a 5-minute window.
resource "sentry_issue_alert" "high_error_rate" {
  organization = var.organization
  project      = sentry_project.this.slug
  name         = "High error rate in ${var.alert_environment} (>10 events / 5 min)"

  action_match = "all"
  filter_match = "all"
  frequency    = 60

  conditions_v2 = [
    {
      event_frequency = {
        comparison_type = "count"
        value           = 10
        interval        = "5m"
      }
    },
  ]

  filters_v2 = [
    {
      tagged_event = {
        key   = "environment"
        match = "EQUAL"
        value = var.alert_environment
      }
    },
  ]

  actions_v2 = [
    {
      notify_email = {
        target_type      = var.alert_notify_target_type
        fallthrough_type = "ActiveMembers"
      }
    },
  ]
}

# ── Metric Alert (manual for now) ─────────────────────────────────────────────
#
# The sentry_metric_alert resource requires a team internal_id as the
# target_identifier on trigger actions, which is not easily obtained from
# this module. The four issue alerts above (including high_error_rate)
# already cover the key error monitoring scenarios.
#
# To add a metric-based alert, create it in Sentry → Alerts → Metric Alert:
#   - Aggregate: count()
#   - Dataset: events
#   - Query: environment:production
#   - Thresholds: warning 20, critical 50 in 5 min

# ── Gaps: not yet supported by jianyuan/sentry provider ──────────────────────
#
# The following Sentry features must be configured manually in the Sentry UI
# until provider support is added:
#
#   • Uptime monitors  — create in Sentry → Alerts → Uptime.
#     Target URL: https://travel.matthewcarr.dev
#     Check interval: 1 minute
#     See docs/operations/sentry.md for setup instructions.
#
#   • Dashboards — create a production error trend dashboard in
#     Sentry → Dashboards. Save the share URL in docs/operations/sentry.md.
