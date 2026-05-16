ALTER TABLE "users" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_approved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "users"
SET
  "first_name" = nullif(split_part(regexp_replace(trim(coalesce("name", '')), '\s+', ' ', 'g'), ' ', 1), ''),
  "last_name" = nullif(
    trim(
      regexp_replace(
        regexp_replace(trim(coalesce("name", '')), '\s+', ' ', 'g'),
        '^\S+\s*',
        ''
      )
    ),
    ''
  )
WHERE "name" IS NOT NULL
  AND trim("name") <> '';--> statement-breakpoint
UPDATE "users"
SET "is_approved" = true
WHERE lower("email") = 'local-dev@travel-planner.local';
