import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ConversationMessage,
  ConversationState,
  ConversationSummary,
  ConversationThread,
  DurableMemory,
} from '../types/conversation';

export const CONVERSATION_STORAGE_KEY = 'within.conversation.v2';
const LEGACY_CONVERSATION_STORAGE_KEY = 'within.conversation.v1';

export const emptyConversationState: ConversationState = {
  version: 2,
  threads: [],
  deletedThreads: [],
  memories: [],
  aiConsent: false,
  updatedAt: new Date(0).toISOString(),
};

function validMessage(value: unknown): value is ConversationMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return (message.role === 'user' || message.role === 'assistant')
    && typeof message.id === 'string'
    && typeof message.content === 'string'
    && typeof message.createdAt === 'string';
}

function validSummary(value: unknown): value is ConversationSummary {
  if (!value || typeof value !== 'object') return false;
  const summary = value as Record<string, unknown>;
  return typeof summary.text === 'string' && typeof summary.updatedAt === 'string';
}

function threadTitle(messages: ConversationMessage[]): string {
  const firstUserMessage = messages.find(({ role }) => role === 'user')?.content.trim();
  if (!firstUserMessage) return 'Conversation';
  const firstLine = firstUserMessage.split(/\n/)[0]!.replace(/\s+/g, ' ').trim();
  return firstLine.length <= 56 ? firstLine : `${firstLine.slice(0, 53).trimEnd()}...`;
}

function normalizeThread(value: unknown): ConversationThread | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<ConversationThread>;
  if (typeof candidate.id !== 'string' || !Array.isArray(candidate.messages)) return undefined;
  const messages = candidate.messages.filter(validMessage);
  const createdAt = typeof candidate.createdAt === 'string'
    ? candidate.createdAt
    : messages[0]?.createdAt ?? new Date(0).toISOString();
  const updatedAt = typeof candidate.updatedAt === 'string'
    ? candidate.updatedAt
    : messages.at(-1)?.createdAt ?? createdAt;
  return {
    id: candidate.id,
    title: typeof candidate.title === 'string' && candidate.title.trim()
      ? candidate.title.trim().slice(0, 80)
      : threadTitle(messages),
    messages,
    summary: validSummary(candidate.summary) ? candidate.summary : undefined,
    createdAt,
    updatedAt,
    archivedAt: typeof candidate.archivedAt === 'string' ? candidate.archivedAt : undefined,
  };
}

export function normalizeConversationState(value: unknown): ConversationState {
  if (!value || typeof value !== 'object') return emptyConversationState;
  const candidate = value as Record<string, unknown>;
  const updatedAt = typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date(0).toISOString();
  const memories = Array.isArray(candidate.memories) ? candidate.memories as DurableMemory[] : [];
  const aiConsent = candidate.aiConsent === true;

  if (candidate.version === 2 && Array.isArray(candidate.threads)) {
    return {
      version: 2,
      threads: candidate.threads.map(normalizeThread).filter((thread): thread is ConversationThread => Boolean(thread)),
      deletedThreads: Array.isArray(candidate.deletedThreads)
        ? candidate.deletedThreads.flatMap((item) => (
          item && typeof item === 'object'
          && typeof (item as Record<string, unknown>).id === 'string'
          && typeof (item as Record<string, unknown>).deletedAt === 'string'
            ? [item as ConversationState['deletedThreads'][number]]
            : []
        ))
        : [],
      memories,
      aiConsent,
      updatedAt,
    };
  }

  const legacyMessages = Array.isArray(candidate.messages) ? candidate.messages.filter(validMessage) : [];
  const legacySummary = validSummary(candidate.summary) ? candidate.summary : undefined;
  const legacyThread = legacyMessages.length > 0 ? normalizeThread({
    id: 'conversation-imported',
    title: threadTitle(legacyMessages),
    messages: legacyMessages,
    summary: legacySummary,
    createdAt: legacyMessages[0]?.createdAt,
    updatedAt,
  }) : undefined;

  return {
    version: 2,
    threads: legacyThread ? [legacyThread] : [],
    deletedThreads: [],
    memories,
    aiConsent,
    updatedAt,
  };
}

export async function loadConversationState(): Promise<ConversationState> {
  const value = await AsyncStorage.getItem(CONVERSATION_STORAGE_KEY)
    ?? await AsyncStorage.getItem(LEGACY_CONVERSATION_STORAGE_KEY);
  if (!value) return emptyConversationState;

  try {
    return normalizeConversationState(JSON.parse(value));
  } catch {
    return emptyConversationState;
  }
}

export async function saveConversationState(state: ConversationState): Promise<void> {
  await AsyncStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(state));
}

export async function clearConversationState(): Promise<void> {
  await AsyncStorage.multiRemove([CONVERSATION_STORAGE_KEY, LEGACY_CONVERSATION_STORAGE_KEY]);
}
