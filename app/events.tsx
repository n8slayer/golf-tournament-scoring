import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTrips } from '../context/TripsContext';
import { useAuth } from '../context/AuthContext';
import { PressableLink } from '../components/NavCard';
import { JoinCodeCard } from '../components/JoinCodeCard';
import { NewEventDialog } from '../components/NewEventDialog';
import { eventOf } from '../lib/scoring';
import { s, colors, icon } from '../lib/styles';
import { Trip } from '../types/models';

const FORMAT = { rydercup: 'RYDER CUP', strokeplay: 'STROKE PLAY', stableford: 'STABLEFORD' } as const;
const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' });

const fmtDate = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

function EventCard({ trip }: { trip: Trip }) {
  const event = eventOf(trip);
  const base = `/trip/${trip.id}`;
  const when = fmtDate(event.startDate) || fmtDate(trip.createdAt);
  return (
    <View style={st.card}>
      <PressableLink href={base} style={st.cardTop} label={`Open ${trip.name}`}>
        <Text style={st.cardName} numberOfLines={1}>
          {trip.name}
        </Text>
        <Text style={st.meta}>
          {FORMAT[event.type]}
          {when ? `  ·  ${when}` : ''}
          {`  ·  ${trip.players.length} player${trip.players.length === 1 ? '' : 's'}`}
        </Text>
      </PressableLink>
      <View style={st.cardBottom}>
        <Text style={st.code}>{trip.sync ? `CODE  ${trip.sync.inviteCode.toUpperCase()}` : 'NOT SHARED YET'}</Text>
        <View style={[s.row, { gap: 4 }]}>
          <PressableLink href={`${base}/leaderboard`} style={st.iconBtn} label={`${trip.name} leaderboard`}>
            <Ionicons name="podium-outline" size={icon.sm} color={colors.muted} />
          </PressableLink>
          <PressableLink href={`${base}/more`} style={st.iconBtn} label={`${trip.name} settings`}>
            <Ionicons name="settings-outline" size={icon.sm} color={colors.muted} />
          </PressableLink>
        </View>
      </View>
    </View>
  );
}

// Home: your events, join one with a code, or create one.
export default function MyEvents() {
  const { trips, loaded } = useTrips();
  const { user, signOut } = useAuth();
  const { new: openNew } = useLocalSearchParams<{ new?: string }>();
  const [creating, setCreating] = useState(openNew === '1');
  const sorted = [...trips].sort((a, b) =>
    (b.event?.startDate ?? b.createdAt ?? '').localeCompare(a.event?.startDate ?? a.createdAt ?? ''),
  );

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.content, { gap: 16 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.row, { justifyContent: 'flex-start', marginTop: 12 }]}>
        <View style={[s.iconBadge, { width: 48, height: 48, borderRadius: 24 }]}>
          <Ionicons name="golf" size={24} color={colors.accent} />
        </View>
        <Text style={st.h1} accessibilityRole="header">
          My events
        </Text>
      </View>

      {!loaded && <Text style={s.subtitle}>Loading…</Text>}
      {loaded && sorted.length === 0 && <Text style={s.subtitle}>No events yet. Join one with a code, or create your own.</Text>}
      {sorted.map((t) => (
        <EventCard key={t.id} trip={t} />
      ))}

      <JoinCodeCard title={sorted.length ? 'Join an event' : 'Got a code?'} />
      <Pressable
        onPress={() => setCreating(true)}
        accessibilityRole="button"
        style={({ pressed }) => [s.buttonSecondary, pressed && s.pressed]}
      >
        <Ionicons name="add" size={icon.sm} color={colors.accent} />
        <Text style={s.buttonTextSecondary}>Create new event</Text>
      </Pressable>

      {user && (
        <View style={[s.row, { marginTop: 8 }]}>
          <Text style={[s.subtitle, { fontSize: 13, flex: 1 }]} numberOfLines={1}>
            {user.email}
          </Text>
          <Pressable onPress={signOut} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={[s.linkText, { fontSize: 14, color: colors.muted }]}>Sign out</Text>
          </Pressable>
        </View>
      )}
      <NewEventDialog visible={creating} onClose={() => setCreating(false)} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  h1: { color: colors.text, fontFamily: serif, fontSize: 34 },
  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  cardTop: { padding: 16, gap: 6 },
  cardName: { color: colors.text, fontSize: 19, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingLeft: 16,
    paddingRight: 6,
  },
  code: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
