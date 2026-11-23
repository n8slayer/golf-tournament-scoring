import { useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Stack, router, usePathname, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { headerOptions, s, colors } from '../lib/styles';
import { TripsProvider } from '../context/TripsContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { UpdateBanner } from '../components/UpdateBanner';
import '../lib/webInteractions';

// Everyone signs in (email code) before using shared events; the page they were going to
// (e.g. an invite link) is passed as ?next= so they land there afterwards.
function AuthGate() {
  const { required, loading, user, displayName, profileLoaded } = useAuth();
  const pathname = usePathname();
  const needsSignIn =
    required && !loading && pathname !== '/sign-in' && (!user || (profileLoaded && !displayName));
  useEffect(() => {
    if (needsSignIn) router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
  }, [needsSignIn, pathname]);
  if (!required || !loading) return null;
  return (
    <View style={[s.screen, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

// Any crash shows this instead of a blank page, with the message so it can be reported.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={[s.screen, s.content, { justifyContent: 'center' }]}>
      <Text style={s.h1}>Something went wrong</Text>
      <Text style={s.subtitle}>Your scores are saved. Try again, or send this message to the organizer:</Text>
      <Text style={[s.subtitle, { color: colors.danger }]} selectable>
        {error.message}
      </Text>
      <Pressable onPress={retry} accessibilityRole="button" style={({ pressed }) => [s.button, pressed && s.pressed]}>
        <Text style={s.buttonText}>Try again</Text>
      </Pressable>
      <Pressable onPress={() => router.replace('/events')} accessibilityRole="button" style={({ pressed }) => [s.buttonSecondary, pressed && s.pressed]}>
        <Text style={s.buttonTextSecondary}>Go to your events</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <TripsProvider>
        <Stack screenOptions={headerOptions}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="events" options={{ title: 'Your events' }} />
          <Stack.Screen name="sign-in" options={{ title: 'Sign in', headerBackVisible: false }} />
          <Stack.Screen name="trip/new" options={{ title: 'New Event' }} />
          <Stack.Screen name="join/[code]" options={{ title: 'Join event' }} />
          <Stack.Screen name="trip/[tripId]" options={{ headerShown: false }} />
        </Stack>
        <AuthGate />
        <UpdateBanner />
        <StatusBar style="light" />
      </TripsProvider>
    </AuthProvider>
  );
}
