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
/** Moments: "Add your moment" opens the share sheet. */
async function openShare(page) {
  if (!(await page.getByLabel(/what's happening/i).isVisible())) await page.getByRole("button", { name: "Add your moment" }).first().click();
  await page.getByLabel(/what's happening/i).waitFor();
}
const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Moments: open the tile whose text matches, and return the full-screen viewer. */
async function openMoment(page, text) {
  await page.getByRole("link", { name: new RegExp(`Open moment from .*${escapeRe(text)}`) }).first().click();
  const viewer = page.getByRole("dialog");
  await viewer.waitFor();
  return viewer;
}
const momentTiles = (page, text) => page.getByRole("link", { name: new RegExp(`Open moment from .*${escapeRe(text)}`) });

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
  if (photo) {
    // The card photo has its own page, offered right after signing up.
    await page.getByRole("link", { name: /add a photo to your card/i }).click();
    await page.waitForURL(/\/update/);
    await page.locator('input[type="file"]').setInputFiles({ name: "me.png", mimeType: "image/png", buffer: makePng() });
    await page.getByRole("img", { name: "Your photo" }).waitFor();
    await page.getByRole("button", { name: "Save photo" }).click();
    await page.waitForURL(/\?added=update/);
  }
  if (where) {
    // "Catch me at" comes from checking in on Meet up.
    await page.getByRole("link", { name: "📍 Meet up" }).click();
    await page.waitForURL(/\/meet/);
    await page.getByText(`Checking in as ${name}`).waitFor();
    await page.getByLabel("Where are you?").fill(where);
    await page.getByRole("button", { name: "📍 I'm here" }).click();
    await page.waitForURL(/checked=1/);
  }
  if (photo || where) await page.goto(`${BASE}/?added=card`);
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
  // Sharing her card: a /p/… link with a name-card preview, tagged as shared on X.
  const shareX = new URL(await ada.page.getByRole("link", { name: "Post on X" }).getAttribute("href"));
  assert.match(shareX.searchParams.get("text"), /#Moonshot2026/);
  const adaShare = shareX.searchParams.get("url");
  assert.match(adaShare, /\/p\/[0-9a-f-]{36}\?utm_source=x&utm_campaign=card$/, "share link is her card's own link");
  const adaPath = new URL(adaShare).pathname;
  const adaHtml = await (await ada.page.request.get(`${BASE}${adaPath}`)).text();
  assert.match(adaHtml, new RegExp(`<meta property="og:image" content="[^"]*/og/person/`));
  assert.match(adaHtml, /<meta name="twitter:card" content="summary_large_image"/);
  const personImg = await ada.page.request.get(`${BASE}/og/person/${adaPath.split("/").pop()}`);
  assert.equal(personImg.headers()["content-type"], "image/png");
  assert.ok((await personImg.body()).length > 10_000, "a real preview image");
  await ada.page.goto(`${BASE}${adaPath}?utm_source=x&utm_campaign=card`);
  await ada.page.waitForURL((u) => new URL(u).searchParams.get("q") !== null && new URL(u).searchParams.get("utm_campaign") === "card");
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

  step("Meet up: card holders and visitors without a card check in; others can reach them");
  await anon.page.goto(`${BASE}/meet`);
  const adaSpot = anon.page.locator("li", { hasText: `Ada ${run}` });
  await adaSpot.getByText("Booth 14, Hall B").waitFor();
  assert.match(await adaSpot.getByRole("link", { name: "WhatsApp" }).getAttribute("href"), /wa\.me\/2348030000000\?text=.*Booth%2014/);
  const walker = await visitor();
  const wh = `w_${run}`; // a unique X handle
  await walker.page.goto(`${BASE}/meet`);
  await walker.page.getByLabel("Where are you?").fill(`Coffee stand ${run}`);
  await walker.page.getByRole("button", { name: "📍 I'm here" }).click();
  await walker.page.getByText(/add your x handle/i).first().waitFor(); // no card: a handle is needed
  await walker.page.getByLabel("Your X handle").fill(`@${wh}`);
  await walker.page.getByRole("button", { name: "📍 I'm here" }).click(); // just two boxes
  await walker.page.waitForURL(/checked=1/);
  await walker.page.getByText(`You're checked in at Coffee stand ${run}`).waitFor();
  await anon.page.reload();
  const walkerSpot = anon.page.locator("li", { hasText: `@${wh}` });
  assert.equal(await walkerSpot.getByRole("link", { name: `@${wh}` }).getAttribute("href"), `https://x.com/${wh}`);
  assert.match(await walkerSpot.innerText(), /until/, "defaults to a time limit");
  await shot(anon.page, "10-meet");
  await walker.page.getByRole("button", { name: "I've left" }).click();
  await walker.page.getByText(`You're checked in at`).waitFor({ state: "detached" });
  await anon.page.reload();
  assert.equal(await anon.page.locator("li", { hasText: `@${wh}` }).count(), 0, "left people drop off the board");
  // A phone number instead of a handle needs a name (under "More options").
  await walker.page.goto(`${BASE}/meet`);
  await walker.page.getByLabel("Where are you?").fill(`Food village ${run}`);
  await walker.page.getByLabel("Your X handle").fill("+2348030001111");
  await walker.page.getByRole("button", { name: "📍 I'm here" }).click();
  await walker.page.getByText(/add your name/i).first().waitFor();
  await walker.page.getByLabel(/your name/i).fill(`Walker ${run}`);
  await walker.page.getByLabel(/for how long/i).selectOption("1");
  await walker.page.getByRole("button", { name: "📍 I'm here" }).click();
  await walker.page.waitForURL(/checked=1/);
  await anon.page.reload();
  await anon.page.locator("li", { hasText: `Walker ${run}` }).getByRole("link", { name: "WhatsApp" }).waitFor();
  await walker.ctx.close();

  step("filters, fresh feed, tag search and invites");
  await anon.page.goto(`${BASE}/?f=investors`);
  await anon.page.getByText(/want to meet investors/).waitFor();
  await anon.page.goto(`${BASE}/?q=${encodeURIComponent(`looking for investors ${run}`)}`);
  await card(anon.page, `Ada ${run}`).waitFor();
  await anon.page.goto(`${BASE}/?sort=new`);
  assert.match(await anon.page.locator("ul.grid > li").first().innerText(), new RegExp(`Bola ${run}[\\s\\S]*joined`), "newest card first, with 'joined'");
  const ghost = `Biliyamin ${run.replace(/\d/g, (d) => "abcdefghij"[d])}`; // letters only, like a real name
  await anon.page.goto(`${BASE}/?q=${encodeURIComponent(ghost)}`);
  await anon.page.getByText(`“${ghost}” isn't here yet`).waitFor();
  assert.match(decodeURIComponent(await anon.page.getByRole("link", { name: "Post on X" }).getAttribute("href")), /\/card\?utm_source=x&utm_campaign=invite/);
  await shot(anon.page, "07-invite");

  step("Moments: anyone can post photos or an update and tag people; card holders post as themselves");
  await anon.page.goto(BASE);
  await anon.page.getByRole("link", { name: "📸 Moments" }).click();
  await anon.page.waitForURL(/\/moments/);
  await openShare(anon.page);
  await anon.page.getByRole("button", { name: "Post", exact: true }).click();
  await anon.page.getByText("Add a photo, an X post link, or write something.").waitFor();
  await anon.page.getByLabel(/what's happening/i).fill(`The fintech panel is packed ${run} with @bola_grows`);
  await anon.page.getByLabel(/your name or @handle/i).fill("@moment_fan");
  await anon.page.locator('input[type="file"]').setInputFiles([
    { name: "m.png", mimeType: "image/png", buffer: makePng(64, 40) },
    { name: "m2.png", mimeType: "image/png", buffer: makePng(40, 64) },
  ]);
  await anon.page.getByRole("img", { name: "Your photo 2" }).waitFor();
  await anon.page.getByRole("button", { name: "Post", exact: true }).click();
  await anon.page.waitForURL(/posted=\d+/);
  await anon.page.getByText("Posted — thanks for sharing").waitFor();
  // Right after posting: share the new moment on X, with its own link.
  const postedShare = new URL(await anon.page.getByRole("link", { name: "Post it on X" }).getAttribute("href"));
  const momentLink = postedShare.searchParams.get("url");
  assert.match(momentLink, /\/m\/[0-9a-f-]{36}\?utm_source=x&utm_campaign=posted$/);
  const momentId = new URL(momentLink).pathname.split("/").pop();
  const mine = await openMoment(anon.page, `The fintech panel is packed ${run}`);
  const viewerShare = new URL(await mine.getByRole("link", { name: "Post on X" }).getAttribute("href"));
  assert.equal(new URL(viewerShare.searchParams.get("url")).pathname, `/m/${momentId}`, "the viewer shares the same moment");
  assert.match(viewerShare.searchParams.get("text"), /“The fintech panel is packed .*” — a moment from #Moonshot2026/);
  assert.equal(await mine.getByRole("link", { name: "@moment_fan", exact: true }).getAttribute("href"), "https://x.com/moment_fan");
  // Two photos: dots to move between them, each served as a JPEG.
  await mine.getByRole("button", { name: "Photo 2" }).click();
  const second = await mine.locator("img[src^='/moment-photo/']:not([aria-hidden])").getAttribute("src");
  assert.match(second, /\?n=1$/);
  for (const src of [second.replace(/\?n=1$/, ""), second]) assert.equal((await anon.page.request.get(`${BASE}${src}`)).headers()["content-type"], "image/jpeg");
  // Tagging @bola_grows links the moment to Bola's card.
  await mine.getByText("Follow up:").waitFor();
  assert.equal(await mine.getByRole("link", { name: /Bola/ }).getAttribute("href"), "/?q=bola_grows");
  // The viewer has its own link (for sharing) and closes with Escape.
  assert.match(anon.page.url(), /#m-/);
  await anon.page.keyboard.press("Escape");
  await mine.waitFor({ state: "detached" });
  // A shared moment link: the photo is its preview on X, and opening it goes straight to the moment.
  const mHtml = await (await anon.page.request.get(`${BASE}/m/${momentId}`)).text();
  assert.match(mHtml, new RegExp(`<meta property="og:image" content="[^"]*/og/moment/${momentId}"`));
  assert.match(mHtml, /<meta name="twitter:card" content="summary_large_image"/);
  const mImg = await anon.page.request.get(`${BASE}/og/moment/${momentId}`);
  assert.equal(mImg.headers()["content-type"], "image/png");
  assert.ok((await mImg.body()).length > 10_000);
  for (const og of ["/og/moments", "/og/site"]) assert.equal((await anon.page.request.get(`${BASE}${og}`)).headers()["content-type"], "image/png");
  await anon.page.goto(`${BASE}/m/${momentId}?utm_source=x&utm_campaign=moment`);
  await anon.page.waitForURL(new RegExp(`/moments\\?.*utm_campaign=moment.*#m-${momentId}$`));
  await anon.page.getByRole("dialog").getByText(`The fintech panel is packed ${run}`).waitFor();
  await anon.page.keyboard.press("Escape");

  await bola.page.goto(`${BASE}/moments`);
  assert.equal(await bola.page.getByLabel(/what's happening/i).isVisible(), false, "the share form waits behind \"Add your moment\"");
  await openShare(bola.page);
  await bola.page.getByText(`Posting as Bola ${run}`).waitFor();
  await bola.page.getByLabel(/what's happening/i).fill(`Grabbing coffee ${run}`);
  await bola.page.getByLabel("Where?").fill("Food village");
  await bola.page.getByRole("button", { name: "Post", exact: true }).click();
  await bola.page.waitForURL(/posted=\d+/);
  await (await openMoment(bola.page, `Grabbing coffee ${run}`)).getByRole("link", { name: `Bola ${run}` }).waitFor();
  await anon.page.goto(`${BASE}/?q=${encodeURIComponent(`Bola ${run}`)}`);
  assert.equal(await card(anon.page, `Bola ${run}`).getByText(/catch me at/i).count(), 0, "a moment's place doesn't touch the card");

  step("an X post can be shared as a moment");
  await anon.page.goto(`${BASE}/moments`);
  await openShare(anon.page);
  await anon.page.getByLabel(/share an x post/i).fill("https://example.com/nope");
  await anon.page.getByRole("button", { name: "Post", exact: true }).click();
  await anon.page.getByText("That isn't an X post link.").waitFor();
  await anon.page.getByLabel(/share an x post/i).fill(SAMPLE_POST);
  await anon.page.getByLabel(/what's happening/i).fill(`Worth a read ${run}`);
  await anon.page.getByRole("button", { name: "Post", exact: true }).click();
  const xm = await Promise.race([anon.page.waitForURL(/posted=\d+/).then(() => "posted"), anon.page.getByText(/couldn't load that x post/i).waitFor().then(() => "skipped")]);
  if (xm === "posted") {
    const xmoment = await openMoment(anon.page, `Worth a read ${run}`);
    await xmoment.getByText(`Worth a read ${run}`).waitFor();
    assert.equal(await xmoment.getByRole("link", { name: /view on x/i }).getAttribute("href"), SAMPLE_POST);
    await anon.page.keyboard.press("Escape");
  } else console.log("  (X unreachable from here; skipped)");
  await anon.page.goto(BASE);
  await anon.page.getByRole("heading", { name: /moments/i }).waitFor();
  await shot(anon.page, "08-moments-strip");
  await anon.page.goto(`${BASE}/moments`);
  await shot(anon.page, "09-moments");

  step("3 reports hide a moment automatically");
  for (let i = 0; i < 3; i++) {
    const v = await visitor();
    await v.page.goto(`${BASE}/moments`);
    v.page.once("dialog", (d) => d.accept("spam"));
    const target = await openMoment(v.page, `Grabbing coffee ${run}`);
    await target.getByRole("button", { name: "Report" }).click();
    // The third report hides the moment straight away, so the viewer may close with it.
    await Promise.race([target.getByText(/we'll take a look/i).waitFor(), target.waitFor({ state: "detached" })]);
    await v.ctx.close();
  }
  await anon.page.goto(`${BASE}/moments`);
  assert.equal(await momentTiles(anon.page, `Grabbing coffee ${run}`).count(), 0, "reported moment is hidden");

  step("search works");
  await anon.page.goto(`${BASE}/?q=${encodeURIComponent(`Bola ${run}`)}`);
  assert.equal(await card(anon.page, `Bola ${run}`).getByRole("link", { name: "@bola_grows" }).getAttribute("href"), "https://x.com/bola_grows");
  // Pressing a contact button counts as "contacted someone" (the X tab it opens is closed straight away).
  const [xTab] = await Promise.all([anon.ctx.waitForEvent("page"), card(anon.page, `Bola ${run}`).getByRole("link", { name: "@bola_grows" }).click()]);
  await xTab.close();
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

  step("X cards pick up the post's image and the author's picture");
  {
    let src = null;
    for (let i = 0; i < 10 && !src; i++) {
      await anon.page.goto(BASE); // each visit lets the background fill fetch a few posts' images
      const img = card(anon.page, `@${handle}`).getByRole("img", { name: /image from/i });
      src = (await img.count()) ? await img.getAttribute("src") : null;
      if (!src) await anon.page.waitForTimeout(1500);
    }
    if (src) assert.match(src, /^https:\/\/pbs\.twimg\.com\//);
    else console.log("  (no image found — X's embed data may be unreachable from here)");
  }

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

  step("anyone can sign up from the header (optional, nothing needs it)");
  await anon.page.goto(BASE);
  await anon.page.getByRole("link", { name: "Sign up", exact: true }).click();
  await anon.page.waitForURL(/\/signup/);
  await anon.page.getByLabel("Email").fill("not-an-email");
  await anon.page.getByRole("button", { name: "Sign up" }).click();
  await anon.page.getByText("That email doesn't look right").first().waitFor();
  await anon.page.getByLabel("Email").fill(`Fan.${run}@Example.com`);
  await anon.page.getByLabel(/what do you do/i).fill("=Founder");
  await anon.page.getByRole("button", { name: "Sign up" }).click();
  await anon.page.getByText("You're signed up 🎉").waitFor();
  await anon.page.goto(BASE);
  assert.equal(await anon.page.getByRole("link", { name: "Sign up", exact: true }).count(), 0, "header link goes away after signing up");

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
  // A name-like search with no result shows an invite instead of "no one matches".
  await anon.page.getByText(/no one matches|isn't here yet/i).waitFor();

  const nothing = `zzz-nobody-${run}`;
  // Repeat it so it ranks in the top-10 list even with earlier test searches around.
  for (let i = 0; i < 5; i++) await anon.page.goto(`${BASE}/?q=${nothing}`);
  await anon.page.getByText(/no one matches|isn't here yet/i).waitFor();

  step("admin sees sign-ups and can download them");
  await admin.page.goto(`${BASE}/admin`);
  await admin.page.getByText(`fan.${run}@example.com`).waitFor();
  const csv = await (await admin.page.request.get(`${BASE}/admin/signups.csv`)).text();
  assert.match(csv, new RegExp(`"fan\\.${run}@example\\.com",.*"'=Founder"`), "CSV has the sign-up, formula-safe");
  assert.equal((await anon.page.request.get(`${BASE}/admin/signups.csv`)).status(), 404, "CSV is admin-only");

  step("admin adds moments from many X links at once, or an update with no credit");
  await admin.page.goto(`${BASE}/admin`);
  await admin.page.getByLabel("X post links for Moments").fill(`https://example.com/nope\n${SAMPLE_POST}`);
  await admin.page.getByRole("button", { name: "Add", exact: true }).click();
  await admin.page.getByText(/couldn't be added\./).waitFor();
  assert.ok((await admin.page.getByText("Not an X post link").count()) > 0, "bad link is reported");
  // The sample post may already be a moment (shared above); either way it's in Moments now, unless X is unreachable.
  const xIn = (await admin.page.getByText(/^(1 added, 0|0 added, 1) already there/).count()) > 0;
  if (!xIn) console.log("  (X embed unreachable, skipped the X-link moment)");
  // Pasting a link adds it straight away (no button); the same link again is skipped, and the box clears.
  const linksBox = admin.page.getByLabel("X post links for Moments");
  await linksBox.evaluate((el, text) => {
    el.focus();
    const dt = new DataTransfer();
    dt.setData("text/plain", text);
    el.value = text;
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
  }, SAMPLE_POST);
  await admin.page.getByText(xIn ? /^0 added, 1 already there, 0/ : /^0 added, 0 already there, 1/).waitFor();
  assert.equal(await linksBox.inputValue(), "", "the box clears for the next paste");
  const adminMoment = admin.page.locator("form", { has: admin.page.locator('input[name="from"][value="admin"]') });
  await admin.page.getByText("Or add a photo or update instead").click();
  await adminMoment.getByLabel(/what's happening/i).fill(`Doors open for day 2 ${run}`);
  await adminMoment.getByRole("button", { name: "Post", exact: true }).click();
  await admin.page.waitForURL(/moment=1/);
  await anon.page.goto(`${BASE}/moments`);
  const am = await openMoment(anon.page, `Doors open for day 2 ${run}`);
  await am.getByText("Someone at Moonshot").waitFor();
  assert.equal(await am.getByText("Moonshot Connect").count(), 0, "no default credit");

  step("admin pins a moment as Featured, sets top accounts, then unpins");
  await admin.page.goto(`${BASE}/admin`);
  const pinRow = admin.page.locator("li", { hasText: `Doors open for day 2 ${run}` });
  await pinRow.getByRole("button", { name: "Feature this" }).click();
  await pinRow.getByRole("button", { name: "Unpin" }).waitFor();
  await admin.page.getByText(/pinned by you/).waitFor();
  await anon.page.goto(`${BASE}/moments`);
  // The pinned moment leads the Featured slideshow.
  const featuredTile = anon.page.locator('a[data-track="moments_featured"]').first();
  assert.match(await featuredTile.getAttribute("aria-label"), new RegExp(`Doors open for day 2 ${run}`), "the pinned moment is Featured");
  await anon.page.getByText(/^Featured/).first().waitFor();
  await admin.page.getByLabel("Top accounts").fill("@TechCabal, someone_else");
  await admin.page.getByRole("button", { name: "Save", exact: true }).click();
  await admin.page.getByText("Saved 2 accounts.").waitFor();
  await pinRow.getByRole("button", { name: "Unpin" }).click();
  await pinRow.getByRole("button", { name: "Feature this" }).waitFor();
  await admin.page.goto(`${BASE}/admin`);
  assert.equal(await admin.page.getByLabel("Top accounts").inputValue(), "@techcabal @someone_else");
  await admin.page.getByText(/auto: rotates every 30 minutes/).waitFor();

  // Time on page is sent when you move on: spend a little while on Moments, then tap back home.
  await anon.page.goto(`${BASE}/moments`);
  await anon.page.waitForTimeout(1600);
  await anon.page.getByRole("link", { name: "Moonshot Connect home" }).click();
  await anon.page.waitForURL((u) => new URL(u).pathname === "/");
  await anon.page.waitForTimeout(300);

  step("admin Stats: visits, clicks, searches, devices, Moments, time on site, CSV");
  await admin.page.goto(`${BASE}/admin/stats?days=1`);
  const tile = async (label) => Number((await admin.page.getByText(label, { exact: true }).locator("xpath=preceding-sibling::div[1]/p[1]").innerText()).replace(/,/g, ""));
  assert.ok((await tile("Visits")) > 0, "visits recorded");
  assert.ok((await tile("Visitors")) > 0, "visitors recorded");
  assert.ok((await tile("Contacted someone")) > 0, "contacts recorded");
  assert.ok((await tile("Searches")) > 0, "searches recorded");
  await admin.page.getByText("Visits per hour (Lagos time)").waitFor();
  await admin.page.getByText(/on the site now/).waitFor();
  await admin.page.getByText("Clicks by button").waitFor();
  assert.ok((await admin.page.getByText("Add me (card)").count()) > 0, "click on 'Add me' recorded");
  const empty = admin.page.locator("div", { has: admin.page.getByRole("heading", { name: "Searches that found nothing" }) }).last();
  await empty.getByText(`“${nothing}”`).waitFor();
  // New measures: devices, the Moments funnel and its top moments, time on pages.
  await admin.page.getByText("📱 Phone").first().waitFor();
  const momentsFunnel = admin.page.locator("div", { has: admin.page.getByRole("heading", { name: "📸 Moments" }) }).last();
  assert.ok(Number((await momentsFunnel.locator("li").nth(1).locator("p").nth(1).innerText()).replace(/,/g, "")) > 0, "moment opens recorded");
  await admin.page.getByRole("heading", { name: "Top moments" }).waitFor();
  assert.ok((await admin.page.locator("table").filter({ hasText: "Opens" }).locator("tbody tr").count()) > 0, "top moments listed");
  const timed = admin.page.locator("div", { has: admin.page.getByRole("heading", { name: "Time on page" }) }).last();
  assert.ok((await timed.locator("li").count()) > 0, "time on page measured");
  const statsCsv = await (await admin.page.request.get(`${BASE}/admin/stats.csv?days=7`)).text();
  assert.match(statsCsv, /^day,visits,visitors,returning_visitors,clicks,contact_clicks,moment_opens,video_plays,searches,minutes_on_site\r\n\d{4}-\d{2}-\d{2},\d+/);
  assert.equal((await anon.page.request.get(`${BASE}/admin/stats.csv`)).status(), 404, "stats CSV is admin-only");
  for (const days of [7, 30, 90, 0]) {
    await admin.page.goto(`${BASE}/admin/stats?days=${days}`);
    await admin.page.getByText("From visit to connection").waitFor();
  }
  await admin.page.goto(`${BASE}/admin/stats?days=7`);
  await admin.page.getByText("Visits per day").waitFor();
  await shot(admin.page, "06-stats");

  step("Ada deletes her card");
  ada.page.once("dialog", (d) => d.accept());
  await ada.page.getByRole("button", { name: "Delete my card" }).click();
  await ada.page.waitForURL((u) => new URL(u).pathname === "/");
  await anon.page.goto(`${BASE}/?q=${encodeURIComponent(`Ada ${run}`)}`);
  await anon.page.getByText(/no one matches|isn't here yet/i).waitFor();

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
