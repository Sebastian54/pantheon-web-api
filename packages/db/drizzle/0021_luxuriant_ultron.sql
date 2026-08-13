CREATE TABLE IF NOT EXISTS "grief_logger_events" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"kind" varchar(16) NOT NULL,
	"player_name" varchar(64),
	"player_uuid" uuid,
	"world" varchar(64) NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"z" integer NOT NULL,
	"type" varchar(128),
	"action" varchar(32),
	"amount" integer,
	"message" text,
	"occurred_at" timestamp with time zone NOT NULL,
	CONSTRAINT "grief_logger_events_id_occurred_at_pk" PRIMARY KEY("id","occurred_at")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "grief_logger_events" ADD CONSTRAINT "grief_logger_events_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "grief_logger_events_server_kind_occurred_idx" ON "grief_logger_events" USING btree ("server_id","kind","occurred_at");