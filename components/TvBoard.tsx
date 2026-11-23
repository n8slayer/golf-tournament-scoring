import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScoreMark } from './Scorecard';
import { s, colors, icon } from '../lib/styles';
import { Hole } from '../types/models';

// TV-style leaderboard pieces: dark header bar, tight numeric columns, red under par.

export type Mode = 'net' | 'gross';

export const toPar = (n: number) => (n === 0 ? 'E' : n > 0 ? `+${n}` : `${n}`.replace('-', '−'));
export const parColor = (n: number) => (n < 0 ? colors.under : colors.text);

// Ranks with ties: [−3, −1, −1, 2] → ['1', 'T2', 'T2', '4'] (values already sorted).
export function positions(values: number[]): string[] {
  return values.map((v, i) => {
    const first = values.indexOf(v);
    const tied = values.filter((x) => x === v).length > 1;
    return `${tied ? 'T' : ''}${first + 1}`;
  });
}

export function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <View style={[s.pillRow, { justifyContent: 'flex-end' }]}>
      {(['net', 'gross'] as const).map((m) => (
        <Pressable
          key={m}
          onPress={() => onChange(m)}
          accessibilityRole="radio"
          accessibilityState={{ checked: mode === m }}
          style={[s.pill, { minHeight: 36 }, mode === m && s.pillActive]}
        >
          <Text style={mode === m ? s.pillTextActive : s.pillText}>{m === 'net' ? 'Net' : 'Gross'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export interface BoardRow {
  key: string;
  name: string;
  sortValue: number; // lower is better (pass −points for Stableford)
  cells: { text: string; color?: string; bold?: boolean }[];
  a11y: string;
}

// Generic TV table: POS | PLAYER | ...columns. Rows must already be sorted by sortValue.
export function TvTable({
  title,
  columns,
  rows,
  renderExpanded,
}: {
  title: string;
  columns: { label: string; width: number }[];
  rows: BoardRow[];
  renderExpanded?: (key: string) => React.ReactNode;
}) {
  const [open, setOpen] = useState<string[]>([]);
  const pos = positions(rows.map((r) => r.sortValue));
  return (
    <View style={st.table}>
      <View style={st.titleBar}>
        <Text style={st.titleText}>{title}</Text>
      </View>
      <View style={[st.row, st.head]}>
        <Text style={[st.pos, st.headText]}>POS</Text>
        <Text style={[st.player, st.headText]}>PLAYER</Text>
        {columns.map((c) => (
          <Text key={c.label} style={[st.num, { width: c.width }, st.headText]}>
            {c.label}
          </Text>
        ))}
        {renderExpanded && <View style={{ width: 20 }} />}
      </View>
      {rows.map((r, i) => {
        const expanded = open.includes(r.key);
        const lead = pos[i] === '1' || pos[i] === 'T1';
        return (
          <View key={r.key} style={[i % 2 ? st.zebra : null, lead && st.leadRow]}>
            <Pressable
              disabled={!renderExpanded}
              onPress={() => setOpen((p) => (p.includes(r.key) ? p.filter((k) => k !== r.key) : [...p, r.key]))}
              accessibilityRole={renderExpanded ? 'button' : undefined}
              accessibilityState={renderExpanded ? { expanded } : undefined}
              accessibilityLabel={`${pos[i]}. ${r.a11y}${renderExpanded ? `. ${expanded ? 'Hide' : 'Show'} scorecard` : ''}`}
              style={({ pressed }) => [st.row, pressed && s.pressed]}
            >
              <Text style={[st.pos, st.posText]}>{pos[i]}</Text>
              <Text style={[st.player, st.name]} numberOfLines={1}>
                {r.name}
              </Text>
              {r.cells.map((c, j) => (
                <Text
                  key={j}
                  style={[st.num, { width: columns[j].width, color: c.color ?? colors.text, fontWeight: c.bold ? '800' : '600' }]}
                >
                  {c.text}
                </Text>
              ))}
              {renderExpanded && (
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={icon.sm} color={colors.muted} style={{ width: 20 }} />
              )}
            </Pressable>
            {expanded && renderExpanded && <View style={{ padding: 10 }}>{renderExpanded(r.key)}</View>}
          </View>
        );
      })}
    </View>
  );
}

const CELL = 34;
const TOT = 42;
const NAME_COL = 92;

// Every player's gross card in one grid + an average-per-hole row.
export function HoleByHole({
  holes,
  players,
  strokesFor,
}: {
  holes: Hole[];
  players: { id: string; name: string }[];
  strokesFor: (playerId: string, hole: number) => number | undefined;
}) {
  const front = holes.filter((h) => h.number <= 9);
  const back = holes.filter((h) => h.number > 9);
  const sum = (hs: Hole[], id: string) => {
    const v = hs.map((h) => strokesFor(id, h.number));
    return v.every((x) => x !== undefined) && v.length ? String(v.reduce((a, b) => a! + b!, 0)) : '–';
  };
  const avg = (n: number) => {
    const v = players.map((p) => strokesFor(p.id, n)).filter((x): x is number => x !== undefined);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const segments: (Hole | 'OUT' | 'IN' | 'TOT')[] = [
    ...front,
    ...(front.length ? (['OUT'] as const) : []),
    ...back,
    ...(back.length ? (['IN'] as const) : []),
    ...(front.length && back.length ? (['TOT'] as const) : []),
  ];
  const width = (seg: (typeof segments)[number]) => (typeof seg === 'string' ? TOT : CELL);
  const parSum = (hs: Hole[]) => String(hs.reduce((a, h) => a + h.par, 0));
  const segText = (seg: (typeof segments)[number], id: string) =>
    seg === 'OUT' ? sum(front, id) : seg === 'IN' ? sum(back, id) : seg === 'TOT' ? sum(holes, id) : null;

  return (
    <View style={[st.table, { flexDirection: 'row' }]}>
      <View style={{ width: NAME_COL }}>
        <Text style={[st.gridName, st.head, st.headText]}>HOLE</Text>
        <Text style={[st.gridName, st.parRow]}>PAR</Text>
        {players.map((p, i) => (
          <Text key={p.id} style={[st.gridName, st.name, i % 2 ? st.zebra : null]} numberOfLines={1}>
            {p.name}
          </Text>
        ))}
        <Text style={[st.gridName, st.avgRow]}>AVG</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexDirection: 'column' }}>
        <View style={[st.gridRow, st.head]}>
          {segments.map((seg, i) => (
            <Text key={i} style={[st.gridCell, { width: width(seg) }, st.headText]}>
              {typeof seg === 'string' ? seg : seg.number}
            </Text>
          ))}
        </View>
        <View style={[st.gridRow, st.parRow]}>
          {segments.map((seg, i) => (
            <Text key={i} style={[st.gridCell, { width: width(seg) }, st.parText]}>
              {seg === 'OUT' ? parSum(front) : seg === 'IN' ? parSum(back) : seg === 'TOT' ? parSum(holes) : seg.par}
            </Text>
          ))}
        </View>
        {players.map((p, pi) => (
          <View key={p.id} style={[st.gridRow, pi % 2 ? st.zebra : null]}>
            {segments.map((seg, i) =>
              typeof seg === 'string' ? (
                <Text key={i} style={[st.gridCell, { width: TOT, fontWeight: '800' }]}>
                  {segText(seg, p.id)}
                </Text>
              ) : (
                <View key={i} style={[st.gridBox, { width: CELL }]}>
                  <ScoreMark strokes={strokesFor(p.id, seg.number)} par={seg.par} />
                </View>
              )
            )}
          </View>
        ))}
        <View style={[st.gridRow, st.avgRow]}>
          {segments.map((seg, i) => {
            if (typeof seg === 'string') return <View key={i} style={{ width: TOT }} />;
            const a = avg(seg.number);
            return (
              <Text key={i} style={[st.gridCell, { width: CELL, fontSize: 11, color: a !== null && a < seg.par ? colors.under : colors.muted }]}>
                {a === null ? '–' : a.toFixed(1)}
              </Text>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// Per-player scoring mix (gross) + hardest/easiest holes by average vs par.
export function ScoringStats({
  holes,
  players,
  strokesFor,
}: {
  holes: Hole[];
  players: { id: string; name: string }[];
  strokesFor: (playerId: string, hole: number) => number | undefined;
}) {
  const buckets = ['EAG+', 'BIR', 'PAR', 'BOG', 'DBL+'];
  const bucketOf = (d: number) => (d <= -2 ? 0 : d === -1 ? 1 : d === 0 ? 2 : d === 1 ? 3 : 4);
  const rows = players.map((p) => {
    const counts = [0, 0, 0, 0, 0];
    for (const h of holes) {
      const sc = strokesFor(p.id, h.number);
      if (sc !== undefined) counts[bucketOf(sc - h.par)]++;
    }
    return { p, counts };
  });
  const diffs = holes
    .map((h) => {
      const v = players.map((p) => strokesFor(p.id, h.number)).filter((x): x is number => x !== undefined);
      return v.length ? { h, d: v.reduce((a, b) => a + b, 0) / v.length - h.par } : null;
    })
    .filter((x): x is { h: Hole; d: number } => x !== null)
    .sort((a, b) => b.d - a.d);
  const fmt = (d: number) => `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d).toFixed(2)}`;

  return (
    <View style={{ gap: 8 }}>
      <View style={st.table}>
        <View style={[st.row, st.head]}>
          <Text style={[st.player, st.headText, { paddingLeft: 10 }]}>PLAYER</Text>
          {buckets.map((b) => (
            <Text key={b} style={[st.num, { width: 44 }, st.headText]}>
              {b}
            </Text>
          ))}
        </View>
        {rows.map(({ p, counts }, i) => (
          <View key={p.id} style={[st.row, i % 2 ? st.zebra : null]}>
            <Text style={[st.player, st.name, { paddingLeft: 10 }]} numberOfLines={1}>
              {p.name}
            </Text>
            {counts.map((c, j) => (
              <Text key={j} style={[st.num, { width: 44, color: j < 2 && c ? colors.under : colors.text, fontWeight: c ? '800' : '500' }]}>
                {c || '·'}
              </Text>
            ))}
          </View>
        ))}
      </View>
      {diffs.length > 1 && (
        <Text style={s.subtitle}>
          Hardest: <Text style={{ fontWeight: '800', color: colors.text }}>#{diffs[0].h.number}</Text> ({fmt(diffs[0].d)} avg) · Easiest:{' '}
          <Text style={{ fontWeight: '800', color: colors.text }}>#{diffs[diffs.length - 1].h.number}</Text> ({fmt(diffs[diffs.length - 1].d)} avg)
        </Text>
      )}
    </View>
  );
}


const st = StyleSheet.create({
  table: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  titleBar: { backgroundColor: colors.primary, paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 3, borderBottomColor: colors.sand },
  titleText: { color: '#fff', fontWeight: '800', letterSpacing: 1.5, fontSize: 13 },
  head: { backgroundColor: '#1D5A3D' },
  headText: { color: '#fff', fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingRight: 6 },
  zebra: { backgroundColor: '#F4F8F5' },
  leadRow: { backgroundColor: '#FBF4E2' },
  pos: { width: 40, textAlign: 'center' },
  posText: { fontWeight: '800', color: colors.primary },
  player: { flex: 1, minWidth: 70 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  num: { textAlign: 'center', fontSize: 15 },
  gridName: { height: 34, lineHeight: 34, paddingLeft: 8, fontSize: 13 },
  gridRow: { flexDirection: 'row', height: 34, alignItems: 'center' },
  gridCell: { textAlign: 'center', fontSize: 13, color: colors.text },
  gridBox: { alignItems: 'center', justifyContent: 'center', height: 34 },
  parRow: { backgroundColor: colors.accentSoft },
  parText: { color: colors.muted, fontWeight: '700' },
  avgRow: { backgroundColor: '#EEF2EF' },
});
