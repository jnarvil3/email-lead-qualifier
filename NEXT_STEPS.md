# Next Steps - Email Lead Enricher

## Current Status ✅

- [x] Project fully built and working
- [x] TypeScript compilation successful
- [x] Demo server tested and running
- [x] Pushed to GitHub: https://github.com/jnarvil3/email-lead-enricher
- [x] Comprehensive README with Getting Started guide

## Immediate Setup (Before Using)

### 1. Get GitHub API Token (REQUIRED)
**Time: 2 minutes**

1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Give it a name: "Lead Enrichment"
4. Select scopes:
   - ✅ `public_repo`
   - ✅ `read:user`
5. Click "Generate token"
6. Copy the token (starts with `ghp_`)
7. Add to `/Users/jaspernarvil/Desktop/claude/lead-enrichment/.env`:
   ```
   GITHUB_TOKEN=ghp_your_token_here
   ```

### 2. Get Hunter.io API Key (OPTIONAL)
**Time: 3 minutes | Free tier: 50 searches/month**

1. Go to: https://hunter.io/api
2. Sign up (free)
3. Copy your API key
4. Add to `.env`:
   ```
   HUNTER_API_KEY=your_api_key_here
   ```

**What you get with Hunter.io:**
- LinkedIn profile URLs
- Company name
- Job position
- Email verification

**Without Hunter.io:**
- Still works fine
- GitHub data only (repos, stars, languages, contributions)
- Scores based purely on GitHub signals

### 3. Test It Works
```bash
cd /Users/jaspernarvil/Desktop/claude/lead-enrichment
npm run dev
```

Open: http://localhost:3001/dashboard.html
Try enriching a test email

---

## Recommended Enhancements

### Priority 1: Google Sheets Integration
**Why**: Much easier for Nick than using API/dashboard
**Effort**: 2-3 hours
**Benefit**: Paste emails → click button → see scores

**What to build:**
1. Copy Google Sheets connector from pet project (`commercial-prospecting/lead-enrichment/connectors/google-sheets/`)
2. Adapt it for email enrichment instead of website crawling
3. Add columns: score, tier, reasoning, GitHub username, LinkedIn URL
4. Menu: "Enrich Selected Rows" or "Enrich All Pending"

**Files to copy/adapt:**
- `connectors/google-sheets/Enrichment.gs` → adapt for email enrichment API
- Update endpoint from `/api/enrich` (website crawler) to our email enricher API

### Priority 2: Data Quality Confidence Score
**Why**: Transparency on how complete the enrichment data is
**Effort**: 30 minutes
**Benefit**: Know which scores to trust

**Add to each lead:**
```typescript
dataQuality: {
  score: 85,  // 0-100%
  hasGithub: true,
  hasLinkedIn: true,
  hasHunter: true,
  missingData: []
}
```

**Scoring logic:**
- GitHub profile found: +50 points
- GitHub has activity (repos/contributions): +20 points
- Hunter.io data found: +20 points
- LinkedIn URL found: +10 points

### Priority 3: Better Batch Processing
**Why**: Handle rate limits and retries gracefully
**Effort**: 1 hour

**Import from pet project:**
- Queue management (PQueue)
- Retry logic for failed enrichments
- Progress callbacks
- Better error handling

### Priority 4: CSV Import/Export
**Why**: Easy to bulk import email lists, export results
**Effort**: 1 hour

**Features:**
- Import: Upload CSV with emails → enrich all → download results
- Export: Download enriched leads as CSV with all scores
- Useful if not using Google Sheets

---

## Future Ideas (Lower Priority)

### LinkedIn Profile Scraping
**Effort**: High | **Risk**: High (legal/technical)

- Use Hunter.io to get LinkedIn URL
- Scrape LinkedIn profile for education, experience, skills
- Use Gemini Flash AI to parse and extract signals
- **Problem**: LinkedIn actively blocks scrapers
- **Alternative**: Stick to official APIs only

### Email Deliverability Verification
**API**: ZeroBounce, NeverBounce, or Hunter.io verify endpoint
**Use case**: Ensure emails are valid before scoring

### Webhook Integration
**Use case**: Auto-enrich when someone signs up to Nick's newsletter
**How**: Nick's site POSTs email to enrichment API → returns score → stores in DB

### Scheduled Batch Jobs
**Use case**: Enrich all pending leads every night
**How**: Cron job + database integration

### Airtable Integration
Alternative to Google Sheets if Nick uses Airtable

---

## Technical Debt / Nice-to-Haves

- [ ] Add unit tests for scoring algorithm
- [ ] Add integration tests for API endpoints
- [ ] Add input validation (email format checks)
- [ ] Add rate limit monitoring/alerts
- [ ] Add logging to file (not just console)
- [ ] Add Dockerfile for easy deployment
- [ ] Add environment variable validation on startup
- [ ] Better TypeScript types for YAML config

---

## Questions to Ask Nick

1. **What's your current signup flow?**
   - Newsletter tool? (Mailchimp, ConvertKit, etc.)
   - Custom form on website?
   - Can we add a webhook?

2. **Where do you want enriched data?**
   - Google Sheets?
   - Airtable?
   - Your own database?
   - Email notification?

3. **What's your volume?**
   - How many signups per day/week/month?
   - Determines if free tiers are enough

4. **What's your action plan for tiers?**
   - Exceptional (80+): Proactive invite email?
   - Strong (65-79): Priority review?
   - Good (50-64): Standard process?
   - Average/Weak: Just track?

5. **Scoring weights - do these make sense?**
   - Ambition: 30%
   - Intelligence: 30%
   - Kindness: 20%
   - Track Record: 20%

---

## Files to Review

**Key configuration:**
- `src/scoring/config.yaml` - Edit scoring weights and rules here
- `.env` - Add your API keys here

**Code to understand:**
- `src/scoring/scorer.ts` - How scoring works
- `src/enrichers/orchestrator.ts` - Main enrichment flow
- `src/demo/server.ts` - API endpoints

**Documentation:**
- `README.md` - Full documentation
- This file - Next steps

---

## Cost Estimates

**Current setup (free tier only):**
- GitHub API: Free (5,000 req/hour)
- Hunter.io: Free (50 searches/month)
- **Total cost per lead**: $0.00 - $0.01

**If Nick has 1,000 signups/month:**
- First 50: Free with Hunter.io ($0.50 value)
- Next 950: GitHub only ($0.00)
- **Total monthly cost**: $0.00

**If he wants LinkedIn data for all 1,000:**
- Hunter.io paid: $49/month (1,000 searches)
- GitHub: Free
- **Total monthly cost**: $49.00

---

## Quick Commands Reference

```bash
# Start demo server
npm run dev

# Enrich via CLI
npm run enrich john@example.com

# Build TypeScript
npm run build

# Run tests (when added)
npm test

# Kill the demo server
pkill -f "ts-node-dev"
```

---

## Repository
https://github.com/jnarvil3/email-lead-enricher
