import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { LeadScore, ScoringConfig, EnrichedLead, ScoringSignals } from '../types';

export class LeadScorer {
  private config: ScoringConfig;

  constructor(configPath?: string) {
    const defaultPath = path.join(__dirname, 'config.yaml');
    const filePath = configPath || defaultPath;

    const fileContents = fs.readFileSync(filePath, 'utf8');
    this.config = yaml.load(fileContents) as ScoringConfig;
  }

  /**
   * Score an enriched lead based on the YAML configuration
   */
  score(lead: EnrichedLead): LeadScore {
    const signals: ScoringSignals = {};
    let totalScore = 0;
    const breakdown = {
      ambition: 0,
      intelligence: 0,
      kindness: 0,
      trackRecord: 0,
    };

    // ========================================================================
    // AMBITION SCORING
    // ========================================================================
    let ambitionScore = 0;

    // GitHub Projects
    if (lead.enrichment.github) {
      const repos = lead.enrichment.github.publicRepos;
      const minRepos = this.config.scoring_rules?.github_projects?.min_repos || 3;
      const maxRepos = this.config.scoring_rules?.github_projects?.max_score_repos || 10;

      if (repos >= minRepos) {
        const normalizedScore = Math.min(repos / maxRepos, 1);
        signals.githubProjects = normalizedScore * this.config.ambition.github_projects;
        ambitionScore += signals.githubProjects;
      }
    }

    // LinkedIn Startups
    if (lead.enrichment.linkedin) {
      const startupExp = lead.enrichment.linkedin.experiences.filter(exp => {
        const isFounder = exp.title.toLowerCase().includes('founder') ||
                         exp.title.toLowerCase().includes('co-founder');
        // Could enhance: check company size via LinkedIn/Crunchbase
        return isFounder;
      });

      if (startupExp.length > 0) {
        const baseScore = this.config.ambition.linkedin_startups;
        const multiplier = this.config.scoring_rules?.linkedin_startups?.founder_multiplier || 1;
        signals.linkedinStartups = baseScore * multiplier;
        ambitionScore += signals.linkedinStartups;
      }
    }

    // LinkedIn Leadership
    if (lead.enrichment.linkedin) {
      const leadershipTitles = this.config.scoring_rules?.linkedin_leadership?.leadership_titles || [];
      const hasLeadership = lead.enrichment.linkedin.experiences.some(exp =>
        leadershipTitles.some((title: string) => exp.title.toLowerCase().includes(title.toLowerCase()))
      );

      if (hasLeadership) {
        signals.linkedinLeadership = this.config.ambition.linkedin_leadership;
        ambitionScore += signals.linkedinLeadership;
      }
    }

    breakdown.ambition = ambitionScore;

    // ========================================================================
    // INTELLIGENCE SCORING
    // ========================================================================
    let intelligenceScore = 0;

    // GitHub Languages
    if (lead.enrichment.github) {
      const langCount = lead.enrichment.github.topLanguages.length;
      const minLang = this.config.scoring_rules?.github_languages?.min_languages || 2;
      const maxLang = this.config.scoring_rules?.github_languages?.max_score_languages || 5;

      if (langCount >= minLang) {
        const normalizedScore = Math.min(langCount / maxLang, 1);
        signals.githubLanguages = normalizedScore * this.config.intelligence.github_languages;
        intelligenceScore += signals.githubLanguages;
      }
    }

    // GitHub Contributions
    if (lead.enrichment.github) {
      const contribs = lead.enrichment.github.contributions.lastYear;
      const minContribs = this.config.scoring_rules?.github_contributions?.min_contributions || 100;
      const maxContribs = this.config.scoring_rules?.github_contributions?.max_score_contributions || 1000;

      if (contribs >= minContribs) {
        const normalizedScore = Math.min(contribs / maxContribs, 1);
        signals.githubContributions = normalizedScore * this.config.intelligence.github_contributions;
        intelligenceScore += signals.githubContributions;
      }
    }

    // LinkedIn Education
    if (lead.enrichment.linkedin) {
      const topSchools = this.config.scoring_rules?.linkedin_education?.top_schools || [];
      const advancedDegreeBonus = this.config.scoring_rules?.linkedin_education?.advanced_degree_bonus || 0.3;

      let eduScore = 0;
      for (const edu of lead.enrichment.linkedin.education) {
        const isTopSchool = topSchools.some((school: string) =>
          edu.school.toLowerCase().includes(school.toLowerCase())
        );
        const hasAdvancedDegree = edu.degree?.toLowerCase().includes('master') ||
                                  edu.degree?.toLowerCase().includes('phd') ||
                                  edu.degree?.toLowerCase().includes('doctorate');

        if (isTopSchool) {
          eduScore = this.config.intelligence.linkedin_education;
          if (hasAdvancedDegree) {
            eduScore *= (1 + advancedDegreeBonus);
          }
          break; // Only count best education
        }
      }

      signals.linkedinEducation = eduScore;
      intelligenceScore += eduScore;
    }

    // LinkedIn Certifications
    if (lead.enrichment.linkedin && lead.enrichment.linkedin.certifications.length > 0) {
      const certScore = Math.min(
        lead.enrichment.linkedin.certifications.length * 2,
        this.config.intelligence.linkedin_certifications
      );
      signals.linkedinCertifications = certScore;
      intelligenceScore += certScore;
    }

    breakdown.intelligence = intelligenceScore;

    // ========================================================================
    // KINDNESS SCORING
    // ========================================================================
    let kindnessScore = 0;

    // GitHub Open Source
    if (lead.enrichment.github) {
      const osContribs = lead.enrichment.github.openSourceContributions;
      const minContribs = this.config.scoring_rules?.github_open_source?.min_contributions || 10;
      const maxContribs = this.config.scoring_rules?.github_open_source?.max_score_contributions || 100;

      if (osContribs >= minContribs) {
        const normalizedScore = Math.min(osContribs / maxContribs, 1);
        signals.githubOpenSource = normalizedScore * this.config.kindness.github_open_source;
        kindnessScore += signals.githubOpenSource;
      }
    }

    // LinkedIn Volunteering
    if (lead.enrichment.linkedin && lead.enrichment.linkedin.volunteering.length > 0) {
      signals.linkedinVolunteering = this.config.kindness.linkedin_volunteering;
      kindnessScore += signals.linkedinVolunteering;
    }

    breakdown.kindness = kindnessScore;

    // ========================================================================
    // TRACK RECORD SCORING
    // ========================================================================
    let trackRecordScore = 0;

    // GitHub Stars
    if (lead.enrichment.github) {
      const stars = lead.enrichment.github.totalStars;
      const minStars = this.config.scoring_rules?.github_stars?.min_stars || 50;
      const maxStars = this.config.scoring_rules?.github_stars?.max_score_stars || 500;

      if (stars >= minStars) {
        const normalizedScore = Math.min(stars / maxStars, 1);
        signals.githubStars = normalizedScore * this.config.trackRecord.github_stars;
        trackRecordScore += signals.githubStars;
      }
    }

    // LinkedIn Promotions (inferred from title changes at same company)
    if (lead.enrichment.linkedin) {
      let promotionCount = 0;
      const experiences = lead.enrichment.linkedin.experiences.sort((a, b) =>
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );

      for (let i = 0; i < experiences.length - 1; i++) {
        const current = experiences[i];
        const next = experiences[i + 1];

        if (current.company === next.company) {
          promotionCount++;
        }
      }

      if (promotionCount > 0) {
        const maxPromotions = this.config.scoring_rules?.linkedin_promotions?.max_score_promotions || 3;
        const normalizedScore = Math.min(promotionCount / maxPromotions, 1);
        signals.linkedinPromotions = normalizedScore * this.config.trackRecord.linkedin_promotions;
        trackRecordScore += signals.linkedinPromotions;
      }
    }

    breakdown.trackRecord = trackRecordScore;

    // ========================================================================
    // CALCULATE TOTAL SCORE
    // ========================================================================
    totalScore = breakdown.ambition + breakdown.intelligence +
                 breakdown.kindness + breakdown.trackRecord;

    // Determine tier
    let tier: 'exceptional' | 'strong' | 'good' | 'average' | 'weak';
    if (totalScore >= this.config.tiers.exceptional) {
      tier = 'exceptional';
    } else if (totalScore >= this.config.tiers.strong) {
      tier = 'strong';
    } else if (totalScore >= this.config.tiers.good) {
      tier = 'good';
    } else if (totalScore >= this.config.tiers.average) {
      tier = 'average';
    } else {
      tier = 'weak';
    }

    // Generate reasoning
    const reasoning = this.generateReasoning(lead, signals, tier);

    return {
      total: Math.round(totalScore * 10) / 10, // Round to 1 decimal
      breakdown,
      signals,
      tier,
      reasoning,
    };
  }

