import axios from 'axios';
import { config } from '../config/index';

export interface TavilySearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  score?: number;
  publishedDate?: string;
}

export class TavilyQualifier {
  private apiKey: string;
  private baseUrl = 'https://api.tavily.com/search';

  constructor() {
    this.apiKey = config.tavily.apiKey;
  }

  /**
   * Search for a person using Tavily (AI-optimized search)
   */
  async searchPerson(name: string): Promise<TavilySearchResult[]> {
    if (!this.apiKey) {
      console.warn('Tavily API key not configured - skipping Tavily search');
      return [];
    }

    const query = `"${name}" founder CEO entrepreneur startup company achievements`;

    try {
      const response = await axios.post(
        this.baseUrl,
        {
          api_key: this.apiKey,
          query,
          search_depth: 'advanced',
          max_results: 10,
          include_answer: false,
          include_raw_content: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const results = response.data?.results || [];

      return results.map((result: any) => ({
        title: result.title || '',
        url: result.url || '',
        snippet: result.content || result.snippet || '',
        content: result.raw_content || undefined,
        score: result.score || undefined,
        publishedDate: result.published_date || undefined,
      }));
    } catch (error: any) {
      console.error('Tavily search error:', error.message);
      return [];
    }
  }

  /**
   * Deep search for detailed information
   */
  async searchDeep(name: string, companyName?: string): Promise<TavilySearchResult[]> {
    if (!this.apiKey) {
      return [];
    }

    const query = companyName
      ? `"${name}" "${companyName}" founder funding raised investment achievement`
      : `"${name}" founder funding raised investment achievement award`;

    try {
      const response = await axios.post(
        this.baseUrl,
        {
          api_key: this.apiKey,
          query,
          search_depth: 'advanced',
          max_results: 10,
          include_answer: true,
          include_raw_content: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const results = response.data?.results || [];

      return results.map((result: any) => ({
        title: result.title || '',
        url: result.url || '',
        snippet: result.content || result.snippet || '',
        content: result.raw_content || undefined,
        score: result.score || undefined,
        publishedDate: result.published_date || undefined,
      }));
    } catch (error: any) {
      console.error('Tavily deep search error:', error.message);
      return [];
    }
  }
}
