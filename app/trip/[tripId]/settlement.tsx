import { View, Text, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTrips } from '../../../context/TripsContext';
import { computeSettlement } from '../../../lib/scoring';
import { s, colors } from '../../../lib/styles';

export default function Settlement() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { getTrip } = useTrips();
  const trip = getTrip(tripId);
  if (!trip) return null;

  const lines = computeSettlement(trip);
  const nameOf = (id: string) => trip.players.find((p) => p.id === id)?.name ?? 'Unknown';

  return (
    <View style={s.screen}>
      <FlatList
        contentContainerStyle={s.content}
        data={lines}
        keyExtractor={(l, i) => `${l.fromPlayerId}-${l.toPlayerId}-${i}`}
        ListHeaderComponent={
          <Text style={s.subtitle}>Net skins winnings and decided match-play stakes across all rounds.</Text>
        }
        ListEmptyComponent={<Text style={s.subtitle}>Nothing to settle yet — enter some scores first.</Text>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <Text style={s.title}>
              {nameOf(item.fromPlayerId)} → {nameOf(item.toPlayerId)}
            </Text>
            <Text style={[s.subtitle, { fontSize: 18, fontWeight: '700', color: colors.accent }]}>
              ${item.amount.toFixed(2)}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
