import { useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTrips } from '../../../../../context/TripsContext';
import { leaderboard, computeSettlement, courseFor, skinsForRound, matchPairings, matchStatus } from '../../../../../lib/scoring';
import { holeNumbersFor } from '../../../../../lib/holeRanges';
import { PressableLink } from '../../../../../components/NavCard';
import { Scorecard } from '../../../../../components/Scorecard';
import { s, colors, icon } from '../../../../../lib/styles';

const toParText = (n: number) => (n === 0 ? 'E' : n > 0 ? `+${n}` : `−${-n}`);

export default function Leaderboard() {
  const { tripId, roundId } = useLocalSearchParams<{ tripId: string; roundId: string }>();
  const { getTrip } = useTrips();
  const [open, setOpen] = useState<string[]>([]);
  const trip = getTrip(tripId);
  const round = trip?.rounds.find((r) => r.id === roundId);
  if (!trip || !round) return null;

  const holeNumbers = holeNumbersFor(round.holesPlayed);
  const course = courseFor(trip, round);
  const holes = course.holes.filter((h) => holeNumbers.includes(h.number));
  const rows = leaderboard(trip, round);
  const nameOf = (id: string) => trip.players.find((p) => p.id === id)?.name ?? 'Unknown';
  const roundDone = rows.length > 0 && rows.every((r) => r.thru === holeNumbers.length);
  const winners = roundDone ? rows.filter((r) => r.net === rows[0].net) : [];
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
            const a = nameOf(pairing.playerAId);
            const b = nameOf(pairing.playerBId);
            if (st.holesUp === 0) return `Match: ${a} vs ${b} halved`;
            return `Match: ${st.holesUp > 0 ? a : b} beat ${st.holesUp > 0 ? b : a} ${st.resultLabel}`;
          }),
      ];
  const strokesFor = (playerId: string) => (n: number) =>
    trip.scores.find((sc) => sc.roundId === roundId && sc.playerId === playerId && sc.holeNumber === n)?.strokes;
  const toggle = (id: string) => setOpen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const header = (
    <View style={{ gap: 12 }}>
      {winners.length > 0 && (
        <View style={st.banner} accessibilityRole="header" accessibilityLiveRegion="polite">
          <Ionicons name="trophy" size={32} color={colors.sand} />
          <View style={{ flex: 1 }}>
            <Text style={st.bannerLabel}>{winners.length > 1 ? 'TIED FOR THE WIN' : 'WINNER'}</Text>
            <Text style={st.bannerName}>{winners.map((w) => w.playerName).join(' & ')}</Text>
            <Text style={st.bannerMeta}>
              Net {winners[0].net} ({toParText(winners[0].netToPar)}) · {round.name}
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

      <Text style={s.subtitle}>
        {roundDone ? 'Final results, ranked by net score.' : 'Ranked by net score. Thru = holes entered.'} Tap a
        player for their scorecard.
      </Text>
    </View>
  );

  return (
    <View style={s.screen}>
      <FlatList
        contentContainerStyle={s.content}
        data={rows}
        keyExtractor={(r) => r.playerId}
        ListHeaderComponent={header}
        ListFooterComponent={
          roundDone ? (
            <View style={{ gap: 12, marginTop: 8 }}>
              <PressableLink href={`/trip/${tripId}`} dismissTo style={s.button}>
                <Ionicons name="home" size={icon.sm} color="#fff" />
                <Text style={s.buttonText}>Back to trip</Text>
              </PressableLink>
              <PressableLink href="/" dismissTo style={s.buttonSecondary}>
                <Text style={s.buttonTextSecondary}>All trips</Text>
              </PressableLink>
            </View>
          ) : undefined
        }
        renderItem={({ item, index }) => {
          const leader = item.thru > 0 && item.net === rows[0].net;
          const expanded = open.includes(item.playerId);
          return (
            <View style={[s.card, leader && { borderColor: colors.accent, borderWidth: 2 }]}>
              <Pressable
                onPress={() => toggle(item.playerId)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={`${index + 1}. ${item.playerName}, net ${item.net}, gross ${item.gross}, thru ${item.thru}. ${expanded ? 'Hide' : 'Show'} scorecard`}
                style={({ pressed }) => [s.row, { justifyContent: 'flex-start' }, pressed && s.pressed]}
              >
                <View style={[s.iconBadge, leader && { backgroundColor: colors.accent }]}>
                  <Text style={{ fontWeight: '800', fontSize: 18, color: leader ? '#fff' : colors.accent }}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.title} numberOfLines={1}>
                    {item.playerName}
                  </Text>
                  <Text style={s.subtitle}>
                    {item.thru ? `${toParText(item.netToPar)} net · ` : ''}Thru {item.thru} · Gross {item.gross}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.label}>Net</Text>
                  <Text style={{ fontSize: 26, fontWeight: '800', color: colors.primary }}>{item.net}</Text>
                </View>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={icon.sm} color={colors.muted} />
              </Pressable>
              {expanded && (
                <View style={{ marginTop: 8 }}>
                  <Scorecard holes={holes} strokesFor={strokesFor(item.playerId)} />
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
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
