import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTrips } from '../../../../../context/TripsContext';
import { matchPairings } from '../../../../../lib/scoring';
import { MatchCard, SessionHeader } from '../../../../../components/MatchBoard';
import { s } from '../../../../../lib/styles';

export default function MatchPlay() {
  const { tripId, roundId } = useLocalSearchParams<{ tripId: string; roundId: string }>();
  const { getTrip } = useTrips();
  const trip = getTrip(tripId);
  const round = trip?.rounds.find((r) => r.id === roundId);
  if (!trip || !round) return null;

  const pairings = matchPairings(trip, round);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      {trip.teams.length !== 2 ? (
        <Text style={s.subtitle}>Run the Team Draft first to create pairings.</Text>
      ) : (
        <View style={{ gap: 8 }}>
          <SessionHeader trip={trip} round={round} />
          {pairings.length === 0 && <Text style={s.subtitle}>No matches in this round.</Text>}
          {pairings.map((pairing, i) => (
            <MatchCard key={i} trip={trip} round={round} pairing={pairing} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}
