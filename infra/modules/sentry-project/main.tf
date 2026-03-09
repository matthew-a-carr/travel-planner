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

# ── Metric Alert ──────────────────────────────────────────────────────────────

# Metric alert: sustained error count threshold (50 errors in 5 minutes).
# Note: environment scoping is done via query rather than the environment
# attribute because Sentry environments are auto-created on first event
# and may not exist when the project is first provisioned.
resource "sentry_metric_alert" "error_count" {
  organization      = var.organization
  project           = sentry_project.this.slug
  name              = "Error count critical threshold - ${var.alert_environment}"
  dataset           = "events"
  aggregate         = "count()"
  query             = "environment:${var.alert_environment}"
  time_window       = 5
  threshold_type    = 0
  resolve_threshold = 5

  trigger {
    action {
      type        = "email"
      target_type = "team"
    }
    alert_threshold = 50
    label           = "critical"
    threshold_type  = 0
  }

  trigger {
    action {
      type        = "email"
      target_type = "team"
    }
    alert_threshold = 20
    label           = "warning"
    threshold_type  = 0
  }
}

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
