import { View, Text, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTrips } from '../../../../../context/TripsContext';
import { matchPairings, matchStatus } from '../../../../../lib/scoring';
import { s } from '../../../../../lib/styles';

export default function MatchPlay() {
  const { tripId, roundId } = useLocalSearchParams<{ tripId: string; roundId: string }>();
  const { getTrip } = useTrips();
  const trip = getTrip(tripId);
  const round = trip?.rounds.find((r) => r.id === roundId);
  if (!trip || !round) return null;

  const pairings = matchPairings(trip, round);
  const nameOf = (id: string) => trip.players.find((p) => p.id === id)?.name ?? 'Unknown';

  return (
    <View style={s.screen}>
      <FlatList
        contentContainerStyle={s.content}
        data={pairings}
        keyExtractor={(p) => `${p.playerAId}-${p.playerBId}`}
        ListHeaderComponent={
          trip.teams.length !== 2 ? (
            <Text style={s.subtitle}>Run the Team Draft first to create singles pairings.</Text>
          ) : undefined
        }
        renderItem={({ item }) => {
          const status = matchStatus(trip, round, item);
          return (
            <View style={s.card}>
              <Text style={s.title}>
                {nameOf(item.playerAId)} vs {nameOf(item.playerBId)}
              </Text>
              <Text style={s.subtitle}>
                {status.holesUp === 0
                  ? status.resultLabel
                  : `${nameOf(status.holesUp > 0 ? item.playerAId : item.playerBId)} ${status.resultLabel}`}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}
