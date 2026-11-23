import { Stack } from 'expo-router';
import { TripsProvider } from '../context/TripsContext';

export default function RootLayout() {
  return (
    <TripsProvider>
      <Stack screenOptions={{ headerTitleStyle: { fontWeight: '700' } }}>
        <Stack.Screen name="index" options={{ title: 'Golf Trips' }} />
        <Stack.Screen name="trip/new" options={{ title: 'New Trip' }} />
      </Stack>
    </TripsProvider>
  );
}
