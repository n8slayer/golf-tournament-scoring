import { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTrips } from '../context/TripsContext';
import { useAuth } from '../context/AuthContext';
import { PressableLink } from '../components/NavCard';
import { JoinCodeCard } from '../components/JoinCodeCard';
import { getLastTripId } from '../lib/storage';
import { s, colors, icon } from '../lib/styles';

// Demo event anyone can join to look around (Ryder Cup format).
const DEMO_CODE = 'ad4b50adff';

// Landing: straight into your last event; first-timers get a welcome screen.
export default function Landing() {
  const { trips, loaded, synced } = useTrips();
  const { displayName } = useAuth();
  const [lastId, setLastId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    getLastTripId().then(setLastId);
  }, []);

  if (!loaded || !synced || lastId === undefined) {
    return (
      <View style={[s.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (trips.length) {
    const target =
      trips.find((t) => t.id === lastId) ?? [...trips].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))[0];
    return <Redirect href={`/trip/${target.id}`} />;
  }

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[s.content, { paddingTop: 40, gap: 16 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ alignItems: 'center', gap: 8 }}>
        <View style={[s.iconBadge, { width: 72, height: 72, borderRadius: 36 }]}>
          <Ionicons name="golf" size={36} color={colors.accent} />
        </View>
        <Text style={st.kicker}>GOLF TRIP</Text>
        <Text style={[s.h1, { textAlign: 'center' }]} accessibilityRole="header">
          {displayName ? `Welcome, ${displayName}` : 'Welcome'}
        </Text>
        <Text style={[s.subtitle, { textAlign: 'center' }]}>
          Live scores, team matches, skins and who owes who, for your whole group.
        </Text>
      </View>

      <JoinCodeCard />

      <View style={[s.card, { gap: 10 }]}>
        <Text style={s.title}>Running the trip?</Text>
        <Text style={s.subtitle}>Set up the format, courses, players and bets. Then invite everyone with one code.</Text>
        <PressableLink href="/trip/new" style={s.buttonSecondary}>
          <Ionicons name="add" size={icon.sm} color={colors.accent} />
          <Text style={s.buttonTextSecondary}>Create an event</Text>
        </PressableLink>
      </View>

      <PressableLink
        href={`/join/${DEMO_CODE}`}
        style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        label="Try a demo event"
      >
        <Text style={s.linkText}>Just looking? Try a demo event ›</Text>
      </PressableLink>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
});
