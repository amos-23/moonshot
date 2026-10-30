# Moonshot Connect

A minimal, no-sign-up list of who's at **Moonshot by TechCabal** (National Theatre, Lagos, 28–29 October 2026), so people can find each other and reach out directly.

- **Add yourself** in a few seconds with your name, what you do, who you want to meet, and one way to reach you (@handle, WhatsApp number, email or LinkedIn).
- **Or add your X post.** Paste a link to a public post about Moonshot and it shows up as a "From X" card. The card uses only what the post says publicly, links back to the original, and lists who the author says they want to meet.
- **Filters and two views:** Here now, Investors, Hiring, Founders, Engineers, Marketing, Design and From X; "For you" (best fit) or "Newest" (a fresh feed).
- **📍 Meet up** (`/meet`): anyone checks in with where they are, what they're up for and for how long (1, 2 or 4 hours, or the rest of the day). A live board shows who's around now with a one-tap WhatsApp/X/LinkedIn button. Check-ins expire on their own; "I've left" ends one early. Card holders check in with one tap, and their card shows "Catch me at…" while they're checked in.
- **📸 Moments** (`/moments`): anyone (no card needed) can post up to 4 photos, a short update, or an X post link (shown with its text and images and a link back to X). Tag people with @handle: a moment shows "👋 Follow up" links to the cards of the people it mentions (and the X author), so a photo leads to someone you can reach. Admins can paste many X post links at once (recaps, highlights) to add them as moments. Moments and check-ins hide automatically after 3 reports; admins can hide or restore them.
- **X posts are used in two places, each added on purpose:** as people ("From X" cards, via "Add yourself" or admin's "Add people from X posts") and as moments (via the Moments form or admin's "Add a moment").
- **Card photo:** card holders can add a photo of themselves from today (resized on the phone before upload) from My card.
- **Search** checks every word against names, roles, companies and tags (so "hiring" or "investors" work). A name that isn't found gets an "invite them" prompt.
- **Best fits first,** with a one-line reason, e.g. "You want investors — Val offers investment".

- **After Moonshot** (from midnight in Lagos after day 2) the homepage becomes "Find the people you met": a name search up top, then a "📸 Highlights" photo grid from Moments. Meet up is closed and hidden. Set `EVENT_MODE=live` or `EVENT_MODE=after` to override the date.

This is an independent, community-made tool. It isn't run or endorsed by TechCabal, and it uses no TechCabal logos.

## How "no sign-up" works

When you add yourself, your browser keeps a private edit token in a cookie. **My card** gives you a private edit link so you can edit from another device.

## Stats

`/admin/stats` shows a funnel (visited → opened the form → made a card → contacted someone), visits, unique visitors, button clicks (WhatsApp, X, LinkedIn, View post, comments, Add me…), the most-clicked people and posts, top searches (and searches that found nothing), the top pages and the referring sites, for the last 24 hours, 7 days or 30 days.

Tracking is built in and cookie-free. Each visitor is counted with an anonymous hash that changes daily. Bots and admin pages are not counted.

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
