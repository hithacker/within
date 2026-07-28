import type { JournalEntry, PatternInsight } from '../types/journal';

type AnalysisPayload = {
  entrySummary: string;
  themes: string[];
  patterns: Omit<PatternInsight, 'createdAt'>[];
};

export type JournalAnalysisResponse = {
  analysis: AnalysisPayload | null;
  safetyAction: 'continue' | 'crisis' | 'emergency' | 'abuse';
  supportMessage?: string;
};

export async function analyzeJournal(
  entries: JournalEntry[],
  currentEntryId: string,
  goals: string[],
  collection: { id: string; version: string },
): Promise<JournalAnalysisResponse> {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (!apiUrl) throw new Error('Journal analysis API is not configured');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const response = await fetch(`${apiUrl}/v1/journal/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entries: entries.slice(0, 20).map(({ id, createdAt, title, body, mood, lifeAreas }) => ({ id, createdAt, title, body, mood, lifeAreas })),
        currentEntryId,
        goals,
        collectionId: collection.id,
        collectionVersion: collection.version,
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Journal analysis failed: ${response.status}`);
    return (await response.json()) as JournalAnalysisResponse;
  } finally {
    clearTimeout(timeout);
  }
}
