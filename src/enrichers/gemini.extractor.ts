import { GoogleGenerativeAI } from '@google/generative-ai';
import { LinkedInCrawlResult } from './linkedin.crawler';
import { SearchResult } from './google-search.crawler';

export interface FounderSignals {
  // Ambition
  companiesFounded: Array<{
    name: string;
    role: string;
    yearFounded: number | null;
    description: string;
  }>;
  leadershipRoles: Array<{
    title: string;
    company: string;
    yearsInRole: number | null;
  }>;
  thoughtLeadership: {
    speaking: boolean;
    writing: boolean;
    podcasting: boolean;
    examples: string[];
  };

  // Intelligence
  topEducation: Array<{
    school: string;
    degree: string | null;
    field: string | null;
    isTopTier: boolean;
  }>;
  strategicAccomplishments: string[];
  certifications: string[];

  // Kindness
  volunteerWork: Array<{
    organization: string;
    role: string;
    description: string;
  }>;
  mentorship: {
    isMentor: boolean;
    examples: string[];
  };
  communityBuilding: string[];

  // Track Record
  fundingRaised: Array<{
    company: string;
    amount: string | null;
    round: string | null;
    year: number | null;
  }>;
  exits: Array<{
    company: string;
    type: string; // acquisition, IPO, etc.
    year: number | null;
  }>;
  pressMentions: Array<{
    title: string;
    source: string;
    snippet: string;
  }>;
  awards: string[];

  // Extracted data quality
  confidence: number; // 0-100
  dataSources: string[];
}

export class GeminiExtractor {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY is required');
    }

    this.genAI = new GoogleGenerativeAI(key);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  /**
   * Extract founder signals from LinkedIn and search results using AI
   */
  async extractFounderSignals(
    linkedinData: LinkedInCrawlResult | null,
    searchResults: SearchResult[],
    personName: string
  ): Promise<FounderSignals> {
    try {
      console.log(`  → Analyzing data with Gemini AI...`);

      // Prepare context for AI
      const context = this.prepareContext(linkedinData, searchResults, personName);

      // Generate AI prompt
      const prompt = this.buildExtractionPrompt(context, personName);

      // Call Gemini
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse JSON response
      const signals = this.parseAIResponse(text);

      console.log(`    ✓ Extracted ${signals.companiesFounded.length} companies, ${signals.fundingRaised.length} funding rounds`);

      return signals;
    } catch (error: any) {
      console.error(`    ✗ Gemini extraction failed:`, error.message);

      // Return empty signals on error
      return this.getEmptySignals();
    }
  }

  private prepareContext(
    linkedinData: LinkedInCrawlResult | null,
    searchResults: SearchResult[],
    personName: string
  ): string {
    let context = `Person: ${personName}\n\n`;

    // Add LinkedIn data
    if (linkedinData) {
      context += `LINKEDIN PROFILE:\n`;
      context += `Name: ${linkedinData.fullName}\n`;
      context += `Headline: ${linkedinData.headline}\n`;
      context += `Location: ${linkedinData.location}\n`;
      context += `About: ${linkedinData.about}\n\n`;

      context += `EXPERIENCE:\n`;
      linkedinData.experience.forEach((exp, i) => {
        context += `${i + 1}. ${exp.title} at ${exp.company} (${exp.duration})\n`;
        if (exp.description) {
          context += `   ${exp.description.slice(0, 200)}\n`;
        }
      });

      context += `\nEDUCATION:\n`;
      linkedinData.education.forEach((edu, i) => {
        context += `${i + 1}. ${edu.school} - ${edu.degree || 'N/A'} ${edu.field || ''}\n`;
      });

      context += `\nSKILLS: ${linkedinData.skills.join(', ')}\n\n`;
    }

    // Add search results
    if (searchResults.length > 0) {
      context += `PRESS & ARTICLES:\n`;
      searchResults.forEach((result, i) => {
        context += `${i + 1}. ${result.title}\n`;
        context += `   ${result.snippet}\n`;
        if (result.pageContent) {
          context += `   Content: ${result.pageContent.slice(0, 500)}...\n`;
        }
        context += `\n`;
      });
    }

    return context.slice(0, 30000); // Limit to 30k chars
  }

  private buildExtractionPrompt(context: string, personName: string): string {
    return `You are analyzing data about ${personName} to extract founder/entrepreneur signals.

${context}

Based on the data above, extract the following information in JSON format:

{
  "companiesFounded": [{"name": "Company name", "role": "Founder/Co-Founder", "yearFounded": 2020, "description": "Brief description"}],
  "leadershipRoles": [{"title": "CEO", "company": "Company", "yearsInRole": 3}],
  "thoughtLeadership": {"speaking": true/false, "writing": true/false, "podcasting": true/false, "examples": ["example 1"]},
  "topEducation": [{"school": "School name", "degree": "MBA", "field": "Business", "isTopTier": true/false}],
  "strategicAccomplishments": ["accomplishment 1", "accomplishment 2"],
  "certifications": ["cert 1"],
  "volunteerWork": [{"organization": "Org", "role": "Advisor", "description": "desc"}],
  "mentorship": {"isMentor": true/false, "examples": ["example"]},
  "communityBuilding": ["example 1"],
  "fundingRaised": [{"company": "Company", "amount": "$5M", "round": "Series A", "year": 2021}],
  "exits": [{"company": "Company", "type": "Acquisition", "year": 2020}],
  "pressMentions": [{"title": "Article title", "source": "TechCrunch", "snippet": "snippet"}],
  "awards": ["award 1"],
  "confidence": 85,
  "dataSources": ["LinkedIn", "Press articles"]
}

IMPORTANT:
1. Only include data you can verify from the context
2. If no data found for a field, use empty array [] or false
3. For topEducation, isTopTier = true for Ivy League, Stanford, MIT, top 20 universities
4. For confidence: 0-30 = low data, 30-60 = moderate, 60-100 = rich data
5. Return ONLY valid JSON, no additional text

Extract now:`;
  }

  private parseAIResponse(text: string): FounderSignals {
    try {
      // Remove markdown code blocks if present
      let jsonText = text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonText);

      // Validate and fill in defaults
      return {
        companiesFounded: parsed.companiesFounded || [],
        leadershipRoles: parsed.leadershipRoles || [],
        thoughtLeadership: parsed.thoughtLeadership || { speaking: false, writing: false, podcasting: false, examples: [] },
        topEducation: parsed.topEducation || [],
        strategicAccomplishments: parsed.strategicAccomplishments || [],
        certifications: parsed.certifications || [],
        volunteerWork: parsed.volunteerWork || [],
        mentorship: parsed.mentorship || { isMentor: false, examples: [] },
        communityBuilding: parsed.communityBuilding || [],
        fundingRaised: parsed.fundingRaised || [],
        exits: parsed.exits || [],
        pressMentions: parsed.pressMentions || [],
        awards: parsed.awards || [],
        confidence: parsed.confidence || 0,
        dataSources: parsed.dataSources || [],
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return this.getEmptySignals();
    }
  }

  private getEmptySignals(): FounderSignals {
    return {
      companiesFounded: [],
      leadershipRoles: [],
      thoughtLeadership: { speaking: false, writing: false, podcasting: false, examples: [] },
      topEducation: [],
      strategicAccomplishments: [],
      certifications: [],
      volunteerWork: [],
      mentorship: { isMentor: false, examples: [] },
      communityBuilding: [],
      fundingRaised: [],
      exits: [],
      pressMentions: [],
      awards: [],
      confidence: 0,
      dataSources: [],
    };
  }
}
