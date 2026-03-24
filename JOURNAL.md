# Lead Qualifier — Journal

## 2026-03-23: Fix 404 on leadqualifier.surestepautomation.com

**Problem:** The site returned a 404. Two root causes:
1. No `railway.json` — Railway had no explicit build/start config
2. No root route — hitting `/` served nothing because the only HTML file is `dashboard.html`

**Changes:**
- Added `railway.json` with Nixpacks build, `npm start` entrypoint, and `/api/health` healthcheck
- Added root `/` route in `src/demo/server.ts` that redirects to `/dashboard.html`

**Status:** Committed and pushed. Needs Railway redeploy to take effect.
