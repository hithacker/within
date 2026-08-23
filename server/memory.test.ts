import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeConversationOutput, selectRelevantMemories } from './memory.js';
import type { ConversationModelOutput, ConversationRequest, DurableMemory } from './schema.js';

const createdAt = '2026-07-28T10:00:00.000Z';

function memory(overrides: Partial<DurableMemory> & Pick<DurableMemory, 'id' | 'kind' | 'subject' | 'detail'>): DurableMemory {
  return {
    status: 'active',
    confidence: 'explicit',
    sourceMessageIds: ['old-message'],
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

const memories: DurableMemory[] = [
  memory({ id: 'deadline-risk', kind: 'unresolved', subject: 'Project deadline', detail: 'The delivery timeline remains unresolved.' }),
  memory({ id: 'work-goal', kind: 'goal', subject: 'Work', detail: 'Wants to ask for a promotion.' }),
  memory({ id: 'user-fix', kind: 'correction', subject: 'Project scope', detail: 'The launch is an internal pilot, not a public release.', confidence: 'user_confirmed' }),
];

const request: ConversationRequest = {
  messages: [{
    id: 'new-message',
    role: 'user',
    content: 'The project deadline changed after another scope review.',
    createdAt,
  }],
  memories,
};

function output(memoryUpserts: ConversationModelOutput['memoryUpserts']): ConversationModelOutput {
  return {
    reply: 'There may be unresolved history.',
    stance: 'explore',
    knownFacts: [],
    interpretations: [],
    missingContext: [],
    directChallenge: '',
    followUpQuestion: '',
    summary: 'The user reports recurring project delays after scope changes.',
    memoryUpserts,
  };
}

describe('memory retrieval', () => {
  it('selects lexical matches and keeps active unresolved context', () => {
    const selected = selectRelevantMemories(memories, 'The project deadline changed after the scope review.');
    assert.deepEqual(selected.map(({ id }) => id), ['deadline-risk', 'user-fix']);
  });

  it('uses the active thread summary to resolve vague follow-up messages', () => {
    const selected = selectRelevantMemories(
      memories,
      'It happened again.',
      'This thread concerns recurring project deadline and scope changes.',
    );
    assert.deepEqual(selected.map(({ id }) => id), ['deadline-risk', 'user-fix']);
  });
});

describe('memory normalization', () => {
  it('requires valid user-message evidence and canonicalizes generated IDs', () => {
    const result = normalizeConversationOutput(output([
      {
        kind: 'unresolved',
        subject: 'Deadline and scope',
        detail: 'The delivery plan has not been resolved.',
        status: 'active',
        confidence: 'explicit',
        sourceMessageIds: ['new-message', 'invented-message'],
      },
      {
        kind: 'goal',
        subject: 'Invalid',
        detail: 'Unsupported memory.',
        status: 'active',
        confidence: 'tentative',
        sourceMessageIds: ['invented-message'],
      },
    ]), request, '2026-07-28T10:05:00.000Z');

    assert.equal(result.memoryUpserts.length, 1);
    assert.match(result.memoryUpserts[0]!.id, /^memory-/);
    assert.deepEqual(result.memoryUpserts[0]!.sourceMessageIds, ['new-message']);
  });

  it('rejects updates to unknown and user-confirmed memories', () => {
    const result = normalizeConversationOutput(output([
      {
        existingMemoryId: 'missing',
        kind: 'goal',
        subject: 'Unknown',
        detail: 'Invalid update.',
        status: 'active',
        confidence: 'explicit',
        sourceMessageIds: ['new-message'],
      },
      {
        existingMemoryId: 'user-fix',
        kind: 'correction',
        subject: 'Project scope',
        detail: 'AI attempted overwrite.',
        status: 'active',
        confidence: 'explicit',
        sourceMessageIds: ['new-message'],
      },
    ]), request);
    assert.deepEqual(result.memoryUpserts, []);
  });

  it('preserves identity and creation time for valid updates', () => {
    const result = normalizeConversationOutput(output([{
      existingMemoryId: 'deadline-risk',
      kind: 'unresolved',
      subject: 'Project deadline',
      detail: 'The deadline changed again.',
      status: 'active',
      confidence: 'explicit',
      sourceMessageIds: ['new-message'],
    }]), request, '2026-07-28T10:05:00.000Z');

    assert.equal(result.memoryUpserts[0]!.id, 'deadline-risk');
    assert.equal(result.memoryUpserts[0]!.createdAt, createdAt);
    assert.equal(result.memoryUpserts[0]!.updatedAt, '2026-07-28T10:05:00.000Z');
  });

  it('strips a follow-up question when the user asked for answers', () => {
    const result = normalizeConversationOutput({
      ...output([]),
      reply: 'The accusations may be about distance rather than proof. What do you think might help?',
      followUpQuestion: 'What do you think might help?',
    }, {
      ...request,
      messages: [{
        id: 'new-message',
        role: 'user',
        content: 'Dude like i need andwers also. U cant keep asking me',
        createdAt,
      }],
    });

    assert.equal(result.followUpQuestion, '');
    assert.equal(result.reply, 'The accusations may be about distance rather than proof.');
  });
});
