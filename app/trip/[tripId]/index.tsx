import { View, Text, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTrips } from '../../../context/TripsContext';
import { NavCard, PressableLink } from '../../../components/NavCard';
import { MatchBoard } from '../../../components/MatchBoard';
import { StandingsBoard } from '../../../components/StandingsBoard';
import { eventOf } from '../../../lib/scoring';
import { ShareCard } from '../../../components/ShareCard';
import { HomeHeaderButton } from '../../../components/HomeHeaderButton';
import { s, icon, colors } from '../../../lib/styles';

export default function TripHome() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { getTrip, canEdit, offline, pending } = useTrips();
  const trip = getTrip(tripId);
  if (!trip) return null;
  const organizer = canEdit(trip);
  const needsPlayer = !organizer && trip.sync && !trip.sync.myPlayerId;

  return (
    <View style={s.screen}>
      <HomeHeaderButton />
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

            {(offline || pending > 0) && (
              <Text style={[s.subtitle, { color: offline ? colors.danger : colors.muted }]}>
                {offline
                  ? `Offline. ${pending} change${pending === 1 ? '' : 's'} saved on this phone, will sync when you have signal.`
                  : `Syncing ${pending} change${pending === 1 ? '' : 's'}…`}
              </Text>
            )}
            {!organizer && (
              <Text style={s.subtitle}>You're a player in this event: you can enter scores. Organizers change the setup.</Text>
            )}
            {needsPlayer && trip.sync && (
              <PressableLink href={`/join/${trip.sync.inviteCode}`} style={s.buttonSecondary}>
                <Ionicons name="person" size={icon.sm} color={colors.accent} />
                <Text style={s.buttonTextSecondary}>Tell us which player you are</Text>
              </PressableLink>
            )}

            {eventOf(trip).type === 'rydercup' ? <MatchBoard trip={trip} /> : <StandingsBoard trip={trip} />}

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
            {organizer && (
              <PressableLink href={`/trip/${tripId}/rounds/new`} style={s.button}>
                <Ionicons name="add" size={icon.md} color="#fff" />
                <Text style={s.buttonText}>New round</Text>
              </PressableLink>
            )}

            <ShareCard trip={trip} />

            <Text style={[s.label, { marginTop: 12 }]}>Trip setup</Text>
            <NavCard href={`/trip/${tripId}/players`} icon="people" title="Players" subtitle={`${trip.players.length} in the group`} />
            <NavCard
              href={`/trip/${tripId}/course`}
              icon="map"
              title={trip.courses.length === 1 ? 'Course & scorecard' : 'Courses & scorecards'}
              subtitle={trip.courses.map((c) => c.name).join(', ')}
            />
            {eventOf(trip).type === 'rydercup' && (
              <NavCard
                href={`/trip/${tripId}/draft`}
                icon="shuffle"
                title="Teams & draft"
                subtitle={trip.teams.length === 2 ? trip.teams.map((tm) => tm.name).join(' vs ') : 'Not started'}
              />
            )}
            {trip.sync && (
              <NavCard
                href={`/trip/${tripId}/people`}
                icon="people-circle"
                title="People & roles"
                subtitle={trip.sync.role === 'owner' ? 'You’re the organizer · add co-organizers' : trip.sync.role === 'admin' ? 'You’re a co-organizer' : 'Who’s in this event'}
              />
            )}
            <NavCard href={`/trip/${tripId}/settlement`} icon="cash" title="Settle up" subtitle="Who owes who" />
          </View>
        }
      />
    </View>
  );
}
