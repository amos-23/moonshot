import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// Account record. With Supabase Auth, `id` equals auth.users.id.
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    role: text("role").notNull().default("user"),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    createdAt: createdAt(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("users_email_key").on(sql`lower(${t.email})`),
    check("users_role_check", sql`${t.role} in ('user','admin')`),
  ],
);

export const profiles = pgTable(
  "profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    avatarUrl: text("avatar_url"),
    headline: text("headline").notNull(), // job title / professional role
    roleCategory: text("role_category").notNull().default("other"),
    company: text("company"),
    industry: text("industry"),
    bio: text("bio").notNull().default(""),
    location: text("location"),
    interests: text("interests").array().notNull().default(sql`'{}'::text[]`),
    goals: text("goals").array().notNull().default(sql`'{}'::text[]`),
    offers: text("offers").array().notNull().default(sql`'{}'::text[]`),
    lookingFor: text("looking_for").notNull().default(""), // free text: what they want from Moonshot
    canOffer: text("can_offer").notNull().default(""), // free text: what they can offer
    attendance: text("attendance").notNull().default("undecided"),
    networkingStyle: text("networking_style").notNull().default("both"),
    visibility: text("visibility").notNull().default("members"),
    contactPreference: text("contact_preference").notNull().default("everyone"),
    xHandle: text("x_handle"),
    linkedinUrl: text("linkedin_url"),
    websiteUrl: text("website_url"),
    // Contact links are only shown to accepted connections when this is true.
    shareLinksWithConnections: boolean("share_links_with_connections").notNull().default(true),
    ticketVerified: boolean("ticket_verified").notNull().default(false), // only set by an admin after real verification
    featured: boolean("featured").notNull().default(false),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("profiles_visibility_idx").on(t.visibility),
    index("profiles_interests_idx").using("gin", t.interests),
    index("profiles_goals_idx").using("gin", t.goals),
    check("profiles_attendance_check", sql`${t.attendance} in ('in_person','remote','undecided')`),
    check("profiles_visibility_check", sql`${t.visibility} in ('public','members','hidden')`),
    check("profiles_contact_check", sql`${t.contactPreference} in ('everyone','shared_interests','nobody')`),
    check("profiles_style_check", sql`${t.networkingStyle} in ('one_to_one','group','both')`),
    check("profiles_name_len", sql`char_length(${t.name}) between 1 and 80`),
    check("profiles_bio_len", sql`char_length(${t.bio}) <= 600`),
  ],
);

export const connectionRequests = pgTable(
  "connection_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    message: text("message").notNull().default(""),
    status: text("status").notNull().default("pending"),
    createdAt: createdAt(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [
    index("conn_req_recipient_idx").on(t.recipientId, t.status),
    index("conn_req_requester_idx").on(t.requesterId, t.status),
    // At most one live (pending or accepted) request per pair, regardless of direction.
    uniqueIndex("conn_req_pair_live_key")
      .on(sql`least(${t.requesterId}, ${t.recipientId})`, sql`greatest(${t.requesterId}, ${t.recipientId})`)
      .where(sql`${t.status} in ('pending','accepted')`),
    check("conn_req_status_check", sql`${t.status} in ('pending','accepted','declined','cancelled','removed')`),
    check("conn_req_not_self", sql`${t.requesterId} <> ${t.recipientId}`),
    check("conn_req_message_len", sql`char_length(${t.message}) <= 300`),
  ],
);

// One conversation per connected pair; user_a < user_b.
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userA: uuid("user_a")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userB: uuid("user_b")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("conversations_pair_key").on(t.userA, t.userB),
    index("conversations_user_b_idx").on(t.userB),
    check("conversations_order", sql`${t.userA} < ${t.userB}`),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [
    index("messages_conversation_idx").on(t.conversationId, t.createdAt),
    check("messages_body_len", sql`char_length(${t.body}) between 1 and 2000`),
  ],
);

export const savedProfiles = pgTable(
  "saved_profiles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    savedUserId: uuid("saved_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.savedUserId] })],
);

// Private notes a user keeps about another person (follow-ups).
export const followUpNotes = pgTable(
  "follow_up_notes",
  {
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.ownerId, t.subjectId] }),
    check("notes_body_len", sql`char_length(${t.body}) <= 2000`),
  ],
);

export const blocks = pgTable(
  "blocks",
  {
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] }), index("blocks_blocked_idx").on(t.blockedId)],
);

