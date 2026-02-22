import axios from 'axios';
import { HunterProfile } from '../types';

/**
 * Hunter.io Email Finder & Verifier
 * Free tier: 50 searches/month
 * https://hunter.io/api-documentation
 */
export class HunterQualifier {
  private apiKey: string;
  private baseUrl = 'https://api.hunter.io/v2';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.HUNTER_API_KEY || '';
    if (!this.apiKey) {
      console.warn('Warning: No Hunter.io API key provided. Qualification will be skipped.');
    }
  }

  /**
   * Verify an email and get associated data
   */
  async verifyEmail(email: string): Promise<HunterProfile | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/email-verifier`, {
        params: {
          email,
          api_key: this.apiKey,
        },
      });

      const { data } = response.data;

      if (!data) {
        return null;
      }

      // Extract profile info
      const profile: HunterProfile = {
        email: data.email,
        firstName: data.first_name || null,
        lastName: data.last_name || null,
        position: data.position || null,
        company: data.company || null,
        linkedinUrl: data.linkedin || null,
        twitterUrl: data.twitter || null,
        verified: data.status === 'valid',
        confidence: data.score || 0,
      };

      return profile;
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.error('Hunter.io rate limit exceeded');
      } else if (error.response?.status === 401) {
        console.error('Hunter.io API key invalid');
      } else {
        console.error('Error verifying email with Hunter:', error.message);
      }
      return null;
    }
  }

  /**
   * Find email from name and domain
   */
  async findEmail(firstName: string, lastName: string, domain: string): Promise<string | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/email-finder`, {
        params: {
          first_name: firstName,
          last_name: lastName,
          domain,
          api_key: this.apiKey,
        },
      });

      const { data } = response.data;
      return data?.email || null;
    } catch (error) {
      console.error('Error finding email with Hunter:', error);
      return null;
    }
  }

  /**
   * Get LinkedIn URL from email (if available in Hunter's database)
   */
  async getLinkedInUrl(email: string): Promise<string | null> {
    const profile = await this.verifyEmail(email);
    return profile?.linkedinUrl || null;
  }

  /**
   * Check remaining API credits
   */
  async getAccountInfo(): Promise<{ requestsUsed: number; requestsLimit: number } | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/account`, {
        params: {
          api_key: this.apiKey,
        },
      });

      const { data } = response.data;
      return {
        requestsUsed: data.requests.used_searches || 0,
        requestsLimit: data.requests.searches.available || 50,
      };
    } catch (error) {
      console.error('Error getting Hunter account info:', error);
      return null;
    }
  }
}
