export type KnowledgePackModule = {
  id: string;
  title: string;
  purpose: string;
  journalPrompts: string[];
  steps: string[];
  completionCriteria: string[];
  contraindications: string[];
};

export type PublishedKnowledgePack = {
  schemaVersion: 1;
  id: string;
  version: string;
  title: string;
  summary: string;
  intendedAudience: string;
  supportedLifeAreas: string[];
  modules: KnowledgePackModule[];
};
