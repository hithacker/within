import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isQuotaError, isTransientProviderError, normalizeAnalysis } from './gemini.js';
import { buildSkillAnalysisPrompt, buildSkillDiscoveryPrompt } from './prompt.js';
import { CONSCIENTIOUS_CONVERSATION_PROMPT } from './conversation-prompt.js';
import {
  conversationModelOutputSchema,
  type JournalAnalysisRequest,
  type JournalModelOutput,
} from './schema.js';
import type { KnowledgePackContent } from './knowledge-pack-schema.js';

const request: JournalAnalysisRequest = {
  entries: [
    { id: 'one', createdAt: '2026-07-15T10:00:00.000Z', title: '', body: 'First entry', lifeAreas: [] },
    { id: 'two', createdAt: '2026-07-17T10:00:00.000Z', title: '', body: 'Second entry', lifeAreas: [] },
  ],
  currentEntryId: 'two',
  goals: [],
  collectionId: 'within.test',
  collectionVersion: '2.0.0',
};

const collection: KnowledgePackContent = {
  schemaVersion: 1,
  id: 'within.test',
  version: '2.0.0',
  title: 'Everyday decisions',
  summary: 'Skills for slowing pressured decisions.',
  intendedAudience: 'Adults using structured reflection.',
  supportedLifeAreas: ['Decisions'],
  authors: [{ name: 'Test author', credentials: 'Educator' }],
  clinicalReviewRequired: false,
  modules: [{
    id: 'decision_pause',
    title: 'Pause a decision',
    purpose: 'Create time before acting under pressure.',
    journalPrompts: ['What feels urgent?'],
    steps: ['Wait before acting.'],
    completionCriteria: [],
    contraindications: [],
  }],
  patterns: [{
    id: 'urgency_loop',
    category: 'decision_loop',
    title: 'Repeated urgency',
    description: 'Urgency appears before difficult-to-reverse choices.',
    minimumEvidenceEntries: 2,
    supportingSignals: ['Separate entries describe pressure to decide immediately.'],
    weakeningSignals: [],
    excludingSignals: ['A factual deadline requires immediate action.'],
    moduleId: 'decision_pause',
  }],
  language: { approvedTerms: ['may be worth checking'], prohibitedClaims: ['direct a major life decision'] },
  safety: { scope: 'Educational reflection only.', escalationRules: ['Emergencies bypass ordinary analysis.'] },
};

function analysis(observation: string, evidenceEntryIds = ['one', 'two']): JournalModelOutput {
  return {
    entrySummary: 'A neutral summary.',
    themes: [],
    patterns: [{
      id: 'urgency_loop',
      category: 'invented_category',
      title: 'Invented title',
      observation,
      confidence: 'recurring_pattern',
      evidenceEntryIds,
      goalConnection: '',
      skillId: 'invented_skill',
      collectionId: 'invented.collection',
      collectionVersion: '9.9.9',
    }],
  };
}

describe('provider errors', () => {
  it('recognizes quota and temporary capacity failures', () => {
    assert.equal(isQuotaError(new Error('RESOURCE_EXHAUSTED: quota exceeded')), true);
    assert.equal(isTransientProviderError(new Error('This model is experiencing high demand and is unavailable')), true);
    assert.equal(isTransientProviderError(new Error('Invalid API key')), false);
  });
});

describe('skill prompts', () => {
  it('exposes a compact discovery index and only selected skill details for analysis', () => {
    assert.match(buildSkillDiscoveryPrompt(collection), /decision_pause/);
    assert.match(buildSkillDiscoveryPrompt(collection), /excludingSignals/);
    assert.match(buildSkillAnalysisPrompt(collection, ['decision_pause']), /Pause a decision/);
    assert.match(buildSkillAnalysisPrompt(collection, []), /Allowed patterns:\n\[\]/);
  });
});

