import { getSupabase } from './account';
import type { ConversationMessage, ConversationState, ConversationThread } from '../types/conversation';
import { normalizeConversationState } from '../storage/conversation';

export function mergeConversationStates(local: ConversationState, remote?: ConversationState): ConversationState {
  const normalizedLocal = normalizeConversationState(local);
  if (!remote) return normalizedLocal;
  const normalizedRemote = normalizeConversationState(remote);

  const memories = new Map(normalizedLocal.memories.map((memory) => [memory.id, memory]));
  for (const memory of normalizedRemote.memories) {
    const existing = memories.get(memory.id);
    if (!existing || memory.updatedAt > existing.updatedAt) memories.set(memory.id, memory);
  }

  const deletedThreads = new Map(normalizedLocal.deletedThreads.map((item) => [item.id, item]));
  for (const item of normalizedRemote.deletedThreads) {
    const existing = deletedThreads.get(item.id);
    if (!existing || item.deletedAt > existing.deletedAt) deletedThreads.set(item.id, item);
  }

  const mergeThread = (localThread: ConversationThread, remoteThread: ConversationThread): ConversationThread => {
    const messages = new Map<string, ConversationMessage>();
    for (const message of [...localThread.messages, ...remoteThread.messages]) messages.set(message.id, message);
    const summary = !localThread.summary
      ? remoteThread.summary
      : !remoteThread.summary || localThread.summary.updatedAt >= remoteThread.summary.updatedAt
        ? localThread.summary
        : remoteThread.summary;
    const latest = localThread.updatedAt >= remoteThread.updatedAt ? localThread : remoteThread;
    return {
      ...latest,
      messages: [...messages.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      summary,
      createdAt: localThread.createdAt <= remoteThread.createdAt ? localThread.createdAt : remoteThread.createdAt,
    };
  };

  const threads = new Map(normalizedLocal.threads.map((thread) => [thread.id, thread]));
  for (const remoteThread of normalizedRemote.threads) {
    const localThread = threads.get(remoteThread.id);
    threads.set(remoteThread.id, localThread ? mergeThread(localThread, remoteThread) : remoteThread);
  }
  for (const threadId of deletedThreads.keys()) threads.delete(threadId);

  return {
    version: 2,
    threads: [...threads.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    deletedThreads: [...deletedThreads.values()].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)).slice(0, 200),
    memories: [...memories.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 100),
    aiConsent: normalizedLocal.aiConsent || normalizedRemote.aiConsent,
    updatedAt: normalizedLocal.updatedAt > normalizedRemote.updatedAt ? normalizedLocal.updatedAt : normalizedRemote.updatedAt,
  };
}

export async function loadCloudConversation(userId: string): Promise<ConversationState | undefined> {
  const supabase = getSupabase();
  if (!supabase) return undefined;
  const { data, error } = await supabase.from('conversation_snapshots').select('payload').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data?.payload ? normalizeConversationState(data.payload) : undefined;
}

export async function saveCloudConversation(userId: string, state: ConversationState): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data: current, error: loadError } = await supabase
    .from('conversation_snapshots')
    .select('payload')
    .eq('user_id', userId)
    .maybeSingle();
  if (loadError) throw loadError;
  const merged = mergeConversationStates(state, current?.payload
    ? normalizeConversationState(current.payload)
    : undefined);
  const { error } = await supabase.from('conversation_snapshots').upsert({
    user_id: userId,
    payload: merged,
    updated_at: merged.updatedAt,
  });
  if (error) throw error;
}

export async function deleteCloudConversation(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from('conversation_snapshots').delete().eq('user_id', userId);
  if (error) throw error;
}
