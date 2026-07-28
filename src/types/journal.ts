export type AnalysisState = 'not_requested' | 'analyzing' | 'analyzed' | 'failed';

export type JournalEntry = {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  body: string;
  mood?: number;
  lifeAreas: string[];
  analysisState: AnalysisState;
  summary?: string;
  themes?: string[];
};

export type PatternCategory = string;
export type SkillId = string;

export type PatternInsight = {
  id: string;
  category: PatternCategory;
  title: string;
  observation: string;
  confidence: 'early_signal' | 'recurring_pattern' | 'strong_pattern';
  evidenceEntryIds: string[];
  goalConnection: string;
  skillId: SkillId;
  collectionId: string;
  collectionVersion: string;
  createdAt: string;
};

export type JournalState = {
  entries: JournalEntry[];
  insights: PatternInsight[];
  goals: string[];
  aiConsent: boolean;
};