  /**
   * Generate human-readable explanation of the score
   */
  private generateReasoning(lead: EnrichedLead, signals: ScoringSignals, tier: string): string {
    const reasons: string[] = [];

    // Ambition highlights
    if (signals.githubProjects) {
      reasons.push(`${lead.enrichment.github!.publicRepos} GitHub projects`);
    }
    if (signals.linkedinStartups) {
      reasons.push('Startup founder/early employee');
    }
    if (signals.linkedinLeadership) {
      reasons.push('Leadership experience');
    }

    // Intelligence highlights
    if (signals.githubLanguages) {
      reasons.push(`${lead.enrichment.github!.topLanguages.length} programming languages`);
    }
    if (signals.githubContributions) {
      reasons.push(`${lead.enrichment.github!.contributions.lastYear} contributions last year`);
    }
    if (signals.linkedinEducation) {
      const school = lead.enrichment.linkedin!.education[0]?.school;
      reasons.push(`Education: ${school}`);
    }

    // Kindness highlights
    if (signals.githubOpenSource) {
      reasons.push(`${lead.enrichment.github!.openSourceContributions} open source contributions`);
    }
    if (signals.linkedinVolunteering) {
      reasons.push('Volunteer experience');
    }

    // Track record highlights
    if (signals.githubStars) {
      reasons.push(`${lead.enrichment.github!.totalStars} GitHub stars`);
    }

    if (reasons.length === 0) {
      return `Scored as ${tier} based on available data`;
    }

    return `${tier.charAt(0).toUpperCase() + tier.slice(1)} candidate: ${reasons.join(', ')}`;
  }

  /**
   * Reload configuration (useful for hot-reloading during testing)
   */
  reloadConfig(configPath?: string): void {
    const defaultPath = path.join(__dirname, 'config.yaml');
    const filePath = configPath || defaultPath;

    const fileContents = fs.readFileSync(filePath, 'utf8');
    this.config = yaml.load(fileContents) as ScoringConfig;
  }

  /**
   * Get current configuration
   */
  getConfig(): ScoringConfig {
    return this.config;
  }
}
