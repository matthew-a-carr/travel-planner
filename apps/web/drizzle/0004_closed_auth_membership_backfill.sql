UPDATE "users"
SET "is_approved" = true
WHERE "is_approved" = false
  AND (
    "is_admin" = true
    OR EXISTS (
      SELECT 1
      FROM "organization_memberships" AS "om"
      WHERE "om"."user_id" = "users"."id"
    )
  );
