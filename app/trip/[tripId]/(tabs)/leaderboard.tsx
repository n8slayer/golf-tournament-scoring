import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTrips } from '../../../../context/TripsContext';
import { MatchBoard, TeamScoreHeader } from '../../../../components/MatchBoard';
import { StandingsBoard } from '../../../../components/StandingsBoard';
import { NavCard } from '../../../../components/NavCard';
import { eventOf, matchPairings } from '../../../../lib/scoring';
import { s } from '../../../../lib/styles';

// Event leaderboard: the match board for Ryder Cup, TV standings otherwise, plus each round's board.
export default function LeaderboardTab() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { getTrip } = useTrips();
  const trip = getTrip(tripId);
  if (!trip) return null;
  const ryder = eventOf(trip).type === 'rydercup';
  const hasMatches = trip.rounds.some((r) => r.matchEnabled && matchPairings(trip, r).length > 0);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      {ryder ? hasMatches ? <MatchBoard trip={trip} /> : <TeamScoreHeader trip={trip} /> : <StandingsBoard trip={trip} />}
      {trip.rounds.length > 0 && (
        <View style={{ gap: 8, marginTop: 8 }}>
          <Text style={s.label}>Round leaderboards</Text>
          {trip.rounds.map((r) => (
            <NavCard key={r.id} href={`/trip/${trip.id}/rounds/${r.id}/leaderboard`} icon="podium" title={r.name} subtitle="Scores, hole by hole, who pays" />
          ))}
        </View>
      )}
    </ScrollView>
  );
}
