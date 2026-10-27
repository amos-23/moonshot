// End-to-end check of the main flows in a real browser (Playwright + Chromium).
// Needs a running server with ADMIN_KEY=test-admin-key-123:
//   BASE_URL=http://localhost:3000 SCREENSHOTS=./test-results npm run test:e2e
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import fs from "node:fs";

// Resolved via require so a globally installed Playwright (NODE_PATH) also works.
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SCREENSHOTS;
const ADMIN_KEY = process.env.ADMIN_KEY ?? "test-admin-key-123";
const run = Date.now().toString(36);
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const errors = [];

async function visitor(opts = mobile) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page };
}
const shot = (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const chip = (page, label) => page.locator("fieldset label").getByText(label, { exact: true }).click();
const step = (s) => console.log(`• ${s}`);

async function makeCard(page, { name, headline, wants = [], offers = [], interests = [], whatsapp, x }) {
  await page.goto(`${BASE}/card`);
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("What you do").fill(headline);
  for (const w of wants) await chip(page, w);
  for (const o of offers) await chip(page, o);
  for (const i of interests) await chip(page, i);
  if (whatsapp) await page.getByLabel("WhatsApp").fill(whatsapp);
  if (x) await page.getByLabel("X handle").fill(x);
  await page.getByRole("button", { name: "Create my card" }).click();
  await page.waitForURL(/\/people\?welcome=1/);
}

try {
  step("home page shows the pitch and the independence note");
  const anon = await visitor();
  await anon.page.goto(BASE);
  await anon.page.getByRole("heading", { name: /meet the right people at moonshot/i }).waitFor();
  assert.ok(await anon.page.getByText(/isn.t run or endorsed by TechCabal/i).isVisible());
  await shot(anon.page, "01-home");

  step("validation keeps what you typed and asks for a contact");
  const ada = await visitor();
  await ada.page.goto(`${BASE}/card`);
  await ada.page.getByLabel("Your name").fill(`Ada ${run}`);
  await ada.page.getByLabel("What you do").fill("Founder, payments startup");
  await ada.page.getByRole("button", { name: "Create my card" }).click();
  await ada.page.getByText("Add at least one way for people to reach you").waitFor();
  assert.equal(await ada.page.getByLabel("Your name").inputValue(), `Ada ${run}`);
  await shot(ada.page, "02-card-form");

  step("Ada creates her card (no sign-in)");
  await makeCard(ada.page, { name: `Ada ${run}`, headline: "Founder, payments startup", wants: ["Business partners", "Investors"], interests: ["Fintech"], whatsapp: "+2348030000000" });
  await ada.page.getByText(/your card is live/i).waitFor();

  step("Bola creates a complementary card and sees Ada ranked with a reason");
  const bola = await visitor();
  await makeCard(bola.page, { name: `Bola ${run}`, headline: "Growth lead", wants: ["Founders"], offers: ["Distribution & partnerships", "Marketing & growth"], interests: ["Fintech"], x: "@bola_grows" });
  const adaCard = bola.page.locator("li", { hasText: `Ada ${run}` }).first();
  await adaCard.waitFor();
  assert.match(await adaCard.innerText(), /Ada wants business partners — you offer distribution/i);
  await shot(bola.page, "03-people");

  step("Ada sees Bola with WhatsApp/X contact buttons and a match reason");
  await ada.page.goto(`${BASE}/people?q=${encodeURIComponent(`Bola ${run}`)}`);
  const bolaCard = ada.page.locator("li", { hasText: `Bola ${run}` });
  await bolaCard.getByRole("link", { name: "@bola_grows" }).waitFor();
  assert.equal(await bolaCard.getByRole("link", { name: "@bola_grows" }).getAttribute("href"), "https://x.com/bola_grows");
  await bolaCard.getByRole("link", { name: `Bola ${run}` }).click();
  await ada.page.getByText(/why you should meet/i).waitFor();
  await ada.page.getByRole("button", { name: `Save Bola ${run}` }).click();
  await ada.page.goto(`${BASE}/people?view=saved`);
  await ada.page.locator("li", { hasText: `Bola ${run}` }).waitFor();
  await shot(ada.page, "04-saved");

  step("filters work");
  await anon.page.goto(`${BASE}/people?offer=distribution`);
  await anon.page.locator("li", { hasText: `Bola ${run}` }).waitFor();
  assert.equal(await anon.page.locator("li", { hasText: `Ada ${run}` }).count(), 0);

  step("Ada shares where to find her; she appears under 'Findable now'");
  await ada.page.goto(`${BASE}/card`);
  await ada.page.getByLabel(/find me at/i).fill("Coffee stand by Hall A");
  await ada.page.getByRole("button", { name: "Update" }).click();
  await ada.page.getByText(/people can find you/i).waitFor();
  await anon.page.goto(`${BASE}/people?here=1`);
  await anon.page.getByText("Coffee stand by Hall A").first().waitFor();

  step("edit link restores the card on another device");
  await ada.page.goto(`${BASE}/card`);
  await ada.ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  await ada.page.getByRole("button", { name: "Copy edit link" }).click();
  const editLink = await ada.page.evaluate(() => navigator.clipboard.readText());
  assert.match(editLink, /\/card\/claim\//);
  const laptop = await visitor({ viewport: { width: 1280, height: 900 } });
  await laptop.page.goto(editLink);
  await laptop.page.getByText(/card unlocked on this device/i).waitFor();
  assert.equal(await laptop.page.getByLabel("Your name").inputValue(), `Ada ${run}`);
  await laptop.page.goto(`${BASE}/card/claim/not-a-real-token`);
  await laptop.page.getByText(/isn.t valid/i).waitFor();

  step("Ada starts a hangout; Bola joins; capacity is enforced");
  await ada.page.goto(`${BASE}/hangouts`);
  await ada.page.getByText("+ Start a hangout").click();
  await ada.page.getByLabel(/what.s it about/i).fill(`Fintech coffee ${run}`);
  await ada.page.getByLabel("Where", { exact: true }).fill("Main stage");
  await ada.page.getByLabel("Max people").fill("2");
  await ada.page.getByRole("button", { name: "Start hangout" }).click();
  await ada.page.waitForURL(/created=1/);
  const hang = (p) => p.locator("li", { hasText: `Fintech coffee ${run}` });
  await bola.page.goto(`${BASE}/hangouts`);
  await hang(bola.page).getByRole("button", { name: "I'm in" }).click();
  await hang(bola.page).getByRole("button", { name: "Leave" }).waitFor();
  const third = await visitor();
  await makeCard(third.page, { name: `Chidi ${run}`, headline: "Engineer", whatsapp: "+2348030000001" });
  await third.page.goto(`${BASE}/hangouts`);
  await hang(third.page).getByRole("button", { name: "Full" }).click();
  await hang(third.page).getByText("This hangout is full.").waitFor();
  await shot(bola.page, "05-hangouts");

  step("anonymous visitors are asked to make a card before joining");
  await anon.page.goto(`${BASE}/hangouts`);
  await hang(anon.page).getByRole("button", { name: /I'm in|Full/ }).click();
  await hang(anon.page).getByText(/make your card first/i).waitFor();

  step("admin: wrong key refused, right key works; import posts; hide a card");
  const admin = await visitor({ viewport: { width: 1280, height: 900 } });
  await admin.page.goto(`${BASE}/admin`);
  await admin.page.getByPlaceholder("Admin key").fill("wrong-key-wrong");
  await admin.page.getByRole("button", { name: "Enter" }).click();
  await admin.page.getByText("That key isn't right.").waitFor();
  await admin.page.getByPlaceholder("Admin key").fill(ADMIN_KEY);
  await admin.page.getByRole("button", { name: "Enter" }).click();
  await admin.page.getByText(/cards ·/).waitFor();
  const id = "1849" + String(Date.now()).slice(-15);
  await admin.page.getByLabel("Public X post links").fill(JSON.stringify([{ url: `https://x.com/e2e_${run.slice(0, 6)}/status/${id}`, content: `E2E ${run} who is going to Moonshot? Looking to meet investors`, authorName: "E2E Tester" }]));
  await admin.page.getByRole("button", { name: "Add posts" }).click();
  await admin.page.getByText(/1 added/).waitFor();
  await shot(admin.page, "06-admin");

  await anon.page.goto(`${BASE}/conversation?theme=investors`);
  const post = anon.page.locator("li", { hasText: `E2E ${run}` });
  await post.waitFor();
  assert.match(await post.getByRole("link", { name: /invite to connect/i }).getAttribute("href"), /^https:\/\/x\.com\/intent\/post\?/);
  await shot(anon.page, "07-on-x");

  step("admin hides a card and it disappears from the directory");
  await admin.page.goto(`${BASE}/admin`);
  await admin.page.locator("li", { hasText: `Chidi ${run}` }).getByRole("button", { name: "Hide" }).click();
  await admin.page.locator("li", { hasText: `Chidi ${run}` }).getByRole("button", { name: "Unhide" }).waitFor();
  await anon.page.goto(`${BASE}/people?q=${encodeURIComponent(`Chidi ${run}`)}`);
  await anon.page.getByText(/no one matches/i).waitFor();

  step("Ada deletes her card");
  await ada.page.goto(`${BASE}/card`);
  ada.page.once("dialog", (d) => d.accept());
  await ada.page.getByRole("button", { name: "Delete my card" }).click();
  await ada.page.waitForURL(/deleted=1/);
  await anon.page.goto(`${BASE}/people?q=${encodeURIComponent(`Ada ${run}`)}`);
  await anon.page.getByText(/no one matches/i).waitFor();

  if (SHOTS) {
    await bola.page.goto(`${BASE}/card`);
    await shot(bola.page, "08-my-card");
    await bola.page.goto(BASE);
    await shot(bola.page, "09-home-with-card");
  }
  assert.deepEqual(errors, [], "no uncaught page errors");
  console.log("\nAll end-to-end checks passed.");
} catch (err) {
  console.error("\nE2E FAILED:", err);
  if (SHOTS) {
    let i = 0;
    for (const c of browser.contexts()) for (const p of c.pages()) await p.screenshot({ path: `${SHOTS}/failure-${i++}.png`, fullPage: true }).catch(() => {});
  }
  process.exitCode = 1;
} finally {
  await browser.close();
}
