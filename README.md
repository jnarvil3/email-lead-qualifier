# 🎯 Lead Enrichment & Scoring System

Automatically enrich and score leads from email signups using public data sources (GitHub, Hunter.io) with a transparent, configurable scoring algorithm.

## ✨ Features

- **Free-tier friendly**: Uses GitHub API (free) and Hunter.io free tier (50/month)
- **Transparent scoring**: YAML-based configuration - easy to edit weights and rules
- **Rich data sources**: GitHub projects, LinkedIn data (via Hunter), company info
- **Demo dashboard**: Test enrichment with a web interface
- **CLI tool**: Batch process leads from command line
- **Cost tracking**: Know exactly how much each enrichment costs

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- GitHub account (for API token)
- Optional: Hunter.io account (for LinkedIn data)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/jnarvil3/email-lead-enricher.git
   cd email-lead-enricher
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up API keys**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your GitHub token:
   - Create a token at: https://github.com/settings/tokens
   - Scopes needed: `public_repo`, `read:user`
   ```env
   GITHUB_TOKEN=ghp_your_token_here
   HUNTER_API_KEY=your_api_key_here  # Optional
   ```

4. **Start the demo dashboard**
   ```bash
   npm run dev
   ```

   Open http://localhost:3001/dashboard.html in your browser

5. **Test with a demo email**
   - Enter an email address in the dashboard
   - Click "Enrich Lead"
   - View the score, tier, and enrichment data

That's it! You're ready to enrich leads.

## 📊 Scoring Criteria

Leads are scored 0-100 based on four categories:

1. **Ambition** (30%): GitHub projects, startup experience, leadership roles
2. **Intelligence** (30%): Programming languages, contributions, education, certifications
3. **Kindness** (20%): Open source contributions, volunteering
4. **Track Record** (20%): GitHub stars, career promotions, awards

### Score Tiers
- **Exceptional** (80+): Proactively invite to apply
- **Strong** (65-79): Prioritize in review
- **Good** (50-64): Consider for program
- **Average** (30-49): Standard process
- **Weak** (<30): Low priority

## 💻 Usage

### Web Dashboard

Start the server and use the web interface:
```bash
npm run dev
```
Visit http://localhost:3001/dashboard.html

Features:
- Enrich single leads
- Batch process multiple emails
- View API usage stats
- See detailed score breakdowns

### Command Line Interface (CLI)

```bash
# Enrich single email
npm run enrich john@example.com

# Enrich multiple emails
npm run enrich john@example.com jane@example.com

# Run demo with test emails
npm run enrich demo
```

Output includes:
- GitHub profile data (repos, stars, languages)
- Company and position (via Hunter.io)
- Score breakdown by category
- Tier assignment and reasoning
- Cost per enrichment

## 📝 Customizing Scoring

Edit `src/scoring/config.yaml` to adjust scoring:

```yaml
# Change category weights (must add to 100)
weights:
  ambition: 30
  intelligence: 30
  kindness: 20
  trackRecord: 20

# Adjust individual signal weights
ambition:
  github_projects: 10      # ← Increase/decrease as needed
  linkedin_startups: 15
  linkedin_leadership: 5

# Modify scoring thresholds
scoring_rules:
  github_projects:
    min_repos: 3           # Minimum repos needed for points
    max_score_repos: 10    # Max score at 10+ repos
```

The system will automatically reload the config on next enrichment.

## 💰 Cost Breakdown

| Service | Free Tier | Cost per Enrichment | Notes |
|---------|-----------|---------------------|-------|
| GitHub API | 5,000 req/hour | $0.00 | Completely free |
| Hunter.io | 50 searches/month | ~$0.01 | Optional - provides LinkedIn URLs |

**Estimated cost per lead**: $0.01 (with Hunter.io) or $0.00 (GitHub only)

## 📚 API Endpoints

### POST `/api/enrich`
Enrich a single lead:
```json
{
  "email": "john@example.com",
  "name": "John Doe",
  "source": "website"
}
```

### POST `/api/enrich/batch`
Enrich multiple leads:
```json
{
  "leads": [
    { "email": "john@example.com" },
    { "email": "jane@example.com" }
  ]
}
```

### GET `/api/stats`
Get current API usage:
```json
{
  "github": {
    "remaining": 4950,
    "limit": 5000,
    "reset": "2024-01-20T15:30:00Z"
  },
  "hunter": {
    "used": 10,
    "limit": 50
  }
}
```

## 🔧 Project Structure

```
lead-enrichment/
├── src/
│   ├── enrichers/
│   │   ├── github.enricher.ts      # GitHub data fetcher
│   │   ├── hunter.enricher.ts      # Hunter.io integration
│   │   └── orchestrator.ts         # Coordinates all enrichers
│   ├── scoring/
│   │   ├── config.yaml             # ← EDIT THIS to customize scoring
│   │   └── scorer.ts               # Scoring logic
│   ├── demo/
│   │   ├── server.ts               # Demo API server
│   │   └── dashboard.html          # Web interface
│   ├── types.ts                    # TypeScript types
│   └── cli.ts                      # Command-line tool
├── package.json
├── tsconfig.json
└── README.md
```

## 🎨 Integration Example

For Nick's website - pseudocode:

```javascript
// When user signs up for newsletter
async function handleNewsletterSignup(email) {
  // 1. Save to database
  await db.saveContact(email);

  // 2. Enrich in background
  const result = await fetch('http://localhost:3001/api/enrich', {
    method: 'POST',
    body: JSON.stringify({ email, source: 'newsletter' })
  });

  const enrichedLead = await result.json();

  // 3. If exceptional - proactively invite
  if (enrichedLead.lead.score.tier === 'exceptional') {
    await sendProactiveInvite(email, enrichedLead.lead.score.reasoning);
  }
}
```

## 📖 How It Works

1. **Email received** → System attempts to find GitHub profile by email
2. **GitHub enrichment** → Pulls repos, languages, stars, contributions
3. **Hunter.io lookup** → Gets LinkedIn URL, company, position (if available)
4. **Scoring** → Applies YAML config rules to calculate score
5. **Tier assignment** → Categorizes as exceptional/strong/good/average/weak
6. **Output** → Returns enriched profile with score and reasoning

## 🔐 Privacy & Compliance

- Only uses **publicly available data**
- No scraping - uses official APIs only
- Respects rate limits
- No data stored by default (stateless)
- GDPR compliant (public data only)

## 🤝 Contributing

To add new data sources:

1. Create new enricher in `src/enrichers/`
2. Add to `orchestrator.ts`
3. Update scoring config in `config.yaml`
4. Add TypeScript types in `types.ts`

## 📄 License

MIT
