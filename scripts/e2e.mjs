// End-to-end smoke test of the core flows in a real browser (Playwright + Chromium).
// Requires a running server with demo auth enabled and ADMIN_EMAILS including admin@example.com:
//   BASE_URL=http://localhost:3000 SCREENSHOTS=./test-results npm run test:e2e
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import fs from "node:fs";

// Resolved via require so a globally installed Playwright (NODE_PATH) also works.
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SCREENSHOTS;
const run = Date.now().toString(36);
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const consoleErrors = [];

async function newUser(email, opts = mobile) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => consoleErrors.push(`${email}: ${e.message}`));
  await page.goto(`${BASE}/login?next=/onboarding`);
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForURL((u) => /^\/(onboarding|discover)/.test(new URL(u).pathname));
  return { ctx, page };
}

async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

const chip = (page, label) => page.locator("fieldset label").getByText(label, { exact: true }).click();

async function onboardQuick(p, name) {
  await p.goto(`${BASE}/onboarding`);
  if (new URL(p.url()).pathname !== "/onboarding") return;
  await p.getByLabel("Name").fill(name);
  await p.getByLabel("Job title or role").fill("Tester");
  await p.getByLabel("Short bio").fill("Testing Moonshot Connect end to end.");
  await chip(p, "Fintech");
  await chip(p, "Meet interesting people");
  await p.getByRole("button", { name: /create my profile/i }).click();
  await p.waitForURL(/\/discover/);
}

function step(name) {
  console.log(`• ${name}`);
}

