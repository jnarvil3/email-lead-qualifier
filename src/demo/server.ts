import * as dotenv from 'dotenv';
import express from 'express';
import * as path from 'path';
import { EnrichmentOrchestrator } from '../enrichers/orchestrator';
import { Lead } from '../types';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const orchestrator = new EnrichmentOrchestrator({
  githubToken: process.env.GITHUB_TOKEN,
  hunterApiKey: process.env.HUNTER_API_KEY,
  geminiApiKey: process.env.GEMINI_API_KEY,
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get API stats
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await orchestrator.getStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Enrich a single lead
app.post('/api/enrich', async (req, res) => {
  try {
    const { email, name, source } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const lead: Lead = {
      email,
      name,
      source: source || 'web',
      signupDate: new Date(),
    };

    const result = await orchestrator.enrichLead(lead);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Batch enrich leads
app.post('/api/enrich/batch', async (req, res) => {
  try {
    const { leads } = req.body;

    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: 'Leads array is required' });
    }

    const formattedLeads: Lead[] = leads.map(l => ({
      email: l.email,
      name: l.name,
      source: l.source || 'web',
      signupDate: new Date(),
    }));

    const results = await orchestrator.enrichLeads(formattedLeads, {
      maxConcurrent: 3,
    });

    res.json({
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        totalCost: results.reduce((sum, r) => sum + r.costUsd, 0),
        tiers: {
          exceptional: results.filter(r => r.lead?.score.tier === 'exceptional').length,
          strong: results.filter(r => r.lead?.score.tier === 'strong').length,
          good: results.filter(r => r.lead?.score.tier === 'good').length,
          average: results.filter(r => r.lead?.score.tier === 'average').length,
          weak: results.filter(r => r.lead?.score.tier === 'weak').length,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get scoring configuration
app.get('/api/config', (req, res) => {
  try {
    const config = require('../scoring/config.yaml');
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║             Lead Enrichment Demo                               ║
╚════════════════════════════════════════════════════════════════╝

🚀 Server running at: http://localhost:${port}
📊 Dashboard:        http://localhost:${port}/dashboard.html

API Endpoints:
  GET  /api/health        - Health check
  GET  /api/stats         - API usage stats
  GET  /api/config        - Scoring configuration
  POST /api/enrich        - Enrich single lead
  POST /api/enrich/batch  - Enrich multiple leads

Environment:
  GITHUB_TOKEN:         ${process.env.GITHUB_TOKEN ? '✓ Set' : '✗ Not set'}
  HUNTER_API_KEY:       ${process.env.HUNTER_API_KEY ? '✓ Set' : '✗ Not set (optional)'}
  BRAVE_SEARCH_API_KEY: ${process.env.BRAVE_SEARCH_API_KEY ? '✓ Set (2000 searches/month)' : '✗ Not set'}
  GEMINI_API_KEY:       ${process.env.GEMINI_API_KEY ? '✓ Set (founder enrichment enabled)' : '✗ Not set (founder enrichment disabled)'}
  `);
});
