CREATE TABLE IF NOT EXISTS "city_reference_data" (
  "city" text NOT NULL,
  "country" text NOT NULL REFERENCES "country_reference_data"("country") ON DELETE CASCADE,
  "cost_multiplier" double precision NOT NULL DEFAULT 1.0,
  "source" text NOT NULL DEFAULT 'estimated',
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "city_reference_data_city_country_pk" PRIMARY KEY ("city", "country")
);
