import { z } from 'zod';

export const patternCategorySchema = z.enum([
  'pacing',
  'boundaries',
  'balance',
  'conflict',
  'decision_loop',
  'burnout',
  'strength',
]);

export const skillIdSchema = z.enum([
  'pace_check',
  'boundary_builder',
  'decision_pause',
  'conflict_repair',
  'assumption_check',
  'routine_protection',
  'burnout_check',
]);

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
  knowledgePack: z.literal('within.relationships').default('within.relationships'),
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
  id: z.string().trim().min(1).max(100),
  category: patternCategorySchema,
  title: z.string().trim().min(1).max(90),
  observation: z.string().trim().min(1).max(420),
  confidence: z.enum(['early_signal', 'recurring_pattern', 'strong_pattern']),
  evidenceEntryIds: z.array(z.string().trim().min(1).max(100)).min(1).max(6),
  goalConnection: z.string().trim().max(240).default(''),
  skillId: skillIdSchema,
  knowledgePack: z.literal('within.relationships'),
  knowledgePackVersion: z.literal('1.0.0'),
});

export const patternInsightSchema = patternCandidateSchema.extend({
  evidenceEntryIds: z.array(z.string().trim().min(1).max(100)).min(2).max(6),
});

export const journalModelOutputSchema = z.object({
  entrySummary: z.string().trim().min(1).max(240),
  themes: z.array(z.string().trim().min(1).max(40)).max(5),
  patterns: z.array(patternCandidateSchema).max(3),
});

export const journalAnalysisSchema = z.object({
  entrySummary: z.string().trim().min(1).max(240),
  themes: z.array(z.string().trim().min(1).max(40)).max(5),
  patterns: z.array(patternInsightSchema).max(3),
});

export type JournalAnalysisRequest = z.infer<typeof journalAnalysisRequestSchema>;
export type JournalAnalysis = z.infer<typeof journalAnalysisSchema>;
export type JournalModelOutput = z.infer<typeof journalModelOutputSchema>;
