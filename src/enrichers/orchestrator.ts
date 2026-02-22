import { GitHubEnricher } from './github.enricher';
import { HunterEnricher } from './hunter.enricher';
import { LinkedInCrawler } from './linkedin.crawler';
import { GoogleSearchCrawler } from './google-search.crawler';
import { GeminiExtractor } from './gemini.extractor';
import { LeadScorer } from '../scoring/scorer';
import { Lead, EnrichedLead, EnrichmentResult } from '../types';

export class EnrichmentOrchestrator {
  private githubEnricher: GitHubEnricher;
  private hunterEnricher: HunterEnricher;
  private linkedinCrawler: LinkedInCrawler;
  private googleSearchCrawler: GoogleSearchCrawler;
  private geminiExtractor: GeminiExtractor | null;
  private scorer: LeadScorer;

  constructor(config?: {
    githubToken?: string;
    hunterApiKey?: string;
    geminiApiKey?: string;
    scoringConfigPath?: string;
  }) {
    this.githubEnricher = new GitHubEnricher(config?.githubToken);
    this.hunterEnricher = new HunterEnricher(config?.hunterApiKey);
    this.linkedinCrawler = new LinkedInCrawler();
    this.googleSearchCrawler = new GoogleSearchCrawler();

    // Gemini is optional - only initialize if API key provided
    try {
      this.geminiExtractor = new GeminiExtractor(config?.geminiApiKey);
    } catch (error) {
      console.warn('Gemini API key not provided - founder enrichment will be skipped');
      this.geminiExtractor = null;
    }

    this.scorer = new LeadScorer(config?.scoringConfigPath);
  }

  /**
   * Enrich a single lead with all available data sources
   */
  async enrichLead(lead: Lead): Promise<EnrichmentResult> {
    console.log(`\n🔍 Enriching lead: ${lead.email}`);

    let costUsd = 0;
    const enrichedLead: EnrichedLead = {
      ...lead,
      enrichment: {},
      score: {
        total: 0,
        breakdown: { ambition: 0, intelligence: 0, kindness: 0, trackRecord: 0 },
        signals: {},
        tier: 'weak',
        reasoning: 'No data available for scoring',
      },
      enrichedAt: new Date(),
      costUsd: 0,
    };

    // ========================================================================
    // 1. GitHub Enrichment (FREE)
    // ========================================================================
    try {
      console.log('  → Checking GitHub...');
      const githubProfile = await this.githubEnricher.enrichByEmail(lead.email);

      if (githubProfile) {
        enrichedLead.enrichment.github = githubProfile;
        console.log(`    ✓ Found GitHub: @${githubProfile.username} (${githubProfile.publicRepos} repos, ${githubProfile.totalStars} stars)`);
      } else {
        console.log('    ✗ No GitHub profile found');
      }
    } catch (error) {
      console.error('    ✗ GitHub enrichment failed:', error);
    }

    // ========================================================================
    // 2. Hunter.io Enrichment (FREE TIER: 50/month)
    // ========================================================================
    try {
      console.log('  → Checking Hunter.io...');
      const hunterProfile = await this.hunterEnricher.verifyEmail(lead.email);

      if (hunterProfile) {
        enrichedLead.enrichment.hunter = hunterProfile;
        costUsd += 0.01; // Approximate cost per search

        if (hunterProfile.linkedinUrl) {
          console.log(`    ✓ Found LinkedIn URL: ${hunterProfile.linkedinUrl}`);
        }
        if (hunterProfile.company) {
          console.log(`    ✓ Found company: ${hunterProfile.company}`);
        }
        if (hunterProfile.position) {
          console.log(`    ✓ Found position: ${hunterProfile.position}`);
        }
      } else {
        console.log('    ✗ No Hunter.io data found');
      }
    } catch (error) {
      console.error('    ✗ Hunter.io enrichment failed:', error);
    }

    // ========================================================================
    // 3. Founder Enrichment (FREE with Gemini - 1,500/day)
    // ========================================================================
    if (this.geminiExtractor && enrichedLead.enrichment.hunter) {
      try {
        console.log('  → Enriching founder data...');

        const hunterData = enrichedLead.enrichment.hunter;
        const personName = hunterData.firstName && hunterData.lastName
          ? `${hunterData.firstName} ${hunterData.lastName}`
          : lead.name || lead.email.split('@')[0];

        // Step 1: Crawl LinkedIn profile if available
        let linkedinData = null;
        if (hunterData.linkedinUrl) {
          linkedinData = await this.linkedinCrawler.crawlProfile(hunterData.linkedinUrl);
        }

        // Step 2: Search Google for press mentions
        const searchResults = await this.googleSearchCrawler.searchAndCrawl(personName);

        // Step 3: Extract founder signals with AI
        if (linkedinData || searchResults.length > 0) {
          const founderSignals = await this.geminiExtractor.extractFounderSignals(
            linkedinData,
            searchResults,
            personName
          );

          enrichedLead.enrichment.founder = founderSignals;

          console.log(`    ✓ Founder enrichment complete (confidence: ${founderSignals.confidence}%)`);
        } else {
          console.log('    ✗ No data available for founder enrichment');
        }
      } catch (error: any) {
        console.error('    ✗ Founder enrichment failed:', error.message);
      } finally {
        // Cleanup crawlers
        await this.linkedinCrawler.close();
        await this.googleSearchCrawler.close();
      }
    } else if (!this.geminiExtractor) {
      console.log('  ⊘ Skipping founder enrichment (no Gemini API key)');
    }

    // ========================================================================
    // 4. Score the lead
    // ========================================================================
    try {
      console.log('  → Calculating score...');
      enrichedLead.score = this.scorer.score(enrichedLead);
      enrichedLead.costUsd = costUsd;

      console.log(`    ✓ Score: ${enrichedLead.score.total}/100 (${enrichedLead.score.tier})`);
      console.log(`    → ${enrichedLead.score.reasoning}`);
      console.log(`    💰 Cost: $${costUsd.toFixed(4)}`);
    } catch (error) {
      console.error('    ✗ Scoring failed:', error);
    }

    const success = Object.keys(enrichedLead.enrichment).length > 0;

    return {
      success,
      lead: enrichedLead,
      costUsd,
    };
  }

