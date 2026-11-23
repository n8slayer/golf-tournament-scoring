import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ScrollViewInstance } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTrips } from '../context/TripsContext';
import { holeNumbersFor } from '../lib/holeRanges';
import { strokesReceivedOnHole, courseHandicap, formatHandicap } from '../lib/handicap';
import { leaderboard, matchPairings, matchStatus, courseFor, eventOf } from '../lib/scoring';
import { PressableLink } from '../components/NavCard';
import { s, colors, icon } from '../lib/styles';
import { Trip, Round } from '../types/models';

function toParLabel(diff: number): { text: string; color: string } {
  if (diff <= -2) return { text: diff === -2 ? 'Eagle' : 'Albatross', color: colors.under };
  if (diff === -1) return { text: 'Birdie', color: colors.under };
  if (diff === 0) return { text: 'Par', color: colors.accent };
  if (diff === 1) return { text: 'Bogey', color: colors.muted };
  return { text: diff === 2 ? 'Double' : `+${diff}`, color: colors.muted };
}

const toParText = (n: number) => (n === 0 ? 'E' : n > 0 ? `+${n}` : `−${-n}`);

// Index of the first hole someone still needs a score on (last hole if all done).
function firstOpenHole(trip: Trip, round: Round, holes: number[]): number {
  const i = holes.findIndex((n) =>
    round.playerIds.some((pid) => !trip.scores.some((sc) => sc.roundId === round.id && sc.playerId === pid && sc.holeNumber === n))
  );
  return i === -1 ? holes.length - 1 : i;
}

const CHIP = 44;
const GAP = 8;

