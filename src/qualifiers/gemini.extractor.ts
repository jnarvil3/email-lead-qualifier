import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { LinkedInCrawlResult } from './linkedin.crawler';
import { SearchResult } from './google-search.crawler';
import { config } from '../config/index.js';

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
  private openai: OpenAI | null = null;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY is required');
    }

    this.genAI = new GoogleGenerativeAI(key);
    // Use Gemini 2.5 Flash (Gemini 1.5 retired in 2026)
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Initialize OpenAI as backup
    const openaiKey = config.openai.apiKey;
    if (openaiKey && openaiKey !== 'your_openai_api_key_here') {
      this.openai = new OpenAI({ apiKey: openaiKey });
      console.log('  → OpenAI backup enabled');
    }
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

  /**
   * Analyze using OpenAI as a fallback when Gemini fails
   */
  private async analyzeWithOpenAI(input: {
    personName: string;
    email: string;
    searchResults: any[];
  }): Promise<{
    score: number;
    tier: 'exceptional' | 'strong' | 'good' | 'average' | 'weak';
    breakdown: { ambition: number; intelligence: number; kindness: number; trackRecord: number };
    bestAchievements: string[];
    signals: any;
    confidence: number;
    reasoning: string;
  }> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const searchContext = input.searchResults
      .slice(0, 30)
      .map((result, i) => `
[Result ${i + 1}]
Title: ${result.title || 'N/A'}
URL: ${result.url || 'N/A'}
Content: ${result.snippet || result.content || result.description || 'N/A'}
`)
      .join('\n');

    const prompt = `You are an expert at evaluating founders and entrepreneurs. Analyze the following person based on search results and score them on these 4 criteria:

1. **Ambitious** (0-30 points): Companies founded, leadership roles, thought leadership, bold vision
2. **Intelligent** (0-30 points): Top education, strategic accomplishments, problem-solving ability
3. **Kind** (0-20 points): Volunteer work, mentorship, community building, helping others
4. **Proven Track Record** (0-20 points): Funding raised, successful exits, press mentions, awards

Person: ${input.personName}
Email: ${input.email}

Search Results:
${searchContext}

Based on ALL the search results above, provide a comprehensive analysis in JSON format:

{
  "ambition": <score 0-30>,
  "intelligence": <score 0-30>,
  "kindness": <score 0-20>,
  "trackRecord": <score 0-20>,
  "bestAchievements": [
    "Achievement 1 (be specific with company names, amounts, years)",
    "Achievement 2",
    "Achievement 3",
    "Achievement 4",
    "Achievement 5"
  ],
  "confidence": <0-100, how confident are you in this assessment>,
  "reasoning": "<2-3 sentence summary explaining the score>",
  "signals": {
    "companiesFounded": ["Company 1", "Company 2"],
    "fundingRaised": ["Series A $10M", "Series B $50M"],
    "exits": ["Acquired by X for $Y"],
    "pressMentions": ["Featured in Forbes", "TechCrunch article"],
    "education": ["Harvard MBA", "MIT CS"],
    "leadershipRoles": ["CEO of X", "VP at Y"]
  }
}

IMPORTANT:
- Only include achievements that are clearly mentioned in the search results
- Be specific with numbers, company names, and years when available
- If little/no information is found, give low scores and say so in reasoning
- List the TOP 5-10 most impressive achievements in order of significance
- Score fairly but generously - reward documented accomplishments

Return ONLY the JSON, no other text.`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const response = completion.choices[0]?.message?.content?.trim() || '{}';

    // Parse response
    let jsonText = response;
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(jsonText);

    const totalScore =
      (parsed.ambition || 0) +
      (parsed.intelligence || 0) +
      (parsed.kindness || 0) +
      (parsed.trackRecord || 0);

    let tier: 'exceptional' | 'strong' | 'good' | 'average' | 'weak';
    if (totalScore >= 80) tier = 'exceptional';
    else if (totalScore >= 65) tier = 'strong';
    else if (totalScore >= 50) tier = 'good';
    else if (totalScore >= 30) tier = 'average';
    else tier = 'weak';

    return {
      score: totalScore,
      tier,
      breakdown: {
        ambition: parsed.ambition || 0,
        intelligence: parsed.intelligence || 0,
        kindness: parsed.kindness || 0,
        trackRecord: parsed.trackRecord || 0,
      },
      bestAchievements: parsed.bestAchievements || [],
      signals: parsed.signals || {},
      confidence: parsed.confidence || 0,
      reasoning: parsed.reasoning || 'No analysis available',
    };
  }

  /**
   * NEW: Comprehensive analysis and ranking based on ALL search results
   * This is the main method for the new qualification flow
   */
  async analyzeAndRank(input: {
    personName: string;
    email: string;
    searchResults: any[];
  }): Promise<{
    score: number;
    tier: 'exceptional' | 'strong' | 'good' | 'average' | 'weak';
    breakdown: { ambition: number; intelligence: number; kindness: number; trackRecord: number };
    bestAchievements: string[];
    signals: any;
    confidence: number;
    reasoning: string;
  }> {
    try {
      // Prepare search results context
      const searchContext = input.searchResults
        .slice(0, 30) // Use top 30 results
        .map((result, i) => `
[Result ${i + 1}]
Title: ${result.title || 'N/A'}
URL: ${result.url || 'N/A'}
Content: ${result.snippet || result.content || result.description || 'N/A'}
`)
        .join('\n');

      const prompt = `You are an expert at evaluating founders and entrepreneurs. Analyze the following person based on search results and score them on these 4 criteria:

1. **Ambitious** (0-30 points): Companies founded, leadership roles, thought leadership, bold vision
2. **Intelligent** (0-30 points): Top education, strategic accomplishments, problem-solving ability
3. **Kind** (0-20 points): Volunteer work, mentorship, community building, helping others
4. **Proven Track Record** (0-20 points): Funding raised, successful exits, press mentions, awards

Person: ${input.personName}
Email: ${input.email}

Search Results:
${searchContext}

Based on ALL the search results above, provide a comprehensive analysis in JSON format:

{
  "ambition": <score 0-30>,
  "intelligence": <score 0-30>,
  "kindness": <score 0-20>,
  "trackRecord": <score 0-20>,
  "bestAchievements": [
    "Achievement 1 (be specific with company names, amounts, years)",
    "Achievement 2",
    "Achievement 3",
    "Achievement 4",
    "Achievement 5"
  ],
  "confidence": <0-100, how confident are you in this assessment>,
  "reasoning": "<2-3 sentence summary explaining the score>",
  "signals": {
    "companiesFounded": ["Company 1", "Company 2"],
    "fundingRaised": ["Series A $10M", "Series B $50M"],
    "exits": ["Acquired by X for $Y"],
    "pressMentions": ["Featured in Forbes", "TechCrunch article"],
    "education": ["Harvard MBA", "MIT CS"],
    "leadershipRoles": ["CEO of X", "VP at Y"]
  }
}

IMPORTANT:
- Only include achievements that are clearly mentioned in the search results
- Be specific with numbers, company names, and years when available
- If little/no information is found, give low scores and say so in reasoning
- List the TOP 5-10 most impressive achievements in order of significance
- Score fairly but generously - reward documented accomplishments

Return ONLY the JSON, no other text.`;

      const result = await this.model.generateContent(prompt);
      const response = result.response.text().trim();

      // Parse AI response
      let jsonText = response;
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonText);

      // Calculate total score and tier
      const totalScore =
        (parsed.ambition || 0) +
        (parsed.intelligence || 0) +
        (parsed.kindness || 0) +
        (parsed.trackRecord || 0);

      let tier: 'exceptional' | 'strong' | 'good' | 'average' | 'weak';
      if (totalScore >= 80) tier = 'exceptional';
      else if (totalScore >= 65) tier = 'strong';
      else if (totalScore >= 50) tier = 'good';
      else if (totalScore >= 30) tier = 'average';
      else tier = 'weak';

      return {
        score: totalScore,
        tier,
        breakdown: {
          ambition: parsed.ambition || 0,
          intelligence: parsed.intelligence || 0,
          kindness: parsed.kindness || 0,
          trackRecord: parsed.trackRecord || 0,
        },
        bestAchievements: parsed.bestAchievements || [],
        signals: parsed.signals || {},
        confidence: parsed.confidence || 0,
        reasoning: parsed.reasoning || 'No analysis available',
      };
    } catch (error: any) {
      console.error('Gemini analysis failed:', error.message);

      // If it's a quota error and OpenAI is available, fall back to OpenAI
      if ((error.message?.includes('quota') || error.message?.includes('429') || error.status === 429) && this.openai) {
        console.log('    → Falling back to OpenAI...');
        try {
          const result = await this.analyzeWithOpenAI(input);
          console.log(`    ✓ OpenAI analysis complete`);
          console.log(`    → Score: ${result.score}/100 (${result.tier})`);
          return result;
        } catch (openaiError: any) {
          console.error('OpenAI analysis also failed:', openaiError.message);
          throw new Error(`Both Gemini and OpenAI analysis failed. Gemini: quota exceeded. OpenAI: ${openaiError.message}`);
        }
      }

      // If no OpenAI backup or it's not a quota error, throw the original error
      if (error.message?.includes('quota') || error.message?.includes('429') || error.status === 429) {
        throw new Error('Gemini API quota exceeded (20 requests/day free tier). Add OPENAI_API_KEY to .env for automatic fallback, or try again later.');
      }

      throw new Error(`AI analysis failed: ${error.message}`);
    }
  }
}
