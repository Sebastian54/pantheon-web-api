CREATE TABLE IF NOT EXISTS "advancements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"player_uuid" uuid NOT NULL,
	"player_name" varchar(64) NOT NULL,
	"advancement" varchar(255) NOT NULL,
	"title" varchar(255),
	"frame" varchar(16),
	"dimension" varchar(128),
	"x" integer,
	"y" integer,
	"z" integer,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "advancements" ADD CONSTRAINT "advancements_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "advancements_server_idx" ON "advancements" USING btree ("server_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "advancements_server_player_advancement_unique_idx" ON "advancements" USING btree ("server_id","player_uuid","advancement");