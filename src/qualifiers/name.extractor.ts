import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index';

export interface NameValidationResult {
  isValid: boolean;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  error?: string;
}

export class NameExtractor {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any;

  constructor() {
    const apiKey = config.gemini.apiKey;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    }
  }

  /**
   * Validate that a name has both first and last name
   */
  validateName(name: string): NameValidationResult {
    if (!name || !name.trim()) {
      return {
        isValid: false,
        firstName: null,
        lastName: null,
        fullName: null,
        error: 'Name is required',
      };
    }

    const trimmed = name.trim();
    const parts = trimmed.split(/\s+/);

    if (parts.length < 2) {
      return {
        isValid: false,
        firstName: parts[0] || null,
        lastName: null,
        fullName: trimmed,
        error: 'Both first and last name are required',
      };
    }

    // Assume first part is first name, rest is last name
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');

    return {
      isValid: true,
      firstName,
      lastName,
      fullName: trimmed,
    };
  }

  /**
   * Extract name from email using AI
   * e.g., "john.smith@company.com" -> "John Smith"
   */
  async extractNameFromEmail(email: string): Promise<string | null> {
    if (!this.genAI || !this.model) {
      console.warn('Gemini API not configured - cannot extract name from email');
      return null;
    }

    try {
      const localPart = email.split('@')[0];

      const prompt = `Extract a likely full name (first and last name) from this email username: "${localPart}"

Rules:
- Convert dots, underscores, hyphens to spaces
- Capitalize appropriately
- Return ONLY the name, nothing else
- If it's clearly not a name (random characters, numbers only), return "unknown"
- Example: "john.smith" -> "John Smith"
- Example: "jsmith" -> "unknown" (can't infer full name)
- Example: "johnsmith123" -> "unknown"

Email username: ${localPart}

Name:`;

      const result = await this.model.generateContent(prompt);
      const response = result.response.text().trim();

      if (response.toLowerCase() === 'unknown' || response.toLowerCase().includes('cannot')) {
        return null;
      }

      // Validate the extracted name
      const validation = this.validateName(response);
      if (validation.isValid) {
        return validation.fullName;
      }

      return null;
    } catch (error) {
      console.error('Error extracting name from email:', error);
      return null;
    }
  }

  /**
   * Process name input - validate or try to extract from email
   */
  async processName(name: string | undefined, email: string): Promise<NameValidationResult> {
    // If name provided, validate it
    if (name && name.trim()) {
      return this.validateName(name);
    }

    // Try to extract name from email using AI
    console.log(`  → Attempting to extract name from email: ${email}`);
    const extractedName = await this.extractNameFromEmail(email);

    if (extractedName) {
      console.log(`    ✓ Extracted name: ${extractedName}`);
      return this.validateName(extractedName);
    }

    // If extraction failed, use email address for searching
    console.log(`    ⚠ Could not extract name - will use email for search`);
    return {
      isValid: true, // Mark as valid so we don't block qualification
      firstName: null,
      lastName: null,
      fullName: email, // Use email as fallback for searching
    };
  }
}
