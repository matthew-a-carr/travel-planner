import type { Result } from '@/domain/trip/types';
import { validateTravellerProfileInput } from '@/domain/user-profile/user-profile';
import type { UserProfileRepository } from '@/domain/user-profile/user-profile-repository';
import type { TravellerProfile } from '@/domain/visa/types';

export type UpdateTravellerProfileInput = {
  readonly userId: string;
  readonly dateOfBirth: string | null;
  readonly passports: readonly { readonly nationality: string; readonly label: string | null }[];
  /** Injected ISO `YYYY-MM-DD` for the deterministic future-date check. */
  readonly today: string;
};

/**
 * Validate raw profile input and persist it for the user. Returns the
 * normalised profile on success, or a validation error message.
 */
export async function updateTravellerProfile(
  repo: UserProfileRepository,
  input: UpdateTravellerProfileInput,
): Promise<Result<TravellerProfile>> {
  const validated = validateTravellerProfileInput(
    { dateOfBirth: input.dateOfBirth, passports: input.passports },
    input.today,
  );
  if (!validated.ok) return validated;

  await repo.save(input.userId, validated.value);
  return validated;
}
