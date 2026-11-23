import { View, Text, StyleSheet } from 'react-native';
import { Href } from 'expo-router';
import { PressableLink } from './NavCard';
import { s, colors } from '../lib/styles';
import { Trip, Round } from '../types/models';
import {
  matchPairings,
  matchStatus,
  matchPoints,
  teamPoints,
  courseFor,
  formatOf,
  allowanceFor,
  MatchPairing,
} from '../lib/scoring';
import { holeNumbersFor } from '../lib/holeRanges';

// 2.5 → "2½", 0.5 → "½"
export const fmtPts = (n: number) => {
  const whole = Math.floor(n);
  const half = n - whole >= 0.5;
  return half ? `${whole || ''}½` : String(whole);
};

const FORMAT_LABEL = { singles: 'Singles', fourball: 'Four Ball' } as const;

export function MatchCard({ trip, round, pairing, href }: { trip: Trip; round: Round; pairing: MatchPairing; href?: Href }) {
  const total = holeNumbersFor(round.holesPlayed).length;
  const st = matchStatus(trip, round, pairing);
  const pts = matchPoints(st, total);
  const nameOf = (id: string) => trip.players.find((p) => p.id === id)?.name ?? '?';
  const leaderColor = st.holesUp > 0 ? colors.teamA : st.holesUp < 0 ? colors.teamB : null;
  const big =
    st.through === 0 ? '–' : st.holesUp === 0 ? 'AS' : st.closedOut ? st.resultLabel : `${Math.abs(st.holesUp)} UP`;
  const small = st.through === 0 ? 'Not started' : pts ? 'Final' : `thru ${st.through}`;
  const sideText = (ids: string[]) => ids.map(nameOf).join(' & ');
  const a11y = `${sideText(pairing.sideA)} versus ${sideText(pairing.sideB)}. ${
    st.through === 0
      ? 'Not started'
      : st.holesUp === 0
        ? `All square, ${small}`
        : `${st.holesUp > 0 ? trip.teams[0]?.name : trip.teams[1]?.name} ${big}, ${small}`
  }`;

  const body = (
    <>
      <View style={st_.row}>
        <View style={[st_.side, { borderLeftColor: colors.teamA, borderLeftWidth: 4, paddingLeft: 8 }]}>
          {pairing.sideA.map((id) => (
            <Text key={id} style={[st_.name, { color: colors.teamA }]} numberOfLines={1}>
              {nameOf(id)}
            </Text>
          ))}
          {pts && <Text style={st_.pts}>{fmtPts(pts.a)} pt</Text>}
        </View>
        <View style={st_.center}>
          <View style={[st_.status, leaderColor ? { backgroundColor: leaderColor } : { backgroundColor: colors.accentSoft }]}>
            <Text style={[st_.statusBig, { color: leaderColor ? '#fff' : colors.primary }]}>{big}</Text>
          </View>
          <Text style={st_.statusSmall}>{small}</Text>
        </View>
        <View
          style={[st_.side, { alignItems: 'flex-end', borderRightColor: colors.teamB, borderRightWidth: 4, paddingRight: 8 }]}
        >
          {pairing.sideB.map((id) => (
            <Text key={id} style={[st_.name, { color: colors.teamB, textAlign: 'right' }]} numberOfLines={1}>
              {nameOf(id)}
            </Text>
          ))}
          {pts && <Text style={st_.pts}>{fmtPts(pts.b)} pt</Text>}
        </View>
      </View>
      {href && <Text style={[s.linkText, { fontSize: 14, textAlign: 'center' }]}>Scorecard ›</Text>}
    </>
  );

  return href ? (
    <PressableLink href={href} style={[s.card, { gap: 8 }]} label={a11y}>
      {body}
    </PressableLink>
  ) : (
    <View style={[s.card, { gap: 8 }]} accessible accessibilityLabel={a11y}>
      {body}
    </View>
  );
}

// Session header for one round: date, course, tees, format, allowance, points.
export function SessionHeader({ trip, round }: { trip: Trip; round: Round }) {
  const course = courseFor(trip, round);
  const count = matchPairings(trip, round).length;
  const allowance = allowanceFor(round);
  const date = new Date(round.date);
  return (
    <View style={{ gap: 2 }}>
      <Text style={s.label}>
        {Number.isNaN(date.getTime())
          ? round.name
          : `${date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${round.name}`}
      </Text>
      <Text style={s.subtitle}>
        {[
          course.name,
          course.tee,
          FORMAT_LABEL[formatOf(round)],
          allowance < 1 ? `${Math.round(allowance * 100)}% HCP` : null,
          `${count} pt${count === 1 ? '' : 's'}`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
    </View>
  );
}

// Team score header + every round's matches. Renders nothing until teams and matches exist.
export function MatchBoard({ trip }: { trip: Trip }) {
  const [teamA, teamB] = trip.teams;
  const rounds = trip.rounds.filter((r) => r.matchEnabled && matchPairings(trip, r).length > 0);
  if (!teamA || !teamB || rounds.length === 0) return null;
  const tp = teamPoints(trip);
  const winner = tp.a >= tp.toWin ? teamA : tp.b >= tp.toWin ? teamB : null;

  return (
    <View style={{ gap: 12 }}>
      <View style={st_.scoreRow} accessible accessibilityLabel={`${teamA.name} ${fmtPts(tp.a)}, ${teamB.name} ${fmtPts(tp.b)}`}>
        <View style={[st_.team, { backgroundColor: colors.teamA }]}>
          <Text style={st_.teamName} numberOfLines={1}>
            {teamA.name}
          </Text>
          <Text style={st_.teamPts}>{fmtPts(tp.a)}</Text>
        </View>
        <Text style={st_.vs}>vs</Text>
        <View style={[st_.team, { backgroundColor: colors.teamB }]}>
          <Text style={st_.teamName} numberOfLines={1}>
            {teamB.name}
          </Text>
          <Text style={st_.teamPts}>{fmtPts(tp.b)}</Text>
        </View>
      </View>
      <Text style={[s.subtitle, { textAlign: 'center', fontWeight: '700' }]}>
        {winner ? `${winner.name} have won the cup!` : `${fmtPts(tp.toWin)} pts to win the cup`}
      </Text>

      {rounds.map((round) => (
        <View key={round.id} style={{ gap: 8, marginTop: 4 }}>
          <SessionHeader trip={trip} round={round} />
          {matchPairings(trip, round).map((pairing, i) => (
            <MatchCard
              key={`${round.id}-${i}`}
              trip={trip}
              round={round}
              pairing={pairing}
              href={`/trip/${trip.id}/rounds/${round.id}/match`}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const st_ = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  side: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '700' },
  pts: { fontSize: 12, fontWeight: '700', color: colors.muted },
  center: { width: 84, alignItems: 'center', gap: 4 },
  status: { minWidth: 64, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, alignItems: 'center' },
  statusBig: { fontSize: 16, fontWeight: '800' },
  statusSmall: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  team: { flex: 1, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center' },
  teamName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  teamPts: { color: '#fff', fontSize: 40, fontWeight: '800', lineHeight: 46 },
  vs: { color: colors.muted, fontWeight: '700' },
});
