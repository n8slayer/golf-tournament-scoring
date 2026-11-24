import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ScrollViewInstance } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTrips } from '../context/TripsContext';
import { holeNumbersFor } from '../lib/holeRanges';
import { strokesReceivedOnHole, courseHandicap, formatHandicap } from '../lib/handicap';
import { leaderboard, matchPairings, matchStatus, courseFor, eventOf, ballSides, sideHandicap, teeGroups } from '../lib/scoring';
import { gameOf, roundGame, fmtGame, wolfOn, wolfPick, WOLF_ID, LONE } from '../lib/games';
import { router } from 'expo-router';
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
function firstOpenHole(trip: Trip, round: Round, holes: number[], ids: string[] = round.playerIds): number {
  const i = holes.findIndex((n) =>
    ids.some((pid) => !trip.scores.some((sc) => sc.roundId === round.id && sc.playerId === pid && sc.holeNumber === n)),
  );
  return i === -1 ? holes.length - 1 : i;
}

const CHIP = 44;
const GAP = 8;

// Hole-by-hole score entry for one round. Used by the round's Score screen and the event's Score tab.
export function ScoreEntry({ tripId, roundId }: { tripId: string; roundId: string }) {
  const { getTrip, recordScore, finishHole } = useTrips();
  const trip = getTrip(tripId);
  const round = trip?.rounds.find((r) => r.id === roundId);
  const holes = round ? holeNumbersFor(round.holesPlayed) : [];
  const [index, setIndex] = useState(0);
  const [pickedGroup, setPickedGroup] = useState<number | null>(null); // null = the group you play in
  const strip = useRef<ScrollViewInstance>(null);
  const [stripWidth, setStripWidth] = useState(0);

  // Resume where the group left off, once (trips load from storage after first render).
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !trip || !round) return;
    resumed.current = true;
    const mineId = trip.sync?.myPlayerId;
    const own = teeGroups(trip, round).find((g) => !!mineId && g.includes(mineId));
    setIndex(firstOpenHole(trip, round, holes, own));
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
  // Score one tee time (max 4 players): yours by default, switchable.
  const groups = teeGroups(trip, round);
  const groupIndex =
    pickedGroup ??
    Math.max(
      0,
      groups.findIndex((g) => !!mine && g.includes(mine)),
    );
  const group = groups[groupIndex] ?? round.playerIds;
  const players = trip.players.filter((p) => group.includes(p.id)).sort((a, b) => (a.id === mine ? -1 : b.id === mine ? 1 : 0));
  // Who gets a score row: each player, or each side in alternate shot / scramble (one ball per side;
  // its score is saved for every player on the side). Your own row first.
  const sides = ballSides(trip, round).filter((ids) => ids.some((id) => group.includes(id)));
  const onASide = new Set(sides.flat());
  const entries = [
    ...sides.map((ids) => ({
      id: ids[0],
      ids,
      name: ids.map((id) => trip.players.find((x) => x.id === id)?.name ?? '?').join(' & '),
      ch: sideHandicap(trip, round, ids),
      isMine: !!mine && ids.includes(mine),
    })),
    ...players
      .filter((p) => !onASide.has(p.id))
      .map((p) => ({ id: p.id, ids: [p.id], name: p.name, ch: courseHandicap(p.handicapIndex, course), isMine: p.id === mine })),
  ].sort((a, b) => Number(b.isMine) - Number(a.isMine));
  const roundScores = trip.scores.filter((sc) => sc.roundId === roundId);
  const strokesFor = (playerId: string, n = holeNumber) =>
    roundScores.find((sc) => sc.playerId === playerId && sc.holeNumber === n)?.strokes;
  const holeDone = (n: number) => players.length > 0 && players.every((p) => strokesFor(p.id, n) !== undefined);
  const reachable = firstOpenHole(trip, round, holes, group); // can't skip past an unfinished hole
  const isLast = index === holes.length - 1;
  // Wolf: the wolf rotates each hole and must pick a partner (or go alone) before moving on.
  const game = gameOf(trip);
  const wolf = game?.type === 'wolf' ? wolfOn(round, index) : undefined;
  const pick = wolf ? wolfPick(trip, round, holeNumber) : undefined;
  const choose = (choice: string | 'lone') =>
    recordScore(tripId, roundId, WOLF_ID, holeNumber, choice === 'lone' ? LONE : round.playerIds.indexOf(choice) + 1);
  const picked = (n: number, i: number) => game?.type !== 'wolf' || !!wolfPick(trip, round, n) || !wolfOn(round, i);
  const canAdvance = !isLast && holeDone(holeNumber) && picked(holeNumber, index);
  const roundDone = holes.every((n, i) => holeDone(n) && picked(n, i));

  // Scores on this hole are final: Party Mode alerts fire now (not mid-entry).
  const nextHole = () => {
    finishHole(tripId, roundId, holeNumber);
    setIndex((i) => i + 1);
  };

  const step = (ids: string[], delta: number) => {
    const current = strokesFor(ids[0]);
    // First tap on an empty score starts at par.
    const next = current === undefined ? hole.par : Math.max(1, current + delta);
    for (const id of ids) recordScore(tripId, roundId, id, holeNumber, next);
  };

  // Who's up: match play status first (if on), then net standings.
  const nameOf = (id: string) => trip.players.find((p) => p.id === id)?.name ?? '?';
  const matches = round.matchEnabled
    ? matchPairings(trip, round)
        .filter((pairing) => [...pairing.sideA, ...pairing.sideB].some((id) => group.includes(id)))
        .map((pairing) => {
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
  // Individual net standings mean nothing when each side plays one ball: show only the match status then.
  const standings = sides.length || game ? [] : leaderboard(trip, round).filter((r) => r.thru > 0 && group.includes(r.playerId));
  // Extra games: this round's game result (teams, or the group's players).
  const gameRows = game ? roundGame(trip, round).filter((r) => r.value !== null && (game.teams || group.includes(r.id))) : [];

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
          ) : gameRows.length ? (
            <View style={hb.standings}>
              {gameRows.map((r, i) => (
                <View key={r.id} style={[hb.standing, i === 0 && hb.standingLead]}>
                  <Text style={[hb.standingText, i === 0 && { color: colors.primary }]} numberOfLines={1}>
                    {r.name} {fmtGame(r.value, game!.unit)}
                    {game!.unit === 'pts' ? ' pts' : ''}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            !sides.length && <Text style={hb.statusText}>No scores yet. Standings appear after the first hole.</Text>
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
            onPress={nextHole}
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
        {groups.length > 1 && (
          <View style={{ gap: 6 }}>
            <View style={s.pillRow} accessibilityRole="tablist">
              {groups.map((g, i) => (
                <Pressable
                  key={i}
                  onPress={() => {
                    setPickedGroup(i);
                    setIndex(firstOpenHole(trip, round, holes, g));
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: i === groupIndex }}
                  accessibilityLabel={`Group ${i + 1}: ${g.map((id) => trip.players.find((x) => x.id === id)?.name ?? '?').join(', ')}`}
                  style={[s.pill, i === groupIndex && s.pillActive]}
                >
                  <Text style={i === groupIndex ? s.pillTextActive : s.pillText}>
                    Group {i + 1}
                    {!!mine && g.includes(mine) ? ' (you)' : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={[s.subtitle, { fontSize: 13 }]}>Scoring for {players.map((p) => p.name).join(', ')}</Text>
          </View>
        )}
        {wolf && (
          <View style={[s.card, { gap: 8 }]}>
            <Text style={s.title}>🐺 {nameOf(wolf)} is the wolf</Text>
            <Text style={s.subtitle}>Partner or alone? Pick before moving on.</Text>
            <View style={s.pillRow} accessibilityRole="radiogroup">
              {[...round.playerIds.filter((id) => id !== wolf), 'lone' as const].map((c) => (
                <Pressable
                  key={c}
                  onPress={() => choose(c)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: pick === c }}
                  style={({ pressed }) => [s.pill, pick === c && s.pillActive, pressed && s.pressed]}
                >
                  <Text style={pick === c ? s.pillTextActive : s.pillText}>{c === 'lone' ? 'Lone wolf' : `+ ${nameOf(c)}`}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        {entries.map((p) => {
          const strokes = strokesFor(p.id);
          const ch = p.ch;
          const popsOn = (n: number) => strokesReceivedOnHole(ch, course.holes.find((h) => h.number === n)?.strokeIndex ?? 99);
          const pops = popsOn(holeNumber);
          const label = strokes !== undefined ? toParLabel(strokes - hole.par) : null;
          return (
            <View key={p.id} style={s.card}>
              <View style={s.row}>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={[s.row, { justifyContent: 'flex-start', gap: 6 }]}>
                    <Text style={s.title} numberOfLines={1}>
                      {p.name}
                      {p.isMine ? ' (you)' : ''}
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
                    onPress={() => step(p.ids, -1)}
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
                    onPress={() => step(p.ids, 1)}
                    accessibilityRole="button"
                    accessibilityLabel={`One more stroke for ${p.name}`}
                    style={({ pressed }) => [hb.stepBtn, hb.stepBtnPlus, pressed && s.pressed]}
                  >
                    <Ionicons name="add" size={icon.md} color={colors.onAccent} />
                  </Pressable>
                </View>
              </View>
              <View style={hb.strokeHoles}>
                <Text style={hb.strokeTitle}>
                  {ch < 0 ? `Gives back strokes · HCP ${formatHandicap(ch)}` : `Strokes by hole · HCP ${formatHandicap(ch)}`}
                </Text>
                {/* Scorecard style: a dot above each hole per stroke received (hollow = gives one back). */}
                {[holes.slice(0, 9), holes.slice(9)]
                  .filter((row) => row.length)
                  .map((row) => (
                    <View key={row[0]} style={hb.strokeRow}>
                      {row.map((n) => {
                        const k = popsOn(n);
                        const here = n === holeNumber;
                        return (
                          <View
                            key={n}
                            style={[hb.strokeCell, here && hb.strokeCellHere]}
                            accessibilityLabel={`Hole ${n}: ${k > 0 ? `${k} stroke${k > 1 ? 's' : ''}` : k < 0 ? `gives back ${-k}` : 'no stroke'}`}
                          >
                            <View style={hb.strokeDots}>
                              {Array.from({ length: Math.abs(k) }, (_, i) => (
                                <View
                                  key={i}
                                  style={[
                                    hb.miniDot,
                                    k < 0 && hb.miniDotBack,
                                    here && { backgroundColor: k < 0 ? 'transparent' : colors.onAccent, borderColor: colors.onAccent },
                                  ]}
                                />
                              ))}
                            </View>
                            <Text style={[hb.strokeNum, here && { color: colors.onAccent }]}>{n}</Text>
                          </View>
                        );
                      })}
                    </View>
                  ))}
              </View>
            </View>
          );
        })}

        {players.length === 0 && <Text style={s.subtitle}>No players in this round.</Text>}

        {!isLast && (
          <>
            <Pressable
              onPress={nextHole}
              disabled={!canAdvance}
              accessibilityRole="button"
              style={({ pressed }) => [s.button, { marginTop: 8 }, !canAdvance && s.disabled, pressed && s.pressed]}
            >
              <Text style={s.buttonText}>Next hole</Text>
              <Ionicons name="arrow-forward" size={icon.sm} color={colors.onAccent} />
            </Pressable>
            {!canAdvance && (
              <Text style={[s.subtitle, { textAlign: 'center' }]}>
                {holeDone(holeNumber) ? 'Pick the wolf’s partner to move on.' : 'Enter a score for everyone to move on.'}
              </Text>
            )}
          </>
        )}
        {isLast && roundDone && (
          <Pressable
            onPress={() => {
              finishHole(tripId, roundId, holeNumber);
              router.push(`${base}/leaderboard`);
            }}
            accessibilityRole="link"
            style={({ pressed }) => [s.button, { marginTop: 8 }, pressed && s.pressed]}
          >
            <Ionicons name="podium" size={icon.sm} color={colors.onAccent} />
            <Text style={s.buttonText}>Round complete · see leaderboard</Text>
          </Pressable>
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
  strokeHoles: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, gap: 6 },
  strokeTitle: { fontSize: 12, color: colors.muted, fontWeight: '700', letterSpacing: 0.5 },
  strokeRow: { flexDirection: 'row', gap: 3 },
  strokeCell: { flex: 1, alignItems: 'center', paddingVertical: 3, borderRadius: 6 },
  strokeCellHere: { backgroundColor: colors.accent },
  strokeDots: { flexDirection: 'row', gap: 2, height: 6, alignItems: 'center' },
  miniDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
  miniDotBack: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.accent },
  strokeNum: { fontSize: 13, color: colors.text, fontWeight: '600', fontVariant: ['tabular-nums'] },
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
