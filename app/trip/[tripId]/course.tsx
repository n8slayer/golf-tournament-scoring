import { View, Text, TextInput, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTrips } from '../../../context/TripsContext';
import { s } from '../../../lib/styles';

export default function CourseSetup() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { getTrip, updateHole } = useTrips();
  const trip = getTrip(tripId);
  if (!trip) return null;

  return (
    <View style={s.screen}>
      <FlatList
        contentContainerStyle={s.content}
        data={trip.course.holes}
        keyExtractor={(h) => String(h.number)}
        ListHeaderComponent={
          <Text style={s.subtitle}>
            Default 18 holes, par 4, stroke index 1–18. Edit par and stroke index (1 = hardest) to match your
            course's scorecard.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={[s.card, s.row]}>
            <Text style={[s.title, { width: 60 }]}>#{item.number}</Text>
            <View style={{ alignItems: 'center' }}>
              <Text style={s.label}>Par</Text>
              <TextInput
                style={[s.input, { width: 60, textAlign: 'center' }]}
                value={String(item.par)}
                onChangeText={(v) => {
                  const par = parseInt(v, 10);
                  if (!Number.isNaN(par)) updateHole(tripId, item.number, { par });
                }}
                keyboardType="number-pad"
              />
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={s.label}>Stroke Idx</Text>
              <TextInput
                style={[s.input, { width: 60, textAlign: 'center' }]}
                value={String(item.strokeIndex)}
                onChangeText={(v) => {
                  const strokeIndex = parseInt(v, 10);
                  if (!Number.isNaN(strokeIndex)) updateHole(tripId, item.number, { strokeIndex });
                }}
                keyboardType="number-pad"
              />
            </View>
          </View>
        )}
      />
    </View>
  );
}
