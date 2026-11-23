import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  ImageBackground,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import { s, colors, icon } from '../lib/styles';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Email → 6-digit code → (first time) your name. No passwords.
export default function SignIn() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const wide = useWindowDimensions().width >= 768;
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
            : msg,
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
    <View style={s.screen}>
      <ImageBackground source={require('../assets/signin-links.jpg')} resizeMode="cover" style={st.photo} accessibilityIgnoresInvertColors>
        {/* Photo fades into the page colour so the card and text stay readable. */}
        <View style={st.fade} />
      </ImageBackground>
      <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
        <View style={st.brand}>
          <Ionicons name="golf" size={22} color={colors.accent} />
          <Text style={st.brandText}>Golf Trip</Text>
        </View>

        {step === 'email' && (
          <View style={st.hero}>
            <Text style={st.kicker}>LIVE SCORING FOR GOLF TRIPS</Text>
            <Text style={[st.headline, wide && st.headlineWide]} accessibilityRole="header">
              {wide ? 'Every shot. Every match.\n' : 'Every shot.\nEvery match.\n'}
              <Text style={st.headlineAccent}>Every bet settled.</Text>
            </Text>
            <Text style={st.lede}>
              Ryder Cup matches, stroke play or Stableford. Live scores, skins and who owes who, on every phone in your group. Nothing to
              download.
            </Text>
          </View>
        )}

        <View style={st.card}>
          <Text style={st.cardTitle} accessibilityRole={step === 'email' ? undefined : 'header'}>
            {step === 'email'
              ? hasAnonymousSession
                ? 'Keep your events'
                : 'Sign in or create your account'
              : step === 'code'
                ? 'Check your email'
                : 'One last thing'}
          </Text>
          <Text style={s.subtitle}>
            {step === 'email' &&
              (hasAnonymousSession
                ? 'Add your email to keep your events and scores. We’ll email you a sign-in link. No password needed.'
                : 'We’ll email you a sign-in link. No password needed.')}
            {step === 'code' &&
              `Check ${email.trim()} (and spam). Tap the link in the email on this device to sign in, or type the 6-digit code if the email shows one.`}
            {step === 'name' && 'What should your group see you as?'}
          </Text>

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
              <Pressable
                style={({ pressed }) => [s.button, busy && s.disabled, pressed && s.pressed]}
                onPress={submitEmail}
                disabled={busy}
                accessibilityRole="button"
              >
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
              <Pressable
                style={({ pressed }) => [s.button, busy && s.disabled, pressed && s.pressed]}
                onPress={submitCode}
                disabled={busy}
                accessibilityRole="button"
              >
                <Text style={s.buttonText}>Sign in</Text>
              </Pressable>
              <View style={s.row}>
                <Pressable onPress={() => setStep('email')} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
                  <Text style={s.linkText}>Use a different email</Text>
                </Pressable>
                <Pressable
                  onPress={submitEmail}
                  disabled={busy}
                  accessibilityRole="button"
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
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
              <Pressable
                style={({ pressed }) => [s.button, busy && s.disabled, pressed && s.pressed]}
                onPress={submitName}
                disabled={busy}
                accessibilityRole="button"
              >
                <Ionicons name="checkmark" size={icon.sm} color={colors.onAccent} />
                <Text style={s.buttonText}>Continue</Text>
              </Pressable>
            </>
          )}

          {busy && <ActivityIndicator color={colors.accent} />}
          {!!error && <Text style={{ color: colors.danger }}>{error}</Text>}
        </View>

        {step === 'email' && (
          <View style={st.facts}>
            {FACTS.map(([big, small]) => (
              <View key={big} style={st.fact}>
                <Text style={st.factBig}>{big}</Text>
                <Text style={st.factSmall}>{small}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const FACTS = [
  ['3 formats', 'Ryder Cup, stroke play, Stableford'],
  ['Live', 'Scores on every phone'],
  ['Settled', 'Skins and who owes who'],
] as const;

const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' });
const fadeGradient = 'linear-gradient(180deg, rgba(11,22,38,0.25) 0%, rgba(11,22,38,0.55) 50%, rgba(11,22,38,0.92) 80%, #0B1626 100%)';

const st = StyleSheet.create({
  photo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  fade: {
    flex: 1,
    ...(Platform.OS === 'web' ? ({ backgroundImage: fadeGradient } as object) : { experimental_backgroundImage: fadeGradient }),
  },
  content: { padding: 16, paddingTop: 20, paddingBottom: 40, gap: 20, width: '100%', maxWidth: 900, alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { color: colors.text, fontFamily: serif, fontSize: 22 },
  hero: { gap: 12, marginTop: 36, alignItems: 'center' },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  headline: {
    color: '#fff',
    fontFamily: serif,
    fontSize: 40,
    lineHeight: 46,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 10,
  },
  headlineWide: { fontSize: 60, lineHeight: 66 },
  headlineAccent: { color: colors.accent, fontStyle: 'italic' },
  lede: {
    maxWidth: 620,
    color: colors.text,
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 8,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    gap: 12,
    padding: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(14,27,46,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,106,0.35)',
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(12px)' } as object) : {}),
  },
  cardTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  facts: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 16,
  },
  fact: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  factBig: { color: colors.accent, fontFamily: serif, fontSize: 22 },
  factSmall: { color: colors.muted, fontSize: 12, textAlign: 'center' },
});
