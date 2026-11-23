import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import { s, colors, icon } from '../lib/styles';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Email → 6-digit code → (first time) your name. No passwords.
export default function SignIn() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { user, displayName, hasAnonymousSession, sendCode, verifyCode, setDisplayName, createTestUser } = useAuth();
  const [step, setStep] = useState<'email' | 'code' | 'name'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Only go back to paths inside the app.
  const destination = next && next.startsWith('/') && !next.startsWith('/sign-in') ? next : '/';
  const finish = () => router.replace(destination as never);

  // Signed in with a name already: we're done here.
  useEffect(() => {
    if (user && displayName) finish();
    else if (user && step !== 'name') setStep('name');
  }, [user, displayName]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      const msg = (e as Error)?.message ?? 'Something went wrong';
      setError(
        /rate limit/i.test(msg)
          ? 'Too many sign-in emails were sent recently. Wait a few minutes and try again.'
          : /expired|invalid/i.test(msg)
            ? 'That code is wrong or has expired. Check the latest email, or send a new one.'
            : msg
      );
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = () =>
    EMAIL_RE.test(email.trim())
      ? run(async () => {
          await sendCode(email);
          setStep('code');
        })
      : setError('Enter a valid email address.');
  const submitCode = () =>
    /^\d{6}$/.test(code.trim()) ? run(() => verifyCode(email, code)) : setError('Enter the 6-digit code from the email.');
  const submitName = () =>
    name.trim().length >= 1 && name.trim().length <= 40
      ? run(async () => {
          await setDisplayName(name);
          finish();
        })
      : setError('Enter your name (up to 40 characters).');

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingTop: 32 }]} keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: 'center', gap: 8 }}>
        <View style={[s.iconBadge, { width: 64, height: 64, borderRadius: 32 }]}>
          <Ionicons name="golf" size={32} color={colors.accent} />
        </View>
        <Text style={s.h1} accessibilityRole="header">
          {step === 'name' ? 'One last thing' : 'Sign in'}
        </Text>
        <Text style={[s.subtitle, { textAlign: 'center' }]}>
          {step === 'email' &&
            (hasAnonymousSession
              ? 'Add your email to keep your events and scores. We’ll email you a sign-in link. No password needed.'
              : 'We’ll email you a sign-in link. No password needed.')}
          {step === 'code' &&
            `Check ${email.trim()} (and spam). Tap the link in the email on this device to sign in, or type the 6-digit code if the email shows one.`}
          {step === 'name' && 'What should your group see you as?'}
        </Text>
      </View>

      {step === 'email' && (
        <>
          <Text style={s.label}>Email</Text>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setError('');
            }}
            onSubmitEditing={submitEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            accessibilityLabel="Email"
          />
          <Pressable style={({ pressed }) => [s.button, busy && s.disabled, pressed && s.pressed]} onPress={submitEmail} disabled={busy} accessibilityRole="button">
            <Text style={s.buttonText}>Email me a sign-in link</Text>
          </Pressable>
          {process.env.EXPO_PUBLIC_TEST_LOGIN === '1' && (
            <View style={{ gap: 6, marginTop: 12 }}>
              <Pressable
                onPress={() => run(createTestUser)}
                disabled={busy}
                accessibilityRole="button"
                style={({ pressed }) => [s.buttonSecondary, { borderStyle: 'dashed' }, busy && s.disabled, pressed && s.pressed]}
              >
                <Ionicons name="flask-outline" size={icon.sm} color={colors.accent} />
                <Text style={s.buttonTextSecondary}>Create test user (staging only)</Text>
              </Pressable>
              <Text style={[s.subtitle, { fontSize: 13, textAlign: 'center' }]}>
                Makes a brand-new account instantly, with no email. Sign out to make another.
              </Text>
            </View>
          )}
        </>
      )}

      {step === 'code' && (
        <>
          <Text style={s.label}>Or enter the 6-digit code</Text>
          <TextInput
            style={[s.input, { fontSize: 24, letterSpacing: 8, textAlign: 'center' }]}
            value={code}
            onChangeText={(v) => {
              setCode(v.replace(/\D/g, '').slice(0, 6));
              setError('');
            }}
            onSubmitEditing={submitCode}
            placeholder="123456"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            accessibilityLabel="6-digit code"
          />
          <Pressable style={({ pressed }) => [s.button, busy && s.disabled, pressed && s.pressed]} onPress={submitCode} disabled={busy} accessibilityRole="button">
            <Text style={s.buttonText}>Sign in</Text>
          </Pressable>
          <View style={s.row}>
            <Pressable onPress={() => setStep('email')} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={s.linkText}>Use a different email</Text>
            </Pressable>
            <Pressable onPress={submitEmail} disabled={busy} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={s.linkText}>Send again</Text>
            </Pressable>
          </View>
        </>
      )}

      {step === 'name' && (
        <>
          <Text style={s.label}>Your name</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={(v) => {
              setName(v);
              setError('');
            }}
            onSubmitEditing={submitName}
            placeholder="e.g. Nate"
            maxLength={40}
            accessibilityLabel="Your name"
          />
          <Pressable style={({ pressed }) => [s.button, busy && s.disabled, pressed && s.pressed]} onPress={submitName} disabled={busy} accessibilityRole="button">
            <Ionicons name="checkmark" size={icon.sm} color={colors.onAccent} />
            <Text style={s.buttonText}>Continue</Text>
          </Pressable>
        </>
      )}

      {busy && <ActivityIndicator color={colors.accent} />}
      {!!error && <Text style={{ color: colors.danger }}>{error}</Text>}
    </ScrollView>
  );
}
