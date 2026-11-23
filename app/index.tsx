import { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTrips } from '../context/TripsContext';
import { useAuth } from '../context/AuthContext';
import { PressableLink } from '../components/NavCard';
import { JoinCodeCard } from '../components/JoinCodeCard';
import { CourseHero } from '../components/CourseHero';
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
    const target = trips.find((t) => t.id === lastId) ?? [...trips].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))[0];
    return <Redirect href={`/trip/${target.id}`} />;
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingTop: 24, gap: 16 }]} keyboardShouldPersistTaps="handled">
      <CourseHero height={300}>
        <Text style={st.kicker}>{displayName ? `WELCOME, ${displayName.toUpperCase()}` : 'GOLF TRIP SCORING'}</Text>
        <Text style={[s.h1, st.onPhoto]} accessibilityRole="header">
          Live scoring for your golf trip
        </Text>
        <Text style={[s.subtitle, st.onPhoto, { color: colors.text }]}>
          Ryder Cup matches, stroke play or Stableford. Net scores, skins and who owes who, on every phone as you play.
        </Text>
      </CourseHero>

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
  onPhoto: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } },
});
