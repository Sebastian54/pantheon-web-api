ALTER TABLE "servers" ADD COLUMN "player_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "max_players" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "tps" double precision DEFAULT 20 NOT NULL;