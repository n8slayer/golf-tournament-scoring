import { useEffect } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTrips } from '../../../context/TripsContext';
import { s, colors } from '../../../lib/styles';
import { formatHandicap } from '../../../lib/handicap';

export default function Draft() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { getTrip, ensureTeams, assignPlayerToTeam, renameTeam, canEdit: canEditTrip } = useTrips();
  const trip = getTrip(tripId);

  useEffect(() => {
    if (trip && trip.teams.length !== 2) ensureTeams(tripId);
  }, [tripId, trip?.teams.length]);

  if (!trip) return null;
  const canEdit = canEditTrip(trip);
  if (trip.teams.length !== 2) {
    return canEdit ? null : (
      <View style={[s.screen, s.content]}>
        <Text style={s.subtitle}>The organizer hasn't set up teams yet.</Text>
      </View>
    );
  }

  const [teamA, teamB] = trip.teams;
  const undrafted = trip.players.filter((p) => !p.teamId);
  const rosterFor = (teamId: string) => trip.players.filter((p) => p.teamId === teamId);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      {canEdit && <Text style={s.label}>UNDRAFTED</Text>}
      {canEdit && undrafted.length === 0 && <Text style={s.subtitle}>Everyone is drafted.</Text>}
      {canEdit && undrafted.map((p) => (
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

      {[
        { team: teamA, color: colors.teamA },
        { team: teamB, color: colors.teamB },
      ].map(({ team, color }) => (
        <View key={team.id} style={{ gap: 6, marginTop: 16 }}>
          <Text style={s.label}>Team name</Text>
          <TextInput
            style={[s.input, { borderColor: color, borderWidth: 2, fontWeight: '700' }]}
            value={team.name}
            onChangeText={(v) => renameTeam(tripId, team.id, v)}
            editable={canEdit}
            placeholder="Team name"
            accessibilityLabel={`Name for ${team.name || 'team'}`}
            maxLength={24}
          />
          {rosterFor(team.id).map((p, i) => (
            <Text key={p.id} style={s.subtitle}>
              {i + 1}. {p.name} (HCP {formatHandicap(p.handicapIndex)})
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
