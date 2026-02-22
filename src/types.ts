/**
 * Core types for lead enrichment system
 */

export interface Lead {
  email: string;
  name?: string;
  source?: string; // Where they signed up from
  signupDate?: Date;
}

export interface EnrichedLead extends Lead {
  enrichment: {
    github?: GitHubProfile;
    linkedin?: LinkedInProfile;
    hunter?: HunterProfile;
    founder?: FounderProfile;
  };
  score: LeadScore;
  enrichedAt: Date;
  costUsd: number;
}

export interface FounderProfile {
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
  topEducation: Array<{
    school: string;
    degree: string | null;
    field: string | null;
    isTopTier: boolean;
  }>;
  strategicAccomplishments: string[];
  certifications: string[];
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
  fundingRaised: Array<{
    company: string;
    amount: string | null;
    round: string | null;
    year: number | null;
  }>;
  exits: Array<{
    company: string;
    type: string;
    year: number | null;
  }>;
  pressMentions: Array<{
    title: string;
    source: string;
    snippet: string;
  }>;
  awards: string[];
  confidence: number;
  dataSources: string[];
}

export interface GitHubProfile {
  username: string;
  name: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  email: string | null;
  followers: number;
  following: number;
  publicRepos: number;
  publicGists: number;
  createdAt: Date;
  updatedAt: Date;
  // Enriched data
  topLanguages: string[];
  totalStars: number;
  totalForks: number;
  contributions: {
    total: number;
    lastYear: number;
  };
  projects: Array<{
    name: string;
    description: string | null;
    stars: number;
    forks: number;
    language: string | null;
    topics: string[];
  }>;
  openSourceContributions: number; // Contributions to other repos
}

export interface LinkedInProfile {
  fullName: string;
  headline: string | null;
  summary: string | null;
  location: string | null;
  profileUrl: string;
  // Experience
  experiences: Array<{
    title: string;
    company: string;
    startDate: string;
    endDate: string | null;
    description: string | null;
    isFounder?: boolean;
    isLeadership?: boolean;
  }>;
  // Education
  education: Array<{
    school: string;
    degree: string | null;
    field: string | null;
    startYear: number | null;
    endYear: number | null;
  }>;
  // Skills & endorsements
  skills: string[];
  // Volunteering
  volunteering: Array<{
    organization: string;
    role: string;
    description: string | null;
  }>;
  // Certifications
  certifications: Array<{
    name: string;
    authority: string;
    date: string | null;
  }>;
}

export interface HunterProfile {
  email: string;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  company: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  verified: boolean;
  confidence: number; // 0-100
}

export interface LeadScore {
  total: number; // 0-100
  breakdown: {
    ambition: number;
    intelligence: number;
    kindness: number;
    trackRecord: number;
  };
  signals: ScoringSignals;
  tier: 'exceptional' | 'strong' | 'good' | 'average' | 'weak';
  reasoning: string; // Human-readable explanation
}

export interface ScoringSignals {
  // Ambition (GitHub/Dev signals)
  githubProjects?: number;
  linkedinStartups?: number;
  linkedinLeadership?: number;

  // Ambition (Founder signals)
  companiesFounded?: number;
  leadershipRoles?: number;
  thoughtLeadership?: number;

  // Intelligence (GitHub/Dev signals)
  githubLanguages?: number;
  githubContributions?: number;
  linkedinEducation?: number;
  linkedinCertifications?: number;

  // Intelligence (Founder signals)
  topEducation?: number;
  strategicAccomplishments?: number;

  // Kindness (GitHub/Dev signals)
  githubOpenSource?: number;
  linkedinVolunteering?: number;

  // Kindness (Founder signals)
  volunteerWork?: number;
  mentorship?: number;
  communityBuilding?: number;

  // Track Record (GitHub/Dev signals)
  githubStars?: number;
  linkedinPromotions?: number;
  linkedinAwards?: number;

  // Track Record (Founder signals)
  fundingRaised?: number;
  exits?: number;
  pressMentions?: number;
}

export interface ScoringConfig {
  weights: {
    ambition: number;
    intelligence: number;
    kindness: number;
    trackRecord: number;
  };
  ambition: Record<string, number>;
  intelligence: Record<string, number>;
  kindness: Record<string, number>;
  trackRecord: Record<string, number>;
  tiers: {
    exceptional: number; // Min score for exceptional
    strong: number;
    good: number;
    average: number;
  };
  scoring_rules?: any; // Flexible rules config from YAML
}

export interface EnrichmentResult {
  success: boolean;
  lead: EnrichedLead | null;
  error?: string;
  costUsd: number;
}
