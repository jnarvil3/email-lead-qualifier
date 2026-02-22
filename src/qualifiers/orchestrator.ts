import { BraveSearchQualifier } from './brave-search.qualifier';
import { SerperQualifier } from './serper.qualifier';
import { ExaQualifier } from './exa.qualifier';
import { TavilyQualifier } from './tavily.qualifier';
import { NameExtractor } from './name.extractor';
import { GeminiExtractor } from './gemini.extractor';
import { Lead, QualifiedLead, QualificationResult } from '../types';

export class QualificationOrchestrator {
  private braveSearchQualifier: BraveSearchQualifier;
  private serperQualifier: SerperQualifier;
  private exaQualifier: ExaQualifier;
  private tavilyQualifier: TavilyQualifier;
  private nameExtractor: NameExtractor;
  private geminiExtractor: GeminiExtractor | null;

  constructor() {
    this.braveSearchQualifier = new BraveSearchQualifier();
    this.serperQualifier = new SerperQualifier();
    this.exaQualifier = new ExaQualifier();
    this.tavilyQualifier = new TavilyQualifier();
    this.nameExtractor = new NameExtractor();

    // Gemini is required for the new flow
    try {
      this.geminiExtractor = new GeminiExtractor();
    } catch (error) {
      console.error('Gemini API is required for qualification');
      this.geminiExtractor = null;
    }
  }

  /**
   * Qualify a single lead using the new comprehensive flow
   */
  async qualifyLead(lead: Lead): Promise<QualificationResult> {
    console.log(`\n🔍 Qualifying lead: ${lead.email}`);

    // ========================================================================
    // STEP 1: Validate/Extract Full Name
    // ========================================================================
    console.log('  → Step 1: Validating name...');
    const nameResult = await this.nameExtractor.processName(lead.name, lead.email);

    if (!nameResult.isValid || !nameResult.fullName) {
      console.log(`    ✗ ${nameResult.error}`);
      return {
        success: false,
        lead: null,
        costUsd: 0,
        error: nameResult.error || 'Name validation failed',
      };
    }

    const fullName = nameResult.fullName;
    console.log(`    ✓ Full name: ${fullName}`);

    // ========================================================================
    // STEP 2: Search ALL APIs in Parallel
    // ========================================================================
    console.log('  → Step 2: Searching across multiple APIs...');

    const [braveResults, serperResults, exaResults, tavilyResults] = await Promise.all([
      this.braveSearchQualifier.searchPerson(fullName),
      this.serperQualifier.searchPerson(fullName),
      this.exaQualifier.searchPerson(fullName),
      this.tavilyQualifier.searchPerson(fullName),
    ]);

    const braveResultsList = Array.isArray(braveResults) ? braveResults : (braveResults.results || []);

    console.log(`    ✓ Brave: ${braveResultsList.length} results`);
    console.log(`    ✓ Serper: ${serperResults.length} results`);
    console.log(`    ✓ Exa: ${exaResults.length} results`);
    console.log(`    ✓ Tavily: ${tavilyResults.length} results`);

    // Combine all results
    const allSearchResults = [
      ...braveResultsList,
      ...serperResults,
      ...exaResults,
      ...tavilyResults,
    ];

    const totalResults = allSearchResults.length;
    console.log(`    → Total results collected: ${totalResults}`);

    if (totalResults === 0) {
      console.log(`    ✗ No results found for "${fullName}"`);
      return {
        success: false,
        lead: null,
        costUsd: 0,
        error: `No online information found for ${fullName}`,
      };
    }

    // ========================================================================
    // STEP 3: AI Analysis & Ranking
    // ========================================================================
    if (!this.geminiExtractor) {
      return {
        success: false,
        lead: null,
        costUsd: 0,
        error: 'Gemini API required for qualification',
      };
    }

    console.log('  → Step 3: Analyzing with AI...');

    const analysis = await this.geminiExtractor.analyzeAndRank({
      personName: fullName,
      email: lead.email,
      searchResults: allSearchResults,
    });

    console.log(`    ✓ Analysis complete`);
    console.log(`    → Score: ${analysis.score}/100 (${analysis.tier})`);
    console.log(`    → Confidence: ${analysis.confidence}%`);
    console.log(`    → Best achievements: ${analysis.bestAchievements.length}`);

    // ========================================================================
    // STEP 4: Build Qualified Lead
    // ========================================================================
    const qualifiedLead: QualifiedLead = {
      ...lead,
      name: fullName, // Use the validated/extracted full name
      qualification: {
        searchResults: allSearchResults.slice(0, 20), // Store top 20 results
        analysis,
      },
      score: {
        total: analysis.score,
        breakdown: analysis.breakdown,
        signals: analysis.signals || {},
        tier: analysis.tier,
        reasoning: analysis.reasoning,
      },
      qualifiedAt: new Date(),
      costUsd: 0.01, // Approximate cost for API calls
    };

    return {
      success: true,
      lead: qualifiedLead,
      costUsd: 0.01,
    };
  }

  /**
   * Qualify multiple leads in batch
   */
  async qualifyLeads(
    leads: Lead[],
    options?: {
      maxConcurrent?: number;
      onProgress?: (current: number, total: number, lead: QualifiedLead | null) => void;
    }
  ): Promise<QualificationResult[]> {
    const results: QualificationResult[] = [];
    const maxConcurrent = options?.maxConcurrent || 3;

    // Process in batches
    for (let i = 0; i < leads.length; i += maxConcurrent) {
      const batch = leads.slice(i, i + maxConcurrent);
      const batchResults = await Promise.all(
        batch.map((lead) => this.qualifyLead(lead))
      );

      results.push(...batchResults);

      // Report progress
      if (options?.onProgress) {
        batchResults.forEach((result, idx) => {
          options.onProgress!(i + idx + 1, leads.length, result.lead);
        });
      }
    }

    return results;
  }

  /**
   * Get API usage stats
   */
  async getStats(): Promise<{
    brave: { used: number; limit: number } | null;
    serper: { used: number; limit: number } | null;
    exa: { used: number; limit: number } | null;
    tavily: { used: number; limit: number } | null;
  }> {
    // For now, return static limits (can be enhanced with actual API calls)
    return {
      brave: { used: 0, limit: 2000 },
      serper: { used: 0, limit: 2500 },
      exa: { used: 0, limit: 1000 },
      tavily: { used: 0, limit: 1000 },
    };
  }
}
