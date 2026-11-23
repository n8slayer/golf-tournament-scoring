import { Stack, useLocalSearchParams, Redirect } from 'expo-router';
import { useTrips } from '../../../context/TripsContext';

export default function TripLayout() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { getTrip, loaded } = useTrips();
  const trip = getTrip(tripId);

  if (loaded && !trip) return <Redirect href="/" />;

  return (
    <Stack screenOptions={{ headerTitleStyle: { fontWeight: '700' } }}>
      <Stack.Screen name="index" options={{ title: trip?.name ?? 'Trip' }} />
      <Stack.Screen name="players" options={{ title: 'Players' }} />
      <Stack.Screen name="course" options={{ title: 'Course Setup' }} />
      <Stack.Screen name="draft" options={{ title: 'Team Draft' }} />
      <Stack.Screen name="settlement" options={{ title: 'Settlement' }} />
      <Stack.Screen name="rounds/new" options={{ title: 'New Round' }} />
    </Stack>
  );
}
