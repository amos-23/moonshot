import { beforeAll, describe, expect, it } from "vitest";
import type { DB } from "@/lib/db";
import { testDb, makeUser } from "./helpers";
import {
  cancelRequest,
  connectionOverview,
  removeConnection,
  respondToRequest,
  sendConnectionRequest,
} from "@/lib/services/connections";
import { listConversations, listMessages, markRead, sendMessage, unreadTotal } from "@/lib/services/messaging";
import { block, canViewProfile, discover, setSaved, savedProfilesFor } from "@/lib/services/people";
import { cancelMeeting, meetingsFor, proposeMeeting, respondToMeeting } from "@/lib/services/meetings";
import { createMeetup, getMeetup, joinMeetup, leaveMeetup } from "@/lib/services/meetups";
import { createReport, listReports } from "@/lib/services/moderation";
import * as schema from "@/lib/db/schema";

let db: DB;
beforeAll(async () => {
  db = await testDb();
});

describe("discovery", () => {
  it("ranks complementary people first and explains why", async () => {
    const founder = await makeUser(db, {
      name: "Ada Founder",
      roleCategory: "founder",
      interests: ["fintech", "growth"],
      goals: ["find_partners", "meet_investors"],
    });
    const marketer = await makeUser(db, {
      name: "Bola Marketer",
      roleCategory: "marketing",
      interests: ["growth", "fintech"],
      offers: ["marketing", "distribution"],
      goals: ["discover_startups"],
    });
    await makeUser(db, { name: "Chidi Unrelated", interests: ["climate"], attendance: "remote" });
    const results = await discover(db, founder.profile);
    expect(results[0].profile.userId).toBe(marketer.user.id);
    expect(results[0].reasons.map((r) => r.text).join(" ")).toMatch(/distribution|marketing/i);
    expect(results.every((r) => r.profile.userId !== founder.user.id)).toBe(true);

    const searched = await discover(db, founder.profile, { q: "bola" });
    expect(searched).toHaveLength(1);
    const filtered = await discover(db, founder.profile, { role: "marketing" });
    expect(filtered.map((r) => r.profile.userId)).toContain(marketer.user.id);
    expect(filtered.every((r) => r.profile.roleCategory === "marketing")).toBe(true);
  });

  it("hides hidden profiles and blocked users", async () => {
    const viewer = await makeUser(db);
    const hidden = await makeUser(db, { visibility: "hidden", name: "Hidden Person" });
    const blocker = await makeUser(db, { name: "Blocker Person" });
    await block(db, blocker.user.id, viewer.user.id);
    const ids = (await discover(db, viewer.profile)).map((r) => r.profile.userId);
    expect(ids).not.toContain(hidden.user.id);
    expect(ids).not.toContain(blocker.user.id);
    expect(await canViewProfile(db, viewer.user.id, blocker.profile)).toBe(false);
    expect(await canViewProfile(db, viewer.user.id, hidden.profile)).toBe(false);
    expect(await canViewProfile(db, null, viewer.profile)).toBe(false); // members-only
  });

  it("saves profiles", async () => {
    const a = await makeUser(db);
    const b = await makeUser(db);
    await setSaved(db, a.user.id, b.user.id, true);
    await setSaved(db, a.user.id, b.user.id, true); // idempotent
    expect((await savedProfilesFor(db, a.user.id)).map((r) => r.profile.userId)).toEqual([b.user.id]);
    await setSaved(db, a.user.id, b.user.id, false);
    expect(await savedProfilesFor(db, a.user.id)).toHaveLength(0);
  });
});

