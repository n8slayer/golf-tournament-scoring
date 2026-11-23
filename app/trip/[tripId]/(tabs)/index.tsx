import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Share, Platform } from 'react-native';
import { useGlobalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTrips } from '../../../../context/TripsContext';
import { PressableLink } from '../../../../components/NavCard';
import { TeamScoreHeader } from '../../../../components/MatchBoard';
import { CourseHero } from '../../../../components/CourseHero';
import { SetupChecklist } from '../../../../components/SetupChecklist';
import { joinLink } from '../../../../components/ShareCard';
import { playerSlots, PlayerSlot } from '../../../../lib/sync';
import {
  eventOf,
  tripStandings,
  leaderboard,
  computeSettlement,
  courseFor,
  formatOf,
  FORMAT_LABEL,
  allowanceFor,
  matchPairings,
} from '../../../../lib/scoring';
import { holeNumbersFor } from '../../../../lib/holeRanges';
import { formatHandicap } from '../../../../lib/handicap';
import { s, colors, icon } from '../../../../lib/styles';
import { Trip, Round } from '../../../../types/models';

const FORMAT_NAME = { rydercup: 'Ryder Cup', strokeplay: 'Stroke play', stableford: 'Stableford' } as const;
const toPar = (n: number) => (n === 0 ? 'E' : n > 0 ? `+${n}` : `−${-n}`);

function roundState(trip: Trip, round: Round): 'done' | 'live' | 'upcoming' {
  const total = holeNumbersFor(round.holesPlayed).length;
  const rows = leaderboard(trip, round);
  if (rows.length && rows.every((r) => r.thru === total)) return 'done';
  return rows.some((r) => r.thru > 0) ? 'live' : 'upcoming';
}

function Chip({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'gold' | 'green' }) {
  const color = tone === 'gold' ? colors.accent : tone === 'green' ? colors.good : colors.muted;
  return (
    <View style={[s.chip, tone !== 'muted' && { borderColor: color, backgroundColor: 'transparent' }]}>
      <Text style={[s.chipText, { color }]}>{text}</Text>
    </View>
  );
}

