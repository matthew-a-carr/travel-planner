import type { Result } from '../trip/types';
import { err, ok } from '../trip/types';
import type { Passport, TravellerProfile } from '../visa/types';

/** Raw, untrusted profile input (e.g. from a form). */
export type TravellerProfileInput = {
  readonly dateOfBirth: string | null;
  readonly passports: readonly { readonly nationality: string; readonly label: string | null }[];
};

const ALPHA3 = /^[A-Z]{3}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function normaliseLabel(label: string | null): string | null {
  if (label === null) return null;
  const trimmed = label.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Validate and normalise raw traveller-profile input into a `TravellerProfile`.
 * Pure: `today` (ISO `YYYY-MM-DD`) is injected so the future-date check is
 * deterministic. Nationalities are upper-cased and validated as ISO alpha-3;
 * duplicate nationalities are removed (first wins, order preserved). An empty
 * passport list and a null date of birth are both valid.
 */
export function validateTravellerProfileInput(
  input: TravellerProfileInput,
  today: string,
): Result<TravellerProfile> {
  // Date of birth.
  let dateOfBirth: string | null = null;
  if (input.dateOfBirth !== null && input.dateOfBirth.trim() !== '') {
    const dob = input.dateOfBirth.trim();
    if (!ISO_DATE.test(dob)) return err('Date of birth must be a valid date (YYYY-MM-DD).');
    const [y, m, d] = dob.split('-').map(Number);
    const parsed = new Date(Date.UTC(y, m - 1, d));
    const roundTrips =
      parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d;
    if (!roundTrips) return err('Date of birth is not a real calendar date.');
    if (y < 1900) return err('Date of birth year is out of range.');
    if (dob > today) return err('Date of birth cannot be in the future.');
    dateOfBirth = dob;
  }

  // Passports.
  const seen = new Set<string>();
  const passports: Passport[] = [];
  for (const raw of input.passports) {
    const nationality = raw.nationality.trim().toUpperCase();
    if (nationality === '') continue; // empty row — ignore
    if (!ALPHA3.test(nationality)) {
      return err(`"${raw.nationality}" is not a valid nationality.`);
    }
    if (seen.has(nationality)) continue; // dedupe — first wins
    seen.add(nationality);
    passports.push({ nationality, label: normaliseLabel(raw.label) });
  }

  return ok({ passports, dateOfBirth });
}
