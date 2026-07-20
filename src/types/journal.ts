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

export type PatternCategory = 'pacing' | 'boundaries' | 'balance' | 'conflict' | 'decision_loop' | 'burnout' | 'strength';
export type SkillId = 'pace_check' | 'boundary_builder' | 'decision_pause' | 'conflict_repair' | 'assumption_check' | 'routine_protection' | 'burnout_check';

export type PatternInsight = {
  id: string;
  category: PatternCategory;
  title: string;
  observation: string;
  confidence: 'early_signal' | 'recurring_pattern' | 'strong_pattern';
  evidenceEntryIds: string[];
  goalConnection: string;
  skillId: SkillId;
  knowledgePack: 'within.relationships';
  knowledgePackVersion: '1.0.0';
  createdAt: string;
};

export type JournalState = {
  entries: JournalEntry[];
  insights: PatternInsight[];
  goals: string[];
  aiConsent: boolean;
};
