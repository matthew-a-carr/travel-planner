/**
 * Resolves the destination name from form input. The user-typed name wins; if it
 * is blank, fall back to the city, then the country. Caller guarantees country
 * is non-empty (the country field is required in the form).
 */
export function resolveDestinationName(
  rawName: string,
  rawCity: string | null,
  country: string,
): string {
  const name = rawName.trim();
  if (name) return name;
  const city = rawCity?.trim();
  if (city) return city;
  return country.trim();
}
