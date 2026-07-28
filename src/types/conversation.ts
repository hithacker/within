export type ResponseStance = 'support' | 'explore' | 'challenge' | 'escalate';

export type ResponseReasoning = {
  stance: ResponseStance;
  knownFacts: string[];
  interpretations: string[];
  missingContext: string[];
  directChallenge: string;
  followUpQuestion: string;
};

export type ConversationMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  reasoning?: ResponseReasoning;
};

export type MemoryKind =
  | 'person'
  | 'relationship'
  | 'goal'
  | 'unresolved'
  | 'commitment'
  | 'prediction'
  | 'outcome'
  | 'correction';

export type DurableMemory = {
  id: string;
  kind: MemoryKind;
  subject: string;
  detail: string;
  status: 'active' | 'resolved' | 'disputed';
  confidence: 'explicit' | 'tentative' | 'user_confirmed';
  sourceMessageIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type ConversationSummary = {
  text: string;
  updatedAt: string;
};

export type ConversationThread = {
  id: string;
  title: string;
  messages: ConversationMessage[];
  summary?: ConversationSummary;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};

export type DeletedConversationThread = {
  id: string;
  deletedAt: string;
};

export type ConversationState = {
  version: 2;
  threads: ConversationThread[];
  deletedThreads: DeletedConversationThread[];
  memories: DurableMemory[];
  aiConsent: boolean;
  updatedAt: string;
};
