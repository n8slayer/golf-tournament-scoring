import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { s, colors, icon } from '../lib/styles';
import { PressableLink } from './NavCard';
import { Trip, MatchFormat } from '../types/models';

export type Slots = { sideA: (string | null)[]; sideB: (string | null)[] };

export const isComplete = (matches: Slots[]) =>
  matches.length > 0 && matches.every((m) => [...m.sideA, ...m.sideB].every(Boolean));

// Pick who plays who: one pill row per slot, each player usable once per round.
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

  const setSlot = (mi: number, side: 'sideA' | 'sideB', si: number, id: string) =>
    onChange(
      matches.map((m, i) => {
        if (i !== mi) return m;
        const next = [...m[side]];
        next[si] = next[si] === id ? null : id; // tap again to clear
        return { ...m, [side]: next };
      })
    );

  const slotRow = (mi: number, side: 'sideA' | 'sideB', si: number, teamId: string, color: string) => {
    const current = matches[mi][side][si];
    return (
      <View key={`${side}-${si}`} style={s.pillRow}>
        {roster(teamId).map((p) => {
          const active = current === p.id;
          const taken = !active && used.has(p.id);
          return (
            <Pressable
              key={p.id}
              onPress={() => setSlot(mi, side, si, p.id)}
              disabled={taken}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled: taken }}
              accessibilityLabel={`Match ${mi + 1}: ${p.name}${taken ? ', already playing' : ''}`}
              style={[s.pill, { borderColor: color }, active && { backgroundColor: color }, taken && s.disabled]}
            >
              <Text style={[s.pillText, { color: active ? colors.onTeam : color === colors.teamA ? colors.teamAText : colors.teamBText }]}>{p.name}</Text>
            </Pressable>
          );
        })}
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
            onPress={() => onFormat(f)}
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

      <Text style={s.label}>Matches</Text>
      {matches.length === 0 && (
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
      )}
      {matches.map((m, mi) => (
        <View key={mi} style={[s.card, { gap: 8 }]}>
          <View style={s.row}>
            <Text style={s.title}>Match {mi + 1}</Text>
            <Pressable
              onPress={() => onChange(matches.filter((_, i) => i !== mi))}
              accessibilityRole="button"
              accessibilityLabel={`Remove match ${mi + 1}`}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="close" size={icon.md} color={colors.muted} />
            </Pressable>
          </View>
          <Text style={[s.label, { color: colors.teamAText }]}>{teamA.name}</Text>
          {Array.from({ length: size }, (_, si) => slotRow(mi, 'sideA', si, teamA.id, colors.teamA))}
          <Text style={[s.label, { color: colors.teamBText }]}>{teamB.name}</Text>
          {Array.from({ length: size }, (_, si) => slotRow(mi, 'sideB', si, teamB.id, colors.teamB))}
        </View>
      ))}
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
