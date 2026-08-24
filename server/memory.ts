import { applyDirectAnswerPreference } from './direct-answer.js';
import {
  conversationResponseSchema,
  type ConversationModelOutput,
  type ConversationRequest,
  type ConversationResponse,
  type DurableMemory,
} from './schema.js';

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'because', 'been', 'before', 'being', 'could', 'does',
  'from', 'have', 'into', 'just', 'more', 'that', 'their', 'them', 'then', 'there',
  'they', 'this', 'what', 'when', 'where', 'which', 'while', 'with', 'would', 'your',
]);

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .match(/[a-z0-9]{3,}/g)
      ?.filter((token) => !STOP_WORDS.has(token)) ?? [],
  );
}

const kindPriority: Record<DurableMemory['kind'], number> = {
  correction: 6,
  commitment: 5,
  prediction: 5,
  unresolved: 4,
  goal: 3,
  relationship: 2,
  person: 2,
  outcome: 1,
};

export function selectRelevantMemories(
  memories: DurableMemory[],
  query: string,
  threadContext = '',
  limit = 12,
): DurableMemory[] {
  const queryTokens = tokens(query);
  const contextTokens = tokens(threadContext);
  const normalizedQuery = normalized(`${query} ${threadContext}`);
  return memories
    .map((memory) => {
      const subjectTokens = tokens(memory.subject);
      const memoryTokens = tokens(`${memory.subject} ${memory.detail}`);
      let latestOverlap = 0;
      let contextOverlap = 0;
      let subjectOverlap = 0;
      for (const token of queryTokens) {
        if (memoryTokens.has(token)) latestOverlap += 1;
        if (subjectTokens.has(token)) subjectOverlap += 1;
      }
      for (const token of contextTokens) {
        if (memoryTokens.has(token)) contextOverlap += 1;
        if (subjectTokens.has(token)) subjectOverlap += 1;
      }
      const exactSubject = normalizedQuery.includes(normalized(memory.subject)) ? 20 : 0;
      const active = memory.status === 'active' ? 4 : 0;
      const confirmed = memory.confidence === 'user_confirmed' ? 5 : 0;
      const score = latestOverlap * 12
        + contextOverlap * 6
        + subjectOverlap * 3
        + exactSubject
        + active
        + confirmed
        + kindPriority[memory.kind];
      return { memory, score, matched: latestOverlap + contextOverlap > 0 };
    })
    .filter(({ matched, memory }) => matched || (
      memory.status === 'active'
      && ['correction', 'commitment', 'prediction', 'unresolved'].includes(memory.kind)
    ))
    .sort((a, b) => b.score - a.score || b.memory.updatedAt.localeCompare(a.memory.updatedAt))
    .slice(0, limit)
    .map(({ memory }) => memory);
}

function normalized(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeConversationOutput(
  output: ConversationModelOutput,
  request: ConversationRequest,
  now = new Date().toISOString(),
): ConversationResponse {
  const userMessageIds = new Set(request.messages.filter(({ role }) => role === 'user').map(({ id }) => id));
  const existingById = new Map(request.memories.map((memory) => [memory.id, memory]));
  const seen = new Set<string>();

  const memoryUpserts = output.memoryUpserts.flatMap((candidate) => {
    const sourceMessageIds = [...new Set(candidate.sourceMessageIds)].filter((id) => userMessageIds.has(id));
    if (sourceMessageIds.length === 0) return [];

    const existing = candidate.existingMemoryId ? existingById.get(candidate.existingMemoryId) : undefined;
    if (candidate.existingMemoryId && !existing) return [];
    if (existing?.confidence === 'user_confirmed') return [];

    const dedupeKey = existing?.id ?? `${candidate.kind}:${normalized(candidate.subject)}:${normalized(candidate.detail)}`;
    if (seen.has(dedupeKey)) return [];
    seen.add(dedupeKey);

    return [{
      id: existing?.id ?? `memory-${crypto.randomUUID()}`,
      kind: candidate.kind,
      subject: candidate.subject,
      detail: candidate.detail,
      status: candidate.status,
      confidence: candidate.confidence,
      sourceMessageIds: [...new Set([...(existing?.sourceMessageIds ?? []), ...sourceMessageIds])].slice(-6),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }];
  });

  return conversationResponseSchema.parse({
    ...applyDirectAnswerPreference(output, request),
    summary: { text: output.summary, updatedAt: now },
    memoryUpserts,
  });
}
