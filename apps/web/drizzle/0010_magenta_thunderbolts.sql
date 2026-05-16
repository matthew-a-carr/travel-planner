CREATE TABLE "ai_cache" (
	"hash" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_ai_cache_expires_at" ON "ai_cache" USING btree ("expires_at");
