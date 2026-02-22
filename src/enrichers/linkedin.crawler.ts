import { chromium, Browser, Page } from 'playwright';
import * as cheerio from 'cheerio';

export interface LinkedInCrawlResult {
  fullName: string | null;
  headline: string | null;
  location: string | null;
  about: string | null;
  experience: Array<{
    title: string;
    company: string;
    duration: string;
    description: string | null;
  }>;
  education: Array<{
    school: string;
    degree: string | null;
    field: string | null;
    years: string | null;
  }>;
  skills: string[];
  recommendations: number;
  htmlContent: string; // Full HTML for AI analysis
}

export class LinkedInCrawler {
  private browser: Browser | null = null;

  /**
   * Crawl a LinkedIn profile URL
   * Note: LinkedIn blocks most scrapers, this is for public profiles only
   */
  async crawlProfile(linkedinUrl: string): Promise<LinkedInCrawlResult | null> {
    try {
      console.log(`  → Crawling LinkedIn profile: ${linkedinUrl}`);

      // Launch browser in headless mode
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        viewport: { width: 1920, height: 1080 },
      });

      const page = await context.newPage();
      page.setDefaultTimeout(30000);

      // Navigate to LinkedIn profile
      await page.goto(linkedinUrl, { waitUntil: 'domcontentloaded' });

      // Wait a bit for content to load
      await page.waitForTimeout(2000);

      // Get the page HTML
      const html = await page.content();
      const $ = cheerio.load(html);

      // Extract basic info
      const fullName = this.extractName($);
      const headline = this.extractHeadline($);
      const location = this.extractLocation($);
      const about = this.extractAbout($);

      // Extract experience
      const experience = this.extractExperience($);

      // Extract education
      const education = this.extractEducation($);

      // Extract skills
      const skills = this.extractSkills($);

      // Count recommendations
      const recommendations = this.extractRecommendations($);

      await this.browser.close();
      this.browser = null;

      console.log(`    ✓ LinkedIn crawled: ${fullName || 'Unknown'}`);

      return {
        fullName,
        headline,
        location,
        about,
        experience,
        education,
        skills,
        recommendations,
        htmlContent: html,
      };
    } catch (error: any) {
      console.error(`    ✗ LinkedIn crawl failed:`, error.message);

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      return null;
    }
  }

  private extractName($: cheerio.CheerioAPI): string | null {
    // Try various selectors for name
    const selectors = [
      'h1.text-heading-xlarge',
      'h1.inline.t-24',
      '.pv-text-details__left-panel h1',
      '.top-card-layout__title',
    ];

    for (const selector of selectors) {
      const name = $(selector).first().text().trim();
      if (name) return name;
    }

    return null;
  }

  private extractHeadline($: cheerio.CheerioAPI): string | null {
    const selectors = [
      '.text-body-medium',
      '.top-card-layout__headline',
      '.pv-text-details__left-panel .text-body-medium',
    ];

    for (const selector of selectors) {
      const headline = $(selector).first().text().trim();
      if (headline && headline.length > 10) return headline;
    }

    return null;
  }

  private extractLocation($: cheerio.CheerioAPI): string | null {
    const selectors = [
      '.text-body-small.inline.t-black--light',
      '.pv-text-details__left-panel .text-body-small',
    ];

    for (const selector of selectors) {
      const location = $(selector).first().text().trim();
      if (location) return location;
    }

    return null;
  }

  private extractAbout($: cheerio.CheerioAPI): string | null {
    const selectors = [
      '#about ~ .pvs-list__outer-container',
      '.pv-about-section p',
      '[data-section="summary"] .pv-about__summary-text',
    ];

    for (const selector of selectors) {
      const about = $(selector).first().text().trim();
      if (about && about.length > 20) return about;
    }

    return null;
  }

  private extractExperience($: cheerio.CheerioAPI): Array<{
    title: string;
    company: string;
    duration: string;
    description: string | null;
  }> {
    const experience: Array<any> = [];

    // LinkedIn's structure varies, try to extract experience blocks
    $('[data-section="experience"] li, #experience ~ .pvs-list__outer-container li').each((_, elem) => {
      const $elem = $(elem);
      const title = $elem.find('.mr1.t-bold span').first().text().trim() ||
                   $elem.find('.t-14.t-bold').first().text().trim();
      const company = $elem.find('.t-14.t-normal span').first().text().trim() ||
                     $elem.find('.pv-entity__secondary-title').first().text().trim();
      const duration = $elem.find('.t-14.t-normal.t-black--light span').first().text().trim() ||
                      $elem.find('.pv-entity__date-range span:nth-child(2)').first().text().trim();
      const description = $elem.find('.pvs-list__outer-container').first().text().trim() || null;

      if (title && company) {
        experience.push({ title, company, duration, description });
      }
    });

    return experience;
  }

  private extractEducation($: cheerio.CheerioAPI): Array<{
    school: string;
    degree: string | null;
    field: string | null;
    years: string | null;
  }> {
    const education: Array<any> = [];

    $('[data-section="education"] li, #education ~ .pvs-list__outer-container li').each((_, elem) => {
      const $elem = $(elem);
      const school = $elem.find('.mr1.hoverable-link-text.t-bold span').first().text().trim() ||
                    $elem.find('.pv-entity__school-name').first().text().trim();
      const degree = $elem.find('.t-14.t-normal span:nth-child(1)').first().text().trim() || null;
      const field = $elem.find('.t-14.t-normal span:nth-child(2)').first().text().trim() || null;
      const years = $elem.find('.t-14.t-normal.t-black--light span').first().text().trim() || null;

      if (school) {
        education.push({ school, degree, field, years });
      }
    });

    return education;
  }

  private extractSkills($: cheerio.CheerioAPI): string[] {
    const skills: string[] = [];

    $('[data-section="skills"] li, #skills ~ .pvs-list__outer-container li').each((_, elem) => {
      const $elem = $(elem);
      const skill = $elem.find('.mr1.hoverable-link-text.t-bold span').first().text().trim() ||
                   $elem.find('.pv-skill-category-entity__name').first().text().trim();

      if (skill) {
        skills.push(skill);
      }
    });

    return skills.slice(0, 20); // Top 20 skills
  }

  private extractRecommendations($: cheerio.CheerioAPI): number {
    const text = $('body').text();
    const match = text.match(/(\d+)\s+recommendations?/i);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Close browser if still open
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
