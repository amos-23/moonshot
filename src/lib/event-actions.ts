"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getAccount } from "@/lib/auth";
import { rateLimit } from "@/lib/me";
import { getEventById, ownedEvents } from "@/lib/events";
import { parseEventForm } from "@/lib/event-form";
import { canManageEvent } from "@/lib/event-access";
import type { Result } from "@/lib/actions";

// People with an account can create their own events. A new event works straight away at its own address
// (so the organiser can share it); it joins the homepage list once an admin approves it.

const MAX_EVENTS_PER_ACCOUNT = 5;

export async function createEventAction(_: Result | null, form: FormData): Promise<Result> {
  const account = await getAccount();
  if (!account) return { ok: false, error: "Sign in or create an account first." };
  const parsed = parseEventForm(form);
  if (!parsed.ok) return parsed;
  const db = await getDb();
  if ((await ownedEvents(db, account.id)).length >= MAX_EVENTS_PER_ACCOUNT) return { ok: false, error: `You can create up to ${MAX_EVENTS_PER_ACCOUNT} events. Get in touch if you need more.` };
  if (!(await rateLimit("create_event", 5, 60))) return { ok: false, error: "Too many new events from this network. Try again later." };
  const clash = await db.query.eventSpaces.findFirst({ where: eq(schema.eventSpaces.slug, parsed.values.slug) });
  if (clash) return { ok: false, error: "Another event already uses that address. Pick another.", fields: { slug: "Already taken" } };
  await db.insert(schema.eventSpaces).values({ ...parsed.values, ownerId: account.id, listed: false, position: 200 });
  revalidatePath("/", "layout");
  redirect(`/${parsed.values.slug}/manage?created=1`);
}

export async function updateOwnEventAction(_: Result | null, form: FormData): Promise<Result> {
  const db = await getDb();
  const event = await getEventById(db, String(form.get("id") ?? ""));
  if (!event || !(await canManageEvent(event))) return { ok: false, error: "Only the event's organiser can change it." };
  const parsed = parseEventForm(form);
  if (!parsed.ok) return parsed;
  const clash = await db.query.eventSpaces.findFirst({ where: eq(schema.eventSpaces.slug, parsed.values.slug) });
  if (clash && clash.id !== event.id) return { ok: false, error: "Another event already uses that address.", fields: { slug: "Already taken" } };
  await db.update(schema.eventSpaces).set(parsed.values).where(eq(schema.eventSpaces.id, event.id));
  revalidatePath("/", "layout");
  if (parsed.values.slug !== event.slug) redirect(`/${parsed.values.slug}/manage`);
  return { ok: true, message: "Saved." };
}

type Kind = "person" | "post" | "comment" | "moment" | "checkin";

/** Which event something belongs to, so only that event's organiser (or an admin) can hide it. */
async function eventOf(kind: Kind, id: string): Promise<string | null> {
  const db = await getDb();
  const one = async (q: Promise<{ eventId: string }[]>) => (await q)[0]?.eventId ?? null;
  if (kind === "person") return one(db.select({ eventId: schema.people.eventId }).from(schema.people).where(eq(schema.people.id, id)).limit(1));
  if (kind === "moment") return one(db.select({ eventId: schema.moments.eventId }).from(schema.moments).where(eq(schema.moments.id, id)).limit(1));
  if (kind === "checkin") return one(db.select({ eventId: schema.checkins.eventId }).from(schema.checkins).where(eq(schema.checkins.id, id)).limit(1));
  if (kind === "post") return one(db.select({ eventId: schema.socialPosts.eventId }).from(schema.socialPosts).where(eq(schema.socialPosts.id, id)).limit(1));
  return one(
    db
      .select({ eventId: schema.socialPosts.eventId })
      .from(schema.comments)
      .innerJoin(schema.socialPosts, eq(schema.socialPosts.id, schema.comments.postId))
      .where(eq(schema.comments.id, id))
      .limit(1),
  );
}

/** Organisers: hide (or bring back) a card, moment, comment, X card or check-in in their own event. */
export async function ownerSetHiddenAction(kind: Kind, id: string, hidden: boolean): Promise<Result> {
  const eventId = await eventOf(kind, id);
  const db = await getDb();
  const event = eventId ? await getEventById(db, eventId) : null;
  if (!event || !(await canManageEvent(event))) return { ok: false, error: "Only the event's organiser can do that." };
  const table = { person: schema.people, moment: schema.moments, checkin: schema.checkins, post: schema.socialPosts, comment: schema.comments }[kind];
  await db.update(table).set({ hidden }).where(eq(table.id, id));
  revalidatePath("/", "layout");
  return { ok: true, message: hidden ? "Hidden." : "Back on." };
}
