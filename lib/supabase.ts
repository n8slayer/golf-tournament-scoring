import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// null when the env isn't set: the app then runs on-device only (no sharing).
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      })
    : null;

// Per Expo's Supabase guide: only refresh tokens while the app is in the foreground.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

// Each device signs in anonymously once; its user id is its identity (organizer / member).
// Single-flight: a second concurrent signInAnonymously() would wipe the first session
// mid-request (seen when app start and the join page both signed in at once).
let signingIn: Promise<string | null> | null = null;
export function ensureUserId(): Promise<string | null> {
  if (!supabase) return Promise.resolve(null);
  const db = supabase;
  signingIn ??= (async () => {
    const { data } = await db.auth.getSession();
    if (data.session) return data.session.user.id;
    const { data: signedIn, error } = await db.auth.signInAnonymously();
    if (error) throw error;
    return signedIn.user?.id ?? null;
  })().catch((e) => {
    signingIn = null; // let the next call retry (e.g. after coming back online)
    throw e;
  });
  return signingIn;
}
