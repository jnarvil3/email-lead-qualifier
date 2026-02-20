#!/usr/bin/env ts-node

import * as dotenv from 'dotenv';
import { EnrichmentOrchestrator } from './enrichers/orchestrator';
import { Lead } from './types';

dotenv.config();

/**
 * Simple CLI for testing lead enrichment
 * Usage: npm run enrich
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║             Lead Enrichment CLI                                ║
╚════════════════════════════════════════════════════════════════╝

Usage:
  npm run enrich <email1> [email2] [email3] ...

Example:
  npm run enrich john@example.com jane@example.com

Or use demo emails:
  npm run enrich demo

Environment variables required:
  GITHUB_TOKEN     - GitHub Personal Access Token
  HUNTER_API_KEY   - Hunter.io API Key (optional)
    `);
    process.exit(1);
  }

  // Demo mode
  if (args[0] === 'demo') {
    console.log('🎯 Running demo with test emails...\n');
    args.splice(0, 1,
      'gaearon@somewhere.com',    // Dan Abramov (React creator) - GitHub rich
      'example@test.com',          // No data
    );
  }

  const leads: Lead[] = args.map(email => ({
    email,
    source: 'cli',
    signupDate: new Date(),
  }));

  const orchestrator = new EnrichmentOrchestrator();

  // Show API stats before enrichment
  console.log('📊 API Usage Limits:');
  try {
    const stats = await orchestrator.getStats();
    console.log(`   GitHub: ${stats.github.remaining}/${stats.github.limit} requests remaining`);
    if (stats.hunter) {
      console.log(`   Hunter: ${stats.hunter.used}/${stats.hunter.limit} searches used this month`);
    } else {
      console.log(`   Hunter: Not configured (set HUNTER_API_KEY)`);
    }
  } catch (error) {
    console.log('   Could not fetch API stats');
  }

  // Enrich leads
  const results = await orchestrator.enrichLeads(leads, {
    maxConcurrent: 2,
    onProgress: (current, total, lead) => {
      console.log(`\n[${current}/${total}] ✓ ${lead.email} → ${lead.score.tier} (${lead.score.total}/100)`);
    },
  });

  // Display results summary
  console.log('\n' + '='.repeat(70));
  console.log('📋 ENRICHMENT SUMMARY');
  console.log('='.repeat(70));

  const exceptional = results.filter(r => r.lead?.score.tier === 'exceptional');
  const strong = results.filter(r => r.lead?.score.tier === 'strong');
  const good = results.filter(r => r.lead?.score.tier === 'good');

  if (exceptional.length > 0) {
    console.log('\n🌟 EXCEPTIONAL CANDIDATES (proactively invite):');
    exceptional.forEach(r => {
      if (r.lead) {
        console.log(`   • ${r.lead.email} - Score: ${r.lead.score.total}/100`);
        console.log(`     ${r.lead.score.reasoning}`);
      }
    });
  }

  if (strong.length > 0) {
    console.log('\n💪 STRONG CANDIDATES (prioritize):');
    strong.forEach(r => {
      if (r.lead) {
        console.log(`   • ${r.lead.email} - Score: ${r.lead.score.total}/100`);
        console.log(`     ${r.lead.score.reasoning}`);
      }
    });
  }

  if (good.length > 0) {
    console.log('\n👍 GOOD CANDIDATES (consider):');
    good.forEach(r => {
      if (r.lead) {
        console.log(`   • ${r.lead.email} - Score: ${r.lead.score.total}/100`);
      }
    });
  }

  const totalCost = results.reduce((sum, r) => sum + r.costUsd, 0);
  console.log(`\n💰 Total cost: $${totalCost.toFixed(4)}`);
  console.log('='.repeat(70) + '\n');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
