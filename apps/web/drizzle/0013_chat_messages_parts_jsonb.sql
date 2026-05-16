BEGIN;

ALTER TABLE "chat_messages" ADD COLUMN "parts" JSONB;
--> statement-breakpoint
UPDATE "chat_messages"
  SET "parts" = jsonb_build_array(jsonb_build_object('type', 'text', 'text', "content"));
--> statement-breakpoint
ALTER TABLE "chat_messages" ALTER COLUMN "parts" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "chat_messages" DROP COLUMN "content";

COMMIT;
