import { View, Text, FlatList, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { useTrips } from '../context/TripsContext';
import { s } from '../lib/styles';

export default function TripList() {
  const { trips, loaded } = useTrips();

  if (!loaded) {
    return (
      <View style={s.screen}>
        <View style={s.content}>
          <Text style={s.subtitle}>Loading…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <FlatList
        contentContainerStyle={s.content}
        data={trips}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={
          <Link href="/trip/new" asChild>
            <Pressable style={s.button}>
              <Text style={s.buttonText}>+ New Trip</Text>
            </Pressable>
          </Link>
        }
        ListEmptyComponent={<Text style={s.subtitle}>No trips yet — create one to get started.</Text>}
        renderItem={({ item }) => (
          <Link href={`/trip/${item.id}`} asChild>
            <Pressable style={s.card}>
              <Text style={s.title}>{item.name}</Text>
              <Text style={s.subtitle}>
                {item.course.name} · {item.players.length} players · {item.rounds.length} rounds
              </Text>
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}
