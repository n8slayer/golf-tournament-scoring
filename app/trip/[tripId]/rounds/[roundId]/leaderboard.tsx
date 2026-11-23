import { View, Text, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTrips } from '../../../../../context/TripsContext';
import { leaderboard } from '../../../../../lib/scoring';
import { s } from '../../../../../lib/styles';

export default function Leaderboard() {
  const { tripId, roundId } = useLocalSearchParams<{ tripId: string; roundId: string }>();
  const { getTrip } = useTrips();
  const trip = getTrip(tripId);
  const round = trip?.rounds.find((r) => r.id === roundId);
  if (!trip || !round) return null;

  const rows = leaderboard(trip, round);

  return (
    <View style={s.screen}>
      <FlatList
        contentContainerStyle={s.content}
        data={rows}
        keyExtractor={(r) => r.playerId}
        ListHeaderComponent={<Text style={s.subtitle}>Sorted by net score. "Thru" = holes entered.</Text>}
        renderItem={({ item, index }) => (
          <View style={[s.card, s.row]}>
            <Text style={s.title}>
              {index + 1}. {item.playerName}
            </Text>
            <Text style={s.subtitle}>
              Thru {item.thru} · Gross {item.gross} · Net {item.net}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
