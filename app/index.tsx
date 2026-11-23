import { View, Text, FlatList, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTrips } from '../context/TripsContext';
import { useAuth } from '../context/AuthContext';
import { NavCard, PressableLink } from '../components/NavCard';
import { s, colors, icon } from '../lib/styles';

export default function TripList() {
  const { trips, loaded } = useTrips();
  const { user, displayName, signOut } = useAuth();

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
            {user && (
              <View style={[s.card, s.row, { paddingVertical: 10 }]}>
                <Ionicons name="person-circle" size={icon.lg} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.title, { fontSize: 16 }]}>{displayName ?? 'Signed in'}</Text>
                  <Text style={s.subtitle} numberOfLines={1}>
                    {user.email}
                  </Text>
                </View>
                <Pressable onPress={signOut} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
                  <Text style={s.linkText}>Sign out</Text>
                </Pressable>
              </View>
            )}
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
