import axios from 'axios';
import { config } from '../config/index';

export interface ExaSearchResult {
  title: string;
  url: string;
  snippet: string;
  author?: string;
  publishedDate?: string;
  score?: number;
}

export class ExaQualifier {
  private apiKey: string;
  private baseUrl = 'https://api.exa.ai/search';

  constructor() {
    this.apiKey = config.exa.apiKey;
  }

  /**
   * Search for a person using Exa (neural search for high-quality content)
   */
  async searchPerson(name: string): Promise<ExaSearchResult[]> {
    if (!this.apiKey) {
      console.warn('Exa API key not configured - skipping Exa search');
      return [];
    }

    const query = `${name} founder CEO entrepreneur startup achievements`;

    try {
      const response = await axios.post(
        this.baseUrl,
        {
          query,
          num_results: 10,
          type: 'neural',
          contents: {
            text: true,
          },
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      const results = response.data?.results || [];

      return results.map((result: any) => ({
        title: result.title || '',
        url: result.url || '',
        snippet: result.text || result.snippet || '',
        author: result.author || undefined,
        publishedDate: result.publishedDate || undefined,
        score: result.score || undefined,
      }));
    } catch (error: any) {
      console.error('Exa search error:', error.message);
      return [];
    }
  }

  /**
   * Find similar high-quality content about entrepreneurship and startups
   */
  async findSimilarContent(url: string): Promise<ExaSearchResult[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      const response = await axios.post(
        'https://api.exa.ai/findSimilar',
        {
          url,
          num_results: 5,
          contents: {
            text: true,
          },
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      const results = response.data?.results || [];

      return results.map((result: any) => ({
        title: result.title || '',
        url: result.url || '',
        snippet: result.text || result.snippet || '',
        author: result.author || undefined,
        publishedDate: result.publishedDate || undefined,
        score: result.score || undefined,
      }));
    } catch (error: any) {
      console.error('Exa findSimilar error:', error.message);
      return [];
    }
  }
}