try {
  step("landing page renders with CTAs and disclaimer");
  {
    const ctx = await browser.newContext(mobile);
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.getByRole("heading", { name: /meet the right people/i }).waitFor();
    await page.getByRole("link", { name: /find your people/i }).first().waitFor();
    await page.getByRole("link", { name: /explore the conversation/i }).first().waitFor();
    assert.ok(await page.getByText(/not affiliated with/i).first().isVisible());
    await shot(page, "01-landing");
    await ctx.close();
  }

  step("signed-out users are redirected from private pages");
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/my`);
    await page.waitForURL(/\/login/);
    const res = await page.goto(`${BASE}/admin`);
    assert.match(page.url(), /\/login/, `admin should redirect, got ${res?.status()} ${page.url()}`);
    await ctx.close();
  }

  step("Alice onboards (validation errors keep input, then success)");
  const alice = await newUser(`alice-${run}@example.com`);
  {
    const p = alice.page;
    await p.getByLabel("Name").fill("Alice Adeyemi");
    await p.getByRole("button", { name: /create my profile/i }).click();
    await p.getByText(/please fix the highlighted fields/i).waitFor();
    assert.equal(await p.getByLabel("Name").inputValue(), "Alice Adeyemi", "form keeps values after error");
    await p.getByLabel("Job title or role").fill("Founder & CEO");
    await p.getByLabel("Which best describes you?").selectOption("founder");
    await p.getByLabel(/company or project/i).fill(`AliceCo ${run}`);
    await p.getByLabel("Short bio").fill("Building SME payments for West Africa. Looking for partners.");
    for (const label of ["Fintech", "Growth & customer acquisition", "Payments"]) await chip(p, label);
    for (const label of ["Find business partners", "Meet investors"]) await chip(p, label);
    await shot(p, "02-onboarding");
    await p.getByRole("button", { name: /create my profile/i }).click();
    await p.waitForURL(/\/discover\?welcome=1/);
    await p.getByText(/your profile is live/i).waitFor();
    // Demo data, if seeded, should be clearly labelled and recommended with reasons.
    const reasons = await p.getByText(/why you might meet/i).count();
    console.log(`  recommendations with reasons: ${reasons}`);
    await shot(p, "03-discover");
  }

  step("Bob onboards with complementary offers");
  const bob = await newUser(`bob-${run}@example.com`);
  {
    const p = bob.page;
    await p.getByLabel("Name").fill(`Bob Marketer ${run}`);
    await p.getByLabel("Job title or role").fill("Growth lead");
    await p.getByLabel("Which best describes you?").selectOption("marketing");
    await p.getByLabel("Short bio").fill("I help startups acquire their first customers.");
    await chip(p, "Fintech");
    await chip(p, "Discover startups and products");
    await chip(p, "Marketing & growth expertise");
    await chip(p, "Distribution & partnerships");
    await p.getByRole("button", { name: /create my profile/i }).click();
    await p.waitForURL(/\/discover/);
  }

  step("Alice finds Bob via search, sees why, saves and sends a request");
  {
    const p = alice.page;
    await p.goto(`${BASE}/discover?q=${encodeURIComponent(`Bob Marketer ${run}`)}`);
    const card = p.locator("li", { hasText: `Bob Marketer ${run}` }).first();
    await card.waitFor();
    assert.match(await card.innerText(), /offers (distribution|marketing)/i, "card explains the match");
    await card.getByRole("button", { name: /save bob/i }).click();
    await card.getByText("Saved").waitFor();
    await card.getByRole("link", { name: "Connect" }).click();
    await p.getByLabel(/add a note/i).fill("Hi Bob! Would love your take on distribution.");
    await p.getByRole("button", { name: /send connection request/i }).click();
    await p.getByText(/withdraw request/i).waitFor();
    await p.reload();
    await p.getByText(/request sent/i).first().waitFor();
    await shot(p, "04-profile-pending");
  }

  step("Bob sees the pending request in My Moonshot and accepts");
  {
    const p = bob.page;
    await p.goto(`${BASE}/my`);
    const req = p.locator("div", { hasText: "Would love your take on distribution" }).last();
    await req.waitFor();
    await shot(p, "05-my-moonshot-request");
    await p.getByRole("button", { name: "Accept" }).first().click();
    await p.getByRole("link", { name: "Message", exact: true }).first().waitFor();
  }

  step("They exchange messages; Alice receives Bob's via polling");
  {
    await alice.page.goto(`${BASE}/messages`);
    await alice.page.getByText(`Bob Marketer ${run}`).click();
    await alice.page.waitForURL(/\/messages\/.+/);
    const convUrl = alice.page.url();

    await bob.page.goto(convUrl);
    await bob.page.getByLabel("Message", { exact: true }).fill("Hey Alice, happy to help!");
    await bob.page.getByRole("button", { name: "Send message" }).click();
    await bob.page.getByText("Hey Alice, happy to help!").waitFor();

    await alice.page.getByText("Hey Alice, happy to help!").waitFor({ timeout: 15000 }); // arrives via 4s polling
    await alice.page.getByLabel("Message", { exact: true }).fill("Brilliant — coffee tomorrow?");
    await alice.page.keyboard.press("Enter");
    await bob.page.getByText("Brilliant — coffee tomorrow?").waitFor({ timeout: 15000 });
    await shot(alice.page, "06-chat");

    step("an outsider cannot read the conversation");
    const eve = await newUser(`eve-${run}@example.com`, {});
    await onboardQuick(eve.page, "Eve Outsider");
    const res = await eve.page.goto(convUrl);
    assert.equal(res?.status(), 404, "outsider should get a 404 for the conversation");
    assert.ok(!(await eve.page.content()).includes("happy to help"), "outsider must not see messages");
    const api = await eve.page.request.get(convUrl.replace("/messages/", "/api/conversations/") + "/messages");
    assert.ok(api.status() === 404 || api.status() === 401, `API should refuse outsider, got ${api.status()}`);
    await eve.ctx.close();
  }

  step("Alice proposes a meeting; it's 'proposed' until Bob confirms");
  {
    const p = alice.page;
    await p.goto(`${BASE}/discover?q=${encodeURIComponent(`Bob Marketer ${run}`)}`);
    await p.getByRole("link", { name: /view & message/i }).first().click();
    await p.getByLabel(/location or meeting point/i).fill("Main entrance");
    await p.getByRole("button", { name: /propose meeting/i }).click();
    await p.getByText(/meeting proposed/i).waitFor();
    await p.goto(`${BASE}/my`);
    await p.getByText(/awaiting their reply/i).waitFor();

    await bob.page.goto(`${BASE}/my`);
    await bob.page.getByText(/needs your reply/i).waitFor();
    await bob.page.getByRole("button", { name: "Confirm" }).click();
    await bob.page.locator("text=Confirmed").first().waitFor();
    await p.reload();
    await p.locator("text=Confirmed").first().waitFor();
    await shot(p, "07-my-moonshot-meeting");
  }

  step("admin imports X posts (validates URLs, dedupes) and they appear on Conversation");
  const admin = await newUser("admin@example.com", { viewport: { width: 1280, height: 900 } });
  {
    const p = admin.page;
    await onboardQuick(p, "Admin");
    await p.goto(`${BASE}/admin/posts`);
    const id = `18${Date.now()}000`.slice(0, 19);
    const records = JSON.stringify([
      { url: `https://twitter.com/e2e_tester/status/${id}`, content: `E2E ${run}: who is going to Moonshot? Looking to meet founders building AI agents`, authorName: "E2E Tester" },
    ]);
    await p.getByLabel(/public x post urls/i).fill(`${records}`);
    await p.getByRole("button", { name: "Import posts" }).click();
    await p.getByText(/1 imported/).waitFor();
    await p.getByLabel(/public x post urls/i).fill(`https://x.com/e2e_tester/status/${id}\nhttps://example.com/not-a-post`);
    await p.getByRole("button", { name: "Import posts" }).click();
    await p.getByText(/0 imported, 1 already existed, 1 invalid/).waitFor();
    await shot(p, "08-admin-posts");

    await alice.page.goto(`${BASE}/conversation?q=${encodeURIComponent(`E2E ${run}`)}`);
    const post = alice.page.locator("li", { hasText: `E2E ${run}` });
    await post.waitFor();
    assert.match(await post.innerText(), /@e2e_tester/);
    assert.match(await post.innerText(), /Imported by an admin/);
    assert.equal(await post.getByRole("link", { name: /open on x/i }).getAttribute("href").then((h) => h?.startsWith("/go/post/")), true);
    await post.getByRole("button", { name: "Relevant" }).click();
    await post.getByRole("button", { name: /marked relevant/i }).waitFor();
    await alice.page.goto(`${BASE}/conversation?view=relevant`);
    await alice.page.locator("li", { hasText: `E2E ${run}` }).waitFor();
    await alice.page.goto(`${BASE}/conversation?theme=ai`);
    await shot(alice.page, "09-conversation");
  }

  step("admin adds an exhibitor; Alice saves it to My Moonshot");
  {
    const p = admin.page;
    await p.goto(`${BASE}/admin/exhibitors`);
    await p.getByLabel("Name", { exact: true }).fill(`E2E Exhibitor ${run}`);
    await p.getByLabel(/tagline/i).fill("Test entry");
    await p.getByText("Demo / fictional entry").click();
    await p.getByRole("button", { name: "Add exhibitor" }).click();
    await p.getByText("Exhibitor added.").waitFor();

    await alice.page.goto(`${BASE}/explore?q=${encodeURIComponent(`E2E Exhibitor ${run}`)}`);
    const card = alice.page.locator("li", { hasText: `E2E Exhibitor ${run}` });
    await card.getByText("Booth TBC").waitFor();
    await card.getByRole("button", { name: /save e2e/i }).click();
    await card.getByText("Saved").waitFor();
    await alice.page.goto(`${BASE}/my#saved`);
    await alice.page.getByText(`E2E Exhibitor ${run}`).waitFor();
  }

  step("Alice proposes a meetup and Bob joins it");
  {
    const p = alice.page;
    await p.goto(`${BASE}/explore/meetups/new`);
    await p.getByLabel("Title").fill(`E2E meetup ${run}`);
    await p.getByLabel(/meeting point/i).fill("Coffee bar");
    await p.getByLabel(/participant limit/i).fill("5");
    await p.getByRole("button", { name: "Propose meetup" }).click();
    await p.waitForURL(/\/explore\/meetups\/[0-9a-f-]{36}/);
    await p.getByText(/proposed — details may change/i).waitFor();
    const url = p.url();
    await bob.page.goto(url);
    await bob.page.getByRole("button", { name: "Join meetup" }).click();
    await bob.page.getByRole("button", { name: "Leave meetup" }).waitFor();
    await p.reload();
    await p.getByText("(2/5)").waitFor();
    await p.getByRole("button", { name: "Mark as confirmed" }).click();
    await p.locator("text=Confirmed").first().waitFor();
    await shot(p, "10-meetup");
  }

  step("Bob reports and blocks Alice; admin sees the report; messaging stops");
  {
    const p = bob.page;
    await p.goto(`${BASE}/discover?q=Alice%20Adeyemi`);
    await p.locator("li", { hasText: `AliceCo ${run}` }).getByRole("link").first().click();
    await p.getByText("Report", { exact: true }).click();
    await p.getByLabel("Reason").selectOption("spam");
    await p.getByLabel("Details", { exact: false }).fill(`e2e report ${run}`);
    await p.getByText("Also block this person").click();
    await p.getByRole("button", { name: "Send report" }).click();
    await p.waitForURL(/\/discover\?notice=reported/);
    await p.getByText(/our moderators will review/i).waitFor();
    const ids = await p.locator("li", { hasText: `AliceCo ${run}` }).count();
    assert.equal(ids, 0, "blocked person no longer appears in discovery");

    await admin.page.goto(`${BASE}/admin/reports`);
    await admin.page.getByText(`e2e report ${run}`).waitFor();
    await shot(admin.page, "11-admin-reports");

    await alice.page.goto(`${BASE}/messages`);
    await alice.page.getByText(`Bob Marketer ${run}`).click();
    await alice.page.getByText(/can no longer message/i).waitFor();
  }

  step("ordinary users cannot reach admin pages");
  {
    await alice.page.goto(`${BASE}/admin`);
    assert.ok(!alice.page.url().includes("/admin"), "non-admin redirected away from /admin");
  }

  step("admin metrics page loads with counts");
  await admin.page.goto(`${BASE}/admin/metrics`);
  await admin.page.getByText("Accepted connections").first().waitFor();
  await shot(admin.page, "12-admin-metrics");

  if (SHOTS) {
    step("extra screenshots");
    for (const [path, name] of [["/explore", "13-explore"], ["/explore?tab=meetups", "14-meetups"], ["/profile", "15-profile"], ["/messages", "16-messages"]]) {
      await alice.page.goto(`${BASE}${path}`);
      await shot(alice.page, name);
    }
  }

  assert.deepEqual(consoleErrors, [], "no uncaught page errors");
  console.log("\nAll end-to-end checks passed.");
} catch (err) {
  console.error("\nE2E FAILED:", err);
  if (SHOTS) {
    let i = 0;
    for (const ctx of browser.contexts()) for (const pg of ctx.pages()) await pg.screenshot({ path: `${SHOTS}/failure-${i++}.png`, fullPage: true }).catch(() => {});
  }
  process.exitCode = 1;
} finally {
  await browser.close();
}
