import { z } from 'zod';

const identifierSchema = z.string().trim().regex(/^[a-z][a-z0-9_.-]{2,79}$/);
const semanticVersionSchema = z.string().trim().regex(/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/);
const shortTextSchema = z.string().trim().min(1).max(240);

export const knowledgePackModuleSchema = z.object({
  id: identifierSchema,
  title: z.string().trim().min(1).max(90),
  purpose: shortTextSchema,
  journalPrompts: z.array(shortTextSchema).min(1).max(12),
  steps: z.array(shortTextSchema).min(1).max(12),
  completionCriteria: z.array(shortTextSchema).max(8).default([]),
  contraindications: z.array(shortTextSchema).max(8).default([]),
}).strict();

export const knowledgePackPatternSchema = z.object({
  id: identifierSchema,
  category: identifierSchema,
  title: z.string().trim().min(1).max(90),
  description: z.string().trim().min(1).max(420),
  minimumEvidenceEntries: z.number().int().min(2).max(10),
  supportingSignals: z.array(shortTextSchema).min(1).max(12),
  weakeningSignals: z.array(shortTextSchema).max(12).default([]),
  excludingSignals: z.array(shortTextSchema).max(12).default([]),
  moduleId: identifierSchema,
}).strict();

export const knowledgePackContentSchema = z.object({
  schemaVersion: z.literal(1),
  id: identifierSchema,
  version: semanticVersionSchema,
  title: z.string().trim().min(1).max(90),
  summary: z.string().trim().min(1).max(420),
  intendedAudience: z.string().trim().min(1).max(420),
  supportedLifeAreas: z.array(z.string().trim().min(1).max(40)).min(1).max(20),
  authors: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    credentials: z.string().trim().min(1).max(240),
  }).strict()).min(1).max(12),
  clinicalReviewRequired: z.boolean(),
  modules: z.array(knowledgePackModuleSchema).min(1).max(40),
  patterns: z.array(knowledgePackPatternSchema).min(1).max(60),
  language: z.object({
    approvedTerms: z.array(shortTextSchema).max(40),
    prohibitedClaims: z.array(shortTextSchema).min(1).max(40),
  }).strict(),
  safety: z.object({
    scope: z.string().trim().min(1).max(600),
    escalationRules: z.array(shortTextSchema).min(1).max(20),
  }).strict(),
}).strict().superRefine((pack, context) => {
  const moduleIds = new Set<string>();
  for (const [index, module] of pack.modules.entries()) {
    if (moduleIds.has(module.id)) {
      context.addIssue({ code: 'custom', path: ['modules', index, 'id'], message: 'Module IDs must be unique' });
    }
    moduleIds.add(module.id);
  }

  const patternIds = new Set<string>();
  for (const [index, pattern] of pack.patterns.entries()) {
    if (patternIds.has(pattern.id)) {
      context.addIssue({ code: 'custom', path: ['patterns', index, 'id'], message: 'Pattern IDs must be unique' });
    }
    if (!moduleIds.has(pattern.moduleId)) {
      context.addIssue({ code: 'custom', path: ['patterns', index, 'moduleId'], message: 'Pattern module must exist in this pack' });
    }
    patternIds.add(pattern.id);
  }
});

export type KnowledgePackContent = z.infer<typeof knowledgePackContentSchema>;