// Join code pill: tap to share (phones) or copy (web) the invite link.
function CodePill({ trip }: { trip: Trip }) {
  const [copied, setCopied] = useState(false);
  if (!trip.sync) return null;
  const code = trip.sync.inviteCode.toUpperCase();
  const link = joinLink(trip.sync.inviteCode);
  const onPress = async () => {
    if (Platform.OS !== 'web') {
      try {
        await Share.share({ message: `Join ${trip.name}: code ${code} or ${link}`, url: link });
        return;
      } catch {
        // fall through to copy
      }
    }
    await Clipboard.setStringAsync(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Join code ${code.split('').join(' ')}. ${copied ? 'Link copied' : 'Tap to share the invite link'}`}
      style={({ pressed }) => [st.pill, pressed && s.pressed]}
    >
      <Text style={st.code}>{code}</Text>
      <Ionicons name={copied ? 'checkmark' : 'share-outline'} size={14} color={colors.muted} />
      <Text style={st.pillHint}>{copied ? 'Link copied' : 'Tap to share'}</Text>
    </Pressable>
  );
}

function RoundCard({ trip, round }: { trip: Trip; round: Round }) {
  const state = roundState(trip, round);
  const course = courseFor(trip, round);
  const matches = round.matchEnabled ? matchPairings(trip, round).length : 0;
  const allowance = allowanceFor(round);
  const dot = state === 'done' ? colors.good : state === 'live' ? colors.accent : colors.border;
  const holes = round.holesPlayed === '18' ? '18 holes' : round.holesPlayed === 'front9' ? 'Front 9' : 'Back 9';
  return (
    <PressableLink
      href={`/trip/${trip.id}/rounds/${round.id}`}
      label={`${round.name}, ${state === 'done' ? 'finished' : state === 'live' ? 'in progress' : 'not started'}, ${course.name}`}
      style={[s.card, st.roundCard, state === 'live' && { borderColor: colors.accent }]}
    >
      <View style={[st.dot, { backgroundColor: dot }]} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={[s.row, { justifyContent: 'flex-start', flexWrap: 'wrap', gap: 6 }]}>
          <Text style={[s.title, { fontSize: 17 }]}>{round.name}</Text>
          {round.skinsEnabled && <Chip text="SKINS" tone="gold" />}
          {round.matchEnabled && <Chip text="MATCH" tone="gold" />}
          {state === 'done' && <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />}
          {state === 'live' && <Chip text="LIVE" tone="green" />}
        </View>
        <View style={[s.row, { justifyContent: 'flex-start', flexWrap: 'wrap', gap: 6 }]}>
          {round.matchEnabled && <Chip text={FORMAT_LABEL[formatOf(round)].toUpperCase()} />}
          <Text style={[s.subtitle, { fontSize: 14, color: colors.text }]} numberOfLines={1}>
            {course.name}
          </Text>
          {course.tee && <Chip text={course.tee} />}
          <Chip text={matches ? `${matches} match${matches === 1 ? '' : 'es'}` : `${round.playerIds.length} players`} />
          <Chip text={holes} />
          {allowance < 1 && <Chip text={`${Math.round(allowance * 100)}% HCP`} tone="green" />}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={icon.sm} color={colors.muted} />
    </PressableLink>
  );
}

function RoundsTab({ trip, canEdit }: { trip: Trip; canEdit: boolean }) {
  const byDate = new Map<string, Round[]>();
  for (const r of [...trip.rounds].sort((a, b) => a.date.localeCompare(b.date))) {
    const d = new Date(r.date);
    const key = Number.isNaN(d.getTime())
      ? 'Rounds'
      : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    byDate.set(key, [...(byDate.get(key) ?? []), r]);
  }
  return (
    <View style={{ gap: 10 }}>
      <Text style={st.section}>ROUNDS ({trip.rounds.length})</Text>
      {trip.rounds.length === 0 && (
        <Text style={s.subtitle}>No rounds yet. {canEdit ? 'Start one when you hit the first tee.' : 'The organizer will start one.'}</Text>
      )}
      {[...byDate.entries()].map(([date, rounds]) => (
        <View key={date} style={{ gap: 8 }}>
          <Text style={st.date}>{date.toUpperCase()}</Text>
          {rounds.map((r) => (
            <RoundCard key={r.id} trip={trip} round={r} />
          ))}
        </View>
      ))}
      {canEdit && (
        <PressableLink href={`/trip/${trip.id}/rounds/new`} style={s.button}>
          <Ionicons name="add" size={icon.md} color={colors.onAccent} />
          <Text style={s.buttonText}>New round</Text>
        </PressableLink>
      )}
    </View>
  );
}

function PlayersTab({ trip }: { trip: Trip }) {
  const [slots, setSlots] = useState<PlayerSlot[]>([]);
  useEffect(() => {
    if (!trip.sync) return;
    playerSlots(trip.id)
      .then(setSlots)
      .catch(() => {});
  }, [trip.id, trip.players.length]);

  const groups: { name: string; color: string; text: string; ids: string[] }[] =
    trip.teams.length === 2
      ? [
          ...trip.teams.map((t, i) => ({
            name: t.name,
            color: i ? colors.teamB : colors.teamA,
            text: i ? colors.teamBText : colors.teamAText,
            ids: trip.players.filter((p) => p.teamId === t.id).map((p) => p.id),
          })),
          { name: 'Not drafted', color: colors.muted, text: colors.muted, ids: trip.players.filter((p) => !p.teamId).map((p) => p.id) },
        ].filter((g) => g.ids.length)
      : [{ name: 'Players', color: colors.accent, text: colors.accent, ids: trip.players.map((p) => p.id) }];

  return (
    <View style={{ gap: 14 }}>
      {trip.players.length === 0 && <Text style={s.subtitle}>No players yet. Invite people with the join code above.</Text>}
      {groups.map((g) => {
        const ps = g.ids.map((id) => trip.players.find((p) => p.id === id)!);
        const total = ps.reduce((a, p) => a + p.handicapIndex, 0);
        return (
          <View key={g.name} style={{ gap: 6 }}>
            <View style={s.row}>
              <Text style={[st.section, { color: g.text }]}>
                {g.name.toUpperCase()} ({ps.length})
              </Text>
              <Text style={st.meta}>
                TOT {formatHandicap(Math.round(total * 10) / 10)} · AVG {formatHandicap(Math.round((total / ps.length) * 10) / 10)}
              </Text>
            </View>
            {ps.map((p) => {
              const mine = trip.sync?.myPlayerId === p.id;
              const slot = slots.find((x) => x.player_id === p.id);
              const isClaimed = !!slot?.claimed || mine;
              const invited = !isClaimed && !!(slot?.reserved || p.email);
              return (
                <View key={p.id} style={[s.card, s.row, { paddingVertical: 12, borderLeftWidth: 4, borderLeftColor: g.color }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.title}>
                      {p.name}
                      {mine ? ' (you)' : ''}
                    </Text>
                    {trip.sync && (
                      <Text style={[st.meta, { color: isClaimed ? colors.good : invited ? colors.accent : colors.muted }]}>
                        {isClaimed ? 'JOINED' : invited ? 'INVITED' : 'NOT JOINED YET'}
                      </Text>
                    )}
                  </View>
                  <Text style={st.hcp}>{formatHandicap(p.handicapIndex)}</Text>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

function MoneyTab({ trip }: { trip: Trip }) {
  const lines = computeSettlement(trip);
  const nameOf = (id: string) => trip.players.find((p) => p.id === id)?.name ?? '?';
  return (
    <View style={{ gap: 10 }}>
      <Text style={st.section}>WHO OWES WHO · ALL ROUNDS</Text>
      {lines.length === 0 && <Text style={s.subtitle}>Nothing owed yet. Skins and match bets settle here as rounds finish.</Text>}
      {lines.map((l, i) => (
        <View key={i} style={[s.card, s.row, { paddingVertical: 12 }]}>
          <Text style={[s.title, { flex: 1, fontSize: 16 }]}>
            {nameOf(l.fromPlayerId)} <Text style={{ color: colors.muted, fontWeight: '500' }}>pays</Text> {nameOf(l.toPlayerId)}
          </Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.accent }}>${l.amount.toFixed(2)}</Text>
        </View>
      ))}
      <PressableLink href={`/trip/${trip.id}/settlement`} style={s.buttonSecondary}>
        <Text style={s.buttonTextSecondary}>Settle up details</Text>
      </PressableLink>
    </View>
  );
}

export default function EventHome() {
  const { tripId } = useGlobalSearchParams<{ tripId: string }>();
  const { getTrip, canEdit, offline, pending } = useTrips();
  const [tab, setTab] = useState<'rounds' | 'players' | 'money'>('rounds');
  const trip = getTrip(tripId);
  if (!trip) return null;
  const editor = canEdit(trip);
  const event = eventOf(trip);
  const leader = event.type !== 'rydercup' ? tripStandings(trip).find((r) => r.holes > 0) : undefined;
  const needsPlayer = !editor && trip.sync && !trip.sync.myPlayerId;
  const dates = [event.startDate, event.endDate].filter(Boolean).join(' – ');
  // Photo of the course being played now (or next), else the first course.
  const heroRound = trip.rounds.find((r) => roundState(trip, r) === 'live') ?? trip.rounds.find((r) => roundState(trip, r) === 'upcoming');
  const heroCourse = heroRound ? courseFor(trip, heroRound) : trip.courses[0];

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <CourseHero courseName={heroCourse?.name} height={180}>
        <Text style={st.kicker}>
          {FORMAT_NAME[event.type].toUpperCase()}
          {dates ? ` · ${dates}` : ''}
        </Text>
        <Text style={[s.h1, st.onPhoto, { fontSize: 30 }]} accessibilityRole="header">
          {trip.name}
        </Text>
        {heroCourse && <Text style={[st.onPhoto, { color: colors.text, fontWeight: '600' }]}>{heroCourse.name}</Text>}
      </CourseHero>
      <CodePill trip={trip} />
      {event.partyMode && (
        <View style={{ alignItems: 'center' }}>
          <Chip text="🍻 PARTY MODE · BIRDIES = DRINKS" tone="gold" />
        </View>
      )}

      {(offline || pending > 0) && (
        <Text style={[s.subtitle, { color: offline ? colors.danger : colors.muted }]}>
          {offline
            ? `Offline. ${pending} change${pending === 1 ? '' : 's'} saved on this phone.`
            : `Syncing ${pending} change${pending === 1 ? '' : 's'}…`}
        </Text>
      )}
      {editor && <SetupChecklist trip={trip} />}
      {needsPlayer && trip.sync && (
        <PressableLink href={`/join/${trip.sync.inviteCode}`} style={s.buttonSecondary}>
          <Ionicons name="person" size={icon.sm} color={colors.accent} />
          <Text style={s.buttonTextSecondary}>Tell us which player you are</Text>
        </PressableLink>
      )}

      {event.type === 'rydercup' ? (
        <TeamScoreHeader trip={trip} />
      ) : (
        <View style={st.leader}>
          <Text style={st.kicker}>{event.type === 'stableford' ? 'MOST POINTS' : 'LOWEST NET'}</Text>
          <Text style={[s.title, { fontSize: 22 }]}>
            {leader
              ? `${leader.playerName} leads · ${event.type === 'stableford' ? `${leader.points} pts` : toPar(leader.netToPar)}`
              : 'No scores yet'}
          </Text>
        </View>
      )}
      <View style={st.rule} />

      <View style={st.segment} accessibilityRole="tablist">
        {(
          [
            ['rounds', 'Rounds'],
            ['players', 'Players'],
            ['money', '$'],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            accessibilityLabel={key === 'money' ? 'Money' : label}
            style={[st.segBtn, tab === key && st.segActive]}
          >
            <Text style={[st.segText, tab === key && { color: colors.text }, key === 'money' && { color: colors.good }]}>
              {label.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'rounds' && <RoundsTab trip={trip} canEdit={editor} />}
      {tab === 'players' && <PlayersTab trip={trip} />}
      {tab === 'money' && <MoneyTab trip={trip} />}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  onPhoto: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  code: { color: colors.accent, fontSize: 18, fontWeight: '800', letterSpacing: 4 },
  pillHint: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  leader: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  rule: { height: 1, backgroundColor: colors.accent, opacity: 0.5, marginVertical: 4 },
  segment: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: colors.border },
  segBtn: { flex: 1, minHeight: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segActive: { backgroundColor: colors.headBar },
  segText: { color: colors.muted, fontWeight: '800', letterSpacing: 1, fontSize: 13 },
  section: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  date: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  meta: { color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  hcp: { color: colors.text, fontSize: 18, fontWeight: '800' },
  roundCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
