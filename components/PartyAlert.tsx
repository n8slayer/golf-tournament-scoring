import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, Switch, Vibration, AccessibilityInfo, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trip } from '../types/models';
import { useTrips } from '../context/TripsContext';
import { eventOf } from '../lib/scoring';
import { partyHoles, PartyHole } from '../lib/party';
import { s, colors } from '../lib/styles';

type Saved = { on: boolean; seen: string[] };
const AUTO_CLOSE_MS = 8000;
const article = (label: string) => (/^[AEIOU]/.test(label) ? 'an' : 'a');

// Party Mode: a celebration on this phone for every new gross birdie or better in the event.
// What was already shown is remembered per event, so each hole celebrates once.
export function PartyAlert({ trip }: { trip: Trip }) {
  const on = !!eventOf(trip).partyMode;
  const key = `party:v1:${trip.id}`;
  const saved = useRef<Saved | null | undefined>(undefined); // undefined = still loading
  const [loaded, setLoaded] = useState(false);
  const [queue, setQueue] = useState<PartyHole[]>([]);
  const { finishedHoles } = useTrips();
  // A hole counts once its scorer pressed Next hole (live), or once that player has a score on a
  // later hole (covers phones that missed the live message).
  const holes = partyHoles(trip).filter(
    (h) =>
      finishedHoles.has(`${trip.id}:${h.roundId}:${h.hole}`) ||
      trip.scores.some((sc) => sc.roundId === h.roundId && sc.playerId === h.playerId && sc.holeNumber > h.hole),
  );
  const sig = holes.map((h) => h.key).join();

  useEffect(() => {
    AsyncStorage.getItem(key)
      .then((raw) => (saved.current = raw ? (JSON.parse(raw) as Saved) : null))
      .catch(() => (saved.current = null))
      .finally(() => setLoaded(true));
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    const prev = saved.current;
    const save = (next: Saved) => {
      saved.current = next;
      AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
    };
    if (!on) {
      if (prev?.on !== false) save({ on: false, seen: prev?.seen ?? [] });
      return;
    }
    // First visit, or Party Mode just switched on: what's already scored doesn't celebrate.
    if (!prev || !prev.on) return save({ on: true, seen: holes.map((h) => h.key) });
    const seen = new Set(prev.seen);
    const fresh = holes.filter((h) => !seen.has(h.key));
    if (!fresh.length) return;
    save({ on: true, seen: [...prev.seen, ...fresh.map((h) => h.key)] });
    setQueue((q) => [...q, ...fresh]);
  }, [loaded, on, sig]);

  // Several waiting (phone was closed): one summary card. Otherwise one card per birdie.
  const summary = queue.length > 3;
  const current = queue[0];
  const dismiss = () => setQueue((q) => (summary ? [] : q.slice(1)));

  useEffect(() => {
    if (!current) return;
    Vibration.vibrate([0, 200, 120, 200]);
    AccessibilityInfo.announceForAccessibility(
      summary
        ? `${queue.length} birdies or better while you were away. Drink up!`
        : `${current.playerName} made ${article(current.label)} ${current.label.toLowerCase()} on ${current.hole}. Drink up!`,
    );
    const t = setTimeout(dismiss, AUTO_CLOSE_MS);
    return () => clearTimeout(t);
  }, [current?.key, summary]);

  if (!current) return null;
  return (
    <Modal transparent animationType="fade" visible onRequestClose={dismiss}>
      <Pressable style={st.backdrop} onPress={dismiss} accessibilityLabel="Close">
        <View style={st.card} accessibilityViewIsModal accessibilityRole="alert" onStartShouldSetResponder={() => true}>
          <Text style={st.emoji} accessibilityElementsHidden importantForAccessibility="no">
            🍻
          </Text>
          {summary ? (
            <>
              <Text style={st.kicker}>WHILE YOU WERE AWAY</Text>
              {queue.map((h) => (
                <Text key={h.key} style={st.line}>
                  <Text style={st.name}>{h.playerName}</Text> · {h.label} on {h.hole}
                </Text>
              ))}
            </>
          ) : (
            <>
              <Text style={st.kicker}>{current.roundName.toUpperCase()}</Text>
              <Text style={st.big}>
                <Text style={st.name}>{current.playerName}</Text> made {article(current.label)} {current.label} on {current.hole}
              </Text>
            </>
          )}
          <Text style={st.drink}>Drink up!</Text>
          <Pressable
            onPress={dismiss}
            accessibilityRole="button"
            style={({ pressed }) => [s.button, { alignSelf: 'stretch' }, pressed && s.pressed]}
          >
            <Text style={s.buttonText}>Cheers!</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,10,20,0.75)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.primary,
    borderColor: colors.accent,
    borderWidth: 2,
    borderRadius: 20,
    padding: 24,
    gap: 10,
    alignItems: 'center',
  },
  emoji: { fontSize: 64 },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  big: { color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  line: { color: colors.text, fontSize: 17, textAlign: 'center' },
  name: { color: colors.accent, fontWeight: '800' },
  drink: { color: colors.text, fontSize: 20, fontWeight: '800', marginVertical: 6 },
});

// Organizer switch (setup page, More tab). Players see it read-only.
export function PartyModeSwitch({ value, onChange }: { value: boolean; onChange?: (v: boolean) => void }) {
  return (
    <View style={[s.card, s.row]}>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>Party Mode 🍻</Text>
        <Text style={s.subtitle}>
          {onChange
            ? 'Alert everyone when someone makes a birdie or better. Drink to it.'
            : value
              ? 'On: everyone gets an alert on a birdie or better.'
              : 'Off. The organizer can turn it on.'}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={!onChange}
        accessibilityLabel="Party Mode"
        trackColor={{ true: colors.accent, false: colors.border }}
      />
    </View>
  );
}
