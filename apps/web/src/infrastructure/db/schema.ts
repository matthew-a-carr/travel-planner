import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// ─── Auth.js tables ───────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  email: text('email').notNull().unique(),
  isApproved: boolean('is_approved').notNull().default(false),
  isAdmin: boolean('is_admin').notNull().default(false),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  // Drives age-based visa eligibility (SPEC-015). PII — read only for the
  // signed-in user; never logged or sent to AI prompts. Date-only.
  dateOfBirth: date('date_of_birth'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })],
);

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// ─── Application tables ───────────────────────────────────────────────────────

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdByUserId: text('created_by_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const organizationMemberships = pgTable(
  'organization_memberships',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (membership) => [primaryKey({ columns: [membership.organizationId, membership.userId] })],
);

export const trips = pgTable(
  'trips',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    totalBudgetAmount: integer('total_budget_amount').notNull(),
    totalBudgetCurrency: text('total_budget_currency').notNull().default('GBP'),
    status: text('status').notNull().default('planning'),
    intent: text('intent').notNull().default('tourism'), // TripIntent — drives visa-rule selection (SPEC-018)
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_trips_organization_id').on(t.organizationId)],
);

export const tripFixedCosts = pgTable(
  'trip_fixed_costs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    label: text('label').notNull(), // e.g. "Flights to Asia", "Phone (£40/mo × 6)"
    amountPence: integer('amount_pence').notNull(),
    currency: text('currency').notNull().default('GBP'),
    category: text('category').notNull().default('other'),
    date: date('date').notNull().defaultNow(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_trip_fixed_costs_trip_id').on(t.tripId)],
);

export const destinations = pgTable(
  'destinations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    country: text('country').notNull(),
    city: text('city'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    estimatedBudgetAmount: integer('estimated_budget_amount').notNull(),
    estimatedBudgetCurrency: text('estimated_budget_currency').notNull().default('GBP'),
    comfortLevel: text('comfort_level').notNull(),
    startDate: date('start_date'),
    endDate: date('end_date'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('idx_destinations_trip_id').on(t.tripId)],
);

export const spendEntries = pgTable(
  'spend_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    destinationId: uuid('destination_id')
      .notNull()
      .references(() => destinations.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    currency: text('currency').notNull().default('GBP'),
    category: text('category').notNull(),
    description: text('description'),
    spentAt: date('spent_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_spend_entries_destination_id').on(t.destinationId)],
);

export const countryReferenceData = pgTable('country_reference_data', {
  country: text('country').primaryKey(), // canonical display name, e.g. "Japan"
  alpha2: text('alpha2').notNull().unique(), // ISO 3166-1 alpha-2, e.g. "JP"
  alpha3: text('alpha3').notNull().unique(), // ISO 3166-1 alpha-3, e.g. "JPN"
  region: text('region'), // e.g. "Asia", "Americas"
  subregion: text('subregion'), // e.g. "South-Eastern Asia"
  avgDailyCostPence: integer('avg_daily_cost_pence').notNull(), // mid-range GBP pence
  currency: text('currency').notNull().default('GBP'),
  source: text('source').notNull().default('manual'), // 'manual' | 'estimated'
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── AI cache ─────────────────────────────────────────────────────────────────

/**
 * Persistent cache for AI-generated outputs (itinerary parses and timeline
 * insights). Keyed by SHA-256 of (kind + canonicalised input). Rows older
 * than `expires_at` should be ignored at read time and may be vacuumed by
 * a future maintenance job.
 */
export const aiCache = pgTable(
  'ai_cache',
  {
    hash: text('hash').primaryKey(),
    kind: text('kind').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
  },
  (t) => [index('idx_ai_cache_expires_at').on(t.expiresAt)],
);

// ─── Chat assistant ───────────────────────────────────────────────────────────

/**
 * One thread per (trip, user). The unique index doubles as the lookup key
 * for `findOrCreateThread` and prevents duplicate threads under concurrent
 * first-message races.
 */
export const chatThreads = pgTable(
  'chat_threads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('uq_chat_threads_trip_user').on(t.tripId, t.userId)],
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => chatThreads.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // 'user' | 'assistant' | 'system'
    parts: jsonb('parts').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_chat_messages_thread_created').on(t.threadId, t.createdAt)],
);

// ─── Mobile auth (SPEC-004) ───────────────────────────────────────────────────

/**
 * `state` + `code_challenge` stash between `POST /auth/mobile/start` and
 * `GET /auth/mobile/callback`. Single-use, 120s TTL, opportunistic GC.
 * See SPEC-004 §7 and ADR 051 §3.
 */
export const mobileAuthStates = pgTable(
  'mobile_auth_states',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    state: text('state').notNull().unique(),
    codeChallenge: text('code_challenge').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
  },
  (t) => [index('idx_mobile_auth_states_expires_at').on(t.expiresAt)],
);

/**
 * One-time exchange code minted in `/callback`, redeemed in `/exchange`.
 * `code_hash` is sha256(cleartext); cleartext is given to the client once
 * and never logged. PKCE binding is held in `code_challenge`. 120s TTL.
 * See SPEC-004 §7 and ADR 051 §3.
 */
export const mobileAuthExchangeCodes = pgTable(
  'mobile_auth_exchange_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    codeHash: text('code_hash').notNull().unique(),
    codeChallenge: text('code_challenge').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_mobile_auth_exchange_codes_expires_at').on(t.expiresAt),
    index('idx_mobile_auth_exchange_codes_user_id').on(t.userId),
  ],
);

/**
 * Rotating refresh tokens with reuse detection per ADR 051 §2. `token_hash`
 * is sha256(cleartext). Rotation sets `replaced_by_id` on the old row;
 * presenting a token whose row already has `replaced_by_id` populated
 * triggers chain revocation (walk `replaced_by_id` forward, set
 * `revoked_at` on every link). 30d sliding TTL.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    replacedById: uuid('replaced_by_id').references((): AnyPgColumn => refreshTokens.id),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_refresh_tokens_user_id').on(t.userId),
    index('idx_refresh_tokens_user_active')
      .on(t.userId)
      .where(sql`revoked_at IS NULL AND replaced_by_id IS NULL`),
  ],
);

/**
 * Postgres sliding-window rate limit for `/api/v1/auth/mobile/*` per
 * SPEC-004 §3 + ADR 054. One row per request. Sliding window count is
 * `SELECT COUNT(*) WHERE key = $1 AND occurred_at > now() - $window`.
 * Opportunistic GC: delete rows older than 1h for the same key on each
 * insert.
 */
export const authRateLimitAttempts = pgTable(
  'auth_rate_limit_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull(),
    endpoint: text('endpoint').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('idx_auth_rate_limit_attempts_key_time').on(t.key, t.occurredAt)],
);

// ─── Visa requirements (SPEC-015) ─────────────────────────────────────────────

/**
 * A traveller's passports. Visa rules differ per passport; assessment evaluates
 * every passport and auto-selects the most favourable per destination. First
 * pass seeds only GBR. Junction pattern mirrors `organization_memberships`.
 */
export const userPassports = pgTable(
  'user_passports',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    nationality: text('nationality').notNull(), // ISO 3166-1 alpha-3, e.g. "GBR"
    label: text('label'), // optional display label ("UK passport")
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.nationality] })],
);

