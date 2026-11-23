import { View, Text } from 'react-native';
import { s, colors } from '../lib/styles';
import { Trip } from '../types/models';
import { tripStandings, eventOf } from '../lib/scoring';

const toParText = (n: number) => (n === 0 ? 'E' : n > 0 ? `+${n}` : `−${-n}`);

// Stroke play / Stableford standings across every round of the event.
export function StandingsBoard({ trip }: { trip: Trip }) {
  const stableford = eventOf(trip).type === 'stableford';
  const rows = tripStandings(trip).filter((r) => r.holes > 0);
  const best = rows[0];
  const metric = (r: (typeof rows)[number]) => (stableford ? `${r.points} pts` : toParText(r.netToPar));

  return (
    <View style={{ gap: 8 }}>
      <View style={[s.card, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
        <Text style={{ color: colors.sand, fontSize: 12, fontWeight: '800', letterSpacing: 2 }}>
          {stableford ? 'STABLEFORD' : 'STROKE PLAY'} · {trip.rounds.length} ROUND{trip.rounds.length === 1 ? '' : 'S'}
        </Text>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>
          {best ? `${best.playerName} leads · ${metric(best)}` : 'No scores yet'}
        </Text>
        <Text style={{ color: '#E6F0EA' }}>
          {stableford ? 'Most points across all rounds wins.' : 'Lowest total net to par across all rounds wins.'}
        </Text>
      </View>
      {rows.map((r, i) => {
        const leader = best && (stableford ? r.points === best.points : r.netToPar === best.netToPar);
        return (
          <View
            key={r.playerId}
            style={[s.card, s.row, { justifyContent: 'flex-start' }, leader && { borderColor: colors.accent, borderWidth: 2 }]}
            accessible
            accessibilityLabel={`${i + 1}. ${r.playerName}, ${metric(r)}, gross ${r.gross}, ${r.rounds} rounds`}
          >
            <View style={[s.iconBadge, leader && { backgroundColor: colors.accent }]}>
              <Text style={{ fontWeight: '800', fontSize: 18, color: leader ? '#fff' : colors.accent }}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.title} numberOfLines={1}>
                {r.playerName}
              </Text>
              <Text style={s.subtitle}>
                {r.rounds} round{r.rounds === 1 ? '' : 's'} · {r.holes} holes · Gross {r.gross}
              </Text>
            </View>
            <Text style={{ fontSize: 24, fontWeight: '800', color: colors.primary }}>{metric(r)}</Text>
          </View>
        );
      })}
    </View>
  );
}
