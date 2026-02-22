import axios from 'axios';
import { config } from '../config/index.js';

export interface SerperSearchResult {
  title: string;
  url: string;
  snippet: string;
  date?: string;
  position?: number;
}

export class SerperQualifier {
  private apiKey: string;
  private baseUrl = 'https://google.serper.dev/search';

  constructor() {
    this.apiKey = config.serper.apiKey;
  }

  /**
   * Search for a person using Serper (Google search API)
   */
  async searchPerson(name: string): Promise<SerperSearchResult[]> {
    if (!this.apiKey) {
      console.warn('Serper API key not configured - skipping Serper search');
      return [];
    }

    const query = `"${name}" AND (founder OR CEO OR entrepreneur OR startup OR company)`;

    try {
      const response = await axios.post(
        this.baseUrl,
        {
          q: query,
          num: 10,
        },
        {
          headers: {
            'X-API-KEY': this.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      const organicResults = response.data?.organic || [];

      return organicResults.map((result: any) => ({
        title: result.title || '',
        url: result.link || '',
        snippet: result.snippet || '',
        date: result.date || undefined,
        position: result.position || undefined,
      }));
    } catch (error: any) {
      console.error('Serper search error:', error.message);
      return [];
    }
  }

  /**
   * Search for specific achievements or press mentions
   */
  async searchAchievements(name: string): Promise<SerperSearchResult[]> {
    if (!this.apiKey) {
      return [];
    }

    const query = `"${name}" AND (funded OR raised OR "series A" OR "series B" OR acquisition OR award OR Forbes OR TechCrunch)`;

    try {
      const response = await axios.post(
        this.baseUrl,
        {
          q: query,
          num: 10,
        },
        {
          headers: {
            'X-API-KEY': this.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      const organicResults = response.data?.organic || [];

      return organicResults.map((result: any) => ({
        title: result.title || '',
        url: result.link || '',
        snippet: result.snippet || '',
        date: result.date || undefined,
        position: result.position || undefined,
      }));
    } catch (error: any) {
      console.error('Serper achievements search error:', error.message);
      return [];
    }
  }
}
