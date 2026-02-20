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
  };
  score: LeadScore;
  enrichedAt: Date;
  costUsd: number;
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
  // Ambition
  githubProjects?: number;
  linkedinStartups?: number;
  linkedinLeadership?: number;

  // Intelligence
  githubLanguages?: number;
  githubContributions?: number;
  linkedinEducation?: number;
  linkedinCertifications?: number;

  // Kindness
  githubOpenSource?: number;
  linkedinVolunteering?: number;

  // Track Record
  githubStars?: number;
  linkedinPromotions?: number;
  linkedinAwards?: number;
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