  /**
   * Enrich multiple leads in batch
   */
  async enrichLeads(leads: Lead[], options?: {
    maxConcurrent?: number;
    onProgress?: (current: number, total: number, lead: EnrichedLead) => void;
  }): Promise<EnrichmentResult[]> {
    const maxConcurrent = options?.maxConcurrent || 3;
    const results: EnrichmentResult[] = [];

    console.log(`\n📊 Starting batch enrichment: ${leads.length} leads`);
    console.log(`   Concurrency: ${maxConcurrent}`);

    // Process in batches
    for (let i = 0; i < leads.length; i += maxConcurrent) {
      const batch = leads.slice(i, i + maxConcurrent);

      const batchResults = await Promise.all(
        batch.map(lead => this.enrichLead(lead))
      );

      results.push(...batchResults);

      // Call progress callback
      if (options?.onProgress) {
        batchResults.forEach((result, idx) => {
          if (result.lead) {
            options.onProgress!(i + idx + 1, leads.length, result.lead);
          }
        });
      }

      // Small delay to avoid rate limits
      if (i + maxConcurrent < leads.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Summary
    const totalCost = results.reduce((sum, r) => sum + r.costUsd, 0);
    const successful = results.filter(r => r.success).length;

    console.log(`\n✅ Batch enrichment complete:`);
    console.log(`   Successful: ${successful}/${leads.length}`);
    console.log(`   Total cost: $${totalCost.toFixed(4)}`);
    console.log(`   Avg cost per lead: $${(totalCost / leads.length).toFixed(4)}`);

    return results;
  }

  /**
   * Get enrichment statistics
   */
  async getStats(): Promise<{
    github: { remaining: number; limit: number; reset: Date };
    hunter: { used: number; limit: number } | null;
  }> {
    const [githubRateLimit, hunterAccount] = await Promise.all([
      this.githubEnricher.getRateLimit(),
      this.hunterEnricher.getAccountInfo(),
    ]);

    const hunter = hunterAccount ? {
      used: hunterAccount.requestsUsed,
      limit: hunterAccount.requestsLimit,
    } : null;

    return {
      github: githubRateLimit,
      hunter,
    };
  }
}
