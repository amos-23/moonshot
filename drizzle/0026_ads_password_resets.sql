-- Password reset for AdsSim: a one-time link by email. Only a hash of each token is kept; a token works once,
-- for an hour. Used and replaced ones stay for a day so the per-account request limit can count them.
CREATE TABLE "ads"."password_resets" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "ads"."users"("id") ON DELETE cascade,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "ads_password_resets_user_idx" ON "ads"."password_resets" ("user_id","created_at");
