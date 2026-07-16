---
Task ID: 1
Agent: Main Agent
Task: Add MongoDB auth system, landing page, login/register pages, logout to ScriptForge

Work Log:
- Installed mongoose, bcryptjs, jose packages
- Created .env with MONGODB_URI and JWT_SECRET
- Built src/lib/mongodb.ts — MongoDB connection with connection pooling
- Built src/lib/models/User.ts — Mongoose User model with bcrypt password hashing
- Built src/lib/models/Project.ts — Mongoose Project model with userId indexing
- Built src/lib/models/Scene.ts — Mongoose Scene model with projectId indexing
- Built src/lib/auth.ts — JWT token signing/verification using jose, cookie helpers
- Built src/lib/auth-store.ts — Zustand auth store with login/register/logout/checkSession
- Created /api/auth/register route — validates input, creates user, sets JWT cookie
- Created /api/auth/login route — authenticates, sets JWT cookie
- Created /api/auth/logout route — clears JWT cookie
- Created /api/auth/me route — returns current user from JWT
- Created /api/projects route — full CRUD (GET/POST/PUT/DELETE) with auth
- Created /api/projects/scenes route — full CRUD with ownership verification
- Created /api/projects/scenes/reorder route — batch scene reordering
- Built LandingPage.tsx — hero, features, how-it-works, CTA, auth modal with login/register
- Built LoginPage.tsx — standalone login page at /login
- Built RegisterPage.tsx — standalone registration page at /register
- Updated page.tsx — auth guard: shows loading → landing page (unauth) → AppShell (auth)
- Updated AppSidebar.tsx — added LogOut button (desktop + mobile), user name display
- Migrated Zustand store (store.ts) — all CRUD now calls /api/projects and /api/projects/scenes
- Migrated gemini.ts — reads API key from localStorage instead of IndexedDB
- Migrated Settings.tsx — uses localStorage, shows account info, removed Dexie dependency
- Migrated StatsCards.tsx — computes stats from in-memory projects array

Stage Summary:
- Full auth system built with JWT cookies, bcrypt password hashing
- MongoDB Atlas connected (requires IP whitelist on user's Atlas cluster)
- Landing page with sign-in/sign-up modal
- All data operations migrated from IndexedDB to MongoDB API routes
- Logout accessible from sidebar (desktop + mobile)
- Lint passes with zero errors
- NOTE: MongoDB Atlas requires IP whitelisting — user needs to add current server IP to their Atlas cluster's IP whitelist at https://www.mongodb.com/docs/atlas/security-whitelist/