# ScriptForge — Hosting Setup

## Quick Start (Vercel — recommended)

1. Upload this zip's contents to a new GitHub repo
2. Import the repo in Vercel
3. Add all environment variables from `.env.example`
4. Deploy — Vercel runs `npm install && npm run build` automatically
5. After first deploy, visit the site to create the admin user
6. In Stripe dashboard, add a webhook endpoint pointing to:
   `https://your-domain.com/api/stripe/webhook`
   Subscribe to: `checkout.session.completed`, `invoice.payment_succeeded`,
   `invoice.payment_failed`, `customer.subscription.updated`,
   `customer.subscription.deleted`

## Self-hosted (VPS / Docker)

1. Install Node.js 20+ and npm
2. Unzip this package on your server
3. Copy `.env.example` → `.env` and fill in real values
4. Run:
   ```bash
   npm install
   npm run build
   npm start
   ```
5. The app listens on port 3000 by default
6. Use the included `Caddyfile` as a reverse proxy template (edit `:81` to your domain)

## Environment Variables

See `.env.example` for the complete list. All required vars are marked.

## Database

- Default: SQLite at `db/custom.db` (auto-created on first run)
- Optional: MongoDB via `MONGODB_URI` (overrides SQLite)

## Stripe Setup (critical for Pro subscriptions)

The webhook handler at `/api/stripe/webhook` syncs subscription state to the DB:
- `checkout.session.completed` — upgrades user to Pro, saves `currentPeriodEnd`
- `invoice.payment_succeeded` — refreshes `currentPeriodEnd` on each renewal
- `invoice.payment_failed` — marks `cancelAtPeriodEnd` (Stripe retries for ~23 days)
- `customer.subscription.updated` — syncs cancel/resume/plan changes
- `customer.subscription.deleted` — downgrades user to Free

A safety net in `/api/auth/me` checks `currentPeriodEnd` on every session load
and auto-downgrades expired Pro users even if a webhook is missed.

## YouTube OAuth

1. Create OAuth credentials in Google Cloud Console
2. Add authorized redirect URI: `https://your-domain.com/api/youtube/callback`
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI` in `.env`

## Files NOT included in this zip

- `node_modules/` — installed by `npm install`
- `.next/` — built by `npm run build`
- `db/custom.db` — created at runtime
- `data/audio/` — created at runtime
