# ScriptForge — Hosting Setup

## Quick Start (Vercel — recommended)

1. Upload this zip to a new GitHub repo (or use `vercel deploy --prod`)
2. Import the repo in Vercel
3. Add environment variables (see `.env.example`)
4. Deploy — Vercel will run `npm install && npm run build` automatically

## Self-hosted (Docker / VPS)

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
6. Use the included `Caddyfile` as a reverse proxy template

## Environment Variables

See `.env.example` for the complete list. All are required for full functionality.

## Database

- Default: SQLite at `db/custom.db` (auto-created on first run)
- Optional: MongoDB via `MONGODB_URI` (overrides SQLite)

## Post-Deploy

- Visit `/setup` (first run) to create the admin user
- Configure Stripe webhook → `/api/stripe/webhook`
- Configure YouTube OAuth redirect → `/api/youtube/callback`

## Files NOT included in this zip

- `node_modules/` — installed by `npm install`
- `.next/` — built by `npm run build`
- `db/custom.db` — created at runtime
- `data/audio/` — created at runtime
