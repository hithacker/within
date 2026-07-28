import { z } from 'zod';

const identifierSchema = z.string().trim().regex(/^[a-z][a-z0-9_.-]{2,79}$/);
const semanticVersionSchema = z.string().trim().regex(/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/);

export const journalEntrySchema = z.object({
  id: z.string().trim().min(1).max(100),
  createdAt: z.string().datetime(),
  title: z.string().trim().max(120).default(''),
  body: z.string().trim().min(1).max(8_000),
  mood: z.number().int().min(1).max(5).optional(),
  lifeAreas: z.array(z.string().trim().min(1).max(40)).max(6).default([]),
});

export const journalAnalysisRequestSchema = z.object({
  entries: z.array(journalEntrySchema).min(1).max(20),
  currentEntryId: z.string().trim().min(1).max(100),
  goals: z.array(z.string().trim().min(1).max(240)).max(5).default([]),
  collectionId: identifierSchema.default('within.relationships'),
  collectionVersion: semanticVersionSchema.optional(),
}).superRefine(({ entries, currentEntryId }, context) => {
  if (!entries.some((entry) => entry.id === currentEntryId)) {
    context.addIssue({ code: 'custom', path: ['currentEntryId'], message: 'Current entry must be included in entries' });
  }

  const totalCharacters = entries.reduce((sum, entry) => sum + entry.body.length, 0);
  if (totalCharacters > 40_000) {
    context.addIssue({ code: 'custom', path: ['entries'], message: 'Journal context is too large' });
  }
});

export const patternCandidateSchema = z.object({
  id: identifierSchema,
  category: identifierSchema,
  title: z.string().trim().min(1).max(90),
  observation: z.string().trim().min(1).max(420),
  confidence: z.enum(['early_signal', 'recurring_pattern', 'strong_pattern']),
  evidenceEntryIds: z.array(z.string().trim().min(1).max(100)).min(1).max(6),
  goalConnection: z.string().trim().max(240).default(''),
  skillId: identifierSchema,
  collectionId: identifierSchema,
  collectionVersion: semanticVersionSchema,
});

export const patternInsightSchema = patternCandidateSchema.extend({
  evidenceEntryIds: z.array(z.string().trim().min(1).max(100)).min(2).max(6),
});

export const journalModelOutputSchema = z.object({
  entrySummary: z.string().trim().min(1).max(240),
  themes: z.array(z.string().trim().min(1).max(40)).max(5),
  patterns: z.array(patternCandidateSchema).max(3),
});

export const skillDiscoveryOutputSchema = z.object({
  skillIds: z.array(identifierSchema).max(3),
});

export const journalAnalysisSchema = z.object({
  entrySummary: z.string().trim().min(1).max(240),
  themes: z.array(z.string().trim().min(1).max(40)).max(5),
  patterns: z.array(patternInsightSchema).max(3),
});

export const conversationMessageSchema = z.object({
  id: z.string().trim().min(1).max(100),
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(8_000),
  createdAt: z.string().datetime(),
});

export const memoryKindSchema = z.enum([
  'person',
  'relationship',
  'goal',
  'unresolved',
  'commitment',
  'prediction',
  'outcome',
  'correction',
]);

export const durableMemorySchema = z.object({
  id: z.string().trim().min(1).max(100),
  kind: memoryKindSchema,
  subject: z.string().trim().min(1).max(100),
  detail: z.string().trim().min(1).max(400),
  status: z.enum(['active', 'resolved', 'disputed']).default('active'),
  confidence: z.enum(['explicit', 'tentative', 'user_confirmed']),
  sourceMessageIds: z.array(z.string().trim().min(1).max(100)).max(6),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const conversationSummarySchema = z.object({
  text: z.string().trim().max(2_000),
  updatedAt: z.string().datetime(),
});

export const conversationRequestSchema = z.object({
  messages: z.array(conversationMessageSchema).min(1).max(30),
  summary: conversationSummarySchema.optional(),
  memories: z.array(durableMemorySchema).max(100).default([]),
}).superRefine(({ messages }, context) => {
  if (messages.at(-1)?.role !== 'user') {
    context.addIssue({ code: 'custom', path: ['messages'], message: 'The last message must be from the user' });
  }

  const totalCharacters = messages.reduce((sum, message) => sum + message.content.length, 0);
  if (totalCharacters > 50_000) {
    context.addIssue({ code: 'custom', path: ['messages'], message: 'Conversation context is too large' });
  }
});

const conversationReplyFields = {
  reply: z.string().trim().min(1).max(3_000),
  stance: z.enum(['support', 'explore', 'challenge', 'escalate']),
  knownFacts: z.array(z.string().trim().min(1).max(240)).max(5),
  interpretations: z.array(z.string().trim().min(1).max(240)).max(4),
  missingContext: z.array(z.string().trim().min(1).max(240)).max(4),
  directChallenge: z.string().trim().max(500).default(''),
  followUpQuestion: z.string().trim().max(500).default(''),
};

const modelString = (maximum: number, minimum = 0) => z.preprocess(
  (value) => typeof value === 'string' ? value.trim().slice(0, maximum) : value,
  z.string().trim().min(minimum).max(maximum),
);

const modelArray = <T extends z.ZodType>(item: T, maximum: number) => z.preprocess(
  (value) => Array.isArray(value) ? value.slice(0, maximum) : value,
  z.array(item).max(maximum),
);

const modelConversationReplyFields = {
  reply: modelString(3_000, 1),
  stance: z.enum(['support', 'explore', 'challenge', 'escalate']),
  knownFacts: modelArray(modelString(240, 1), 5),
  interpretations: modelArray(modelString(240, 1), 4),
  missingContext: modelArray(modelString(240, 1), 4),
  directChallenge: modelString(500).default(''),
  followUpQuestion: modelString(500).default(''),
};

export const memoryCandidateSchema = z.object({
  existingMemoryId: modelString(100, 1).optional(),
  kind: memoryKindSchema,
  subject: modelString(100, 1),
  detail: modelString(400, 1),
  status: z.preprocess(
    (value) => ['active', 'resolved', 'disputed'].includes(String(value)) ? value : 'active',
    z.enum(['active', 'resolved', 'disputed']),
  ).default('active'),
  confidence: z.enum(['explicit', 'tentative']),
  sourceMessageIds: modelArray(modelString(100, 1), 6).pipe(z.array(z.string()).min(1)),
});

export const conversationModelOutputSchema = z.object({
  ...modelConversationReplyFields,
  summary: modelString(2_000, 1),
  memoryUpserts: modelArray(memoryCandidateSchema, 6).default([]),
});

export const conversationResponseSchema = z.object({
  ...conversationReplyFields,
  summary: conversationSummarySchema,
  memoryUpserts: z.array(durableMemorySchema).max(6),
});

export type JournalAnalysisRequest = z.infer<typeof journalAnalysisRequestSchema>;
export type JournalAnalysis = z.infer<typeof journalAnalysisSchema>;
export type JournalModelOutput = z.infer<typeof journalModelOutputSchema>;
export type ConversationRequest = z.infer<typeof conversationRequestSchema>;
export type ConversationResponse = z.infer<typeof conversationResponseSchema>;
export type ConversationModelOutput = z.infer<typeof conversationModelOutputSchema>;
export type DurableMemory = z.infer<typeof durableMemorySchema>;
