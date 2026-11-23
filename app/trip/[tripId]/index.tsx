import { View, Text, FlatList, Pressable } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { useTrips } from '../../../context/TripsContext';
import { s } from '../../../lib/styles';

export default function TripHome() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { getTrip } = useTrips();
  const trip = getTrip(tripId);
  if (!trip) return null;

  const navLinks = [
    { href: `/trip/${tripId}/players`, label: `Players (${trip.players.length})` },
    { href: `/trip/${tripId}/course`, label: `Course: ${trip.course.name}` },
    { href: `/trip/${tripId}/draft`, label: trip.teams.length ? 'Team Draft' : 'Team Draft (not started)' },
    { href: `/trip/${tripId}/settlement`, label: 'Settlement' },
  ];

  return (
    <View style={s.screen}>
      <FlatList
        contentContainerStyle={s.content}
        data={trip.rounds}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            {navLinks.map((item) => (
              <Link key={item.href} href={item.href} asChild>
                <Pressable style={s.card}>
                  <Text style={s.title}>{item.label}</Text>
                </Pressable>
              </Link>
            ))}
            <Text style={[s.label, { marginTop: 8 }]}>ROUNDS</Text>
          </View>
        }
        ListFooterComponent={
          <Link href={`/trip/${tripId}/rounds/new`} asChild>
            <Pressable style={s.buttonSecondary}>
              <Text style={s.buttonTextSecondary}>+ New Round</Text>
            </Pressable>
          </Link>
        }
        ListEmptyComponent={<Text style={s.subtitle}>No rounds yet.</Text>}
        renderItem={({ item }) => (
          <Link href={`/trip/${tripId}/rounds/${item.id}`} asChild>
            <Pressable style={s.card}>
              <Text style={s.title}>{item.name}</Text>
              <Text style={s.subtitle}>
                {item.holesPlayed === '18' ? '18 holes' : item.holesPlayed} · {item.playerIds.length} players
                {item.skinsEnabled ? ` · Skins $${item.skinValue}` : ''}
                {item.matchEnabled ? ` · Match $${item.matchStake}` : ''}
              </Text>
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}
