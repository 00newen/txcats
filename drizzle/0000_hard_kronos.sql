CREATE TABLE "user_meta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"user_salt_base64" text NOT NULL,
	"wrapped_dek_base64" text NOT NULL,
	"verification_blob_base64" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_meta_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "vault_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"resource_type" text NOT NULL,
	"ciphertext_base64" text NOT NULL,
	"iv_base64" text NOT NULL,
	"aad_base64" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vaults" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vault_items" ADD CONSTRAINT "vault_items_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_permissions" ADD CONSTRAINT "vault_permissions_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_meta_user_id_idx" ON "user_meta" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "vault_items_vault_id_idx" ON "vault_items" USING btree ("vault_id");--> statement-breakpoint
CREATE INDEX "vault_items_resource_type_idx" ON "vault_items" USING btree ("resource_type");--> statement-breakpoint
CREATE INDEX "vault_items_deleted_at_idx" ON "vault_items" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "vault_permissions_vault_id_idx" ON "vault_permissions" USING btree ("vault_id");--> statement-breakpoint
CREATE INDEX "vault_permissions_user_id_idx" ON "vault_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vault_permissions_user_vault_unique" ON "vault_permissions" USING btree ("user_id","vault_id");--> statement-breakpoint
CREATE INDEX "vaults_owner_id_idx" ON "vaults" USING btree ("owner_id");