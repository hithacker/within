import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from './app.js';
import type { AppConfig } from './config.js';
import type { JournalModel } from './gemini.js';
import type { JournalAnalysisRequest } from './schema.js';

const config: AppConfig = {
  NODE_ENV: 'test',
  PORT: 4000,
  GEMINI_MODEL: 'gemini-2.5-flash',
  GEMINI_FALLBACK_MODEL: 'gemini-2.5-flash-lite',
  ALLOWED_ORIGINS: 'http://localhost:8081',
};

const entries = [
  { id: 'entry-1', createdAt: '2026-07-15T10:00:00.000Z', title: '', body: 'I cancelled dinner with friends for another date.', lifeAreas: ['Dating'] },
  { id: 'entry-2', createdAt: '2026-07-17T10:00:00.000Z', title: '', body: 'We met again and I skipped the gym.', lifeAreas: ['Dating'] },
];

describe('journal API', () => {
  it('reports structured analysis mode without leaking credentials', async () => {
    const response = await request(createApp({ config })).get('/health').expect(200);
    assert.deepEqual(response.body, {
      status: 'ok',
      model: 'gemini-2.5-flash',
      fallbackModel: 'gemini-2.5-flash-lite',
      configured: false,
      mode: 'structured-journal-analysis',
    });
  });

  it('serves public privacy and support pages', async () => {
    await request(createApp({ config })).get('/privacy').expect(200).expect('Content-Type', /html/);
    await request(createApp({ config })).get('/support').expect(200).expect('Content-Type', /html/);
  });

  it('rejects invalid journal payloads', async () => {
    const response = await request(createApp({ config })).post('/v1/journal/analyze').send({ entries: [] }).expect(400);
    assert.equal(response.body.error, 'invalid_request');
  });

  it('intercepts crisis language without invoking the model', async () => {
    const model: JournalModel = { analyze: async () => { throw new Error('must not run'); } };
    const response = await request(createApp({ config, model }))
      .post('/v1/journal/analyze')
      .send({ entries: [{ ...entries[0], body: 'I want to kill myself' }], currentEntryId: 'entry-1', goals: [] })
      .expect(200);
    assert.equal(response.body.safetyAction, 'crisis');
    assert.equal(response.body.analysis, null);
  });

  it('returns structured analysis for ordinary entries', async () => {
    const model: JournalModel = {
      analyze: async (_request: JournalAnalysisRequest) => ({
        entrySummary: 'A new relationship is taking time from existing routines.',
        themes: ['dating', 'balance'],
        patterns: [{
          id: 'dating_routine_shift',
          category: 'balance',
          title: 'Your routines have shifted',
          observation: 'Two recent entries mention changing existing plans for dates.',
          confidence: 'recurring_pattern',
          evidenceEntryIds: ['entry-1', 'entry-2'],
          goalConnection: '',
          skillId: 'routine_protection',
          knowledgePack: 'within.relationships',
          knowledgePackVersion: '1.0.0',
        }],
      }),
    };
    const response = await request(createApp({ config, model }))
      .post('/v1/journal/analyze')
      .send({ entries, currentEntryId: 'entry-2', goals: [] })
      .expect(200);
    assert.equal(response.body.safetyAction, 'continue');
    assert.equal(response.body.analysis.patterns[0].evidenceEntryIds.length, 2);
  });
});
