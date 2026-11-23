import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Where the email's link should land (web: this site's sign-in page, which finishes setup).
const redirectTo = () => (Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/sign-in` : undefined);

// Email-code sign-in. An existing anonymous session (from before accounts) is upgraded in
// place with updateUser({ email }), keeping the same user id, events and organizer rights.

interface AuthValue {
  required: boolean; // sharing configured → everyone must sign in
  loading: boolean;
  user: User | null; // signed in with an email account (anonymous sessions count as signed out)
  hasAnonymousSession: boolean;
  displayName: string | null;
  profileLoaded: boolean; // displayName fetched for the current user
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  setDisplayName: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
  createTestUser: () => Promise<void>; // staging only (EXPO_PUBLIC_TEST_LOGIN)
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [displayName, setName] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const mode = useRef<'upgrade' | 'signin'>('signin');

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSessionUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSessionUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  const user = sessionUser && !sessionUser.is_anonymous ? sessionUser : null;

  useEffect(() => {
    setProfileLoaded(false);
    if (!supabase || !user) {
      setName(null);
      return;
    }
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setName(data?.display_name ?? null);
        setProfileLoaded(true);
      });
  }, [user?.id]);

  const db = () => {
    if (!supabase) throw new Error('Sign-in is not configured');
    return supabase;
  };

  const sendCode = async (email: string) => {
    const address = email.trim().toLowerCase();
    if (sessionUser?.is_anonymous) {
      const { error } = await db().auth.updateUser({ email: address }, { emailRedirectTo: redirectTo() });
      if (!error) {
        mode.current = 'upgrade';
        return;
      }
      // That email already has an account: sign into it instead (this device's anonymous
      // memberships are left behind; re-open the invite link to rejoin).
      if (!/already|registered|exists/i.test(error.message)) throw error;
    }
    const { error } = await db().auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true, emailRedirectTo: redirectTo() },
    });
    if (error) throw error;
    mode.current = 'signin';
  };

  const verifyCode = async (email: string, code: string) => {
    const { error } = await db().auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: mode.current === 'upgrade' ? 'email_change' : 'email',
    });
    if (error) throw error;
  };

  const setDisplayName = async (name: string) => {
    const { data, error: authError } = await db().auth.getUser();
    if (!data.user) {
      // A network failure is not a sign-out: keep the session and let them retry.
      if (authError && /fetch|network/i.test(authError.message)) throw new Error('No connection. Check your signal and try again.');
      // The server no longer accepts this saved sign-in (expired, or the account was removed): start over.
      await db().auth.signOut({ scope: 'local' });
      throw new Error('Your sign-in expired. Enter your email to sign in again.');
    }
    const { error } = await db().from('profiles').upsert({ id: data.user.id, display_name: name.trim() });
    if (error) throw error;
    setName(name.trim());
  };

  // Staging: a fresh real account with no email sent. Needs "Confirm email" off in Supabase.
  // example.com is reserved, so these addresses never belong to a real person.
  const createTestUser = async () => {
    const rand = Math.random().toString(36).slice(2, 10);
    const { data, error } = await db().auth.signUp({
      email: `golf-test-${rand}@example.com`,
      password: `t-${rand}-${Math.random().toString(36).slice(2)}`,
    });
    if (error) throw error;
    if (!data.session) throw new Error('Supabase still requires email confirmation: turn off "Confirm email" in Authentication → Email.');
  };

  const signOut = async () => {
    await db().auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        required: !!supabase,
        loading,
        user,
        hasAnonymousSession: !!sessionUser?.is_anonymous,
        displayName,
        profileLoaded,
        sendCode,
        verifyCode,
        setDisplayName,
        signOut,
        createTestUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
