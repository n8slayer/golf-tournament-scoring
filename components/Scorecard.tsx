import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../lib/styles';
import { Hole } from '../types/models';

const CELL = 30;
const MARK = 24;

// Tour-style score marks: double circle eagle or better, circle birdie,
// plain par, square bogey, double square double bogey or worse.
// blank: draw only the shape (used by the legend).
export function ScoreMark({ strokes, par, blank }: { strokes?: number; par: number; blank?: boolean }) {
  if (strokes === undefined) return <Text style={[st.score, { color: colors.border }]}>–</Text>;
  const diff = strokes - par;
  const round = diff < 0;
  const double = diff <= -2 || diff >= 2;
  const color = diff < 0 ? colors.under : colors.text;
  const shape = diff === 0 ? null : { borderWidth: 1.5, borderColor: color, borderRadius: round ? MARK : 2 };
  const label = <Text style={[st.score, { color }]}>{blank ? '' : strokes}</Text>;
  if (!shape) return <View style={st.mark}>{label}</View>;
  return (
    <View style={[st.mark, shape]}>
      {double ? <View style={[st.inner, { borderColor: color, borderRadius: round ? MARK : 1 }]}>{label}</View> : label}
    </View>
  );
}

function Nine({ title, holes, strokesFor }: { title: string; holes: Hole[]; strokesFor: (n: number) => number | undefined }) {
  const par = holes.reduce((sum, h) => sum + h.par, 0);
  const scored = holes.filter((h) => strokesFor(h.number) !== undefined);
  const total = scored.reduce((sum, h) => sum + (strokesFor(h.number) ?? 0), 0);
  return (
    <View style={st.table}>
      <View style={[st.row, st.headRow]}>
        <Text style={[st.rowLabel, st.headText]}>Hole</Text>
        {holes.map((h) => (
          <Text key={h.number} style={[st.cell, st.headText]}>
            {h.number}
          </Text>
        ))}
        <Text style={[st.total, st.headText]}>{title}</Text>
      </View>
      <View style={st.row}>
        <Text style={st.rowLabel}>Par</Text>
        {holes.map((h) => (
          <Text key={h.number} style={[st.cell, st.parText]}>
            {h.par}
          </Text>
        ))}
        <Text style={[st.total, st.parText]}>{par}</Text>
      </View>
      <View style={st.row}>
        <Text style={st.rowLabel}>Score</Text>
        {holes.map((h) => (
          <View key={h.number} style={st.cellBox}>
            <ScoreMark strokes={strokesFor(h.number)} par={h.par} />
          </View>
        ))}
        <Text style={[st.total, { fontWeight: '800', color: colors.text }]}>{scored.length ? total : '–'}</Text>
      </View>
    </View>
  );
}

// Gross scorecard for one player: front and/or back nine, tour-style marks.
export function Scorecard({ holes, strokesFor }: { holes: Hole[]; strokesFor: (n: number) => number | undefined }) {
  const front = holes.filter((h) => h.number <= 9);
  const back = holes.filter((h) => h.number > 9);
  return (
    <View style={{ gap: 10 }}>
      {front.length > 0 && <Nine title="Out" holes={front} strokesFor={strokesFor} />}
      {back.length > 0 && <Nine title="In" holes={back} strokesFor={strokesFor} />}
      <View style={st.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[
          { strokes: 2, par: 4, label: 'Eagle+' },
          { strokes: 3, par: 4, label: 'Birdie' },
          { strokes: 5, par: 4, label: 'Bogey' },
          { strokes: 6, par: 4, label: 'Double+' },
        ].map((l) => (
          <View key={l.label} style={st.legendItem}>
            <ScoreMark strokes={l.strokes} par={l.par} blank />
            <Text style={st.legendText}>{l.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 34 },
  headRow: { backgroundColor: colors.primary },
  headText: { color: '#fff', fontWeight: '700' },
  rowLabel: { width: 44, paddingLeft: 6, fontSize: 12, fontWeight: '700', color: colors.muted },
  cell: { flex: 1, minWidth: CELL - 6, textAlign: 'center', fontSize: 13 },
  cellBox: { flex: 1, minWidth: CELL - 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 3 },
  total: { width: 36, textAlign: 'center', fontSize: 13 },
  parText: { color: colors.muted },
  mark: { width: MARK, height: MARK, alignItems: 'center', justifyContent: 'center' },
  inner: { width: MARK - 6, height: MARK - 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  score: { fontSize: 13, fontWeight: '700', color: colors.text },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 12, color: colors.muted },
});
