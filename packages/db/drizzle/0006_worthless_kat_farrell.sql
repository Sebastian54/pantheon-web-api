CREATE TABLE IF NOT EXISTS "block_logs" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"client_log_id" integer NOT NULL,
	"source" varchar(64) NOT NULL,
	"action" varchar(64) NOT NULL,
	"x" integer,
	"y" integer,
	"z" integer,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone NOT NULL,
	CONSTRAINT "block_logs_id_occurred_at_pk" PRIMARY KEY("id","occurred_at")
);
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "mspt" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "cpu_usage" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "target_tickrate" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "hostile_mobcap" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "block_logs" ADD CONSTRAINT "block_logs_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "block_logs_server_occurred_idx" ON "block_logs" USING btree ("server_id","occurred_at");