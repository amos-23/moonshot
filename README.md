# Moonshot Connect

A minimal, no-sign-up list of who's at **Moonshot by TechCabal** (National Theatre, Lagos, 28–29 October 2026), so people can find each other and reach out directly.

- **Add yourself** in a few seconds with your name, what you do, who you want to meet, and one way to reach you (@handle, WhatsApp number, email or LinkedIn).
- **Or add your X post.** Paste a link to a public post about Moonshot and it shows up as a "From X" card. The card uses only what the post says publicly, links back to the original, and lists who the author says they want to meet.
- **Filters and two views:** Here now, Investors, Hiring, Founders, Engineers, Marketing, Design and From X; "For you" (best fit) or "Newest" (a fresh feed).
- **📍 Meet up** (`/meet`): anyone checks in with where they are, what they're up for and for how long (1, 2 or 4 hours, or the rest of the day). A live board shows who's around now with a one-tap WhatsApp/X/LinkedIn button. Check-ins expire on their own; "I've left" ends one early. Card holders check in with one tap, and their card shows "Catch me at…" while they're checked in.
- **📸 Moments** (`/moments`): a dark, full-bleed gallery in motion: a tilted film strip of photos drifting under the title (hover pauses, tap opens), a featured moment with a slow pan-and-zoom, a staggered photo wall whose tiles rise in as you scroll (all motion is off for people who prefer reduced motion), and a full-screen viewer (swipe or arrow keys, with a shareable `#m-…` link per moment). Anyone (no card needed) can post up to 4 photos, a short update, or an X post link (shown with its text and images and a link back to X). Tag people with @handle: a moment shows "👋 Follow up" links to the cards of the people it mentions (and the X author), so a photo leads to someone you can reach. Admins can paste many X post links at once (recaps, highlights) to add them as moments. Moments and check-ins hide automatically after 3 reports; admins can hide or restore them.
- **▶ Watch the highlights:** a full-screen story of every moment (Featured first): photos with a slow pan-and-zoom, videos with sound when the browser allows, words as big quote cards. Tap right/left to skip, hold to pause, swipe down or Esc to close. It ends with "Share the highlights on X". `/moments?story=1` opens it straight away.
- **Reactions (🔥 ❤️ 👏):** one tap on any moment, in the viewer or the story, with no sign-up; tap again to take it back. Each browser keeps a random id for itself and only its hash is stored. Reactions count towards Featured, and Stats shows them.
- **Featured on Moments:** an admin can pin any moment ("Feature this" in `/admin`). Otherwise Featured rotates every 30 minutes among the top 10 moments with a photo, scored by likes and replies on X (refreshed in the background every few hours) plus how often people opened it on the site in the last 30 days. Moments added in the last 48 hours count double, so new recaps get a turn. Posts from your "Top accounts" list (in `/admin`) get a strong boost; verified accounts a small one.
- **X videos play in Moments:** a video or GIF in an X post plays in the full-screen viewer (muted to start, tap for sound; a lighter file on phones), using the MP4s X's own embed uses. If X refuses, the still image and "View on X" show instead.
- **X posts are used in two places, each added on purpose:** as people ("From X" cards, via "Add yourself" or admin's "Add people from X posts") and as moments (via the Moments form or admin's "Add a moment").
- **Sharing on X (and WhatsApp):** every moment and card has its own share link (`/m/…`, `/p/…`) with a big preview image made for it (the photo with its caption, or a name card); the site and Moments page have their own previews too. "Post on X" buttons sit in the Moments viewer, right after posting a moment, after making a card, on Moments and on the homepage, with a ready-written post and #Moonshot2026. Shared links carry utm tags, so Stats shows shares and the visitors they bring back.
- **Sign up (optional):** a quiet "Sign up" link in the header leads to `/signup`: an email, plus a name and what you do if you like, for future updates. Nothing on the site needs it, and the link disappears once you've signed up. Admins see sign-ups on `/admin` and can download them as a CSV.
- **Card photo:** card holders can add a photo of themselves from today (resized on the phone before upload) from My card.
- **Search** checks every word against names, roles, companies and tags (so "hiring" or "investors" work). A name that isn't found gets an "invite them" prompt.
- **Best fits first,** with a one-line reason, e.g. "You want investors — Val offers investment".

- **After Moonshot** (from midnight in Lagos after day 2) the homepage becomes "Find the people you met": a name search up top, then a "📸 Highlights" photo grid from Moments. Meet up is closed and hidden. Set `EVENT_MODE=live` or `EVENT_MODE=after` to override the date.

This is an independent, community-made tool. It isn't run or endorsed by TechCabal, and it uses no TechCabal logos.

## How "no sign-up" works

When you add yourself, your browser keeps a private edit token in a cookie. **My card** gives you a private edit link so you can edit from another device.

## Stats

`/admin/stats` (24 hours, 7, 30 or 90 days, or all time; arrows compare with the period before):

- **Headline numbers:** visitors, visits, people who contacted someone (and the contact rate), average time on the site, pages per visitor, returning visitors, clicks and searches, plus how many people are on the site right now.
- **Visits per hour or per day,** and the busiest hours of the day (Lagos time).
- **Two funnels:** visit → opened the form → made a card → contacted someone; and on Moments: visited → opened a moment → followed up with someone → went to the post on X (with average time there and video plays).
- **Top moments** (opens, video plays, follow-ups, likes on X), devices (phone/tablet/computer), campaign links (`?utm_source=…&utm_campaign=…` or `?ref=…`), referring sites, top pages, time on each page, every button's clicks, the most-clicked people/posts/moments, top searches and searches that found nothing.
- **What's on the site:** cards, X cards, moments, photo moments, comments and sign-ups, added in the period and in total.
- **Download CSV:** one row per day for spreadsheets.

Tracking is built in and cookie-free. Each visitor is counted with an anonymous hash that changes daily; "returning" is only a yes/no the browser keeps for itself. Time on a page counts only while it's on screen. Bots and admin pages are not counted.

## Getting X posts in

- **Manual (free):** anyone can paste a post link on **Add yourself**, and admins can paste many links at once in `/admin`. Post text comes from X's public embed endpoint. Images (attached photos, or the link-preview picture) and the author's profile picture come from the data X's own embed widget loads; posts already on the site get them filled in gradually in the background.
- **Automatic:** set `X_BEARER_TOKEN` (the official X API, on a plan that includes recent search). The site then searches for Moonshot posts at most every 15 minutes and adds them as cards.

Nothing is scraped and nothing is invented.

## Deploy on Railway

1. **+ New → Database → PostgreSQL**
2. In your app's Variables, set `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` and `ADMIN_KEY` = a long password
3. Deploy. Tables set themselves up in their own `connect` schema.
4. Check `/api/health`. It should show `"ok":true`.

## Local and checks

```bash
npm install && npm run dev           # built-in database, no setup
npm run lint && npm run typecheck && npm test && npm run build
BASE_URL=http://localhost:3000 ADMIN_KEY=... npm run test:e2e
```
