import { useEffect, useState } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../lib/styles';

// Web only: each Vercel build stamps its commit into the JS (EXPO_PUBLIC_BUILD_ID) and into
// /version.json. If the server's version differs from the one running in this tab, offer a reload.
// Live scores don't need this (they stream from the database); this is for app updates.
const BUILD_ID = process.env.EXPO_PUBLIC_BUILD_ID;
const CHECK_EVERY_MS = 2 * 60 * 1000;

export function UpdateBanner() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || !BUILD_ID || typeof window === 'undefined') return;
    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState === 'hidden') return;
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const { id } = await res.json();
        if (id && id !== BUILD_ID) setStale(true);
      } catch {
        // offline or blocked: try again later
      }
    };
    const timer = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    window.addEventListener('online', check);
    check();
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
      window.removeEventListener('online', check);
    };
  }, []);

  if (!stale) return null;
  return (
    <Pressable
      onPress={() => window.location.reload()}
      accessibilityRole="button"
      accessibilityLabel="A new version of the app is available. Tap to update."
      style={({ pressed }) => [
        {
          position: 'absolute',
          top: 8,
          left: 12,
          right: 12,
          maxWidth: 520,
          alignSelf: 'center',
          marginHorizontal: 'auto',
          zIndex: 1000,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          minHeight: 44,
          paddingHorizontal: 14,
          borderRadius: 12,
          backgroundColor: colors.accent,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Ionicons name="refresh" size={18} color={colors.onAccent} />
      <Text style={{ color: colors.onAccent, fontWeight: '800', fontSize: 15 }}>New version available · Tap to update</Text>
    </Pressable>
  );
}
