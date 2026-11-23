import { Pressable } from 'react-native';
import { Stack, router, useCanGoBack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

// Screens reached straight from a link (invite / demo) have no screen to go back to:
// show a home button in the header instead, so nobody gets stuck.
export function HomeHeaderButton() {
  const canGoBack = useCanGoBack();
  if (canGoBack) return null;
  return (
    <Stack.Screen
      options={{
        headerLeft: () => (
          <Pressable
            onPress={() => router.replace('/')}
            accessibilityRole="button"
            accessibilityLabel="Home: all trips"
            hitSlop={8}
            style={({ pressed }) => [{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 4 }, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="home" size={22} color="#fff" />
          </Pressable>
        ),
      }}
    />
  );
}
