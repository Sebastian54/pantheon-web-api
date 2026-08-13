CREATE TABLE IF NOT EXISTS "anti_dupe_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"tardis_uuid" uuid NOT NULL,
	"action" varchar(32) NOT NULL,
	"actor" varchar(64) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anti_dupe_events" ADD CONSTRAINT "anti_dupe_events_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "anti_dupe_events_server_idx" ON "anti_dupe_events" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "anti_dupe_events_tardis_idx" ON "anti_dupe_events" USING btree ("tardis_uuid");