import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { LeadScore, ScoringConfig, QualifiedLead, ScoringSignals } from '../types';

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
  score(lead: QualifiedLead): LeadScore {
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
    if (lead.qualification.github) {
      const repos = lead.qualification.github.publicRepos;
      const minRepos = this.config.scoring_rules?.github_projects?.min_repos || 3;
      const maxRepos = this.config.scoring_rules?.github_projects?.max_score_repos || 10;

      if (repos >= minRepos) {
        const normalizedScore = Math.min(repos / maxRepos, 1);
        signals.githubProjects = normalizedScore * this.config.ambition.github_projects;
        ambitionScore += signals.githubProjects;
      }
    }

    // LinkedIn Startups
    if (lead.qualification.linkedin) {
      const startupExp = lead.qualification.linkedin.experiences.filter(exp => {
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
    if (lead.qualification.linkedin) {
      const leadershipTitles = this.config.scoring_rules?.linkedin_leadership?.leadership_titles || [];
      const hasLeadership = lead.qualification.linkedin.experiences.some(exp =>
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
    if (lead.qualification.github) {
      const langCount = lead.qualification.github.topLanguages.length;
      const minLang = this.config.scoring_rules?.github_languages?.min_languages || 2;
      const maxLang = this.config.scoring_rules?.github_languages?.max_score_languages || 5;

      if (langCount >= minLang) {
        const normalizedScore = Math.min(langCount / maxLang, 1);
        signals.githubLanguages = normalizedScore * this.config.intelligence.github_languages;
        intelligenceScore += signals.githubLanguages;
      }
    }

    // GitHub Contributions
    if (lead.qualification.github) {
      const contribs = lead.qualification.github.contributions.lastYear;
      const minContribs = this.config.scoring_rules?.github_contributions?.min_contributions || 100;
      const maxContribs = this.config.scoring_rules?.github_contributions?.max_score_contributions || 1000;

      if (contribs >= minContribs) {
        const normalizedScore = Math.min(contribs / maxContribs, 1);
        signals.githubContributions = normalizedScore * this.config.intelligence.github_contributions;
        intelligenceScore += signals.githubContributions;
      }
    }

    // LinkedIn Education
    if (lead.qualification.linkedin) {
      const topSchools = this.config.scoring_rules?.linkedin_education?.top_schools || [];
      const advancedDegreeBonus = this.config.scoring_rules?.linkedin_education?.advanced_degree_bonus || 0.3;

      let eduScore = 0;
      for (const edu of lead.qualification.linkedin.education) {
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
    if (lead.qualification.linkedin && lead.qualification.linkedin.certifications.length > 0) {
      const certScore = Math.min(
        lead.qualification.linkedin.certifications.length * 2,
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
    if (lead.qualification.github) {
      const osContribs = lead.qualification.github.openSourceContributions;
      const minContribs = this.config.scoring_rules?.github_open_source?.min_contributions || 10;
      const maxContribs = this.config.scoring_rules?.github_open_source?.max_score_contributions || 100;

      if (osContribs >= minContribs) {
        const normalizedScore = Math.min(osContribs / maxContribs, 1);
        signals.githubOpenSource = normalizedScore * this.config.kindness.github_open_source;
        kindnessScore += signals.githubOpenSource;
      }
    }

    // LinkedIn Volunteering
    if (lead.qualification.linkedin && lead.qualification.linkedin.volunteering.length > 0) {
      signals.linkedinVolunteering = this.config.kindness.linkedin_volunteering;
      kindnessScore += signals.linkedinVolunteering;
    }

    breakdown.kindness = kindnessScore;

    // ========================================================================
    // TRACK RECORD SCORING
    // ========================================================================
    let trackRecordScore = 0;

    // GitHub Stars
    if (lead.qualification.github) {
      const stars = lead.qualification.github.totalStars;
      const minStars = this.config.scoring_rules?.github_stars?.min_stars || 50;
      const maxStars = this.config.scoring_rules?.github_stars?.max_score_stars || 500;

      if (stars >= minStars) {
        const normalizedScore = Math.min(stars / maxStars, 1);
        signals.githubStars = normalizedScore * this.config.trackRecord.github_stars;
        trackRecordScore += signals.githubStars;
      }
    }

    // LinkedIn Promotions (inferred from title changes at same company)
    if (lead.qualification.linkedin) {
      let promotionCount = 0;
      const experiences = lead.qualification.linkedin.experiences.sort((a, b) =>
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
    // FOUNDER-SPECIFIC SCORING (if founder data available)
    // ========================================================================
    if (lead.qualification.founder) {
      const founder = lead.qualification.founder;

      // AMBITION: Companies Founded
      if (founder.companiesFounded.length > 0) {
        const config = this.config.scoring_rules?.companies_founded;
        const pointsPerCompany = config?.points_per_company || 7.5;
        const maxCompanies = config?.max_companies || 2;
        const companiesScore = Math.min(founder.companiesFounded.length, maxCompanies) * pointsPerCompany;
        signals.companiesFounded = companiesScore;
        ambitionScore += companiesScore;
      }

      // AMBITION: Leadership Roles
      if (founder.leadershipRoles.length > 0) {
        const config = this.config.scoring_rules?.leadership_roles;
        let leadershipScore = 0;
        for (const role of founder.leadershipRoles) {
          const isCLevel = role.title.toLowerCase().includes('ceo') ||
                          role.title.toLowerCase().includes('cto') ||
                          role.title.toLowerCase().includes('chief');
          const isVP = role.title.toLowerCase().includes('vp') ||
                      role.title.toLowerCase().includes('director');

          if (isCLevel) {
            leadershipScore += 5 * (config?.ceo_cto_multiplier || 2.0);
          } else if (isVP) {
            leadershipScore += 3 * (config?.vp_director_multiplier || 1.5);
          }
        }
        signals.leadershipRoles = Math.min(leadershipScore, this.config.ambition.leadership_roles || 10);
        ambitionScore += signals.leadershipRoles;
      }

      // AMBITION: Thought Leadership
      if (founder.thoughtLeadership.speaking || founder.thoughtLeadership.writing || founder.thoughtLeadership.podcasting) {
        const config = this.config.scoring_rules?.thought_leadership;
        let tlScore = 0;
        if (founder.thoughtLeadership.speaking) tlScore += config?.speaking_points || 2;
        if (founder.thoughtLeadership.writing) tlScore += config?.writing_points || 2;
        if (founder.thoughtLeadership.podcasting) tlScore += config?.podcasting_points || 1;
        signals.thoughtLeadership = Math.min(tlScore, this.config.ambition.thought_leadership || 5);
        ambitionScore += signals.thoughtLeadership;
      }

      // INTELLIGENCE: Top Education
      if (founder.topEducation.length > 0) {
        const config = this.config.scoring_rules?.top_education;
        const topEdu = founder.topEducation[0];
        let eduScore = 0;
        if (topEdu.isTopTier) {
          eduScore = config?.top_tier_points || 15;
        } else {
          eduScore = config?.top_50_points || 10;
        }
        // Bonus for advanced degree
        if (topEdu.degree?.toLowerCase().includes('master') ||
            topEdu.degree?.toLowerCase().includes('phd') ||
            topEdu.degree?.toLowerCase().includes('doctorate')) {
          eduScore += config?.advanced_degree_bonus || 3;
        }
        signals.topEducation = Math.min(eduScore, this.config.intelligence.top_education || 15);
        intelligenceScore += signals.topEducation;
      }

      // INTELLIGENCE: Strategic Accomplishments
      if (founder.strategicAccomplishments.length > 0) {
        const accompScore = Math.min(founder.strategicAccomplishments.length * 3, this.config.intelligence.strategic_accomplishments || 10);
        signals.strategicAccomplishments = accompScore;
        intelligenceScore += accompScore;
      }

      // KINDNESS: Volunteer Work
      if (founder.volunteerWork.length > 0) {
        signals.volunteerWork = this.config.kindness.volunteer_work || 10;
        kindnessScore += signals.volunteerWork;
      }

      // KINDNESS: Mentorship
      if (founder.mentorship.isMentor) {
        signals.mentorship = this.config.kindness.mentorship || 5;
        kindnessScore += signals.mentorship;
      }

      // KINDNESS: Community Building
      if (founder.communityBuilding.length > 0) {
        signals.communityBuilding = this.config.kindness.community_building || 5;
        kindnessScore += signals.communityBuilding;
      }

      // TRACK RECORD: Funding Raised
      if (founder.fundingRaised.length > 0) {
        const config = this.config.scoring_rules?.funding_raised;
        let fundingScore = 0;
        for (const funding of founder.fundingRaised) {
          const round = funding.round?.toLowerCase() || '';
          if (round.includes('series b') || round.includes('series c')) {
            fundingScore += config?.series_b_plus_points || 10;
          } else if (round.includes('series a')) {
            fundingScore += config?.series_a_points || 5;
          } else if (round.includes('seed')) {
            fundingScore += config?.seed_points || 2;
          }
        }
        signals.fundingRaised = Math.min(fundingScore, this.config.trackRecord.funding_raised || 10);
        trackRecordScore += signals.fundingRaised;
      }

      // TRACK RECORD: Exits
      if (founder.exits.length > 0) {
        const config = this.config.scoring_rules?.exits;
        const exitsScore = founder.exits.length * (config?.acquisition_points || 5);
        signals.exits = Math.min(exitsScore, this.config.trackRecord.exits || 5);
        trackRecordScore += signals.exits;
      }

      // TRACK RECORD: Press Mentions
      if (founder.pressMentions.length > 0) {
        const config = this.config.scoring_rules?.press_mentions;
        const pressScore = Math.min(
          founder.pressMentions.length * (config?.points_per_mention || 1),
          config?.max_mentions || 3
        );
        signals.pressMentions = pressScore;
        trackRecordScore += pressScore;
      }

      // Update breakdowns with founder signals
      breakdown.ambition = ambitionScore;
      breakdown.intelligence = intelligenceScore;
      breakdown.kindness = kindnessScore;
      breakdown.trackRecord = trackRecordScore;
    }

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
  private generateReasoning(lead: QualifiedLead, signals: ScoringSignals, tier: string): string {
    const reasons: string[] = [];

    // FOUNDER SIGNALS (priority)
    if (lead.qualification.founder) {
      const founder = lead.qualification.founder;

      // Ambition
      if (signals.companiesFounded && founder.companiesFounded.length > 0) {
        const companies = founder.companiesFounded.map(c => c.name).join(', ');
        reasons.push(`Founded: ${companies}`);
      }
      if (signals.leadershipRoles && founder.leadershipRoles.length > 0) {
        const roles = founder.leadershipRoles.slice(0, 2).map(r => `${r.title} at ${r.company}`).join(', ');
        reasons.push(roles);
      }
      if (signals.thoughtLeadership) {
        reasons.push('Thought leader (speaking/writing)');
      }

      // Intelligence
      if (signals.topEducation && founder.topEducation.length > 0) {
        const edu = founder.topEducation[0];
        reasons.push(`${edu.school}${edu.degree ? ' - ' + edu.degree : ''}`);
      }

      // Track Record
      if (signals.fundingRaised && founder.fundingRaised.length > 0) {
        const rounds = founder.fundingRaised.map(f => f.round || 'funding').join(', ');
        reasons.push(`Raised: ${rounds}`);
      }
      if (signals.exits && founder.exits.length > 0) {
        reasons.push(`${founder.exits.length} exit${founder.exits.length > 1 ? 's' : ''}`);
      }
      if (signals.pressMentions && founder.pressMentions.length > 0) {
        reasons.push(`${founder.pressMentions.length} press mention${founder.pressMentions.length > 1 ? 's' : ''}`);
      }

      // Kindness
      if (signals.volunteerWork && founder.volunteerWork.length > 0) {
        reasons.push(`Volunteer: ${founder.volunteerWork[0].organization}`);
      }
      if (signals.mentorship) {
        reasons.push('Active mentor');
      }
    }

    // GITHUB SIGNALS (for technical founders or devs)
    if (signals.githubProjects && lead.qualification.github) {
      reasons.push(`${lead.qualification.github.publicRepos} GitHub projects`);
    }
    if (signals.githubStars && lead.qualification.github) {
      reasons.push(`${lead.qualification.github.totalStars} GitHub stars`);
    }
    if (signals.githubOpenSource && lead.qualification.github) {
      reasons.push(`${lead.qualification.github.openSourceContributions} open source contributions`);
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
