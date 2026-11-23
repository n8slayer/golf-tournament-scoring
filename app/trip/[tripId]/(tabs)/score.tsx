import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTrips } from '../../../../context/TripsContext';
import { ScoreEntry } from '../../../../components/ScoreEntry';
import { PressableLink } from '../../../../components/NavCard';
import { leaderboard, courseFor } from '../../../../lib/scoring';
import { holeNumbersFor } from '../../../../lib/holeRanges';
import { s, colors, icon } from '../../../../lib/styles';
import { Trip } from '../../../../types/models';

// The round to score now: one in progress, else the next not started (by date), else the latest.
function currentRound(trip: Trip) {
  const rounds = [...trip.rounds].sort((a, b) => a.date.localeCompare(b.date));
  const state = (r: (typeof rounds)[number]) => {
    const total = holeNumbersFor(r.holesPlayed).length;
    const rows = leaderboard(trip, r);
    if (rows.length && rows.every((x) => x.thru === total)) return 'done';
    return rows.some((x) => x.thru > 0) ? 'live' : 'upcoming';
  };
  return rounds.find((r) => state(r) === 'live') ?? rounds.find((r) => state(r) === 'upcoming') ?? rounds[rounds.length - 1];
}

export default function ScoreTab() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { getTrip, canEdit } = useTrips();
  const trip = getTrip(tripId);
  if (!trip) return null;
  const round = currentRound(trip);

  if (!round) {
    return (
      <View style={[s.screen, s.content, { alignItems: 'center', paddingTop: 48 }]}>
        <Ionicons name="golf-outline" size={48} color={colors.accent} />
        <Text style={s.title}>No round in progress</Text>
        <Text style={[s.subtitle, { textAlign: 'center' }]}>
          {canEdit(trip) ? 'Start a round when your group hits the first tee.' : 'Your organizer will start the round. Check back at the first tee.'}
        </Text>
        {canEdit(trip) && (
          <PressableLink href={`/trip/${tripId}/rounds/new`} style={[s.button, { alignSelf: 'stretch' }]}>
            <Ionicons name="add" size={icon.md} color={colors.onAccent} />
            <Text style={s.buttonText}>Start a round</Text>
          </PressableLink>
        )}
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={[s.subtitle, { flex: 1, color: colors.text }]} numberOfLines={1}>
          {round.name} · {courseFor(trip, round).name}
        </Text>
        <PressableLink href={`/trip/${tripId}/rounds/${round.id}`} style={{ minHeight: 36, justifyContent: 'center' }} label="Round details">
          <Text style={[s.linkText, { fontSize: 14 }]}>Round ›</Text>
        </PressableLink>
      </View>
      <ScoreEntry key={round.id} tripId={trip.id} roundId={round.id} />
    </View>
  );
}
