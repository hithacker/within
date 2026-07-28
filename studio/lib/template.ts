import type { KnowledgePackContent } from './types';

export function createStarterPack(id: string, version: string, title: string, summary: string, clinicalReviewRequired: boolean): KnowledgePackContent {
  return {
    schemaVersion: 1,
    id,
    version,
    title,
    summary,
    intendedAudience: 'Adults using structured journaling for educational self-reflection.',
    supportedLifeAreas: ['Relationships'],
    authors: [{ name: 'Author name', credentials: 'Credentials and role' }],
    clinicalReviewRequired,
    modules: [{
      id: 'first_skill',
      title: 'First skill',
      purpose: 'Describe the practical skill this module teaches.',
      journalPrompts: ['What happened, using observable details?'],
      steps: ['Name one small action to practice.'],
      completionCriteria: ['The user identifies one observable next step.'],
      contraindications: [],
    }],
    patterns: [{
      id: 'first_pattern',
      category: 'self_reflection',
      title: 'First pattern',
      description: 'Describe a repeated, observable pattern without diagnosing or inferring motives.',
      minimumEvidenceEntries: 2,
      supportingSignals: ['The same observable behavior appears in separate entries.'],
      weakeningSignals: ['Later entries show a materially different response.'],
      excludingSignals: ['A single event or an unsupported interpretation.'],
      moduleId: 'first_skill',
    }],
    language: {
      approvedTerms: ['may be worth checking', 'the entries suggest', 'one possible interpretation'],
      prohibitedClaims: ['diagnose the user or another person', 'claim hidden motives as fact', 'direct a major life decision'],
    },
    safety: {
      scope: 'Educational self-reflection only. This pack does not diagnose, provide treatment, replace professional care, or manage emergencies.',
      escalationRules: ['Self-harm, violence, abuse, and medical-emergency signals bypass ordinary pattern coaching.'],
    },
  };
}