/**
 * A visa zone — a group of countries that share one allowance (e.g. the
 * Schengen Area's "90 days in any 180"). The zone owns the shared rolling
 * window; member countries are listed in `visa_zone_membership`.
 */
export const visaZones = pgTable('visa_zones', {
  code: text('code').primaryKey(), // e.g. "SCHENGEN"
  name: text('name').notNull(),
  rollingAllowanceDays: integer('rolling_allowance_days'), // e.g. 90
  rollingWindowDays: integer('rolling_window_days'), // e.g. 180
  notes: text('notes'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const visaZoneMembership = pgTable(
  'visa_zone_membership',
  {
    zoneCode: text('zone_code')
      .notNull()
      .references(() => visaZones.code, { onDelete: 'cascade' }),
    alpha3: text('alpha3').notNull(), // ISO 3166-1 alpha-3 member country
  },
  (t) => [primaryKey({ columns: [t.zoneCode, t.alpha3] })],
);

/**
 * The frozen, temporal visa-rule reference data (SPEC-015). One row per
 * (nationality, destination, purpose, valid_from). Selected at assessment time
 * by intersecting the trip's travel window with [valid_from, valid_to].
 * `source: 'ai-extracted'` rows are human-reviewed in the seed PR diff before
 * a reviewer may promote them to 'manual'.
 */
export const visaRules = pgTable(
  'visa_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nationality: text('nationality').notNull(), // traveller passport alpha-3
    destination: text('destination').notNull(), // destination country alpha-3
    zoneCode: text('zone_code'), // null, or e.g. "SCHENGEN"

    purpose: text('purpose').notNull().default('tourism'), // VisaPurpose
    workRights: boolean('work_rights').notNull().default(false),
    minAgeYears: integer('min_age_years'),
    maxAgeYears: integer('max_age_years'),
    eligibilityNotes: text('eligibility_notes'),

    category: text('category').notNull(), // VisaCategory
    maxStayDays: integer('max_stay_days'),
    visaValidityDays: integer('visa_validity_days'),
    entryType: text('entry_type').notNull().default('single'), // 'single' | 'multiple'
    minDaysOutBeforeReturn: integer('min_days_out_before_return'),
    // Rolling window flattened to two nullable ints (both-or-neither).
    rollingAllowanceDays: integer('rolling_allowance_days'),
    rollingWindowDays: integer('rolling_window_days'),

    otherRequirements: jsonb('other_requirements').notNull().default(sql`'[]'::jsonb`),

    validFrom: date('valid_from').notNull(),
    validTo: date('valid_to'), // null = open-ended

    source: text('source').notNull().default('ai-extracted'), // 'ai-extracted' | 'manual'
    sourceNote: text('source_note'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_visa_rules_nat_dest').on(t.nationality, t.destination),
    index('idx_visa_rules_zone').on(t.zoneCode),
    uniqueIndex('uq_visa_rules_nat_dest_purpose_from').on(
      t.nationality,
      t.destination,
      t.purpose,
      t.validFrom,
    ),
  ],
);
