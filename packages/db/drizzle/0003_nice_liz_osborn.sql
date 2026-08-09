DO $$ BEGIN
 CREATE TYPE "public"."network_role" AS ENUM('OWNER', 'ADMIN', 'MODERATOR');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "network_members" (
	"user_id" uuid NOT NULL,
	"network_id" uuid NOT NULL,
	"role" "network_role" DEFAULT 'MODERATOR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "network_members_user_id_network_id_pk" PRIMARY KEY("user_id","network_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "networks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "server_access_grants" (
	"user_id" uuid NOT NULL,
	"server_uuid" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "server_access_grants_user_id_server_uuid_pk" PRIMARY KEY("user_id","server_uuid")
);
--> statement-breakpoint
DROP TABLE "user_servers";--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "network_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "network_members" ADD CONSTRAINT "network_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "network_members" ADD CONSTRAINT "network_members_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "networks" ADD CONSTRAINT "networks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "server_access_grants" ADD CONSTRAINT "server_access_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "server_access_grants" ADD CONSTRAINT "server_access_grants_server_uuid_servers_server_uuid_fk" FOREIGN KEY ("server_uuid") REFERENCES "public"."servers"("server_uuid") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "servers" ADD CONSTRAINT "servers_network_id_networks_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "role";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."role";