export const meetings = pgTable(
  "meetings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposerId: uuid("proposer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inviteeId: uuid("invitee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    location: text("location").notNull(),
    note: text("note").notNull().default(""),
    status: text("status").notNull().default("proposed"),
    createdAt: createdAt(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [
    index("meetings_proposer_idx").on(t.proposerId),
    index("meetings_invitee_idx").on(t.inviteeId),
    check("meetings_status_check", sql`${t.status} in ('proposed','confirmed','declined','cancelled')`),
    check("meetings_duration_check", sql`${t.durationMinutes} between 5 and 240`),
    check("meetings_not_self", sql`${t.proposerId} <> ${t.inviteeId}`),
  ],
);

export const socialPosts = pgTable(
  "social_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    platform: text("platform").notNull().default("x"),
    externalId: text("external_id"),
    url: text("url").notNull(),
    authorHandle: text("author_handle"),
    authorName: text("author_name"),
    content: text("content"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    themes: text("themes").array().notNull().default(sql`'{}'::text[]`),
    source: text("source").notNull(), // manual | import | x_api | oembed
    importedById: uuid("imported_by_id").references(() => users.id, { onDelete: "set null" }),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
    hidden: boolean("hidden").notNull().default(false),
  },
  (t) => [
    uniqueIndex("social_posts_url_key").on(t.url),
    uniqueIndex("social_posts_external_key").on(t.platform, t.externalId),
    index("social_posts_posted_idx").on(t.postedAt),
    index("social_posts_themes_idx").using("gin", t.themes),
    check("social_posts_source_check", sql`${t.source} in ('manual','import','x_api','oembed')`),
  ],
);

export const socialPostMarks = pgTable(
  "social_post_marks",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => socialPosts.id, { onDelete: "cascade" }),
    mark: text("mark").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.postId] }),
    check("social_post_marks_check", sql`${t.mark} in ('relevant','dismissed')`),
  ],
);

export const postInvites = pgTable(
  "post_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => socialPosts.id, { onDelete: "cascade" }),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("post_invites_once_key").on(t.postId, t.inviterId)],
);

export const exhibitors = pgTable(
  "exhibitors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    tagline: text("tagline").notNull().default(""),
    description: text("description").notNull().default(""),
    industry: text("industry"),
    category: text("category").notNull().default("other"),
    websiteUrl: text("website_url"),
    logoUrl: text("logo_url"),
    boothLocation: text("booth_location"),
    boothVerified: boolean("booth_verified").notNull().default(false),
    isDemo: boolean("is_demo").notNull().default(false),
    published: boolean("published").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("exhibitors_name_idx").on(t.name)],
);

export const savedExhibitors = pgTable(
  "saved_exhibitors",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    exhibitorId: uuid("exhibitor_id")
      .notNull()
      .references(() => exhibitors.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.exhibitorId] })],
);

export const exhibitorInquiries = pgTable(
  "exhibitor_inquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    exhibitorId: uuid("exhibitor_id")
      .notNull()
      .references(() => exhibitors.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: createdAt(),
  },
  (t) => [
    index("exhibitor_inquiries_exhibitor_idx").on(t.exhibitorId),
    check("exhibitor_inquiries_kind_check", sql`${t.kind} in ('question','introduction')`),
    check("exhibitor_inquiries_status_check", sql`${t.status} in ('open','forwarded','closed')`),
  ],
);

export const meetups = pgTable(
  "meetups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organiserId: uuid("organiser_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    topic: text("topic").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    location: text("location"),
    onlineUrl: text("online_url"),
    capacity: integer("capacity").notNull().default(10),
    status: text("status").notNull().default("proposed"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("meetups_starts_idx").on(t.startsAt),
    check("meetups_status_check", sql`${t.status} in ('proposed','confirmed','cancelled')`),
    check("meetups_capacity_check", sql`${t.capacity} between 2 and 500`),
    check("meetups_where_check", sql`${t.location} is not null or ${t.onlineUrl} is not null`),
  ],
);

export const meetupParticipants = pgTable(
  "meetup_participants",
  {
    meetupId: uuid("meetup_id")
      .notNull()
      .references(() => meetups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.meetupId, t.userId] }), index("meetup_participants_user_idx").on(t.userId)],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "set null" }),
    reason: text("reason").notNull(),
    details: text("details").notNull().default(""),
    status: text("status").notNull().default("open"),
    createdAt: createdAt(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    index("reports_status_idx").on(t.status, t.createdAt),
    check("reports_target_check", sql`${t.targetType} in ('user','message','meetup','post')`),
    check("reports_status_check", sql`${t.status} in ('open','actioned','dismissed')`),
  ],
);

export const moderationActions = pgTable(
  "moderation_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminId: uuid("admin_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reportId: uuid("report_id").references(() => reports.id, { onDelete: "set null" }),
    note: text("note").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("moderation_actions_created_idx").on(t.createdAt)],
);

// Admin-editable key/value settings (event information, provider state).
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    props: jsonb("props").notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [index("analytics_events_name_idx").on(t.name, t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type ConnectionRequest = typeof connectionRequests.$inferSelect;
export type Meeting = typeof meetings.$inferSelect;
export type SocialPost = typeof socialPosts.$inferSelect;
export type Exhibitor = typeof exhibitors.$inferSelect;
export type Meetup = typeof meetups.$inferSelect;
export type Report = typeof reports.$inferSelect;
