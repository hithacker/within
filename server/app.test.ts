import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from './app.js';
import type { AppConfig } from './config.js';
import type { ConversationModel, JournalModel } from './gemini.js';
import type { ConversationRequest, JournalAnalysisRequest } from './schema.js';
import type { AccountService } from './account.js';
import type { KnowledgePackService } from './knowledge-pack.js';
import type { KnowledgePackContent } from './knowledge-pack-schema.js';

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

const publishedPack: KnowledgePackContent = {
  schemaVersion: 1,
  id: 'within.test',
  version: '1.0.0',
  title: 'Test pack',
  summary: 'A test pack.',
  intendedAudience: 'Adults testing structured reflection.',
  supportedLifeAreas: ['Relationships'],
  authors: [{ name: 'Within', credentials: 'Editorial team' }],
  clinicalReviewRequired: false,
  modules: [{ id: 'pause', title: 'Pause', purpose: 'Create time before acting.', journalPrompts: ['What feels urgent?'], steps: ['Wait before acting.'], completionCriteria: [], contraindications: [] }],
  patterns: [{ id: 'urgency', category: 'decision_loop', title: 'Urgency', description: 'Repeated urgency.', minimumEvidenceEntries: 2, supportingSignals: ['Two entries describe urgency.'], weakeningSignals: [], excludingSignals: [], moduleId: 'pause' }],
  language: { approvedTerms: ['may be worth checking'], prohibitedClaims: ['diagnose a person'] },
  safety: { scope: 'Educational reflection only.', escalationRules: ['Crisis language bypasses ordinary analysis.'] },
};

