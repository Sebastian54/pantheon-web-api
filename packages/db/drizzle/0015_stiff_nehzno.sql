CREATE TABLE IF NOT EXISTS "ait_tardises" (
	"uuid" uuid PRIMARY KEY NOT NULL,
	"server_id" uuid NOT NULL,
	"name" varchar(128),
	"owner" varchar(64),
	"owner_uuid" uuid,
	"fuel" double precision,
	"max_fuel" double precision,
	"powered" boolean,
	"locked" boolean,
	"travel_state" varchar(32),
	"door_state" varchar(32),
	"dimension" varchar(128),
	"x" integer,
	"y" integer,
	"z" integer,
	"crew" jsonb,
	"subsystems" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ait_tardises" ADD CONSTRAINT "ait_tardises_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ait_tardises_server_idx" ON "ait_tardises" USING btree ("server_id");