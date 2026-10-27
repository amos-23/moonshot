CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "connection_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "conn_req_status_check" CHECK ("connection_requests"."status" in ('pending','accepted','declined','cancelled','removed')),
	CONSTRAINT "conn_req_not_self" CHECK ("connection_requests"."requester_id" <> "connection_requests"."recipient_id"),
	CONSTRAINT "conn_req_message_len" CHECK (char_length("connection_requests"."message") <= 300)
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_a" uuid NOT NULL,
	"user_b" uuid NOT NULL,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_order" CHECK ("conversations"."user_a" < "conversations"."user_b")
);
--> statement-breakpoint
CREATE TABLE "exhibitor_inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exhibitor_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exhibitor_inquiries_kind_check" CHECK ("exhibitor_inquiries"."kind" in ('question','introduction')),
	CONSTRAINT "exhibitor_inquiries_status_check" CHECK ("exhibitor_inquiries"."status" in ('open','forwarded','closed'))
);
--> statement-breakpoint
CREATE TABLE "exhibitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"industry" text,
	"category" text DEFAULT 'other' NOT NULL,
	"website_url" text,
	"logo_url" text,
	"booth_location" text,
	"booth_verified" boolean DEFAULT false NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follow_up_notes" (
	"owner_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"body" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follow_up_notes_owner_id_subject_id_pk" PRIMARY KEY("owner_id","subject_id"),
	CONSTRAINT "notes_body_len" CHECK (char_length("follow_up_notes"."body") <= 2000)
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposer_id" uuid NOT NULL,
	"invitee_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"location" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "meetings_status_check" CHECK ("meetings"."status" in ('proposed','confirmed','declined','cancelled')),
	CONSTRAINT "meetings_duration_check" CHECK ("meetings"."duration_minutes" between 5 and 240),
	CONSTRAINT "meetings_not_self" CHECK ("meetings"."proposer_id" <> "meetings"."invitee_id")
);
--> statement-breakpoint
CREATE TABLE "meetup_participants" (
	"meetup_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meetup_participants_meetup_id_user_id_pk" PRIMARY KEY("meetup_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "meetups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organiser_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"topic" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"location" text,
	"online_url" text,
	"capacity" integer DEFAULT 10 NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meetups_status_check" CHECK ("meetups"."status" in ('proposed','confirmed','cancelled')),
	CONSTRAINT "meetups_capacity_check" CHECK ("meetups"."capacity" between 2 and 500),
	CONSTRAINT "meetups_where_check" CHECK ("meetups"."location" is not null or "meetups"."online_url" is not null)
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "messages_body_len" CHECK (char_length("messages"."body") between 1 and 2000)
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"report_id" uuid,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"inviter_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"avatar_url" text,
	"headline" text NOT NULL,
	"role_category" text DEFAULT 'other' NOT NULL,
	"company" text,
	"industry" text,
	"bio" text DEFAULT '' NOT NULL,
	"location" text,
	"interests" text[] DEFAULT '{}'::text[] NOT NULL,
	"goals" text[] DEFAULT '{}'::text[] NOT NULL,
	"offers" text[] DEFAULT '{}'::text[] NOT NULL,
	"looking_for" text DEFAULT '' NOT NULL,
	"can_offer" text DEFAULT '' NOT NULL,
	"attendance" text DEFAULT 'undecided' NOT NULL,
	"networking_style" text DEFAULT 'both' NOT NULL,
	"visibility" text DEFAULT 'members' NOT NULL,
	"contact_preference" text DEFAULT 'everyone' NOT NULL,
	"x_handle" text,
	"linkedin_url" text,
	"website_url" text,
	"share_links_with_connections" boolean DEFAULT true NOT NULL,
	"ticket_verified" boolean DEFAULT false NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_attendance_check" CHECK ("profiles"."attendance" in ('in_person','remote','undecided')),
	CONSTRAINT "profiles_visibility_check" CHECK ("profiles"."visibility" in ('public','members','hidden')),
	CONSTRAINT "profiles_contact_check" CHECK ("profiles"."contact_preference" in ('everyone','shared_interests','nobody')),
	CONSTRAINT "profiles_style_check" CHECK ("profiles"."networking_style" in ('one_to_one','group','both')),
	CONSTRAINT "profiles_name_len" CHECK (char_length("profiles"."name") between 1 and 80),
	CONSTRAINT "profiles_bio_len" CHECK (char_length("profiles"."bio") <= 600)
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"target_user_id" uuid,
	"reason" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "reports_target_check" CHECK ("reports"."target_type" in ('user','message','meetup','post')),
	CONSTRAINT "reports_status_check" CHECK ("reports"."status" in ('open','actioned','dismissed'))
);
--> statement-breakpoint
CREATE TABLE "saved_exhibitors" (
	"user_id" uuid NOT NULL,
	"exhibitor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_exhibitors_user_id_exhibitor_id_pk" PRIMARY KEY("user_id","exhibitor_id")
);
--> statement-breakpoint
CREATE TABLE "saved_profiles" (
	"user_id" uuid NOT NULL,
	"saved_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_profiles_user_id_saved_user_id_pk" PRIMARY KEY("user_id","saved_user_id")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_post_marks" (
	"user_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"mark" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_post_marks_user_id_post_id_pk" PRIMARY KEY("user_id","post_id"),
	CONSTRAINT "social_post_marks_check" CHECK ("social_post_marks"."mark" in ('relevant','dismissed'))
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" text DEFAULT 'x' NOT NULL,
	"external_id" text,
	"url" text NOT NULL,
	"author_handle" text,
	"author_name" text,
	"content" text,
	"posted_at" timestamp with time zone,
	"themes" text[] DEFAULT '{}'::text[] NOT NULL,
	"source" text NOT NULL,
	"imported_by_id" uuid,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	CONSTRAINT "social_posts_source_check" CHECK ("social_posts"."source" in ('manual','import','x_api','oembed'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "users_role_check" CHECK ("users"."role" in ('user','admin'))
);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_requests" ADD CONSTRAINT "connection_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_requests" ADD CONSTRAINT "connection_requests_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_a_users_id_fk" FOREIGN KEY ("user_a") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_b_users_id_fk" FOREIGN KEY ("user_b") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exhibitor_inquiries" ADD CONSTRAINT "exhibitor_inquiries_exhibitor_id_exhibitors_id_fk" FOREIGN KEY ("exhibitor_id") REFERENCES "public"."exhibitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exhibitor_inquiries" ADD CONSTRAINT "exhibitor_inquiries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_notes" ADD CONSTRAINT "follow_up_notes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_notes" ADD CONSTRAINT "follow_up_notes_subject_id_users_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_proposer_id_users_id_fk" FOREIGN KEY ("proposer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_invitee_id_users_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetup_participants" ADD CONSTRAINT "meetup_participants_meetup_id_meetups_id_fk" FOREIGN KEY ("meetup_id") REFERENCES "public"."meetups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetup_participants" ADD CONSTRAINT "meetup_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetups" ADD CONSTRAINT "meetups_organiser_id_users_id_fk" FOREIGN KEY ("organiser_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_invites" ADD CONSTRAINT "post_invites_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_invites" ADD CONSTRAINT "post_invites_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_exhibitors" ADD CONSTRAINT "saved_exhibitors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_exhibitors" ADD CONSTRAINT "saved_exhibitors_exhibitor_id_exhibitors_id_fk" FOREIGN KEY ("exhibitor_id") REFERENCES "public"."exhibitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_profiles" ADD CONSTRAINT "saved_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_profiles" ADD CONSTRAINT "saved_profiles_saved_user_id_users_id_fk" FOREIGN KEY ("saved_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_post_marks" ADD CONSTRAINT "social_post_marks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_post_marks" ADD CONSTRAINT "social_post_marks_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_imported_by_id_users_id_fk" FOREIGN KEY ("imported_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_events_name_idx" ON "analytics_events" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "blocks_blocked_idx" ON "blocks" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "conn_req_recipient_idx" ON "connection_requests" USING btree ("recipient_id","status");--> statement-breakpoint
CREATE INDEX "conn_req_requester_idx" ON "connection_requests" USING btree ("requester_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "conn_req_pair_live_key" ON "connection_requests" USING btree (least("requester_id", "recipient_id"),greatest("requester_id", "recipient_id")) WHERE "connection_requests"."status" in ('pending','accepted');--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_pair_key" ON "conversations" USING btree ("user_a","user_b");--> statement-breakpoint
CREATE INDEX "conversations_user_b_idx" ON "conversations" USING btree ("user_b");--> statement-breakpoint
CREATE INDEX "exhibitor_inquiries_exhibitor_idx" ON "exhibitor_inquiries" USING btree ("exhibitor_id");--> statement-breakpoint
CREATE INDEX "exhibitors_name_idx" ON "exhibitors" USING btree ("name");--> statement-breakpoint
CREATE INDEX "meetings_proposer_idx" ON "meetings" USING btree ("proposer_id");--> statement-breakpoint
CREATE INDEX "meetings_invitee_idx" ON "meetings" USING btree ("invitee_id");--> statement-breakpoint
CREATE INDEX "meetup_participants_user_idx" ON "meetup_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "meetups_starts_idx" ON "meetups" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "moderation_actions_created_idx" ON "moderation_actions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "post_invites_once_key" ON "post_invites" USING btree ("post_id","inviter_id");--> statement-breakpoint
CREATE INDEX "profiles_visibility_idx" ON "profiles" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "profiles_interests_idx" ON "profiles" USING gin ("interests");--> statement-breakpoint
CREATE INDEX "profiles_goals_idx" ON "profiles" USING gin ("goals");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "social_posts_url_key" ON "social_posts" USING btree ("url");--> statement-breakpoint
CREATE UNIQUE INDEX "social_posts_external_key" ON "social_posts" USING btree ("platform","external_id");--> statement-breakpoint
CREATE INDEX "social_posts_posted_idx" ON "social_posts" USING btree ("posted_at");--> statement-breakpoint
CREATE INDEX "social_posts_themes_idx" ON "social_posts" USING gin ("themes");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree (lower("email"));