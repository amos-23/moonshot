# Moonshot Connect

Fast networking for **Moonshot by TechCabal** (National Theatre, Lagos, 28–29 October 2026).

- **No sign-up.** Make a card in about 30 seconds: your name, what you do, what you're looking for, what you can help with, and how to reach you.
- **See who to meet.** Cards are ranked by fit, and each one says why in plain English, e.g. "You want investors — Val offers investment".
- **Reach out directly** with one tap on WhatsApp, X, LinkedIn or email. Each person picks which contact options to show.
- **"Find me at…"** Share where you are at the venue. The note shows for 3 hours.
- **Hangouts.** Start or join a small meetup ("Fintech founders coffee, by the main stage, 10am").
- **On X.** Public posts about Moonshot, each linked to the original, with a one-tap "invite to connect" reply.

Independent, community-made tool. It isn't run or endorsed by TechCabal. The colours and type (orange and gold, Outfit) follow the 2026 theme, but no TechCabal logos or artwork are used.

## How "no sign-up" works

When you create a card, the server makes a random edit token. Your browser keeps it in a cookie, and the database stores only a hash of it. **My card** shows a private edit link so you can edit your card from another device. Saved people are stored in your browser only.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000, with a built-in database (no setup)
```

## Deploy on Railway

1. In your Railway project, click **+ New → Database → PostgreSQL**.
2. In your app service, open **Variables** and add:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `ADMIN_KEY` = any long password, used for `/admin`
3. Deploy. Tables are created automatically.
4. Open `/api/health`. It should say `"ok":true`.

Optional variables are listed in [`.env.example`](.env.example).

## Admin

Go to `/admin` and enter your `ADMIN_KEY`. From there you can:

- review reports
- hide cards or posts
- cancel hangouts
- add X posts by pasting public post links (or JSON)
- with `X_BEARER_TOKEN` set, fetch posts through the official X API

## Checks

```bash
npm run lint && npm run typecheck && npm test && npm run build
BASE_URL=http://localhost:3000 ADMIN_KEY=... npm run test:e2e   # browser test (needs Playwright + Chromium)
```

## Honesty rules

- No posts, people or exhibitors are invented, and nothing is scraped from X.
- Profiles are never created from posts. Authors are invited to make their own card.
- Contact details appear only if the person adds them to their own card.
