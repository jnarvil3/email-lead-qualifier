import { Octokit } from '@octokit/rest';
import { GitHubProfile } from '../types';

export class GitHubEnricher {
  private octokit: Octokit;

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token || process.env.GITHUB_TOKEN,
    });
  }

  /**
   * Try to find GitHub username from email
   * Uses GitHub's user search - works best with public emails
   */
  async findUsernameByEmail(email: string): Promise<string | null> {
    try {
      // Search for user by email
      const { data } = await this.octokit.search.users({
        q: `${email} in:email`,
        per_page: 1,
      });

      if (data.total_count > 0 && data.items[0]) {
        return data.items[0].login;
      }

      return null;
    } catch (error) {
      console.error('Error finding GitHub username:', error);
      return null;
    }
  }

  /**
   * Enrich a lead using their GitHub username
   */
  async enrichByUsername(username: string): Promise<GitHubProfile | null> {
    try {
      // Get user profile
      const { data: user } = await this.octokit.users.getByUsername({
        username,
      });

      // Get user's repositories
      const { data: repos } = await this.octokit.repos.listForUser({
        username,
        type: 'owner',
        sort: 'updated',
        per_page: 100,
      });

      // Calculate language distribution
      const languages = new Map<string, number>();
      let totalStars = 0;
      let totalForks = 0;

      for (const repo of repos) {
        if (repo.language) {
          languages.set(repo.language, (languages.get(repo.language) || 0) + 1);
        }
        totalStars += repo.stargazers_count || 0;
        totalForks += repo.forks_count || 0;
      }

      // Top languages by frequency
      const topLanguages = Array.from(languages.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([lang]) => lang);

      // Get top projects (by stars)
      const projects = repos
        .filter(repo => !repo.fork) // Exclude forks
        .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
        .slice(0, 10)
        .map(repo => ({
          name: repo.name,
          description: repo.description,
          stars: repo.stargazers_count || 0,
          forks: repo.forks_count || 0,
          language: repo.language || null,
          topics: repo.topics || [],
        }));

      // Get contribution stats (last year)
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      let contributionsLastYear = 0;
      let openSourceContributions = 0;

      try {
        // Get user events to estimate contributions
        const { data: events } = await this.octokit.activity.listPublicEventsForUser({
          username,
          per_page: 100,
        });

        for (const event of events) {
          if (event.created_at && new Date(event.created_at) >= oneYearAgo) {
            if (event.type === 'PushEvent' ||
                event.type === 'PullRequestEvent' ||
                event.type === 'IssuesEvent') {
              contributionsLastYear++;

              // Check if it's a contribution to someone else's repo
              if (event.repo && !event.repo.name.startsWith(`${username}/`)) {
                openSourceContributions++;
              }
            }
          }
        }
      } catch (error) {
        console.warn('Could not fetch contribution stats:', error);
      }

      const profile: GitHubProfile = {
        username: user.login,
        name: user.name,
        bio: user.bio,
        company: user.company,
        location: user.location,
        email: user.email,
        followers: user.followers,
        following: user.following,
        publicRepos: user.public_repos,
        publicGists: user.public_gists,
        createdAt: new Date(user.created_at),
        updatedAt: new Date(user.updated_at),
        topLanguages,
        totalStars,
        totalForks,
        contributions: {
          total: repos.length,
          lastYear: contributionsLastYear,
        },
        projects,
        openSourceContributions,
      };

      return profile;
    } catch (error: any) {
      if (error.status === 404) {
        console.log(`GitHub user not found: ${username}`);
        return null;
      }
      console.error('Error enriching GitHub profile:', error);
      return null;
    }
  }

  /**
   * Try to enrich from email (searches for username first)
   */
  async enrichByEmail(email: string): Promise<GitHubProfile | null> {
    const username = await this.findUsernameByEmail(email);
    if (!username) {
      return null;
    }
    return this.enrichByUsername(username);
  }

  /**
   * Get rate limit status
   */
  async getRateLimit(): Promise<{ remaining: number; limit: number; reset: Date }> {
    const { data } = await this.octokit.rateLimit.get();
    return {
      remaining: data.resources.core.remaining,
      limit: data.resources.core.limit,
      reset: new Date(data.resources.core.reset * 1000),
    };
  }
}
