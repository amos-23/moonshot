# Moonshot Connect

A mobile-first web app for finding the right people at **Moonshot by TechCabal** (Lagos, 28–29 October 2026). People can discover attendees, see why they should meet, connect, message, and arrange meetings and topic meetups. A separate page collects public X posts about Moonshot.

> **Independent prototype.** It is not affiliated with, endorsed by, or operated by TechCabal. The UI says so wherever it matters.

## Stack

- **Next.js 15** (App Router, Server Actions) + **TypeScript** + **Tailwind CSS v4** + **Lucide** icons
- **PostgreSQL** through **Drizzle ORM**. Supabase Postgres is the intended production database. Locally, an embedded **PGlite** database runs with no setup.
- **Supabase Auth** for email magic-link sign-in, and optionally **Supabase Storage** for profile photos
- **Vitest** for unit and integration tests, plus a **Playwright** end-to-end script

## What's implemented

| Area | Status |
| --- | --- |
| Landing page: value proposition, how it works, featured public profiles, latest posts, popular interests, event info, disclaimer | ✅ |
| Email sign-in (Supabase magic link) and a zero-config local demo sign-in | ✅ (Supabase needs credentials) |
| Onboarding and profile editing: all requested fields, multi-select goals, offers and interests, attendance, networking style, visibility, contact preference, photo | ✅ |
| Discover: recommendations with written reasons, search, and filters (role, industry, attendance, interest, goal), save, connect | ✅ |
| Deterministic, transparent matching (`src/lib/matching.ts`). No AI. | ✅ |
| Connection requests: personal note, accept, decline, withdraw, remove. Duplicates blocked in code and by a DB unique index. A reverse request counts as acceptance. 30 requests per day limit | ✅ |
| Messaging after acceptance: persistent, 4-second polling while the tab is visible, unread counts, rate limit | ✅ |
| Block and report users, messages, meetups and posts. Contact preferences enforced on the server | ✅ |
| My Moonshot: requests, proposed and confirmed meetings, meetups joined, connections, saved profiles, saved exhibitors, follow-up notes | ✅ |
| Meeting coordination: propose a time, duration and location. The invitee confirms or declines. Proposed and confirmed are shown differently | ✅ |
| Explore the Conversation: keyword search, suggested phrases, themes, mark relevant or dismiss, invite the author through X's official web intent, source attribution, link to the original | ✅ |
| X data: provider interface, manual and bulk import (URLs or JSON), oEmbed text enrichment, official X API v2 recent search | ✅ (live search needs `X_BEARER_TOKEN`) |
| Exhibitor directory: search, filters, save, questions and introduction requests, booth shown only when marked verified | ✅ |
| Topic meetups: propose, join, leave, capacity, proposed or confirmed or cancelled, attendee list that respects privacy | ✅ |
| Admin: overview and config status, reports and moderation (suspend, hide, cancel), users (feature, verify ticket, suspend), X post import and editing, exhibitors, meetups, event info, metrics | ✅ |
| Analytics: all 13 requested events, plus a metrics page built around meaningful connections | ✅ |

### Honesty rules built in

