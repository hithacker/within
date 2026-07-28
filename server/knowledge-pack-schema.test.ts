import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { knowledgePackContentSchema } from './knowledge-pack-schema.js';

const validPack = {
  schemaVersion: 1,
  id: 'within.test',
  version: '1.0.0',
  title: 'Test pack',
  summary: 'A test pack.',
  intendedAudience: 'Adults testing structured reflection.',
  supportedLifeAreas: ['Relationships'],
  authors: [{ name: 'Within', credentials: 'Editorial team' }],
  clinicalReviewRequired: false,
  modules: [{
    id: 'pause',
    title: 'Pause',
    purpose: 'Create time before acting.',
    journalPrompts: ['What feels urgent?'],
    steps: ['Wait before acting.'],
    completionCriteria: [],
    contraindications: [],
  }],
  patterns: [{
    id: 'urgency',
    category: 'decision_loop',
    title: 'Urgency',
    description: 'Repeated urgency before difficult-to-reverse choices.',
    minimumEvidenceEntries: 2,
    supportingSignals: ['Two entries describe immediate action.'],
    weakeningSignals: [],
    excludingSignals: [],
    moduleId: 'pause',
  }],
  language: { approvedTerms: ['may be worth checking'], prohibitedClaims: ['diagnose a person'] },
  safety: { scope: 'Educational reflection only.', escalationRules: ['Crisis language bypasses ordinary analysis.'] },
};

describe('knowledge pack contract', () => {
  it('accepts a structured, internally consistent pack', () => {
    assert.equal(knowledgePackContentSchema.parse(validPack).id, 'within.test');
  });

  it('rejects a pattern that references a missing module', () => {
    const invalid = structuredClone(validPack);
    invalid.patterns[0]!.moduleId = 'missing';
    assert.equal(knowledgePackContentSchema.safeParse(invalid).success, false);
  });

  it('rejects duplicate module IDs', () => {
    const invalid = structuredClone(validPack);
    invalid.modules.push(structuredClone(invalid.modules[0]!));
    assert.equal(knowledgePackContentSchema.safeParse(invalid).success, false);
  });
});
