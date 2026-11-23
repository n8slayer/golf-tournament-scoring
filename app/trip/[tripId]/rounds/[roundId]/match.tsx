import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTrips } from '../../../../../context/TripsContext';
import { matchPairings } from '../../../../../lib/scoring';
import { MatchCard, SessionHeader } from '../../../../../components/MatchBoard';
import { MatchScorecard } from '../../../../../components/MatchScorecard';
import { PressableLink } from '../../../../../components/NavCard';
import { s } from '../../../../../lib/styles';

// One round's matches, each with its match scorecard. ?m=<index> shows a single match.
export default function MatchPlay() {
  const { tripId, roundId, m } = useLocalSearchParams<{ tripId: string; roundId: string; m?: string }>();
  const { getTrip } = useTrips();
  const trip = getTrip(tripId);
  const round = trip?.rounds.find((r) => r.id === roundId);
  if (!trip || !round) return null;

  const pairings = matchPairings(trip, round);
  const only = m !== undefined && pairings[Number(m)] ? Number(m) : null;
  const shown = pairings.map((p, i) => ({ p, i })).filter(({ i }) => only === null || i === only);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      {trip.teams.length !== 2 ? (
        <Text style={s.subtitle}>Run the Team Draft first to create pairings.</Text>
      ) : (
        <View style={{ gap: 12 }}>
          <SessionHeader trip={trip} round={round} />
          {pairings.length === 0 && <Text style={s.subtitle}>No matches in this round.</Text>}
          {shown.map(({ p, i }) => (
            <View key={i} style={{ gap: 8 }}>
              <Text style={s.label}>Match {i + 1}</Text>
              <MatchCard trip={trip} round={round} pairing={p} />
              <MatchScorecard trip={trip} round={round} pairing={p} />
            </View>
          ))}
          {only !== null && pairings.length > 1 && (
            <PressableLink href={`/trip/${tripId}/rounds/${roundId}/match`} style={s.buttonSecondary}>
              <Text style={s.buttonTextSecondary}>All {pairings.length} matches in this round</Text>
            </PressableLink>
          )}
        </View>
      )}
    </ScrollView>
  );
}
