import { View, Text, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTrips } from '../../../../../context/TripsContext';
import { skinsForRound } from '../../../../../lib/scoring';
import { s } from '../../../../../lib/styles';

export default function Skins() {
  const { tripId, roundId } = useLocalSearchParams<{ tripId: string; roundId: string }>();
  const { getTrip } = useTrips();
  const trip = getTrip(tripId);
  const round = trip?.rounds.find((r) => r.id === roundId);
  if (!trip || !round) return null;

  const results = skinsForRound(trip, round);
  const nameOf = (id: string | null) => (id ? trip.players.find((p) => p.id === id)?.name ?? 'Unknown' : '—');

  return (
    <View style={s.screen}>
      <FlatList
        contentContainerStyle={s.content}
        data={results}
        keyExtractor={(r) => String(r.holeNumber)}
        ListHeaderComponent={<Text style={s.subtitle}>Strictly lowest net wins the hole. Ties carry no skin.</Text>}
        ListEmptyComponent={<Text style={s.subtitle}>No holes fully scored yet.</Text>}
        renderItem={({ item }) => (
          <View style={[s.card, s.row]}>
            <Text style={s.title}>Hole {item.holeNumber}</Text>
            <Text style={s.subtitle}>
              {item.winnerPlayerId ? `${nameOf(item.winnerPlayerId)} · $${item.value}` : 'Tied — no winner'}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