describe('conversation prompt', () => {
  it('requires uncertainty, perspective checks, and bounded challenges', () => {
    assert.match(CONSCIENTIOUS_CONVERSATION_PROMPT, /feelings can be valid while their explanation remains incomplete/i);
    assert.match(CONSCIENTIOUS_CONVERSATION_PROMPT, /plausible perspective of an absent person/i);
    assert.match(CONSCIENTIOUS_CONVERSATION_PROMPT, /never the user's identity or worth/i);
    assert.match(CONSCIENTIOUS_CONVERSATION_PROMPT, /Do not diagnose/i);
    assert.match(CONSCIENTIOUS_CONVERSATION_PROMPT, /Every upsert must cite at least one supplied user message ID/i);
    assert.match(CONSCIENTIOUS_CONVERSATION_PROMPT, /Never update a user_confirmed memory/i);
    assert.match(CONSCIENTIOUS_CONVERSATION_PROMPT, /Never infer the user's gender/i);
    assert.match(CONSCIENTIOUS_CONVERSATION_PROMPT, /Do not create both a person and relationship record/i);
  });

  it('asks the model to help a user feel heard before seeking more detail', () => {
    assert.match(CONSCIENTIOUS_CONVERSATION_PROMPT, /Reflect the feeling.*before analyzing, advising, challenging, or asking/i);
    assert.match(CONSCIENTIOUS_CONVERSATION_PROMPT, /first user turn, prioritize being present and understood/i);
    assert.match(CONSCIENTIOUS_CONVERSATION_PROMPT, /Do not merely repeat, summarize, or relabel/i);
    assert.match(CONSCIENTIOUS_CONVERSATION_PROMPT, /Avoid clinical-sounding templates/i);
    assert.match(CONSCIENTIOUS_CONVERSATION_PROMPT, /Ask no more than one question in the entire user-facing reply/i);
    assert.match(CONSCIENTIOUS_CONVERSATION_PROMPT, /rather than asking them to define their words or answer multiple parts/i);
    assert.match(CONSCIENTIOUS_CONVERSATION_PROMPT, /On a first turn, use two attuned sentences before any question/i);
  });
});

describe('conversation model output', () => {
  it('bounds verbose Gemini fields instead of discarding the entire response', () => {
    const parsed = conversationModelOutputSchema.parse({
      reply: 'A useful response.',
      stance: 'explore',
      knownFacts: ['One', 'Two', 'Three', 'Four', 'Five', 'Six'],
      interpretations: [],
      missingContext: [],
      directChallenge: '',
      followUpQuestion: 'What happened next?',
      summary: 'A concise summary.',
      memoryUpserts: [{
        kind: 'unresolved',
        subject: 'Project planning disagreement',
        detail: 'x'.repeat(450),
        status: 'ongoing',
        confidence: 'explicit',
        sourceMessageIds: ['message-1'],
      }],
    });

    assert.equal(parsed.knownFacts.length, 5);
    assert.equal(parsed.memoryUpserts[0]?.detail.length, 400);
    assert.equal(parsed.memoryUpserts[0]?.status, 'active');
  });
});

describe('normalizeAnalysis', () => {
  it('removes candidates without enough distinct valid evidence', () => {
    assert.equal(normalizeAnalysis(analysis('A weak signal.', ['one']), request, collection, ['decision_pause']).patterns.length, 0);
    assert.equal(normalizeAnalysis(analysis('A weak signal.', ['one', 'missing']), request, collection, ['decision_pause']).patterns.length, 0);
  });

  it('removes prohibited language and patterns from unselected skills', () => {
    assert.equal(normalizeAnalysis(analysis('This person is toxic.'), request, collection, ['decision_pause']).patterns.length, 0);
    assert.equal(normalizeAnalysis(analysis('A neutral observation.'), request, collection, []).patterns.length, 0);
  });

  it('canonicalizes authored metadata instead of trusting model metadata', () => {
    const result = normalizeAnalysis(analysis('Two entries describe urgency.'), request, collection, ['decision_pause']);
    assert.deepEqual(result.patterns[0], {
      ...analysis('Two entries describe urgency.').patterns[0],
      id: 'urgency_loop',
      category: 'decision_loop',
      title: 'Repeated urgency',
      skillId: 'decision_pause',
      collectionId: 'within.test',
      collectionVersion: '2.0.0',
    });
  });
});
