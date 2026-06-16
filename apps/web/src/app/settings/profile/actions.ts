'use server';

import { revalidatePath } from 'next/cache';
import { updateTravellerProfile } from '@/application/use-cases/update-traveller-profile';
import { getAppContainer } from '@/infrastructure/container';
import { getAuthenticatedAccessContext } from '@/infrastructure/organization/active-organization';

export type ProfileFormState = {
  readonly error: string | null;
  readonly notice: string | null;
};

export async function updateTravellerProfileAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const context = await getAuthenticatedAccessContext();
  if (!context) return { error: 'You must be signed in.', notice: null };

  const rawDob = formData.get('dateOfBirth');
  const dateOfBirth = typeof rawDob === 'string' && rawDob.trim() !== '' ? rawDob : null;

  const nationalities = formData.getAll('passportNationality').map(String);
  const labels = formData.getAll('passportLabel').map(String);
  const passports = nationalities.map((nationality, index) => ({
    nationality,
    label: labels[index] ?? null,
  }));

  const { userProfileRepository } = getAppContainer();
  const result = await updateTravellerProfile(userProfileRepository, {
    userId: context.userId,
    dateOfBirth,
    passports,
    today: new Date().toISOString().slice(0, 10),
  });

  if (!result.ok) return { error: result.error, notice: null };

  console.info('traveller profile updated', { passportCount: result.value.passports.length });
  revalidatePath('/settings/profile');
  return { error: null, notice: 'Profile updated' };
}
