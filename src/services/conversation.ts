import type {
  ConversationMessage,
  ConversationSummary,
  DurableMemory,
  ResponseReasoning,
} from '../types/conversation';

export type ConversationResponse = {
  response: ({
    reply: string;
    summary: ConversationSummary;
    memoryUpserts: DurableMemory[];
  } & ResponseReasoning) | null;
  safetyAction: 'continue' | 'crisis' | 'emergency' | 'abuse';
  supportMessage?: string;
};

export function completeReply(response: NonNullable<ConversationResponse['response']>): string {
  const question = response.followUpQuestion.trim();
  if (!question || response.reply.toLocaleLowerCase().includes(question.toLocaleLowerCase())) return response.reply;
  return `${response.reply}\n\n${question}`;
}

export async function sendConversationMessage(
  messages: ConversationMessage[],
  context: { summary?: ConversationSummary; memories: DurableMemory[] },
): Promise<ConversationResponse> {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (!apiUrl) throw new Error('Conversation API is not configured');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);

  try {
    const response = await fetch(`${apiUrl}/v1/conversations/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.slice(-20).map(({ id, role, content, createdAt }) => ({ id, role, content, createdAt })),
        summary: context.summary,
        memories: context.memories.slice(0, 100),
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Conversation request failed: ${response.status}`);
    return (await response.json()) as ConversationResponse;
  } finally {
    clearTimeout(timeout);
  }
}
