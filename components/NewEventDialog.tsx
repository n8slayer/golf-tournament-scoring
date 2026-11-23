import { useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTrips } from '../context/TripsContext';
import { EventType } from '../types/models';
import { s, colors } from '../lib/styles';

type Mode = 'rydercup' | 'teams' | 'individual';
interface Game {
  id: string;
  name: string;
  desc: string;
  type?: EventType; // missing = coming soon
}

const MODES: { id: Mode; name: string; desc: string; color: string }[] = [
  { id: 'rydercup', name: 'Ryder Cup', desc: 'Two teams, match play. Win holes and matches for points.', color: colors.accent },
  { id: 'teams', name: 'Team Leaderboard', desc: 'Teams add up their scores. Best ball, scramble and more.', color: colors.teamB },
  { id: 'individual', name: 'Individual', desc: 'Everyone for themselves. One leaderboard, player by player.', color: colors.teamA },
];

const GAMES: Record<Mode, Game[]> = {
  rydercup: [],
  teams: [
    { id: 'team-stableford', name: 'Team Stableford', desc: 'Every player’s Stableford points count for the team.' },
    { id: 'team-stroke', name: 'Team Stroke Play', desc: 'Every player’s strokes count for the team.' },
    { id: 'best-ball', name: 'Best Ball', desc: 'Own ball each; the team’s best score counts.' },
    { id: 'scramble', name: 'Scramble', desc: 'Everyone hits, play the best shot.' },
  ],
  individual: [
    { id: 'strokeplay', name: 'Stroke Play', desc: 'Lowest net total across the trip.', type: 'strokeplay' },
    { id: 'stableford', name: 'Stableford', desc: 'Points per hole against par. Most points wins.', type: 'stableford' },
    { id: 'merit', name: 'Order of Merit', desc: 'Points for where you finish each round.' },
    { id: 'wolf', name: 'Wolf', desc: 'Rotating wolf picks a partner or goes alone.' },
  ],
};

// Quick start: name + mode + game. Courses, players and teams come next, from the event's checklist.
export function NewEventDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { addTrip } = useTrips();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<Mode | null>(null);
  const [game, setGame] = useState<Game | null>(null);

  const type: EventType | undefined = mode === 'rydercup' ? 'rydercup' : game?.type;
  const canCreate = !!name.trim() && !!type;

  const close = () => {
    setName('');
    setMode(null);
    setGame(null);
    onClose();
  };
  const create = () => {
    if (!canCreate || !type) return;
    const id = addTrip({
      name: name.trim(),
      courses: [],
      players: [],
      event: { type, skinValue: 5, matchStake: 20 },
      ...(type === 'rydercup' ? { teamNames: ['Team A', 'Team B'] as [string, string] } : {}),
    });
    close();
    router.push(`/trip/${id}`);
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={close}>
      <View style={st.backdrop}>
        <View style={st.sheet} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={{ gap: 14, padding: 22 }} keyboardShouldPersistTaps="handled">
            <View style={{ gap: 4 }}>
              <Text style={st.title} accessibilityRole="header">
                New event
              </Text>
              <Text style={s.subtitle}>Pick how you’ll compete. Courses, players and teams come next.</Text>
            </View>

            <Text style={s.label}>Event name</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Bandon Cup 2026"
              placeholderTextColor={colors.muted}
              maxLength={60}
              autoFocus
              accessibilityLabel="Event name"
            />

            <Text style={s.label}>Mode</Text>
            {MODES.map((m) => {
              const active = mode === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    setMode(m.id);
                    setGame(null);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  style={({ pressed }) => [st.mode, { borderLeftColor: m.color }, active && { borderColor: m.color }, pressed && s.pressed]}
                >
                  <Text style={[st.modeName, active && { color: m.color }]}>{m.name}</Text>
                  <Text style={st.desc}>{m.desc}</Text>
                </Pressable>
              );
            })}

            {mode && mode !== 'rydercup' && (
              <View style={st.games}>
                <Text style={[s.label, { color: MODES.find((m) => m.id === mode)!.color }]}>Game</Text>
                <View style={st.grid}>
                  {GAMES[mode].map((g) => {
                    const soon = !g.type;
                    const active = game?.id === g.id;
                    return (
                      <Pressable
                        key={g.id}
                        disabled={soon}
                        onPress={() => setGame(g)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active, disabled: soon }}
                        accessibilityLabel={`${g.name}${soon ? ', coming soon' : ''}`}
                        style={({ pressed }) => [
                          st.game,
                          active && { borderColor: colors.accent },
                          soon && { opacity: 0.5 },
                          pressed && s.pressed,
                        ]}
                      >
                        <View style={[s.row, { gap: 6 }]}>
                          <Text style={[st.gameName, active && { color: colors.accent }]}>{g.name}</Text>
                          {soon && (
                            <View style={s.chip}>
                              <Text style={s.chipText}>SOON</Text>
                            </View>
                          )}
                        </View>
                        <Text style={st.desc}>{g.desc}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {mode === 'teams' && <Text style={s.subtitle}>Team games are on the way. Use Ryder Cup or Individual for now.</Text>}
              </View>
            )}

            <View style={[s.row, { justifyContent: 'flex-end', marginTop: 6 }]}>
              <Pressable
                onPress={close}
                accessibilityRole="button"
                style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 }}
              >
                <Text style={[s.linkText, { color: colors.muted }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={create}
                disabled={!canCreate}
                accessibilityRole="button"
                style={({ pressed }) => [s.button, { paddingHorizontal: 20 }, !canCreate && s.disabled, pressed && s.pressed]}
              >
                <Text style={s.buttonText}>Create event</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(3,7,14,0.75)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  sheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '92%',
    backgroundColor: colors.primary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  mode: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 4,
    backgroundColor: colors.card,
  },
  modeName: { color: colors.text, fontSize: 17, fontWeight: '800' },
  desc: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  games: { gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, backgroundColor: colors.bg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  game: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 140,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    gap: 4,
    backgroundColor: colors.card,
  },
  gameName: { color: colors.text, fontSize: 15, fontWeight: '800', flexShrink: 1 },
});
