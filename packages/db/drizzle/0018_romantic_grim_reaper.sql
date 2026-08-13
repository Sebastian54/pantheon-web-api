CREATE TABLE IF NOT EXISTS "ledger_block_logs" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"client_log_id" bigint NOT NULL,
	"action" varchar(64) NOT NULL,
	"world" varchar(64) NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"z" integer NOT NULL,
	"object" varchar(128) NOT NULL,
	"old_object" varchar(128),
	"block_state" text,
	"old_block_state" text,
	"source" varchar(64) NOT NULL,
	"player_name" varchar(64),
	"player_uuid" uuid,
	"extra_data" text,
	"rolled_back" boolean DEFAULT false NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ledger_block_logs_id_occurred_at_pk" PRIMARY KEY("id","occurred_at")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_block_logs" ADD CONSTRAINT "ledger_block_logs_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_block_logs_server_occurred_idx" ON "ledger_block_logs" USING btree ("server_id","occurred_at");