import AsyncStorage from '@react-native-async-storage/async-storage';
import type { JournalState } from '../types/journal';

const STORAGE_KEY = 'within.journal.v1';

export const emptyJournalState: JournalState = {
  entries: [],
  insights: [],
  goals: [],
  aiConsent: false,
};

export async function loadJournalState(): Promise<JournalState> {
  const value = await AsyncStorage.getItem(STORAGE_KEY);
  if (!value) return emptyJournalState;

  try {
    const parsed = JSON.parse(value) as Partial<JournalState>;
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      aiConsent: parsed.aiConsent === true,
    };
  } catch {
    return emptyJournalState;
  }
}

export async function saveJournalState(state: JournalState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function clearJournalState(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
