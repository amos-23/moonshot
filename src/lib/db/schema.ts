import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgSchema, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

// Everything lives in its own Postgres schema so it never collides with other tables in the same database.
export const DB_SCHEMA = "connect";
const mc = pgSchema(DB_SCHEMA);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// A networking card. There are no accounts: whoever holds the edit token owns the card.
export const people = mc.table(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editTokenHash: text("edit_token_hash").notNull(),
    name: text("name").notNull(),
    headline: text("headline").notNull(), // what you do
    company: text("company"),
    bio: text("bio").notNull().default(""),
    wants: text("wants").array().notNull().default(sql`'{}'::text[]`),
    offers: text("offers").array().notNull().default(sql`'{}'::text[]`),
    interests: text("interests").array().notNull().default(sql`'{}'::text[]`),
    attendance: text("attendance").notNull().default("in_person"),
    // Contact links the person chose to show publicly.
    xHandle: text("x_handle"),
    linkedinUrl: text("linkedin_url"),
    whatsapp: text("whatsapp"),
    email: text("email"),
    websiteUrl: text("website_url"),
    // "Find me at…" — a short, time-stamped note for meeting at the venue.
    whereNote: text("where_note"),
    whereUpdatedAt: timestamp("where_updated_at", { withTimezone: true }),
    hidden: boolean("hidden").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("people_token_key").on(t.editTokenHash),
    index("people_created_idx").on(t.createdAt),
    check("people_attendance_check", sql`${t.attendance} in ('in_person','remote')`),
    check("people_name_len", sql`char_length(${t.name}) between 1 and 60`),
  ],
);

export const hangouts = mc.table(
  "hangouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hostId: uuid("host_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    details: text("details").notNull().default(""),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    place: text("place").notNull(),
    capacity: integer("capacity").notNull().default(12),
    cancelled: boolean("cancelled").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("hangouts_starts_idx").on(t.startsAt), check("hangouts_capacity_check", sql`${t.capacity} between 2 and 200`)],
);

export const hangoutMembers = mc.table(
  "hangout_members",
  {
    hangoutId: uuid("hangout_id")
      .notNull()
      .references(() => hangouts.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.hangoutId, t.personId] })],
);

export const socialPosts = mc.table(
  "social_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalId: text("external_id").notNull(),
    url: text("url").notNull(),
    authorHandle: text("author_handle"),
    authorName: text("author_name"),
    content: text("content"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    themes: text("themes").array().notNull().default(sql`'{}'::text[]`),
    source: text("source").notNull(), // import | oembed | x_api
    hidden: boolean("hidden").notNull().default(false),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("social_posts_external_key").on(t.externalId), index("social_posts_posted_idx").on(t.postedAt)],
);

export const reports = mc.table("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  targetType: text("target_type").notNull(), // person | hangout | post
  targetId: uuid("target_id").notNull(),
  reason: text("reason").notNull(),
  reporterId: uuid("reporter_id"),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: createdAt(),
});

// Simple per-IP rate limiting for anonymous writes.
export const rateEvents = mc.table(
  "rate_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("rate_events_key_idx").on(t.key, t.createdAt)],
);

export const settings = mc.table("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Person = typeof people.$inferSelect;
export type Hangout = typeof hangouts.$inferSelect;
export type SocialPost = typeof socialPosts.$inferSelect;

// Comments left on Moonshot Connect under a "From X" card (not replies on X itself).
export const comments = mc.table(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => socialPosts.id, { onDelete: "cascade" }),
    personId: uuid("person_id").references(() => people.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    body: text("body").notNull(),
    hidden: boolean("hidden").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("comments_post_idx").on(t.postId, t.createdAt), check("comments_body_len", sql`char_length(${t.body}) between 1 and 280`)],
);

export type Comment = typeof comments.$inferSelect;

// First-party, cookie-free analytics. `visitor` is a daily-rotating hash (not reversible to a person).
export const events = mc.table(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(), // view | click
    path: text("path").notNull(),
    target: text("target"), // what was clicked, e.g. "whatsapp", "view_post"
    targetId: uuid("target_id"), // the card or post it belongs to
    referrer: text("referrer"), // referring site's host
    visitor: text("visitor").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("events_type_created_idx").on(t.type, t.createdAt), check("events_type_check", sql`${t.type} in ('view','click')`)],
);
