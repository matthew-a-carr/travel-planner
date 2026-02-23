-- Travel Planner — initial schema migration
-- Replaces the old single ringfenced_amount / ringfenced_label columns on trips
-- with a proper trip_fixed_costs table (see ADR 005).

-- ─── Auth.js tables ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "users" (
  "id"             text PRIMARY KEY,
  "name"           text,
  "email"          text NOT NULL UNIQUE,
  "email_verified" timestamp,
  "image"          text,
  "created_at"     timestamp NOT NULL DEFAULT NOW(),
  "updated_at"     timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "accounts" (
  "user_id"            text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type"               text NOT NULL,
  "provider"           text NOT NULL,
  "provider_account_id" text NOT NULL,
  "refresh_token"      text,
  "access_token"       text,
  "expires_at"         integer,
  "token_type"         text,
  "scope"              text,
  "id_token"           text,
  "session_state"      text,
  PRIMARY KEY ("provider", "provider_account_id")
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "session_token" text PRIMARY KEY,
  "user_id"       text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "expires"       timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification_tokens" (
  "identifier" text NOT NULL,
  "token"      text NOT NULL,
  "expires"    timestamp NOT NULL,
  PRIMARY KEY ("identifier", "token")
);

-- ─── Application tables ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "trips" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"                 text NOT NULL,
  "total_budget_amount"  integer NOT NULL,
  "total_budget_currency" text NOT NULL DEFAULT 'GBP',
  "status"               text NOT NULL DEFAULT 'planning',
  "owner_id"             text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at"           timestamp NOT NULL DEFAULT NOW(),
  "updated_at"           timestamp NOT NULL DEFAULT NOW()
);

-- Named fixed costs deducted from trip budget before destination allocations.
-- Replaces the old ringfenced_amount + ringfenced_label columns.
CREATE TABLE IF NOT EXISTS "trip_fixed_costs" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "trip_id"      uuid NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
  "label"        text NOT NULL,
  "amount_pence" integer NOT NULL,
  "currency"     text NOT NULL DEFAULT 'GBP',
  "sort_order"   integer NOT NULL DEFAULT 0,
  "created_at"   timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "destinations" (
  "id"                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "trip_id"                  uuid NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
  "name"                     text NOT NULL,
  "country"                  text NOT NULL,
  "estimated_budget_amount"  integer NOT NULL,
  "estimated_budget_currency" text NOT NULL DEFAULT 'GBP',
  "comfort_level"            text NOT NULL,
  "start_date"               date,
  "end_date"                 date,
  "sort_order"               integer NOT NULL DEFAULT 0,
  "created_at"               timestamp NOT NULL DEFAULT NOW(),
  "updated_at"               timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "spend_entries" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "destination_id" uuid NOT NULL REFERENCES "destinations"("id") ON DELETE CASCADE,
  "amount"         integer NOT NULL,
  "currency"       text NOT NULL DEFAULT 'GBP',
  "category"       text NOT NULL,
  "description"    text,
  "spent_at"       date NOT NULL,
  "created_at"     timestamp NOT NULL DEFAULT NOW()
);

-- Reference data for budget suggestions (see ADR 004).
CREATE TABLE IF NOT EXISTS "country_reference_data" (
  "country"              text PRIMARY KEY,
  "avg_daily_cost_pence" integer NOT NULL,
  "currency"             text NOT NULL DEFAULT 'GBP',
  "source"               text NOT NULL DEFAULT 'manual',
  "updated_at"           timestamp NOT NULL DEFAULT NOW()
);
