-- Row-level security.
--
-- The Next.js server connects with the database owner role and enforces authorization in code.
-- RLS is defence in depth: it guarantees that the public Supabase anon key (which ships to browsers)
-- can never read private data or write anything directly through the Supabase REST API.
-- Policies that reference auth.uid() are only created when the Supabase `auth` schema exists,
-- so this migration also runs on plain Postgres / PGlite for local development.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "connection_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "saved_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "follow_up_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "blocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "meetings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "social_posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "social_post_marks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "post_invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exhibitors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "saved_exhibitors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exhibitor_inquiries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "meetups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "meetup_participants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "moderation_actions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "analytics_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE NOTICE 'Supabase auth schema not found; skipping auth.uid() policies';
    RETURN;
  END IF;

  -- Helper: true when either user has blocked the other.
  EXECUTE $f$
    CREATE OR REPLACE FUNCTION public.is_blocked_pair(a uuid, b uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
    'SELECT EXISTS (SELECT 1 FROM blocks WHERE (blocker_id = a AND blocked_id = b) OR (blocker_id = b AND blocked_id = a))'
  $f$;

  -- Own account row only.
  CREATE POLICY users_select_own ON users FOR SELECT TO authenticated USING (id = auth.uid());

  -- Profiles: public ones to everyone, member ones to signed-in users, never across a block.
  CREATE POLICY profiles_select_public ON profiles FOR SELECT TO anon USING (visibility = 'public');
  CREATE POLICY profiles_select_members ON profiles FOR SELECT TO authenticated
    USING (user_id = auth.uid()
           OR (visibility IN ('public','members') AND NOT public.is_blocked_pair(user_id, auth.uid())));
  CREATE POLICY profiles_update_own ON profiles FOR UPDATE TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND ticket_verified = false AND featured = false);

  -- Participant-only reads. All writes go through the server, which validates transitions.
  CREATE POLICY conn_req_select_party ON connection_requests FOR SELECT TO authenticated
    USING (requester_id = auth.uid() OR recipient_id = auth.uid());
  CREATE POLICY conversations_select_party ON conversations FOR SELECT TO authenticated
    USING (user_a = auth.uid() OR user_b = auth.uid());
  CREATE POLICY messages_select_party ON messages FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid())));
  CREATE POLICY meetings_select_party ON meetings FOR SELECT TO authenticated
    USING (proposer_id = auth.uid() OR invitee_id = auth.uid());

  CREATE POLICY saved_profiles_own ON saved_profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
  CREATE POLICY notes_own ON follow_up_notes FOR SELECT TO authenticated USING (owner_id = auth.uid());
  CREATE POLICY blocks_own ON blocks FOR SELECT TO authenticated USING (blocker_id = auth.uid());
  CREATE POLICY saved_exhibitors_own ON saved_exhibitors FOR SELECT TO authenticated USING (user_id = auth.uid());
  CREATE POLICY marks_own ON social_post_marks FOR SELECT TO authenticated USING (user_id = auth.uid());
  CREATE POLICY inquiries_own ON exhibitor_inquiries FOR SELECT TO authenticated USING (user_id = auth.uid());
  CREATE POLICY meetup_participants_own ON meetup_participants FOR SELECT TO authenticated USING (user_id = auth.uid());

  -- Public catalogue data.
  CREATE POLICY social_posts_read ON social_posts FOR SELECT TO anon, authenticated USING (hidden = false);
  CREATE POLICY exhibitors_read ON exhibitors FOR SELECT TO anon, authenticated USING (published = true);
  CREATE POLICY meetups_read ON meetups FOR SELECT TO authenticated USING (status <> 'cancelled');

  -- reports, moderation_actions, settings, analytics_events, post_invites: no policies => no API access.
END
$$;
