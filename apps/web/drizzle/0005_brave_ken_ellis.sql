ALTER TABLE "trip_fixed_costs" ADD COLUMN "category" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_fixed_costs" ADD COLUMN "date" date DEFAULT now() NOT NULL;