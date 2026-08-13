CREATE TABLE IF NOT EXISTS "player_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"player_uuid" uuid NOT NULL,
	"server_uuid" uuid NOT NULL,
	"geolocation_country" varchar(2),
	"geolocation_city" varchar(128),
	"login_time" timestamp with time zone NOT NULL,
	"logout_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "players" (
	"uuid" uuid PRIMARY KEY NOT NULL,
	"username" varchar(16) NOT NULL,
	"total_playtime_seconds" integer DEFAULT 0 NOT NULL,
	"registered_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "player_sessions" ADD CONSTRAINT "player_sessions_player_uuid_players_uuid_fk" FOREIGN KEY ("player_uuid") REFERENCES "public"."players"("uuid") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "player_sessions" ADD CONSTRAINT "player_sessions_server_uuid_servers_server_uuid_fk" FOREIGN KEY ("server_uuid") REFERENCES "public"."servers"("server_uuid") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "player_sessions_server_session_unique_idx" ON "player_sessions" USING btree ("server_uuid","session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_sessions_player_idx" ON "player_sessions" USING btree ("player_uuid");