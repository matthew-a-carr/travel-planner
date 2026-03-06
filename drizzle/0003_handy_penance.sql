UPDATE "users"
SET "is_approved" = true
WHERE "is_admin" = true
  AND "is_approved" = false;--> statement-breakpoint
UPDATE "users"
SET "email" = trim("email")
WHERE "email" <> trim("email");
