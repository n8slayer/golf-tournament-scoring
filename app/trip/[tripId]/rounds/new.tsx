import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Switch, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTrips } from '../../../../context/TripsContext';
import { HolesPlayed, MatchFormat } from '../../../../types/models';
import { defaultPairings, eventOf, isTeamBall } from '../../../../lib/scoring';
import { MatchBuilder, Slots, isComplete } from '../../../../components/MatchBuilder';
import { PressableLink } from '../../../../components/NavCard';
import { s } from '../../../../lib/styles';

const HOLE_OPTIONS: { value: HolesPlayed; label: string }[] = [
  { value: 'front9', label: 'Front 9' },
  { value: 'back9', label: 'Back 9' },
  { value: '18', label: '18 holes' },
];

export default function NewRound() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { getTrip, createRound, canEdit } = useTrips();
  const trip = getTrip(tripId);
  const router = useRouter();

  const event = trip ? eventOf(trip) : undefined;
  const [name, setName] = useState(`Round ${(trip?.rounds.length ?? 0) + 1}`);
  const [holesPlayed, setHolesPlayed] = useState<HolesPlayed>('18');
  const [courseId, setCourseId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(trip?.players.map((p) => p.id) ?? []);
  // Opened directly (event still loading): select everyone once it arrives.
  const playerCount = trip?.players.length ?? 0;
  useEffect(() => {
    if (playerCount && selected.length === 0) setSelected(trip!.players.map((p) => p.id));
  }, [playerCount]);
  const [skinsEnabled, setSkinsEnabled] = useState(true);
  const [skinValue, setSkinValue] = useState(String(event?.skinValue ?? 5));
  const [matchEnabled, setMatchEnabled] = useState(event ? event.type === 'rydercup' : true);
  const [matchStake, setMatchStake] = useState(String(event?.matchStake ?? 20));
  const [format, setFormat] = useState<MatchFormat>('singles');
  const [allowance, setAllowance] = useState(90); // four-ball %
  const [slots, setSlots] = useState<Slots[] | null>(null); // null = draft-order defaults

  if (!trip) return null;
  if (!canEdit(trip)) {
    return (
      <View style={[s.screen, s.content]}>
        <Text style={s.subtitle}>Only organizers can start new rounds.</Text>
      </View>
    );
  }
  if (trip.courses.length === 0) {
    return (
      <View style={[s.screen, s.content]}>
        <Text style={s.title}>Add a course first</Text>
        <Text style={s.subtitle}>A round needs a course and its scorecard.</Text>
        <PressableLink href={`/trip/${trip.id}/course`} style={s.button}>
          <Text style={s.buttonText}>Add a course</Text>
        </PressableLink>
      </View>
    );
  }
  const chosenCourseId = courseId ?? trip.courses[0]?.id;

  const toggleSelected = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setSlots(null); // roster changed: re-suggest pairings
  };

  const hasTeams = trip.teams.length === 2;
  const matches: Slots[] = slots ?? defaultPairings(trip, selected, format);
  // No matches (e.g. players not on teams yet) is fine: the round is stroke play + skins.
  const matchesOk = !matchEnabled || !hasTeams || matches.length === 0 || isComplete(matches);
  const withMatches = matchEnabled && hasTeams && matches.length > 0;
  // One ball per side: no individual scores, so no skins.
  const teamBall = (withMatches && isTeamBall(format)) || event?.type === 'team-scramble';
  const wolfBad = event?.type === 'wolf' && (selected.length < 3 || selected.length > 4);
  // With matches, only the players in a match play this round (others would block scoring and skins).
  const inMatches = withMatches ? selected.filter((id) => matches.some((m) => [...m.sideA, ...m.sideB].includes(id))) : selected;
  const leftOut = selected.filter((id) => !inMatches.includes(id)).map((id) => trip.players.find((p) => p.id === id)?.name ?? '?');
  const canCreate = selected.length > 0 && !!name.trim() && matchesOk && !wolfBad;

  const submit = () => {
    if (!canCreate || !chosenCourseId) return;
    const id = createRound(tripId, {
      name: name.trim(),
      courseId: chosenCourseId,
      date: new Date().toISOString(),
      holesPlayed,
      skinsEnabled: skinsEnabled && !teamBall,
      skinValue: parseFloat(skinValue) || 0,
      matchEnabled: withMatches,
      matchStake: parseFloat(matchStake) || 0,
      playerIds: inMatches,
      ...(withMatches
        ? {
            format,
            ...(format === 'fourball' ? { allowance } : {}),
            matches: matches.map((m, i) => ({
              id: `m${i + 1}`,
              sideA: m.sideA as string[],
              sideB: m.sideB as string[],
            })),
          }
        : {}),
    });
    router.replace(`/trip/${tripId}/rounds/${id}`);
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.label}>Round name</Text>
      <TextInput style={s.input} value={name} onChangeText={setName} />

      <Text style={s.label}>Course</Text>
      <View style={s.pillRow}>
        {trip.courses.map((c) => (
          <Pressable
            key={c.id}
            style={[s.pill, chosenCourseId === c.id && s.pillActive]}
            onPress={() => setCourseId(c.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: chosenCourseId === c.id }}
          >
            <Text style={chosenCourseId === c.id ? s.pillTextActive : s.pillText}>
              {c.name}
              {c.tee ? ` · ${c.tee}` : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>Holes</Text>
      <View style={s.pillRow}>
        {HOLE_OPTIONS.map((opt) => (
          <Pressable key={opt.value} style={[s.pill, holesPlayed === opt.value && s.pillActive]} onPress={() => setHolesPlayed(opt.value)}>
            <Text style={holesPlayed === opt.value ? s.pillTextActive : s.pillText}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>Players in this round</Text>
      <View style={s.pillRow}>
        {trip.players.map((p) => (
          <Pressable key={p.id} style={[s.pill, selected.includes(p.id) && s.pillActive]} onPress={() => toggleSelected(p.id)}>
            <Text style={selected.includes(p.id) ? s.pillTextActive : s.pillText}>{p.name}</Text>
          </Pressable>
        ))}
      </View>

      {wolfBad && <Text style={s.subtitle}>Wolf is played by one group: pick 3 or 4 players.</Text>}

      <View style={[s.row, { marginTop: 8 }]}>
        <Text style={s.label}>Skins</Text>
        {teamBall ? (
          <Text style={[s.subtitle, { flex: 1, textAlign: 'right' }]}>Off: one ball per {withMatches ? 'side' : 'team'}</Text>
        ) : (
          <Switch value={skinsEnabled} onValueChange={setSkinsEnabled} />
        )}
      </View>
      {skinsEnabled && !teamBall && (
        <View>
          <Text style={s.label}>$ per skin</Text>
          <TextInput style={s.input} value={skinValue} onChangeText={setSkinValue} keyboardType="decimal-pad" />
        </View>
      )}

      <View style={s.row}>
        <Text style={s.label}>Match Play</Text>
        <Switch value={matchEnabled} onValueChange={setMatchEnabled} />
      </View>
      {matchEnabled && (
        <View style={{ gap: 12 }}>
          <View>
            <Text style={s.label}>$ per match (0 for points only)</Text>
            <TextInput style={s.input} value={matchStake} onChangeText={setMatchStake} keyboardType="decimal-pad" />
          </View>
          {hasTeams ? (
            <>
              <MatchBuilder
                trip={trip}
                playerIds={selected}
                format={format}
                onFormat={(f) => {
                  setFormat(f);
                  setSlots(null);
                }}
                allowance={allowance}
                onAllowance={setAllowance}
                matches={matches}
                onChange={setSlots}
              />
              {leftOut.length > 0 && (
                <Text style={s.subtitle}>
                  Not in a match, so not playing this round: {leftOut.join(', ')}. Add another match to include them.
                </Text>
              )}
            </>
          ) : (
            <Text style={s.subtitle}>Run the Team Draft first to set up matches.</Text>
          )}
        </View>
      )}

      <Pressable
        style={[s.button, { marginTop: 12 }, !canCreate && s.disabled]}
        onPress={submit}
        disabled={!canCreate}
        accessibilityRole="button"
      >
        <Text style={s.buttonText}>Create round</Text>
      </Pressable>
    </ScrollView>
  );
}
