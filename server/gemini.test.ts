import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isQuotaError, isTransientProviderError, normalizeAnalysis } from './gemini.js';
import type { JournalAnalysisRequest, JournalModelOutput } from './schema.js';

const request: JournalAnalysisRequest = {
  entries: [
    { id: 'one', createdAt: '2026-07-15T10:00:00.000Z', title: '', body: 'First entry', lifeAreas: [] },
    { id: 'two', createdAt: '2026-07-17T10:00:00.000Z', title: '', body: 'Second entry', lifeAreas: [] },
  ],
  currentEntryId: 'two',
  goals: [],
  knowledgePack: 'within.relationships',
};

function analysis(observation: string, evidenceEntryIds = ['one', 'two']): JournalModelOutput {
  return {
    entrySummary: 'A neutral summary.',
    themes: [],
    patterns: [{
      id: 'candidate',
      category: 'pacing',
      title: 'Check the pace',
      observation,
      confidence: 'recurring_pattern',
      evidenceEntryIds,
      goalConnection: '',
      skillId: 'pace_check',
      knowledgePack: 'within.relationships',
      knowledgePackVersion: '1.0.0',
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

describe('normalizeAnalysis', () => {
  it('turns a one-entry model candidate into a successful analysis with no pattern', () => {
    const result = normalizeAnalysis(analysis('A weak early signal.', ['one']), request);
    assert.equal(result.entrySummary, 'A neutral summary.');
    assert.equal(result.patterns.length, 0);
  });

  it('removes candidates without two distinct valid source entries', () => {
    assert.equal(normalizeAnalysis(analysis('A neutral observation.', ['one', 'one']), request).patterns.length, 0);
    assert.equal(normalizeAnalysis(analysis('A neutral observation.', ['one', 'missing']), request).patterns.length, 0);
  });

  it('removes candidates that use prohibited labels or directives', () => {
    assert.equal(normalizeAnalysis(analysis('This person is toxic.'), request).patterns.length, 0);
    assert.equal(normalizeAnalysis(analysis('You should break up with them.'), request).patterns.length, 0);
  });

  it('keeps a neutral candidate with valid evidence', () => {
    assert.equal(normalizeAnalysis(analysis('Two entries mention changing plans.'), request).patterns.length, 1);
  });
});
