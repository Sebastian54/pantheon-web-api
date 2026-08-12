CREATE TABLE IF NOT EXISTS "server_metrics" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"tps" double precision NOT NULL,
	"mspt" double precision NOT NULL,
	"cpu_usage" double precision NOT NULL,
	"target_tickrate" integer NOT NULL,
	"hostile_mobcap" integer NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "server_metrics_id_occurred_at_pk" PRIMARY KEY("id","occurred_at")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "server_metrics" ADD CONSTRAINT "server_metrics_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "server_metrics_server_occurred_idx" ON "server_metrics" USING btree ("server_id","occurred_at");