import { View, Text, FlatList } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTrips } from '../context/TripsContext';
import { NavCard, PressableLink } from '../components/NavCard';
import { s, colors, icon } from '../lib/styles';

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
          <View style={{ gap: 12, marginBottom: 4 }}>
            <Text style={s.h1} accessibilityRole="header">Your trips</Text>
            <Text style={s.subtitle}>Scores, skins, matches and who owes who, all in one place.</Text>
            <PressableLink href="/trip/new" style={s.button}>
                <Ionicons name="add" size={icon.md} color="#fff" />
                <Text style={s.buttonText}>New trip</Text>
              </PressableLink>
          </View>
        }
        ListEmptyComponent={
          <View style={[s.card, { alignItems: 'center', paddingVertical: 32 }]}>
            <Ionicons name="golf-outline" size={40} color={colors.accent} />
            <Text style={s.title}>No trips yet</Text>
            <Text style={[s.subtitle, { textAlign: 'center' }]}>Create a trip, add your group and pick the course.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <NavCard
            href={`/trip/${item.id}`}
            icon="flag"
            title={item.name}
            subtitle={`${item.courses.map((c) => c.name).join(', ')} · ${item.players.length} players · ${item.rounds.length} rounds`}
          />
        )}
      />
    </View>
  );
}