- No X posts are seeded or invented. With no live source configured, the Conversation page says so.
- Post timestamps come from the supplied data or are decoded from the X post ID (Snowflake). They are never guessed.
- No profiles are created from public posts. Authors are invited to opt in.
- Exhibitor booth locations appear only when an admin marks them as verified.
- Demo profiles and exhibitors (`npm run db:seed`) are fictional and carry a **Demo data** badge. `npm run db:unseed` removes them.
- Attendance is self-reported. The "ticket verified" badge only appears after an admin verifies it.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional; everything works with defaults
npm run db:seed              # optional: fictional demo profiles/exhibitors
npm run dev                  # http://localhost:3000
```

With no environment variables set, the app uses an embedded PGlite database in `./.data/pglite` and migrates it automatically. Sign-in is the **local demo sign-in**: enter any email and you're signed in, with no verification. To get admin access locally, set `ADMIN_EMAILS=you@example.com` and sign in with that email.

To use a real Postgres instead, set `DATABASE_URL` and run `npm run db:migrate`.

## Environment variables

See [`.env.example`](.env.example). Summary:

| Variable | Needed for |
| --- | --- |
| `DATABASE_URL` | **Required in production.** Postgres connection string (Supabase transaction pooler URI works; `prepare: false` is set) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Email magic-link auth |
| `SUPABASE_SERVICE_ROLE_KEY` (server only) | Photo uploads to Supabase Storage. Without it, photos up to 300 KB are stored inline |
| `NEXT_PUBLIC_SITE_URL` | Links in sign-in emails and X invites |
| `ADMIN_EMAILS` | Admin access |
| `X_BEARER_TOKEN` | Live X search (official API v2 recent search) |
| `X_OEMBED_ENABLED` | Set to `false` to turn off oEmbed enrichment during import |
| `ENABLE_DEMO_AUTH`, `SESSION_SECRET` | Demo sign-in on a production build. **Don't use it on a public deployment** |
| `AUTO_MIGRATE` | Apply migrations when the server first connects |

## Database setup and migrations

The schema is in `src/lib/db/schema.ts`. SQL migrations are in `drizzle/`:

- `0000_init.sql`: tables, foreign keys, check constraints, indexes, and a partial unique index that prevents duplicate live connection requests
- `0001_rls.sql`: enables **row-level security** on every table. When the Supabase `auth` schema is present, it also creates policies: anon users see only public profiles and posts; signed-in users read only their own requests, messages, meetings, notes and saves; blocked pairs can't see each other; no client-side writes except updating your own profile, and that can't set `featured` or `ticket_verified`; admin tables have no policies, so they can't be reached through the API. On plain Postgres or PGlite the policy step is skipped.

The server connects as the database owner and enforces authorization in code (`src/lib/services/*`). RLS is defence in depth, so the public anon key can never expose private data.

```bash
DATABASE_URL=postgres://... npm run db:migrate   # apply migrations
npm run db:generate                              # after editing schema.ts
```

### Supabase checklist

1. Create a project. Copy the **transaction pooler** connection string into `DATABASE_URL`, and the URL and anon key into the `NEXT_PUBLIC_SUPABASE_*` variables.
2. Run `npm run db:migrate`.
3. Under Auth → URL configuration, set the Site URL to your domain and add `https://YOUR_DOMAIN/auth/callback` as a redirect URL.
4. Optional: create a **public** Storage bucket called `avatars` and set `SUPABASE_SERVICE_ROLE_KEY`.
5. Set `ADMIN_EMAILS`.

## Deploy (Vercel)

1. Import the repo into Vercel. The framework preset is Next.js and no build settings need changing.
2. Add the environment variables above. Production needs `DATABASE_URL` and the Supabase keys.
3. Run `npm run db:migrate` once against the production database, or set `AUTO_MIGRATE=true`.
4. Deploy, then check `/api/health`. It reports the auth mode and database type.

## Tests and checks

```bash
npm run lint        # ESLint (next/core-web-vitals + typescript)
npm run typecheck   # tsc --noEmit
npm test            # Vitest: matching, URL parsing, validation, and DB integration tests on in-memory PGlite
npm run build       # production build
# End-to-end (needs Playwright + Chromium, and a running server with demo auth and ADMIN_EMAILS=admin@example.com):
BASE_URL=http://localhost:3000 npm run test:e2e
```

The integration tests (`tests/core-flows.test.ts`) cover:

- Discovery ranking, hidden and blocked users excluded
- Saving profiles
- Connection requests: duplicates, reverse acceptance, contact preferences, the DB-level unique constraint
- Messaging authorization: outsiders, after removal, after blocking
- Reporting
- Meeting confirmation
- Meetup capacity and attendee privacy

The E2E script runs two users through onboarding, discovery, request and accept, two-way messaging via polling, outsider denial, meeting propose and confirm, admin post import with validation and deduplication, conversation curation, exhibitor save, meetup create, join and confirm, report and block, and the admin access guard.

## Known limitations

- Messaging uses polling (every 4 seconds), not websockets. Supabase Realtime could replace it later.
- Recommendations score every visible profile in memory on each request. That is fine for thousands of users; beyond that, precompute or paginate.
- No email or push notifications. Pending items show as badges in the navigation and in My Moonshot.
- Exhibitor questions and introduction requests go to admins, who forward them by hand.
- The Supabase sign-in path is implemented with the official `@supabase/ssr` APIs but has not been tested against a live Supabase project, because no credentials were available. The demo sign-in path is fully tested.
- The X API provider follows the documented recent-search endpoint but has not been called with a real token. The oEmbed enrichment calls a public endpoint, and if it is unreachable, import falls back to URL-only records.
- All times are entered and shown in Lagos time (WAT).
