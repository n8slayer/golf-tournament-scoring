import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTrips } from '../../../../../context/TripsContext';
import { holeNumbersFor } from '../../../../../lib/holeRanges';
import { courseFor } from '../../../../../lib/scoring';
import { NavCard, PressableLink } from '../../../../../components/NavCard';
import { s, icon } from '../../../../../lib/styles';

export default function RoundHome() {
  const { tripId, roundId } = useLocalSearchParams<{ tripId: string; roundId: string }>();
  const { getTrip } = useTrips();
  const trip = getTrip(tripId);
  const round = trip?.rounds.find((r) => r.id === roundId);
  if (!trip || !round) return null;

  const base = `/trip/${tripId}/rounds/${roundId}`;
  const holes = holeNumbersFor(round.holesPlayed);
  const entered = new Set(trip.scores.filter((sc) => sc.roundId === roundId).map((sc) => sc.holeNumber)).size;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.h1} accessibilityRole="header">{round.name}</Text>
      <Text style={s.subtitle}>
        {courseFor(trip, round).name} · {entered}/{holes.length} holes scored
      </Text>

      <PressableLink href={`${base}/score`} style={[s.button, { minHeight: 56 }]}>
          <Ionicons name="create-outline" size={icon.md} color="#fff" />
          <Text style={s.buttonText}>{entered ? 'Keep scoring' : 'Start scoring'}</Text>
        </PressableLink>

      <Text style={[s.label, { marginTop: 8 }]}>Games</Text>
      <View style={{ gap: 12 }}>
        <NavCard href={`${base}/leaderboard`} icon="podium" title="Leaderboard" subtitle="Net scores, live" />
        {round.skinsEnabled && <NavCard href={`${base}/skins`} icon="cash-outline" title="Skins" subtitle={`$${round.skinValue} per skin`} />}
        {round.matchEnabled && <NavCard href={`${base}/match`} icon="git-compare" title="Match play" subtitle={`$${round.matchStake} per match`} />}
      </View>
    </ScrollView>
  );
}
