CREATE TABLE IF NOT EXISTS "ait_logs" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"client_log_id" bigint NOT NULL,
	"tardis_id" varchar(64) NOT NULL,
	"player_uuid" uuid,
	"player_name" varchar(64) NOT NULL,
	"category" varchar(64) NOT NULL,
	"action" varchar(64) NOT NULL,
	"result" varchar(64),
	"from_dim" varchar(128),
	"from_x" integer,
	"from_y" integer,
	"from_z" integer,
	"to_dim" varchar(128),
	"to_x" integer,
	"to_y" integer,
	"to_z" integer,
	"detail" text,
	"occurred_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ait_logs_id_occurred_at_pk" PRIMARY KEY("id","occurred_at")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ait_logs" ADD CONSTRAINT "ait_logs_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ait_logs_server_occurred_idx" ON "ait_logs" USING btree ("server_id","occurred_at");