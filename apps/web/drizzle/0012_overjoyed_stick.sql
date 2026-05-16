DROP INDEX "idx_chat_threads_trip_user";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_chat_threads_trip_user" ON "chat_threads" USING btree ("trip_id","user_id");