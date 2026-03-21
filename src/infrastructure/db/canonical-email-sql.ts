import { sql } from 'drizzle-orm';
import type { users } from './schema';

/**
 * SQL expression that canonicalises an email column for comparison.
 * Normalises Gmail addresses (removes dots, strips plus aliases,
 * unifies googlemail.com → gmail.com).
 *
 * Centralised here to avoid duplication across access-policy and
 * repository modules. Must stay in sync with normalizeEmail() in
 * access-policy.ts.
 */
export function canonicalEmailSql(column: typeof users.email) {
  return sql<string>`
    case
      when lower(trim(${column})) like '%@gmail.com' or lower(trim(${column})) like '%@googlemail.com'
        then replace(split_part(split_part(lower(trim(${column})), '@', 1), '+', 1), '.', '') || '@gmail.com'
      else lower(trim(${column}))
    end
  `;
}
