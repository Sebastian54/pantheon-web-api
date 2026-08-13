ALTER TABLE "server_metrics" ADD COLUMN "memory_used_mb" double precision;--> statement-breakpoint
ALTER TABLE "server_metrics" ADD COLUMN "memory_total_mb" double precision;--> statement-breakpoint
ALTER TABLE "server_metrics" ADD COLUMN "disk_used_gb" double precision;--> statement-breakpoint
ALTER TABLE "server_metrics" ADD COLUMN "disk_total_gb" double precision;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "memory_used_mb" double precision;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "memory_total_mb" double precision;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "disk_used_gb" double precision;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "disk_total_gb" double precision;