import { View, Text } from 'react-native';
import { s, colors } from '../lib/styles';
import { Trip, Round } from '../types/models';
import { gameOf, gameStandings, roundGame, fmtGame, EVENT_LABEL } from '../lib/games';
import { TvTable, BoardRow, parColor, positions } from './TvBoard';

// Standings for the extra games (Order of Merit, Wolf, team games): R1, R2… then the total.
export function GameBoard({ trip }: { trip: Trip }) {
  const game = gameOf(trip)!;
  const standings = gameStandings(trip);
  const cell = (v: number | null, bold = false) => ({
    text: fmtGame(v, game.unit),
    color: game.unit === 'toPar' && v !== null ? parColor(v) : undefined,
    bold,
  });
  const rows: BoardRow[] = standings.map((r) => ({
    key: r.id,
    name: r.name,
    sortValue: r.value === null ? 9999 : game.higherWins ? -r.value : r.value,
    cells: [cell(r.value, true), ...r.perRound.map((v) => cell(v))],
    a11y: `${r.name}, ${fmtGame(r.value, game.unit)}${game.unit === 'pts' ? ' points' : ' to par'}`,
  }));
  const pos = positions(rows.map((r) => r.sortValue));
  const leaders = rows.filter((r, i) => r.sortValue < 9999 && pos[i].replace('T', '') === '1');
  const members = (teamId: string) => trip.players.filter((p) => p.teamId === teamId).map((p) => p.name).join(', ');

  return (
    <View style={{ gap: 8 }}>
      <View style={[s.card, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
        <Text style={{ color: colors.sand, fontSize: 12, fontWeight: '800', letterSpacing: 2 }}>
          {EVENT_LABEL[game.type].toUpperCase()} · {trip.rounds.length} ROUND{trip.rounds.length === 1 ? '' : 'S'}
        </Text>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
          {leaders.length
            ? `${leaders.map((l) => l.name).join(' & ')} ${leaders.length > 1 ? 'lead' : 'leads'} · ${leaders[0].cells[0].text}${game.unit === 'pts' ? ' pts' : ''}`
            : 'No scores yet'}
        </Text>
        <Text style={{ color: colors.muted }}>{game.rule}</Text>
      </View>
      <TvTable
        title="LEADERBOARD"
        columns={[{ label: game.unit === 'pts' ? 'PTS' : 'TO PAR', width: 58 }, ...trip.rounds.map((_, i) => ({ label: `R${i + 1}`, width: 40 }))]}
        rows={rows}
        renderExpanded={game.teams ? (id) => <Text style={s.subtitle}>{members(id) || 'No players yet'}</Text> : undefined}
      />
      {game.teams && trip.teams.length !== 2 && <Text style={s.subtitle}>Draft teams to start the team leaderboard.</Text>}
    </View>
  );
}

// This round's game result, for the round leaderboard and score entry.
export function RoundGameCard({ trip, round }: { trip: Trip; round: Round }) {
  const game = gameOf(trip);
  if (!game) return null;
  const rows = roundGame(trip, round);
  return (
    <View style={s.card}>
      <Text style={s.label}>
        {EVENT_LABEL[game.type]} · {round.name}
      </Text>
      {rows.map((r, i) => (
        <View key={r.id} style={[s.row, { minHeight: 32 }]}>
          <Text style={[s.title, { flex: 1, fontSize: 16 }]}>
            {r.value === null ? '' : `${i + 1}. `}
            {r.name}
          </Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: r.value !== null && i === 0 ? colors.accent : colors.text }}>
            {fmtGame(r.value, game.unit)}
            {game.unit === 'pts' && r.value !== null ? ' pts' : ''}
          </Text>
        </View>
      ))}
      <Text style={[s.subtitle, { fontSize: 13 }]}>{game.rule}</Text>
    </View>
  );
}
