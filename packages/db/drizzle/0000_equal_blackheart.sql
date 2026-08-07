DO $$ BEGIN
 CREATE TYPE "public"."loader_type" AS ENUM('VANILLA', 'PAPER', 'SPIGOT', 'PURPUR', 'FOLIA', 'FORGE', 'NEOFORGE', 'FABRIC', 'QUILT');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."role" AS ENUM('OWNER', 'ADMIN');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "command_spy_logs" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"executor" varchar(64) NOT NULL,
	"executor_uuid" uuid,
	"command" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "command_spy_logs_id_occurred_at_pk" PRIMARY KEY("id","occurred_at")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger_logs" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"actor" varchar(64) NOT NULL,
	"actor_uuid" uuid,
	"action_type" varchar(64) NOT NULL,
	"target" varchar(255),
	"world" varchar(64),
	"x" integer,
	"y" integer,
	"z" integer,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_logs_id_occurred_at_pk" PRIMARY KEY("id","occurred_at")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"api_key_hash" text NOT NULL,
	"loader_type" "loader_type" DEFAULT 'PAPER' NOT NULL,
	"mc_version" varchar(32) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_servers" (
	"user_id" uuid NOT NULL,
	"server_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_servers_user_id_server_id_pk" PRIMARY KEY("user_id","server_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	"role" "role" DEFAULT 'ADMIN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "command_spy_logs" ADD CONSTRAINT "command_spy_logs_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_logs" ADD CONSTRAINT "ledger_logs_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_servers" ADD CONSTRAINT "user_servers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_servers" ADD CONSTRAINT "user_servers_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "command_spy_logs_server_occurred_idx" ON "command_spy_logs" USING btree ("server_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_logs_server_occurred_idx" ON "ledger_logs" USING btree ("server_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "servers_server_uuid_unique_idx" ON "servers" USING btree ("server_uuid");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique_idx" ON "users" USING btree ("email");