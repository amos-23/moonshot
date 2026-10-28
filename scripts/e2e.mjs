// End-to-end check in a real browser (Playwright + Chromium).
// Needs a running server with ADMIN_KEY set:
//   BASE_URL=http://localhost:3000 ADMIN_KEY=... SCREENSHOTS=./test-results npm run test:e2e
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import fs from "node:fs";
import zlib from "node:zlib";

// Resolved via require so a globally installed Playwright (NODE_PATH) also works.
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SCREENSHOTS;
const ADMIN_KEY = process.env.ADMIN_KEY ?? "test-admin-key-123";
const SAMPLE_POST = process.env.SAMPLE_POST ?? "https://x.com/Thedanieloreofe/status/2114706863631572995";
const run = Date.now().toString(36);
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const errors = [];
// A normal browser user agent: the tracker ignores "HeadlessChrome" as a bot.
const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
async function visitor(opts = mobile) {
  const ctx = await browser.newContext({ userAgent: UA, ...opts });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page };
}
const shot = (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const step = (s) => console.log(`• ${s}`);
const card = (page, text) => page.locator("li", { hasText: text }).first();

// A small valid PNG (solid colour) for the photo upload, built without extra dependencies.
function makePng(w = 48, h = 48) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, Buffer.from([232, 80, 42]))]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.concat(Array(h).fill(row)))), chunk("IEND", Buffer.alloc(0))]);
}

async function addCard(page, { name, headline, wants = [], offers = [], contact, where, photo }) {
  await page.goto(`${BASE}/card`);
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("What you do").fill(headline);
  if (wants.length) {
    await page.locator("#wants").click();
    for (const w of wants) await page.getByRole("checkbox", { name: w, exact: true }).check();
    await page.keyboard.press("Escape");
  }
  if (offers.length) {
    await page.getByText("More (optional)").click();
    await page.locator("#offers").click();
    for (const o of offers) await page.getByRole("checkbox", { name: o, exact: true }).check();
    await page.keyboard.press("Escape");
  }
  await page.getByLabel("Your X handle").fill(contact);
  await page.getByRole("button", { name: "Add me" }).click();
  await page.waitForURL(/\?added=card/);
  if (where || photo) {
    // Photos and "Catch me at" have their own page, reached from the "📸 Update" button.
    await page.getByRole("link", { name: "📸 Update" }).click();
    await page.waitForURL(/\/update/);
    if (where) await page.getByLabel(/catch me at/i).fill(where);
    if (photo) {
      await page.locator('input[type="file"]').setInputFiles({ name: "me.png", mimeType: "image/png", buffer: makePng() });
      await page.getByRole("img", { name: "Your photo" }).waitFor();
    }
    await page.getByRole("button", { name: "Post update" }).click();
    await page.waitForURL(/\?added=update/);
    await page.goto(`${BASE}/?added=card`);
  }
}

