import { useEffect } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTrips } from '../../../context/TripsContext';
import { s } from '../../../lib/styles';
import { formatHandicap } from '../../../lib/handicap';

export default function Draft() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { getTrip, ensureTeams, assignPlayerToTeam } = useTrips();
  const trip = getTrip(tripId);

  useEffect(() => {
    if (trip && trip.teams.length !== 2) ensureTeams(tripId);
  }, [tripId, trip?.teams.length]);

  if (!trip || trip.teams.length !== 2) return null;

  const [teamA, teamB] = trip.teams;
  const undrafted = trip.players.filter((p) => !p.teamId);
  const rosterFor = (teamId: string) => trip.players.filter((p) => p.teamId === teamId);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.label}>UNDRAFTED</Text>
      {undrafted.length === 0 && <Text style={s.subtitle}>Everyone is drafted.</Text>}
      {undrafted.map((p) => (
        <View key={p.id} style={[s.card, s.row]}>
          <Text style={s.title}>{p.name}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={s.pill} onPress={() => assignPlayerToTeam(tripId, p.id, teamA.id)}>
              <Text style={s.pillText}>{teamA.name}</Text>
            </Pressable>
            <Pressable style={s.pill} onPress={() => assignPlayerToTeam(tripId, p.id, teamB.id)}>
              <Text style={s.pillText}>{teamB.name}</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Text style={[s.label, { marginTop: 16 }]}>{teamA.name.toUpperCase()}</Text>
      {rosterFor(teamA.id).map((p, i) => (
        <Text key={p.id} style={s.subtitle}>
          {i + 1}. {p.name} (HCP {formatHandicap(p.handicapIndex)})
        </Text>
      ))}

      <Text style={[s.label, { marginTop: 16 }]}>{teamB.name.toUpperCase()}</Text>
      {rosterFor(teamB.id).map((p, i) => (
        <Text key={p.id} style={s.subtitle}>
          {i + 1}. {p.name} (HCP {formatHandicap(p.handicapIndex)})
        </Text>
      ))}
    </ScrollView>
  );
}
