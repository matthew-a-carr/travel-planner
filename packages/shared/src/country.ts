import { z } from 'zod';
import { currencySchema, moneySchema } from './trip';

export const countryReferenceSummarySchema = z.object({
  country: z.string().min(1),
  alpha2: z.string().length(2),
  alpha3: z.string().length(3),
  region: z.string().nullable(),
  subregion: z.string().nullable(),
  currency: currencySchema,
  suggestedDailyBudget: z.object({
    budget: moneySchema,
    mid: moneySchema,
    luxury: moneySchema,
  }),
});

export type CountryReferenceSummary = z.infer<typeof countryReferenceSummarySchema>;