describe("connection requests", () => {
  it("sends, prevents duplicates, and accepts", async () => {
    const a = await makeUser(db);
    const b = await makeUser(db);
    const res = await sendConnectionRequest(db, a.user.id, b.user.id, "Hi! Let's talk payments.");
    expect(res.status).toBe("sent");
    await expect(sendConnectionRequest(db, a.user.id, b.user.id, "again")).rejects.toThrow(/already sent/);

    // Only the recipient may respond.
    await expect(respondToRequest(db, a.user.id, res.requestId, "accept")).rejects.toThrow(/not found/i);
    const overviewB = await connectionOverview(db, b.user.id);
    expect(overviewB.incoming).toHaveLength(1);
    expect(overviewB.incoming[0].req.message).toBe("Hi! Let's talk payments.");

    await respondToRequest(db, b.user.id, res.requestId, "accept");
    await expect(respondToRequest(db, b.user.id, res.requestId, "decline")).rejects.toThrow(/already/);
    await expect(sendConnectionRequest(db, b.user.id, a.user.id, "")).rejects.toThrow(/already connected/);
    expect((await connectionOverview(db, a.user.id)).connections).toHaveLength(1);
  });

  it("treats a reverse request as acceptance", async () => {
    const a = await makeUser(db);
    const b = await makeUser(db);
    await sendConnectionRequest(db, a.user.id, b.user.id, "");
    const res = await sendConnectionRequest(db, b.user.id, a.user.id, "");
    expect(res.status).toBe("accepted");
  });

  it("enforces contact preferences and lets requesters cancel", async () => {
    const a = await makeUser(db, { interests: ["ai"] });
    const closed = await makeUser(db, { contactPreference: "nobody" });
    const picky = await makeUser(db, { contactPreference: "shared_interests", interests: ["climate"] });
    await expect(sendConnectionRequest(db, a.user.id, closed.user.id, "")).rejects.toThrow(/isn't accepting/);
    await expect(sendConnectionRequest(db, a.user.id, picky.user.id, "")).rejects.toThrow(/share an interest/);
    const c = await makeUser(db);
    const r = await sendConnectionRequest(db, a.user.id, c.user.id, "");
    await cancelRequest(db, a.user.id, r.requestId);
    // Declined/cancelled requests don't block a new one.
    expect((await sendConnectionRequest(db, a.user.id, c.user.id, "")).status).toBe("sent");
  });

  it("enforces the unique live-pair constraint at the database level", async () => {
    const a = await makeUser(db);
    const b = await makeUser(db);
    await db.insert(schema.connectionRequests).values({ requesterId: a.user.id, recipientId: b.user.id });
    await expect(
      db.insert(schema.connectionRequests).values({ requesterId: b.user.id, recipientId: a.user.id }),
    ).rejects.toThrow();
  });
});

describe("messaging", () => {
  it("only lets connected participants read and write", async () => {
    const a = await makeUser(db);
    const b = await makeUser(db);
    const outsider = await makeUser(db);
    const r = await sendConnectionRequest(db, a.user.id, b.user.id, "");
    await respondToRequest(db, b.user.id, r.requestId, "accept");
    const [conv] = await listConversations(db, a.user.id);
    expect(conv.profile.userId).toBe(b.user.id);

    await sendMessage(db, a.user.id, conv.conv.id, "Hello there");
    await sendMessage(db, b.user.id, conv.conv.id, "Hi!");
    expect(await unreadTotal(db, b.user.id)).toBe(1);
    await markRead(db, b.user.id, conv.conv.id);
    expect(await unreadTotal(db, b.user.id)).toBe(0);

    const msgs = await listMessages(db, b.user.id, conv.conv.id);
    expect(msgs.map((m) => m.body)).toEqual(["Hello there", "Hi!"]);
    const after = await listMessages(db, a.user.id, conv.conv.id, msgs[0].createdAt);
    expect(after.map((m) => m.body)).toEqual(["Hi!"]);

    await expect(listMessages(db, outsider.user.id, conv.conv.id)).rejects.toThrow(/not found/i);
    await expect(sendMessage(db, outsider.user.id, conv.conv.id, "sneaky")).rejects.toThrow(/not found/i);
    await expect(sendMessage(db, a.user.id, conv.conv.id, "   ")).rejects.toThrow(/empty/);

    // Reporting: outsiders can't report (and so can't reveal) a message.
    await expect(createReport(db, outsider.user.id, { targetType: "message", targetId: msgs[0].id, reason: "spam", details: "" })).rejects.toThrow();
    await createReport(db, b.user.id, { targetType: "message", targetId: msgs[0].id, reason: "spam", details: "test" });
    const reports = await listReports(db);
    expect(reports.some((x) => x.excerpt === "Hello there")).toBe(true);

    // After removal or block, messaging stops.
    await removeConnection(db, a.user.id, b.user.id);
    await expect(sendMessage(db, a.user.id, conv.conv.id, "still there?")).rejects.toThrow(/connected/);
  });

  it("blocking ends the connection", async () => {
    const a = await makeUser(db);
    const b = await makeUser(db);
    const r = await sendConnectionRequest(db, a.user.id, b.user.id, "");
    await respondToRequest(db, b.user.id, r.requestId, "accept");
    await block(db, b.user.id, a.user.id);
    const [conv] = await listConversations(db, a.user.id);
    await expect(sendMessage(db, a.user.id, conv.conv.id, "hi")).rejects.toThrow(/connected/);
    await expect(sendConnectionRequest(db, a.user.id, b.user.id, "")).rejects.toThrow(/isn't available/);
  });
});

describe("meetings and meetups", () => {
  it("requires the invitee to confirm a meeting", async () => {
    const a = await makeUser(db);
    const b = await makeUser(db);
    const stranger = await makeUser(db);
    const input = { inviteeId: b.user.id, startsAt: new Date(Date.now() + 86_400_000), durationMinutes: 30, location: "Coffee area", note: "" };
    await expect(proposeMeeting(db, a.user.id, input)).rejects.toThrow(/connections/);
    const r = await sendConnectionRequest(db, a.user.id, b.user.id, "");
    await respondToRequest(db, b.user.id, r.requestId, "accept");
    const m = await proposeMeeting(db, a.user.id, input);
    expect(m.status).toBe("proposed");
    await expect(respondToMeeting(db, a.user.id, m.id, "confirm")).rejects.toThrow(/not found/i);
    await expect(respondToMeeting(db, stranger.user.id, m.id, "confirm")).rejects.toThrow(/not found/i);
    const confirmed = await respondToMeeting(db, b.user.id, m.id, "confirm");
    expect(confirmed.status).toBe("confirmed");
    expect((await meetingsFor(db, a.user.id))[0].meeting.status).toBe("confirmed");
    await cancelMeeting(db, a.user.id, m.id);
    expect(await meetingsFor(db, a.user.id)).toHaveLength(0);
  });

  it("enforces meetup capacity and privacy of attendee lists", async () => {
    const org = await makeUser(db, { visibility: "public" });
    const shy = await makeUser(db, { visibility: "hidden" });
    const other = await makeUser(db);
    const m = await createMeetup(db, org.user.id, {
      title: "AI agents breakfast",
      description: "",
      topic: "ai_agents",
      startsAt: new Date(Date.now() + 86_400_000),
      location: "Lobby",
      onlineUrl: null,
      capacity: 2,
    });
    await joinMeetup(db, shy.user.id, m.id);
    await expect(joinMeetup(db, other.user.id, m.id)).rejects.toThrow(/full/);
    const view = await getMeetup(db, other.user.id, m.id);
    expect(view!.total).toBe(2);
    expect(view!.visible.map((p) => p.userId)).toEqual([org.user.id]);
    await leaveMeetup(db, shy.user.id, m.id);
    await joinMeetup(db, other.user.id, m.id);
    expect((await getMeetup(db, other.user.id, m.id))!.joined).toBe(true);
  });
});