describe('Within API', () => {
  it('reports conscientious conversation mode without leaking credentials', async () => {
    const response = await request(createApp({ config })).get('/health').expect(200);
    assert.deepEqual(response.body, {
      status: 'ok',
      model: 'gemini-2.5-flash',
      fallbackModel: 'gemini-2.5-flash-lite',
      configured: false,
      mode: 'conscientious-conversation',
    });
  });

  it('serves public privacy and support pages', async () => {
    await request(createApp({ config })).get('/privacy').expect(200).expect('Content-Type', /html/);
    await request(createApp({ config })).get('/support').expect(200).expect('Content-Type', /html/);
  });

  it('serves a validated published knowledge pack', async () => {
    let requestedVersion: string | undefined;
    const knowledgePackService: KnowledgePackService = {
      getPublishedPack: async (_packId, version) => {
        requestedVersion = version;
        return publishedPack;
      },
    };
    const response = await request(createApp({ config, knowledgePackService }))
      .get('/v1/knowledge-packs/within.test?version=1.0.0')
      .expect(200)
      .expect('Cache-Control', /max-age=300/);
    assert.equal(requestedVersion, '1.0.0');
    assert.equal(response.body.pack.modules[0].id, 'pause');
  });

  it('returns 404 for an unpublished knowledge pack', async () => {
    const knowledgePackService: KnowledgePackService = { getPublishedPack: async () => null };
    await request(createApp({ config, knowledgePackService }))
      .get('/v1/knowledge-packs/within.missing')
      .expect(404);
  });

  it('rejects malformed knowledge pack references', async () => {
    const knowledgePackService: KnowledgePackService = { getPublishedPack: async () => publishedPack };
    await request(createApp({ config, knowledgePackService }))
      .get('/v1/knowledge-packs/within.test?version=latest')
      .expect(400);
  });

  it('validates authoring-studio knowledge pack content', async () => {
    const response = await request(createApp({ config }))
      .post('/v1/knowledge-packs/validate')
      .send(publishedPack)
      .expect(200);
    assert.deepEqual(response.body, { valid: true });
  });

  it('returns useful paths for invalid authoring content', async () => {
    const response = await request(createApp({ config }))
      .post('/v1/knowledge-packs/validate')
      .send({ ...publishedPack, modules: [] })
      .expect(422);
    assert.equal(response.body.valid, false);
    assert.equal(response.body.issues[0].path, 'modules');
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
    let receivedCollection: KnowledgePackContent | undefined;
    const model: JournalModel = {
      analyze: async (_request: JournalAnalysisRequest, collection) => {
        receivedCollection = collection;
        return ({
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
          skillId: 'pause',
          collectionId: 'within.test',
          collectionVersion: '1.0.0',
        }],
      });
      },
    };
    const knowledgePackService: KnowledgePackService = { getPublishedPack: async () => publishedPack };
    const response = await request(createApp({ config, model, knowledgePackService }))
      .post('/v1/journal/analyze')
      .send({ entries, currentEntryId: 'entry-2', goals: [], collectionId: 'within.test', collectionVersion: '1.0.0' })
      .expect(200);
    assert.equal(response.body.safetyAction, 'continue');
    assert.equal(response.body.analysis.patterns[0].evidenceEntryIds.length, 2);
    assert.equal(receivedCollection?.id, 'within.test');
  });

  it('rejects a conversation that does not end with a user message', async () => {
    const response = await request(createApp({ config }))
      .post('/v1/conversations/respond')
      .send({
        messages: [{
          id: 'message-1',
          role: 'assistant',
          content: 'What happened?',
          createdAt: '2026-07-28T10:00:00.000Z',
        }],
      })
      .expect(400);
    assert.equal(response.body.error, 'invalid_request');
  });

  it('intercepts crisis language before conversational generation', async () => {
    const conversationModel: ConversationModel = { respond: async () => { throw new Error('must not run'); } };
    const response = await request(createApp({ config, conversationModel }))
      .post('/v1/conversations/respond')
      .send({
        messages: [{
          id: 'message-1',
          role: 'user',
          content: 'I want to kill myself',
          createdAt: '2026-07-28T10:00:00.000Z',
        }],
      })
      .expect(200);
    assert.equal(response.body.safetyAction, 'crisis');
    assert.equal(response.body.response, null);
  });

  it('returns a structured conscientious response', async () => {
    let received: ConversationRequest | undefined;
    const conversationModel: ConversationModel = {
      respond: async (conversation) => {
        received = conversation;
        return {
          reply: 'Your explanation may be incomplete.',
          stance: 'challenge',
          knownFacts: ['The project deadline has changed before.'],
          interpretations: ['The team may be working from different priorities.'],
          missingContext: ['Whether the revised scope and ownership were agreed.'],
          directChallenge: 'Calling the delay laziness leaves out the documented scope changes.',
          followUpQuestion: 'What changed after the original estimate?',
          summary: { text: 'The user reports recurring project delays after scope changes.', updatedAt: '2026-07-28T10:03:00.000Z' },
          memoryUpserts: [],
        };
      },
    };
    const response = await request(createApp({ config, conversationModel }))
      .post('/v1/conversations/respond')
      .send({
        messages: [{
          id: 'message-1',
          role: 'user',
          content: 'The project deadline slipped after another scope change.',
          createdAt: '2026-07-28T10:00:00.000Z',
        }],
      })
      .expect(200);
    assert.equal(response.body.safetyAction, 'continue');
    assert.equal(response.body.response.stance, 'challenge');
    assert.equal(received?.messages[0]?.role, 'user');
  });

  it('does not invoke the model for an unpublished collection', async () => {
    const model: JournalModel = { analyze: async () => { throw new Error('must not run'); } };
    const knowledgePackService: KnowledgePackService = { getPublishedPack: async () => null };
    const response = await request(createApp({ config, model, knowledgePackService }))
      .post('/v1/journal/analyze')
      .send({ entries, currentEntryId: 'entry-2', goals: [], collectionId: 'within.missing' })
      .expect(404);
    assert.equal(response.body.error, 'collection_not_found');
  });

  it('requires authentication before deleting an account', async () => {
    const accountService: AccountService = { deleteAccount: async () => undefined };
    await request(createApp({ config, accountService })).delete('/v1/account').expect(401);
  });

  it('deletes the authenticated account through the account service', async () => {
    let receivedToken = '';
    const accountService: AccountService = { deleteAccount: async (token) => { receivedToken = token; } };
    await request(createApp({ config, accountService }))
      .delete('/v1/account')
      .set('authorization', 'Bearer verified-token')
      .expect(204);
    assert.equal(receivedToken, 'verified-token');
  });
});
