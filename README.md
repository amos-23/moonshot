# Moonshot Connect

A minimal, no-sign-up list of who's at **Moonshot by TechCabal** (National Theatre, Lagos, 28–29 October 2026), so people can find each other and reach out directly.

- **Add yourself** in a few seconds with your name, what you do, who you want to meet, and one way to reach you (@handle, WhatsApp number, email or LinkedIn).
- **Or add your X post.** Paste a link to a public post about Moonshot and it shows up as a "From X" card. The card uses only what the post says publicly, links back to the original, and lists who the author says they want to meet.
- **Filters and two views:** Here now, Investors, Hiring, Founders, Engineers, Marketing, Design and From X; "For you" (best fit) or "Newest" (a fresh feed).
- **At the event:** add a photo of yourself from today (resized on your phone before upload) and a "Catch me at…" note, e.g. "Booth 14, Hall B until 3pm". Notes count as "Here now" for 8 hours.
- **Search** checks every word against names, roles, companies and tags (so "hiring" or "investors" work). A name that isn't found gets an "invite them" prompt.
- **Best fits first,** with a one-line reason, e.g. "You want investors — Val offers investment".

This is an independent, community-made tool. It isn't run or endorsed by TechCabal, and it uses no TechCabal logos.

## How "no sign-up" works

When you add yourself, your browser keeps a private edit token in a cookie. **My card** gives you a private edit link so you can edit from another device.

## Stats

`/admin/stats` shows a funnel (visited → opened the form → made a card → contacted someone), visits, unique visitors, button clicks (WhatsApp, X, LinkedIn, View post, comments, Add me…), the most-clicked people and posts, top searches (and searches that found nothing), the top pages and the referring sites, for the last 24 hours, 7 days or 30 days.

Tracking is built in and cookie-free. Each visitor is counted with an anonymous hash that changes daily. Bots and admin pages are not counted.

## Getting X posts in

- **Manual (free):** anyone can paste a post link on **Add yourself**, and admins can paste many links at once in `/admin`. Post text comes from X's public embed endpoint.
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
