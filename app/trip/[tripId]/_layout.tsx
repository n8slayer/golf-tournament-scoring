import { Stack, useLocalSearchParams, Redirect } from 'expo-router';
import { headerOptions } from '../../../lib/styles';
import { useTrips } from '../../../context/TripsContext';

// An event: the tab bar (Home · Score · Leaderboard · More) plus pages opened from it.
export default function TripLayout() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { getTrip, loaded, synced } = useTrips();
  const trip = getTrip(tripId);

  if (loaded && synced && !trip) return <Redirect href="/events" />;

  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="players" options={{ title: 'Players' }} />
      <Stack.Screen name="course" options={{ title: 'Courses' }} />
      <Stack.Screen name="draft" options={{ title: 'Teams & draft' }} />
      <Stack.Screen name="settlement" options={{ title: 'Settle up' }} />
      <Stack.Screen name="people" options={{ title: 'People & roles' }} />
      <Stack.Screen name="rounds/new" options={{ title: 'New round' }} />
      <Stack.Screen name="rounds/[roundId]" options={{ headerShown: false }} />
    </Stack>
  );
}
