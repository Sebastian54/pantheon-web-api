ALTER TABLE "server_metrics" ADD COLUMN "tps_10s" double precision;--> statement-breakpoint
ALTER TABLE "server_metrics" ADD COLUMN "mspt_10s" double precision;--> statement-breakpoint
ALTER TABLE "server_metrics" ADD COLUMN "cpu_process_10s" double precision;--> statement-breakpoint
ALTER TABLE "server_metrics" ADD COLUMN "cpu_system_10s" double precision;--> statement-breakpoint
ALTER TABLE "server_metrics" ADD COLUMN "hostile_mobcap_overworld" integer;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "tps_10s" double precision;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "mspt_10s" double precision;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "cpu_process_10s" double precision;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "cpu_system_10s" double precision;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "hostile_mobcap_overworld" integer;--> statement-breakpoint
ALTER TABLE "server_metrics" DROP COLUMN IF EXISTS "tps";--> statement-breakpoint
ALTER TABLE "server_metrics" DROP COLUMN IF EXISTS "mspt";--> statement-breakpoint
ALTER TABLE "server_metrics" DROP COLUMN IF EXISTS "cpu_usage";--> statement-breakpoint
ALTER TABLE "server_metrics" DROP COLUMN IF EXISTS "target_tickrate";--> statement-breakpoint
ALTER TABLE "server_metrics" DROP COLUMN IF EXISTS "hostile_mobcap";--> statement-breakpoint
ALTER TABLE "servers" DROP COLUMN IF EXISTS "mspt";--> statement-breakpoint
ALTER TABLE "servers" DROP COLUMN IF EXISTS "cpu_usage";--> statement-breakpoint
ALTER TABLE "servers" DROP COLUMN IF EXISTS "target_tickrate";--> statement-breakpoint
ALTER TABLE "servers" DROP COLUMN IF EXISTS "hostile_mobcap";