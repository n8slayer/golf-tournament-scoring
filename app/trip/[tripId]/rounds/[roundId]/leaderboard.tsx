import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTrips } from '../../../../../context/TripsContext';
import { leaderboard, computeSettlement, courseFor, skinsForRound, matchPairings, matchStatus, eventOf } from '../../../../../lib/scoring';
import { holeNumbersFor } from '../../../../../lib/holeRanges';
import { PressableLink } from '../../../../../components/NavCard';
import { Scorecard } from '../../../../../components/Scorecard';
import { TvTable, HoleByHole, ScoringStats, ModeToggle, Mode, BoardRow, toPar, parColor } from '../../../../../components/TvBoard';
import { s, colors, icon } from '../../../../../lib/styles';

const toParText = (n: number) => (n === 0 ? 'E' : n > 0 ? `+${n}` : `−${-n}`);

export default function Leaderboard() {
  const { tripId, roundId } = useLocalSearchParams<{ tripId: string; roundId: string }>();
  const { getTrip } = useTrips();
  const [mode, setMode] = useState<Mode>('net');
  const trip = getTrip(tripId);
  const round = trip?.rounds.find((r) => r.id === roundId);
  if (!trip || !round) return null;

  const holeNumbers = holeNumbersFor(round.holesPlayed);
  const course = courseFor(trip, round);
  const holes = course.holes.filter((h) => holeNumbers.includes(h.number));
  const rows = leaderboard(trip, round);
  const stableford = eventOf(trip).type === 'stableford';
  const nameOf = (id: string) => trip.players.find((p) => p.id === id)?.name ?? 'Unknown';
  const roundDone = rows.length > 0 && rows.every((r) => r.thru === holeNumbers.length);
  const winners = roundDone
    ? rows.filter((r) => (stableford ? r.points === rows[0].points : r.net === rows[0].net))
    : [];
  const payments = roundDone ? computeSettlement(trip, [round]) : [];
  const hasMoney = round.skinsEnabled || round.matchEnabled;
  // Why the money moved: skins won per player and each match result.
  const breakdown = !roundDone
    ? []
    : [
        ...(round.skinsEnabled
          ? [
              'Skins: ' +
                (round.playerIds
                  .map((id) => ({ id, n: skinsForRound(trip, round).filter((sk) => sk.winnerPlayerId === id).length }))
                  .filter((x) => x.n > 0)
                  .map((x) => `${nameOf(x.id)} ${x.n}`)
                  .join(', ') || 'none won'),
            ]
          : []),
        ...matchPairings(trip, round)
          .filter(() => round.matchEnabled)
          .map((pairing) => {
            const st = matchStatus(trip, round, pairing);
            const a = pairing.sideA.map(nameOf).join(' & ');
            const b = pairing.sideB.map(nameOf).join(' & ');
            if (st.holesUp === 0) return `Match: ${a} vs ${b} halved`;
            return `Match: ${st.holesUp > 0 ? a : b} beat ${st.holesUp > 0 ? b : a} ${st.resultLabel}`;
          }),
      ];
  const strokesOf = (playerId: string, n: number) =>
    trip.scores.find((sc) => sc.roundId === roundId && sc.playerId === playerId && sc.holeNumber === n)?.strokes;
  const total = holeNumbers.length;

  // TV board rows. Players with nothing entered sort last.
  const boardRows: BoardRow[] = rows
    .map((r) => {
      const grossToPar = r.netToPar + (r.gross - r.net);
      const shownToPar = mode === 'net' ? r.netToPar : grossToPar;
      const started = r.thru > 0;
      const thru = r.thru === total ? 'F' : started ? String(r.thru) : '–';
      return {
        key: r.playerId,
        name: r.playerName,
        sortValue: !started ? 9999 : stableford ? -r.points : mode === 'net' ? r.net : r.gross,
        cells: stableford
          ? [
              { text: started ? String(r.points) : '–', bold: true },
              { text: thru },
              { text: started ? String(r.gross) : '–' },
              { text: started ? String(r.net) : '–' },
            ]
          : [
              { text: started ? toPar(shownToPar) : '–', color: parColor(shownToPar), bold: true },
              { text: thru },
              { text: started ? String(r.gross) : '–' },
              { text: started ? String(r.net) : '–' },
            ],
        a11y: `${r.playerName}, ${stableford ? `${r.points} points` : `${toPar(shownToPar)} ${mode}`}, thru ${thru}, gross ${r.gross}, net ${r.net}`,
      };
    })
    .sort((a, b) => a.sortValue - b.sortValue);
  const roundPlayers = rows.map((r) => ({ id: r.playerId, name: r.playerName }));

  const header = (
    <View style={{ gap: 12 }}>
      {winners.length > 0 && (
        <View style={st.banner} accessibilityRole="header" accessibilityLiveRegion="polite">
          <Ionicons name="trophy" size={32} color={colors.sand} />
          <View style={{ flex: 1 }}>
            <Text style={st.bannerLabel}>{winners.length > 1 ? 'TIED FOR THE WIN' : 'WINNER'}</Text>
            <Text style={st.bannerName}>{winners.map((w) => w.playerName).join(' & ')}</Text>
            <Text style={st.bannerMeta}>
              {stableford ? `${winners[0].points} pts` : `Net ${winners[0].net} (${toParText(winners[0].netToPar)})`} · {round.name}
            </Text>
          </View>
        </View>
      )}

      {roundDone && (
        <View style={s.card}>
          <Text style={s.label}>Who pays</Text>
          {!hasMoney && <Text style={s.subtitle}>No skins or match play on this round.</Text>}
          {hasMoney && payments.length === 0 && <Text style={s.subtitle}>All square. Nobody owes anything.</Text>}
          {payments.map((p, i) => (
            <View key={i} style={[s.row, { minHeight: 36 }]}>
              <Text style={[s.title, { flex: 1, fontSize: 16 }]}>
                {nameOf(p.fromPlayerId)} <Text style={{ color: colors.muted, fontWeight: '500' }}>pays</Text>{' '}
                {nameOf(p.toPlayerId)}
              </Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.accent }}>${p.amount.toFixed(2)}</Text>
            </View>
          ))}
          {breakdown.map((line) => (
            <Text key={line} style={[s.subtitle, { fontSize: 14 }]}>
              {line}
            </Text>
          ))}
        </View>
      )}

    </View>
  );

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      {header}

      <View style={[s.row, { marginTop: 4 }]}>
        <Text style={[s.label, { flex: 1 }]}>{roundDone ? 'Final leaderboard' : 'Live leaderboard'}</Text>
        {!stableford && <ModeToggle mode={mode} onChange={setMode} />}
      </View>
      <TvTable
        title={`${round.name.toUpperCase()} · ${course.name.toUpperCase()}`}
        columns={[
          { label: stableford ? 'PTS' : 'TO PAR', width: 58 },
          { label: 'THRU', width: 42 },
          { label: 'GROSS', width: 50 },
          { label: 'NET', width: 42 },
        ]}
        rows={boardRows}
        renderExpanded={(id) => <Scorecard holes={holes} strokesFor={(n) => strokesOf(id, n)} />}
      />
      <Text style={s.subtitle}>
        {stableford ? 'Ranked by Stableford points.' : `Ranked by ${mode} score. TO PAR is ${mode} to par.`} THRU F = finished. Tap a player
        for their scorecard.
      </Text>

      <Text style={[s.label, { marginTop: 12 }]}>Hole by hole (gross)</Text>
      <HoleByHole holes={holes} players={roundPlayers} strokesFor={strokesOf} />

      <Text style={[s.label, { marginTop: 12 }]}>Scoring stats</Text>
      <ScoringStats holes={holes} players={roundPlayers} strokesFor={strokesOf} />

      {roundDone && (
        <View style={{ gap: 12, marginTop: 8 }}>
          <PressableLink href={`/trip/${tripId}`} dismissTo style={s.button}>
            <Ionicons name="home" size={icon.sm} color="#fff" />
            <Text style={s.buttonText}>Back to trip</Text>
          </PressableLink>
          <PressableLink href="/" dismissTo style={s.buttonSecondary}>
            <Text style={s.buttonTextSecondary}>All trips</Text>
          </PressableLink>
        </View>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 18,
    borderWidth: 2,
    borderColor: colors.sand,
  },
  bannerLabel: { color: colors.sand, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  bannerName: { color: '#fff', fontSize: 26, fontWeight: '800' },
  bannerMeta: { color: '#E6F0EA', fontSize: 15, fontWeight: '600' },
});
