ALTER TABLE "servers" ADD COLUMN "link_code" varchar(9);--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "link_code_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "servers_link_code_unique_idx" ON "servers" USING btree ("link_code");