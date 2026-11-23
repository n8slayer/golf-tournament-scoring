import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTrips } from '../../../context/TripsContext';
import { listMembers, setMemberRole, removeMember, Member } from '../../../lib/sync';
import { ShareCard } from '../../../components/ShareCard';
import { s, colors, icon } from '../../../lib/styles';

const ROLE_LABEL = { owner: 'Organizer', admin: 'Co-organizer', player: 'Player' } as const;

// Who's in the event. The organizer can make people co-organizers or remove them.
export default function People() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { getTrip, isOwner, userId, refresh } = useTrips();
  const trip = getTrip(tripId);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const load = () =>
    listMembers(tripId)
      .then(setMembers)
      .catch((e) => setError(e?.message ?? 'Could not load people'));
  useEffect(() => {
    load();
  }, [tripId]);

  if (!trip) return null;
  if (!trip.sync) {
    return (
      <View style={[s.screen, s.content]}>
        <Text style={s.subtitle}>This event isn't shared yet. Once it syncs, people who join with the invite link appear here.</Text>
      </View>
    );
  }
  const owner = isOwner(trip);
  const playerName = (id: string | null) => trip.players.find((p) => p.id === id)?.name;

  const act = async (userKey: string, fn: () => Promise<void>) => {
    setBusy(userKey);
    setError('');
    try {
      await fn();
      await load();
      await refresh();
    } catch (e) {
      setError((e as Error)?.message ?? 'Something went wrong');
    } finally {
      setBusy(null);
      setConfirmRemove(null);
    }
  };

  const order = { owner: 0, admin: 1, player: 2 };
  const sorted = [...(members ?? [])].sort((a, b) => order[a.role] - order[b.role]);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <ShareCard trip={trip} />
      <Text style={[s.label, { marginTop: 8 }]}>In this event ({members?.length ?? '…'})</Text>
      <Text style={s.subtitle}>
        {owner
          ? 'Co-organizers can change the setup, players, courses, teams and rounds. Only you can change roles or remove people.'
          : 'Organizers and co-organizers can change the setup. Everyone can enter scores.'}
      </Text>
      {!members && !error && <ActivityIndicator color={colors.accent} />}
      {sorted.map((m) => {
        const me = m.user_id === userId;
        const linked = playerName(m.player_id);
        return (
          <View key={m.user_id} style={[s.card, { gap: 8 }]}>
            <View style={[s.row, { justifyContent: 'flex-start' }]}>
              <View style={[s.iconBadge, m.role !== 'player' && { backgroundColor: colors.accent }]}>
                <Ionicons
                  name={m.role === 'owner' ? 'star' : m.role === 'admin' ? 'shield-checkmark' : 'person'}
                  size={icon.md}
                  color={m.role !== 'player' ? colors.onAccent : colors.accent}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>
                  {m.display_name ?? 'Unnamed'}
                  {me ? ' (you)' : ''}
                </Text>
                <Text style={s.subtitle}>
                  {ROLE_LABEL[m.role]}
                  {linked ? ` · plays as ${linked}` : ' · not linked to a player'}
                </Text>
              </View>
            </View>
            {owner && m.role !== 'owner' && (
              <View style={s.pillRow}>
                <Pressable
                  disabled={!!busy}
                  onPress={() => act(m.user_id, () => setMemberRole(tripId, m.user_id, m.role === 'admin' ? 'player' : 'admin'))}
                  accessibilityRole="button"
                  style={({ pressed }) => [s.pill, pressed && s.pressed]}
                >
                  <Text style={s.pillText}>{m.role === 'admin' ? 'Remove co-organizer' : 'Make co-organizer'}</Text>
                </Pressable>
                <Pressable
                  disabled={!!busy}
                  onPress={() =>
                    confirmRemove === m.user_id ? act(m.user_id, () => removeMember(tripId, m.user_id)) : setConfirmRemove(m.user_id)
                  }
                  accessibilityRole="button"
                  style={({ pressed }) => [s.pill, { borderColor: colors.danger }, confirmRemove === m.user_id && { backgroundColor: colors.danger }, pressed && s.pressed]}
                >
                  <Text style={[s.pillText, { color: confirmRemove === m.user_id ? colors.onAccent : colors.danger }]}>
                    {confirmRemove === m.user_id ? 'Tap again to remove' : 'Remove from event'}
                  </Text>
                </Pressable>
              </View>
            )}
            {busy === m.user_id && <ActivityIndicator color={colors.accent} />}
          </View>
        );
      })}
      {members?.length === 1 && <Text style={s.subtitle}>Nobody has joined yet. Send them the invite link above.</Text>}
      {!!error && <Text style={{ color: colors.danger }}>{error}</Text>}
    </ScrollView>
  );
}
