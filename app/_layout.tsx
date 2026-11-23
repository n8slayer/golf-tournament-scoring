import { Stack } from 'expo-router';
import { headerOptions } from '../lib/styles';
import { TripsProvider } from '../context/TripsContext';

export default function RootLayout() {
  return (
    <TripsProvider>
      <Stack screenOptions={headerOptions}>
        <Stack.Screen name="index" options={{ title: 'Golf Trips' }} />
        <Stack.Screen name="trip/new" options={{ title: 'New Trip' }} />
        <Stack.Screen name="trip/[tripId]" options={{ headerShown: false }} />
      </Stack>
    </TripsProvider>
  );
}
