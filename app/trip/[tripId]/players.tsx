import { View, Text, Pressable, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTrips } from '../../../context/TripsContext';
import { PlayerForm } from '../../../components/PlayerForm';
import { s, colors } from '../../../lib/styles';
import { courseHandicap, formatHandicap } from '../../../lib/handicap';

export default function Players() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { getTrip, addPlayer, removePlayer, canEdit: canEditTrip } = useTrips();
  const trip = getTrip(tripId);
  if (!trip) return null;
  const canEdit = canEditTrip(trip);

  return (
    <View style={s.screen}>
      <FlatList
        contentContainerStyle={s.content}
        data={trip.players}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={
          canEdit ? (
            <PlayerForm onAdd={(name, index) => addPlayer(tripId, name, index)} />
          ) : (
            <Text style={s.subtitle}>Only organizers can change the roster.</Text>
          )
        }
        ListEmptyComponent={<Text style={s.subtitle}>No players yet.</Text>}
        renderItem={({ item }) => (
          <View style={[s.card, s.row]}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{item.name}</Text>
              <Text style={s.subtitle}>
                Index {formatHandicap(item.handicapIndex)}
                {trip.courses
                  .filter((c) => c.slope)
                  .map((c) => ` · ${trip.courses.length > 1 ? c.name : 'Course'} HCP ${formatHandicap(courseHandicap(item.handicapIndex, c))}`)
                  .join('')}
              </Text>
            </View>
            {canEdit && (
            <Pressable
              onPress={() => removePlayer(tripId, item.id)}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.name}`}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={{ color: colors.danger, fontWeight: '600' }}>Remove</Text>
            </Pressable>
            )}
          </View>
        )}
      />
    </View>
  );
}