// Hole-by-hole score entry for one round. Used by the round's Score screen and the event's Score tab.
export function ScoreEntry({ tripId, roundId }: { tripId: string; roundId: string }) {
  const { getTrip, recordScore } = useTrips();
  const trip = getTrip(tripId);
  const round = trip?.rounds.find((r) => r.id === roundId);
  const holes = round ? holeNumbersFor(round.holesPlayed) : [];
  const [index, setIndex] = useState(0);
  const strip = useRef<ScrollViewInstance>(null);
  const [stripWidth, setStripWidth] = useState(0);

  // Resume where the group left off, once (trips load from storage after first render).
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !trip || !round) return;
    resumed.current = true;
    setIndex(firstOpenHole(trip, round, holes));
  }, [trip, round, holes]);

  // Keep the current hole chip in view on narrow screens.
  useEffect(() => {
    strip.current?.scrollTo({ x: Math.max(0, 16 + index * (CHIP + GAP) - stripWidth / 2 + CHIP / 2), animated: true });
  }, [index, stripWidth]);

  if (!trip || !round) return null;

  const holeNumber = holes[index];
  const course = courseFor(trip, round);
  const hole = course.holes.find((h) => h.number === holeNumber)!;
  // Your own player first (if you've said which one you are).
  const mine = trip.sync?.myPlayerId;
  const players = trip.players
    .filter((p) => round.playerIds.includes(p.id))
    .sort((a, b) => (a.id === mine ? -1 : b.id === mine ? 1 : 0));
  const roundScores = trip.scores.filter((sc) => sc.roundId === roundId);
  const strokesFor = (playerId: string, n = holeNumber) =>
    roundScores.find((sc) => sc.playerId === playerId && sc.holeNumber === n)?.strokes;
  const holeDone = (n: number) => players.length > 0 && players.every((p) => strokesFor(p.id, n) !== undefined);
  const reachable = firstOpenHole(trip, round, holes); // can't skip past an unfinished hole
  const isLast = index === holes.length - 1;
  const canAdvance = !isLast && holeDone(holeNumber);
  const roundDone = holes.every(holeDone);

  const step = (playerId: string, delta: number) => {
    const current = strokesFor(playerId);
    // First tap on an empty score starts at par.
    const next = current === undefined ? hole.par : Math.max(1, current + delta);
    recordScore(tripId, roundId, playerId, holeNumber, next);
  };

  // Who's up: match play status first (if on), then net standings.
  const nameOf = (id: string) => trip.players.find((p) => p.id === id)?.name ?? '?';
  const matches = round.matchEnabled
    ? matchPairings(trip, round).map((pairing) => {
        const st = matchStatus(trip, round, pairing);
        const a = pairing.sideA.map(nameOf).join(' & ');
        const b = pairing.sideB.map(nameOf).join(' & ');
        if (st.through === 0) return `${a} vs ${b} · not started`;
        if (st.holesUp === 0) return `${a} vs ${b} · ${st.resultLabel}`;
        const leader = st.holesUp > 0 ? a : b;
        const won = st.closedOut || st.through === holes.length;
        return `${leader} ${won ? 'wins' : ''} ${st.resultLabel}`.replace(/\s+/g, ' ');
      })
    : [];
  const standings = leaderboard(trip, round).filter((r) => r.thru > 0);

  const base = `/trip/${tripId}/rounds/${roundId}`;

  return (
    <View style={s.screen}>
      <View style={{ backgroundColor: colors.primary, paddingBottom: 16 }}>
        {/* Who's up */}
        <View style={[s.content, { paddingBottom: 0, gap: 6 }]} accessibilityLiveRegion="polite">
          <Text style={hb.statusLabel}>{standings.length ? 'WHO’S UP' : 'STANDINGS'}</Text>
          {matches.map((m) => (
            <Text key={m} style={hb.statusText} numberOfLines={1}>
              {m}
            </Text>
          ))}
          {standings.length ? (
            <View style={hb.standings}>
              {standings.map((r, i) => (
                <View key={r.playerId} style={[hb.standing, i === 0 && hb.standingLead]}>
                  <Text style={[hb.standingText, i === 0 && { color: colors.primary }]} numberOfLines={1}>
                    {i + 1}. {r.playerName} {eventOf(trip).type === 'stableford' ? `${r.points} pts` : toParText(r.netToPar)}
                    <Text style={{ fontWeight: '500' }}> · thru {r.thru}</Text>
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={hb.statusText}>No scores yet. Net standings appear after the first hole.</Text>
          )}
        </View>

        {/* Hole header */}
        <View style={[s.content, s.row, { paddingBottom: 0 }]}>
          <Pressable
            onPress={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            accessibilityRole="button"
            accessibilityLabel="Previous hole"
            style={({ pressed }) => [hb.navBtn, index === 0 && s.disabled, pressed && s.pressed]}
          >
            <Ionicons name="chevron-back" size={icon.lg} color="#fff" />
          </Pressable>
          <View style={{ alignItems: 'center' }} accessibilityRole="header">
            <Text style={hb.holeLabel}>HOLE</Text>
            <Text style={hb.holeNumber}>{holeNumber}</Text>
            <Text style={hb.holeMeta}>
              Par {hole.par}
              {hole.yardage ? ` · ${hole.yardage} yds` : ''} · SI {hole.strokeIndex}
            </Text>
          </View>
          <Pressable
            onPress={() => setIndex((i) => i + 1)}
            disabled={!canAdvance}
            accessibilityRole="button"
            accessibilityLabel={canAdvance ? 'Next hole' : 'Next hole, enter every score first'}
            style={({ pressed }) => [hb.navBtn, !canAdvance && s.disabled, pressed && s.pressed]}
          >
            <Ionicons name="chevron-forward" size={icon.lg} color="#fff" />
          </Pressable>
        </View>

        {/* Hole strip: filled = scored; holes past the first unfinished one are locked */}
        <ScrollView
          ref={strip}
          horizontal
          showsHorizontalScrollIndicator={false}
          onLayout={(e) => setStripWidth(e.nativeEvent.layout.width)}
          contentContainerStyle={hb.strip}
        >
          {holes.map((n, i) => {
            const active = i === index;
            const done = holeDone(n);
            const locked = i > reachable;
            return (
              <Pressable
                key={n}
                onPress={() => setIndex(i)}
                disabled={locked}
                accessibilityRole="button"
                accessibilityLabel={`Hole ${n}${done ? ', scored' : ''}${locked ? ', locked' : ''}`}
                accessibilityState={{ selected: active, disabled: locked }}
                style={[hb.chip, done && hb.chipDone, active && hb.chipActive, locked && hb.chipLocked]}
              >
                <Text style={[hb.chipText, active && { color: colors.primary }]}>{n}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {players.map((p) => {
          const strokes = strokesFor(p.id);
          const ch = courseHandicap(p.handicapIndex, course);
          const popsOn = (n: number) =>
            strokesReceivedOnHole(ch, course.holes.find((h) => h.number === n)?.strokeIndex ?? 99);
          const pops = popsOn(holeNumber);
          const strokeHoles = holes
            .filter((n) => popsOn(n) !== 0)
            .map((n) => (Math.abs(popsOn(n)) > 1 ? `${n}×${Math.abs(popsOn(n))}` : String(n)));
          const label = strokes !== undefined ? toParLabel(strokes - hole.par) : null;
          return (
            <View key={p.id} style={s.card}>
              <View style={s.row}>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={[s.row, { justifyContent: 'flex-start', gap: 6 }]}>
                    <Text style={s.title} numberOfLines={1}>
                      {p.name}
                      {p.id === mine ? ' (you)' : ''}
                    </Text>
                    {/* Scorecard-style dots: one per stroke received on this hole */}
                    {Array.from({ length: Math.max(0, pops) }, (_, i) => (
                      <View key={i} style={hb.dot} />
                    ))}
                  </View>
                  <Text style={s.subtitle}>
                    {pops > 0
                      ? `Gets ${pops} stroke${pops > 1 ? 's' : ''} here`
                      : pops < 0
                        ? `Gives back ${-pops} stroke${pops < -1 ? 's' : ''} here`
                        : 'No stroke here'}
                    {label ? ' · ' : ''}
                    {label && <Text style={{ color: label.color, fontWeight: '700' }}>{label.text}</Text>}
                  </Text>
                </View>
                <View style={[s.row, { gap: 8 }]}>
                  <Pressable
                    onPress={() => step(p.id, -1)}
                    accessibilityRole="button"
                    accessibilityLabel={`One less stroke for ${p.name}`}
                    style={({ pressed }) => [hb.stepBtn, pressed && s.pressed]}
                  >
                    <Ionicons name="remove" size={icon.md} color={colors.accent} />
                  </Pressable>
                  <Text
                    style={[hb.score, strokes === undefined && { color: colors.border }]}
                    accessibilityLabel={strokes === undefined ? `${p.name} no score` : `${p.name} ${strokes} strokes`}
                  >
                    {strokes ?? '–'}
                  </Text>
                  <Pressable
                    onPress={() => step(p.id, 1)}
                    accessibilityRole="button"
                    accessibilityLabel={`One more stroke for ${p.name}`}
                    style={({ pressed }) => [hb.stepBtn, hb.stepBtnPlus, pressed && s.pressed]}
                  >
                    <Ionicons name="add" size={icon.md} color={colors.onAccent} />
                  </Pressable>
                </View>
              </View>
              <Text style={hb.strokeHoles}>
                Course HCP {formatHandicap(ch)} ·{' '}
                {strokeHoles.length
                  ? `${ch < 0 ? 'gives back on' : 'strokes on'} ${strokeHoles.join(', ')}`
                  : 'no strokes this round'}
              </Text>
            </View>
          );
        })}

        {players.length === 0 && <Text style={s.subtitle}>No players in this round.</Text>}

        {!isLast && (
          <>
            <Pressable
              onPress={() => setIndex((i) => i + 1)}
              disabled={!canAdvance}
              accessibilityRole="button"
              style={({ pressed }) => [s.button, { marginTop: 8 }, !canAdvance && s.disabled, pressed && s.pressed]}
            >
              <Text style={s.buttonText}>Next hole</Text>
              <Ionicons name="arrow-forward" size={icon.sm} color={colors.onAccent} />
            </Pressable>
            {!canAdvance && (
              <Text style={[s.subtitle, { textAlign: 'center' }]}>Enter a score for everyone to move on.</Text>
            )}
          </>
        )}
        {isLast && roundDone && (
          <PressableLink href={`${base}/leaderboard`} style={[s.button, { marginTop: 8 }]}>
            <Ionicons name="podium" size={icon.sm} color={colors.onAccent} />
            <Text style={s.buttonText}>Round complete · see leaderboard</Text>
          </PressableLink>
        )}
      </ScrollView>
    </View>
  );
}

const hb = StyleSheet.create({
  statusLabel: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  statusText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  standings: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  standing: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  standingLead: { backgroundColor: colors.accent },
  standingText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  navBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  holeLabel: { color: colors.accent, fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  holeNumber: { color: colors.text, fontSize: 56, fontWeight: '800', lineHeight: 62 },
  holeMeta: { color: colors.text, fontSize: 15, fontWeight: '600' },
  // flexGrow + center: centred on wide screens, scrolls normally on phones.
  strip: { paddingHorizontal: 16, gap: GAP, paddingTop: 12, flexGrow: 1, justifyContent: 'center' },
  chip: {
    width: CHIP,
    height: CHIP,
    borderRadius: CHIP / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  chipDone: { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.6)' },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipLocked: { opacity: 0.35 },
  chipText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  strokeHoles: { fontSize: 13, color: colors.muted, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.card,
  },
  stepBtnPlus: { backgroundColor: colors.accent },
  score: { width: 44, textAlign: 'center', fontSize: 28, fontWeight: '800', color: colors.text },
});
