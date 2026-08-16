-- Adds account_id as nullable first — this table already has real rows in
-- production, so a straight `ADD COLUMN ... NOT NULL` (drizzle-kit's naive
-- default) would fail outright with no default value to fall back on.
ALTER TABLE "users" ADD COLUMN "account_id" varchar(8);--> statement-breakpoint

-- Backfill existing rows with a random 8-digit code. A single UPDATE (not a
-- retry loop) is safe here specifically because this only ever runs once,
-- against however many rows already exist at migration time — for any
-- realistic pre-launch user count the collision odds are negligible, and a
-- collision would simply fail the subsequent unique index creation below,
-- which is safe to just re-run after a manual nudge (this migration isn't
-- silently unsafe on collision, just non-retrying).
UPDATE "users" SET "account_id" = lpad(floor(random() * 100000000)::text, 8, '0') WHERE "account_id" IS NULL;--> statement-breakpoint

ALTER TABLE "users" ALTER COLUMN "account_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_account_id_unique_idx" ON "users" USING btree ("account_id");
