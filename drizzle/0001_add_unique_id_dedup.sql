ALTER TABLE "vault_items" ADD COLUMN IF NOT EXISTS "unique_id" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vault_items_dedup_idx" ON "vault_items" USING btree ("vault_id","resource_type","unique_id");
