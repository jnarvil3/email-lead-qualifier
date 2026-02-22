import axios from 'axios';
import { config } from '../config/index.js';

// Using the same interface as Google Search for compatibility with Gemini extractor
export interface BraveSearchResult {
  title: string;
  url: string;
  snippet: string;
  pageContent?: string;
  relevance?: number;
}

export interface BraveSearchData {
  results: BraveSearchResult[];
  query: string;
  timestamp: string;
}

export class BraveSearchEnricher {
  private apiKey: string;
  private baseUrl = 'https://api.search.brave.com/res/v1/web/search';

  constructor() {
    this.apiKey = config.braveSearch.apiKey;
  }

  /**
   * Search for a person with founder-related keywords
   */
  async searchPerson(name: string): Promise<BraveSearchData> {
    const keywords = ['founder', 'CEO', 'startup', 'entrepreneur', 'company'];
    const query = `"${name}" ${keywords.join(' OR ')}`;

    try {
      const results = await this.search(query, 10);
      return {
        results,
        query,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Brave Search error:', error);
      return {
        results: [],
        query,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Search for funding and investment news
   */
  async searchFunding(name: string, companyName?: string): Promise<BraveSearchResult[]> {
    const searchTerms = companyName
      ? `"${name}" "${companyName}" (funding OR investment OR "series A" OR "series B" OR raised)`
      : `"${name}" (funding OR investment OR "series A" OR "series B" OR raised)`;

    try {
      return await this.search(searchTerms, 5);
    } catch (error) {
      console.error('Brave Search funding error:', error);
      return [];
    }
  }

  /**
   * Search for press mentions and media coverage
   */
  async searchPress(name: string): Promise<BraveSearchResult[]> {
    const query = `"${name}" (interview OR featured OR "spoke at" OR keynote OR TechCrunch OR "Forbes 30")`;

    try {
      return await this.search(query, 5);
    } catch (error) {
      console.error('Brave Search press error:', error);
      return [];
    }
  }

  /**
   * Core search method
   */
  private async search(query: string, count: number = 10): Promise<BraveSearchResult[]> {
    const response = await axios.get(this.baseUrl, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': this.apiKey,
      },
      params: {
        q: query,
        count,
        search_lang: 'en',
        safesearch: 'off',
        freshness: 'py', // Past year for recent news
      },
    });

    // Brave returns results in response.data.web.results
    const webResults = response.data?.web?.results || [];

    return webResults.map((result: any) => ({
      title: result.title || '',
      url: result.url || '',
      snippet: result.description || '',
      relevance: result.age ? this.calculateRelevance(result.age) : undefined,
    }));
  }

  /**
   * Calculate relevance score based on age of content
   */
  private calculateRelevance(age: string): number {
    // Brave returns age like "2 days ago", "1 month ago", etc.
    if (age.includes('day')) return 1.0;
    if (age.includes('week')) return 0.9;
    if (age.includes('month')) return 0.7;
    if (age.includes('year')) return 0.5;
    return 0.3;
  }

  /**
   * Get API usage stats (if available from headers)
   */
  async getUsageStats(): Promise<{ used: number; limit: number } | null> {
    try {
      // Brave doesn't have a dedicated endpoint for usage stats
      // We'll track this in the response headers if available
      const response = await axios.get(this.baseUrl, {
        headers: {
          'X-Subscription-Token': this.apiKey,
        },
        params: {
          q: 'test',
          count: 1,
        },
      });

      // Check if Brave returns usage info in headers
      const remaining = response.headers['x-rate-limit-remaining'];
      const limit = response.headers['x-rate-limit-limit'];

      if (remaining && limit) {
        return {
          used: parseInt(limit) - parseInt(remaining),
          limit: parseInt(limit),
        };
      }

      // Default for free tier: 2,000 requests per month
      return null;
    } catch (error) {
      return null;
    }
  }
}
