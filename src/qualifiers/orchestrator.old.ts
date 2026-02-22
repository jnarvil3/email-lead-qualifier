import { GitHubQualifier } from './github.qualifier';
import { HunterQualifier } from './hunter.qualifier';
import { LinkedInCrawler } from './linkedin.crawler';
import { BraveSearchQualifier } from './brave-search.qualifier';
import { GeminiExtractor } from './gemini.extractor';
import { LeadScorer } from '../scoring/scorer';
import { Lead, QualifiedLead, QualificationResult } from '../types';

export class QualificationOrchestrator {
  private githubQualifier: GitHubQualifier;
  private hunterQualifier: HunterQualifier;
  private linkedinCrawler: LinkedInCrawler;
  private braveSearchQualifier: BraveSearchQualifier;
  private geminiExtractor: GeminiExtractor | null;
  private scorer: LeadScorer;

  constructor(config?: {
    githubToken?: string;
    hunterApiKey?: string;
    geminiApiKey?: string;
    braveSearchApiKey?: string;
    scoringConfigPath?: string;
  }) {
    this.githubQualifier = new GitHubQualifier(config?.githubToken);
    this.hunterQualifier = new HunterQualifier(config?.hunterApiKey);
    this.linkedinCrawler = new LinkedInCrawler();
    this.braveSearchQualifier = new BraveSearchQualifier();

    // Gemini is optional - only initialize if API key provided
    try {
      this.geminiExtractor = new GeminiExtractor(config?.geminiApiKey);
    } catch (error) {
      console.warn('Gemini API key not provided - founder qualification will be skipped');
      this.geminiExtractor = null;
    }

    this.scorer = new LeadScorer(config?.scoringConfigPath);
  }

  /**
   * Enrich a single lead with all available data sources
   */
  async qualifyLead(lead: Lead): Promise<QualificationResult> {
    console.log(`\n🔍 Enriching lead: ${lead.email}`);

    let costUsd = 0;
    const enrichedLead: QualifiedLead = {
      ...lead,
      qualification: {},
      score: {
        total: 0,
        breakdown: { ambition: 0, intelligence: 0, kindness: 0, trackRecord: 0 },
        signals: {},
        tier: 'weak',
        reasoning: 'No data available for scoring',
      },
      qualifiedAt: new Date(),
      costUsd: 0,
    };

    // ========================================================================
    // 1. GitHub Qualification (FREE)
    // ========================================================================
    try {
      console.log('  → Checking GitHub...');
      const githubProfile = await this.githubQualifier.qualifyByEmail(lead.email);

      if (githubProfile) {
        enrichedLead.qualification.github = githubProfile;
        console.log(`    ✓ Found GitHub: @${githubProfile.username} (${githubProfile.publicRepos} repos, ${githubProfile.totalStars} stars)`);
      } else {
        console.log('    ✗ No GitHub profile found');
      }
    } catch (error) {
      console.error('    ✗ GitHub qualification failed:', error);
    }

    // ========================================================================
    // 2. Hunter.io Qualification (FREE TIER: 50/month)
    // ========================================================================
    try {
      console.log('  → Checking Hunter.io...');
      const hunterProfile = await this.hunterQualifier.verifyEmail(lead.email);

      if (hunterProfile) {
        enrichedLead.qualification.hunter = hunterProfile;
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
      console.error('    ✗ Hunter.io qualification failed:', error);
    }

    // ========================================================================
    // 3. Founder Qualification (FREE with Gemini - 1,500/day)
    // ========================================================================
    if (this.geminiExtractor && enrichedLead.qualification.hunter) {
      try {
        console.log('  → Enriching founder data...');

        const hunterData = enrichedLead.qualification.hunter;
        const personName = hunterData.firstName && hunterData.lastName
          ? `${hunterData.firstName} ${hunterData.lastName}`
          : lead.name || lead.email.split('@')[0];

        // Step 1: Crawl LinkedIn profile if available
        let linkedinData = null;
        if (hunterData.linkedinUrl) {
          linkedinData = await this.linkedinCrawler.crawlProfile(hunterData.linkedinUrl);
        }

        // Step 2: Search Brave for press mentions and founder info
        const braveSearchData = await this.braveSearchQualifier.searchPerson(personName);

        // Also search for funding information
        const companyName = hunterData.company || undefined;
        const fundingResults = await this.braveSearchQualifier.searchFunding(personName, companyName);
        const pressResults = await this.braveSearchQualifier.searchPress(personName);

        // Combine all search results
        const searchResults = [
          ...braveSearchData.results,
          ...fundingResults,
          ...pressResults
        ].slice(0, 20); // Limit to top 20 results

        console.log(`    → Found ${searchResults.length} search results from Brave`);

        // Step 3: Extract founder signals with AI
        if (linkedinData || searchResults.length > 0) {
          const founderSignals = await this.geminiExtractor.extractFounderSignals(
            linkedinData,
            searchResults,
            personName
          );

          enrichedLead.qualification.founder = founderSignals;

          console.log(`    ✓ Founder qualification complete (confidence: ${founderSignals.confidence}%)`);
        } else {
          console.log('    ✗ No data available for founder qualification');
        }
      } catch (error: any) {
        console.error('    ✗ Founder qualification failed:', error.message);
      } finally {
        // Cleanup crawlers
        await this.linkedinCrawler.close();
      }
    } else if (!this.geminiExtractor) {
      console.log('  ⊘ Skipping founder qualification (no Gemini API key)');
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

    const success = Object.keys(enrichedLead.qualification).length > 0;

    return {
      success,
      lead: enrichedLead,
      costUsd,
    };
  }

  /**
   * Enrich multiple leads in batch
   */
  async qualifyLeads(leads: Lead[], options?: {
    maxConcurrent?: number;
    onProgress?: (current: number, total: number, lead: QualifiedLead) => void;
  }): Promise<QualificationResult[]> {
    const maxConcurrent = options?.maxConcurrent || 3;
    const results: QualificationResult[] = [];

    console.log(`\n📊 Starting batch qualification: ${leads.length} leads`);
    console.log(`   Concurrency: ${maxConcurrent}`);

    // Process in batches
    for (let i = 0; i < leads.length; i += maxConcurrent) {
      const batch = leads.slice(i, i + maxConcurrent);

      const batchResults = await Promise.all(
        batch.map(lead => this.qualifyLead(lead))
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

    console.log(`\n✅ Batch qualification complete:`);
    console.log(`   Successful: ${successful}/${leads.length}`);
    console.log(`   Total cost: $${totalCost.toFixed(4)}`);
    console.log(`   Avg cost per lead: $${(totalCost / leads.length).toFixed(4)}`);

    return results;
  }

  /**
   * Get qualification statistics
   */
  async getStats(): Promise<{
    github: { remaining: number; limit: number; reset: Date };
    hunter: { used: number; limit: number } | null;
    brave: { used: number; limit: number } | null;
  }> {
    const [githubRateLimit, hunterAccount, braveStats] = await Promise.all([
      this.githubQualifier.getRateLimit(),
      this.hunterQualifier.getAccountInfo(),
      this.braveSearchQualifier.getUsageStats(),
    ]);

    const hunter = hunterAccount ? {
      used: hunterAccount.requestsUsed,
      limit: hunterAccount.requestsLimit,
    } : null;

    return {
      github: githubRateLimit,
      hunter,
      brave: braveStats,
    };
  }
}
