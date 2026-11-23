import { Stack, useLocalSearchParams, Redirect } from 'expo-router';
import { useTrips } from '../../../../../context/TripsContext';

export default function RoundLayout() {
  const { tripId, roundId } = useLocalSearchParams<{ tripId: string; roundId: string }>();
  const { getTrip, loaded } = useTrips();
  const trip = getTrip(tripId);
  const round = trip?.rounds.find((r) => r.id === roundId);

  if (loaded && (!trip || !round)) return <Redirect href={`/trip/${tripId}`} />;

  return (
    <Stack screenOptions={{ headerTitleStyle: { fontWeight: '700' } }}>
      <Stack.Screen name="index" options={{ title: round?.name ?? 'Round' }} />
      <Stack.Screen name="score" options={{ title: 'Score' }} />
      <Stack.Screen name="leaderboard" options={{ title: 'Leaderboard' }} />
      <Stack.Screen name="skins" options={{ title: 'Skins' }} />
      <Stack.Screen name="match" options={{ title: 'Match Play' }} />
    </Stack>
  );
}