try {
  step("home shows the list and the independence note");
  const anon = await visitor();
  await anon.page.goto(BASE);
  await anon.page.getByRole("heading", { name: /who.s at moonshot/i }).waitFor();
  assert.ok(await anon.page.getByText(/isn.t run or endorsed by TechCabal/i).isVisible());

  step("card form keeps input on error");
  const ada = await visitor();
  await ada.page.goto(`${BASE}/card`);
  await ada.page.getByLabel("Name", { exact: true }).fill(`Ada ${run}`);
  await ada.page.getByLabel("What you do").fill("Founder, payments startup");
  await ada.page.getByRole("button", { name: "Add me" }).click();
  await ada.page.getByText(/add your x handle/i).first().waitFor();
  assert.equal(await ada.page.getByLabel("Name", { exact: true }).inputValue(), `Ada ${run}`);
  await shot(ada.page, "02-add-yourself");

  step("Ada adds herself with a WhatsApp number, a photo and where to catch her");
  await addCard(ada.page, { name: `Ada ${run}`, headline: "Founder, payments startup", wants: ["Business partners", "Investors"], contact: "+234 803 000 0000", where: "Booth 14, Hall B", photo: true });
  await ada.page.getByText(/you're on the list/i).waitFor();
  const shareX = await ada.page.getByRole("link", { name: "Share on X" }).getAttribute("href");
  assert.ok(new URL(shareX).searchParams.get("text").endsWith(`/?q=${encodeURIComponent(`Ada ${run}`)}`), "share link points to her card");
  await ada.page.goto(`${BASE}/card`);
  assert.equal(await ada.page.locator("#wants").innerText(), "Business partners, Investors", "multi-select keeps both choices");

  step("Bola adds herself with an @handle and sees why to meet Ada");
  const bola = await visitor();
  await addCard(bola.page, { name: `Bola ${run}`, headline: "Growth lead", wants: ["Founders"], offers: ["Distribution & partnerships"], contact: "bola_grows" });
  const adaCard = card(bola.page, `Ada ${run}`);
  assert.match(await adaCard.innerText(), /You want founders — Ada offers founder experience/);
  assert.match(await adaCard.innerText(), /Catch me at Booth 14, Hall B/);
  const photoSrc = await adaCard.getByRole("img", { name: `Ada ${run} at Moonshot` }).getAttribute("src");
  const photoRes = await bola.page.request.get(`${BASE}${photoSrc}`);
  assert.equal(photoRes.headers()["content-type"], "image/jpeg", "photo was resized to JPEG and served");
  assert.match(await adaCard.getByRole("link", { name: "WhatsApp" }).getAttribute("href"), /^https:\/\/wa\.me\/2348030000000\?text=/);

  step("filters, fresh feed, tag search and invites");
  await anon.page.goto(`${BASE}/?f=here`);
  await card(anon.page, `Ada ${run}`).waitFor();
  assert.equal(await anon.page.locator("li", { hasText: `Bola ${run}` }).count(), 0, "Bola has no 'catch me at'");
  await anon.page.goto(`${BASE}/?f=investors`);
  await anon.page.getByText(/want to meet investors/).waitFor();
  await anon.page.goto(`${BASE}/?q=${encodeURIComponent(`looking for investors ${run}`)}`);
  await card(anon.page, `Ada ${run}`).waitFor();
  await anon.page.goto(`${BASE}/?sort=new`);
  assert.match(await anon.page.locator("li").first().innerText(), new RegExp(`Bola ${run}[\\s\\S]*joined`), "newest card first, with 'joined'");
  const ghost = `Biliyamin ${run.replace(/\d/g, (d) => "abcdefghij"[d])}`; // letters only, like a real name
  await anon.page.goto(`${BASE}/?q=${encodeURIComponent(ghost)}`);
  await anon.page.getByText(`“${ghost}” isn't here yet`).waitFor();
  assert.match(decodeURIComponent(await anon.page.getByRole("link", { name: "Share on X" }).getAttribute("href")), /\/card/);
  await shot(anon.page, "07-invite");

  step("search works");
  await anon.page.goto(`${BASE}/?q=${encodeURIComponent(`Bola ${run}`)}`);
  assert.equal(await card(anon.page, `Bola ${run}`).getByRole("link", { name: "@bola_grows" }).getAttribute("href"), "https://x.com/bola_grows");
  assert.equal(await anon.page.locator("li", { hasText: `Ada ${run}` }).count(), 0);

  step("anyone can add a public X post; it shows as a 'From X' card");
  const x = await visitor();
  await x.page.goto(`${BASE}/card`);
  await x.page.getByLabel(/link to your post/i).fill("https://example.com/not-a-post");
  await x.page.getByRole("button", { name: "Add", exact: true }).click();
  await x.page.getByText(/paste a link to a post/i).waitFor();
  await x.page.getByLabel(/link to your post/i).fill(SAMPLE_POST);
  await x.page.getByRole("button", { name: "Add", exact: true }).click();
  const handle = SAMPLE_POST.split("/")[3];
  const outcome = await Promise.race([
    x.page.waitForURL(/\?added=x/).then(() => "added"),
    x.page.getByText(/already here|couldn.t load/i).waitFor().then(() => "skipped"),
  ]);
  if (outcome === "added") {
    const xc = card(x.page, `@${handle}`);
    await xc.getByText("From X").waitFor();
    assert.equal(await xc.getByRole("link", { name: /view post/i }).getAttribute("href"), SAMPLE_POST);
    await shot(x.page, "01-home");
  } else console.log("  (post already added, or X embed unreachable)");

  step("comments on an X card: name needed without a card, automatic with one");
  await anon.page.goto(BASE);
  const xcard = card(anon.page, `@${handle}`);
  if (await xcard.count()) {
    if (!(await xcard.getByPlaceholder("Say hi or ask to meet").isVisible())) await xcard.locator("summary", { hasText: /comment/i }).click();
    await xcard.getByPlaceholder("Say hi or ask to meet").fill(`Hi from anon ${run}`);
    await xcard.getByRole("button", { name: "Post" }).click();
    await xcard.getByText(/add your name/i).waitFor();
    await xcard.getByPlaceholder("Your name").fill(`Kemi ${run}`);
    await xcard.getByRole("button", { name: "Post" }).click();
    await xcard.getByText(`Hi from anon ${run}`).waitFor();
    assert.equal(await xcard.getByPlaceholder("Say hi or ask to meet").inputValue(), "", "input clears after posting");

    await bola.page.goto(BASE);
    const bcard = card(bola.page, `@${handle}`);
    if (!(await bcard.getByPlaceholder(/comment as/i).isVisible())) await bcard.locator("summary", { hasText: /comment/i }).click();
    await bcard.getByPlaceholder(`Comment as Bola ${run}`).fill(`Let's meet! ${run}`);
    await bcard.getByRole("button", { name: "Post" }).click();
    await bcard.getByText(`Let's meet! ${run}`).waitFor();
    assert.match(await bcard.innerText(), new RegExp(`Bola ${run}`));
    await shot(bola.page, "05-comments");
  } else console.log("  (no X card to comment on)");

  step("edit link restores the card on another device; bad links are refused");
  await ada.ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  await ada.page.goto(`${BASE}/card`);
  await ada.page.getByRole("button", { name: "Copy edit link" }).click();
  const editLink = await ada.page.evaluate(() => navigator.clipboard.readText());
  const laptop = await visitor({ viewport: { width: 1280, height: 900 } });
  await laptop.page.goto(editLink);
  await laptop.page.getByText(/card unlocked/i).waitFor();
  assert.equal(await laptop.page.getByLabel("Name", { exact: true }).inputValue(), `Ada ${run}`);
  await laptop.page.goto(`${BASE}/card/claim/not-a-real-token`);
  await laptop.page.getByText(/isn.t valid/i).waitFor();
  await shot(ada.page, "03-my-card");

  step("admin: wrong key refused; right key hides a card");
  const admin = await visitor({ viewport: { width: 1280, height: 900 } });
  await admin.page.goto(`${BASE}/admin`);
  await admin.page.getByPlaceholder("Admin key").fill("definitely-wrong-key");
  await admin.page.getByRole("button", { name: "Enter" }).click();
  await admin.page.getByText("That key isn't right.").waitFor();
  await admin.page.getByPlaceholder("Admin key").fill(ADMIN_KEY);
  await admin.page.getByRole("button", { name: "Enter" }).click();
  await admin.page.getByText(/cards ·/).waitFor();
  await card(admin.page, `Bola ${run}`).getByRole("button", { name: "Hide" }).click();
  await card(admin.page, `Bola ${run}`).getByRole("button", { name: "Unhide" }).waitFor();
  await anon.page.goto(`${BASE}/?q=${encodeURIComponent(`Bola ${run}`)}`);
  await anon.page.getByText(/no one matches/i).waitFor();

  const nothing = `zzz-nobody-${run}`;
  // Repeat it so it ranks in the top-10 list even with earlier test searches around.
  for (let i = 0; i < 5; i++) await anon.page.goto(`${BASE}/?q=${nothing}`);
  await anon.page.getByText(/no one matches/i).waitFor();

  step("admin Stats shows visits, clicks and searches");
  await admin.page.goto(`${BASE}/admin/stats?days=1`);
  const tile = async (label) => Number((await admin.page.getByText(label, { exact: true }).locator("xpath=preceding-sibling::p[1]").innerText()).replace(/,/g, ""));
  assert.ok((await tile("Visits")) > 0, "visits recorded");
  await admin.page.getByText("Clicks by button").waitFor();
  assert.ok(await admin.page.getByText("Add me (card)").isVisible(), "click on 'Add me' recorded");
  assert.ok((await tile("Searches")) > 0, "searches recorded");
  const empty = admin.page.locator("div", { has: admin.page.getByRole("heading", { name: "Searches that found nothing" }) }).last();
  await empty.getByText(`“${nothing}”`).waitFor();
  await admin.page.goto(`${BASE}/admin/stats?days=7`);
  await admin.page.getByText("Visits per day").waitFor();
  await admin.page.getByText("From visit to connection").waitFor();
  await shot(admin.page, "06-stats");

  step("Ada deletes her card");
  ada.page.once("dialog", (d) => d.accept());
  await ada.page.getByRole("button", { name: "Delete my card" }).click();
  await ada.page.waitForURL((u) => new URL(u).pathname === "/");
  await anon.page.goto(`${BASE}/?q=${encodeURIComponent(`Ada ${run}`)}`);
  await anon.page.getByText(/no one matches/i).waitFor();

  if (SHOTS) {
    await laptop.page.goto(BASE);
    await shot(laptop.page, "04-home-desktop");
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
