CREATE TABLE "connect"."reactions" (
	"moment_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"reactor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reactions_moment_id_kind_reactor_pk" PRIMARY KEY("moment_id","kind","reactor"),
	CONSTRAINT "reactions_kind_check" CHECK ("connect"."reactions"."kind" in ('fire','love','clap'))
);
--> statement-breakpoint
ALTER TABLE "connect"."reactions" ADD CONSTRAINT "reactions_moment_id_moments_id_fk" FOREIGN KEY ("moment_id") REFERENCES "connect"."moments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reactions_created_idx" ON "connect"."reactions" USING btree ("created_at");