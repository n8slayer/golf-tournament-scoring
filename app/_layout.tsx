import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, router, usePathname } from 'expo-router';
import { headerOptions, s, colors } from '../lib/styles';
import { TripsProvider } from '../context/TripsContext';
import { AuthProvider, useAuth } from '../context/AuthContext';

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

export default function RootLayout() {
  return (
    <AuthProvider>
      <TripsProvider>
        <Stack screenOptions={headerOptions}>
          <Stack.Screen name="index" options={{ title: 'Golf Trips' }} />
          <Stack.Screen name="sign-in" options={{ title: 'Sign in', headerBackVisible: false }} />
          <Stack.Screen name="trip/new" options={{ title: 'New Event' }} />
          <Stack.Screen name="join/[code]" options={{ title: 'Join event' }} />
          <Stack.Screen name="trip/[tripId]" options={{ headerShown: false }} />
        </Stack>
        <AuthGate />
      </TripsProvider>
    </AuthProvider>
  );
}
