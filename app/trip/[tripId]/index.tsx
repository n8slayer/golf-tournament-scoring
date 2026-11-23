import { View, Text, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTrips } from '../../../context/TripsContext';
import { NavCard, PressableLink } from '../../../components/NavCard';
import { s, icon } from '../../../lib/styles';

export default function TripHome() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { getTrip } = useTrips();
  const trip = getTrip(tripId);
  if (!trip) return null;

  return (
    <View style={s.screen}>
      <FlatList
        contentContainerStyle={s.content}
        data={trip.rounds}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <Text style={s.h1} accessibilityRole="header">{trip.name}</Text>
            <Text style={s.subtitle}>
              {trip.courses.length === 1 ? trip.courses[0].name : `${trip.courses.length} courses`} · {trip.players.length} players
            </Text>

            <Text style={[s.label, { marginTop: 8 }]}>Rounds</Text>
          </View>
        }
        ListEmptyComponent={<Text style={s.subtitle}>No rounds yet. Start one when you hit the first tee.</Text>}
        renderItem={({ item }) => (
          <NavCard
            href={`/trip/${tripId}/rounds/${item.id}`}
            icon="golf"
            title={item.name}
            subtitle={[
              trip.courses.find((c) => c.id === item.courseId)?.name,
              item.holesPlayed === '18' ? '18 holes' : item.holesPlayed === 'front9' ? 'Front 9' : 'Back 9',
              `${item.playerIds.length} players`,
              item.skinsEnabled && `Skins $${item.skinValue}`,
              item.matchEnabled && `Match $${item.matchStake}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          />
        )}
        ListFooterComponent={
          <View style={{ gap: 12 }}>
            <PressableLink href={`/trip/${tripId}/rounds/new`} style={s.button}>
                <Ionicons name="add" size={icon.md} color="#fff" />
                <Text style={s.buttonText}>New round</Text>
              </PressableLink>

            <Text style={[s.label, { marginTop: 12 }]}>Trip setup</Text>
            <NavCard href={`/trip/${tripId}/players`} icon="people" title="Players" subtitle={`${trip.players.length} in the group`} />
            <NavCard
              href={`/trip/${tripId}/course`}
              icon="map"
              title={trip.courses.length === 1 ? 'Course & scorecard' : 'Courses & scorecards'}
              subtitle={trip.courses.map((c) => c.name).join(', ')}
            />
            <NavCard
              href={`/trip/${tripId}/draft`}
              icon="shuffle"
              title="Team draft"
              subtitle={trip.teams.length ? 'Teams set' : 'Not started'}
            />
            <NavCard href={`/trip/${tripId}/settlement`} icon="cash" title="Settle up" subtitle="Who owes who" />
          </View>
        }
      />
    </View>
  );
}
