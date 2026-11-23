import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTrips, TripSetup } from '../../context/TripsContext';
import { CourseSearch, courseSummary } from '../../components/CourseSearch';
import { PlayerForm } from '../../components/PlayerForm';
import { formatHandicap } from '../../lib/handicap';
import { s, colors, icon } from '../../lib/styles';
import { NewCourse, EventType } from '../../types/models';

const EVENT_TYPES: { type: EventType; title: string; blurb: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: 'rydercup', title: 'Ryder Cup', blurb: 'Two teams, match play. First to the points target wins the cup.', icon: 'trophy' },
  { type: 'strokeplay', title: 'Stroke play', blurb: 'Every shot counts. Lowest total net score over all rounds wins.', icon: 'golf' },
  { type: 'stableford', title: 'Stableford', blurb: 'Points per hole (2 for net par). Most points wins; one blow-up hole won’t ruin you.', icon: 'stats-chart' },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (v: string) => DATE_RE.test(v) && !Number.isNaN(new Date(v).getTime());

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10, marginTop: 12 }}>
      <View style={[s.row, { justifyContent: 'flex-start' }]}>
        <View style={st.step}>
          <Text style={st.stepText}>{n}</Text>
        </View>
        <Text style={[s.title, { fontSize: 20 }]} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

export default function NewTrip() {
  const { addTrip } = useTrips();
  const router = useRouter();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState<EventType>('rydercup');
  const [courses, setCourses] = useState<NewCourse[]>([]);
  const [players, setPlayers] = useState<TripSetup['players']>([]);
  const [teamNames, setTeamNames] = useState<[string, string]>(['Team A', 'Team B']);
  const [skinValue, setSkinValue] = useState('5');
  const [matchStake, setMatchStake] = useState('20');

  const ryder = type === 'rydercup';
  const dateError =
    (startDate && !validDate(startDate)) || (endDate && !validDate(endDate))
      ? 'Use dates like 2026-07-16.'
      : startDate && endDate && endDate < startDate
        ? 'End date is before the start date.'
        : '';
  const teamError = ryder && teamNames.some((t) => !t.trim()) ? 'Give both teams a name.' : '';
  const problems = [
    !name.trim() && 'Name your event.',
    courses.length === 0 && 'Add at least one course.',
    dateError,
    teamError,
  ].filter(Boolean) as string[];
  const canSubmit = problems.length === 0;

  const submit = () => {
    if (!canSubmit) return;
    const id = addTrip({
      name: name.trim(),
      courses,
      event: {
        type,
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        skinValue: Math.max(0, parseFloat(skinValue) || 0),
        matchStake: Math.max(0, parseFloat(matchStake) || 0),
      },
      players: players.map((p) => (ryder ? p : { name: p.name, handicapIndex: p.handicapIndex })),
      ...(ryder ? { teamNames: [teamNames[0].trim(), teamNames[1].trim()] as [string, string] } : {}),
    });
    router.replace(`/trip/${id}`);
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.h1} accessibilityRole="header">
        Set up your event
      </Text>
      <Text style={s.subtitle}>Everything here can be changed later. Players can also join with a link.</Text>

      <Section n={1} title="Event">
        <Text style={s.label}>Event name</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Myrtle Beach Cup 2026"
          accessibilityLabel="Event name"
        />
        <View style={[s.row, { alignItems: 'flex-start' }]}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={s.label}>Starts (optional)</Text>
            <TextInput style={s.input} value={startDate} onChangeText={setStartDate} placeholder="2026-07-16" accessibilityLabel="Start date" />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={s.label}>Ends (optional)</Text>
            <TextInput style={s.input} value={endDate} onChangeText={setEndDate} placeholder="2026-07-18" accessibilityLabel="End date" />
          </View>
        </View>
        {!!dateError && <Text style={{ color: colors.danger }}>{dateError}</Text>}

        <Text style={s.label}>Format</Text>
        {EVENT_TYPES.map((e) => {
          const active = type === e.type;
          return (
            <Pressable
              key={e.type}
              onPress={() => setType(e.type)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`${e.title}. ${e.blurb}`}
              style={({ pressed }) => [s.card, s.row, { justifyContent: 'flex-start' }, active && st.active, pressed && s.pressed]}
            >
              <View style={[s.iconBadge, active && { backgroundColor: colors.accent }]}>
                <Ionicons name={e.icon} size={icon.md} color={active ? colors.onAccent : colors.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.title}>{e.title}</Text>
                <Text style={s.subtitle}>{e.blurb}</Text>
              </View>
              <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={icon.md} color={active ? colors.accent : colors.muted} />
            </Pressable>
          );
        })}
      </Section>

      <Section n={2} title={`Courses (${courses.length})`}>
        {courses.map((c, i) => (
          <View key={`${c.name}-${c.tee}-${i}`} style={[s.card, s.row, { justifyContent: 'flex-start' }]}>
            <View style={s.iconBadge}>
              <Ionicons name="flag" size={icon.md} color={colors.accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.title}>{c.name}</Text>
              <Text style={s.subtitle}>{courseSummary(c)}</Text>
            </View>
            <Pressable
              onPress={() => setCourses((prev) => prev.filter((_, j) => j !== i))}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${c.name}`}
              style={st.iconBtn}
            >
              <Ionicons name="close" size={icon.md} color={colors.muted} />
            </Pressable>
          </View>
        ))}
        <CourseSearch title={courses.length ? 'Add another course' : 'Add a course'} onAdd={(c) => setCourses((prev) => [...prev, c])} />
      </Section>

      {ryder && (
        <Section n={3} title="Teams">
          <View style={s.row}>
            {[0, 1].map((i) => (
              <TextInput
                key={i}
                style={[s.input, { flex: 1, minWidth: 0, borderWidth: 2, borderColor: i ? colors.teamB : colors.teamA, fontWeight: '700' }]}
                value={teamNames[i]}
                onChangeText={(v) => setTeamNames((prev) => (i ? [prev[0], v] : [v, prev[1]]))}
                accessibilityLabel={`Team ${i + 1} name`}
                maxLength={24}
              />
            ))}
          </View>
          {!!teamError && <Text style={{ color: colors.danger }}>{teamError}</Text>}
          <Text style={s.subtitle}>Put players on a team below, or leave them unassigned and run the draft later.</Text>
        </Section>
      )}

      <Section n={ryder ? 4 : 3} title={`Players (${players.length})`}>
        <Text style={s.subtitle}>Optional now. You can add more later, or players can add themselves when they join.</Text>
        {players.map((p, i) => (
          <View key={`${p.name}-${i}`} style={[s.card, { gap: 8 }]}>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{p.name}</Text>
                <Text style={s.subtitle}>Index {formatHandicap(p.handicapIndex)}</Text>
              </View>
              <Pressable
                onPress={() => setPlayers((prev) => prev.filter((_, j) => j !== i))}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${p.name}`}
                style={st.iconBtn}
              >
                <Ionicons name="close" size={icon.md} color={colors.muted} />
              </Pressable>
            </View>
            {ryder && (
              <View style={s.pillRow}>
                {([0, 1] as const).map((t) => {
                  const active = p.team === t;
                  const color = t ? colors.teamB : colors.teamA;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => setPlayers((prev) => prev.map((q, j) => (j === i ? { ...q, team: active ? undefined : t } : q)))}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      accessibilityLabel={`${p.name} on ${teamNames[t] || `team ${t + 1}`}`}
                      style={[s.pill, { borderColor: color }, active && { backgroundColor: color }]}
                    >
                      <Text style={[s.pillText, { color: active ? colors.onTeam : t ? colors.teamBText : colors.teamAText }]}>{teamNames[t] || `Team ${t + 1}`}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ))}
        <View style={s.card}>
          <PlayerForm onAdd={(n, idx) => setPlayers((prev) => [...prev, { name: n, handicapIndex: idx }])} />
        </View>
      </Section>

      <Section n={ryder ? 5 : 4} title="Side games">
        <Text style={s.subtitle}>Defaults for each new round. Set 0 to play for bragging rights.</Text>
        <View style={s.row}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={s.label}>$ per skin</Text>
            <TextInput style={s.input} value={skinValue} onChangeText={setSkinValue} keyboardType="decimal-pad" accessibilityLabel="Dollars per skin" />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={s.label}>$ per match</Text>
            <TextInput style={s.input} value={matchStake} onChangeText={setMatchStake} keyboardType="decimal-pad" accessibilityLabel="Dollars per match" />
          </View>
        </View>
      </Section>

      <Pressable
        style={({ pressed }) => [s.button, { marginTop: 20, minHeight: 56 }, !canSubmit && s.disabled, pressed && s.pressed]}
        onPress={submit}
        disabled={!canSubmit}
        accessibilityRole="button"
      >
        <Text style={s.buttonText}>Create event</Text>
      </Pressable>
      {!canSubmit && <Text style={[s.subtitle, { textAlign: 'center' }]}>{problems.join(' ')}</Text>}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  step: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: colors.onAccent, fontWeight: '800' },
  active: { borderColor: colors.accent, borderWidth: 2 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
