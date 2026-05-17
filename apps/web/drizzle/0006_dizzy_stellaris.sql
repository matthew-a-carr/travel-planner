-- Step 1: Add new columns as nullable
ALTER TABLE "country_reference_data" ADD COLUMN "alpha2" text;
ALTER TABLE "country_reference_data" ADD COLUMN "alpha3" text;
ALTER TABLE "country_reference_data" ADD COLUMN "region" text;
ALTER TABLE "country_reference_data" ADD COLUMN "subregion" text;

-- Step 2: Backfill existing 33 countries with ISO codes and regions
UPDATE "country_reference_data" SET alpha2 = 'JP', alpha3 = 'JPN', region = 'Asia', subregion = 'Eastern Asia' WHERE country = 'Japan';
UPDATE "country_reference_data" SET alpha2 = 'KR', alpha3 = 'KOR', region = 'Asia', subregion = 'Eastern Asia' WHERE country = 'South Korea';
UPDATE "country_reference_data" SET alpha2 = 'CN', alpha3 = 'CHN', region = 'Asia', subregion = 'Eastern Asia' WHERE country = 'China';
UPDATE "country_reference_data" SET alpha2 = 'TH', alpha3 = 'THA', region = 'Asia', subregion = 'South-Eastern Asia' WHERE country = 'Thailand';
UPDATE "country_reference_data" SET alpha2 = 'VN', alpha3 = 'VNM', region = 'Asia', subregion = 'South-Eastern Asia' WHERE country = 'Vietnam';
UPDATE "country_reference_data" SET alpha2 = 'KH', alpha3 = 'KHM', region = 'Asia', subregion = 'South-Eastern Asia' WHERE country = 'Cambodia';
UPDATE "country_reference_data" SET alpha2 = 'LA', alpha3 = 'LAO', region = 'Asia', subregion = 'South-Eastern Asia' WHERE country = 'Laos';
UPDATE "country_reference_data" SET alpha2 = 'ID', alpha3 = 'IDN', region = 'Asia', subregion = 'South-Eastern Asia' WHERE country = 'Indonesia';
UPDATE "country_reference_data" SET alpha2 = 'PH', alpha3 = 'PHL', region = 'Asia', subregion = 'South-Eastern Asia' WHERE country = 'Philippines';
UPDATE "country_reference_data" SET alpha2 = 'MY', alpha3 = 'MYS', region = 'Asia', subregion = 'South-Eastern Asia' WHERE country = 'Malaysia';
UPDATE "country_reference_data" SET alpha2 = 'SG', alpha3 = 'SGP', region = 'Asia', subregion = 'South-Eastern Asia' WHERE country = 'Singapore';
UPDATE "country_reference_data" SET alpha2 = 'IN', alpha3 = 'IND', region = 'Asia', subregion = 'Southern Asia' WHERE country = 'India';
UPDATE "country_reference_data" SET alpha2 = 'NP', alpha3 = 'NPL', region = 'Asia', subregion = 'Southern Asia' WHERE country = 'Nepal';
UPDATE "country_reference_data" SET alpha2 = 'LK', alpha3 = 'LKA', region = 'Asia', subregion = 'Southern Asia' WHERE country = 'Sri Lanka';
UPDATE "country_reference_data" SET alpha2 = 'TR', alpha3 = 'TUR', region = 'Asia', subregion = 'Western Asia' WHERE country = 'Turkey';
UPDATE "country_reference_data" SET alpha2 = 'JO', alpha3 = 'JOR', region = 'Asia', subregion = 'Western Asia' WHERE country = 'Jordan';
UPDATE "country_reference_data" SET alpha2 = 'MA', alpha3 = 'MAR', region = 'Africa', subregion = 'Northern Africa' WHERE country = 'Morocco';
UPDATE "country_reference_data" SET alpha2 = 'ZA', alpha3 = 'ZAF', region = 'Africa', subregion = 'Southern Africa' WHERE country = 'South Africa';
UPDATE "country_reference_data" SET alpha2 = 'PT', alpha3 = 'PRT', region = 'Europe', subregion = 'Southern Europe' WHERE country = 'Portugal';
UPDATE "country_reference_data" SET alpha2 = 'ES', alpha3 = 'ESP', region = 'Europe', subregion = 'Southern Europe' WHERE country = 'Spain';
UPDATE "country_reference_data" SET alpha2 = 'FR', alpha3 = 'FRA', region = 'Europe', subregion = 'Western Europe' WHERE country = 'France';
UPDATE "country_reference_data" SET alpha2 = 'IT', alpha3 = 'ITA', region = 'Europe', subregion = 'Southern Europe' WHERE country = 'Italy';
UPDATE "country_reference_data" SET alpha2 = 'GR', alpha3 = 'GRC', region = 'Europe', subregion = 'Southern Europe' WHERE country = 'Greece';
UPDATE "country_reference_data" SET alpha2 = 'US', alpha3 = 'USA', region = 'Americas', subregion = 'Northern America' WHERE country = 'United States';
UPDATE "country_reference_data" SET alpha2 = 'CA', alpha3 = 'CAN', region = 'Americas', subregion = 'Northern America' WHERE country = 'Canada';
UPDATE "country_reference_data" SET alpha2 = 'MX', alpha3 = 'MEX', region = 'Americas', subregion = 'Central America' WHERE country = 'Mexico';
UPDATE "country_reference_data" SET alpha2 = 'CO', alpha3 = 'COL', region = 'Americas', subregion = 'South America' WHERE country = 'Colombia';
UPDATE "country_reference_data" SET alpha2 = 'PE', alpha3 = 'PER', region = 'Americas', subregion = 'South America' WHERE country = 'Peru';
UPDATE "country_reference_data" SET alpha2 = 'BR', alpha3 = 'BRA', region = 'Americas', subregion = 'South America' WHERE country = 'Brazil';
UPDATE "country_reference_data" SET alpha2 = 'AR', alpha3 = 'ARG', region = 'Americas', subregion = 'South America' WHERE country = 'Argentina';
UPDATE "country_reference_data" SET alpha2 = 'CL', alpha3 = 'CHL', region = 'Americas', subregion = 'South America' WHERE country = 'Chile';
UPDATE "country_reference_data" SET alpha2 = 'AU', alpha3 = 'AUS', region = 'Oceania', subregion = 'Australia and New Zealand' WHERE country = 'Australia';
UPDATE "country_reference_data" SET alpha2 = 'NZ', alpha3 = 'NZL', region = 'Oceania', subregion = 'Australia and New Zealand' WHERE country = 'New Zealand';

-- Step 3: Set NOT NULL constraints now that all existing rows have values
ALTER TABLE "country_reference_data" ALTER COLUMN "alpha2" SET NOT NULL;
ALTER TABLE "country_reference_data" ALTER COLUMN "alpha3" SET NOT NULL;

-- Step 4: Add unique constraints
ALTER TABLE "country_reference_data" ADD CONSTRAINT "country_reference_data_alpha2_unique" UNIQUE("alpha2");
ALTER TABLE "country_reference_data" ADD CONSTRAINT "country_reference_data_alpha3_unique" UNIQUE("alpha3");
