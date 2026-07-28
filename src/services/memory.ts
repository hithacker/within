import type { DurableMemory } from '../types/conversation';

function normalized(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function applyMemoryUpserts(current: DurableMemory[], upserts: DurableMemory[]): DurableMemory[] {
  const byId = new Map(current.map((memory) => [memory.id, memory]));

  for (const upsert of upserts) {
    const existing = byId.get(upsert.id);
    if (existing?.confidence === 'user_confirmed') continue;

    if (!existing) {
      const duplicate = [...byId.values()].find((memory) => (
        memory.kind === upsert.kind
        && normalized(memory.subject) === normalized(upsert.subject)
        && normalized(memory.detail) === normalized(upsert.detail)
      ));
      if (duplicate?.confidence === 'user_confirmed') continue;
      if (duplicate) byId.delete(duplicate.id);
    }
    byId.set(upsert.id, upsert);
  }

  return [...byId.values()]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 100);
}

export function userCorrectMemory(memory: DurableMemory, subject: string, detail: string): DurableMemory {
  return {
    ...memory,
    subject: subject.trim(),
    detail: detail.trim(),
    confidence: 'user_confirmed',
    updatedAt: new Date().toISOString(),
  };
}
