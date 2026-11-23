import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTrips } from '../../context/TripsContext';
import { PlayerForm } from '../../components/PlayerForm';
import { formatHandicap } from '../../lib/handicap';
import { s, colors, icon } from '../../lib/styles';

// Invite link landing: join the event, then pick (or add) which player you are.
export default function Join() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { sharing, joinEvent, getTrip, claimMyPlayer, addMyself } = useTrips();
  const router = useRouter();
  const [tripId, setTripId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const trip = tripId ? getTrip(tripId) : undefined;

  useEffect(() => {
    if (!sharing || !code) return;
    joinEvent(code)
      .then(setTripId)
      .catch((e) => setError(e?.message?.includes('not valid') ? 'This invite link is not valid. Ask the organizer for a new one.' : `Could not join: ${e?.message ?? e}`));
  }, [code, sharing]);

  const done = () => router.replace(`/trip/${tripId}`);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      done();
    } catch (e) {
      setError(`Something went wrong: ${(e as Error)?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  if (!sharing) {
    return (
      <View style={[s.screen, s.content]}>
        <Text style={s.subtitle}>Joining events isn't set up on this version of the app.</Text>
      </View>
    );
  }

  if (error && !trip) {
    return (
      <View style={[s.screen, s.content]}>
        <Ionicons name="alert-circle" size={40} color={colors.danger} />
        <Text style={s.title}>{error}</Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={[s.screen, s.content, { alignItems: 'center' }]}>
        <ActivityIndicator color={colors.accent} />
        <Text style={s.subtitle}>Joining event…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.label}>You're in</Text>
      <Text style={s.h1} accessibilityRole="header">
        {trip.name}
      </Text>
      <Text style={s.title}>Which player are you?</Text>
      <Text style={s.subtitle}>This lets the app show your strokes and scorecard. You can score for your whole group either way.</Text>
      {trip.players.map((p) => (
        <Pressable
          key={p.id}
          disabled={busy}
          onPress={() => run(() => claimMyPlayer(trip.id, p.id))}
          accessibilityRole="button"
          accessibilityLabel={`I'm ${p.name}`}
          style={({ pressed }) => [s.card, s.row, { justifyContent: 'flex-start' }, trip.sync?.myPlayerId === p.id && { borderColor: colors.accent, borderWidth: 2 }, pressed && s.pressed]}
        >
          <View style={s.iconBadge}>
            <Ionicons name="person" size={icon.md} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{p.name}</Text>
            <Text style={s.subtitle}>Index {formatHandicap(p.handicapIndex)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={icon.sm} color={colors.muted} />
        </Pressable>
      ))}
      {trip.players.length === 0 && <Text style={s.subtitle}>No players on the roster yet.</Text>}

      {adding ? (
        <View style={s.card}>
          <PlayerForm buttonLabel="Add me to the event" onAdd={(name, idx) => run(() => addMyself(trip.id, name, idx))} />
        </View>
      ) : (
        <Pressable onPress={() => setAdding(true)} accessibilityRole="button" style={({ pressed }) => [s.buttonSecondary, pressed && s.pressed]}>
          <Ionicons name="add" size={icon.sm} color={colors.accent} />
          <Text style={s.buttonTextSecondary}>I'm not listed</Text>
        </Pressable>
      )}
      <Pressable onPress={done} accessibilityRole="button" style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={s.linkText}>Skip for now</Text>
      </Pressable>
      {busy && <ActivityIndicator color={colors.accent} />}
      {!!error && <Text style={{ color: colors.danger }}>{error}</Text>}
    </ScrollView>
  );
}
