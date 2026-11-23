import { useEffect, useState } from 'react';
import { View, Text, Pressable, FlatList, TextInput } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTrips } from '../../../context/TripsContext';
import { PlayerForm, EMAIL_RE } from '../../../components/PlayerForm';
import { playerSlots, PlayerSlot } from '../../../lib/sync';
import { s, colors } from '../../../lib/styles';
import { courseHandicap, formatHandicap } from '../../../lib/handicap';

export default function Players() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { getTrip, addPlayer, updatePlayer, removePlayer, canEdit: canEditTrip } = useTrips();
  const trip = getTrip(tripId);
  const [slots, setSlots] = useState<PlayerSlot[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const synced = !!trip?.sync;
  const key = trip?.players.map((p) => `${p.id}:${p.email ?? ''}`).join() ?? '';
  useEffect(() => {
    if (!synced) return;
    playerSlots(tripId)
      .then(setSlots)
      .catch(() => {});
  }, [tripId, synced, key]);
  if (!trip) return null;
  const canEdit = canEditTrip(trip);

  const status = (id: string, email?: string) => {
    const slot = slots.find((x) => x.player_id === id);
    if (slot?.claimed) return { text: `Joined${slot.claimed_by ? ` as ${slot.claimed_by}` : ''}`, color: colors.good };
    if (email) return { text: 'Invited', color: colors.accent };
    return { text: 'Not joined', color: colors.muted };
  };
  const saveEmail = (id: string) => {
    const v = draft.trim().toLowerCase();
    if (v && !EMAIL_RE.test(v)) return;
    updatePlayer(tripId, id, { email: v || undefined });
    setEditing(null);
  };

  return (
    <View style={s.screen}>
      <FlatList
        contentContainerStyle={s.content}
        data={trip.players}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={
          canEdit ? (
            <PlayerForm withEmail onAdd={(name, index, email) => addPlayer(tripId, name, index, email)} />
          ) : (
            <Text style={s.subtitle}>Only organizers can change the roster.</Text>
          )
        }
        ListEmptyComponent={<Text style={s.subtitle}>No players yet.</Text>}
        renderItem={({ item }) => {
          const st = status(item.id, item.email);
          const badEmail = editing === item.id && !!draft.trim() && !EMAIL_RE.test(draft.trim());
          return (
            <View style={[s.card, { gap: 8 }]}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.title}>{item.name}</Text>
                  <Text style={s.subtitle}>
                    Index {formatHandicap(item.handicapIndex)}
                    {trip.courses
                      .filter((c) => c.slope)
                      .map(
                        (c) =>
                          ` · ${trip.courses.length > 1 ? c.name : 'Course'} HCP ${formatHandicap(courseHandicap(item.handicapIndex, c))}`,
                      )
                      .join('')}
                  </Text>
                  {trip.sync && <Text style={{ color: st.color, fontWeight: '700', fontSize: 13 }}>{st.text}</Text>}
                  {canEdit && <Text style={s.subtitle}>{item.email ?? 'No email'}</Text>}
                </View>
                {canEdit && (
                  <Pressable
                    onPress={() => removePlayer(tripId, item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${item.name}`}
                    style={{ minHeight: 44, justifyContent: 'center' }}
                  >
                    <Text style={{ color: colors.danger, fontWeight: '600' }}>Remove</Text>
                  </Pressable>
                )}
              </View>
              {canEdit &&
                (editing === item.id ? (
                  <View style={{ gap: 6 }}>
                    <View style={s.row}>
                      <TextInput
                        style={[s.input, { flex: 1, minWidth: 0 }]}
                        value={draft}
                        onChangeText={setDraft}
                        placeholder="name@example.com"
                        placeholderTextColor={colors.muted}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        accessibilityLabel={`Email for ${item.name}`}
                        onSubmitEditing={() => saveEmail(item.id)}
                        autoFocus
                      />
                      <Pressable onPress={() => saveEmail(item.id)} accessibilityRole="button" style={[s.pill, { minHeight: 44 }]}>
                        <Text style={s.pillText}>Save</Text>
                      </Pressable>
                    </View>
                    {badEmail && <Text style={{ color: colors.danger }}>That doesn't look like an email.</Text>}
                  </View>
                ) : (
                  <Pressable
                    onPress={() => {
                      setDraft(item.email ?? '');
                      setEditing(item.id);
                    }}
                    accessibilityRole="button"
                    style={{ minHeight: 44, justifyContent: 'center' }}
                  >
                    <Text style={s.linkText}>{item.email ? 'Change email' : 'Add email'}</Text>
                  </Pressable>
                ))}
            </View>
          );
        }}
      />
    </View>
  );
}
