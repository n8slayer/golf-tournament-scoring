import { useEffect } from 'react';
import { Tabs, useGlobalSearchParams } from 'expo-router';
import type { ColorValue } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTrips } from '../../../../context/TripsContext';
import { setLastTripId } from '../../../../lib/storage';
import { colors } from '../../../../lib/styles';
import { AllEventsButton } from '../../../../components/HeaderLeft';

type IconName = keyof typeof Ionicons.glyphMap;
const icon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} size={size} color={color as string} />;

// Bottom tab bar inside an event.
export default function EventTabs() {
  const { tripId } = useGlobalSearchParams<{ tripId: string }>();
  const { getTrip } = useTrips();
  const trip = getTrip(tripId);

  // Reopen this event next time the app starts.
  useEffect(() => {
    if (tripId) setLastTripId(tripId);
  }, [tripId]);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: colors.primary, borderTopColor: colors.border, height: 68, paddingTop: 6, paddingBottom: 12 },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: trip?.name ?? 'Event', headerLeft: () => <AllEventsButton />, tabBarLabel: 'Home', tabBarIcon: icon('home') }}
      />
      <Tabs.Screen name="score" options={{ title: 'Score', tabBarIcon: icon('create') }} />
      <Tabs.Screen name="leaderboard" options={{ title: 'Leaderboard', tabBarIcon: icon('podium') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('ellipsis-horizontal') }} />
    </Tabs>
  );
}
