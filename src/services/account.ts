import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createClient, processLock, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import type { JournalState } from '../types/journal';

WebBrowser.maybeCompleteAuthSession();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

export const cloudSyncConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let client: SupabaseClient | undefined;
let autoRefreshConfigured = false;

export class SignInError extends Error {
  constructor(public readonly code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SignInError';
  }
}

function signInFailure(code: string, message: string, cause?: unknown): SignInError {
  return new SignInError(code, message, { cause });
}

export function getSignInFailureMessage(error: unknown): string {
  if (error instanceof SignInError) return `${error.message} (${error.code})`;
  return 'Check your connection and try again. Your local journal was not changed. (AUTH-UNKNOWN)';
}

export function getSupabase(): SupabaseClient | undefined {
  if (!cloudSyncConfigured) return undefined;
  client ??= createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      lock: processLock,
    },
  });

  if (!autoRefreshConfigured && Platform.OS !== 'web') {
    autoRefreshConfigured = true;
    AppState.addEventListener('change', (state) => {
      if (state === 'active') client?.auth.startAutoRefresh();
      else client?.auth.stopAutoRefresh();
    });
  }
  return client;
}

export async function getCurrentSession(): Promise<Session | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function observeSession(onChange: (session: Session | null) => void) {
  const supabase = getSupabase();
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => onChange(session));
  return () => data.subscription.unsubscribe();
}

export async function signIn(provider: 'google' | 'apple'): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw signInFailure('AUTH-CONFIG', 'Cloud sync is not configured.');

  if (provider === 'apple' && Platform.OS === 'ios') {
    let credential: AppleAuthentication.AppleAuthenticationCredential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('ERR_REQUEST_CANCELED')) return;
      throw signInFailure('APPLE-01', 'Apple could not complete sign-in.', error);
    }
    if (!credential.identityToken) throw signInFailure('APPLE-02', 'Apple did not return an identity token.');

    try {
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;
    } catch (error) {
      throw signInFailure('APPLE-03', 'Apple account verification failed.', error);
    }

    const nameParts = [credential.fullName?.givenName, credential.fullName?.middleName, credential.fullName?.familyName].filter(Boolean);
    if (nameParts.length) {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: nameParts.join(' '),
          given_name: credential.fullName?.givenName,
          family_name: credential.fullName?.familyName,
        },
      });
      if (updateError) throw signInFailure('APPLE-04', 'Signed in, but the profile could not be updated.', updateError);
    }
    return;
  }

  const redirectTo = Linking.createURL('auth/callback');
  let authorizationUrl: string;
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    authorizationUrl = data.url;
  } catch (error) {
    throw signInFailure('GOOGLE-01', 'Google sign-in could not be started.', error);
  }

  const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, redirectTo);
  if (result.type !== 'success') return;

  const callback = new URL(result.url);
  const callbackError = callback.searchParams.get('error_description') ?? callback.searchParams.get('error');
  if (callbackError) throw signInFailure('GOOGLE-02', 'Google rejected the sign-in request.');

  const code = callback.searchParams.get('code');
  if (!code) throw signInFailure('GOOGLE-03', 'Google returned an incomplete sign-in response.');
  try {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
  } catch (error) {
    throw signInFailure('GOOGLE-04', 'Google account verification failed.', error);
  }
}

export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

function validState(value: unknown): value is JournalState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<JournalState>;
  return Array.isArray(candidate.entries) && Array.isArray(candidate.insights) && Array.isArray(candidate.goals);
}

export function mergeJournalStates(local: JournalState, remote?: JournalState): JournalState {
  if (!remote) return local;

  const entries = new Map(local.entries.map((entry) => [entry.id, entry]));
  for (const entry of remote.entries) {
    const existing = entries.get(entry.id);
    if (!existing || entry.updatedAt > existing.updatedAt) entries.set(entry.id, entry);
  }

  const insights = new Map(local.insights.map((insight) => [insight.id, insight]));
  for (const insight of remote.insights) {
    const existing = insights.get(insight.id);
    if (!existing || insight.createdAt > existing.createdAt) insights.set(insight.id, insight);
  }

  return {
    entries: [...entries.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    insights: [...insights.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    goals: [...new Set([...local.goals, ...remote.goals])].slice(0, 5),
    aiConsent: local.aiConsent || remote.aiConsent,
  };
}

export async function loadCloudJournal(userId: string): Promise<JournalState | undefined> {
  const supabase = getSupabase();
  if (!supabase) return undefined;
  const { data, error } = await supabase.from('journal_snapshots').select('payload').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return validState(data?.payload) ? data.payload : undefined;
}

export async function saveCloudJournal(userId: string, state: JournalState): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from('journal_snapshots').upsert({
    user_id: userId,
    payload: state,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function deleteCloudJournal(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from('journal_snapshots').delete().eq('user_id', userId);
  if (error) throw error;
}

export async function deleteAccount(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !apiUrl) throw new Error('Account deletion is not configured');
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('You are not signed in');

  const response = await fetch(`${apiUrl}/v1/account`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${data.session.access_token}` },
  });
  if (!response.ok) throw new Error('Account deletion failed');
  await supabase.auth.signOut({ scope: 'local' });
  await AsyncStorage.removeItem('within.journal.v1');
  await AsyncStorage.removeItem('within.conversation.v1');
}
