import { Pressable } from 'react-native';
import { router, useCanGoBack, usePathname } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../lib/styles';

// Top-left button on every stacked screen: back when there's somewhere to go back to,
// otherwise home (the event's home inside an event, else the start page), so nobody gets stuck,
// e.g. a page opened straight from a link, or the first screen of a round.
export function HeaderLeft() {
  const canGoBack = useCanGoBack();
  const pathname = usePathname();
  const eventHome = pathname.match(/^\/trip\/[^/]+/)?.[0];
  const home = eventHome && eventHome !== '/trip/new' && pathname !== eventHome ? eventHome : '/';
  return (
    <Pressable
      onPress={() => (canGoBack ? router.back() : router.replace(home as never))}
      accessibilityRole="button"
      accessibilityLabel={canGoBack ? 'Back' : home === '/' ? 'Home' : 'Event home'}
      hitSlop={8}
      style={({ pressed }) => [
        { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Ionicons name={canGoBack ? 'chevron-back' : 'home'} size={canGoBack ? 26 : 22} color={colors.text} />
    </Pressable>
  );
}

// Event Home tab: switch to another event.
export function AllEventsButton() {
  return (
    <Pressable
      onPress={() => router.push('/events')}
      accessibilityRole="button"
      accessibilityLabel="All events"
      hitSlop={8}
      style={({ pressed }) => [
        { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Ionicons name="albums-outline" size={22} color={colors.text} />
    </Pressable>
  );
}
