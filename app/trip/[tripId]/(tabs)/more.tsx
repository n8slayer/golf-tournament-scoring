import { View, Text, ScrollView, Pressable } from 'react-native';
import { useGlobalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTrips } from '../../../../context/TripsContext';
import { useAuth } from '../../../../context/AuthContext';
import { NavCard } from '../../../../components/NavCard';
import { ShareCard } from '../../../../components/ShareCard';
import { PartyModeSwitch } from '../../../../components/PartyAlert';
import { eventOf } from '../../../../lib/scoring';
import { isTeamEvent } from '../../../../lib/games';
import { s, colors, icon } from '../../../../lib/styles';

// Everything that isn't Home / Score / Leaderboard: invite, setup, switching events, account.
export default function MoreTab() {
  const { tripId } = useGlobalSearchParams<{ tripId: string }>();
  const { getTrip, canEdit, updateEvent } = useTrips();
  const { user, displayName, signOut } = useAuth();
  const trip = getTrip(tripId);
  if (!trip) return null;
  const editor = canEdit(trip);
  const base = `/trip/${trip.id}`;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      {user && (
        <View style={[s.card, s.row]}>
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
      <ShareCard trip={trip} />

      <Text style={[s.label, { marginTop: 8 }]}>This event</Text>
      {trip.sync && (
        <NavCard
          href={`${base}/people`}
          icon="people-circle"
          title="People & roles"
          subtitle={
            trip.sync.role === 'owner'
              ? 'You’re the organizer · add co-organizers'
              : trip.sync.role === 'admin'
                ? 'You’re a co-organizer'
                : 'Who’s in this event'
          }
        />
      )}
      <NavCard
        href={`${base}/players`}
        icon="people"
        title="Players"
        subtitle={editor ? 'Add players and handicaps' : `${trip.players.length} players`}
      />
      <NavCard
        href={`${base}/course`}
        icon="map"
        title={trip.courses.length === 1 ? 'Course & scorecard' : 'Courses & scorecards'}
        subtitle={trip.courses.map((c) => c.name).join(', ')}
      />
      {isTeamEvent(trip) && (
        <NavCard
          href={`${base}/draft`}
          icon="shuffle"
          title="Teams & draft"
          subtitle={trip.teams.length === 2 ? trip.teams.map((t) => t.name).join(' vs ') : 'Not started'}
        />
      )}
      <PartyModeSwitch value={!!eventOf(trip).partyMode} onChange={editor ? (v) => updateEvent(trip.id, { partyMode: v }) : undefined} />
      <NavCard href={`${base}/settlement`} icon="cash" title="Settle up" subtitle="Who owes who across all rounds" />

      <Text style={[s.label, { marginTop: 8 }]}>App</Text>
      <NavCard href="/events" icon="swap-horizontal" title="All events" subtitle="Switch event, join or create another" />
    </ScrollView>
  );
}
