import { useState } from 'react';
import { View, Text } from 'react-native';
import { s, colors } from '../lib/styles';
import { Trip } from '../types/models';
import { leaderboard, eventOf, courseFor } from '../lib/scoring';
import { holeNumbersFor } from '../lib/holeRanges';
import { Scorecard } from './Scorecard';
import { TvTable, ModeToggle, Mode, BoardRow, toPar, parColor, positions } from './TvBoard';

// Stroke play / Stableford standings across every round, TV style: R1, R2… then TOT.
export function StandingsBoard({ trip }: { trip: Trip }) {
  const [mode, setMode] = useState<Mode>('net');
  const stableford = eventOf(trip).type === 'stableford';
  const perRound = trip.rounds.map((round) => new Map(leaderboard(trip, round).map((r) => [r.playerId, r])));

  const rows: BoardRow[] = trip.players
    .map((p) => {
      let toParSum = 0;
      let points = 0;
      let gross = 0;
      let holes = 0;
      const roundCells = perRound.map((m) => {
        const r = m.get(p.id);
        if (!r || r.thru === 0) return { text: '–' };
        const value = mode === 'net' ? r.netToPar : r.netToPar + (r.gross - r.net);
        toParSum += value;
        points += r.points;
        gross += r.gross;
        holes += r.thru;
        return stableford ? { text: String(r.points) } : { text: toPar(value), color: parColor(value) };
      });
      return {
        key: p.id,
        name: p.name,
        sortValue: !holes ? 9999 : stableford ? -points : toParSum,
        cells: [
          stableford
            ? { text: holes ? String(points) : '–', bold: true }
            : { text: holes ? toPar(toParSum) : '–', color: parColor(toParSum), bold: true },
          ...roundCells,
          { text: holes ? String(gross) : '–' },
        ],
        a11y: `${p.name}, ${stableford ? `${points} points` : `${toPar(toParSum)} ${mode}`}, gross ${gross}`,
      };
    })
    .sort((a, b) => a.sortValue - b.sortValue);

  const leaders = rows.filter((r, i) => r.sortValue < 9999 && positions(rows.map((x) => x.sortValue))[i].replace('T', '') === '1');

  return (
    <View style={{ gap: 8 }}>
      <View style={[s.card, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
        <Text style={{ color: colors.sand, fontSize: 12, fontWeight: '800', letterSpacing: 2 }}>
          {stableford ? 'STABLEFORD' : 'STROKE PLAY'} · {trip.rounds.length} ROUND{trip.rounds.length === 1 ? '' : 'S'}
        </Text>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
          {leaders.length
            ? `${leaders.map((l) => l.name).join(' & ')} ${leaders.length > 1 ? 'lead' : 'leads'} · ${leaders[0].cells[0].text}${stableford ? ' pts' : ''}`
            : 'No scores yet'}
        </Text>
        <Text style={{ color: colors.muted }}>
          {stableford ? 'Most points across all rounds wins.' : `Lowest total ${mode} to par across all rounds wins.`}
        </Text>
      </View>
      {!stableford && <ModeToggle mode={mode} onChange={setMode} />}
      <TvTable
        title="LEADERBOARD"
        columns={[
          { label: stableford ? 'PTS' : 'TO PAR', width: 58 },
          ...trip.rounds.map((_, i) => ({ label: `R${i + 1}`, width: 40 })),
          { label: 'TOT', width: 44 },
        ]}
        rows={rows}
        renderExpanded={(playerId) => (
          <View style={{ gap: 14 }}>
            {trip.rounds.map((round, i) => {
              const r = perRound[i].get(playerId);
              if (!r || r.thru === 0) return null;
              const course = courseFor(trip, round);
              const holeNumbers = holeNumbersFor(round.holesPlayed);
              const strokesFor = (n: number) =>
                trip.scores.find((sc) => sc.roundId === round.id && sc.playerId === playerId && sc.holeNumber === n)?.strokes;
              return (
                <View key={round.id} style={{ gap: 6 }}>
                  <Text style={s.title}>
                    {`R${i + 1} · ${round.name}`}
                  </Text>
                  <Text style={s.subtitle}>
                    {course.name} · {r.thru === holeNumbers.length ? 'Finished' : `Thru ${r.thru}`} · Gross {r.gross} · Net {r.net} (
                    {toPar(r.netToPar)}){stableford ? ` · ${r.points} pts` : ''}
                  </Text>
                  <Scorecard holes={course.holes.filter((h) => holeNumbers.includes(h.number))} strokesFor={strokesFor} />
                </View>
              );
            })}
            {!perRound.some((m) => (m.get(playerId)?.thru ?? 0) > 0) && <Text style={s.subtitle}>No scores yet.</Text>}
          </View>
        )}
      />
      <Text style={s.subtitle}>
        {stableford ? 'R columns are points per round.' : `R columns are ${mode} to par per round.`} TOT = total gross strokes. Tap a
        player for their scorecards.
      </Text>
    </View>
  );
}
