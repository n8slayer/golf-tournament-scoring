import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { s, colors, icon } from '../lib/styles';
import { PressableLink } from './NavCard';
import { Trip, MatchFormat } from '../types/models';

export type Slots = { sideA: (string | null)[]; sideB: (string | null)[] };

export const isComplete = (matches: Slots[]) => matches.length > 0 && matches.every((m) => [...m.sideA, ...m.sideB].every(Boolean));

// Pick who plays who on a TV-style pairings board; each player is usable once per round.
export function MatchBuilder({
  trip,
  playerIds,
  format,
  onFormat,
  matches,
  onChange,
}: {
  trip: Trip;
  playerIds: string[];
  format: MatchFormat;
  onFormat: (f: MatchFormat) => void;
  matches: Slots[];
  onChange: (m: Slots[]) => void;
}) {
  const [teamA, teamB] = trip.teams;
  const size = format === 'fourball' ? 2 : 1;
  const roster = (teamId: string) => trip.players.filter((p) => p.teamId === teamId && playerIds.includes(p.id));
  const used = new Set(matches.flatMap((m) => [...m.sideA, ...m.sideB]).filter(Boolean));

  const [picking, setPicking] = useState<{ mi: number; side: 'sideA' | 'sideB'; si: number } | null>(null);
  const nameOf = (id: string | null) => trip.players.find((p) => p.id === id)?.name;

  const setSlot = (mi: number, side: 'sideA' | 'sideB', si: number, id: string | null) => {
    onChange(
      matches.map((m, i) => {
        if (i !== mi) return m;
        const next = [...m[side]];
        next[si] = id;
        return { ...m, [side]: next };
      }),
    );
    setPicking(null);
  };

  // One side of a match on the board: a team-coloured bar with a name per slot.
  const sideBar = (mi: number, side: 'sideA' | 'sideB') => {
    const a = side === 'sideA';
    const color = a ? colors.teamA : colors.teamB;
    return (
      <View style={st.side}>
        {matches[mi][side].map((id, si) => {
          const open = picking?.mi === mi && picking.side === side && picking.si === si;
          const name = nameOf(id);
          return (
            <Pressable
              key={si}
              onPress={() => setPicking(open ? null : { mi, side, si })}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              accessibilityLabel={`Match ${mi + 1}, ${a ? teamA.name : teamB.name}: ${name ?? 'pick a player'}`}
              style={({ pressed }) => [
                st.slot,
                name ? { backgroundColor: color } : { borderColor: color, borderStyle: 'dashed', borderWidth: 1.5 },
                open && { borderColor: colors.accent, borderWidth: 2, borderStyle: 'solid' },
                pressed && s.pressed,
              ]}
            >
              <Text style={[st.slotText, !name && { color: a ? colors.teamAText : colors.teamBText, fontWeight: '600' }]} numberOfLines={1}>
                {name ?? 'Pick player'}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  };

  // Opens under the match row: that team's players in this round, each usable once.
  const picker = () => {
    if (!picking) return null;
    const { mi, side, si } = picking;
    const a = side === 'sideA';
    const color = a ? colors.teamA : colors.teamB;
    const current = matches[mi][side][si];
    return (
      <View style={st.picker}>
        <Text style={[s.label, { color: a ? colors.teamAText : colors.teamBText }]}>{a ? teamA.name : teamB.name}: pick a player</Text>
        <View style={s.pillRow}>
          {roster(a ? teamA.id : teamB.id).map((p) => {
            const active = current === p.id;
            const taken = !active && used.has(p.id);
            return (
              <Pressable
                key={p.id}
                onPress={() => setSlot(mi, side, si, p.id)}
                disabled={taken}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: taken }}
                accessibilityLabel={`${p.name}${taken ? ', already in a match' : ''}`}
                style={[s.pill, { borderColor: color }, active && { backgroundColor: color }, taken && s.disabled]}
              >
                <Text style={[s.pillText, { color: active ? colors.onTeam : a ? colors.teamAText : colors.teamBText }]}>{p.name}</Text>
              </Pressable>
            );
          })}
          {current && (
            <Pressable
              onPress={() => setSlot(mi, side, si, null)}
              accessibilityRole="button"
              style={[s.pill, { borderColor: colors.border }]}
            >
              <Text style={[s.pillText, { color: colors.muted }]}>Clear</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={{ gap: 12 }}>
      <Text style={s.label}>Format</Text>
      <View style={s.pillRow}>
        {(['singles', 'fourball'] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => {
              setPicking(null);
              onFormat(f);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: format === f }}
            style={[s.pill, format === f && s.pillActive]}
          >
            <Text style={format === f ? s.pillTextActive : s.pillText}>
              {f === 'singles' ? 'Singles (1 v 1)' : 'Four Ball (2 v 2, 90% HCP)'}
            </Text>
          </Pressable>
        ))}
      </View>

      {matches.length === 0 ? (
        <View style={[s.card, { gap: 6 }]}>
          <Text style={s.title}>No matches yet</Text>
          <Text style={s.subtitle}>
            {roster(teamA.id).length && roster(teamB.id).length
              ? 'Add a match below to pair players.'
              : `Matches pair ${teamA.name} against ${teamB.name}, but ${
                  roster(teamA.id).length ? teamB.name : roster(teamB.id).length ? teamA.name : 'neither team'
                } has anyone in this round yet. Put players on teams first.`}{' '}
            You can also start the round without matches (stroke play and skins only).
          </Text>
          <PressableLink href={`/trip/${trip.id}/draft`} style={[s.buttonSecondary, { minHeight: 44 }]}>
            <Ionicons name="shuffle" size={icon.sm} color={colors.accent} />
            <Text style={s.buttonTextSecondary}>Teams & draft</Text>
          </PressableLink>
        </View>
      ) : (
        <View style={st.board}>
          {/* TV pairings board: team A on the left, team B on the right, match number between */}
          <View style={st.boardHead}>
            <Text style={[st.teamHead, { color: colors.teamAText }]} numberOfLines={1}>
              {teamA.name.toUpperCase()}
            </Text>
            <Text style={st.boardTitle}>{format === 'fourball' ? 'FOUR BALL' : 'SINGLES'}</Text>
            <Text style={[st.teamHead, { color: colors.teamBText, textAlign: 'right' }]} numberOfLines={1}>
              {teamB.name.toUpperCase()}
            </Text>
          </View>
          {matches.map((m, mi) => (
            <View key={mi} style={{ gap: 8 }}>
              <View style={st.matchRow}>
                {sideBar(mi, 'sideA')}
                <View style={st.middle}>
                  <View style={st.matchNo}>
                    <Text style={st.matchNoText}>{mi + 1}</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      setPicking(null);
                      onChange(matches.filter((_, i) => i !== mi));
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove match ${mi + 1}`}
                    hitSlop={8}
                    style={{ minHeight: 28, justifyContent: 'center' }}
                  >
                    <Ionicons name="close" size={16} color={colors.muted} />
                  </Pressable>
                </View>
                {sideBar(mi, 'sideB')}
              </View>
              {picking?.mi === mi && picker()}
            </View>
          ))}
        </View>
      )}
      <Pressable
        onPress={() => onChange([...matches, { sideA: Array(size).fill(null), sideB: Array(size).fill(null) }])}
        accessibilityRole="button"
        style={({ pressed }) => [s.buttonSecondary, pressed && s.pressed]}
      >
        <Ionicons name="add" size={icon.sm} color={colors.accent} />
        <Text style={s.buttonTextSecondary}>Add match</Text>
      </Pressable>
      {matches.length > 0 && !isComplete(matches) && (
        <Text style={s.subtitle}>Fill every slot (or remove empty matches) to create the round.</Text>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  board: { gap: 10, backgroundColor: colors.primary, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 10 },
  boardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  teamHead: { flex: 1, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  boardTitle: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  matchRow: { flexDirection: 'row', alignItems: 'stretch', gap: 6 },
  side: { flex: 1, gap: 4 },
  slot: { minHeight: 44, borderRadius: 8, justifyContent: 'center', paddingHorizontal: 10 },
  slotText: { color: '#fff', fontWeight: '800', fontSize: 15, textAlign: 'center' },
  middle: { width: 40, alignItems: 'center', justifyContent: 'center', gap: 2 },
  matchNo: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  matchNoText: { color: colors.onAccent, fontWeight: '800', fontSize: 14 },
  picker: { gap: 8, padding: 10, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.accent },
});
