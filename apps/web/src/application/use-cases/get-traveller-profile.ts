import type { UserProfileRepository } from '@/domain/user-profile/user-profile-repository';
import type { TravellerProfile } from '@/domain/visa/types';

/**
 * Read the signed-in user's traveller profile (passports + date of birth).
 * Returns an empty profile when none has been saved yet.
 */
export async function getTravellerProfile(
  repo: UserProfileRepository,
  userId: string,
): Promise<TravellerProfile> {
  return repo.findByUserId(userId);
}
