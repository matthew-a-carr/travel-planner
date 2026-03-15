/**
 * City reference seed data.
 *
 * Cost multipliers are relative to the country's avgDailyCostPence.
 * A multiplier of 1.0 means the city matches the country average.
 *
 * Sources:
 *   - Manual data: curated from Numbeo, Budget Your Trip, and Expatistan
 *   - Estimated data: derived from population density and capital city premium models
 */
export const CITY_LIST_SEED: Array<{
  city: string;
  country: string;
  costMultiplier: number;
  source: 'manual' | 'estimated';
}> = [
  // ─── Asia ──────────────────────────────────────────────────────────────────
  { city: 'Tokyo', country: 'Japan', costMultiplier: 1.5, source: 'manual' },
  { city: 'Osaka', country: 'Japan', costMultiplier: 1.1, source: 'manual' },
  { city: 'Kyoto', country: 'Japan', costMultiplier: 1.2, source: 'manual' },
  { city: 'Bangkok', country: 'Thailand', costMultiplier: 1.3, source: 'manual' },
  { city: 'Chiang Mai', country: 'Thailand', costMultiplier: 0.7, source: 'manual' },
  { city: 'Phuket', country: 'Thailand', costMultiplier: 1.1, source: 'manual' },
  { city: 'Hanoi', country: 'Vietnam', costMultiplier: 1.1, source: 'manual' },
  { city: 'Ho Chi Minh City', country: 'Vietnam', costMultiplier: 1.2, source: 'manual' },
  { city: 'Singapore', country: 'Singapore', costMultiplier: 1.0, source: 'manual' },
  { city: 'Seoul', country: 'South Korea', costMultiplier: 1.3, source: 'manual' },
  { city: 'Busan', country: 'South Korea', costMultiplier: 0.9, source: 'estimated' },
  { city: 'Mumbai', country: 'India', costMultiplier: 1.4, source: 'manual' },
  { city: 'Delhi', country: 'India', costMultiplier: 1.2, source: 'manual' },
  { city: 'Goa', country: 'India', costMultiplier: 0.8, source: 'estimated' },
  { city: 'Bali', country: 'Indonesia', costMultiplier: 1.2, source: 'manual' },
  { city: 'Jakarta', country: 'Indonesia', costMultiplier: 1.3, source: 'estimated' },

  // ─── Europe ────────────────────────────────────────────────────────────────
  { city: 'London', country: 'United Kingdom', costMultiplier: 1.6, source: 'manual' },
  { city: 'Edinburgh', country: 'United Kingdom', costMultiplier: 1.2, source: 'manual' },
  { city: 'Manchester', country: 'United Kingdom', costMultiplier: 1.0, source: 'estimated' },
  { city: 'Paris', country: 'France', costMultiplier: 1.5, source: 'manual' },
  { city: 'Lyon', country: 'France', costMultiplier: 1.0, source: 'estimated' },
  { city: 'Nice', country: 'France', costMultiplier: 1.3, source: 'manual' },
  { city: 'Barcelona', country: 'Spain', costMultiplier: 1.3, source: 'manual' },
  { city: 'Madrid', country: 'Spain', costMultiplier: 1.2, source: 'manual' },
  { city: 'Seville', country: 'Spain', costMultiplier: 0.9, source: 'estimated' },
  { city: 'Rome', country: 'Italy', costMultiplier: 1.3, source: 'manual' },
  { city: 'Florence', country: 'Italy', costMultiplier: 1.4, source: 'manual' },
  { city: 'Naples', country: 'Italy', costMultiplier: 0.8, source: 'estimated' },
  { city: 'Berlin', country: 'Germany', costMultiplier: 1.1, source: 'manual' },
  { city: 'Munich', country: 'Germany', costMultiplier: 1.4, source: 'manual' },
  { city: 'Amsterdam', country: 'Netherlands', costMultiplier: 1.4, source: 'manual' },
  { city: 'Lisbon', country: 'Portugal', costMultiplier: 1.2, source: 'manual' },
  { city: 'Porto', country: 'Portugal', costMultiplier: 1.0, source: 'estimated' },
  { city: 'Prague', country: 'Czechia', costMultiplier: 1.2, source: 'manual' },
  { city: 'Budapest', country: 'Hungary', costMultiplier: 1.1, source: 'manual' },
  { city: 'Athens', country: 'Greece', costMultiplier: 1.2, source: 'manual' },
  { city: 'Santorini', country: 'Greece', costMultiplier: 1.6, source: 'manual' },
  { city: 'Istanbul', country: 'Türkiye', costMultiplier: 1.2, source: 'manual' },
  { city: 'Zurich', country: 'Switzerland', costMultiplier: 1.3, source: 'manual' },
  { city: 'Geneva', country: 'Switzerland', costMultiplier: 1.4, source: 'manual' },

  // ─── Americas ──────────────────────────────────────────────────────────────
  { city: 'New York', country: 'United States', costMultiplier: 1.6, source: 'manual' },
  { city: 'San Francisco', country: 'United States', costMultiplier: 1.5, source: 'manual' },
  { city: 'Los Angeles', country: 'United States', costMultiplier: 1.3, source: 'manual' },
  { city: 'Miami', country: 'United States', costMultiplier: 1.3, source: 'estimated' },
  { city: 'Mexico City', country: 'Mexico', costMultiplier: 1.2, source: 'manual' },
  { city: 'Cancún', country: 'Mexico', costMultiplier: 1.5, source: 'manual' },
  { city: 'Buenos Aires', country: 'Argentina', costMultiplier: 1.2, source: 'manual' },
  { city: 'Rio de Janeiro', country: 'Brazil', costMultiplier: 1.3, source: 'manual' },
  { city: 'São Paulo', country: 'Brazil', costMultiplier: 1.2, source: 'estimated' },
  { city: 'Lima', country: 'Peru', costMultiplier: 1.2, source: 'manual' },
  { city: 'Cusco', country: 'Peru', costMultiplier: 1.0, source: 'estimated' },
  { city: 'Bogotá', country: 'Colombia', costMultiplier: 1.1, source: 'manual' },
  { city: 'Medellín', country: 'Colombia', costMultiplier: 0.9, source: 'estimated' },

  // ─── Africa & Middle East ──────────────────────────────────────────────────
  { city: 'Cape Town', country: 'South Africa', costMultiplier: 1.2, source: 'manual' },
  { city: 'Johannesburg', country: 'South Africa', costMultiplier: 1.1, source: 'estimated' },
  { city: 'Marrakech', country: 'Morocco', costMultiplier: 1.1, source: 'manual' },
  { city: 'Cairo', country: 'Egypt', costMultiplier: 1.2, source: 'manual' },
  { city: 'Dubai', country: 'United Arab Emirates', costMultiplier: 1.3, source: 'manual' },
  { city: 'Nairobi', country: 'Kenya', costMultiplier: 1.2, source: 'estimated' },

  // ─── Oceania ───────────────────────────────────────────────────────────────
  { city: 'Sydney', country: 'Australia', costMultiplier: 1.3, source: 'manual' },
  { city: 'Melbourne', country: 'Australia', costMultiplier: 1.2, source: 'manual' },
  { city: 'Auckland', country: 'New Zealand', costMultiplier: 1.2, source: 'manual' },
  { city: 'Queenstown', country: 'New Zealand', costMultiplier: 1.4, source: 'manual' },
];
