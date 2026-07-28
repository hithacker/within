export type PackStatus = 'draft' | 'in_review' | 'approved' | 'published' | 'rejected';
export type MemberRole = 'author' | 'reviewer' | 'publisher' | 'admin';

export type KnowledgeModule = {
  id: string;
  title: string;
  purpose: string;
  journalPrompts: string[];
  steps: string[];
  completionCriteria: string[];
  contraindications: string[];
};

export type KnowledgePattern = {
  id: string;
  category: string;
  title: string;
  description: string;
  minimumEvidenceEntries: number;
  supportingSignals: string[];
  weakeningSignals: string[];
  excludingSignals: string[];
  moduleId: string;
};

export type KnowledgePackContent = {
  schemaVersion: 1;
  id: string;
  version: string;
  title: string;
  summary: string;
  intendedAudience: string;
  supportedLifeAreas: string[];
  authors: { name: string; credentials: string }[];
  clinicalReviewRequired: boolean;
  modules: KnowledgeModule[];
  patterns: KnowledgePattern[];
  language: { approvedTerms: string[]; prohibitedClaims: string[] };
  safety: { scope: string; escalationRules: string[] };
};

export type PackVersion = {
  pack_id: string;
  version: string;
  status: PackStatus;
  content: KnowledgePackContent;
  change_summary: string;
  created_by: string | null;
  created_at: string;
  reviewed_at: string | null;
  published_at: string | null;
};

export type PackRecord = {
  id: string;
  organization_id: string;
  slug: string;
  title: string;
  summary: string;
  visibility: 'private' | 'public';
  versions: PackVersion[];
};

export type ValidationIssue = { path: string; message: string };
