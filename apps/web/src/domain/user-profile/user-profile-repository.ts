import type { TravellerProfile } from '../visa/types';

/**
 * Read/write the signed-in user's traveller profile (passports + date of
 * birth). Implementation in `infrastructure/db/repositories/`. The profile is
 * PII — callers must only ever pass the authenticated user's own id.
 */
export interface UserProfileRepository {
  /** Returns the user's profile, or an empty profile (`[]` / `null`) if none. */
  findByUserId(userId: string): Promise<TravellerProfile>;

  /** Replaces the user's stored passports and date of birth. */
  save(userId: string, profile: TravellerProfile): Promise<void>;
}
