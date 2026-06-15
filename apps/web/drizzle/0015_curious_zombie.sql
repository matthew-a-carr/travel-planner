CREATE TABLE "user_passports" (
	"user_id" text NOT NULL,
	"nationality" text NOT NULL,
	"label" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_passports_user_id_nationality_pk" PRIMARY KEY("user_id","nationality")
);
--> statement-breakpoint
CREATE TABLE "visa_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nationality" text NOT NULL,
	"destination" text NOT NULL,
	"zone_code" text,
	"purpose" text DEFAULT 'tourism' NOT NULL,
	"work_rights" boolean DEFAULT false NOT NULL,
	"min_age_years" integer,
	"max_age_years" integer,
	"eligibility_notes" text,
	"category" text NOT NULL,
	"max_stay_days" integer,
	"visa_validity_days" integer,
	"entry_type" text DEFAULT 'single' NOT NULL,
	"min_days_out_before_return" integer,
	"rolling_allowance_days" integer,
	"rolling_window_days" integer,
	"other_requirements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"source" text DEFAULT 'ai-extracted' NOT NULL,
	"source_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visa_zone_membership" (
	"zone_code" text NOT NULL,
	"alpha3" text NOT NULL,
	CONSTRAINT "visa_zone_membership_zone_code_alpha3_pk" PRIMARY KEY("zone_code","alpha3")
);
--> statement-breakpoint
CREATE TABLE "visa_zones" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"rolling_allowance_days" integer,
	"rolling_window_days" integer,
	"notes" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "user_passports" ADD CONSTRAINT "user_passports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visa_zone_membership" ADD CONSTRAINT "visa_zone_membership_zone_code_visa_zones_code_fk" FOREIGN KEY ("zone_code") REFERENCES "public"."visa_zones"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_visa_rules_nat_dest" ON "visa_rules" USING btree ("nationality","destination");--> statement-breakpoint
CREATE INDEX "idx_visa_rules_zone" ON "visa_rules" USING btree ("zone_code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_visa_rules_nat_dest_purpose_from" ON "visa_rules" USING btree ("nationality","destination","purpose","valid_from");