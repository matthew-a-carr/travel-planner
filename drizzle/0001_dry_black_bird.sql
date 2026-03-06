CREATE TABLE "organization_memberships" (
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_memberships_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
CREATE TEMP TABLE "user_org_map" (
	"user_id" text PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"organization_name" text NOT NULL
);--> statement-breakpoint
INSERT INTO "user_org_map" ("user_id", "organization_id", "organization_name")
SELECT
	"u"."id",
	gen_random_uuid(),
	CASE
		WHEN lower(trim("u"."email")) = 'local-dev@travel-planner.local' THEN 'Local Dev Workspace'
		ELSE left(
			coalesce(
				nullif(regexp_replace(trim(coalesce("u"."name", '')), '\s+', ' ', 'g'), ''),
				nullif(split_part(lower("u"."email"), '@', 1), ''),
				'My'
			) || '''s Workspace',
			80
		)
	END
FROM "users" AS "u";--> statement-breakpoint
INSERT INTO "organizations" ("id", "name", "created_by_user_id", "created_at", "updated_at")
SELECT
	"map"."organization_id",
	"map"."organization_name",
	"map"."user_id",
	now(),
	now()
FROM "user_org_map" AS "map";--> statement-breakpoint
INSERT INTO "organization_memberships" ("organization_id", "user_id", "role", "created_at")
SELECT
	"map"."organization_id",
	"map"."user_id",
	'owner',
	now()
FROM "user_org_map" AS "map";--> statement-breakpoint
UPDATE "trips" AS "t"
SET "organization_id" = "map"."organization_id"
FROM "user_org_map" AS "map"
WHERE "t"."owner_id" = "map"."user_id";--> statement-breakpoint
DROP TABLE "user_org_map";--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "organization_memberships_user_id_idx" ON "organization_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trips_organization_id_created_at_idx" ON "trips" USING btree ("organization_id","created_at");
