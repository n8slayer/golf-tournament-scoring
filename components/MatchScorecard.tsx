import { View, Text, StyleSheet } from 'react-native';
import { ScoreMark } from './Scorecard';
import { colors } from '../lib/styles';
import { Trip, Round, Hole } from '../types/models';
import { MatchPairing, matchHoles, matchStrokesOnHole, courseFor, formatOf } from '../lib/scoring';
import { holeNumbersFor } from '../lib/holeRanges';

// Match play card: each player's gross (with stroke dots), each side's best net,
// and the running match status after every hole in the leading team's colour.
export function MatchScorecard({ trip, round, pairing }: { trip: Trip; round: Round; pairing: MatchPairing }) {
  const nums = holeNumbersFor(round.holesPlayed);
  const holes = courseFor(trip, round).holes.filter((h) => nums.includes(h.number));
  const mh = new Map(matchHoles(trip, round, pairing).map((x) => [x.holeNumber, x]));
  const strokesOf = (pid: string, n: number) =>
    trip.scores.find((sc) => sc.roundId === round.id && sc.playerId === pid && sc.holeNumber === n)?.strokes;
  const nameOf = (id: string) => trip.players.find((p) => p.id === id)?.name ?? '?';
  const fourball = formatOf(round) === 'fourball';

  const nine = (hs: Hole[], label: string) => {
    if (!hs.length) return null;
    const total = (pid: string) => {
      const v = hs.map((h) => strokesOf(pid, h.number));
      return v.every((x) => x !== undefined) ? String(v.reduce((a, b) => a! + b!, 0)) : '–';
    };
    const playerRow = (pid: string, color: string) => (
      <View key={pid} style={st.row}>
        <Text style={[st.label, { color, fontWeight: '800' }]} numberOfLines={1}>
          {nameOf(pid)}
        </Text>
        {hs.map((h) => {
          const pops = matchStrokesOnHole(trip, round, pid, h.number);
          return (
            <View key={h.number} style={st.cellBox}>
              <ScoreMark strokes={strokesOf(pid, h.number)} par={h.par} />
              {pops !== 0 && (
                <View style={st.dots} accessibilityLabel={pops > 0 ? `gets ${pops}` : `gives ${-pops}`}>
                  {Array.from({ length: Math.abs(pops) }, (_, i) => (
                    <View key={i} style={[st.dot, pops < 0 && { backgroundColor: colors.under }]} />
                  ))}
                </View>
              )}
            </View>
          );
        })}
        <Text style={[st.total, { fontWeight: '800' }]}>{total(pid)}</Text>
      </View>
    );
    const netRow = (side: 'A' | 'B') => {
      const color = side === 'A' ? colors.teamA : colors.teamB;
      return (
        <View style={[st.row, st.netRow]}>
          <Text style={[st.label, { color }]} numberOfLines={1}>
            {fourball ? 'Best net' : 'Net'}
          </Text>
          {hs.map((h) => {
            const x = mh.get(h.number);
            const mine = side === 'A' ? x?.netA : x?.netB;
            const theirs = side === 'A' ? x?.netB : x?.netA;
            const won = mine != null && theirs != null && mine < theirs;
            return (
              <Text key={h.number} style={[st.cell, won && { color: '#fff', backgroundColor: color, fontWeight: '800' }]}>
                {mine ?? '–'}
              </Text>
            );
          })}
          <Text style={st.total} />
        </View>
      );
    };
    return (
      <View style={st.table}>
        <View style={[st.row, st.head]}>
          <Text style={[st.label, st.headText]}>Hole</Text>
          {hs.map((h) => (
            <Text key={h.number} style={[st.cell, st.headText]}>
              {h.number}
            </Text>
          ))}
          <Text style={[st.total, st.headText]}>{label}</Text>
        </View>
        <View style={st.row}>
          <Text style={st.label}>Par</Text>
          {hs.map((h) => (
            <Text key={h.number} style={[st.cell, st.muted]}>
              {h.par}
            </Text>
          ))}
          <Text style={[st.total, st.muted]}>{hs.reduce((a, h) => a + h.par, 0)}</Text>
        </View>
        <View style={st.row}>
          <Text style={st.label}>SI</Text>
          {hs.map((h) => (
            <Text key={h.number} style={[st.cell, st.muted, { fontSize: 11 }]}>
              {h.strokeIndex}
            </Text>
          ))}
          <Text style={st.total} />
        </View>
        {pairing.sideA.map((pid) => playerRow(pid, colors.teamA))}
        {netRow('A')}
        <View style={[st.row, st.matchRow]}>
          <Text style={[st.label, { fontWeight: '800' }]}>Match</Text>
          {hs.map((h) => {
            const up = mh.get(h.number)?.upAfter;
            const bg = up == null || up === 0 ? null : up > 0 ? colors.teamA : colors.teamB;
            return (
              <View key={h.number} style={st.cellBox}>
                {up != null && (
                  <Text style={[st.status, bg ? { backgroundColor: bg, color: '#fff' } : { color: colors.muted }]}>
                    {up === 0 ? 'AS' : Math.abs(up)}
                  </Text>
                )}
              </View>
            );
          })}
          <Text style={st.total} />
        </View>
        {netRow('B')}
        {pairing.sideB.map((pid) => playerRow(pid, colors.teamB))}
      </View>
    );
  };

  return (
    <View style={{ gap: 10 }}>
      {nine(holes.filter((h) => h.number <= 9), 'Out')}
      {nine(holes.filter((h) => h.number > 9), 'In')}
      <Text style={st.legend}>
        Dots = strokes received in this match{fourball ? ' (90% of course handicap)' : ''}. Highlighted net = hole won. Match row = holes up
        after each hole, in the leading team's colour.
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.card },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 32 },
  head: { backgroundColor: colors.primary },
  headText: { color: '#fff', fontWeight: '700' },
  label: { width: 64, paddingLeft: 6, fontSize: 12, fontWeight: '700', color: colors.muted },
  cell: { flex: 1, minWidth: 22, textAlign: 'center', fontSize: 13, color: colors.text, paddingVertical: 4 },
  cellBox: { flex: 1, minWidth: 22, alignItems: 'center', justifyContent: 'center', paddingVertical: 3 },
  total: { width: 34, textAlign: 'center', fontSize: 13, color: colors.text },
  muted: { color: colors.muted },
  netRow: { backgroundColor: '#F4F8F5' },
  matchRow: { backgroundColor: '#FBF4E2' },
  status: { minWidth: 22, textAlign: 'center', fontSize: 11, fontWeight: '800', borderRadius: 4, paddingVertical: 2, overflow: 'hidden' },
  dots: { position: 'absolute', top: 1, right: 0, flexDirection: 'row', gap: 1 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.text },
  legend: { fontSize: 12, color: colors.muted },
});
