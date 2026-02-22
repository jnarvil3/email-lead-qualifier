import { chromium, Browser, Page } from 'playwright';
import * as cheerio from 'cheerio';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  pageContent?: string; // Full content if crawled
}

export class GoogleSearchCrawler {
  private browser: Browser | null = null;

  /**
   * Search Google for a person + keywords and return top results
   */
  async searchPerson(name: string, keywords: string[] = ['founder', 'CEO', 'startup']): Promise<SearchResult[]> {
    try {
      const query = `"${name}" ${keywords.join(' ')}`;
      console.log(`  → Searching Google: ${query}`);

      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      });

      const page = await context.newPage();
      page.setDefaultTimeout(20000);

      // Search Google
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

      await page.waitForTimeout(1500);

      const html = await page.content();
      const $ = cheerio.load(html);

      const results: SearchResult[] = [];

      // Extract search results
      $('.g, .tF2Cxc').each((_, elem) => {
        const $elem = $(elem);

        const title = $elem.find('h3').first().text().trim();
        const url = $elem.find('a').first().attr('href') || '';
        const snippet = $elem.find('.VwiC3b, .yXK7lf').first().text().trim() ||
                       $elem.find('.st').first().text().trim();

        if (title && url && url.startsWith('http')) {
          results.push({ title, url, snippet });
        }
      });

      await this.browser.close();
      this.browser = null;

      console.log(`    ✓ Found ${results.length} search results`);

      return results.slice(0, 5); // Top 5 results
    } catch (error: any) {
      console.error(`    ✗ Google search failed:`, error.message);

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      return [];
    }
  }

  /**
   * Crawl a specific article/page for content
   */
  async crawlArticle(url: string): Promise<string | null> {
    try {
      console.log(`  → Crawling article: ${url}`);

      if (!this.browser) {
        this.browser = await chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
      }

      const context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      });

      const page = await context.newPage();
      page.setDefaultTimeout(15000);

      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      const html = await page.content();
      const $ = cheerio.load(html);

      // Remove scripts, styles, nav, footer
      $('script, style, nav, footer, header, .ad, .advertisement').remove();

      // Extract main content (try various selectors)
      const mainContent = $('article').text() ||
                         $('main').text() ||
                         $('.article-content').text() ||
                         $('.post-content').text() ||
                         $('body').text();

      await page.close();

      const cleanedContent = mainContent
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 5000); // First 5000 chars

      console.log(`    ✓ Crawled article (${cleanedContent.length} chars)`);

      return cleanedContent;
    } catch (error: any) {
      console.error(`    ✗ Article crawl failed:`, error.message);
      return null;
    }
  }

  /**
   * Search and crawl top articles
   */
  async searchAndCrawl(name: string, keywords: string[] = ['founder', 'CEO', 'startup']): Promise<SearchResult[]> {
    const searchResults = await this.searchPerson(name, keywords);

    // Crawl top 3 articles
    for (let i = 0; i < Math.min(3, searchResults.length); i++) {
      const result = searchResults[i];

      // Skip PDFs, LinkedIn, Twitter (we handle those separately)
      if (result.url.includes('.pdf') ||
          result.url.includes('linkedin.com') ||
          result.url.includes('twitter.com') ||
          result.url.includes('x.com')) {
        continue;
      }

      const content = await this.crawlArticle(result.url);
      if (content) {
        result.pageContent = content;
      }

      // Small delay between crawls
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return searchResults;
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
